function splitQuery(path) {
  const idx = String(path).indexOf("?");
  if (idx < 0) return { path: String(path), query: "" };
  return {
    path: String(path).slice(0, idx),
    query: String(path).slice(idx),
  };
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
  return nextPath || (isAbs ? "/" : ".") + query;
}

export function joinPath(...segments) {
  return normalizePath(segments.filter(Boolean).join("/"));
}

export function stripQuery(path) {
  return splitQuery(path).path;
}

export function splitPath(path) {
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
