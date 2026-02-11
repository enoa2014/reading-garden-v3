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

function renderErrorsPanel(state) {
  if (!state.errors?.length) return "";
  return `
    <section class="panel">
      <h3>Validation Issues</h3>
      <ul class="error-list">${state.errors.map((e) => `<li>${e}</li>`).join("")}</ul>
    </section>
  `;
}

export function renderDashboard(root, state) {
  if (!root) return;
  root.innerHTML = `
    ${renderStructurePanel(state)}
    ${renderErrorsPanel(state)}
    ${renderBooksPanel(state)}
  `;
}
