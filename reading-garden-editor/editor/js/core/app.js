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
import { analyzeBookText, buildAnalysisSuggestionReport } from "./analysis-assistant.js";
import { renderDashboard } from "../ui/dashboard.js";
import { ImportMergeService } from "../packaging/import-merge-service.js";
import { BookPackService } from "../packaging/book-pack-service.js";
import { SitePackService } from "../packaging/site-pack-service.js";

const fs = createFileSystemAdapter();
const mergeService = new ImportMergeService();
const bookPackService = new BookPackService({ fs, mergeService });
const sitePackService = new SitePackService({ fs });
const AI_SETTINGS_PATH = "reading-garden-editor/config/ai-settings.json";
const MODULE_TEMPLATE_MAP = {
  reading: {
    id: "reading",
    title: "阅读",
    icon: "📖",
    entry: "../../js/modules/reading-module.js",
    data: "chapters.json",
    active: true,
  },
  characters: {
    id: "characters",
    title: "人物",
    icon: "👥",
    entry: "../../js/modules/characters-module.js",
    data: "characters.json",
  },
  themes: {
    id: "themes",
    title: "主题",
    icon: "💭",
    entry: "../../js/modules/themes-module.js",
    data: "themes.json",
  },
  timeline: {
    id: "timeline",
    title: "时间线",
    icon: "📅",
    entry: "../../js/modules/timeline-module.js",
    data: "timeline.json",
  },
  interactive: {
    id: "interactive",
    title: "情境",
    icon: "🎯",
    entry: "../../js/modules/interactive-module.js",
    data: "scenarios.json",
  },
};

function buildSuggestedModuleDataSeed(moduleId, bookId) {
  if (moduleId === "reading") {
    return {
      chapters: [
        {
          id: 1,
          title: "第一章",
          content: ["请补充章节内容。"],
        },
      ],
    };
  }
  if (moduleId === "characters") {
    return {
      nodes: [
        {
          data: {
            id: "protagonist",
            name: "主角",
            role: "protagonist",
            description: "请补充人物信息",
            avatar: `../assets/images/${bookId}/characters/protagonist.svg`,
            traits: [],
            quote: "",
          },
        },
      ],
      edges: [],
    };
  }
  if (moduleId === "themes") {
    return {
      themes: [
        {
          id: "theme-1",
          title: "核心主题",
          description: "请补充主题解读",
        },
      ],
    };
  }
  if (moduleId === "timeline") {
    return {
      events: [
        {
          id: "event-1",
          title: "关键事件",
          time: "",
          description: "请补充时间线内容",
        },
      ],
    };
  }
  if (moduleId === "interactive") {
    return {
      scenarios: [
        {
          id: "scenario-1",
          title: "互动问题",
          prompt: "请补充互动问题",
          options: [],
        },
      ],
    };
  }
  return null;
}

async function ensureSuggestedModuleDataFiles(bookId, moduleIds = []) {
  const uniqueIds = Array.from(
    new Set(
      (Array.isArray(moduleIds) ? moduleIds : [])
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
  const created = [];
  const skipped = [];

  for (const moduleId of uniqueIds) {
    const template = MODULE_TEMPLATE_MAP[moduleId];
    if (!template?.data) continue;
    const payload = buildSuggestedModuleDataSeed(moduleId, bookId);
    if (!payload) continue;
    const path = resolveFromBookDir(bookId, template.data);
    // eslint-disable-next-line no-await-in-loop
    const exists = await fs.exists(path);
    if (exists) {
      skipped.push(path);
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    await fs.writeJson(path, payload);
    created.push(path);
  }

  return {
    created,
    skipped,
  };
}

function buildDefaultAiSettings() {
  return {
    analysis: {
      mode: "manual",
    },
    llm: {
      enabled: false,
      baseUrl: "",
      apiKey: "",
      model: "",
    },
    image: {
      mode: "disabled",
      baseUrl: "",
      apiKey: "",
      model: "",
      promptFilePath: "",
    },
  };
}

function sanitizeAiSettings(raw) {
  const safe = raw && typeof raw === "object" ? raw : {};
  const analysisRaw = safe.analysis && typeof safe.analysis === "object" ? safe.analysis : {};
  const llmRaw = safe.llm && typeof safe.llm === "object" ? safe.llm : {};
  const imageRaw = safe.image && typeof safe.image === "object" ? safe.image : {};
  const analysisMode = String(analysisRaw.mode || "manual").trim();
  const imageMode = String(imageRaw.mode || "disabled").trim();
  return {
    analysis: {
      mode: analysisMode === "auto-suggest" ? "auto-suggest" : "manual",
    },
    llm: {
      enabled: Boolean(llmRaw.enabled),
      baseUrl: String(llmRaw.baseUrl || "").trim(),
      apiKey: String(llmRaw.apiKey || "").trim(),
      model: String(llmRaw.model || "").trim(),
    },
    image: {
      mode: ["disabled", "api", "prompt-file", "emoji", "none"].includes(imageMode)
        ? imageMode
        : "disabled",
      baseUrl: String(imageRaw.baseUrl || "").trim(),
      apiKey: String(imageRaw.apiKey || "").trim(),
      model: String(imageRaw.model || "").trim(),
      promptFilePath: String(imageRaw.promptFilePath || "").trim(),
    },
  };
}

function buildTimestampToken() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function downloadJsonFile(filename, payload) {
  const text = `${JSON.stringify(payload, null, 2)}\n`;
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

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
      onSaveAiSettings: saveAiSettingsFlow,
      onExportAiSettings: exportAiSettingsFlow,
      onImportAiSettings: importAiSettingsFlow,
      onAnalyzeBookText: analyzeBookTextFlow,
      onDownloadAnalysisSuggestion: downloadAnalysisSuggestionFlow,
      onApplyAnalysisSuggestion: applyAnalysisSuggestionFlow,
      onExportPack: exportPackFlow,
      onImportPack: importPackFlow,
      onExportSite: exportSiteFlow,
      onDownloadImportReport: downloadImportReportFlow,
      onClearRedactionTemplates: clearRedactionTemplatesFlow,
      onExportRedactionTemplates: exportRedactionTemplatesFlow,
      onPreviewRedactionTemplates: previewRedactionTemplatesFlow,
      onImportRedactionTemplates: importRedactionTemplatesFlow,
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

async function loadAiSettingsFlow() {
  const defaults = buildDefaultAiSettings();
  try {
    const exists = await fs.exists(AI_SETTINGS_PATH);
    if (!exists) {
      setState({
        aiSettings: defaults,
      });
      return;
    }
    const parsed = await fs.readJson(AI_SETTINGS_PATH);
    setState({
      aiSettings: sanitizeAiSettings(parsed),
    });
  } catch (err) {
    setState({
      aiSettings: defaults,
      aiFeedback: {
        type: "error",
        message: `读取 AI 配置失败，已回退默认值：${err?.message || String(err)}`,
      },
    });
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
  setState({
    busy: true,
    newBookFeedback: null,
    packFeedback: null,
    packDiagnostic: null,
    aiFeedback: null,
    analysisFeedback: null,
    analysisSuggestion: null,
  });

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
      await loadAiSettingsFlow();
    } else {
      setState({ books: [], bookHealth: [], aiSettings: buildDefaultAiSettings() });
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
      aiSettings: buildDefaultAiSettings(),
      aiFeedback: null,
      analysisFeedback: null,
      analysisSuggestion: null,
    });

    setNavEnabled(false);
    setStatus("Open failed");
  }

  setState({ busy: false });
  render();
}

function buildAnalysisFilename(report = {}) {
  const safeBookId = String(report?.source?.bookId || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = safeBookId || "draft";
  return `analysis-suggestion-${suffix}-${buildTimestampToken()}.json`;
}

async function analyzeBookTextFlow(input = {}) {
  const file = input?.file || null;
  if (!file) {
    setState({
      analysisFeedback: {
        type: "error",
        message: "请选择要分析的原文文件（txt/md）。",
      },
    });
    return;
  }

  const state = getState();
  if (!state.projectHandle || !state.structure?.ok) {
    setState({
      analysisFeedback: {
        type: "error",
        message: "请先打开项目目录后再执行原文分析。",
      },
    });
    return;
  }

  setState({
    busy: true,
    analysisFeedback: null,
    packFeedback: null,
    newBookFeedback: null,
  });
  setStatus("Analyzing source text...");

  try {
    const text = await file.text();
    const result = await analyzeBookText({
      text,
      aiSettings: state.aiSettings || buildDefaultAiSettings(),
      title: String(input?.title || "").trim(),
      bookId: String(input?.bookId || "").trim(),
    });

    setState({
      analysisSuggestion: {
        sourceFileName: file.name,
        ...result,
      },
      analysisFeedback: {
        type: "ok",
        message: `分析完成：mode ${result.mode}，建议模块 ${Array.isArray(result.moduleSuggestions) ? result.moduleSuggestions.length : 0} 个。`,
      },
    });
    setStatus("Text analyzed");
  } catch (err) {
    setState({
      analysisFeedback: {
        type: "error",
        message: `原文分析失败：${err?.message || String(err)}`,
      },
    });
    setStatus("Analyze failed");
  }

  setState({ busy: false });
}

function downloadAnalysisSuggestionFlow() {
  const state = getState();
  const suggestion = state.analysisSuggestion;
  if (!suggestion) {
    setState({
      analysisFeedback: {
        type: "error",
        message: "当前没有可下载的分析结果，请先执行 Analyze Text。",
      },
    });
    return;
  }

  const report = buildAnalysisSuggestionReport({
    analysis: suggestion,
    source: {
      fileName: suggestion.sourceFileName || "",
      title: suggestion.titleCandidate || "",
      bookId: suggestion.bookIdSuggestion || "",
    },
    aiSettings: state.aiSettings || buildDefaultAiSettings(),
  });
  const filename = buildAnalysisFilename(report);
  downloadJsonFile(filename, report);
  setState({
    analysisFeedback: {
      type: "ok",
      message: `分析建议已下载：${filename}`,
    },
  });
}

function resolveTargetBookForSuggestion(inputBookId = "") {
  const state = getState();
  const explicit = String(inputBookId || "").trim();
  if (explicit) return explicit;
  return String(state.analysisSuggestion?.bookIdSuggestion || "").trim();
}

function normalizeAnalysisApplyMode(rawMode = "safe") {
  const mode = String(rawMode || "safe").trim().toLowerCase();
  return mode === "overwrite" ? "overwrite" : "safe";
}

function resolveSuggestionInclude(suggestion, moduleId) {
  const list = Array.isArray(suggestion?.moduleSuggestions) ? suggestion.moduleSuggestions : [];
  const found = list.find((item) => String(item?.id || "").trim() === moduleId);
  return Boolean(found?.include);
}

function resolveUniqueBookId(baseId, books = []) {
  const normalized = sanitizeBookId(baseId || "new-book") || "new-book";
  const used = new Set(
    (Array.isArray(books) ? books : [])
      .map((item) => String(item?.id || "").trim())
      .filter(Boolean)
  );
  if (!used.has(normalized)) return normalized;
  let idx = 1;
  while (used.has(`${normalized}-${idx}`)) idx += 1;
  return `${normalized}-${idx}`;
}

function buildAutoCreateBookInputFromSuggestion(state, suggestion) {
  const baseTitle = String(suggestion?.titleCandidate || "").trim() || "分析草稿书籍";
  const preferredId = String(suggestion?.bookIdSuggestion || "").trim() || baseTitle;
  const id = resolveUniqueBookId(preferredId, state?.books || []);
  return {
    id,
    title: baseTitle,
    author: "",
    description: "由文本分析助手自动生成的初始书籍草稿。",
    includeCharacters: resolveSuggestionInclude(suggestion, "characters"),
    includeThemes: resolveSuggestionInclude(suggestion, "themes"),
  };
}

function buildSuggestedRegistry(registry, suggestion) {
  const safeRegistry = registry && typeof registry === "object" ? registry : {};
  const currentModules = Array.isArray(safeRegistry.modules) ? safeRegistry.modules : [];
  const currentMap = new Map(
    currentModules
      .map((item) => [String(item?.id || "").trim(), item])
      .filter(([id]) => Boolean(id))
  );

  const outModules = currentModules.map((item) => ({ ...item }));
  let added = 0;
  const addedModuleIds = [];
  const skippedUnknown = [];
  const considered = Array.isArray(suggestion?.moduleSuggestions) ? suggestion.moduleSuggestions : [];
  considered.forEach((item) => {
    const id = String(item?.id || "").trim();
    if (!id || !item?.include || currentMap.has(id)) return;
    const template = MODULE_TEMPLATE_MAP[id];
    if (!template) {
      skippedUnknown.push(id);
      return;
    }
    outModules.push({ ...template });
    currentMap.set(id, template);
    added += 1;
    addedModuleIds.push(id);
  });

  return {
    registry: {
      ...safeRegistry,
      modules: outModules,
      suggestionMeta: {
        generatedAt: new Date().toISOString(),
        mode: String(suggestion?.mode || "heuristic"),
        addedModules: added,
      },
    },
    added,
    addedModuleIds,
    skippedUnknown,
  };
}

async function applyAnalysisSuggestionFlow({
  bookId = "",
  applyMode = "safe",
  confirmOverwrite = false,
} = {}) {
  const state = getState();
  const suggestion = state.analysisSuggestion;
  if (!suggestion) {
    setState({
      analysisFeedback: {
        type: "error",
        message: "当前没有可应用的分析结果，请先执行 Analyze Text。",
      },
    });
    return;
  }

  let targetBookId = resolveTargetBookForSuggestion(bookId);
  let autoCreatedBookId = "";
  if (!targetBookId) {
    const draftInput = buildAutoCreateBookInputFromSuggestion(state, suggestion);
    await createBookFlow(draftInput);
    const latest = getState();
    const created = latest.books.some((book) => String(book?.id || "").trim() === draftInput.id);
    if (!created) {
      setState({
        analysisFeedback: {
          type: "error",
          message: `自动创建目标书籍失败：${draftInput.id}`,
        },
      });
      return;
    }
    targetBookId = draftInput.id;
    autoCreatedBookId = draftInput.id;
  } else {
    const bookExists = state.books.some((book) => String(book?.id || "").trim() === targetBookId);
    if (!bookExists) {
      setState({
        analysisFeedback: {
          type: "error",
          message: `未找到目标书籍：${targetBookId}`,
        },
      });
      return;
    }
  }

  const mode = normalizeAnalysisApplyMode(applyMode);
  if (mode === "overwrite" && !confirmOverwrite) {
    setState({
      analysisFeedback: {
        type: "error",
        message: "overwrite 模式需要先勾选确认项，再执行 Apply Suggestion。",
      },
    });
    return;
  }
  setState({ busy: true, analysisFeedback: null });
  setStatus(mode === "overwrite"
    ? "Applying analysis suggestion (overwrite)..."
    : "Applying analysis suggestion...");

  try {
    const registryPath = `data/${targetBookId}/registry.json`;
    const suggestedPath = `data/${targetBookId}/registry.suggested.json`;
    const registry = await fs.readJson(registryPath);
    const next = buildSuggestedRegistry(registry, suggestion);
    const skippedText = next.skippedUnknown.length
      ? `，未识别模块 ${next.skippedUnknown.join(", ")}`
      : "";
    const autoCreateText = autoCreatedBookId ? `（已自动创建书籍 ${autoCreatedBookId}）` : "";
    if (mode === "overwrite") {
      const writeResult = await fs.writeJson(registryPath, next.registry);
      const seedResult = await ensureSuggestedModuleDataFiles(targetBookId, next.addedModuleIds);
      const backupText = writeResult?.backupPath ? `，备份：${writeResult.backupPath}` : "";
      const seedText = seedResult.created.length ? `，补齐数据模板 ${seedResult.created.length} 个` : "";
      setState({
        analysisFeedback: {
          type: "ok",
          message: `建议已覆盖写入：${registryPath}（新增 ${next.added}）${seedText}${skippedText}${backupText}${autoCreateText}`,
        },
      });
      setStatus("Suggestion applied (overwrite)");
    } else {
      await fs.writeJson(suggestedPath, next.registry);
      setState({
        analysisFeedback: {
          type: "ok",
          message: `建议已安全写入：${suggestedPath}（新增 ${next.added}）${skippedText}${autoCreateText}`,
        },
      });
      setStatus("Suggestion applied");
    }
  } catch (err) {
    setState({
      analysisFeedback: {
        type: "error",
        message: `应用建议失败：${err?.message || String(err)}`,
      },
    });
    setStatus("Apply suggestion failed");
  }

  setState({ busy: false });
}

async function saveAiSettingsFlow(rawSettings) {
  const state = getState();
  if (!state.projectHandle || !state.structure?.ok) return;

  const nextSettings = sanitizeAiSettings(rawSettings);
  setState({ busy: true, aiFeedback: null, newBookFeedback: null, packFeedback: null });
  setStatus("Saving AI settings...");

  try {
    await fs.writeJson(AI_SETTINGS_PATH, nextSettings);
    setState({
      aiSettings: nextSettings,
      aiFeedback: {
        type: "ok",
        message: `AI 配置已保存：${AI_SETTINGS_PATH}`,
      },
    });
    setStatus("AI settings saved");
  } catch (err) {
    setState({
      aiFeedback: {
        type: "error",
        message: `保存 AI 配置失败：${err?.message || String(err)}`,
      },
    });
    setStatus("AI settings save failed");
  }

  setState({ busy: false });
}

function exportAiSettingsFlow() {
  const settings = sanitizeAiSettings(getState().aiSettings || buildDefaultAiSettings());
  const payload = {
    format: "rg-ai-settings",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
  };
  const filename = `ai-settings-${buildTimestampToken()}.json`;
  downloadJsonFile(filename, payload);
  setState({
    aiFeedback: {
      type: "ok",
      message: `AI 配置已导出：${filename}`,
    },
  });
}

async function importAiSettingsFlow(file) {
  if (!file) {
    setState({
      aiFeedback: {
        type: "error",
        message: "未选择 AI 配置文件。",
      },
    });
    return;
  }

  const state = getState();
  if (!state.projectHandle || !state.structure?.ok) {
    setState({
      aiFeedback: {
        type: "error",
        message: "请先打开项目后再导入 AI 配置。",
      },
    });
    return;
  }

  setState({ busy: true, aiFeedback: null });
  setStatus("Importing AI settings...");

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const settings = sanitizeAiSettings(parsed?.settings || parsed);
    await fs.writeJson(AI_SETTINGS_PATH, settings);
    setState({
      aiSettings: settings,
      aiFeedback: {
        type: "ok",
        message: `AI 配置已导入并保存：${AI_SETTINGS_PATH}`,
      },
    });
    setStatus("AI settings imported");
  } catch (err) {
    setState({
      aiFeedback: {
        type: "error",
        message: `导入 AI 配置失败：${err?.message || String(err)}`,
      },
    });
    setStatus("AI settings import failed");
  }

  setState({ busy: false });
}

async function createBookFlow(rawInput) {
  const state = getState();
  if (!state.projectHandle || !state.structure?.ok) return;

  const normalizedInput = {
    ...rawInput,
    id: sanitizeBookId(rawInput?.id || rawInput?.title),
    imageMode: String(state.aiSettings?.image?.mode || "disabled"),
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
    await writeFileWithTrack(
      `assets/images/${artifacts.bookId}/covers/${artifacts.coverFileName || "cover.svg"}`,
      artifacts.coverSvg,
      false
    );

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

    if (artifacts.promptTemplateText) {
      await ensureDirWithTrack(`data/${artifacts.bookId}/prompts`);
      await writeFileWithTrack(
        `data/${artifacts.bookId}/prompts/image-prompts.md`,
        artifacts.promptTemplateText,
        false
      );
    }

    booksWriteResult = await fs.writeJson("data/books.json", { books: nextBooks });

    await refreshProjectData();
    const promptText = artifacts.promptTemplateText ? "，已生成 prompts/image-prompts.md" : "";

    setState({
      newBookFeedback: {
        type: "ok",
        message: `书籍已创建：${artifacts.bookId}${promptText}`,
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

function setDeepRedacted(target, path) {
  const parts = String(path || "").split(".").map((item) => item.trim()).filter(Boolean);
  if (!parts.length) return false;

  let cursor = target;
  for (let i = 0; i < parts.length; i += 1) {
    const key = parts[i];
    if (cursor == null || typeof cursor !== "object" || !(key in cursor)) {
      return false;
    }
    if (i === parts.length - 1) {
      cursor[key] = "***REDACTED***";
      return true;
    }
    cursor = cursor[key];
  }
  return false;
}

function buildCustomRedactedDiagnostic(report, customFields = []) {
  if (!report) return null;
  const cloned = JSON.parse(JSON.stringify(report));
  let matched = 0;
  customFields.forEach((field) => {
    if (setDeepRedacted(cloned, field)) matched += 1;
  });

  cloned.redaction = {
    mode: "custom",
    fields: customFields,
    matched,
  };

  return cloned;
}

function downloadDiagnosticReport(report, mode = "full", customFields = []) {
  if (!report) return;
  const stamp = String(report.generatedAt || new Date().toISOString()).replace(/[:.]/g, "-");
  let output = report;
  let suffix = "full";
  if (mode === "redacted") {
    output = buildRedactedDiagnostic(report);
    suffix = "redacted";
  } else if (mode === "custom") {
    output = buildCustomRedactedDiagnostic(report, customFields);
    suffix = "custom";
  }
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

function downloadImportReportFlow(mode = "full", customFields = []) {
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

  downloadDiagnosticReport(state.packDiagnostic, mode, customFields);
  let label = "完整诊断报告";
  if (mode === "redacted") label = "脱敏诊断报告";
  if (mode === "custom") label = "自定义脱敏诊断报告";
  setState({
    packFeedback: {
      type: "ok",
      message: `${label}已下载。`,
    },
  });
}

function clearRedactionTemplatesFlow(removedCount = 0) {
  const count = Number(removedCount || 0);
  setState({
    packFeedback: {
      type: "ok",
      message: count > 0 ? `最近模板已清空（${count} 条）。` : "最近模板已为空。",
    },
  });
}

function exportRedactionTemplatesFlow(count = 0) {
  const total = Number(count || 0);
  setState({
    packFeedback: {
      type: "ok",
      message: total > 0 ? `模板文件已导出（${total} 条）。` : "模板文件已导出（当前为空列表）。",
    },
  });
}

function summarizeTemplateExamples(list = [], max = 2) {
  const normalized = (Array.isArray(list) ? list : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  if (!normalized.length) return "";
  const picked = normalized.slice(0, max);
  const text = picked.map((item) => `"${item}"`).join("、");
  if (normalized.length > max) {
    return `${text} 等 ${normalized.length} 条`;
  }
  return text;
}

function previewRedactionTemplatesFlow(result) {
  if (!result?.ok) {
    setState({
      packFeedback: {
        type: "error",
        message: result?.error || "预览模板失败。",
      },
    });
    return;
  }

  const mode = result.mode === "merge" ? "merge" : "replace";
  const currentCount = Number(result.currentCount || 0);
  const importedCount = Number(result.importedCount || 0);
  const nextCount = Number(result.nextCount || 0);
  const addedCount = Number(result.addedCount || 0);
  const removedCount = Number(result.removedCount || 0);
  const unchangedCount = Number(result.unchangedCount || 0);
  const addedExamples = summarizeTemplateExamples(result.addedTemplates);
  const removedExamples = summarizeTemplateExamples(result.removedTemplates);
  const detailParts = [];
  if (addedExamples) detailParts.push(`新增示例：${addedExamples}`);
  if (removedExamples) detailParts.push(`移除示例：${removedExamples}`);
  const detailText = detailParts.length ? `（${detailParts.join("；")}）` : "";
  const truncated = result.truncated ? "，超出上限部分将被截断" : "";

  setState({
    packFeedback: {
      type: "ok",
      message: `模板导入预览（mode ${mode}）：当前 ${currentCount} 条，导入 ${importedCount} 条，结果 ${nextCount} 条（新增 ${addedCount}，移除 ${removedCount}，保留 ${unchangedCount}）${detailText}${truncated}。`,
    },
  });
}

function importRedactionTemplatesFlow(result) {
  if (!result?.ok) {
    setState({
      packFeedback: {
        type: "error",
        message: result?.error || "导入模板失败。",
      },
    });
    return;
  }
  const count = Number(result.count || 0);
  const mode = result.mode === "merge" ? "merge" : "replace";
  const addedCount = Number(result.addedCount || 0);
  const removedCount = Number(result.removedCount || 0);
  const unchangedCount = Number(result.unchangedCount || 0);
  const addedExamples = summarizeTemplateExamples(result.addedTemplates);
  const removedExamples = summarizeTemplateExamples(result.removedTemplates);
  const detailParts = [];
  if (addedExamples) detailParts.push(`新增示例：${addedExamples}`);
  if (removedExamples) detailParts.push(`移除示例：${removedExamples}`);
  const detailText = detailParts.length ? `，${detailParts.join("；")}` : "";
  const truncated = result.truncated ? "，超出上限部分已截断" : "";
  setState({
    packFeedback: {
      type: "ok",
      message: `模板导入完成（${count} 条，mode ${mode}，新增 ${addedCount}，移除 ${removedCount}，保留 ${unchangedCount}${detailText}${truncated}）。`,
    },
  });
}

async function exportSiteFlow(options = {}) {
  const scope = String(options.scope || "all");
  const selectedBookIds = Array.isArray(options.selectedBookIds) ? options.selectedBookIds : [];
  const subsetAssetMode = String(options.subsetAssetMode || "balanced");
  const missingAssetFallbackMode = String(options.missingAssetFallbackMode || "report-only");
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
      missingAssetFallbackMode: scope === "selected" ? missingAssetFallbackMode : "report-only",
    });

    const scopeText = result.scope === "subset"
      ? `subset(${result.selectedBookIds.length}本/${result.subsetAssetMode})`
      : "full";
    const missingText = Array.isArray(result.missingAssets) && result.missingAssets.length
      ? `，missingAssets ${result.missingAssets.length}`
      : "";
    const missingGroupCount = result.missingAssetsByGroup
      ? Object.keys(result.missingAssetsByGroup).length
      : 0;
    const groupText = missingGroupCount ? `，groups ${missingGroupCount}` : "";
    const missingCategoryCount = result.missingAssetsByCategory
      ? Object.keys(result.missingAssetsByCategory).filter(
        (key) => Number(result.missingAssetsByCategory[key] || 0) > 0
      ).length
      : 0;
    const categoryText = missingCategoryCount ? `，categories ${missingCategoryCount}` : "";
    const fallbackText = result.missingAssetFallbackMode && result.missingAssetFallbackMode !== "report-only"
      ? `，fallback ${result.missingAssetFallbackMode}`
      : "";
    const fallbackGenerated = Number(result.generatedFallbackAssets || 0);
    const fallbackGeneratedText = fallbackGenerated > 0 ? `，generated ${fallbackGenerated}` : "";
    const reportText = result.missingAssetsReportAdded ? "，含 MISSING-ASSETS.txt" : "";
    setState({
      packFeedback: {
        type: "ok",
        message: `发布包导出成功：${result.filename}（scope ${scopeText}，files ${result.files}，books ${result.books}${missingText}${groupText}${categoryText}${fallbackText}${fallbackGeneratedText}${reportText}）`,
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
