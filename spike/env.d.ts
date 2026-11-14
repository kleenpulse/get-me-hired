interface ImportMetaEnv {
  readonly ANTHROPIC_API_KEY?: string;
  readonly OPENAI_API_KEY?: string;
  readonly GEMINI_API_KEY?: string;
  readonly OPENROUTER_API_KEY?: string;
  readonly NVIDIA_API_KEY?: string;
  readonly FIRECRAWL_API_KEY?: string;
  readonly ANTHROPIC_MODEL?: string;
  readonly OPENAI_MODEL?: string;
  readonly GEMINI_MODEL?: string;
  readonly OPENROUTER_MODEL?: string;
  readonly NVIDIA_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
