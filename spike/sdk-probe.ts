// The same browser-access check as probe.ts, sent through the Vercel AI SDK
// (FRD decision D12). The SDK adds its own request headers, and the browser
// must be allowed to send those too, so a raw `fetch` passing is not enough.
//
// With a made-up key the provider refuses the call before doing any work. With
// a real key this is one tiny real request per provider.

import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogle } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { APICallError, generateText, type LanguageModel } from 'ai';
import { providerKey, snippet, type ProviderId } from './keys';

type AiProviderId = Exclude<ProviderId, 'firecrawl' | 'nvidia'>;

export interface SdkResult {
  provider: AiProviderId;
  model: string;
  key: 'real' | 'dummy';
  /**
   * `answered`: the model replied. `api-error`: the provider refused and the
   * page could read why. `no-response`: the request failed with nothing
   * readable, which is what a CORS block looks like from inside the SDK.
   */
  outcome: 'answered' | 'api-error' | 'no-response' | 'other-error';
  status: number | null;
  ms: number;
  detail: string;
}

// Example model ids taken from the SDK's own docs. They only matter with a real
// key. Set <PROVIDER>_MODEL in `.env.local` to try another one.
const env = import.meta.env;
const MODELS: Record<AiProviderId, string> = {
  anthropic: env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
  openai: env.OPENAI_MODEL || 'gpt-6-luna',
  gemini: env.GEMINI_MODEL || 'gemini-4-argon',
  openrouter: env.OPENROUTER_MODEL || 'anthropic/claude-haiku-5.5',
};

function buildModel(id: AiProviderId, apiKey: string): LanguageModel {
  const modelId = MODELS[id];
  switch (id) {
    case 'anthropic':
      return createAnthropic({
        apiKey,
        // Anthropic refuses browser calls unless the caller opts in with this header.
        headers: { 'anthropic-dangerous-direct-browser-access': 'true' },
      })(modelId);
    case 'openai':
      return createOpenAI({ apiKey })(modelId);
    case 'gemini':
      return createGoogle({ apiKey })(modelId);
    case 'openrouter':
      return createOpenRouter({ apiKey })(modelId);
  }
}

function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause instanceof Error ? ` (cause: ${error.cause.name}: ${error.cause.message})` : '';
  return `${error.name}: ${error.message}${cause}`;
}

async function check(id: AiProviderId): Promise<SdkResult> {
  const key = providerKey(id);
  const base = { provider: id, model: MODELS[id], key: key.kind } as const;
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);

  try {
    const result = await generateText({
      model: buildModel(id, key.value),
      prompt: 'Reply with the single word: ok',
      maxOutputTokens: 64,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(30_000),
    });
    const { inputTokens, outputTokens } = result.usage;
    const detail = `"${snippet(result.text, key.value)}" (${inputTokens ?? '?'} tokens in, ${outputTokens ?? '?'} out)`;
    return { ...base, outcome: 'answered', status: 200, ms: elapsed(), detail };
  } catch (error) {
    const ms = elapsed();
    if (APICallError.isInstance(error) && error.statusCode !== undefined) {
      const detail = snippet(error.responseBody ?? error.message, key.value);
      return { ...base, outcome: 'api-error', status: error.statusCode, ms, detail };
    }
    // The SDK passes a failed `fetch` through as a plain TypeError, with no status to read.
    const hidden = error instanceof TypeError || APICallError.isInstance(error);
    const outcome = hidden ? 'no-response' : 'other-error';
    return { ...base, outcome, status: null, ms, detail: snippet(describe(error), key.value) };
  }
}

const AI_PROVIDERS: AiProviderId[] = ['anthropic', 'openai', 'gemini', 'openrouter'];

/** Runs the checks one provider at a time, reporting each result as it arrives. */
export async function runSdkChecks(onResult: (results: SdkResult[]) => void): Promise<SdkResult[]> {
  const results: SdkResult[] = [];
  for (const id of AI_PROVIDERS) {
    results.push(await check(id));
    onResult(results);
  }
  return results;
}
