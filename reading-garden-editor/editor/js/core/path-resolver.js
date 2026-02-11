function splitQuery(path) {
  const normalizedPath = String(path || "").replaceAll("\\", "/");
  const idx = normalizedPath.indexOf("?");
  if (idx < 0) return { path: normalizedPath, query: "" };
  return {
    path: normalizedPath.slice(0, idx),
    query: normalizedPath.slice(idx),
  };
}

function decodeSegmentSafe(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function hasTraversalSegment(inputPath) {
  const rawPath = splitQuery(inputPath || "").path;
  const parts = rawPath.split("/");
  return parts.some((part) => {
    if (!part) return false;
    const decoded = decodeSegmentSafe(String(part).trim());
    return decoded === "." || decoded === ".." || decoded.includes("/") || decoded.includes("\\");
  });
}

export function assertSafePathInput(inputPath) {
  if (hasTraversalSegment(inputPath)) {
    throw new Error("Invalid path: contains .. or .");
  }
}

export function normalizePath(inputPath) {
  const { path, query } = splitQuery(inputPath || "");
  const isAbs = path.startsWith("/");
  const parts = path.split("/");
  const out = [];

  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (out.length) out.pop();
      continue;
    }
    out.push(part);
  }

  const nextPath = `${isAbs ? "/" : ""}${out.join("/")}`;
  const base = nextPath || (isAbs ? "/" : ".");
  return `${base}${query}`;
}

export function joinPath(...segments) {
  return normalizePath(segments.filter(Boolean).join("/"));
}

export function stripQuery(path) {
  return splitQuery(path).path;
}

export function splitPath(path) {
  assertSafePathInput(path);
  const normalized = normalizePath(path);
  return stripQuery(normalized).split("/").filter(Boolean);
}

export function rewriteAssetPathForSite(path) {
  const normalized = normalizePath(path);
  const marker = normalized.indexOf("assets/");
  if (marker >= 0) return normalized.slice(marker);
  return normalized;
}

export function sanitizeBookId(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
