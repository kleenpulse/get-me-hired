// What the service worker does with one request (FR-1.3). Kept apart, and with
// no imports or outside names, so it can be tested here and copied as source
// into the worker at build time (pwa/vite-plugin.ts).
//
// - Only GET requests to this site. Provider, Hacker News and Firecrawl calls,
//   and anything else on another origin, pass straight through, never cached.
// - Page loads are network-first, with the cached page as the offline fallback,
//   so a cached page never pins anyone to an old build.
// - Built files under /assets/ have their content hash in the name, so they are
//   cache-first.
// - Anything else on this site (the worker itself, the manifest) passes through.

export type SwRoute = 'cache-first' | 'network-first' | 'pass';

export function swRoute(url: string, method: string, origin: string, navigate: boolean): SwRoute {
  if (method !== 'GET') return 'pass';
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'pass';
  }
  if (parsed.origin !== origin) return 'pass';
  if (navigate) return 'network-first';
  if (parsed.pathname.startsWith('/assets/')) return 'cache-first';
  return 'pass';
}
