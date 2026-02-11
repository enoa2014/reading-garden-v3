import { createFileSystemAdapter } from "./filesystem.js";
import { getState, setState, subscribe } from "./state.js";
import {
  validateBooksData,
  validateProjectStructure,
  validateErrorList,
  validateNewBookInput,
} from "./validator.js";
import { normalizePath, sanitizeBookId } from "./path-resolver.js";
import { buildNewBookArtifacts } from "./book-template.js";
import { renderDashboard } from "../ui/dashboard.js";
import { ImportMergeService } from "../packaging/import-merge-service.js";
import { BookPackService } from "../packaging/book-pack-service.js";
import { SitePackService } from "../packaging/site-pack-service.js";

const fs = createFileSystemAdapter();
const mergeService = new ImportMergeService();
const bookPackService = new BookPackService({ fs, mergeService });
const sitePackService = new SitePackService({ fs });

function qs(sel) {
  return document.querySelector(sel);
}

function setStatus(text) {
  const el = qs("#statusText");
  if (el) el.textContent = text;
}

function setMode(mode) {
  setState({ mode });
  const badge = qs("#modeBadge");
  if (badge) badge.textContent = `Mode: ${mode}`;
}

function syncButtons() {
  const state = getState();
  const openBtn = qs("#openProjectBtn");
  if (openBtn) openBtn.disabled = state.busy;
}

function render() {
  const root = qs("#viewRoot");
  const state = getState();

  syncButtons();

  if (state.currentView === "dashboard") {
    renderDashboard(root, state, {
      onCreateBook: createBookFlow,
      onExportPack: exportPackFlow,
      onImportPack: importPackFlow,
      onExportSite: exportSiteFlow,
      onDownloadImportReport: downloadImportReportFlow,
    });
    return;
  }

  root.innerHTML = `
    <section class="panel">
      <h2>Coming Soon</h2>
      <p>当前视图将在后续 Sprint 实现。</p>
    </section>
  `;
}

function bindNav() {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      if (!view) return;

      document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
      btn.classList.add("active");
      setState({ currentView: view });
      render();
    });
  });
}

function setNavEnabled(enabled) {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    const view = btn.dataset.view;
    if (view === "dashboard") return;
    btn.disabled = !enabled;
  });
}

function resolveFromBookDir(bookId, relativePath) {
  return normalizePath(`data/${bookId}/${String(relativePath || "")}`);
}

async function inspectBookHealth(book) {
  const id = String(book?.id || "").trim();
  const registryPath = `data/${id}/registry.json`;
  const registryExists = await fs.exists(registryPath);
  const moduleIssues = [];

  if (registryExists) {
    try {
      const registry = await fs.readJson(registryPath);
      const modules = Array.isArray(registry?.modules) ? registry.modules : [];

      if (!modules.length) {
        moduleIssues.push("registry.modules 为空");
      }

      for (const mod of modules) {
        const modId = String(mod?.id || "(unknown)");
        const entryRaw = String(mod?.entry || "").trim();
        const dataRaw = String(mod?.data || "").trim();

        if (!entryRaw) {
          moduleIssues.push(`模块 ${modId} 缺失 entry 配置`);
          continue;
        }
        if (!dataRaw) {
          moduleIssues.push(`模块 ${modId} 缺失 data 配置`);
          continue;
        }

        const entryPath = resolveFromBookDir(id, entryRaw);
        const dataPath = resolveFromBookDir(id, dataRaw);

        // eslint-disable-next-line no-await-in-loop
        const entryExists = await fs.exists(entryPath);
        // eslint-disable-next-line no-await-in-loop
        const dataExists = await fs.exists(dataPath);

        if (!entryExists) moduleIssues.push(`模块 ${modId} 缺失 entry: ${entryPath}`);
        if (!dataExists) moduleIssues.push(`模块 ${modId} 缺失 data: ${dataPath}`);
      }
    } catch (err) {
      moduleIssues.push(`registry 解析失败：${err?.message || String(err)}`);
    }
  }

  return {
    id,
    registryPath,
    registryExists,
    moduleIssues,
  };
}

async function collectBookHealth(books) {
  const health = [];
  for (const book of books) {
    const id = String(book?.id || "").trim();
    if (!id) continue;
    // eslint-disable-next-line no-await-in-loop
    health.push(await inspectBookHealth(book));
  }
  return health;
}

async function loadBooksAndHealth() {
  try {
    const booksData = await fs.readJson("data/books.json");
    const check = validateBooksData(booksData);
    const books = Array.isArray(booksData?.books) ? booksData.books : [];
    const health = await collectBookHealth(books);

    health.forEach((item) => {
      if (!item.registryExists) {
        check.errors.push(`书籍 ${item.id} 缺失 ${item.registryPath}`);
      }
      item.moduleIssues.forEach((msg) => {
        check.errors.push(`书籍 ${item.id} -> ${msg}`);
      });
    });

    return {
      books,
      bookHealth: health,
      errors: check.errors,
    };
  } catch (err) {
    return {
      books: [],
      bookHealth: [],
      errors: [`读取 books.json 失败：${err.message || String(err)}`],
    };
  }
}

async function refreshProjectData() {
  const booksResult = await loadBooksAndHealth();
  setState({
    books: booksResult.books,
    bookHealth: booksResult.bookHealth,
    errors: validateErrorList(booksResult.errors),
  });
}

async function openProjectFlow() {
  setStatus("Opening project...");
  setState({ busy: true, newBookFeedback: null, packFeedback: null, packDiagnostic: null });

  try {
    const handle = await fs.openProject();
    setState({
      projectHandle: handle,
      projectName: handle?.name || "",
    });

    setStatus("Verifying project structure...");
    const structure = await fs.verifyStructure();
    const structureCheck = validateProjectStructure(structure);
    setState({ structure });

    const allErrors = [...structureCheck.errors];

    if (structureCheck.valid) {
      setStatus("Loading bookshelf...");
      const booksResult = await loadBooksAndHealth();
      allErrors.push(...booksResult.errors);
      setState({
        books: booksResult.books,
        bookHealth: booksResult.bookHealth,
      });
    } else {
      setState({ books: [], bookHealth: [] });
    }

    setState({
      errors: validateErrorList(allErrors),
    });

    setNavEnabled(structureCheck.valid);
    setStatus(structureCheck.valid ? "Project loaded" : "Project loaded with issues");
  } catch (err) {
    const msg = err?.message === "BROWSER_UNSUPPORTED"
      ? "当前浏览器不支持 File System Access API"
      : `打开项目失败：${err?.message || String(err)}`;

    setState({
      projectHandle: null,
      projectName: "",
      structure: { ok: false, missing: [] },
      books: [],
      bookHealth: [],
      errors: [msg],
    });

    setNavEnabled(false);
    setStatus("Open failed");
  }

  setState({ busy: false });
  render();
}

async function createBookFlow(rawInput) {
  const state = getState();
  if (!state.projectHandle || !state.structure?.ok) return;

  const normalizedInput = {
    ...rawInput,
    id: sanitizeBookId(rawInput?.id || rawInput?.title),
  };

  const inputCheck = validateNewBookInput(normalizedInput, state.books);
  if (!inputCheck.valid) {
    setState({
      newBookFeedback: {
        type: "error",
        message: inputCheck.errors.join("；"),
      },
    });
    return;
  }

  const artifacts = buildNewBookArtifacts(normalizedInput);
  const nextBooks = [...state.books, artifacts.booksItem];

  const createdPaths = [];
  let booksWriteResult = null;

  const ensureDirWithTrack = async (path) => {
    const exists = await fs.exists(path);
    if (!exists) {
      await fs.ensureDirectory(path);
      createdPaths.push({ path, recursive: true });
    }
  };

  const writeFileWithTrack = async (path, content, isJson = false) => {
    const existed = await fs.exists(path);
    if (isJson) {
      await fs.writeJson(path, content);
    } else {
      await fs.writeText(path, content);
    }
    if (!existed) createdPaths.push({ path, recursive: false });
  };

  setState({ busy: true, newBookFeedback: null, packFeedback: null, packDiagnostic: null });
  setStatus("Creating new book...");

  try {
    await ensureDirWithTrack(`data/${artifacts.bookId}`);
    await ensureDirWithTrack(`assets/images/${artifacts.bookId}`);
    await ensureDirWithTrack(`assets/images/${artifacts.bookId}/covers`);

    await writeFileWithTrack(`data/${artifacts.bookId}/registry.json`, artifacts.registry, true);
    await writeFileWithTrack(`data/${artifacts.bookId}/chapters.json`, artifacts.chapters, true);
    await writeFileWithTrack(`assets/images/${artifacts.bookId}/covers/cover.svg`, artifacts.coverSvg, false);

    if (artifacts.includeCharacters) {
      await ensureDirWithTrack(`assets/images/${artifacts.bookId}/characters`);
      await writeFileWithTrack(`data/${artifacts.bookId}/characters.json`, artifacts.characters, true);
      await writeFileWithTrack(
        `assets/images/${artifacts.bookId}/characters/protagonist.svg`,
        artifacts.protagonistSvg,
        false
      );
    }

    if (artifacts.includeThemes) {
      await writeFileWithTrack(`data/${artifacts.bookId}/themes.json`, artifacts.themes, true);
    }

    booksWriteResult = await fs.writeJson("data/books.json", { books: nextBooks });

    await refreshProjectData();

    setState({
      newBookFeedback: {
        type: "ok",
        message: `书籍已创建：${artifacts.bookId}`,
      },
    });

    setStatus("Book created");
  } catch (err) {
    if (booksWriteResult?.backupPath) {
      try {
        const backupText = await fs.readText(booksWriteResult.backupPath);
        await fs.writeText("data/books.json", backupText, { skipBackup: true });
      } catch {
        // best-effort restore
      }
    }

    for (let i = createdPaths.length - 1; i >= 0; i -= 1) {
      const item = createdPaths[i];
      try {
        // eslint-disable-next-line no-await-in-loop
        await fs.deletePath(item.path, { recursive: item.recursive });
      } catch {
        // keep best-effort rollback
      }
    }

    setState({
      newBookFeedback: {
        type: "error",
        message: `创建失败，已尝试回滚：${err?.message || String(err)}`,
      },
    });
    setStatus("Create failed");
  }

  setState({ busy: false });
}

async function exportPackFlow(bookId) {
  if (!bookId) {
    setState({
      packFeedback: {
        type: "error",
        message: "请选择要导出的书籍。",
      },
    });
    return;
  }

  setState({ busy: true, packFeedback: null, packDiagnostic: null });
  setStatus("Exporting rgbook...");

  try {
    const state = getState();
    const result = await bookPackService.exportBookPack({
      bookId,
      books: state.books,
    });

    setState({
      packFeedback: {
        type: "ok",
        message: `导出成功：${result.filename}（data ${result.dataFiles}，assets ${result.assets}，checksum ${result.checksums}）`,
      },
    });
    setStatus("rgbook exported");
  } catch (err) {
    setState({
      packFeedback: {
        type: "error",
        message: `导出失败：${err?.message || String(err)}`,
      },
    });
    setStatus("Export failed");
  }

  setState({ busy: false });
}

async function importPackFlow(file, strategy) {
  if (!file) {
    setState({
      packFeedback: {
        type: "error",
        message: "请选择要导入的 rgbook 文件。",
      },
    });
    return;
  }

  setState({ busy: true, packFeedback: null, packDiagnostic: null });
  setStatus("Importing rgbook...");

  try {
    const state = getState();
    const result = await bookPackService.importBookPack({
      file,
      existingBooks: state.books,
      strategy,
    });

    await refreshProjectData();

    if (result.skipped) {
      setState({
        packFeedback: {
          type: "ok",
          message: "导入已跳过（skip 策略）。",
        },
        packDiagnostic: null,
      });
      setStatus("Import skipped");
    } else {
      setState({
        packFeedback: {
          type: "ok",
          message: `导入成功：${result.targetBookId}（${result.strategy}）`,
        },
        packDiagnostic: null,
      });
      setStatus("rgbook imported");
    }
  } catch (err) {
    const diagnostic = buildPackImportDiagnostic({
      file,
      strategy,
      error: err,
      mode: getState().mode,
      projectName: getState().projectName,
    });
    setState({
      packFeedback: {
        type: "error",
        message: `导入失败：${err?.message || String(err)}（可下载诊断报告）`,
      },
      packDiagnostic: diagnostic,
    });
    setStatus("Import failed");
  }

  setState({ busy: false });
}

function inferErrorCode(err) {
  const message = String(err?.message || err || "UNKNOWN_ERROR");
  const direct = message.match(/\b[A-Z][A-Z0-9_]{3,}\b/);
  return direct ? direct[0] : "UNKNOWN_ERROR";
}

function buildPackImportDiagnostic({ file, strategy, error, mode, projectName }) {
  const now = new Date().toISOString();
  const fileName = file?.name || "(unknown)";
  const fileSize = Number(file?.size || 0);
  const errorMessage = String(error?.message || error || "UNKNOWN_ERROR");

  return {
    type: "rgbook-import-diagnostic",
    generatedAt: now,
    project: {
      name: projectName || "",
      mode: mode || "",
    },
    input: {
      fileName,
      fileSize,
      strategy: strategy || "rename",
    },
    error: {
      code: inferErrorCode(error),
      message: errorMessage,
      stack: String(error?.stack || "").slice(0, 4000),
    },
    hints: [
      "确认压缩包为本工具导出的 .rgbook.zip",
      "检查 manifest/checksum 是否被二次修改",
      "若为路径或大小限制错误，建议重新导出并避免手工改包",
    ],
  };
}

function buildRedactedDiagnostic(report) {
  if (!report) return null;
  return {
    ...report,
    project: {
      name: "***REDACTED***",
      mode: report?.project?.mode || "",
    },
    input: {
      ...report.input,
      fileName: "***REDACTED***",
      fileSize: Number(report?.input?.fileSize || 0),
      strategy: report?.input?.strategy || "rename",
    },
  };
}

function downloadDiagnosticReport(report, mode = "full") {
  if (!report) return;
  const stamp = String(report.generatedAt || new Date().toISOString()).replace(/[:.]/g, "-");
  const output = mode === "redacted" ? buildRedactedDiagnostic(report) : report;
  const suffix = mode === "redacted" ? "redacted" : "full";
  const filename = `rgbook-import-diagnostic-${suffix}-${stamp}.json`;
  const text = `${JSON.stringify(output, null, 2)}\n`;
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadImportReportFlow(mode = "full") {
  const state = getState();
  if (!state.packDiagnostic) {
    setState({
      packFeedback: {
        type: "error",
        message: "当前没有可导出的诊断报告。",
      },
    });
    return;
  }

  downloadDiagnosticReport(state.packDiagnostic, mode);
  const label = mode === "redacted" ? "脱敏诊断报告" : "完整诊断报告";
  setState({
    packFeedback: {
      type: "ok",
      message: `${label}已下载。`,
    },
  });
}

async function exportSiteFlow(options = {}) {
  const scope = String(options.scope || "all");
  const selectedBookIds = Array.isArray(options.selectedBookIds) ? options.selectedBookIds : [];
  const subsetAssetMode = String(options.subsetAssetMode || "balanced");
  if (scope === "selected" && !selectedBookIds.length) {
    setState({
      packFeedback: {
        type: "error",
        message: "请选择至少一本书用于子集导出。",
      },
    });
    return;
  }

  setState({ busy: true, packFeedback: null, packDiagnostic: null });
  setStatus("Exporting rgsite...");

  try {
    const result = await sitePackService.exportSitePack({
      includeEditor: Boolean(options.includeEditor),
      selectedBookIds: scope === "selected" ? selectedBookIds : [],
      subsetAssetMode: scope === "selected" ? subsetAssetMode : "balanced",
    });

    const scopeText = result.scope === "subset"
      ? `subset(${result.selectedBookIds.length}本/${result.subsetAssetMode})`
      : "full";
    const missingText = Array.isArray(result.missingAssets) && result.missingAssets.length
      ? `，missingAssets ${result.missingAssets.length}`
      : "";
    setState({
      packFeedback: {
        type: "ok",
        message: `发布包导出成功：${result.filename}（scope ${scopeText}，files ${result.files}，books ${result.books}${missingText}）`,
      },
    });
    setStatus("rgsite exported");
  } catch (err) {
    setState({
      packFeedback: {
        type: "error",
        message: `发布包导出失败：${err?.message || String(err)}`,
      },
    });
    setStatus("rgsite export failed");
  }

  setState({ busy: false });
}

function detectMode() {
  if ("showDirectoryPicker" in window) {
    setMode("native");
    return;
  }
  setMode("fallback");
  setState({
    errors: ["当前浏览器不支持原生目录读写。后续将提供 ZIP 降级模式。"],
  });
}

function boot() {
  bindNav();
  detectMode();

  const openBtn = qs("#openProjectBtn");
  openBtn?.addEventListener("click", openProjectFlow);

  subscribe("*", render);
  setNavEnabled(false);
  render();
}

boot();
