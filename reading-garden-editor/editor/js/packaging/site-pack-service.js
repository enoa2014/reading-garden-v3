import { normalizePath } from "../core/path-resolver.js";
import {
  downloadBlob,
  getZipCtor,
  isLikelyTextFile,
  sha256Bytes,
  sha256Text,
} from "./pack-utils.js";

const DEFAULT_INCLUDE_ROOTS = [
  "index.html",
  "book.html",
  "css",
  "js",
  "data",
  "assets",
  "design-system",
];

const SUBSET_CORE_ROOTS = [
  "index.html",
  "book.html",
  "css",
  "js",
  "design-system",
];

const SENSITIVE_KEY_PATTERN = /(api[-_]?key|token|secret|authorization|password)/i;
const TEXT_ENCODER = new TextEncoder();
const ASSET_REF_PATTERN = /assets\/[a-zA-Z0-9_./-]+(?:\?[^\s"'`)]+)?/g;

function nowStamp() {
  const dt = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}-${pad(dt.getHours())}${pad(dt.getMinutes())}${pad(dt.getSeconds())}`;
}

function normalizeAssetPath(bookId, rawPath) {
  const raw = String(rawPath || "").trim();
  if (!raw) return "";
  if (raw.startsWith("assets/")) return raw.split("?")[0];
  if (raw.includes("assets/")) return raw.slice(raw.indexOf("assets/")).split("?")[0];
  const resolved = normalizePath(`data/${bookId}/${raw}`);
  const marker = resolved.indexOf("assets/");
  if (marker >= 0) return resolved.slice(marker).split("?")[0];
  return "";
}

function collectStrings(value, output) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, output));
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStrings(item, output));
    return;
  }
  if (typeof value === "string") output.push(value);
}

function extractAssetRefsFromText(text) {
  const content = String(text || "");
  const refs = new Set();
  const matches = content.match(ASSET_REF_PATTERN) || [];
  matches.forEach((raw) => {
    const cleaned = String(raw).split("?")[0];
    if (cleaned.startsWith("assets/")) refs.add(cleaned);
  });
  return refs;
}

function normalizeSelection(selectedBookIds = []) {
  const out = [];
  const seen = new Set();
  selectedBookIds.forEach((raw) => {
    const id = String(raw || "").trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  });
  return out;
}

function redactSensitiveValue(value) {
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((item) => {
      const next = redactSensitiveValue(item);
      if (next.changed) changed = true;
      return next.value;
    });
    return { value: out, changed };
  }

  if (value && typeof value === "object") {
    let changed = false;
    const out = {};
    Object.keys(value).forEach((key) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        out[key] = "***REDACTED***";
        changed = true;
        return;
      }
      const next = redactSensitiveValue(value[key]);
      out[key] = next.value;
      if (next.changed) changed = true;
    });
    return { value: out, changed };
  }

  return { value, changed: false };
}

function redactSensitiveJsonText(rawText) {
  try {
    const parsed = JSON.parse(rawText);
    const redacted = redactSensitiveValue(parsed);
    if (!redacted.changed) return { text: rawText, redacted: false };
    return {
      text: `${JSON.stringify(redacted.value, null, 2)}\n`,
      redacted: true,
    };
  } catch {
    return { text: rawText, redacted: false };
  }
}

async function collectRuntimeFiles(fs, path, outputSet) {
  const exists = await fs.exists(path);
  if (!exists) return;

  try {
    const entries = await fs.list(path);
    for (const entry of entries) {
      const childPath = normalizePath(`${path}/${entry.name}`);
      if (entry.kind === "directory") {
        // eslint-disable-next-line no-await-in-loop
        await collectRuntimeFiles(fs, childPath, outputSet);
      } else {
        outputSet.add(childPath);
      }
    }
  } catch {
    outputSet.add(normalizePath(path));
  }
}

function bookIdFromAssetPath(assetPath, allBookIdsSet) {
  const marker = "assets/images/";
  if (!assetPath.startsWith(marker)) return null;
  const rest = assetPath.slice(marker.length);
  const candidate = rest.split("/")[0];
  if (!candidate) return null;
  return allBookIdsSet.has(candidate) ? candidate : null;
}

function buildEdgeOneGuide() {
  return [
    "# EdgeOne 部署说明",
    "",
    "1. 解压 `*.rgsite.zip` 到本地目录。",
    "2. 登录腾讯云 EdgeOne 控制台，创建或进入对应站点。",
    "3. 在静态资源托管/对象存储绑定中上传解压后的全部文件。",
    "4. 确认站点根目录包含 `index.html` 和 `book.html`。",
    "5. 发布后访问域名，并检查首页与书籍详情页是否可正常加载。",
  ].join("\n");
}

function buildMissingAssetsReport(missingAssets = []) {
  const lines = [
    "# Missing Assets Report",
    "",
    `count: ${missingAssets.length}`,
    "",
  ];
  missingAssets.forEach((item) => lines.push(`- ${item}`));
  return lines.join("\n");
}

export class SitePackService {
  constructor({ fs }) {
    this.fs = fs;
  }

  resolveTargetBooks({ books, selectedBookIds, errors }) {
    if (!selectedBookIds.length) return books;

    const bookMap = new Map(books.map((book) => [String(book?.id || "").trim(), book]));
    const target = [];

    selectedBookIds.forEach((id) => {
      const hit = bookMap.get(id);
      if (hit) {
        target.push(hit);
      } else {
        errors.push(`未找到书籍：${id}`);
      }
    });

    return target;
  }

  async collectReferencedAssets(book, outAssets) {
    const bookId = String(book?.id || "").trim();
    if (!bookId) return;

    const cover = normalizeAssetPath(bookId, book?.cover);
    if (cover) outAssets.add(cover);

    const registryPath = `data/${bookId}/registry.json`;
    let registry = null;
    try {
      registry = await this.fs.readJson(registryPath);
    } catch {
      return;
    }

    const modules = Array.isArray(registry?.modules) ? registry.modules : [];
    for (const mod of modules) {
      const dataRaw = String(mod?.data || "").trim();
      if (!dataRaw) continue;

      const dataPath = normalizePath(`data/${bookId}/${dataRaw}`);
      // eslint-disable-next-line no-await-in-loop
      const exists = await this.fs.exists(dataPath);
      if (!exists) continue;

      // eslint-disable-next-line no-await-in-loop
      const text = await this.fs.readText(dataPath);
      try {
        const parsed = JSON.parse(text);
        const strings = [];
        collectStrings(parsed, strings);
        strings.forEach((raw) => {
          const asset = normalizeAssetPath(bookId, raw);
          if (asset) outAssets.add(asset);
        });
      } catch {
        // ignore non-json files
      }
    }
  }

  async collectAssetRefsFromFileSet(fileSet, outAssets) {
    const candidates = Array.from(fileSet).filter((path) => isLikelyTextFile(path));
    for (const path of candidates) {
      // eslint-disable-next-line no-await-in-loop
      const exists = await this.fs.exists(path);
      if (!exists) continue;
      // eslint-disable-next-line no-await-in-loop
      const text = await this.fs.readText(path);
      const refs = extractAssetRefsFromText(text);
      refs.forEach((item) => outAssets.add(item));
    }
  }

  async addExistingAssetsToFileSet(assetSet, fileSet) {
    const missingAssets = [];
    for (const assetPath of assetSet) {
      // eslint-disable-next-line no-await-in-loop
      const exists = await this.fs.exists(assetPath);
      if (exists) {
        fileSet.add(assetPath);
      } else {
        missingAssets.push(assetPath);
      }
    }
    return missingAssets;
  }

  async validateForExport({ selectedBookIds = [] } = {}) {
    const normalizedSelected = normalizeSelection(selectedBookIds);
    const errors = [];
    let booksCount = 0;
    let missingAssets = 0;
    let missingCrossRefs = 0;
    let booksDataReadOk = true;

    const structure = await this.fs.verifyStructure();
    if (!structure?.ok) {
      (structure?.missing || []).forEach((item) => {
        errors.push(`缺失基础路径：${item}`);
      });
    }

    if (!(await this.fs.exists("book.html"))) {
      errors.push("缺失 book.html");
    }

    let booksData = null;
    try {
      booksData = await this.fs.readJson("data/books.json");
    } catch (err) {
      booksDataReadOk = false;
      errors.push(`读取 data/books.json 失败：${err?.message || String(err)}`);
    }

    const books = Array.isArray(booksData?.books) ? booksData.books : [];
    const targetBooks = this.resolveTargetBooks({
      books,
      selectedBookIds: normalizedSelected,
      errors,
    });
    booksCount = targetBooks.length;

    for (const book of targetBooks) {
      const id = String(book?.id || "").trim();
      if (!id) {
        errors.push("books.json 含空书籍 id");
        continue;
      }

      const registryPath = `data/${id}/registry.json`;
      // eslint-disable-next-line no-await-in-loop
      const registryExists = await this.fs.exists(registryPath);
      if (!registryExists) {
        errors.push(`缺失 ${registryPath}`);
        missingCrossRefs += 1;
        continue;
      }

      let registry = null;
      try {
        // eslint-disable-next-line no-await-in-loop
        registry = await this.fs.readJson(registryPath);
      } catch (err) {
        errors.push(`${registryPath} 解析失败：${err?.message || String(err)}`);
        missingCrossRefs += 1;
        continue;
      }

      const modules = Array.isArray(registry?.modules) ? registry.modules : [];
      for (const mod of modules) {
        const modId = String(mod?.id || "(unknown)");
        const entryRaw = String(mod?.entry || "").trim();
        const dataRaw = String(mod?.data || "").trim();

        if (!entryRaw) {
          errors.push(`书籍 ${id} 模块 ${modId} 缺失 entry 配置`);
          missingCrossRefs += 1;
          continue;
        }
        if (!dataRaw) {
          errors.push(`书籍 ${id} 模块 ${modId} 缺失 data 配置`);
          missingCrossRefs += 1;
          continue;
        }

        const entryPath = normalizePath(`data/${id}/${entryRaw}`);
        const dataPath = normalizePath(`data/${id}/${dataRaw}`);

        // eslint-disable-next-line no-await-in-loop
        const entryOk = await this.fs.exists(entryPath);
        // eslint-disable-next-line no-await-in-loop
        const dataOk = await this.fs.exists(dataPath);
        if (!entryOk) {
          errors.push(`书籍 ${id} 模块 ${modId} 缺失 entry: ${entryPath}`);
          missingCrossRefs += 1;
        }
        if (!dataOk) {
          errors.push(`书籍 ${id} 模块 ${modId} 缺失 data: ${dataPath}`);
          missingCrossRefs += 1;
        }
      }

      const coverPath = normalizeAssetPath(id, book?.cover);
      if (coverPath) {
        // eslint-disable-next-line no-await-in-loop
        const coverOk = await this.fs.exists(coverPath);
        if (!coverOk) {
          errors.push(`书籍 ${id} 缺失封面资源: ${coverPath}`);
          missingAssets += 1;
        }
      }
    }

    return {
      ok: errors.length === 0,
      errors,
      booksCount,
      targetBooks,
      allBooks: books,
      selectedBookIds: normalizedSelected,
      checks: {
        schema: Boolean(structure?.ok) && booksDataReadOk,
        assets: missingAssets === 0,
        crossRefs: missingCrossRefs === 0,
        pathRewrite: true,
      },
    };
  }

  async buildManifest({
    booksCount,
    includeEditor,
    selectedBookIds,
    subsetAssetMode,
    missingAssets,
    checks,
    filesCount,
    totalBytes,
    checksumMode,
    checksums,
    redactedFiles,
  }) {
    return {
      format: "rgsite",
      formatVersion: "1.2.0",
      booksCount: Number(booksCount || 0),
      entry: "index.html",
      buildTime: new Date().toISOString(),
      includeEditor: Boolean(includeEditor),
      selectedBookIds: Array.isArray(selectedBookIds) ? selectedBookIds : [],
      subsetAssetMode: String(subsetAssetMode || "balanced"),
      missingAssets: Array.isArray(missingAssets) ? missingAssets : [],
      checks: {
        schema: Boolean(checks?.schema),
        assets: Boolean(checks?.assets),
        crossRefs: Boolean(checks?.crossRefs),
        pathRewrite: Boolean(checks?.pathRewrite),
      },
      files: {
        count: Number(filesCount || 0),
        totalBytes: Number(totalBytes || 0),
      },
      checksumMode,
      redactedFiles,
      checksums,
    };
  }

  async collectSubsetFiles({
    targetBooks,
    allBooks,
    includeEditor,
    subsetAssetMode = "balanced",
  }) {
    const fileSet = new Set();
    const assetSet = new Set();

    const allBookIdsSet = new Set(
      (allBooks || []).map((book) => String(book?.id || "").trim()).filter(Boolean)
    );
    const selectedIds = (targetBooks || [])
      .map((book) => String(book?.id || "").trim())
      .filter(Boolean);
    const selectedIdsSet = new Set(selectedIds);

    const roots = includeEditor
      ? [...SUBSET_CORE_ROOTS, "reading-garden-editor"]
      : SUBSET_CORE_ROOTS;
    for (const root of roots) {
      // eslint-disable-next-line no-await-in-loop
      await collectRuntimeFiles(this.fs, root, fileSet);
    }

    for (const book of targetBooks) {
      const id = String(book?.id || "").trim();
      if (!id) continue;

      // eslint-disable-next-line no-await-in-loop
      await collectRuntimeFiles(this.fs, `data/${id}`, fileSet);
      // eslint-disable-next-line no-await-in-loop
      await this.collectReferencedAssets(book, assetSet);
    }

    let missingAssets = [];
    if (subsetAssetMode === "minimal") {
      await this.collectAssetRefsFromFileSet(fileSet, assetSet);
      missingAssets = await this.addExistingAssetsToFileSet(assetSet, fileSet);
    } else {
      const allAssets = new Set();
      await collectRuntimeFiles(this.fs, "assets", allAssets);
      allAssets.forEach((assetPath) => {
        const ownerId = bookIdFromAssetPath(assetPath, allBookIdsSet);
        if (ownerId && !selectedIdsSet.has(ownerId)) return;
        fileSet.add(assetPath);
      });
      missingAssets = await this.addExistingAssetsToFileSet(assetSet, fileSet);
    }

    return {
      fileSet,
      filteredBooksJson: {
        books: targetBooks,
      },
      selectedIds,
      subsetAssetMode,
      missingAssets,
    };
  }

  async exportSitePack({
    includeEditor = false,
    selectedBookIds = [],
    subsetAssetMode = "balanced",
  } = {}) {
    const normalizedSelected = normalizeSelection(selectedBookIds);
    const normalizedSubsetAssetMode = subsetAssetMode === "minimal" ? "minimal" : "balanced";
    const readiness = await this.validateForExport({
      selectedBookIds: normalizedSelected,
    });
    if (!readiness.ok) {
      throw new Error(`SITE_EXPORT_BLOCKED: ${readiness.errors.slice(0, 8).join("；")}`);
    }

    const subsetMode = normalizedSelected.length > 0;
    const Zip = getZipCtor();
    const zip = new Zip();
    const checksumEnabled = Boolean(globalThis?.crypto?.subtle);
    const checksums = {};
    const redactedFiles = [];

    const fileSet = new Set();
    let filteredBooksJsonText = "";
    let effectiveSelectedIds = [];
    let effectiveSubsetAssetMode = "balanced";
    let missingAssets = [];

    if (subsetMode) {
      const subsetFiles = await this.collectSubsetFiles({
        targetBooks: readiness.targetBooks,
        allBooks: readiness.allBooks,
        includeEditor,
        subsetAssetMode: normalizedSubsetAssetMode,
      });
      subsetFiles.fileSet.forEach((item) => fileSet.add(item));
      filteredBooksJsonText = `${JSON.stringify(subsetFiles.filteredBooksJson, null, 2)}\n`;
      effectiveSelectedIds = subsetFiles.selectedIds;
      effectiveSubsetAssetMode = subsetFiles.subsetAssetMode;
      missingAssets = subsetFiles.missingAssets || [];
    } else {
      const includeRoots = includeEditor
        ? [...DEFAULT_INCLUDE_ROOTS, "reading-garden-editor"]
        : DEFAULT_INCLUDE_ROOTS;
      for (const root of includeRoots) {
        // eslint-disable-next-line no-await-in-loop
        await collectRuntimeFiles(this.fs, root, fileSet);
      }
    }

    const orderedFiles = Array.from(fileSet).sort((a, b) => a.localeCompare(b));
    let totalBytes = 0;
    for (const filePath of orderedFiles) {
      if (subsetMode && filePath === "data/books.json") {
        continue;
      }

      const isText = isLikelyTextFile(filePath);
      if (isText) {
        // eslint-disable-next-line no-await-in-loop
        const text = await this.fs.readText(filePath);
        let output = text;

        if (filePath.toLowerCase().endsWith(".json")) {
          const redacted = redactSensitiveJsonText(text);
          output = redacted.text;
          if (redacted.redacted) redactedFiles.push(filePath);
        }

        zip.file(filePath, output);
        const size = TEXT_ENCODER.encode(output).byteLength;
        totalBytes += size;
        if (checksumEnabled) {
          // eslint-disable-next-line no-await-in-loop
          checksums[filePath] = await sha256Text(output);
        }
      } else {
        // eslint-disable-next-line no-await-in-loop
        const bytes = await this.fs.readBinary(filePath);
        zip.file(filePath, bytes);
        const size = bytes.byteLength || bytes.length || 0;
        totalBytes += size;
        if (checksumEnabled) {
          // eslint-disable-next-line no-await-in-loop
          checksums[filePath] = await sha256Bytes(bytes);
        }
      }
    }

    if (subsetMode) {
      zip.file("data/books.json", filteredBooksJsonText);
      totalBytes += TEXT_ENCODER.encode(filteredBooksJsonText).byteLength;
      if (checksumEnabled) {
        checksums["data/books.json"] = await sha256Text(filteredBooksJsonText);
      }
    }

    const deployGuide = buildEdgeOneGuide();
    zip.file("DEPLOY-EDGEONE.md", deployGuide);
    totalBytes += TEXT_ENCODER.encode(deployGuide).byteLength;
    if (checksumEnabled) {
      checksums["DEPLOY-EDGEONE.md"] = await sha256Text(deployGuide);
    }

    let missingAssetsReportAdded = false;
    if (missingAssets.length) {
      const missingAssetsText = buildMissingAssetsReport(missingAssets);
      zip.file("MISSING-ASSETS.txt", missingAssetsText);
      totalBytes += TEXT_ENCODER.encode(missingAssetsText).byteLength;
      if (checksumEnabled) {
        checksums["MISSING-ASSETS.txt"] = await sha256Text(missingAssetsText);
      }
      missingAssetsReportAdded = true;
    }

    const manifest = await this.buildManifest({
      booksCount: readiness.booksCount,
      includeEditor,
      selectedBookIds: effectiveSelectedIds,
      subsetAssetMode: effectiveSubsetAssetMode,
      missingAssets,
      checks: readiness.checks,
      filesCount: orderedFiles.length + 2 + (subsetMode ? 1 : 0),
      totalBytes,
      checksumMode: checksumEnabled ? "sha256" : "none",
      checksums: checksumEnabled ? checksums : {},
      redactedFiles,
    });
    zip.file("rgsite-manifest.json", JSON.stringify(manifest, null, 2));

    const suffix = subsetMode ? "subset" : "full";
    const filename = `reading-garden-site-${suffix}-${nowStamp()}.rgsite.zip`;
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, filename);

    return {
      ok: true,
      filename,
      files: orderedFiles.length + 2 + (subsetMode ? 1 : 0),
      books: readiness.booksCount,
      checksumMode: checksumEnabled ? "sha256" : "none",
      redacted: redactedFiles.length,
      scope: subsetMode ? "subset" : "full",
      selectedBookIds: effectiveSelectedIds,
      subsetAssetMode: effectiveSubsetAssetMode,
      missingAssets,
      missingAssetsReportAdded,
    };
  }
}
