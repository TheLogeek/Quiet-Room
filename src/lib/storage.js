// All data lives in IndexedDB, scoped to this browser/device only.
// There is no fetch(), no server, nothing that leaves the device — that's
// the entire premise of the product, so keep this file dependency-free
// and easy to audit at a glance during judging.

const DB_NAME = 'mindmirror';
const DB_VERSION = 1;
const STORE = 'entries';

// ---------------------------------------------------------------------------
// SCHEMA
// ---------------------------------------------------------------------------
// entries: {
//   id: string          (uuid, primary key)
//   date: string         ('YYYY-MM-DD', indexed — one entry per day is the
//                          product model, but the schema doesn't enforce
//                          that in case you want multiple check-ins/day)
//   text: string         (the raw journal entry, verbatim)
//   mood: number|null    (1-5, from Gemma extraction; null if extraction failed)
//   topics: string[]     (subset of the fixed taxonomy in gemma.js)
//   reflection: string   (short neutral one-liner from Gemma)
//   createdAt: number    (epoch ms)
// }

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function uuid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function saveEntry({ text, mood, topics, reflection }) {
  const db = await openDb();
  const entry = {
    id: uuid(),
    date: new Date().toISOString().slice(0, 10),
    text,
    mood,
    topics,
    reflection,
    createdAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add(entry);
    tx.oncomplete = () => resolve(entry);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllEntries() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      // newest first
      resolve(req.result.sort((a, b) => b.createdAt - a.createdAt));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getRecentEntries(days = 7) {
  const all = await getAllEntries();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return all.filter((e) => e.createdAt >= cutoff);
}

export async function deleteAllEntries() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
