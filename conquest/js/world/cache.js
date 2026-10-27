// IndexedDB cache for the generated world (raster + province graph), keyed by a hash of
// MAP_VERSION and every input that shapes it, so a second page load skips generation.
// Any failure (no IndexedDB, file://, quota, private mode) just falls back to generating.
const DB = 'cc_mapcache', STORE = 'maps';

export function hashStr(s) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 + c, 2246822519) ^ (h2 >>> 13);
  }
  return ((h1 >>> 0).toString(36) + (h2 >>> 0).toString(36));
}

function open() {
  return new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') return rej(new Error('no indexedDB'));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error('blocked'));
  });
}

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

export async function cacheGet(key) {
  try {
    const db = await withTimeout(open(), 3000);
    const v = await withTimeout(new Promise((res, rej) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    }), 8000);
    db.close();
    return v;
  } catch (e) { return null; }
}

// Stores `value` under `key` and drops every other entry (old versions).
export async function cachePut(key, value) {
  try {
    const db = await withTimeout(open(), 3000);
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      const st = tx.objectStore(STORE);
      st.clear();
      st.put(value, key);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
    });
    db.close();
    return true;
  } catch (e) { return false; }
}
