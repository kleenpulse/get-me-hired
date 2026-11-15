// One hunt at a time across every tab of the app. All tabs save one IndexedDB
// record whole, so two hunts at once would overwrite each other's leads, check
// the monthly cap against the same figure (AC-4.13), and double the calls. The
// Web Locks API holds a lock for the whole hunt. A tab that can't get it doesn't start.

export const HUNT_LOCK = 'get-me-hired:hunt';

/** `ran`: the work ran, holding the lock. `busy`: another tab holds it, and nothing ran. */
export type LockOutcome = 'ran' | 'busy';

/** The part of `navigator.locks` this needs, so a test can pass its own. */
export interface Locks {
  request<T>(name: string, options: { ifAvailable: true }, callback: (lock: unknown) => Promise<T> | T): Promise<T>;
}

/** Runs `work` while holding the hunt lock, or doesn't run it when another tab holds it. */
export function withHuntLock(locks: Locks, work: () => Promise<void>): Promise<LockOutcome> {
  return locks.request(HUNT_LOCK, { ifAvailable: true }, async (lock): Promise<LockOutcome> => {
    if (!lock) return 'busy';
    await work();
    return 'ran';
  });
}

/** The browser's lock manager, or `undefined` in a browser without one. */
export function browserLocks(): Locks | undefined {
  return typeof navigator !== 'undefined' && 'locks' in navigator ? (navigator.locks as Locks) : undefined;
}
