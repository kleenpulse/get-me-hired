// A very small router. The app has a handful of screens and is served as
// static files with one redirect rule, so a routing library would add nothing.

import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

export type Route = 'today' | 'board' | 'data';

export const PATHS: Record<Route, string> = {
  today: '/',
  board: '/board',
  data: '/data',
};

function routeOf(pathname: string): Route {
  const path = pathname.replace(/\/+$/, '') || '/';
  const match = (Object.keys(PATHS) as Route[]).find((route) => PATHS[route] === path);
  return match ?? 'today';
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
}

export function navigate(route: Route): void {
  if (routeOf(window.location.pathname) === route) return;
  window.history.pushState(null, '', PATHS[route]);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0 });
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () => routeOf(window.location.pathname));
}

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: Route;
}

/** A real link, so it can be opened in a new tab, that moves inside the app on a plain click. */
export function Link({ to, onClick, ...props }: LinkProps) {
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    navigate(to);
  };
  return <a href={PATHS[to]} onClick={handle} {...props} />;
}
