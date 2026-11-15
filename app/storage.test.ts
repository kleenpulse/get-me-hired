// How loading behaves when the browser won't store data. Tests run in Node,
// which has no IndexedDB, so each test puts in a stand-in.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyData, type AppData } from './data';
import { newPassphrase, sealKeys } from '@/core/key-crypto';
import { loadData, loadKeyRecord, loadKeys, NewerDataError, revisionOf, saveData, StaleDataError, StorageBlockedError } from './storage';

/** A stand-in for `indexedDB.open` that fails the way a blocking browser does. */
function failingOpen(error: DOMException): Pick<IDBFactory, 'open'> {
  return {
    open: () => {
      const request = { error } as unknown as IDBOpenDBRequest;
      queueMicrotask(() => request.onerror?.(new Event('error')));
      return request;
    },
  };
}

/** A stand-in that opens, and holds one saved record. */
function openWith(saved: unknown): Pick<IDBFactory, 'open'> {
  const store = {
    get: () => {
      const request = { result: saved } as IDBRequest;
      return request;
    },
  };
  const database = {
    transaction: () => {
      const transaction = { objectStore: () => store } as unknown as IDBTransaction;
      queueMicrotask(() => transaction.oncomplete?.(new Event('complete')));
      return transaction;
    },
    close: () => {},
  };
  return {
    open: () => {
      const request = { result: database } as unknown as IDBOpenDBRequest;
      queueMicrotask(() => request.onsuccess?.(new Event('success')));
      return request;
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loading saved data', () => {
  it('reports blocked storage when there is no IndexedDB at all', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await expect(loadData()).rejects.toBeInstanceOf(StorageBlockedError);
  });

  it('reports blocked storage when opening throws (site data blocked)', async () => {
    vi.stubGlobal('indexedDB', {
      open: () => {
        throw new DOMException('denied', 'SecurityError');
      },
    });
    await expect(loadData()).rejects.toBeInstanceOf(StorageBlockedError);
  });

  it('reports blocked storage when opening fails (user denied permission)', async () => {
    vi.stubGlobal('indexedDB', failingOpen(new DOMException('The user denied permission', 'UnknownError')));
    await expect(loadData()).rejects.toBeInstanceOf(StorageBlockedError);
  });

  it('refuses data from a newer version of the app', async () => {
    vi.stubGlobal('indexedDB', openWith({ formatVersion: 99, leads: [], settings: {}, runs: [] }));
    await expect(loadData()).rejects.toBeInstanceOf(NewerDataError);
  });

  it('fills in the profile for data saved before it existed', async () => {
    vi.stubGlobal('indexedDB', openWith({ formatVersion: 1, leads: [], settings: { welcomeDone: true }, runs: [] }));
    const data = await loadData();
    expect(data?.profile).toBeNull();
    expect(data?.settings.welcomeDone).toBe(true);
    expect(data?.settings.dailyTarget).toBe(20);
  });

  it('returns null on a first visit', async () => {
    vi.stubGlobal('indexedDB', openWith(undefined));
    expect(await loadData()).toBeNull();
  });
});

describe('loading keys', () => {
  it('keeps only known providers with a key', async () => {
    vi.stubGlobal('indexedDB', openWith({ gemini: 'key-a', openrouter: 5, someone: 'key-b', anthropic: '' }));
    expect(await loadKeys()).toEqual({ gemini: 'key-a' });
  });

  it('has no keys on a first visit', async () => {
    vi.stubGlobal('indexedDB', openWith(undefined));
    expect(await loadKeys()).toEqual({});
  });
});

describe('saved display settings', () => {
  it('falls back to the defaults when the saved theme or text size is unknown', async () => {
    vi.stubGlobal('indexedDB', openWith({ formatVersion: 1, leads: [], settings: { display: { theme: 'neon', textSize: 'huge' } }, runs: [] }));
    expect((await loadData())?.settings.display).toEqual({ theme: 'system', textSize: 'normal' });
  });
});

/**
 * A stand-in that holds one record across transactions, with a readwrite
 * transaction that reads, writes and can be aborted, like IndexedDB's.
 */
function memoryDatabase(initial: unknown): { factory: Pick<IDBFactory, 'open'>; record: () => unknown } {
  let record = initial;
  const database = {
    transaction: () => {
      let aborted = false;
      let pending: { value: unknown } | null = null;
      const transaction = {
        abort: () => {
          aborted = true;
          queueMicrotask(() => transaction.onabort?.(new Event('abort')));
        },
        objectStore: () => ({
          get: () => {
            const request = {} as { result: unknown; onsuccess?: () => void };
            queueMicrotask(() => {
              request.result = record;
              request.onsuccess?.();
              // The transaction ends once its requests are done: it commits unless aborted.
              queueMicrotask(() => {
                if (aborted) return;
                if (pending) record = pending.value;
                transaction.oncomplete?.(new Event('complete'));
              });
            });
            return request;
          },
          put: (value: unknown) => {
            pending = { value };
            return {};
          },
        }),
      } as unknown as IDBTransaction & { onabort: ((event: Event) => void) | null; oncomplete: ((event: Event) => void) | null };
      return transaction;
    },
    close: () => {},
  };
  return {
    factory: {
      open: () => {
        const request = { result: database } as unknown as IDBOpenDBRequest;
        queueMicrotask(() => request.onsuccess?.(new Event('success')));
        return request;
      },
    },
    record: () => record,
  };
}

describe('saving over another tab (NFR-7)', () => {
  const data = (marker: string): AppData => ({ ...emptyData(), notes: marker }) as unknown as AppData;

  it('writes when the stored revision is the one this tab has, and counts it up', async () => {
    const memory = memoryDatabase({ ...emptyData(), revision: 4 });
    vi.stubGlobal('indexedDB', memory.factory);
    expect(await saveData(data('mine'), 4)).toBe(5);
    expect(memory.record()).toMatchObject({ notes: 'mine', revision: 5 });
  });

  it('refuses to write over a newer save from another tab, and leaves it as it is', async () => {
    const theirs = { ...emptyData(), notes: 'theirs', revision: 4 };
    const memory = memoryDatabase(theirs);
    vi.stubGlobal('indexedDB', memory.factory);
    await expect(saveData(data('stale'), 3)).rejects.toBeInstanceOf(StaleDataError);
    expect(memory.record()).toBe(theirs);
  });

  it('refuses to bring data back after another tab deleted everything', async () => {
    const memory = memoryDatabase(undefined);
    vi.stubGlobal('indexedDB', memory.factory);
    await expect(saveData(data('stale'), 7)).rejects.toBeInstanceOf(StaleDataError);
    expect(memory.record()).toBeUndefined();
  });

  it('makes the first save on a first visit', async () => {
    const memory = memoryDatabase(undefined);
    vi.stubGlobal('indexedDB', memory.factory);
    expect(await saveData(data('first'), 0)).toBe(1);
    expect(revisionOf(memory.record())).toBe(1);
  });

  it('reads the revision of data from before revisions as 0', () => {
    expect(revisionOf({ formatVersion: 1 })).toBe(0);
    expect(revisionOf({ revision: -2 })).toBe(0);
    expect(revisionOf({ revision: 'five' })).toBe(0);
    expect(revisionOf(null)).toBe(0);
    expect(revisionOf({ revision: 9 })).toBe(9);
  });
});

describe('the keys record (FR-10.4)', () => {
  it('reads plain keys as plain, and sealed keys as sealed without opening them', async () => {
    vi.stubGlobal('indexedDB', openWith({ gemini: 'test-key-not-real-0000' }));
    expect(await loadKeyRecord()).toEqual({ kind: 'plain', keys: { gemini: 'test-key-not-real-0000' } });

    const sealed = await sealKeys({ gemini: 'test-key-not-real-0000' }, await newPassphrase('correct horse', 1_000));
    vi.stubGlobal('indexedDB', openWith(sealed));
    const record = await loadKeyRecord();
    expect(record.kind).toBe('sealed');
    expect(JSON.stringify(record)).not.toContain('test-key-not-real');
  });

  it('reads a damaged sealed record as damaged, never as plain keys', async () => {
    const sealed = await sealKeys({ gemini: 'test-key-not-real-0000' }, await newPassphrase('correct horse', 1_000));
    vi.stubGlobal('indexedDB', openWith({ ...sealed, salt: '!!not base64!!' }));
    expect(await loadKeyRecord()).toEqual({ kind: 'damaged' });
  });

  it('never reads a sealed record as plain keys', async () => {
    const sealed = await sealKeys({ gemini: 'test-key-not-real-0000' }, await newPassphrase('correct horse', 1_000));
    vi.stubGlobal('indexedDB', openWith(sealed));
    expect(await loadKeys()).toEqual({});
  });
});
