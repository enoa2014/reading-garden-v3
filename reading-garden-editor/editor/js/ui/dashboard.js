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

  const broken = state.bookHealth.filter(
    (item) => !item.registryExists || (item.moduleIssues && item.moduleIssues.length)
  );

  if (!broken.length) {
    return `
      <section class="panel">
        <h3>Book Registry Health</h3>
        <p>所有书籍已通过基础健康检查。</p>
      </section>
    `;
  }

  return `
    <section class="panel">
      <h3>Book Registry Health</h3>
      <p>发现以下配置问题：</p>
      <ul class="error-list">
        ${broken
          .map((item) => {
            const registryIssue = item.registryExists ? "" : `<li>${item.id} -> 缺失 ${item.registryPath}</li>`;
            const moduleIssues = (item.moduleIssues || [])
              .map((msg) => `<li>${item.id} -> ${msg}</li>`)
              .join("");
            return `${registryIssue}${moduleIssues}`;
          })
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
      <p class="muted">创建最小可运行新书（支持阅读/人物/主题模块模板）。</p>
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
        <label class="checkbox-inline">
          <input name="includeCharacters" type="checkbox" checked ${busy} />
          包含人物模块模板
        </label>
        <label class="checkbox-inline">
          <input name="includeThemes" type="checkbox" checked ${busy} />
          包含主题模块模板
        </label>
        <div class="full actions-row">
          <button class="btn btn-primary" type="submit" ${busy}>${state.busy ? "Creating..." : "Create Book"}</button>
        </div>
      </form>
      ${feedback}
    </section>
  `;
}

function renderPackPanel(state) {
  if (!state.structure?.ok) return "";
  const busy = state.busy ? "disabled" : "";
  const options = state.books
    .map((book) => `<option value="${book.id}">${book.title} (${book.id})</option>`)
    .join("");

  const feedback = state.packFeedback
    ? `<p class="${state.packFeedback.type === "error" ? "error-text" : "ok-text"}">${state.packFeedback.message}</p>`
    : "";

  return `
    <section class="panel">
      <h3>Book Pack Exchange (rgbook)</h3>
      <p class="muted">导出单书为 <code>.rgbook.zip</code>，或从压缩包导入并合并到书架。</p>
      <form id="exportPackForm" class="form-grid">
        <label class="full">
          选择要导出的书籍
          <select name="bookId" ${busy}>${options}</select>
        </label>
        <div class="full actions-row">
          <button class="btn btn-primary" type="submit" ${busy}>Export rgbook</button>
        </div>
      </form>
      <form id="importPackForm" class="form-grid">
        <label class="full">
          选择要导入的文件
          <input name="packFile" type="file" accept=".zip,.rgbook.zip" ${busy} />
        </label>
        <label>
          冲突策略
          <select name="mergeStrategy" ${busy}>
            <option value="rename">rename (recommended)</option>
            <option value="overwrite">overwrite</option>
            <option value="skip">skip</option>
          </select>
        </label>
        <div class="actions-row">
          <button class="btn btn-primary" type="submit" ${busy}>Import rgbook</button>
        </div>
      </form>
      <hr />
      <h3>Site Publish Pack (rgsite)</h3>
      <p class="muted">导出可上传到 EdgeOne 的整站发布包 <code>.rgsite.zip</code>。</p>
      <form id="exportSiteForm" class="form-grid">
        <label class="checkbox-inline full">
          <input name="includeEditor" type="checkbox" ${busy} />
          包含 <code>reading-garden-editor</code> 子应用
        </label>
        <div class="full actions-row">
          <button class="btn btn-primary" type="submit" ${busy}>Export rgsite</button>
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
    ${renderPackPanel(state)}
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
        includeCharacters: fd.get("includeCharacters") === "on",
        includeThemes: fd.get("includeThemes") === "on",
      });
    });
  }

  const exportForm = root.querySelector("#exportPackForm");
  if (exportForm && handlers.onExportPack) {
    exportForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const fd = new FormData(exportForm);
      handlers.onExportPack(String(fd.get("bookId") || ""));
    });
  }

  const importForm = root.querySelector("#importPackForm");
  if (importForm && handlers.onImportPack) {
    importForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const fileInput = importForm.querySelector('input[name="packFile"]');
      const strategy = importForm.querySelector('select[name="mergeStrategy"]')?.value || "rename";
      const file = fileInput?.files?.[0];
      if (!file) {
        handlers.onImportPack(null, strategy);
        return;
      }
      handlers.onImportPack(file, strategy);
    });
  }

  const exportSiteForm = root.querySelector("#exportSiteForm");
  if (exportSiteForm && handlers.onExportSite) {
    exportSiteForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const fd = new FormData(exportSiteForm);
      handlers.onExportSite({
        includeEditor: fd.get("includeEditor") === "on",
      });
    });
  }
}
