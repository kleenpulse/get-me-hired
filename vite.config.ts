import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { pwa } from './pwa/vite-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss(), pwa()],
  resolve: {
    // `@/` points at the repo root. There is no `src/` directory.
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  build: {
    outDir: 'dist',
    // The spike page is a separate, local-only entry and is never built.
    rollupOptions: { input: fileURLToPath(new URL('./index.html', import.meta.url)) },
  },
  server: { port: 5173, strictPort: true },
  test: {
    include: ['core/**/*.test.ts', 'app/**/*.test.ts'],
    environment: 'node',
  },
});
