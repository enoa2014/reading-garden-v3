import { sanitizeBookId } from "../core/path-resolver.js";

const DEFAULT_CUSTOM_REDACTION_FIELDS = "project.name,input.fileName";
const CUSTOM_REDACTION_TEMPLATES_KEY = "rg.editor.customRedactionTemplates";
const MAX_CUSTOM_REDACTION_TEMPLATES = 5;
const NEW_BOOK_TEMPLATE_PRESETS_KEY = "rg.editor.newBookTemplatePresets";
const MAX_NEW_BOOK_TEMPLATE_PRESETS = 12;
const RECOVERY_HISTORY_MAX_AGE_DAY_OPTIONS = [
  { value: "0", label: "关闭自动清理" },
  { value: "7", label: "7 天" },
  { value: "30", label: "30 天（默认）" },
  { value: "90", label: "90 天" },
  { value: "180", label: "180 天" },
];
const NEW_BOOK_TEMPLATE_PRESETS = {
  minimal: {
    includeCharacters: false,
    includeThemes: false,
    includeTimeline: false,
    includeInteractive: false,
  },
  standard: {
    includeCharacters: true,
    includeThemes: true,
    includeTimeline: false,
    includeInteractive: false,
  },
  teaching: {
    includeCharacters: true,
    includeThemes: true,
    includeTimeline: true,
    includeInteractive: true,
  },
};

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

function normalizeNewBookTemplatePreset(rawValue = "standard") {
  const preset = String(rawValue || "standard").trim().toLowerCase();
  if (preset === "custom") return "custom";
  if (Object.prototype.hasOwnProperty.call(NEW_BOOK_TEMPLATE_PRESETS, preset)) {
    return preset;
  }
  return "standard";
}

function applyNewBookTemplatePreset(form, rawPreset = "standard") {
  const preset = normalizeNewBookTemplatePreset(rawPreset);
  if (preset === "custom") return;
  const flags = NEW_BOOK_TEMPLATE_PRESETS[preset];
  if (!flags) return;
  const includeCharacters = form.querySelector('input[name="includeCharacters"]');
  const includeThemes = form.querySelector('input[name="includeThemes"]');
  const includeTimeline = form.querySelector('input[name="includeTimeline"]');
  const includeInteractive = form.querySelector('input[name="includeInteractive"]');
  if (includeCharacters) includeCharacters.checked = Boolean(flags.includeCharacters);
  if (includeThemes) includeThemes.checked = Boolean(flags.includeThemes);
  if (includeTimeline) includeTimeline.checked = Boolean(flags.includeTimeline);
  if (includeInteractive) includeInteractive.checked = Boolean(flags.includeInteractive);
}

function matchesNewBookTemplatePreset(form, rawPreset = "standard") {
  const preset = normalizeNewBookTemplatePreset(rawPreset);
  const flags = NEW_BOOK_TEMPLATE_PRESETS[preset];
  if (!flags) return false;
  const includeCharacters = form.querySelector('input[name="includeCharacters"]');
  const includeThemes = form.querySelector('input[name="includeThemes"]');
  const includeTimeline = form.querySelector('input[name="includeTimeline"]');
  const includeInteractive = form.querySelector('input[name="includeInteractive"]');
  return (
    Boolean(includeCharacters?.checked) === Boolean(flags.includeCharacters)
    && Boolean(includeThemes?.checked) === Boolean(flags.includeThemes)
    && Boolean(includeTimeline?.checked) === Boolean(flags.includeTimeline)
    && Boolean(includeInteractive?.checked) === Boolean(flags.includeInteractive)
  );
}

function normalizeNewBookTemplatePresetName(rawValue = "") {
  return String(rawValue || "").trim().slice(0, 40);
}

function normalizeSavedNewBookTemplatePreset(rawPreset) {
  if (!rawPreset || typeof rawPreset !== "object") return null;
  const name = normalizeNewBookTemplatePresetName(rawPreset.name);
  if (!name) return null;
  return {
    name,
    includeCharacters: rawPreset.includeCharacters !== false,
    includeThemes: rawPreset.includeThemes !== false,
    includeTimeline: rawPreset.includeTimeline === true,
    includeInteractive: rawPreset.includeInteractive === true,
  };
}

function readSavedNewBookTemplatePresets() {
  try {
    const raw = window.localStorage.getItem(NEW_BOOK_TEMPLATE_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set();
    const out = [];
    parsed.forEach((item) => {
      const normalized = normalizeSavedNewBookTemplatePreset(item);
      if (!normalized || seen.has(normalized.name)) return;
      seen.add(normalized.name);
      out.push(normalized);
    });
    return out.slice(0, MAX_NEW_BOOK_TEMPLATE_PRESETS);
  } catch {
    return [];
  }
}

function writeSavedNewBookTemplatePresets(list) {
  const safeList = (Array.isArray(list) ? list : [])
    .map((item) => normalizeSavedNewBookTemplatePreset(item))
    .filter(Boolean)
    .slice(0, MAX_NEW_BOOK_TEMPLATE_PRESETS);
  try {
    window.localStorage.setItem(
      NEW_BOOK_TEMPLATE_PRESETS_KEY,
      JSON.stringify(safeList)
    );
  } catch {
    // ignore storage errors in private mode or blocked storage contexts
  }
  return safeList;
}

function upsertSavedNewBookTemplatePreset(rawPreset) {
  const normalized = normalizeSavedNewBookTemplatePreset(rawPreset);
  if (!normalized) {
    return {
      ok: false,
      error: "模板名称不能为空。",
      presets: readSavedNewBookTemplatePresets(),
    };
  }
  const current = readSavedNewBookTemplatePresets();
  const existed = current.some((item) => item.name === normalized.name);
  const deduped = current.filter((item) => item.name !== normalized.name);
  const next = writeSavedNewBookTemplatePresets([normalized, ...deduped]);
  return {
    ok: true,
    existed,
    preset: normalized,
    presets: next,
  };
}

function clearSavedNewBookTemplatePresets() {
  const existing = readSavedNewBookTemplatePresets();
  writeSavedNewBookTemplatePresets([]);
  return existing.length;
}

function applySavedNewBookTemplatePresetToForm(form, rawPreset) {
  const preset = normalizeSavedNewBookTemplatePreset(rawPreset);
  if (!preset || !form) return false;
  const includeCharacters = form.querySelector('input[name="includeCharacters"]');
  const includeThemes = form.querySelector('input[name="includeThemes"]');
  const includeTimeline = form.querySelector('input[name="includeTimeline"]');
  const includeInteractive = form.querySelector('input[name="includeInteractive"]');
  if (includeCharacters) includeCharacters.checked = Boolean(preset.includeCharacters);
  if (includeThemes) includeThemes.checked = Boolean(preset.includeThemes);
  if (includeTimeline) includeTimeline.checked = Boolean(preset.includeTimeline);
  if (includeInteractive) includeInteractive.checked = Boolean(preset.includeInteractive);
  const templateSelect = form.querySelector('select[name="templatePreset"]');
  if (templateSelect) templateSelect.value = "custom";
  return true;
}

function buildNewBookTemplatePresetsDownloadName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `new-book-template-presets-${stamp}.json`;
}

function exportSavedNewBookTemplatePresets() {
  const presets = readSavedNewBookTemplatePresets();
  const payload = {
    format: "rg-new-book-template-presets",
    version: 1,
    exportedAt: new Date().toISOString(),
    presets,
  };
  const text = `${JSON.stringify(payload, null, 2)}\n`;
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = buildNewBookTemplatePresetsDownloadName();
  link.click();
  URL.revokeObjectURL(url);
  return presets.length;
}

function parseImportedNewBookTemplatePresetPayload(parsed) {
  if (!parsed || typeof parsed !== "object") return [];
  const rawPresets = Array.isArray(parsed.presets) ? parsed.presets : [];
  const seen = new Set();
  const out = [];
  rawPresets.forEach((item) => {
    const normalized = normalizeSavedNewBookTemplatePreset(item);
    if (!normalized || seen.has(normalized.name)) return;
    seen.add(normalized.name);
    out.push(normalized);
  });
  return out.slice(0, MAX_NEW_BOOK_TEMPLATE_PRESETS);
}

async function importSavedNewBookTemplatePresets(file) {
  if (!file) {
    return {
      ok: false,
      error: "未选择模板文件。",
    };
  }
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const imported = parseImportedNewBookTemplatePresetPayload(parsed);
    if (!imported.length) {
      return {
        ok: false,
        error: "模板文件为空或格式不正确。",
      };
    }
    const current = readSavedNewBookTemplatePresets();
    const mergedMap = new Map();
    [...imported, ...current].forEach((item) => {
      if (!mergedMap.has(item.name)) {
        mergedMap.set(item.name, item);
      }
    });
    const next = writeSavedNewBookTemplatePresets(Array.from(mergedMap.values()));
    return {
      ok: true,
      imported: imported.length,
      total: next.length,
    };
  } catch (err) {
    return {
      ok: false,
      error: `导入模板失败：${err?.message || String(err)}`,
    };
  }
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

function resolveAiSettings(raw) {
  const llm = raw?.llm || {};
  const image = raw?.image || {};
  const analysis = raw?.analysis || {};
  const analysisMode = String(analysis.mode || "manual");
  const imageMode = String(image.mode || "disabled");
  return {
    analysis: {
      mode: analysisMode === "auto-suggest" ? "auto-suggest" : "manual",
    },
    llm: {
      enabled: Boolean(llm.enabled),
      baseUrl: String(llm.baseUrl || ""),
      apiKey: String(llm.apiKey || ""),
      model: String(llm.model || ""),
    },
    image: {
      mode: ["disabled", "api", "prompt-file", "emoji", "none"].includes(imageMode)
        ? imageMode
        : "disabled",
      baseUrl: String(image.baseUrl || ""),
      apiKey: String(image.apiKey || ""),
      model: String(image.model || ""),
      promptFilePath: String(image.promptFilePath || ""),
    },
  };
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

function renderAiSettingsPanel(state) {
  if (!state.structure?.ok) return "";
  const busy = state.busy ? "disabled" : "";
  const settings = resolveAiSettings(state.aiSettings || {});
  const llm = settings.llm;
  const image = settings.image;
  const analysis = settings.analysis;
  const feedback = state.aiFeedback
    ? `<p class="${state.aiFeedback.type === "error" ? "error-text" : "ok-text"}">${state.aiFeedback.message}</p>`
    : "";

  return `
    <section class="panel">
      <h3>AI Settings (Local)</h3>
      <p class="muted">可选配置：LLM 自动建议与图片生成接口。未配置时仍可手动编辑与导出。</p>
      <form id="aiSettingsForm" class="form-grid">
        <label>
          分析模式
          <select name="analysisMode" ${busy}>
            <option value="manual" ${analysis.mode === "manual" ? "selected" : ""}>manual（仅手动配置）</option>
            <option value="auto-suggest" ${analysis.mode === "auto-suggest" ? "selected" : ""}>auto-suggest（允许模型建议）</option>
          </select>
        </label>
        <label class="checkbox-inline">
          <input name="llmEnabled" type="checkbox" ${llm.enabled ? "checked" : ""} ${busy} />
          启用 LLM 接口
        </label>
        <label>
          LLM Base URL
          <input name="llmBaseUrl" type="text" value="${escapeHtml(llm.baseUrl)}" placeholder="https://api.openai.com/v1" ${busy} />
        </label>
        <label>
          LLM API Key
          <input name="llmApiKey" type="password" value="${escapeHtml(llm.apiKey)}" placeholder="sk-..." ${busy} />
        </label>
        <label>
          LLM Model
          <input name="llmModel" type="text" value="${escapeHtml(llm.model)}" placeholder="gpt-4.1-mini" ${busy} />
        </label>
        <label>
          图片模式
          <select name="imageMode" ${busy}>
            <option value="disabled" ${image.mode === "disabled" ? "selected" : ""}>disabled（关闭）</option>
            <option value="api" ${image.mode === "api" ? "selected" : ""}>api（调用生图接口）</option>
            <option value="prompt-file" ${image.mode === "prompt-file" ? "selected" : ""}>prompt-file（仅导出提示词）</option>
            <option value="emoji" ${image.mode === "emoji" ? "selected" : ""}>emoji（使用 emoji 占位）</option>
            <option value="none" ${image.mode === "none" ? "selected" : ""}>none（无图模式）</option>
          </select>
        </label>
        <label>
          Image Base URL
          <input name="imageBaseUrl" type="text" value="${escapeHtml(image.baseUrl)}" placeholder="https://api.example.com/image" ${busy} />
        </label>
        <label>
          Image API Key
          <input name="imageApiKey" type="password" value="${escapeHtml(image.apiKey)}" placeholder="image-key" ${busy} />
        </label>
        <label>
          Image Model
          <input name="imageModel" type="text" value="${escapeHtml(image.model)}" placeholder="image-model-v1" ${busy} />
        </label>
        <label class="full">
          Prompt File Path
          <input name="promptFilePath" type="text" value="${escapeHtml(image.promptFilePath)}" placeholder="reading-garden-editor/prompts/book-image-prompts.md" ${busy} />
        </label>
        <div class="full actions-row">
          <button class="btn btn-primary" type="submit" ${busy}>Save AI Settings</button>
          <button class="btn btn-secondary export-ai-settings-btn" type="button" ${busy}>Export AI Settings</button>
          <button class="btn btn-secondary import-ai-settings-btn" type="button" ${busy}>Import AI Settings</button>
          <input class="import-ai-settings-input" type="file" accept=".json,application/json" hidden ${busy} />
        </div>
      </form>
      ${feedback}
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

function renderPreviewPanel(state) {
  if (!state.structure?.ok) return "";
  const books = Array.isArray(state.books) ? state.books : [];
  if (!books.length) {
    return `
      <section class="panel">
        <h3>Live Preview</h3>
        <p class="empty">当前没有可预览书籍，请先创建或导入书籍。</p>
      </section>
    `;
  }

  const busy = state.busy ? "disabled" : "";
  const previewBookId = books.some((book) => String(book?.id || "") === String(state.previewBookId || ""))
    ? String(state.previewBookId || "")
    : String(books[0]?.id || "");
  const previewDevice = ["desktop", "tablet", "mobile"].includes(String(state.previewDevice || ""))
    ? String(state.previewDevice || "desktop")
    : "desktop";
  const previewAutoRefresh = state.previewAutoRefresh !== false;
  const previewAutoRefreshPolicyScope = String(state.previewAutoRefreshPolicyScope || "global") === "project"
    ? "项目覆盖"
    : "全局默认";
  const recoveryHistoryMaxAgeDays = String(state.recoveryHistoryMaxAgeDays ?? 30);
  const recoveryPolicyImportMode = String(state.recoveryPolicyImportMode || "replace") === "merge"
    ? "merge"
    : "replace";
  const recoveryPolicyImportIncludeDefaultOnMerge = state.recoveryPolicyImportIncludeDefaultOnMerge === true;
  const recoveryPolicyScope = String(state.recoveryHistoryPolicyScope || "global") === "project"
    ? "项目覆盖"
    : "全局默认";
  const recoveryHistory = Array.isArray(state.recoveryHistory) ? state.recoveryHistory : [];
  const historyOptions = recoveryHistory
    .map((item, index) => {
      const stamp = String(item?.savedAt || "").trim();
      if (!stamp) return "";
      const mode = String(item?.analysisSuggestion?.mode || "manual");
      return `<option value="${escapeHtml(stamp)}">${escapeHtml(stamp)} (${escapeHtml(mode)})${index === 0 ? " [latest]" : ""}</option>`;
    })
    .filter(Boolean)
    .join("");
  const recoveryFeedback = state.recoveryFeedback
    ? `<p class="${state.recoveryFeedback.type === "error" ? "error-text" : "ok-text"}">${escapeHtml(state.recoveryFeedback.message)}</p>`
    : "";
  const previewUrl = String(state.previewUrl || "");
  const options = books
    .map((book) => {
      const id = String(book?.id || "");
      return `<option value="${escapeHtml(id)}" ${id === previewBookId ? "selected" : ""}>${escapeHtml(book.title || id)} (${escapeHtml(id)})</option>`;
    })
    .join("");
  const deviceOptions = [
    { value: "desktop", label: "desktop（宽屏）" },
    { value: "tablet", label: "tablet（平板）" },
    { value: "mobile", label: "mobile（手机）" },
  ]
    .map((item) => `<option value="${item.value}" ${item.value === previewDevice ? "selected" : ""}>${item.label}</option>`)
    .join("");
  const recoveryHistoryMaxAgeOptions = RECOVERY_HISTORY_MAX_AGE_DAY_OPTIONS
    .map((item) => (
      `<option value="${item.value}" ${item.value === recoveryHistoryMaxAgeDays ? "selected" : ""}>${item.label}</option>`
    ))
    .join("");

  const openLink = previewUrl
    ? `<a class="btn btn-secondary preview-open-link" href="${escapeHtml(previewUrl)}" target="_blank" rel="noreferrer">Open in New Tab</a>`
    : '<span class="muted">请选择书籍以启用预览链接。</span>';

  return `
    <section class="panel">
      <h3>Live Preview</h3>
      <p class="muted">在编辑器内实时预览书籍页面，支持桌面/平板/手机视口切换。</p>
      <form id="previewForm" class="form-grid">
        <label>
          预览书籍
          <select name="previewBookId" ${busy}>
            ${options}
          </select>
        </label>
        <label>
          设备视口
          <select name="previewDevice" ${busy}>
            ${deviceOptions}
          </select>
        </label>
        <label class="checkbox-inline">
          <input name="previewAutoRefresh" type="checkbox" ${previewAutoRefresh ? "checked" : ""} ${busy} />
          写入后自动刷新预览
          <small class="muted">自动刷新来源：${previewAutoRefreshPolicyScope}</small>
        </label>
        <label>
          快照自动清理
          <select name="recoveryHistoryMaxAgeDays" ${busy}>
            ${recoveryHistoryMaxAgeOptions}
          </select>
          <small class="muted">当前来源：${recoveryPolicyScope}</small>
        </label>
        <label>
          策略导入模式
          <select name="recoveryPolicyImportMode" ${busy}>
            <option value="replace" ${recoveryPolicyImportMode === "replace" ? "selected" : ""}>replace（覆盖策略文件）</option>
            <option value="merge" ${recoveryPolicyImportMode === "merge" ? "selected" : ""}>merge（合并项目策略）</option>
          </select>
        </label>
        <label class="checkbox-inline">
          <input name="recoveryPolicyImportIncludeDefaultOnMerge" type="checkbox" ${recoveryPolicyImportIncludeDefaultOnMerge ? "checked" : ""} ${busy} />
          merge 时覆盖默认值（default）
        </label>
        <div class="full actions-row">
          <button class="btn btn-secondary preview-reset-auto-refresh-policy-btn" type="button" ${busy}>Auto Refresh Global</button>
          <button class="btn btn-secondary preview-export-auto-refresh-policy-btn" type="button" ${busy}>Export AutoRefresh</button>
          <button class="btn btn-secondary preview-import-auto-refresh-policy-btn" type="button" ${busy}>Import AutoRefresh</button>
          <input class="preview-import-auto-refresh-policy-input" type="file" accept=".json,application/json" hidden ${busy} />
          <button class="btn btn-secondary preview-reset-recovery-policy-btn" type="button" ${busy}>Use Global Default</button>
          <button class="btn btn-secondary preview-export-recovery-policy-btn" type="button" ${busy}>Export Policy</button>
          <button class="btn btn-secondary preview-import-recovery-policy-btn" type="button" ${busy}>Import Policy</button>
          <input class="preview-import-recovery-policy-input" type="file" accept=".json,application/json" hidden ${busy} />
          <button class="btn btn-secondary preview-export-policy-bundle-btn" type="button" ${busy}>Export All Policies</button>
          <button class="btn btn-secondary preview-import-policy-bundle-btn" type="button" ${busy}>Import All Policies</button>
          <input class="preview-import-policy-bundle-input" type="file" accept=".json,application/json" hidden ${busy} />
        </div>
        <label class="full">
          恢复历史快照（最近 5 条）
          <select name="recoverySavedAt" ${busy} ${historyOptions ? "" : "disabled"}>
            ${historyOptions || '<option value="">暂无历史快照</option>'}
          </select>
        </label>
        <div class="full actions-row">
          <button class="btn btn-secondary preview-refresh-btn" type="button" ${busy}>Refresh Preview</button>
          <button class="btn btn-secondary preview-restore-recovery-btn" type="button" ${busy} ${historyOptions ? "" : "disabled"}>Restore Selected Snapshot</button>
          <button class="btn btn-secondary preview-remove-recovery-btn" type="button" ${busy} ${historyOptions ? "" : "disabled"}>Delete Selected Snapshot</button>
          <button class="btn btn-secondary preview-clear-recovery-btn" type="button" ${busy}>Clear Recovery Snapshot</button>
          ${openLink}
        </div>
      </form>
      ${recoveryFeedback}
      <div class="preview-stage preview-${previewDevice}">
        <iframe class="preview-frame" src="${escapeHtml(previewUrl)}" title="Reading Garden Live Preview" loading="lazy"></iframe>
      </div>
    </section>
  `;
}

function renderAnalysisPanel(state) {
  if (!state.structure?.ok) return "";
  const busy = state.busy ? "disabled" : "";
  const options = state.books
    .map((book) => `<option value="${escapeHtml(book.id)}">${escapeHtml(book.title || book.id)} (${escapeHtml(book.id)})</option>`)
    .join("");
  const feedback = state.analysisFeedback
    ? `<p class="${state.analysisFeedback.type === "error" ? "error-text" : "ok-text"}">${state.analysisFeedback.message}</p>`
    : "";

  const suggestion = state.analysisSuggestion && Array.isArray(state.analysisSuggestion.moduleSuggestions)
    ? state.analysisSuggestion.moduleSuggestions
    : [];
  const suggestionList = suggestion.length
    ? `
      <div class="diag-box">
        <div class="diag-title">最近分析结果（${escapeHtml(String(state.analysisSuggestion.mode || "heuristic"))}）</div>
        <ul class="error-list">
          ${suggestion
            .map((item) => `<li>${escapeHtml(item.id)}: ${item.include ? "include" : "skip"}（${Math.round(Number(item.confidence || 0) * 100)}%）</li>`)
            .join("")}
        </ul>
      </div>
    `
    : "";

  return `
    <section class="panel">
      <h3>Text Analysis Assistant</h3>
      <p class="muted">导入书本原文（txt/md）后生成模块建议，支持 LLM（可选）与本地回退。</p>
      <p class="muted">可将建议安全落盘为 <code>registry.suggested.json</code>，不会覆盖现有配置。</p>
      <p class="muted">也支持覆盖 <code>registry.json</code>，会自动备份并补齐新增模块的数据模板。</p>
      <p class="muted">如果不选目标书籍，Apply 时会根据分析结果自动创建草稿书籍。</p>
      <form id="analysisForm" class="form-grid">
        <label class="full">
          原文文件
          <input name="sourceFile" type="file" accept=".txt,.md,text/plain,text/markdown" ${busy} />
        </label>
        <label>
          书名（可选）
          <input name="bookTitle" type="text" placeholder="用于建议报告标题" ${busy} />
        </label>
        <label>
          目标书籍（可选）
          <select name="targetBookId" ${busy}>
            <option value="">(auto create from suggestion)</option>
            ${options}
          </select>
        </label>
        <label>
          应用模式
          <select name="analysisApplyMode" ${busy}>
            <option value="safe">safe（写入 registry.suggested.json）</option>
            <option value="overwrite">overwrite（覆盖 registry.json + 自动备份）</option>
          </select>
        </label>
        <label class="checkbox-inline">
          <input name="confirmOverwriteAnalysis" type="checkbox" ${busy} />
          我已确认 overwrite 会修改 `registry.json`
        </label>
        <div class="full actions-row">
          <button class="btn btn-primary" type="submit" ${busy}>Analyze Text</button>
          <button class="btn btn-secondary download-analysis-btn" type="button" ${busy}>Download Suggestion</button>
          <button class="btn btn-secondary apply-analysis-btn" type="button" ${busy}>Apply Suggestion</button>
        </div>
      </form>
      ${feedback}
      ${suggestionList}
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
  const imageMode = String(state.aiSettings?.image?.mode || "disabled");
  const savedTemplatePresets = readSavedNewBookTemplatePresets();
  const savedTemplatePresetOptions = savedTemplatePresets
    .map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`)
    .join("");
  const savedTemplatePresetDisabled = savedTemplatePresets.length ? "" : "disabled";
  const feedback = state.newBookFeedback
    ? `<p class="${state.newBookFeedback.type === "error" ? "error-text" : "ok-text"}">${state.newBookFeedback.message}</p>`
    : "";

  return `
    <section class="panel">
      <h3>Create New Book</h3>
      <p class="muted">创建最小可运行新书（支持阅读/人物/主题模块模板）。</p>
      <p class="muted">当前图片策略：<code>${escapeHtml(imageMode)}</code>（可在 AI Settings 面板调整）。</p>
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
        <label>
          模板级别
          <select name="templatePreset" ${busy}>
            <option value="standard" selected>standard（阅读+人物+主题）</option>
            <option value="minimal">minimal（仅阅读）</option>
            <option value="teaching">teaching（全模块）</option>
            <option value="custom">custom（手动勾选）</option>
          </select>
        </label>
        <label class="full">
          简介
          <textarea name="description" rows="3" placeholder="简要介绍这本书" ${busy}></textarea>
        </label>
        <p class="muted full">选择模板级别会自动勾选模块；手动调整模块后会自动切换为 custom。</p>
        <label class="checkbox-inline">
          <input name="includeCharacters" type="checkbox" checked ${busy} />
          包含人物模块模板
        </label>
        <label class="checkbox-inline">
          <input name="includeThemes" type="checkbox" checked ${busy} />
          包含主题模块模板
        </label>
        <label class="checkbox-inline">
          <input name="includeTimeline" type="checkbox" ${busy} />
          包含时间线模块模板
        </label>
        <label class="checkbox-inline">
          <input name="includeInteractive" type="checkbox" ${busy} />
          包含情境模块模板
        </label>
        <label class="full">
          已保存模板
          <select name="savedTemplatePreset" ${busy} ${savedTemplatePresetDisabled}>
            ${savedTemplatePresetOptions || '<option value="">暂无保存模板</option>'}
          </select>
        </label>
        <label>
          保存模板名称
          <input name="savedTemplatePresetName" type="text" placeholder="例如：课堂全模块" ${busy} />
        </label>
        <div class="full actions-row">
          <button class="btn btn-secondary save-template-preset-btn" type="button" ${busy}>Save Preset</button>
          <button class="btn btn-secondary apply-template-preset-btn" type="button" ${busy} ${savedTemplatePresetDisabled}>Apply Preset</button>
          <button class="btn btn-secondary export-template-presets-btn" type="button" ${busy}>Export Presets</button>
          <button class="btn btn-secondary import-template-presets-btn" type="button" ${busy}>Import Presets</button>
          <button class="btn btn-secondary clear-template-presets-btn" type="button" ${busy}>Clear Presets</button>
          <input class="import-template-presets-input" type="file" accept=".json,application/json" hidden ${busy} />
        </div>
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

  const manualPlan = state.packManualPlan && typeof state.packManualPlan === "object"
    ? state.packManualPlan
    : null;
  const manualPlanBox = manualPlan
    ? `
      <div class="diag-box">
        <div class="diag-title">Manual Merge Preview</div>
        <p class="muted">
          incoming bookId: <code>${escapeHtml(String(manualPlan.incomingBookId || ""))}</code>；
          recommended: <code>${escapeHtml(String(manualPlan.recommendedStrategy || "rename"))}</code>
          -> <code>${escapeHtml(String(manualPlan.recommendedTargetBookId || ""))}</code>
        </p>
        <p class="muted">options: ${escapeHtml(String(manualPlan.options || "overwrite/rename/skip"))}</p>
        <div class="actions-row">
          <button class="btn btn-secondary apply-manual-plan-btn" type="button" ${busy}>Apply Recommended Import</button>
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
            <option value="manual">manual (preview plan only)</option>
          </select>
        </label>
        <div class="actions-row">
          <button class="btn btn-primary" type="submit" ${busy}>Import rgbook</button>
        </div>
      </form>
      ${manualPlanBox}
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
  const busy = state.busy ? "disabled" : "";
  const feedback = state.validationFeedback
    ? `<p class="${state.validationFeedback.type === "error" ? "error-text" : "ok-text"}">${escapeHtml(state.validationFeedback.message)}</p>`
    : "";
  return `
    <section class="panel">
      <h3>Validation Issues</h3>
      <ul class="error-list">${state.errors.map((e) => `<li>${e}</li>`).join("")}</ul>
      <div class="actions-row">
        <button class="btn btn-secondary download-validation-report-btn" type="button" ${busy}>Download Validation Report</button>
      </div>
      ${feedback}
    </section>
  `;
}

export function renderDashboard(root, state, handlers = {}) {
  if (!root) return;
  root.innerHTML = `
    ${renderStructurePanel(state)}
    ${renderAiSettingsPanel(state)}
    ${renderAnalysisPanel(state)}
    ${renderNewBookPanel(state)}
    ${renderPreviewPanel(state)}
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
        templatePreset: String(fd.get("templatePreset") || "standard"),
        includeCharacters: fd.get("includeCharacters") === "on",
        includeThemes: fd.get("includeThemes") === "on",
        includeTimeline: fd.get("includeTimeline") === "on",
        includeInteractive: fd.get("includeInteractive") === "on",
      });
    });
    const presetSelect = form.querySelector('select[name="templatePreset"]');
    const moduleCheckboxes = [
      form.querySelector('input[name="includeCharacters"]'),
      form.querySelector('input[name="includeThemes"]'),
      form.querySelector('input[name="includeTimeline"]'),
      form.querySelector('input[name="includeInteractive"]'),
    ].filter(Boolean);
    if (presetSelect) {
      applyNewBookTemplatePreset(form, presetSelect.value || "standard");
      presetSelect.addEventListener("change", () => {
        const preset = normalizeNewBookTemplatePreset(presetSelect.value || "standard");
        if (preset !== "custom") {
          applyNewBookTemplatePreset(form, preset);
        }
      });
    }
    moduleCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        if (!presetSelect) return;
        const preset = normalizeNewBookTemplatePreset(presetSelect.value || "standard");
        if (preset === "custom") return;
        if (!matchesNewBookTemplatePreset(form, preset)) {
          presetSelect.value = "custom";
        }
      });
    });

    const notifyNewBookPresetFeedback = (type, message) => {
      if (handlers.onNewBookPresetFeedback) {
        handlers.onNewBookPresetFeedback({
          type,
          message,
        });
      }
    };

    const savedPresetSelect = form.querySelector('select[name="savedTemplatePreset"]');
    const savedPresetNameInput = form.querySelector('input[name="savedTemplatePresetName"]');
    const savePresetBtn = form.querySelector(".save-template-preset-btn");
    const applyPresetBtn = form.querySelector(".apply-template-preset-btn");
    const exportPresetBtn = form.querySelector(".export-template-presets-btn");
    const importPresetBtn = form.querySelector(".import-template-presets-btn");
    const importPresetInput = form.querySelector(".import-template-presets-input");
    const clearPresetBtn = form.querySelector(".clear-template-presets-btn");

    savePresetBtn?.addEventListener("click", () => {
      const presetName = normalizeNewBookTemplatePresetName(savedPresetNameInput?.value || "");
      const result = upsertSavedNewBookTemplatePreset({
        name: presetName,
        includeCharacters: form.querySelector('input[name="includeCharacters"]')?.checked === true,
        includeThemes: form.querySelector('input[name="includeThemes"]')?.checked === true,
        includeTimeline: form.querySelector('input[name="includeTimeline"]')?.checked === true,
        includeInteractive: form.querySelector('input[name="includeInteractive"]')?.checked === true,
      });
      if (!result.ok) {
        notifyNewBookPresetFeedback("error", result.error || "保存模板失败。");
        return;
      }
      if (savedPresetNameInput) savedPresetNameInput.value = result.preset.name;
      notifyNewBookPresetFeedback(
        "ok",
        result.existed
          ? `模板已更新：${result.preset.name}`
          : `模板已保存：${result.preset.name}`
      );
    });

    applyPresetBtn?.addEventListener("click", () => {
      const selectedName = String(savedPresetSelect?.value || "").trim();
      const preset = readSavedNewBookTemplatePresets()
        .find((item) => item.name === selectedName);
      if (!preset) {
        notifyNewBookPresetFeedback("error", "请选择要应用的保存模板。");
        return;
      }
      applySavedNewBookTemplatePresetToForm(form, preset);
      if (savedPresetNameInput) savedPresetNameInput.value = preset.name;
      notifyNewBookPresetFeedback("ok", `已应用模板：${preset.name}`);
    });

    clearPresetBtn?.addEventListener("click", () => {
      const count = clearSavedNewBookTemplatePresets();
      notifyNewBookPresetFeedback(
        "ok",
        count > 0 ? `已清空保存模板（${count} 条）。` : "保存模板已为空。"
      );
    });

    exportPresetBtn?.addEventListener("click", () => {
      const count = exportSavedNewBookTemplatePresets();
      notifyNewBookPresetFeedback(
        "ok",
        count > 0 ? `模板已导出（${count} 条）。` : "模板已导出（当前为空列表）。"
      );
    });

    importPresetBtn?.addEventListener("click", () => {
      importPresetInput?.click();
    });
    importPresetInput?.addEventListener("change", async () => {
      const file = importPresetInput.files?.[0];
      if (importPresetInput) importPresetInput.value = "";
      const result = await importSavedNewBookTemplatePresets(file || null);
      if (!result.ok) {
        notifyNewBookPresetFeedback("error", result.error || "导入模板失败。");
        return;
      }
      notifyNewBookPresetFeedback("ok", `模板已导入：新增 ${result.imported} 条，当前 ${result.total} 条。`);
    });
  }

  const analysisForm = root.querySelector("#analysisForm");
  if (analysisForm && handlers.onAnalyzeBookText) {
    analysisForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const fileInput = analysisForm.querySelector('input[name="sourceFile"]');
      const fd = new FormData(analysisForm);
      const file = fileInput?.files?.[0] || null;
      handlers.onAnalyzeBookText({
        file,
        title: String(fd.get("bookTitle") || ""),
        bookId: String(fd.get("targetBookId") || ""),
      });
    });
  }
  if (analysisForm) {
    const downloadAnalysisBtn = analysisForm.querySelector(".download-analysis-btn");
    const applyAnalysisBtn = analysisForm.querySelector(".apply-analysis-btn");
    downloadAnalysisBtn?.addEventListener("click", () => {
      if (handlers.onDownloadAnalysisSuggestion) {
        handlers.onDownloadAnalysisSuggestion();
      }
    });
    applyAnalysisBtn?.addEventListener("click", () => {
      const fd = new FormData(analysisForm);
      if (handlers.onApplyAnalysisSuggestion) {
        handlers.onApplyAnalysisSuggestion({
          bookId: String(fd.get("targetBookId") || ""),
          applyMode: String(fd.get("analysisApplyMode") || "safe"),
          confirmOverwrite: fd.get("confirmOverwriteAnalysis") === "on",
        });
      }
    });
  }

  const previewForm = root.querySelector("#previewForm");
  if (previewForm && handlers.onUpdatePreviewState) {
    previewForm.addEventListener("change", () => {
      const fd = new FormData(previewForm);
      handlers.onUpdatePreviewState({
        bookId: String(fd.get("previewBookId") || ""),
        device: String(fd.get("previewDevice") || "desktop"),
        autoRefresh: fd.get("previewAutoRefresh") === "on",
      });
    });
  }
  const recoveryPolicySelect = root.querySelector('select[name="recoveryHistoryMaxAgeDays"]');
  recoveryPolicySelect?.addEventListener("change", () => {
    if (handlers.onUpdateRecoveryHistoryPolicy) {
      handlers.onUpdateRecoveryHistoryPolicy(String(recoveryPolicySelect.value || "30"));
    }
  });
  const previewRefreshBtn = root.querySelector(".preview-refresh-btn");
  const previewRestoreRecoveryBtn = root.querySelector(".preview-restore-recovery-btn");
  const previewRemoveRecoveryBtn = root.querySelector(".preview-remove-recovery-btn");
  const previewResetAutoRefreshPolicyBtn = root.querySelector(".preview-reset-auto-refresh-policy-btn");
  const previewExportAutoRefreshPolicyBtn = root.querySelector(".preview-export-auto-refresh-policy-btn");
  const previewImportAutoRefreshPolicyBtn = root.querySelector(".preview-import-auto-refresh-policy-btn");
  const previewImportAutoRefreshPolicyInput = root.querySelector(".preview-import-auto-refresh-policy-input");
  const previewResetRecoveryPolicyBtn = root.querySelector(".preview-reset-recovery-policy-btn");
  const previewExportRecoveryPolicyBtn = root.querySelector(".preview-export-recovery-policy-btn");
  const previewImportRecoveryPolicyBtn = root.querySelector(".preview-import-recovery-policy-btn");
  const previewImportRecoveryPolicyInput = root.querySelector(".preview-import-recovery-policy-input");
  const previewExportPolicyBundleBtn = root.querySelector(".preview-export-policy-bundle-btn");
  const previewImportPolicyBundleBtn = root.querySelector(".preview-import-policy-bundle-btn");
  const previewImportPolicyBundleInput = root.querySelector(".preview-import-policy-bundle-input");
  const recoveryPolicyImportModeEl = root.querySelector('select[name="recoveryPolicyImportMode"]');
  const recoveryPolicyImportIncludeDefaultOnMergeEl = root.querySelector('input[name="recoveryPolicyImportIncludeDefaultOnMerge"]');
  const previewClearRecoveryBtn = root.querySelector(".preview-clear-recovery-btn");
  recoveryPolicyImportIncludeDefaultOnMergeEl?.addEventListener("change", () => {
    if (handlers.onUpdateRecoveryPolicyImportOptions) {
      handlers.onUpdateRecoveryPolicyImportOptions({
        includeDefaultOnMerge: recoveryPolicyImportIncludeDefaultOnMergeEl.checked === true,
      });
    }
  });
  previewRefreshBtn?.addEventListener("click", () => {
    if (handlers.onRefreshPreview) {
      handlers.onRefreshPreview();
    }
  });
  previewClearRecoveryBtn?.addEventListener("click", () => {
    if (handlers.onClearRecoverySnapshot) {
      handlers.onClearRecoverySnapshot();
    }
  });
  previewRestoreRecoveryBtn?.addEventListener("click", () => {
    if (handlers.onRestoreRecoverySnapshot) {
      const recoverySelect = root.querySelector('select[name="recoverySavedAt"]');
      handlers.onRestoreRecoverySnapshot(String(recoverySelect?.value || ""));
    }
  });
  previewRemoveRecoveryBtn?.addEventListener("click", () => {
    if (handlers.onRemoveRecoverySnapshot) {
      const recoverySelect = root.querySelector('select[name="recoverySavedAt"]');
      handlers.onRemoveRecoverySnapshot(String(recoverySelect?.value || ""));
    }
  });
  previewResetAutoRefreshPolicyBtn?.addEventListener("click", () => {
    if (handlers.onResetPreviewAutoRefreshPolicy) {
      handlers.onResetPreviewAutoRefreshPolicy();
    }
  });
  previewExportAutoRefreshPolicyBtn?.addEventListener("click", () => {
    if (handlers.onExportPreviewAutoRefreshPolicy) {
      handlers.onExportPreviewAutoRefreshPolicy();
    }
  });
  previewImportAutoRefreshPolicyBtn?.addEventListener("click", () => {
    previewImportAutoRefreshPolicyInput?.click();
  });
  previewImportAutoRefreshPolicyInput?.addEventListener("change", () => {
    const file = previewImportAutoRefreshPolicyInput.files?.[0];
    const importRecoveryPolicyMode = String(recoveryPolicyImportModeEl?.value || "replace");
    const importPolicyOptions = {
      includeDefaultOnMerge: recoveryPolicyImportIncludeDefaultOnMergeEl?.checked === true,
    };
    if (previewImportAutoRefreshPolicyInput) previewImportAutoRefreshPolicyInput.value = "";
    if (handlers.onImportPreviewAutoRefreshPolicy) {
      handlers.onImportPreviewAutoRefreshPolicy(file || null, importRecoveryPolicyMode, importPolicyOptions);
    }
  });
  previewResetRecoveryPolicyBtn?.addEventListener("click", () => {
    if (handlers.onResetRecoveryHistoryPolicy) {
      handlers.onResetRecoveryHistoryPolicy();
    }
  });
  previewExportRecoveryPolicyBtn?.addEventListener("click", () => {
    if (handlers.onExportRecoveryHistoryPolicy) {
      handlers.onExportRecoveryHistoryPolicy();
    }
  });
  previewImportRecoveryPolicyBtn?.addEventListener("click", () => {
    previewImportRecoveryPolicyInput?.click();
  });
  previewImportRecoveryPolicyInput?.addEventListener("change", () => {
    const file = previewImportRecoveryPolicyInput.files?.[0];
    const importRecoveryPolicyMode = String(recoveryPolicyImportModeEl?.value || "replace");
    const importPolicyOptions = {
      includeDefaultOnMerge: recoveryPolicyImportIncludeDefaultOnMergeEl?.checked === true,
    };
    if (previewImportRecoveryPolicyInput) previewImportRecoveryPolicyInput.value = "";
    if (handlers.onImportRecoveryHistoryPolicy) {
      handlers.onImportRecoveryHistoryPolicy(file || null, importRecoveryPolicyMode, importPolicyOptions);
    }
  });
  previewExportPolicyBundleBtn?.addEventListener("click", () => {
    if (handlers.onExportEditorPolicyBundle) {
      handlers.onExportEditorPolicyBundle();
    }
  });
  previewImportPolicyBundleBtn?.addEventListener("click", () => {
    previewImportPolicyBundleInput?.click();
  });
  previewImportPolicyBundleInput?.addEventListener("change", () => {
    const file = previewImportPolicyBundleInput.files?.[0];
    const importRecoveryPolicyMode = String(recoveryPolicyImportModeEl?.value || "replace");
    const importPolicyOptions = {
      includeDefaultOnMerge: recoveryPolicyImportIncludeDefaultOnMergeEl?.checked === true,
    };
    if (previewImportPolicyBundleInput) previewImportPolicyBundleInput.value = "";
    if (handlers.onImportEditorPolicyBundle) {
      handlers.onImportEditorPolicyBundle(file || null, importRecoveryPolicyMode, importPolicyOptions);
    }
  });

  const aiSettingsForm = root.querySelector("#aiSettingsForm");
  if (aiSettingsForm && handlers.onSaveAiSettings) {
    aiSettingsForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const fd = new FormData(aiSettingsForm);
      handlers.onSaveAiSettings({
        analysis: {
          mode: String(fd.get("analysisMode") || "manual"),
        },
        llm: {
          enabled: fd.get("llmEnabled") === "on",
          baseUrl: String(fd.get("llmBaseUrl") || ""),
          apiKey: String(fd.get("llmApiKey") || ""),
          model: String(fd.get("llmModel") || ""),
        },
        image: {
          mode: String(fd.get("imageMode") || "disabled"),
          baseUrl: String(fd.get("imageBaseUrl") || ""),
          apiKey: String(fd.get("imageApiKey") || ""),
          model: String(fd.get("imageModel") || ""),
          promptFilePath: String(fd.get("promptFilePath") || ""),
        },
      });
    });
  }
  if (aiSettingsForm) {
    const exportAiSettingsBtn = aiSettingsForm.querySelector(".export-ai-settings-btn");
    const importAiSettingsBtn = aiSettingsForm.querySelector(".import-ai-settings-btn");
    const importAiSettingsInput = aiSettingsForm.querySelector(".import-ai-settings-input");
    exportAiSettingsBtn?.addEventListener("click", () => {
      if (handlers.onExportAiSettings) {
        handlers.onExportAiSettings();
      }
    });
    importAiSettingsBtn?.addEventListener("click", () => {
      importAiSettingsInput?.click();
    });
    importAiSettingsInput?.addEventListener("change", () => {
      const file = importAiSettingsInput.files?.[0];
      if (importAiSettingsInput) {
        importAiSettingsInput.value = "";
      }
      if (handlers.onImportAiSettings) {
        handlers.onImportAiSettings(file || null);
      }
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
  const applyManualPlanBtn = root.querySelector(".apply-manual-plan-btn");
  applyManualPlanBtn?.addEventListener("click", () => {
    if (handlers.onApplyManualMergeSuggestion) {
      handlers.onApplyManualMergeSuggestion();
    }
  });

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

  const downloadValidationReportBtn = root.querySelector(".download-validation-report-btn");
  downloadValidationReportBtn?.addEventListener("click", () => {
    if (handlers.onDownloadValidationReport) {
      handlers.onDownloadValidationReport();
    }
  });

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
