const DEFAULT_DB_NAME = "rg-editor-recovery";
const DEFAULT_STORE_NAME = "snapshots";
const LATEST_KEY = "latest";
const HISTORY_LIMIT = 5;
const HISTORY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

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

function resolveSavedAtMs(item) {
  const stamp = Date.parse(String(item?.savedAt || ""));
  if (!Number.isFinite(stamp)) return null;
  return stamp;
}

function pruneRecoveryHistory(history, { limit = HISTORY_LIMIT, maxAgeMs = HISTORY_MAX_AGE_MS } = {}) {
  const now = Date.now();
  const seen = new Set();
  const valid = (Array.isArray(history) ? history : [])
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const savedAtMs = resolveSavedAtMs(item);
      return {
        item,
        savedAtMs,
      };
    })
    .filter(({ item, savedAtMs }) => {
      const stamp = String(item?.savedAt || "").trim();
      if (!stamp || savedAtMs == null) return false;
      if (maxAgeMs != null && maxAgeMs >= 0 && now - savedAtMs > maxAgeMs) return false;
      if (seen.has(stamp)) return false;
      seen.add(stamp);
      return true;
    })
    .sort((a, b) => b.savedAtMs - a.savedAtMs)
    .map(({ item }) => item);
  const maxItems = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : HISTORY_LIMIT;
  return valid.slice(0, maxItems);
}

function sameHistoryOrder(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (String(left[i]?.savedAt || "") !== String(right[i]?.savedAt || "")) {
      return false;
    }
  }
  return true;
}

export function createRecoveryStore({
  dbName = DEFAULT_DB_NAME,
  storeName = DEFAULT_STORE_NAME,
  historyLimit = HISTORY_LIMIT,
  historyMaxAgeMs = HISTORY_MAX_AGE_MS,
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

  const loadAndPruneProjectHistory = async (db, safeProject) => {
    const historyKey = projectHistoryKey(safeProject);
    if (!historyKey) return [];
    const history = await readValue(db, storeName, historyKey);
    const safeHistory = Array.isArray(history) ? history : [];
    const pruned = pruneRecoveryHistory(safeHistory, {
      limit: historyLimit,
      maxAgeMs: historyMaxAgeMs,
    });
    if (!sameHistoryOrder(safeHistory, pruned)) {
      if (pruned.length) {
        await writeValue(db, storeName, historyKey, pruned);
      } else {
        await deleteValue(db, storeName, historyKey);
      }
    }
    return pruned;
  };

  const syncProjectPointer = async (db, safeProject, history = []) => {
    const key = projectKey(safeProject);
    if (!key) return null;
    if (Array.isArray(history) && history.length) {
      await writeValue(db, storeName, key, history[0]);
      return history[0];
    }
    await deleteValue(db, storeName, key);
    return null;
  };

  return {
    async loadLatest() {
      const db = await getDb();
      const snapshot = await readValue(db, storeName, LATEST_KEY);
      if (!snapshot || typeof snapshot !== "object") return null;
      const stamp = resolveSavedAtMs(snapshot);
      const stale = stamp == null
        || (historyMaxAgeMs != null && historyMaxAgeMs >= 0 && Date.now() - stamp > historyMaxAgeMs);
      if (!stale) return snapshot;

      const safeProject = String(snapshot?.projectName || "").trim();
      if (!safeProject) {
        await deleteValue(db, storeName, LATEST_KEY);
        return null;
      }
      const history = await loadAndPruneProjectHistory(db, safeProject);
      const fallback = await syncProjectPointer(db, safeProject, history);
      if (fallback) {
        await writeValue(db, storeName, LATEST_KEY, fallback);
        return fallback;
      }
      await deleteValue(db, storeName, LATEST_KEY);
      return null;
    },
    async loadByProject(projectName) {
      const safeProject = String(projectName || "").trim();
      const key = projectKey(safeProject);
      if (!key) return null;
      const db = await getDb();
      const snapshot = await readValue(db, storeName, key);
      if (!snapshot || typeof snapshot !== "object") return null;
      const stamp = resolveSavedAtMs(snapshot);
      const stale = stamp == null
        || (historyMaxAgeMs != null && historyMaxAgeMs >= 0 && Date.now() - stamp > historyMaxAgeMs);
      if (!stale) return snapshot;
      const history = await loadAndPruneProjectHistory(db, safeProject);
      return syncProjectPointer(db, safeProject, history);
    },
    async loadProjectHistory(projectName) {
      const safeProject = String(projectName || "").trim();
      if (!safeProject) return [];
      const db = await getDb();
      return loadAndPruneProjectHistory(db, safeProject);
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
      const safeHistory = pruneRecoveryHistory(Array.isArray(history) ? history : [], {
        limit: historyLimit,
        maxAgeMs: historyMaxAgeMs,
      });
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
          const nextHistory = pruneRecoveryHistory([payload, ...safeHistory], {
            limit: historyLimit,
            maxAgeMs: historyMaxAgeMs,
          });
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
