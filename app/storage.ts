// Browser storage (FR-9.1). Everything is one record in IndexedDB, written in
// one transaction, so a closed tab can never leave half a save behind (NFR-7).

import { FORMAT_VERSION, type AppData } from './data';

const DATABASE = 'get-me-hired';
const STORE = 'app';
const RECORD = 'data';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open the database'));
  });
}

async function transact<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE, mode);
      const request = work(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error ?? new Error('The save failed'));
      transaction.onabort = () => reject(transaction.error ?? new Error('The save was stopped'));
    });
  } finally {
    database.close();
  }
}

/** The saved data, or `null` on a first visit. Data from a newer version of the app is refused (FRD §11.4). */
export async function loadData(): Promise<AppData | null> {
  const saved = await transact<AppData | undefined>('readonly', (store) => store.get(RECORD));
  if (!saved) return null;
  if (saved.formatVersion > FORMAT_VERSION) throw new Error('This data is from a newer version of the app');
  return saved;
}

export async function saveData(data: AppData): Promise<void> {
  await transact('readwrite', (store) => store.put(data, RECORD));
}

export async function clearData(): Promise<void> {
  await transact('readwrite', (store) => store.clear());
}

/** Whether the browser promised to keep this site's data when space runs low. */
export type Persistence = 'granted' | 'denied' | 'unsupported';

export async function readPersistence(): Promise<Persistence> {
  if (!navigator.storage?.persisted) return 'unsupported';
  return (await navigator.storage.persisted()) ? 'granted' : 'denied';
}

/** Asks the browser to keep the data. Called on the first save (AC-9.1). */
export async function requestPersistence(): Promise<Persistence> {
  if (!navigator.storage?.persist) return 'unsupported';
  return (await navigator.storage.persist()) ? 'granted' : 'denied';
}
