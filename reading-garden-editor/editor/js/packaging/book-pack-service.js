import { normalizePath, sanitizeBookId, splitPath } from "../core/path-resolver.js";

function getZipCtor() {
  if (typeof window !== "undefined" && window.JSZip) return window.JSZip;
  if (typeof globalThis !== "undefined" && globalThis.JSZip) return globalThis.JSZip;
  throw new Error("JSZIP_NOT_AVAILABLE");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
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

export class BookPackService {
  constructor({ fs, mergeService }) {
    this.fs = fs;
    this.mergeService = mergeService;
  }

  async buildManifest({ book, schemaVersion = "2026-02", dataFiles = [], assets = [] }) {
    return {
      format: "rgbook",
      formatVersion: "1.0.0",
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
      dataFiles,
      assets,
      checksums: {},
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
      dataPaths.add(resolveBookDataPath(bookId, mod.data));
    });

    const assetPaths = new Set();
    const coverPath = normalizeAssetPath(bookId, book.cover);
    if (coverPath) assetPaths.add(coverPath);

    const zip = new Zip();
    zip.file("book/book.json", JSON.stringify(book, null, 2));
    zip.file("book/registry.json", JSON.stringify(registry, null, 2));

    const dataFilesInPack = [];

    for (const dataPath of dataPaths) {
      // eslint-disable-next-line no-await-in-loop
      const exists = await this.fs.exists(dataPath);
      if (!exists) continue;

      // eslint-disable-next-line no-await-in-loop
      const text = await this.fs.readText(dataPath);
      const rel = dataPath.replace(`data/${bookId}/`, "");
      zip.file(`book/data/${rel}`, text);
      dataFilesInPack.push(rel);

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

      // eslint-disable-next-line no-await-in-loop
      const bytes = await this.fs.readBinary(assetPath);
      const rel = assetPath.replace(/^assets\//, "");
      zip.file(`book/assets/${rel}`, bytes);
      assetsInPack.push(rel);
    }

    const manifest = await this.buildManifest({
      book,
      dataFiles: dataFilesInPack,
      assets: assetsInPack,
    });
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));

    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, `${bookId}.rgbook.zip`);

    return {
      ok: true,
      filename: `${bookId}.rgbook.zip`,
      dataFiles: dataFilesInPack.length,
      assets: assetsInPack.length,
    };
  }

  async inspectBookPack(file) {
    const Zip = getZipCtor();
    const zip = await Zip.loadAsync(file);

    const manifestRaw = await zip.file("manifest.json")?.async("string");
    if (!manifestRaw) throw new Error("PACK_MANIFEST_MISSING");

    const manifest = JSON.parse(manifestRaw);
    if (manifest?.format !== "rgbook") throw new Error("PACK_FORMAT_INVALID");

    const bookRaw = await zip.file("book/book.json")?.async("string");
    const book = bookRaw ? JSON.parse(bookRaw) : null;

    return {
      manifest,
      book,
    };
  }

  async importBookPack({ file, existingBooks, strategy = "rename" }) {
    const Zip = getZipCtor();
    const zip = await Zip.loadAsync(file);

    const manifestRaw = await zip.file("manifest.json")?.async("string");
    if (!manifestRaw) throw new Error("PACK_MANIFEST_MISSING");
    const manifest = JSON.parse(manifestRaw);
    if (manifest?.format !== "rgbook") throw new Error("PACK_FORMAT_INVALID");

    const bookRaw = await zip.file("book/book.json")?.async("string");
    const registryRaw = await zip.file("book/registry.json")?.async("string");
    if (!bookRaw || !registryRaw) throw new Error("PACK_CORE_FILES_MISSING");

    const incomingBook = JSON.parse(bookRaw);
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
      const registryObj = deepReplaceBookId(JSON.parse(registryRaw), incomingBookId, targetBookId);
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

      const dataEntries = Object.keys(zip.files).filter((name) => name.startsWith("book/data/"));
      for (const entry of dataEntries) {
        // eslint-disable-next-line no-await-in-loop
        const text = await zip.file(entry).async("string");
        const rel = entry.replace(/^book\/data\//, "");
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

      const assetEntries = Object.keys(zip.files).filter((name) => name.startsWith("book/assets/"));
      for (const entry of assetEntries) {
        const rel = entry.replace(/^book\/assets\//, "");
        const relRewritten = rel.replaceAll(`/${incomingBookId}/`, `/${targetBookId}/`);
        const nextPath = `assets/${relRewritten}`;
        // eslint-disable-next-line no-await-in-loop
        const bytes = await zip.file(entry).async("uint8array");
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
