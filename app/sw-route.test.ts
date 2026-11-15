import { describe, expect, it } from 'vitest';
import { swRoute } from './sw-route';

const ORIGIN = 'https://get-me-hired.netlify.app';

describe('what the service worker does with a request (FR-1.3)', () => {
  it('loads pages from the network first, falling back to the cached page offline', () => {
    expect(swRoute(`${ORIGIN}/`, 'GET', ORIGIN, true)).toBe('network-first');
    expect(swRoute(`${ORIGIN}/board`, 'GET', ORIGIN, true)).toBe('network-first');
  });

  it('serves hashed built files from the cache first', () => {
    expect(swRoute(`${ORIGIN}/assets/index-abc123.js`, 'GET', ORIGIN, false)).toBe('cache-first');
    expect(swRoute(`${ORIGIN}/assets/figtree-latin-700.woff2`, 'GET', ORIGIN, false)).toBe('cache-first');
  });

  it('never touches provider, Hacker News, Firecrawl or any other site', () => {
    for (const url of [
      'https://generativelanguage.googleapis.com/v1beta/models/x:generateContent',
      'https://openrouter.ai/api/v1/chat/completions',
      'https://hn.algolia.com/api/v1/items/1',
      'https://api.firecrawl.dev/v1/scrape',
      'https://get-me-hired.netlify.app.evil.example/assets/x.js',
    ]) {
      expect(swRoute(url, 'GET', ORIGIN, false)).toBe('pass');
      expect(swRoute(url, 'GET', ORIGIN, true)).toBe('pass');
    }
  });

  it('passes anything that is not a GET, the worker itself and the manifest', () => {
    expect(swRoute(`${ORIGIN}/assets/index-abc123.js`, 'POST', ORIGIN, false)).toBe('pass');
    expect(swRoute(`${ORIGIN}/sw.js`, 'GET', ORIGIN, false)).toBe('pass');
    expect(swRoute(`${ORIGIN}/manifest.webmanifest`, 'GET', ORIGIN, false)).toBe('pass');
    expect(swRoute('not a url', 'GET', ORIGIN, false)).toBe('pass');
  });

  it('can be copied into the worker as source: it uses no outside names', () => {
    // The build copies the function's text into sw.js, so it must stand alone.
    const copy = new Function(`return (${swRoute.toString()})`)() as typeof swRoute;
    expect(copy(`${ORIGIN}/assets/a.js`, 'GET', ORIGIN, false)).toBe('cache-first');
    expect(copy('https://openrouter.ai/x', 'GET', ORIGIN, false)).toBe('pass');
  });
});
