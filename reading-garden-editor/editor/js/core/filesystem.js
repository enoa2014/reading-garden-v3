import { joinPath, splitPath, stripQuery } from "./path-resolver.js";

const REQUIRED_PATHS = ["index.html", "data", "js", "css"];
const BACKUP_DIR = ".rg-editor-backups";

function nowStamp() {
  const dt = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}-${pad(dt.getHours())}${pad(dt.getMinutes())}${pad(dt.getSeconds())}`;
}

async function getDirectoryHandle(rootHandle, pathParts, options = {}) {
  let current = rootHandle;
  for (const part of pathParts) {
    current = await current.getDirectoryHandle(part, options);
  }
  return current;
}

async function getParentDirAndName(rootHandle, fullPath, options = {}) {
  const parts = splitPath(fullPath);
  const fileName = parts.pop();
  if (!fileName) throw new Error(`Invalid path: ${fullPath}`);
  const dir = parts.length
    ? await getDirectoryHandle(rootHandle, parts, options)
    : rootHandle;
  return { dir, fileName };
}

async function pathExists(rootHandle, path) {
  const parts = splitPath(path);
  if (!parts.length) return true;

  let current = rootHandle;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const isLast = i === parts.length - 1;

    try {
      if (isLast) {
        try {
          await current.getDirectoryHandle(part);
          return true;
        } catch {
          await current.getFileHandle(part);
          return true;
        }
      }
      current = await current.getDirectoryHandle(part);
    } catch {
      return false;
    }
  }

  return false;
}

async function writeWithHandle(fileHandle, content) {
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

export class FileSystemAdapter {
  constructor() {
    this.projectHandle = null;
  }

  async openProject() {
    if (!("showDirectoryPicker" in window)) {
      throw new Error("BROWSER_UNSUPPORTED");
    }

    this.projectHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    return this.projectHandle;
  }

  setProjectHandle(handle) {
    this.projectHandle = handle;
  }

  getProjectHandle() {
    return this.projectHandle;
  }

  async verifyStructure() {
    if (!this.projectHandle) throw new Error("PROJECT_NOT_OPENED");

    const missing = [];
    for (const path of REQUIRED_PATHS) {
      // eslint-disable-next-line no-await-in-loop
      const exists = await pathExists(this.projectHandle, path);
      if (!exists) missing.push(path);
    }

    return {
      ok: missing.length === 0,
      missing,
      checkedAt: new Date().toISOString(),
    };
  }

  async exists(path) {
    if (!this.projectHandle) throw new Error("PROJECT_NOT_OPENED");
    return pathExists(this.projectHandle, stripQuery(path));
  }

  async readText(path) {
    if (!this.projectHandle) throw new Error("PROJECT_NOT_OPENED");
    const normalized = stripQuery(path);
    const { dir, fileName } = await getParentDirAndName(this.projectHandle, normalized);
    const fileHandle = await dir.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return file.text();
  }

  async readBinary(path) {
    if (!this.projectHandle) throw new Error("PROJECT_NOT_OPENED");
    const normalized = stripQuery(path);
    const { dir, fileName } = await getParentDirAndName(this.projectHandle, normalized);
    const fileHandle = await dir.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return file.arrayBuffer();
  }

  async readJson(path) {
    const text = await this.readText(path);
    return JSON.parse(text);
  }

  async list(path = ".") {
    if (!this.projectHandle) throw new Error("PROJECT_NOT_OPENED");
    const parts = splitPath(path);
    const dir = parts.length
      ? await getDirectoryHandle(this.projectHandle, parts)
      : this.projectHandle;

    const out = [];
    // eslint-disable-next-line no-restricted-syntax
    for await (const [name, handle] of dir.entries()) {
      out.push({ name, kind: handle.kind });
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }

  async ensureDirectory(path) {
    if (!this.projectHandle) throw new Error("PROJECT_NOT_OPENED");
    const parts = splitPath(path);
    return getDirectoryHandle(this.projectHandle, parts, { create: true });
  }

  async deletePath(path, options = {}) {
    if (!this.projectHandle) throw new Error("PROJECT_NOT_OPENED");
    const normalized = stripQuery(path);
    const parts = splitPath(normalized);
    const name = parts.pop();
    if (!name) throw new Error(`Invalid delete path: ${path}`);

    const dir = parts.length
      ? await getDirectoryHandle(this.projectHandle, parts)
      : this.projectHandle;

    await dir.removeEntry(name, { recursive: Boolean(options.recursive) });
  }

  async backupFileIfExistsText(path) {
    if (!this.projectHandle) throw new Error("PROJECT_NOT_OPENED");
    const normalized = stripQuery(path);
    const exists = await pathExists(this.projectHandle, normalized);
    if (!exists) return null;

    const originalText = await this.readText(normalized);
    const stamp = nowStamp();
    const backupPath = joinPath(BACKUP_DIR, stamp, normalized);
    await this.writeText(backupPath, originalText, { skipBackup: true });

    return backupPath;
  }

  async backupFileIfExistsBinary(path) {
    if (!this.projectHandle) throw new Error("PROJECT_NOT_OPENED");
    const normalized = stripQuery(path);
    const exists = await pathExists(this.projectHandle, normalized);
    if (!exists) return null;

    const bytes = await this.readBinary(normalized);
    const stamp = nowStamp();
    const backupPath = joinPath(BACKUP_DIR, stamp, normalized);
    await this.writeBinary(backupPath, bytes, { skipBackup: true });

    return backupPath;
  }

  async writeText(path, content, options = {}) {
    if (!this.projectHandle) throw new Error("PROJECT_NOT_OPENED");
    const normalized = stripQuery(path);

    let backupPath = null;
    if (!options.skipBackup) {
      backupPath = await this.backupFileIfExistsText(normalized);
    }

    const { dir, fileName } = await getParentDirAndName(
      this.projectHandle,
      normalized,
      { create: true }
    );
    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    await writeWithHandle(fileHandle, String(content));

    return {
      path: normalized,
      backupPath,
    };
  }

  async writeBinary(path, data, options = {}) {
    if (!this.projectHandle) throw new Error("PROJECT_NOT_OPENED");
    const normalized = stripQuery(path);

    let backupPath = null;
    if (!options.skipBackup) {
      backupPath = await this.backupFileIfExistsBinary(normalized);
    }

    const { dir, fileName } = await getParentDirAndName(
      this.projectHandle,
      normalized,
      { create: true }
    );
    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    const chunk = data instanceof Uint8Array ? data : new Uint8Array(data);
    await writeWithHandle(fileHandle, chunk);

    return {
      path: normalized,
      backupPath,
    };
  }

  async writeJson(path, data, options = {}) {
    return this.writeText(path, `${JSON.stringify(data, null, 2)}\n`, options);
  }
}

export function createFileSystemAdapter() {
  return new FileSystemAdapter();
}
