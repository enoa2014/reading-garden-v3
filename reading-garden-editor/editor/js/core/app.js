import { createFileSystemAdapter } from "./filesystem.js";
import { getState, setState, subscribe } from "./state.js";
import {
  validateBooksData,
  validateProjectStructure,
  validateErrorList,
  validateNewBookInput,
} from "./validator.js";
import { sanitizeBookId } from "./path-resolver.js";
import { buildNewBookArtifacts } from "./book-template.js";
import { renderDashboard } from "../ui/dashboard.js";

const fs = createFileSystemAdapter();

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

async function collectBookHealth(books) {
  const health = [];

  for (const book of books) {
    const bookId = String(book?.id || "").trim();
    if (!bookId) continue;

    const registryPath = `data/${bookId}/registry.json`;
    // eslint-disable-next-line no-await-in-loop
    const registryExists = await fs.exists(registryPath);

    health.push({
      id: bookId,
      registryPath,
      registryExists,
    });
  }

  return health;
}

async function loadBooksAndHealth() {
  try {
    const booksData = await fs.readJson("data/books.json");
    const check = validateBooksData(booksData);
    const books = Array.isArray(booksData?.books) ? booksData.books : [];
    const health = await collectBookHealth(books);

    health
      .filter((item) => !item.registryExists)
      .forEach((item) => {
        check.errors.push(`书籍 ${item.id} 缺失 ${item.registryPath}`);
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
  setState({ busy: true, newBookFeedback: null });

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

  setState({ busy: true, newBookFeedback: null });
  setStatus("Creating new book...");

  try {
    await ensureDirWithTrack(`data/${artifacts.bookId}`);
    await ensureDirWithTrack(`assets/images/${artifacts.bookId}`);
    await ensureDirWithTrack(`assets/images/${artifacts.bookId}/covers`);

    await writeFileWithTrack(`data/${artifacts.bookId}/registry.json`, artifacts.registry, true);
    await writeFileWithTrack(`data/${artifacts.bookId}/chapters.json`, artifacts.chapters, true);
    await writeFileWithTrack(`assets/images/${artifacts.bookId}/covers/cover.svg`, artifacts.coverSvg, false);

    await fs.writeJson("data/books.json", { books: nextBooks });

    await refreshProjectData();

    setState({
      newBookFeedback: {
        type: "ok",
        message: `书籍已创建：${artifacts.bookId}`,
      },
    });

    setStatus("Book created");
  } catch (err) {
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
