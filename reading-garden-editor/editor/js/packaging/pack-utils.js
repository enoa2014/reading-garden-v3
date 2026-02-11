const TEXT_ENCODER = new TextEncoder();

export function getZipCtor() {
  if (typeof window !== "undefined" && window.JSZip) return window.JSZip;
  if (typeof globalThis !== "undefined" && globalThis.JSZip) return globalThis.JSZip;
  throw new Error("JSZIP_NOT_AVAILABLE");
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function toUint8Array(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  throw new Error("UNSUPPORTED_BINARY_DATA");
}

export async function sha256Bytes(data) {
  const subtle = globalThis?.crypto?.subtle;
  if (!subtle) return null;

  const bytes = toUint8Array(data);
  const digest = await subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256:${hash}`;
}

export async function sha256Text(text) {
  return sha256Bytes(TEXT_ENCODER.encode(String(text ?? "")));
}

export function isSafeRelativePath(path) {
  const raw = String(path || "").trim();
  if (!raw) return false;
  if (raw.startsWith("/") || raw.startsWith("\\") || raw.includes("\0")) return false;
  if (raw.includes("\\")) return false;

  const parts = raw.split("/");
  if (!parts.length) return false;

  return parts.every((part) => part && part !== "." && part !== "..");
}

export function isSafeZipEntryPath(path) {
  const raw = String(path || "").trim();
  if (!raw) return false;
  if (raw.startsWith("/") || raw.startsWith("\\") || raw.includes("\0")) return false;
  if (raw.includes("\\")) return false;

  const parts = raw.split("/");
  if (!parts.length) return false;

  return parts.every((part, idx) => {
    if (!part) {
      return idx === parts.length - 1;
    }
    return part !== "." && part !== "..";
  });
}

export function hasAllowedPrefix(path, prefixes = []) {
  const raw = String(path || "");
  return prefixes.some((prefix) => raw === prefix || raw.startsWith(`${prefix}/`));
}

export function isLikelyTextFile(path) {
  const normalized = String(path || "").toLowerCase();
  return (
    normalized.endsWith(".html")
    || normalized.endsWith(".css")
    || normalized.endsWith(".js")
    || normalized.endsWith(".json")
    || normalized.endsWith(".svg")
    || normalized.endsWith(".txt")
    || normalized.endsWith(".md")
    || normalized.endsWith(".xml")
    || normalized.endsWith(".csv")
  );
}

export function inferZipEntrySize(entry) {
  if (!entry || entry.dir) return 0;
  const size = entry?._data?.uncompressedSize;
  return typeof size === "number" && Number.isFinite(size) ? size : null;
}
