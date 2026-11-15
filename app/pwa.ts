// The service worker in the browser (FR-1.3): registered in production builds
// only, never in dev or the spike page. A new version installs in the
// background and waits. The app says "A new version is ready", and only when
// the user chooses to reload does the new worker take over, so a tab running
// old code is never switched underneath.

import { useSyncExternalStore } from 'react';

let waiting: ServiceWorker | null = null;
let updating = false;
const listeners = new Set<() => void>();

function setWaiting(worker: ServiceWorker): void {
  waiting = worker;
  for (const listener of listeners) listener();
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        // A worker that installed while an older one controls this page is a new version, waiting.
        const watch = (worker: ServiceWorker | null) => {
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) setWaiting(worker);
          });
        };
        if (registration.waiting && navigator.serviceWorker.controller) setWaiting(registration.waiting);
        watch(registration.installing);
        registration.addEventListener('updatefound', () => watch(registration.installing));
      },
      () => {},
    );
    // Reload only when the user asked for the new version, not when the first worker takes charge.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (updating) window.location.reload();
    });
  });
}

/** Switches to the new version: the waiting worker takes over, then the page reloads. */
export function applyUpdate(): void {
  if (!waiting) return;
  updating = true;
  waiting.postMessage('get-me-hired:update');
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** True when a new version of the app is installed and waiting. */
export function useUpdateReady(): boolean {
  return useSyncExternalStore(subscribe, () => waiting !== null);
}
