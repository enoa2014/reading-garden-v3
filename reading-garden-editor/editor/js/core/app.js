import { createFileSystemAdapter } from "./filesystem.js";
import { getState, setState, subscribe } from "./state.js";
import { validateBooksData, validateProjectStructure, validateErrorList } from "./validator.js";
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

function render() {
  const root = qs("#viewRoot");
  const state = getState();

  if (state.currentView === "dashboard") {
    renderDashboard(root, state);
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

async function loadBooks() {
  try {
    const booksData = await fs.readJson("data/books.json");
    const check = validateBooksData(booksData);
    return {
      books: Array.isArray(booksData?.books) ? booksData.books : [],
      errors: check.errors,
    };
  } catch (err) {
    return {
      books: [],
      errors: [`读取 books.json 失败：${err.message || String(err)}`],
    };
  }
}

async function openProjectFlow() {
  setStatus("Opening project...");

  try {
    const handle = await fs.openProject();
    setState({
      projectHandle: handle,
      projectName: handle?.name || "",
    });

    setStatus("Verifying project structure...");
    const structure = await fs.verifyStructure();
    const structureCheck = validateProjectStructure(structure);

    const allErrors = [...structureCheck.errors];
    let books = [];

    if (structureCheck.valid) {
      setStatus("Loading bookshelf...");
      const booksResult = await loadBooks();
      books = booksResult.books;
      allErrors.push(...booksResult.errors);
    }

    setState({
      structure,
      books,
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
      errors: [msg],
    });

    setNavEnabled(false);
    setStatus("Open failed");
  }

  render();
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
