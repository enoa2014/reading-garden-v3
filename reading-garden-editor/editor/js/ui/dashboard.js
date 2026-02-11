import { sanitizeBookId } from "../core/path-resolver.js";

function renderStructurePanel(state) {
  const missing = state.structure?.missing || [];
  const ok = state.structure?.ok;

  if (!state.projectHandle) {
    return `
      <section class="panel">
        <h2>Project Status</h2>
        <p class="empty">尚未打开项目目录。请点击右上角 <strong>Open Project</strong>。</p>
      </section>
    `;
  }

  if (!ok) {
    return `
      <section class="panel">
        <h2>Project Structure</h2>
        <p>项目结构不完整，缺失以下路径：</p>
        <ul class="error-list">${missing.map((m) => `<li>${m}</li>`).join("")}</ul>
      </section>
    `;
  }

  return `
    <section class="panel">
      <h2>Project Structure</h2>
      <p>结构校验通过。</p>
      <div class="meta-grid">
        <div class="meta-item">
          <div class="label">Project</div>
          <div>${state.projectName || "(unknown)"}</div>
        </div>
        <div class="meta-item">
          <div class="label">Books</div>
          <div>${state.books.length}</div>
        </div>
      </div>
    </section>
  `;
}

function renderBooksPanel(state) {
  if (!state.projectHandle) return "";

  if (!state.books.length) {
    return `
      <section class="panel">
        <h3>Bookshelf</h3>
        <p class="empty">未发现书籍数据，或 <code>data/books.json</code> 为空。</p>
      </section>
    `;
  }

  return `
    <section class="panel">
      <h3>Bookshelf</h3>
      <ul class="book-list">
        ${state.books
          .map(
            (book) => `
          <li>
            <span class="book-title">${book.title || "(untitled)"}</span>
            <span class="book-meta">id: ${book.id || "-"}</span>
            <span class="book-meta">page: ${book.page || "-"}</span>
          </li>
        `
          )
          .join("")}
      </ul>
    </section>
  `;
}

function renderBookHealthPanel(state) {
  if (!state.projectHandle || !state.bookHealth?.length) return "";

  const broken = state.bookHealth.filter((item) => !item.registryExists);
  if (!broken.length) {
    return `
      <section class="panel">
        <h3>Book Registry Health</h3>
        <p>所有书籍已检测到 <code>registry.json</code>。</p>
      </section>
    `;
  }

  return `
    <section class="panel">
      <h3>Book Registry Health</h3>
      <p>以下书籍缺少配置文件：</p>
      <ul class="error-list">
        ${broken
          .map((item) => `<li>${item.id} -> ${item.registryPath}</li>`)
          .join("")}
      </ul>
    </section>
  `;
}

function renderNewBookPanel(state) {
  if (!state.structure?.ok) return "";

  const busy = state.busy ? "disabled" : "";
  const feedback = state.newBookFeedback
    ? `<p class="${state.newBookFeedback.type === "error" ? "error-text" : "ok-text"}">${state.newBookFeedback.message}</p>`
    : "";

  return `
    <section class="panel">
      <h3>Create New Book</h3>
      <p class="muted">创建一本最小可运行新书（含默认阅读模块与占位封面）。</p>
      <form id="newBookForm" class="form-grid">
        <label>
          书名
          <input id="newBookTitle" name="title" type="text" placeholder="例如：我的第一本书" required ${busy} />
        </label>
        <label>
          书籍 ID
          <input id="newBookId" name="id" type="text" placeholder="my-first-book" pattern="[a-z0-9-]+" required ${busy} />
        </label>
        <label>
          作者
          <input name="author" type="text" placeholder="作者名" ${busy} />
        </label>
        <label class="full">
          简介
          <textarea name="description" rows="3" placeholder="简要介绍这本书" ${busy}></textarea>
        </label>
        <div class="full actions-row">
          <button class="btn btn-primary" type="submit" ${busy}>${state.busy ? "Creating..." : "Create Book"}</button>
        </div>
      </form>
      ${feedback}
    </section>
  `;
}

function renderErrorsPanel(state) {
  if (!state.errors?.length) return "";
  return `
    <section class="panel">
      <h3>Validation Issues</h3>
      <ul class="error-list">${state.errors.map((e) => `<li>${e}</li>`).join("")}</ul>
    </section>
  `;
}

export function renderDashboard(root, state, handlers = {}) {
  if (!root) return;
  root.innerHTML = `
    ${renderStructurePanel(state)}
    ${renderNewBookPanel(state)}
    ${renderBookHealthPanel(state)}
    ${renderErrorsPanel(state)}
    ${renderBooksPanel(state)}
  `;

  const form = root.querySelector("#newBookForm");
  if (form && handlers.onCreateBook) {
    const idInput = root.querySelector("#newBookId");
    const titleInput = root.querySelector("#newBookTitle");

    titleInput?.addEventListener("input", () => {
      if (!idInput) return;
      if (idInput.dataset.touched === "1") return;
      idInput.value = sanitizeBookId(titleInput.value);
    });

    idInput?.addEventListener("input", () => {
      idInput.dataset.touched = "1";
      idInput.value = sanitizeBookId(idInput.value);
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const fd = new FormData(form);
      handlers.onCreateBook({
        id: String(fd.get("id") || ""),
        title: String(fd.get("title") || ""),
        author: String(fd.get("author") || ""),
        description: String(fd.get("description") || ""),
      });
    });
  }
}
