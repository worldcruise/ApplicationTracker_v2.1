// Resume Studio's private records use the extension origin's IndexedDB. Its
// TRUSTED_CONTEXTS requests must not disable Autofill's content-script storage.
export function createStudioStorage({
  indexedDB = globalThis.indexedDB,
  BroadcastChannel = globalThis.BroadcastChannel,
  databaseName = 'autofill-resume-studio-v1',
} = {}) {
  const listeners = new Set();
  let database;
  let channel;

  function emit(changes) {
    for (const listener of listeners) {
      try { listener(structuredClone(changes), 'local'); }
      catch (error) { console.error('Resume Studio storage listener failed.', error); }
    }
  }

  function connect() {
    if (!channel && BroadcastChannel) {
      channel = new BroadcastChannel(`${databaseName}:changes`);
      channel.unref?.();
      channel.onmessage = event => {
        if (event.data?.version === 1 && event.data.changes) emit(event.data.changes);
      };
    }
    return channel;
  }

  function publish(changes) {
    if (!Object.keys(changes).length) return;
    emit(changes);
    connect()?.postMessage({ version: 1, changes });
  }

  function open() {
    if (!indexedDB) return Promise.reject(new Error('Resume Studio storage is unavailable.'));
    return database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('records');
      request.onerror = () => { database = undefined; reject(request.error); };
      request.onblocked = () => {
        database = undefined;
        reject(new Error('Close other Resume Studio pages and retry the storage operation.'));
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); database = undefined; };
        resolve(db);
      };
    });
  }

  function putProperty(object, key, value) {
    Object.defineProperty(object, key, {
      value, enumerable: true, configurable: true, writable: true,
    });
  }

  async function get(keys = null) {
    const all = keys === null || keys === undefined;
    const defaults = !all && typeof keys === 'object' && !Array.isArray(keys) ? keys : null;
    const selected = all ? null : typeof keys === 'string' ? [keys] : defaults ? Object.keys(defaults) : keys;
    if (selected !== null && (!Array.isArray(selected) || selected.some(key => typeof key !== 'string'))) {
      throw new TypeError('Storage keys must be strings, an array, defaults, or null.');
    }
    const db = await open();
    return new Promise((resolve, reject) => {
      const result = {};
      const transaction = db.transaction('records', 'readonly');
      const store = transaction.objectStore('records');
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error('Storage read failed.'));
      if (all) {
        const request = store.openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return;
          putProperty(result, cursor.key, cursor.value);
          cursor.continue();
        };
      } else {
        for (const key of selected) {
          const request = store.get(key);
          request.onsuccess = () => {
            if (request.result !== undefined) putProperty(result, key, request.result);
            else if (defaults) putProperty(result, key, structuredClone(defaults[key]));
          };
        }
      }
    });
  }

  async function mutate(items, remove) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const changes = {};
      const transaction = db.transaction('records', 'readwrite');
      const store = transaction.objectStore('records');
      transaction.oncomplete = () => { publish(changes); resolve(); };
      transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error('Storage write failed.'));
      for (const [key, value] of items) {
        const request = store.get(key);
        request.onsuccess = () => {
          const oldValue = request.result;
          if (remove) {
            if (oldValue === undefined) return;
            store.delete(key);
            putProperty(changes, key, { oldValue });
          } else if (JSON.stringify(oldValue) !== JSON.stringify(value)) {
            store.put(value, key);
            putProperty(changes, key, {
              ...(oldValue === undefined ? {} : { oldValue }), newValue: value,
            });
          }
        };
      }
    });
  }

  return {
    get,
    set(values) {
      if (!values || typeof values !== 'object' || Array.isArray(values)) {
        return Promise.reject(new TypeError('Storage values must be an object.'));
      }
      return mutate(Object.entries(structuredClone(values)), false);
    },
    remove(keys) {
      const list = typeof keys === 'string' ? [keys] : keys;
      if (!Array.isArray(list) || list.some(key => typeof key !== 'string')) {
        return Promise.reject(new TypeError('Storage keys must be strings.'));
      }
      return mutate(list.map(key => [key]), true);
    },
    async setAccessLevel({ accessLevel }) {
      if (accessLevel !== 'TRUSTED_CONTEXTS') throw new Error('Studio records are private to extension pages.');
      // IndexedDB already has the required origin boundary. Do not change the
      // access level of the shared chrome.storage.local area.
    },
    onChanged: {
      addListener(listener) { listeners.add(listener); connect(); },
      removeListener(listener) { listeners.delete(listener); },
      hasListener(listener) { return listeners.has(listener); },
    },
    async close() {
      channel?.close();
      channel = undefined;
      listeners.clear();
      const pending = database;
      database = undefined;
      if (pending) (await pending).close();
    },
  };
}

export const studioStorage = createStudioStorage();
