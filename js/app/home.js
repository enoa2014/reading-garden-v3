import { icon } from "../core/icons.js";
import { escapeHtml } from "../core/dom.js";
import { getJSON, key } from "../core/storage.js";

function setTheme(next) {
  const normalized = next === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", normalized);
  try {
    localStorage.setItem(key("theme"), normalized);
  } catch {
    // ignore
  }
  const iconHost = document.getElementById("globalThemeIcon");
  if (iconHost) iconHost.innerHTML = normalized === "dark" ? icon("moon") : icon("sun");
}

function getTheme() {
  try {
    return localStorage.getItem(key("theme")) || document.documentElement.getAttribute("data-theme") || "light";
  } catch {
    return document.documentElement.getAttribute("data-theme") || "light";
  }
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed: ${res.status} ${url}`);
  return await res.json();
}

function normalizeReadingItems(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.chapters)) return data.chapters;
  if (data && Array.isArray(data.paragraphs)) return data.paragraphs;
  return [];
}

async function getReadingCount(bookId) {
  try {
    const registry = await fetchJSON(`data/${encodeURIComponent(bookId)}/registry.json`);
    const reading = Array.isArray(registry?.modules)
      ? registry.modules.find((m) => m && m.id === "reading")
      : null;
    const dataFile = String(reading?.data || "chapters.json");
    const data = await fetchJSON(`data/${encodeURIComponent(bookId)}/${dataFile}`);
    return normalizeReadingItems(data).length || 0;
  } catch {
    return 0;
  }
}

function progressKey(bookId) {
  return key(["progress", bookId]);
}

function renderFeatured(container, books, progressByBook) {
  container.innerHTML = "";
  books.forEach((book) => {
    const bookId = String(book.id || "").trim();
    const progress = progressByBook.get(bookId) || { percent: 0, label: "未开始" };
    const href = `book.html?book=${encodeURIComponent(bookId)}`;

    const card = document.createElement("a");
    card.className = "rg-bookcard";
    card.href = href;
    if (bookId) card.dataset.book = bookId;

    card.innerHTML = `
      <div class="rg-bookcard__cover" aria-hidden="true">
        <img src="${escapeHtml(String(book.cover || ""))}" alt="${escapeHtml(String(book.title || ""))}" loading="lazy" />
      </div>
      <div class="rg-bookcard__meta">
        <div>
          <h3 class="rg-bookcard__title">${escapeHtml(String(book.title || "未命名"))}</h3>
          <p class="rg-bookcard__desc">${escapeHtml(String(book.description || ""))}</p>
        </div>
        <div class="rg-badges">
          ${(Array.isArray(book.tags) ? book.tags : []).slice(0, 4).map((t) => `<span class="rg-badge">#${escapeHtml(String(t))}</span>`).join("")}
        </div>
        <div class="rg-bookcard__progress">
          <div class="rg-bookcard__progressline">
            <span>${escapeHtml(progress.label)}</span>
            <span>${Math.round(progress.percent * 100)}%</span>
          </div>
          <div class="rg-progress" aria-hidden="true"><div class="rg-progress__bar" style="width:${Math.round(progress.percent * 100)}%"></div></div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderShelf(container, books) {
  container.innerHTML = "";
  books.forEach((book) => {
    const bookId = String(book.id || "").trim();
    const href = `book.html?book=${encodeURIComponent(bookId)}`;

    const a = document.createElement("a");
    a.className = "rg-spine";
    a.href = href;
    a.innerHTML = `
      <div class="rg-spine__img" aria-hidden="true">
        <img src="${escapeHtml(String(book.cover || ""))}" alt="${escapeHtml(String(book.title || ""))}" loading="lazy" />
      </div>
      <div class="rg-spine__label">${escapeHtml(String(book.title || ""))}</div>
    `;
    container.appendChild(a);
  });
}

function filterBooks(books, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return books;
  return books.filter((b) => {
    const title = String(b?.title || "").toLowerCase();
    const author = String(b?.author || "").toLowerCase();
    const tags = Array.isArray(b?.tags) ? b.tags.join(" ").toLowerCase() : "";
    return title.includes(q) || author.includes(q) || tags.includes(q);
  });
}

async function main() {
  const searchIcon = document.getElementById("homeSearchIcon");
  if (searchIcon) searchIcon.innerHTML = icon("search");

  setTheme(getTheme());
  document.getElementById("globalThemeToggle")?.addEventListener("click", () => {
    setTheme(getTheme() === "dark" ? "light" : "dark");
  });

  const featuredGrid = document.getElementById("featuredGrid");
  const shelfSpines = document.getElementById("shelfSpines");
  const input = document.getElementById("homeSearchInput");
  if (!featuredGrid || !shelfSpines) return;

  let books = [];
  try {
    const payload = await fetchJSON("data/books.json");
    books = Array.isArray(payload?.books) ? payload.books : [];
  } catch (e) {
    console.error(e);
    featuredGrid.innerHTML = '<div class="rg-skeleton">无法加载书单，请检查 data/books.json</div>';
    shelfSpines.innerHTML = '<div class="rg-skeleton">无法加载书架</div>';
    return;
  }

  const counts = await Promise.all(books.map((b) => getReadingCount(String(b.id || ""))));
  const progressByBook = new Map();
  books.forEach((b, i) => {
    const bookId = String(b.id || "").trim();
    const total = counts[i] || 0;
    const saved = getJSON(progressKey(bookId), null);
    const currentIndex = Number(saved?.currentIndex ?? -1);
    const percent = total > 0 && currentIndex >= 0 ? Math.min(1, (currentIndex + 1) / total) : 0;
    const label = total > 0 && currentIndex >= 0 ? `进度：${currentIndex + 1}/${total}` : "未开始";
    progressByBook.set(bookId, { percent, label });
  });

  function render(query = "") {
    const filtered = filterBooks(books, query);
    if (!filtered.length) {
      featuredGrid.innerHTML = '<div class="rg-skeleton">没有匹配的书籍</div>';
      shelfSpines.innerHTML = '<div class="rg-skeleton">没有匹配的书籍</div>';
      return;
    }
    renderFeatured(featuredGrid, filtered, progressByBook);
    renderShelf(shelfSpines, filtered);
  }

  render("");

  let timer = null;
  input?.addEventListener("input", () => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => render(input.value), 120);
  });
}

main().catch((e) => console.error(e));
