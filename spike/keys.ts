// Keys for the spike page. Real keys come from `.env.local`. A provider with no
// key gets a made-up one that is certain to be refused, which is still enough
// to see whether the browser may read the provider's answer.

export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'openrouter' | 'nvidia' | 'firecrawl';

export interface ProviderKey {
  value: string;
  kind: 'real' | 'dummy';
}

const env = import.meta.env;

const KEYS: Record<ProviderId, { real: string | undefined; dummy: string }> = {
  anthropic: { real: env.ANTHROPIC_API_KEY, dummy: 'sk-ant-spike-not-a-real-key' },
  openai: { real: env.OPENAI_API_KEY, dummy: 'sk-spike-not-a-real-key' },
  gemini: { real: env.GEMINI_API_KEY, dummy: 'spike-not-a-real-key' },
  openrouter: { real: env.OPENROUTER_API_KEY, dummy: 'sk-or-spike-not-a-real-key' },
  nvidia: { real: env.NVIDIA_API_KEY, dummy: 'nvapi-spike-not-a-real-key' },
  firecrawl: { real: env.FIRECRAWL_API_KEY, dummy: 'fc-spike-not-a-real-key' },
};

export const PROVIDER_NAMES: Record<ProviderId, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  openrouter: 'OpenRouter',
  nvidia: 'NVIDIA',
  firecrawl: 'Firecrawl',
};

export function providerKey(id: ProviderId): ProviderKey {
  const real = KEYS[id].real?.trim();
  return real ? { value: real, kind: 'real' } : { value: KEYS[id].dummy, kind: 'dummy' };
}

const SNIPPET_LENGTH = 160;

/** The start of a provider's answer, on one line. Some providers repeat the key in an error, so it is cut out. */
export function snippet(text: string, key: string): string {
  return text.replaceAll(key, '[key]').replace(/\s+/g, ' ').slice(0, SNIPPET_LENGTH);
}
