// AI providers (FRD §6.2): which ones the app offers, and the key test behind
// the Test button (FR-2.4, AC-2.4). Calls go through the Vercel AI SDK (D12),
// loaded with a dynamic import, so the first page load doesn't pay for it.
//
// Nothing here reads browser globals. The caller passes `fetch` in, so the
// tests can replay recorded answers and the desktop app can reuse this (NFR-12).

export const PROVIDER_IDS = ['gemini', 'openrouter', 'anthropic', 'openai'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  /**
   * `ready`: confirmed with a real key from a browser page (FRD §19).
   * `unconfirmed`: a made-up key got a readable answer, but no real key has
   * been tried, so the app doesn't offer it yet (AC-2.1).
   */
  status: 'ready' | 'unconfirmed';
  /** The model the key test and, later, the hunt use (FR-2.5). */
  model: string;
  /** Where the user creates a key. */
  keyUrl: string;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    status: 'ready',
    // The default provider and model (FRD D13): free on Gemini's free tier.
    model: 'gemini-3.1-flash-lite',
    keyUrl: 'https://aistudio.google.com/apikey',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    status: 'ready',
    // A free model that passed structured output and page reading in the spike (FRD §19).
    // Free models come and go: check it still exists before relying on it.
    model: 'inclusionai/ling-3.2-flash:free',
    keyUrl: 'https://openrouter.ai/settings/keys',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    status: 'unconfirmed',
    model: 'claude-haiku-5-5',
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    status: 'unconfirmed',
    model: 'gpt-6-luna',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
};

export const DEFAULT_PROVIDER: ProviderId = 'gemini';

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && (PROVIDER_IDS as readonly string[]).includes(value);
}

/**
 * Why a key test failed, in the causes AC-2.4 names. `rate-limited` is not a
 * failure of the key: the provider knew it, and only asked us to slow down.
 */
export type KeyProblem =
  | 'wrong-key'
  | 'no-credit'
  | 'rate-limited'
  | 'provider-down'
  | 'missing-capability'
  | 'no-connection'
  | 'timeout'
  | 'unknown';

export type KeyTestResult = { ok: true } | { ok: false; problem: KeyProblem };

/** The parts of an AI SDK `APICallError` this needs, so tests can make one by hand. */
interface ErrorShape {
  name?: unknown;
  statusCode?: unknown;
  responseBody?: unknown;
  message?: unknown;
  cause?: unknown;
}

/**
 * Turns an error from a provider call into a cause the user can act on. It
 * only reads status codes and a few known words, and never returns the raw
 * text, which might quote the request (AC-2.4).
 */
export function classifyProviderError(error: unknown): KeyProblem {
  const shape = (typeof error === 'object' && error !== null ? error : {}) as ErrorShape;
  const name = typeof shape.name === 'string' ? shape.name : '';
  const status = typeof shape.statusCode === 'number' ? shape.statusCode : null;
  const text = [shape.responseBody, shape.message].filter((part) => typeof part === 'string').join(' ').toLowerCase();

  if (name === 'TimeoutError' || (name === 'AbortError' && text.includes('timeout'))) return 'timeout';
  const cause = shape.cause as ErrorShape | undefined;
  if (cause && typeof cause === 'object' && cause.name === 'TimeoutError') return 'timeout';

  if (status === null) {
    // A failed fetch has no status. It is offline, or the provider can't be reached from a browser.
    if (name === 'TypeError' || /failed to fetch|network|load failed/.test(text)) return 'no-connection';
    return 'unknown';
  }
  if (status === 401 || status === 403) return 'wrong-key';
  if (status === 402) return 'no-credit';
  if (status === 429) return /credit|billing|balance/.test(text) ? 'no-credit' : 'rate-limited';
  // Gemini answers a bad key with 400 and these words.
  if (status === 400 && /api key|api_key_invalid|unauthenticated|permission/.test(text)) return 'wrong-key';
  if (status === 400 && /credit|billing/.test(text)) return 'no-credit';
  if (status === 404 && /model/.test(text)) return 'missing-capability';
  if (status >= 500) return 'provider-down';
  return 'unknown';
}

export interface KeyTestOptions {
  fetch: typeof globalThis.fetch;
  /** AC-2.4 asks for an answer within 10 seconds. */
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * Sends one tiny request with the key: a 1-word prompt, a few tokens back.
 * On a free tier it costs nothing. On a paid one it costs a tiny fraction of
 * a cent. Retries are off, so a bad key fails at once.
 */
export async function testProviderKey(id: ProviderId, key: string, options: KeyTestOptions): Promise<KeyTestResult> {
  const info = PROVIDERS[id];
  if (info.status !== 'ready') return { ok: false, problem: 'missing-capability' };
  const signals = [AbortSignal.timeout(options.timeoutMs ?? 10_000), options.signal].filter(
    (signal): signal is AbortSignal => signal !== undefined,
  );
  try {
    // In this order: the provider packages build Zod schemas as they load, after loadSdk sets Zod up.
    const { generateText } = await loadSdk();
    const model = await loadModel(id, key.trim(), options.fetch);
    await generateText({
      model,
      prompt: 'Reply with the single word: ok',
      maxOutputTokens: 16,
      maxRetries: 0,
      abortSignal: AbortSignal.any(signals),
    });
    return { ok: true };
  } catch (error) {
    const problem = classifyProviderError(error);
    // The provider knew the key and only asked us to wait, so the key works.
    return problem === 'rate-limited' ? { ok: true } : { ok: false, problem };
  }
}

/**
 * Loads the AI SDK. It first turns off Zod's compiled schemas, which the SDK
 * uses: they are built with `new Function`, which the app's Content Security
 * Policy refuses (no 'unsafe-eval'), so the browser would log a policy error.
 */
export async function loadSdk(): Promise<typeof import('ai')> {
  // Zod checks this setting when a schema is built, and the SDK builds schemas as it loads.
  const { config } = await import('zod');
  config({ jitless: true });
  return import('ai');
}

async function loadModel(id: ProviderId, apiKey: string, fetch: typeof globalThis.fetch) {
  const model = PROVIDERS[id].model;
  switch (id) {
    case 'gemini': {
      const { createGoogle } = await import('@ai-sdk/google');
      return createGoogle({ apiKey, fetch })(model);
    }
    case 'openrouter': {
      const { createOpenRouter } = await import('@openrouter/ai-sdk-provider');
      return createOpenRouter({ apiKey, fetch })(model);
    }
    default:
      throw new Error(`${PROVIDERS[id].name} is not offered yet`);
  }
}
