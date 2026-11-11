// Tiny hand-rolled IndexedDB wrapper for document Blobs (photo, signature, proofs,
// etc. — never Profile text, which lives in chrome.storage.local via storage.ts).
// No "idb"-style dependency per docs/03-architecture.md's storage decision.

const DB_NAME = 'iism-form-filler';
const DB_VERSION = 1;
const STORE_NAME = 'docs';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Opens a fresh connection per call and closes it once the operation settles, trading
// a little overhead for not having to reason about a long-lived shared connection
// across service-worker eviction / content-script reloads.
async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const request = run(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      // The request can succeed while the surrounding transaction still fails to
      // commit (e.g. QuotaExceededError) — without these, that case would hang the
      // promise forever instead of rejecting.
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    });
  } finally {
    db.close();
  }
}

export async function putDoc(key: string, blob: Blob): Promise<void> {
  await withStore('readwrite', (store) => store.put(blob, key));
}

export async function getDoc(key: string): Promise<Blob | null> {
  const result = await withStore<Blob | undefined>('readonly', (store) => store.get(key));
  return result ?? null;
}

export async function deleteDoc(key: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(key));
}

export async function listDocKeys(): Promise<string[]> {
  const keys = await withStore<IDBValidKey[]>('readonly', (store) => store.getAllKeys());
  return keys.map(String);
}

export async function clearDocs(): Promise<void> {
  await withStore('readwrite', (store) => store.clear());
}
