const DEFAULT_DB_NAME = "rg-editor-recovery";
const DEFAULT_STORE_NAME = "snapshots";
const LATEST_KEY = "latest";
const HISTORY_LIMIT = 5;

function projectKey(projectName = "") {
  const safe = String(projectName || "").trim();
  if (!safe) return "";
  return `project:${safe}`;
}

function projectHistoryKey(projectName = "") {
  const safe = String(projectName || "").trim();
  if (!safe) return "";
  return `project-history:${safe}`;
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
    async loadProjectHistory(projectName) {
      const key = projectHistoryKey(projectName);
      if (!key) return [];
      const db = await getDb();
      const history = await readValue(db, storeName, key);
      return Array.isArray(history) ? history : [];
    },
    async removeProjectHistorySnapshot(projectName, savedAt) {
      const safeProject = String(projectName || "").trim();
      const stamp = String(savedAt || "").trim();
      const projectScopedKey = projectKey(safeProject);
      const historyKey = projectHistoryKey(safeProject);
      if (!historyKey || !stamp) {
        return {
          removed: false,
          history: [],
        };
      }

      const db = await getDb();
      const history = await readValue(db, storeName, historyKey);
      const safeHistory = Array.isArray(history) ? history : [];
      const nextHistory = safeHistory.filter((item) => String(item?.savedAt || "") !== stamp);
      if (nextHistory.length === safeHistory.length) {
        return {
          removed: false,
          history: safeHistory,
        };
      }

      if (nextHistory.length) {
        await writeValue(db, storeName, historyKey, nextHistory);
      } else {
        await deleteValue(db, storeName, historyKey);
      }

      if (projectScopedKey) {
        const scopedSnapshot = await readValue(db, storeName, projectScopedKey);
        if (String(scopedSnapshot?.savedAt || "") === stamp) {
          if (nextHistory.length) {
            await writeValue(db, storeName, projectScopedKey, nextHistory[0]);
          } else {
            await deleteValue(db, storeName, projectScopedKey);
          }
        }
      }

      const latestSnapshot = await readValue(db, storeName, LATEST_KEY);
      if (
        String(latestSnapshot?.savedAt || "") === stamp
        && String(latestSnapshot?.projectName || "").trim() === safeProject
      ) {
        if (nextHistory.length) {
          await writeValue(db, storeName, LATEST_KEY, nextHistory[0]);
        } else {
          await deleteValue(db, storeName, LATEST_KEY);
        }
      }

      return {
        removed: true,
        history: nextHistory,
      };
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
        const historyKey = projectHistoryKey(payload.projectName);
        if (historyKey) {
          const history = await readValue(db, storeName, historyKey);
          const safeHistory = Array.isArray(history) ? history : [];
          const nextHistory = [payload, ...safeHistory]
            .filter((item, index, list) => {
              const stamp = String(item?.savedAt || "");
              if (!stamp) return false;
              return list.findIndex((cursor) => String(cursor?.savedAt || "") === stamp) === index;
            })
            .slice(0, HISTORY_LIMIT);
          await writeValue(db, storeName, historyKey, nextHistory);
        }
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
      const historyKey = projectHistoryKey(projectName);
      if (historyKey) {
        await deleteValue(db, storeName, historyKey);
      }
      return true;
    },
  };
}
