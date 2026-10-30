export type WebTables = Record<string, Record<string, unknown>[]>;
interface BrowserRequest<T> {
  result: T;
  error: Error | null;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
}
interface BrowserTransaction {
  error: Error | null;
  oncomplete: (() => void) | null;
  onabort: (() => void) | null;
  onerror: (() => void) | null;
  objectStore(name: string): {
    get(key: string): BrowserRequest<WebTables | undefined>;
    put(value: WebTables, key: string): unknown;
  };
}
interface BrowserDatabase {
  createObjectStore(name: string): unknown;
  transaction(name: string, mode: 'readonly' | 'readwrite'): BrowserTransaction;
  close(): void;
  onversionchange: (() => void) | null;
}
interface BrowserFactory {
  open(
    name: string,
    version: number,
  ): BrowserRequest<BrowserDatabase> & {
    onupgradeneeded: (() => void) | null;
    onblocked: (() => void) | null;
  };
}
const DATABASE = 'calipartner-offline';
const STORE = 'database';
export const LEGACY_WEB_KEY = 'calipartner_web_db';

/** Durable browser storage. Keep the legacy diary until the IndexedDB transaction commits. */
export async function openWebStorage() {
  const { indexedDB } = globalThis as unknown as { indexedDB: BrowserFactory };
  const db = await new Promise<BrowserDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other CaliPartner tabs and retry.'));
  });
  db.onversionchange = () => db.close();
  const read = () =>
    new Promise<WebTables | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get('tables');
      tx.oncomplete = () => resolve(request.result as WebTables | undefined);
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
  const save = (tables: WebTables) =>
    new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(tables, 'tables');
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error('Browser storage could not save your data.'));
      tx.onerror = () => reject(tx.error);
    });
  let initial = await read();
  if (!initial) {
    const legacy = localStorage.getItem(LEGACY_WEB_KEY);
    initial = legacy ? (JSON.parse(legacy) as WebTables) : {};
    await save(initial);
  }
  // Removal only after successful migration. A failed removal is harmless.
  try {
    localStorage.removeItem(LEGACY_WEB_KEY);
  } catch {
    /* private browser policy */
  }
  return { initial, save, close: () => db.close() };
}
