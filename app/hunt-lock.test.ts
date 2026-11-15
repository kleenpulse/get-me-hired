import { describe, expect, it } from 'vitest';
import { HUNT_LOCK, withHuntLock, type Locks } from './hunt-lock';

/** A stand-in for `navigator.locks` with `ifAvailable`: one holder per name, shared like tabs share it. */
function lockManager(): Locks & { held: Set<string> } {
  const held = new Set<string>();
  return {
    held,
    async request(name, _options, callback) {
      if (held.has(name)) return callback(null);
      held.add(name);
      try {
        return await callback({ name });
      } finally {
        held.delete(name);
      }
    },
  };
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('one hunt at a time across tabs', () => {
  it('lets one tab hunt and tells the other another hunt is running', async () => {
    const locks = lockManager();
    const first = deferred();
    let secondRan = false;
    const tabOne = withHuntLock(locks, () => first.promise);
    const tabTwo = withHuntLock(locks, async () => {
      secondRan = true;
    });
    expect(await tabTwo).toBe('busy');
    expect(secondRan).toBe(false);
    first.resolve();
    expect(await tabOne).toBe('ran');
  });

  it('holds the lock for the whole hunt, and lets it go after', async () => {
    const locks = lockManager();
    const hunt = deferred();
    const running = withHuntLock(locks, () => hunt.promise);
    expect(locks.held.has(HUNT_LOCK)).toBe(true);
    hunt.resolve();
    await running;
    expect(locks.held.has(HUNT_LOCK)).toBe(false);
    expect(await withHuntLock(locks, async () => {})).toBe('ran');
  });

  it('lets the lock go when a hunt throws', async () => {
    const locks = lockManager();
    await expect(withHuntLock(locks, async () => Promise.reject(new Error('broken')))).rejects.toThrow('broken');
    expect(locks.held.has(HUNT_LOCK)).toBe(false);
  });
});
