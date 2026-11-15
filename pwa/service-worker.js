// The service worker (FR-1.3): offline use of the app, for our own files only.
// pwa/vite-plugin.ts fills in the three placeholders at build time and writes
// it to /sw.js. Nothing in here talks to any other site.
//
// - The built files are stored when the worker installs, so every screen opens
//   offline, not only the ones visited.
// - Requests are routed by swRoute (app/sw-route.ts): page loads network-first
//   with the stored page as the fallback, hashed files cache-first, and every
//   other request, above all to providers and Hacker News, untouched.
// - A new version waits until the app says to switch, so a tab running old code
//   is never swapped underneath. The app shows "A new version is ready".

const VERSION = __VERSION__;
const PRECACHE = __PRECACHE__;
const route = __ROUTE__;
const CACHE = `get-me-hired-${VERSION}`;
const PAGE = '/index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('get-me-hired-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// The app sends this when the user chooses to reload into the new version.
self.addEventListener('message', (event) => {
  if (event.data === 'get-me-hired:update') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const kind = route(request.url, request.method, self.location.origin, request.mode === 'navigate');
  if (kind === 'pass') return;

  if (kind === 'cache-first') {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // A page load: the network first, and the stored page when offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(PAGE, copy));
        }
        return response;
      })
      .catch(() => caches.match(PAGE).then((hit) => hit || Response.error())),
  );
});
