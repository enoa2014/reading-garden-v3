const DEFAULT_DB_NAME = "rg-editor-recovery";
const DEFAULT_STORE_NAME = "snapshots";
const LATEST_KEY = "latest";

function projectKey(projectName = "") {
  const safe = String(projectName || "").trim();
  if (!safe) return "";
  return `project:${safe}`;
}

function openDatabase(dbName, storeName) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("RECOVERY_DB_OPEN_FAILED"));
  });
}

function readValue(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error("RECOVERY_DB_READ_FAILED"));
  });
}

function writeValue(db, storeName, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.put(value, key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error || new Error("RECOVERY_DB_WRITE_FAILED"));
  });
}

function deleteValue(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error || new Error("RECOVERY_DB_DELETE_FAILED"));
  });
}

export function createRecoveryStore({
  dbName = DEFAULT_DB_NAME,
  storeName = DEFAULT_STORE_NAME,
} = {}) {
  let dbPromise = null;

  const getDb = async () => {
    if (typeof indexedDB === "undefined") {
      throw new Error("RECOVERY_DB_UNSUPPORTED");
    }
    if (!dbPromise) {
      dbPromise = openDatabase(dbName, storeName);
    }
    return dbPromise;
  };

  return {
    async loadLatest() {
      const db = await getDb();
      return readValue(db, storeName, LATEST_KEY);
    },
    async loadByProject(projectName) {
      const key = projectKey(projectName);
      if (!key) return null;
      const db = await getDb();
      return readValue(db, storeName, key);
    },
    async saveLatest(snapshot) {
      const db = await getDb();
      const payload = {
        ...snapshot,
        savedAt: new Date().toISOString(),
      };
      await writeValue(db, storeName, LATEST_KEY, payload);
      const key = projectKey(payload.projectName);
      if (key) {
        await writeValue(db, storeName, key, payload);
      }
      return payload;
    },
    async clearLatest() {
      const db = await getDb();
      await deleteValue(db, storeName, LATEST_KEY);
      return true;
    },
    async clearByProject(projectName) {
      const key = projectKey(projectName);
      if (!key) return false;
      const db = await getDb();
      await deleteValue(db, storeName, key);
      return true;
    },
  };
}
