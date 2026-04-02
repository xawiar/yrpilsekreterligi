const DB_NAME = 'sekreterlik_offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending_results';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'localId', autoIncrement: true });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function queueOfflineResult(data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const entry = {
      ...data,
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };
    const req = store.add(entry);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingResults() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('status');
    const req = index.getAll('pending');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function markResultSynced(localId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(localId);
    getReq.onsuccess = () => {
      const entry = getReq.result;
      if (entry) {
        entry.status = 'synced';
        entry.syncedAt = new Date().toISOString();
        store.put(entry);
      }
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function markResultFailed(localId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(localId);
    getReq.onsuccess = () => {
      const entry = getReq.result;
      if (entry) {
        entry.retryCount = (entry.retryCount || 0) + 1;
        entry.lastError = new Date().toISOString();
        store.put(entry);
      }
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function getQueueCount() {
  const pending = await getPendingResults();
  return pending.length;
}
