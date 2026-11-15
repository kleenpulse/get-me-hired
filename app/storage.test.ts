// How loading behaves when the browser won't store data. Tests run in Node,
// which has no IndexedDB, so each test puts in a stand-in.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadData, loadKeys, NewerDataError, StorageBlockedError } from './storage';

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
