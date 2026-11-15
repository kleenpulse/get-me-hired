// A very small router. The app has a handful of screens and is served as
// static files with one redirect rule, so a routing library would add nothing.

import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

export type Route = 'today' | 'board' | 'drafts' | 'history' | 'profile' | 'data' | 'settings';

export const PATHS: Record<Route, string> = {
  today: '/',
  board: '/board',
  drafts: '/drafts',
  history: '/history',
  profile: '/profile',
  settings: '/settings',
  data: '/data',
};

function routeOf(pathname: string): Route {
  const path = pathname.replace(/\/+$/, '') || '/';
  const match = (Object.keys(PATHS) as Route[]).find((route) => PATHS[route] === path);
  return match ?? 'today';
}

/**
 * A screen with unsaved changes sets a guard. It returns true when it is fine
 * to leave, for example after asking the user. One guard at a time.
 */
type LeaveGuard = () => boolean;
let leaveGuard: LeaveGuard | null = null;
let guardedBy: Route | null = null;

/** The screen that has unsaved changes right now (it set a leave guard), or `null`. */
export function unsavedScreen(): Route | null {
  return leaveGuard ? guardedBy : null;
}

export function setLeaveGuard(guard: LeaveGuard, screen: Route): () => void {
  leaveGuard = guard;
  guardedBy = screen;
  return () => {
    if (leaveGuard !== guard) return;
    leaveGuard = null;
    guardedBy = null;
  };
}

// The browser's Back and Forward buttons can't be stopped, only undone. This
// listener is added before any screen subscribes, so it runs first: if the
// guard says stay, it puts the old address back and hides the change.
let shownPath = window.location.pathname;
let moving = false;
window.addEventListener('popstate', (event) => {
  if (moving) return;
  if (leaveGuard && routeOf(window.location.pathname) !== routeOf(shownPath) && !leaveGuard()) {
    window.history.pushState(null, '', shownPath);
    event.stopImmediatePropagation();
    return;
  }
  shownPath = window.location.pathname;
});

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
}

export function navigate(route: Route): void {
  if (routeOf(window.location.pathname) === route) return;
  if (leaveGuard && !leaveGuard()) return;
  window.history.pushState(null, '', PATHS[route]);
  shownPath = PATHS[route];
  moving = true;
  window.dispatchEvent(new PopStateEvent('popstate'));
  moving = false;
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
