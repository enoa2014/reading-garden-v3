import { sanitizeBookId } from "../core/path-resolver.js";

const DEFAULT_CUSTOM_REDACTION_FIELDS = "project.name,input.fileName";
const CUSTOM_REDACTION_TEMPLATES_KEY = "rg.editor.customRedactionTemplates";
const MAX_CUSTOM_REDACTION_TEMPLATES = 5;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeCustomRedactionFields(rawValue) {
  const seen = new Set();
  const fields = String(rawValue || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    });
  return fields.join(",");
}

function readCustomRedactionTemplates() {
  try {
    const raw = window.localStorage.getItem(CUSTOM_REDACTION_TEMPLATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeCustomRedactionFields(item))
      .filter(Boolean)
      .slice(0, MAX_CUSTOM_REDACTION_TEMPLATES);
  } catch (err) {
    return [];
  }
}

function writeCustomRedactionTemplates(list) {
  try {
    window.localStorage.setItem(
      CUSTOM_REDACTION_TEMPLATES_KEY,
      JSON.stringify(list.slice(0, MAX_CUSTOM_REDACTION_TEMPLATES))
    );
  } catch (err) {
    // ignore storage errors in private mode or blocked storage contexts
  }
}

function rememberCustomRedactionTemplate(rawValue) {
  const normalized = normalizeCustomRedactionFields(rawValue);
  if (!normalized) return readCustomRedactionTemplates();
  const deduped = readCustomRedactionTemplates().filter((item) => item !== normalized);
  const next = [normalized, ...deduped].slice(0, MAX_CUSTOM_REDACTION_TEMPLATES);
  writeCustomRedactionTemplates(next);
  return next;
}

function clearCustomRedactionTemplates() {
  const existing = readCustomRedactionTemplates();
  writeCustomRedactionTemplates([]);
  return existing.length;
}

function buildTemplatesDownloadName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `redaction-templates-${stamp}.json`;
}

function downloadCustomRedactionTemplates() {
  const templates = readCustomRedactionTemplates();
  const payload = {
    format: "rg-redaction-templates",
    version: 1,
    exportedAt: new Date().toISOString(),
    templates,
  };
  const text = `${JSON.stringify(payload, null, 2)}\n`;
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = buildTemplatesDownloadName();
  link.click();
  URL.revokeObjectURL(url);
  return templates.length;
}

function parseImportedTemplatePayload(parsed) {
  if (!parsed || typeof parsed !== "object") return [];
  const rawTemplates = Array.isArray(parsed.templates) ? parsed.templates : [];
  const deduped = [];
  const seen = new Set();
  rawTemplates.forEach((item) => {
    const normalized = normalizeCustomRedactionFields(item);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    deduped.push(normalized);
  });
  return deduped.slice(0, MAX_CUSTOM_REDACTION_TEMPLATES);
}

function buildTemplateImportPlan(importedTemplates, mode = "replace") {
  const normalizedMode = mode === "merge" ? "merge" : "replace";
  const current = readCustomRedactionTemplates();
  const merged = normalizedMode === "merge"
    ? [...current, ...importedTemplates]
    : importedTemplates;
  const deduped = [];
  const seen = new Set();
  merged.forEach((item) => {
    const normalized = normalizeCustomRedactionFields(item);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    deduped.push(normalized);
  });
  const templates = deduped.slice(0, MAX_CUSTOM_REDACTION_TEMPLATES);
  const currentSet = new Set(current);
  const nextSet = new Set(templates);
  const addedTemplates = templates.filter((item) => !currentSet.has(item));
  const removedTemplates = current.filter((item) => !nextSet.has(item));
  const unchangedTemplates = templates.filter((item) => currentSet.has(item));
  return {
    mode: normalizedMode,
    current,
    templates,
    addedTemplates,
    removedTemplates,
    unchangedTemplates,
    addedCount: addedTemplates.length,
    removedCount: removedTemplates.length,
    unchangedCount: unchangedTemplates.length,
    truncated: deduped.length > MAX_CUSTOM_REDACTION_TEMPLATES,
  };
}

async function previewCustomRedactionTemplates(file, mode = "replace") {
  if (!file) {
    return {
      ok: false,
      error: "未选择模板文件。",
    };
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const imported = parseImportedTemplatePayload(parsed);
    const plan = buildTemplateImportPlan(imported, mode);
    return {
      ok: true,
      mode: plan.mode,
      currentCount: plan.current.length,
      importedCount: imported.length,
      nextCount: plan.templates.length,
      addedCount: plan.addedCount,
      removedCount: plan.removedCount,
      unchangedCount: plan.unchangedCount,
      addedTemplates: plan.addedTemplates,
      removedTemplates: plan.removedTemplates,
      truncated: plan.truncated,
    };
  } catch (err) {
    return {
      ok: false,
      error: `预览模板失败：${err?.message || String(err)}`,
    };
  }
}

async function importCustomRedactionTemplates(file, mode = "replace") {
  if (!file) {
    return {
      ok: false,
      error: "未选择模板文件。",
    };
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const imported = parseImportedTemplatePayload(parsed);
    const plan = buildTemplateImportPlan(imported, mode);
    writeCustomRedactionTemplates(plan.templates);
    return {
      ok: true,
      count: plan.templates.length,
      templates: plan.templates,
      mode: plan.mode,
      currentCount: plan.current.length,
      importedCount: imported.length,
      addedCount: plan.addedCount,
      removedCount: plan.removedCount,
      unchangedCount: plan.unchangedCount,
      addedTemplates: plan.addedTemplates,
      removedTemplates: plan.removedTemplates,
      truncated: plan.truncated,
    };
  } catch (err) {
    return {
      ok: false,
      error: `导入模板失败：${err?.message || String(err)}`,
    };
  }
}

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
  const templates = readCustomRedactionTemplates();
  const customRedactionValue = normalizeCustomRedactionFields(
    templates[0] || DEFAULT_CUSTOM_REDACTION_FIELDS
  );
  const templateOptions = templates
    .map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`)
    .join("");
  const clearDisabled = state.busy || !templates.length ? "disabled" : "";
  const templateTools = `
    <label class="full">
      最近使用模板
      <select name="recentRedactionTemplate" class="diag-input" ${busy}>
        <option value="">请选择历史模板</option>
        ${templateOptions}
      </select>
    </label>
    <div class="actions-row">
      <button class="btn btn-secondary clear-redaction-templates-btn" type="button" ${clearDisabled}>Clear Recent Templates</button>
      <button class="btn btn-secondary export-redaction-templates-btn" type="button" ${busy}>Export Templates</button>
      <button class="btn btn-secondary preview-redaction-templates-btn" type="button" ${busy}>Preview Import</button>
      <button class="btn btn-secondary import-redaction-templates-btn" type="button" ${busy}>Import Templates</button>
      <input class="preview-redaction-templates-input" type="file" accept=".json,application/json" hidden ${busy} />
      <input class="import-redaction-templates-input" type="file" accept=".json,application/json" hidden ${busy} />
    </div>
    <label class="full">
      模板导入模式
      <select name="importTemplateMode" class="diag-input" ${busy}>
        <option value="replace">replace（覆盖本地）</option>
        <option value="merge">merge（合并去重）</option>
      </select>
    </label>
  `;

  const feedback = state.packFeedback
    ? `<p class="${state.packFeedback.type === "error" ? "error-text" : "ok-text"}">${state.packFeedback.message}</p>`
    : "";

  const diagnostic = state.packDiagnostic
    ? `
      <div class="diag-box">
        <div class="diag-title">导入失败诊断可用</div>
        <p class="muted">包含错误码、文件信息与建议，可用于问题复现与排查。</p>
        <label class="full">
          自定义脱敏字段（逗号分隔）
          <input
            name="customRedactionFields"
            class="diag-input"
            type="text"
            value="${escapeHtml(customRedactionValue)}"
            placeholder="例如：project.name,input.fileName,error.stack"
            ${busy}
          />
        </label>
        ${templateTools}
        <div class="actions-row">
          <button class="btn btn-secondary download-report-btn" data-mode="full" type="button" ${busy}>Download Report</button>
          <button class="btn btn-secondary download-report-btn" data-mode="redacted" type="button" ${busy}>Download Redacted</button>
          <button class="btn btn-secondary download-report-btn" data-mode="custom" type="button" ${busy}>Download Custom</button>
        </div>
      </div>
    `
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
        <label>
          导出范围
          <select name="siteScope" ${busy}>
            <option value="all">全部书籍（full）</option>
            <option value="selected">仅选中书籍（subset）</option>
          </select>
        </label>
        <label class="full">
          选中书籍（用于 subset）
          <select name="selectedBooks" multiple size="6" ${busy}>
            ${options}
          </select>
        </label>
        <label>
          subset 资源策略
          <select name="subsetAssetMode" ${busy}>
            <option value="balanced">balanced（默认，兼顾兼容）</option>
            <option value="minimal">minimal（最小资源集）</option>
          </select>
        </label>
        <label>
          缺失资源回退
          <select name="missingAssetFallbackMode" ${busy}>
            <option value="report-only">report-only（仅报告缺失）</option>
            <option value="svg-placeholder">svg-placeholder（缺失 SVG 自动占位）</option>
          </select>
        </label>
        <div class="full actions-row">
          <button class="btn btn-primary" type="submit" ${busy}>Export rgsite</button>
        </div>
      </form>
      ${feedback}
      ${diagnostic}
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
      const selectedEl = exportSiteForm.querySelector('select[name="selectedBooks"]');
      const selectedBookIds = selectedEl
        ? Array.from(selectedEl.selectedOptions).map((item) => item.value)
        : [];
      handlers.onExportSite({
        includeEditor: fd.get("includeEditor") === "on",
        scope: String(fd.get("siteScope") || "all"),
        selectedBookIds,
        subsetAssetMode: String(fd.get("subsetAssetMode") || "balanced"),
        missingAssetFallbackMode: String(fd.get("missingAssetFallbackMode") || "report-only"),
      });
    });
  }

  const reportButtons = root.querySelectorAll(".download-report-btn");
  if (reportButtons.length && handlers.onDownloadImportReport) {
    const customInput = root.querySelector('input[name="customRedactionFields"]');
    const templateSelect = root.querySelector('select[name="recentRedactionTemplate"]');
    const clearTemplatesBtn = root.querySelector(".clear-redaction-templates-btn");
    const exportTemplatesBtn = root.querySelector(".export-redaction-templates-btn");
    const previewTemplatesBtn = root.querySelector(".preview-redaction-templates-btn");
    const previewTemplatesInput = root.querySelector(".preview-redaction-templates-input");
    const importTemplatesBtn = root.querySelector(".import-redaction-templates-btn");
    const importTemplatesInput = root.querySelector(".import-redaction-templates-input");
    const importTemplateModeEl = root.querySelector('select[name="importTemplateMode"]');

    customInput?.addEventListener("blur", () => {
      const normalized = normalizeCustomRedactionFields(customInput.value);
      customInput.value = normalized;
    });

    templateSelect?.addEventListener("change", () => {
      const selected = normalizeCustomRedactionFields(templateSelect.value);
      if (!selected || !customInput) return;
      customInput.value = selected;
    });

    clearTemplatesBtn?.addEventListener("click", () => {
      const removedCount = clearCustomRedactionTemplates();
      if (customInput) {
        customInput.value = DEFAULT_CUSTOM_REDACTION_FIELDS;
      }
      if (templateSelect) {
        templateSelect.innerHTML = '<option value="">请选择历史模板</option>';
      }
      clearTemplatesBtn.disabled = true;
      if (handlers.onClearRedactionTemplates) {
        handlers.onClearRedactionTemplates(removedCount);
      }
    });

    exportTemplatesBtn?.addEventListener("click", () => {
      const count = downloadCustomRedactionTemplates();
      if (handlers.onExportRedactionTemplates) {
        handlers.onExportRedactionTemplates(count);
      }
    });

    importTemplatesBtn?.addEventListener("click", () => {
      importTemplatesInput?.click();
    });

    previewTemplatesBtn?.addEventListener("click", () => {
      previewTemplatesInput?.click();
    });

    previewTemplatesInput?.addEventListener("change", async () => {
      const file = previewTemplatesInput.files?.[0];
      const importTemplateMode = String(importTemplateModeEl?.value || "replace");
      const result = await previewCustomRedactionTemplates(file, importTemplateMode);
      if (previewTemplatesInput) {
        previewTemplatesInput.value = "";
      }
      if (handlers.onPreviewRedactionTemplates) {
        handlers.onPreviewRedactionTemplates(result);
      }
    });

    importTemplatesInput?.addEventListener("change", async () => {
      const file = importTemplatesInput.files?.[0];
      const importTemplateMode = String(importTemplateModeEl?.value || "replace");
      const result = await importCustomRedactionTemplates(file, importTemplateMode);
      if (importTemplatesInput) {
        importTemplatesInput.value = "";
      }

      if (result.ok) {
        const nextTemplates = readCustomRedactionTemplates();
        if (templateSelect) {
          const nextOptions = nextTemplates
            .map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`)
            .join("");
          templateSelect.innerHTML = `
            <option value="">请选择历史模板</option>
            ${nextOptions}
          `;
        }
        if (customInput) {
          customInput.value = nextTemplates[0] || DEFAULT_CUSTOM_REDACTION_FIELDS;
        }
        if (clearTemplatesBtn) {
          clearTemplatesBtn.disabled = nextTemplates.length === 0;
        }
      }

      if (handlers.onImportRedactionTemplates) {
        handlers.onImportRedactionTemplates(result);
      }
    });

    reportButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.mode || "full";
        const rawFields = String(customInput?.value || "");
        const normalizedRaw = normalizeCustomRedactionFields(rawFields);
        if (customInput) customInput.value = normalizedRaw;
        if (mode === "custom") {
          rememberCustomRedactionTemplate(normalizedRaw);
        }
        const customFields = normalizedRaw
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        handlers.onDownloadImportReport(mode, customFields);
      });
    });
  }
}
