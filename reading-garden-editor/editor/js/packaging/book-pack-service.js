import { normalizePath, sanitizeBookId, splitPath } from "../core/path-resolver.js";
import {
  downloadBlob,
  getZipCtor,
  hasAllowedPrefix,
  inferZipEntrySize,
  isSafeRelativePath,
  isSafeZipEntryPath,
  sha256Bytes,
  sha256Text,
} from "./pack-utils.js";

const PACK_ALLOWED_PREFIXES = [
  "manifest.json",
  "book/book.json",
  "book/registry.json",
  "book/data",
  "book/assets",
  "book/prompts",
  "book/ai-meta.json",
];

const DEFAULT_SECURITY_LIMITS = {
  maxFiles: 400,
  maxFileBytes: 8 * 1024 * 1024,
  maxTotalBytes: 64 * 1024 * 1024,
};

const TEXT_DECODER = new TextDecoder();

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

function resolveBookDataPath(bookId, relativePath) {
  return normalizePath(`data/${bookId}/${String(relativePath || "")}`);
}

function collectStrings(value, output) {
  if (Array.isArray(value)) {
    value.forEach((v) => collectStrings(v, output));
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((v) => collectStrings(v, output));
    return;
  }
  if (typeof value === "string") output.push(value);
}

function deepReplaceBookId(value, oldId, newId) {
  if (!oldId || !newId || oldId === newId) return value;

  if (Array.isArray(value)) {
    return value.map((v) => deepReplaceBookId(v, oldId, newId));
  }

  if (value && typeof value === "object") {
    const out = {};
    Object.keys(value).forEach((k) => {
      out[k] = deepReplaceBookId(value[k], oldId, newId);
    });
    return out;
  }

  if (typeof value === "string") {
    return value
      .replaceAll(`/${oldId}/`, `/${newId}/`)
      .replaceAll(`book=${oldId}`, `book=${newId}`)
      .replaceAll(`${oldId}-`, `${newId}-`);
  }

  return value;
}

async function ensureParentDirs(fs, path, createdDirs) {
  const parts = splitPath(path);
  if (parts.length <= 1) return;

  const dirParts = parts.slice(0, -1);
  let accum = "";

  for (const part of dirParts) {
    accum = accum ? `${accum}/${part}` : part;
    // eslint-disable-next-line no-await-in-loop
    const exists = await fs.exists(accum);
    if (!exists) {
      // eslint-disable-next-line no-await-in-loop
      await fs.ensureDirectory(accum);
      createdDirs.push(accum);
    }
  }
}

function parseJson(raw, errorCode) {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(errorCode);
  }
}

function assertSafeRelPath(path, code) {
  if (!isSafeRelativePath(path)) {
    throw new Error(`${code}: ${path}`);
  }
}

export class BookPackService {
  constructor({ fs, mergeService, securityLimits = {} }) {
    this.fs = fs;
    this.mergeService = mergeService;
    this.securityLimits = {
      ...DEFAULT_SECURITY_LIMITS,
      ...securityLimits,
    };
  }

  async buildManifest({
    book,
    schemaVersion = "2026-02",
    dataFiles = [],
    assets = [],
    checksums = {},
    checksumMode = "none",
  }) {
    return {
      format: "rgbook",
      formatVersion: "1.1.0",
      schemaVersion,
      book: {
        id: String(book?.id || ""),
        title: String(book?.title || ""),
        version: "1.0.0",
      },
      createdAt: new Date().toISOString(),
      capabilities: {
        llmGenerated: false,
        imageMode: "none",
      },
      checksumMode,
      dataFiles,
      assets,
      checksums,
    };
  }

  enforceSizeLimit(entryName, size, counter) {
    if (size > this.securityLimits.maxFileBytes) {
      throw new Error(`PACK_SECURITY_FILE_TOO_LARGE: ${entryName}`);
    }
    counter.total += size;
    if (counter.total > this.securityLimits.maxTotalBytes) {
      throw new Error("PACK_SECURITY_TOTAL_TOO_LARGE");
    }
  }

  validateZipEntries(zip) {
    const entries = Object.values(zip.files).filter((entry) => !entry.dir);

    if (entries.length > this.securityLimits.maxFiles) {
      throw new Error("PACK_SECURITY_TOO_MANY_FILES");
    }

    let totalHint = 0;
    for (const entry of entries) {
      const name = String(entry?.name || "");
      if (!isSafeZipEntryPath(name)) {
        throw new Error(`PACK_SECURITY_INVALID_PATH: ${name}`);
      }
      if (!hasAllowedPrefix(name, PACK_ALLOWED_PREFIXES)) {
        throw new Error(`PACK_SECURITY_FORBIDDEN_PATH: ${name}`);
      }

      const hint = inferZipEntrySize(entry);
      if (hint != null) {
        if (hint > this.securityLimits.maxFileBytes) {
          throw new Error(`PACK_SECURITY_FILE_TOO_LARGE: ${name}`);
        }
        totalHint += hint;
      }
    }

    if (totalHint > this.securityLimits.maxTotalBytes) {
      throw new Error("PACK_SECURITY_TOTAL_TOO_LARGE");
    }

    return entries;
  }

  async readZipBytes(zip, entryName, counter) {
    const entry = zip.file(entryName);
    if (!entry) throw new Error(`PACK_ENTRY_MISSING: ${entryName}`);
    const bytes = await entry.async("uint8array");
    this.enforceSizeLimit(entryName, bytes.byteLength, counter);
    return bytes;
  }

  async readZipText(zip, entryName, counter) {
    const bytes = await this.readZipBytes(zip, entryName, counter);
    return TEXT_DECODER.decode(bytes);
  }

  async verifyManifestChecksums(zip, manifest) {
    const checksums = manifest?.checksums;
    if (!checksums || typeof checksums !== "object") {
      return {
        mode: "none",
        verified: 0,
      };
    }

    const checksumEntries = Object.entries(checksums).filter(([, v]) => typeof v === "string" && v);
    if (!checksumEntries.length) {
      return {
        mode: "none",
        verified: 0,
      };
    }

    const counter = { total: 0 };
    for (const [entryName, expected] of checksumEntries) {
      if (!isSafeZipEntryPath(entryName)) {
        throw new Error(`PACK_SECURITY_INVALID_PATH: ${entryName}`);
      }
      if (!hasAllowedPrefix(entryName, PACK_ALLOWED_PREFIXES)) {
        throw new Error(`PACK_SECURITY_FORBIDDEN_PATH: ${entryName}`);
      }

      // eslint-disable-next-line no-await-in-loop
      const bytes = await this.readZipBytes(zip, entryName, counter);
      // eslint-disable-next-line no-await-in-loop
      const actual = await sha256Bytes(bytes);
      if (!actual) throw new Error("PACK_CHECKSUM_UNSUPPORTED_ENV");
      if (actual !== expected) throw new Error(`PACK_CHECKSUM_MISMATCH: ${entryName}`);
    }

    return {
      mode: manifest?.checksumMode || "sha256",
      verified: checksumEntries.length,
    };
  }

  async exportBookPack({ bookId, books }) {
    const Zip = getZipCtor();
    const book = (books || []).find((item) => item?.id === bookId);
    if (!book) throw new Error(`BOOK_NOT_FOUND: ${bookId}`);

    const registryPath = `data/${bookId}/registry.json`;
    const registry = await this.fs.readJson(registryPath);

    const dataPaths = new Set();
    const moduleData = Array.isArray(registry?.modules) ? registry.modules : [];
    moduleData.forEach((mod) => {
      if (!mod?.data) return;
      const dataPath = resolveBookDataPath(bookId, mod.data);
      if (dataPath.startsWith(`data/${bookId}/`)) dataPaths.add(dataPath);
    });

    const assetPaths = new Set();
    const coverPath = normalizeAssetPath(bookId, book.cover);
    if (coverPath) assetPaths.add(coverPath);

    const checksumEnabled = Boolean(globalThis?.crypto?.subtle);
    const checksums = {};

    const zip = new Zip();
    const bookJson = JSON.stringify(book, null, 2);
    const registryJson = JSON.stringify(registry, null, 2);
    zip.file("book/book.json", bookJson);
    zip.file("book/registry.json", registryJson);
    if (checksumEnabled) {
      checksums["book/book.json"] = await sha256Text(bookJson);
      checksums["book/registry.json"] = await sha256Text(registryJson);
    }

    const dataFilesInPack = [];
    for (const dataPath of dataPaths) {
      // eslint-disable-next-line no-await-in-loop
      const exists = await this.fs.exists(dataPath);
      if (!exists) continue;

      const rel = dataPath.replace(`data/${bookId}/`, "");
      if (!isSafeRelativePath(rel)) continue;

      // eslint-disable-next-line no-await-in-loop
      const text = await this.fs.readText(dataPath);
      const entryName = `book/data/${rel}`;
      zip.file(entryName, text);
      dataFilesInPack.push(rel);
      if (checksumEnabled) {
        // eslint-disable-next-line no-await-in-loop
        checksums[entryName] = await sha256Text(text);
      }

      try {
        const json = JSON.parse(text);
        const strings = [];
        collectStrings(json, strings);
        strings.forEach((raw) => {
          const asset = normalizeAssetPath(bookId, raw);
          if (asset) assetPaths.add(asset);
        });
      } catch {
        // ignore non-json data files
      }
    }

    const assetsInPack = [];
    for (const assetPath of assetPaths) {
      // eslint-disable-next-line no-await-in-loop
      const exists = await this.fs.exists(assetPath);
      if (!exists) continue;

      const rel = assetPath.replace(/^assets\//, "");
      if (!isSafeRelativePath(rel)) continue;

      // eslint-disable-next-line no-await-in-loop
      const bytes = await this.fs.readBinary(assetPath);
      const entryName = `book/assets/${rel}`;
      zip.file(entryName, bytes);
      assetsInPack.push(rel);
      if (checksumEnabled) {
        // eslint-disable-next-line no-await-in-loop
        checksums[entryName] = await sha256Bytes(bytes);
      }
    }

    const manifest = await this.buildManifest({
      book,
      dataFiles: dataFilesInPack,
      assets: assetsInPack,
      checksums: checksumEnabled ? checksums : {},
      checksumMode: checksumEnabled ? "sha256" : "none",
    });
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));

    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, `${bookId}.rgbook.zip`);

    return {
      ok: true,
      filename: `${bookId}.rgbook.zip`,
      dataFiles: dataFilesInPack.length,
      assets: assetsInPack.length,
      checksums: checksumEnabled ? Object.keys(checksums).length : 0,
      checksumMode: checksumEnabled ? "sha256" : "none",
    };
  }

  async inspectBookPack(file) {
    const Zip = getZipCtor();
    const zip = await Zip.loadAsync(file);
    this.validateZipEntries(zip);

    const counter = { total: 0 };
    const manifestRaw = await this.readZipText(zip, "manifest.json", counter);
    const manifest = parseJson(manifestRaw, "PACK_MANIFEST_INVALID_JSON");
    if (manifest?.format !== "rgbook") throw new Error("PACK_FORMAT_INVALID");

    const checksumReport = await this.verifyManifestChecksums(zip, manifest);
    const bookRaw = await this.readZipText(zip, "book/book.json", counter);
    const book = parseJson(bookRaw, "PACK_BOOK_INVALID_JSON");

    return {
      manifest,
      book,
      checksumReport,
    };
  }

  async importBookPack({ file, existingBooks, strategy = "rename" }) {
    const Zip = getZipCtor();
    const zip = await Zip.loadAsync(file);
    const entries = this.validateZipEntries(zip);

    const coreCounter = { total: 0 };
    const manifestRaw = await this.readZipText(zip, "manifest.json", coreCounter);
    const manifest = parseJson(manifestRaw, "PACK_MANIFEST_INVALID_JSON");
    if (manifest?.format !== "rgbook") throw new Error("PACK_FORMAT_INVALID");

    await this.verifyManifestChecksums(zip, manifest);

    const bookRaw = await this.readZipText(zip, "book/book.json", coreCounter);
    const registryRaw = await this.readZipText(zip, "book/registry.json", coreCounter);

    const incomingBook = parseJson(bookRaw, "PACK_BOOK_INVALID_JSON");
    const incomingRegistry = parseJson(registryRaw, "PACK_REGISTRY_INVALID_JSON");
    const incomingBookId = sanitizeBookId(incomingBook?.id || manifest?.book?.id || "");
    if (!incomingBookId) throw new Error("PACK_BOOK_ID_INVALID");

    const plan = this.mergeService.planMerge({
      incomingBookId,
      existingBooks,
    });

    const decision = this.mergeService.applyMergePlan({
      plan,
      existingBooks,
      strategy,
    });

    if (!decision.shouldImport) {
      return {
        ok: true,
        skipped: true,
        reason: "strategy-skip",
      };
    }

    const targetBookId = decision.targetBookId;
    const createdPaths = [];
    const createdDirs = [];
    let booksWriteResult = null;

    const trackWriteText = async (path, text) => {
      const existed = await this.fs.exists(path);
      await ensureParentDirs(this.fs, path, createdDirs);
      await this.fs.writeText(path, text);
      if (!existed) createdPaths.push({ path, recursive: false });
    };

    const trackWriteBinary = async (path, bytes) => {
      const existed = await this.fs.exists(path);
      await ensureParentDirs(this.fs, path, createdDirs);
      await this.fs.writeBinary(path, bytes);
      if (!existed) createdPaths.push({ path, recursive: false });
    };

    try {
      const registryObj = deepReplaceBookId(incomingRegistry, incomingBookId, targetBookId);
      if (registryObj?.book) registryObj.book.id = targetBookId;

      const finalBook = deepReplaceBookId(incomingBook, incomingBookId, targetBookId);
      finalBook.id = targetBookId;
      finalBook.page = `book.html?book=${targetBookId}`;

      const bookDataDir = `data/${targetBookId}`;
      if (!(await this.fs.exists(bookDataDir))) {
        await this.fs.ensureDirectory(bookDataDir);
        createdDirs.push(bookDataDir);
      }

      await trackWriteText(
        `data/${targetBookId}/registry.json`,
        `${JSON.stringify(registryObj, null, 2)}\n`
      );

      const importCounter = { total: 0 };
      const dataEntries = entries.filter((entry) => entry.name.startsWith("book/data/"));
      for (const entry of dataEntries) {
        const rel = entry.name.replace(/^book\/data\//, "");
        assertSafeRelPath(rel, "PACK_SECURITY_INVALID_DATA_PATH");

        // eslint-disable-next-line no-await-in-loop
        const bytes = await this.readZipBytes(zip, entry.name, importCounter);
        const text = TEXT_DECODER.decode(bytes);
        const nextPath = `data/${targetBookId}/${rel}`;

        let output = text;
        try {
          const parsed = JSON.parse(text);
          output = `${JSON.stringify(deepReplaceBookId(parsed, incomingBookId, targetBookId), null, 2)}\n`;
        } catch {
          // keep as plain text
        }

        // eslint-disable-next-line no-await-in-loop
        await trackWriteText(nextPath, output);
      }

      const assetEntries = entries.filter((entry) => entry.name.startsWith("book/assets/"));
      for (const entry of assetEntries) {
        const rel = entry.name.replace(/^book\/assets\//, "");
        assertSafeRelPath(rel, "PACK_SECURITY_INVALID_ASSET_PATH");

        const relRewritten = rel.replaceAll(`/${incomingBookId}/`, `/${targetBookId}/`);
        assertSafeRelPath(relRewritten, "PACK_SECURITY_INVALID_ASSET_PATH");
        const nextPath = `assets/${relRewritten}`;

        // eslint-disable-next-line no-await-in-loop
        const bytes = await this.readZipBytes(zip, entry.name, importCounter);
        // eslint-disable-next-line no-await-in-loop
        await trackWriteBinary(nextPath, bytes);
      }

      const booksData = await this.fs.readJson("data/books.json");
      const books = Array.isArray(booksData?.books) ? booksData.books : [];
      let nextBooks = books;

      if (decision.strategy === "overwrite") {
        nextBooks = books.filter((item) => item?.id !== targetBookId);
      }
      nextBooks = [...nextBooks, finalBook];

      booksWriteResult = await this.fs.writeJson("data/books.json", { books: nextBooks });

      return {
        ok: true,
        targetBookId,
        strategy: decision.strategy,
        importedDataFiles: dataEntries.length,
        importedAssets: assetEntries.length,
      };
    } catch (err) {
      if (booksWriteResult?.backupPath) {
        try {
          const backupText = await this.fs.readText(booksWriteResult.backupPath);
          await this.fs.writeText("data/books.json", backupText, { skipBackup: true });
        } catch {
          // best-effort restore
        }
      }

      for (let i = createdPaths.length - 1; i >= 0; i -= 1) {
        const item = createdPaths[i];
        try {
          // eslint-disable-next-line no-await-in-loop
          await this.fs.deletePath(item.path, { recursive: item.recursive });
        } catch {
          // ignore
        }
      }

      for (let i = createdDirs.length - 1; i >= 0; i -= 1) {
        const path = createdDirs[i];
        try {
          // eslint-disable-next-line no-await-in-loop
          await this.fs.deletePath(path, { recursive: true });
        } catch {
          // ignore
        }
      }

      throw err;
    }
  }
}
