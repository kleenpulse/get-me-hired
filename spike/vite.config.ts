// Dev server for the provider spike (FRD §17). Local use only: there is no
// build script for this page, and it must never be deployed.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  // Keys come from `.env.local` at the repo root, which git ignores.
  envDir: fileURLToPath(new URL('..', import.meta.url)),
  // Only this page can read the provider variables. The real app uses Vite's
  // default prefix (VITE_), so it can never bundle them by accident.
  envPrefix: ['ANTHROPIC_', 'OPENAI_', 'GEMINI_', 'OPENROUTER_', 'NVIDIA_', 'FIRECRAWL_'],
  server: { port: 5183, strictPort: true },
});
