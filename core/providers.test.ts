// The key test runs through the real AI SDK, with a stand-in `fetch` that
// answers the way each provider does. No request leaves the machine.

import { describe, expect, it } from 'vitest';
import { classifyProviderError, PROVIDERS, testProviderKey, type KeyProblem } from './providers';

const KEY = 'test-key-not-real-0000';

interface Seen {
  url: string;
  headers: Headers;
  body: string;
}

/** A `fetch` that answers every call with one status and body, and records what it was sent. */
function answering(status: number, body: unknown, seen: Seen[] = []): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push({ url: String(input), headers: new Headers(init?.headers), body: String(init?.body ?? '') });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}

const GEMINI_OK = {
  candidates: [{ content: { parts: [{ text: 'ok' }], role: 'model' }, finishReason: 'STOP', index: 0 }],
  usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 1, totalTokenCount: 8 },
};
const GEMINI_BAD_KEY = {
  error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' },
};
// Gemini's free tier words its per-minute limit like this. "billing" in it must not read as "no credit".
const GEMINI_QUOTA = {
  error: {
    code: 429,
    message: 'You exceeded your current quota, please check your plan and billing details.',
    status: 'RESOURCE_EXHAUSTED',
  },
};
const OPENROUTER_OK = {
  id: 'gen-1',
  object: 'chat.completion',
  created: 1,
  model: PROVIDERS.openrouter.model,
  choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 7, completion_tokens: 1, total_tokens: 8 },
};

describe('testing a key (FR-2.4, AC-2.4)', () => {
  it('says a working Gemini key is connected, and sends the key in a header, never in the address', async () => {
    const seen: Seen[] = [];
    const result = await testProviderKey('gemini', `  ${KEY} `, { fetch: answering(200, GEMINI_OK, seen) });
    expect(result).toEqual({ ok: true });
    expect(seen).toHaveLength(1);
    const call = seen[0];
    expect(call?.url.startsWith('https://generativelanguage.googleapis.com/')).toBe(true);
    expect(call?.url).not.toContain(KEY);
    expect(call?.body).not.toContain(KEY);
    expect(call?.headers.get('x-goog-api-key')).toBe(KEY);
  });

  it('names a wrong Gemini key', async () => {
    expect(await testProviderKey('gemini', KEY, { fetch: answering(400, GEMINI_BAD_KEY) })).toEqual({
      ok: false,
      problem: 'wrong-key',
    });
  });

  it('treats a Gemini rate limit as a working key', async () => {
    expect(await testProviderKey('gemini', KEY, { fetch: answering(429, GEMINI_QUOTA) })).toEqual({ ok: true });
  });

  it('says a working OpenRouter key is connected, with the key only in the Authorization header', async () => {
    const seen: Seen[] = [];
    expect(await testProviderKey('openrouter', KEY, { fetch: answering(200, OPENROUTER_OK, seen) })).toEqual({ ok: true });
    expect(seen[0]?.url.startsWith('https://openrouter.ai/')).toBe(true);
    expect(seen[0]?.url).not.toContain(KEY);
    expect(seen[0]?.body).not.toContain(KEY);
    expect(seen[0]?.headers.get('authorization')).toBe(`Bearer ${KEY}`);
  });

  it('names an OpenRouter account with no credit', async () => {
    const body = { error: { code: 402, message: 'Insufficient credits. Add more using https://openrouter.ai/settings/credits' } };
    expect(await testProviderKey('openrouter', KEY, { fetch: answering(402, body) })).toEqual({
      ok: false,
      problem: 'no-credit',
    });
  });

  it('names a provider that is down', async () => {
    const body = { error: { code: 503, message: 'The service is currently unavailable.', status: 'UNAVAILABLE' } };
    expect(await testProviderKey('gemini', KEY, { fetch: answering(503, body) })).toEqual({
      ok: false,
      problem: 'provider-down',
    });
  });

  it('names a failed connection', async () => {
    const offline = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    expect(await testProviderKey('openrouter', KEY, { fetch: offline })).toEqual({ ok: false, problem: 'no-connection' });
  });

  it('gives up after the time limit', async () => {
    const never = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      })) as typeof fetch;
    expect(await testProviderKey('gemini', KEY, { fetch: never, timeoutMs: 50 })).toEqual({ ok: false, problem: 'timeout' });
  });

  it('does not call a provider that is not offered yet', async () => {
    const seen: Seen[] = [];
    expect(await testProviderKey('openai', KEY, { fetch: answering(200, {}, seen) })).toEqual({
      ok: false,
      problem: 'missing-capability',
    });
    expect(seen).toHaveLength(0);
  });
});

describe('what each provider can do (AC-2.2)', () => {
  // Every check FRD §19 records as confirmed with a real key. Anything else must not
  // be shown as working (principle 2). Add to this list only with a §19 entry.
  const CONFIRMED: string[] = [
    'gemini.browser',
    'gemini.structured',
    'openrouter.browser',
    'openrouter.structured',
    'openrouter.search', // openai/gpt-6-luna found the HN thread, $0.011
  ];

  it('shows a check as working only when FRD §19 confirms it', () => {
    for (const info of Object.values(PROVIDERS)) {
      for (const [check, result] of Object.entries(info.checks)) {
        if (result === 'yes' || result === 'paid') expect(CONFIRMED).toContain(`${info.id}.${check}`);
      }
    }
  });

  it('does not claim Gemini search works with billing on, which is untested', () => {
    expect(PROVIDERS.gemini.checks.search).toBe('paid-untested');
    expect(PROVIDERS.openrouter.checks.search).toBe('paid');
  });
});

describe('reading provider errors', () => {
  const cases: [string, unknown, KeyProblem][] = [
    ['401', { name: 'AI_APICallError', statusCode: 401, responseBody: 'No auth credentials found' }, 'wrong-key'],
    ['403', { name: 'AI_APICallError', statusCode: 403, responseBody: 'PERMISSION_DENIED' }, 'wrong-key'],
    ['429 that mentions billing', { statusCode: 429, responseBody: 'check your plan and billing details' }, 'rate-limited'],
    ['404 model', { statusCode: 404, responseBody: 'No endpoints found for this model' }, 'missing-capability'],
    ['500', { statusCode: 500, responseBody: 'internal' }, 'provider-down'],
    ['a timeout', { name: 'TimeoutError', message: 'signal timed out' }, 'timeout'],
    ['something else', new Error('odd'), 'unknown'],
    ['not an error at all', 'just a string', 'unknown'],
  ];
  it.each(cases)('reads %s', (_name, error, problem) => {
    expect(classifyProviderError(error)).toBe(problem);
  });
});
