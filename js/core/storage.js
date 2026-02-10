const PREFIX = "rg:v3:";

export function key(parts) {
  if (Array.isArray(parts)) return PREFIX + parts.filter(Boolean).join(":");
  return PREFIX + String(parts || "").trim();
}

export function getText(k, fallback = "") {
  try {
    const v = localStorage.getItem(k);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

export function setText(k, v) {
  try {
    localStorage.setItem(k, String(v));
    return true;
  } catch {
    return false;
  }
}

export function getJSON(k, fallback = null) {
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function setJSON(k, value) {
  try {
    localStorage.setItem(k, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(k) {
  try {
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

