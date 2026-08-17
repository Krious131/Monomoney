// Local persistence for Monopoly Banker, backed by the browser's IndexedDB.
// Mirrors the small get/set/delete shape the app expects, so game data
// (players, cash, properties, history, saved games) survives closing the
// tab, closing the browser, or restarting the computer — no server, no
// internet connection required.

const DB_NAME = "monopoly-banker";
const STORE_NAME = "kv";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, run) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = run(store);
    tx.oncomplete = () => resolve(request ? request.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const storage = {
  async get(key) {
    const value = await withStore("readonly", (store) => store.get(key));
    if (value === undefined) return null;
    return { key, value };
  },
  async set(key, value) {
    await withStore("readwrite", (store) => store.put(value, key));
    return { key, value };
  },
  async delete(key) {
    await withStore("readwrite", (store) => store.delete(key));
    return { key, deleted: true };
  },
};
