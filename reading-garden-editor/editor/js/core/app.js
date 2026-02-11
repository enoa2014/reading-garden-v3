import { createFileSystemAdapter } from "./filesystem.js";
import { getState, setState, subscribe } from "./state.js";
import { createRecoveryStore } from "./recovery-store.js";
import {
  validateBooksData,
  validateProjectStructure,
  validateErrorList,
  validateNewBookInput,
  validateRegistryData,
} from "./validator.js";
import { normalizePath, sanitizeBookId } from "./path-resolver.js";
import { buildNewBookArtifacts } from "./book-template.js";
import { analyzeBookText, buildAnalysisSuggestionReport } from "./analysis-assistant.js";
import { renderDashboard } from "../ui/dashboard.js";
import { ImportMergeService } from "../packaging/import-merge-service.js";
import { BookPackService } from "../packaging/book-pack-service.js";
import { SitePackService } from "../packaging/site-pack-service.js";
import { createPreviewManager } from "./managers/preview-manager.js";
import { createProjectManager } from "./managers/project-manager.js";
import { createBookManager } from "./managers/book-manager.js";
import { createAiManager } from "./managers/ai-manager.js";
import { createImportExportManager } from "./managers/import-export-manager.js";

const fs = createFileSystemAdapter();
const mergeService = new ImportMergeService();
const bookPackService = new BookPackService({ fs, mergeService });
const sitePackService = new SitePackService({ fs });
const recoveryStore = createRecoveryStore();
const AI_SETTINGS_PATH = "reading-garden-editor/config/ai-settings.json";
const RECOVERY_SNAPSHOT_DEBOUNCE_MS = 500;
const RECOVERY_SNAPSHOT_INTERVAL_MS = 30_000;
const RECOVERY_HISTORY_POLICY_STORAGE_KEY = "rg.editor.recoveryHistoryPolicy";
const PREVIEW_AUTO_REFRESH_STORAGE_KEY = "rg.editor.previewAutoRefresh";
const DEFAULT_RECOVERY_HISTORY_MAX_AGE_DAYS = 30;
const RECOVERY_HISTORY_MAX_AGE_DAY_OPTIONS = [0, 7, 30, 90, 180];
let recoverySnapshotDebounceTimer = null;
let recoverySnapshotIntervalId = null;
let recoverySnapshotSaving = false;
let suppressRecoverySnapshotBeforeTs = 0;
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
const CREATE_BOOK_TEMPLATE_PRESETS = {
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
const CREATE_BOOK_TEMPLATE_PRESET_LABELS = {
  minimal: "minimal（仅阅读）",
  standard: "standard（阅读+人物+主题）",
  teaching: "teaching（全模块）",
  custom: "custom（手动）",
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

function normalizeRecoveryHistoryMaxAgeDays(rawDays = DEFAULT_RECOVERY_HISTORY_MAX_AGE_DAYS) {
  const parsed = Number(rawDays);
  if (!Number.isFinite(parsed)) return DEFAULT_RECOVERY_HISTORY_MAX_AGE_DAYS;
  const days = Math.max(0, Math.trunc(parsed));
  if (RECOVERY_HISTORY_MAX_AGE_DAY_OPTIONS.includes(days)) return days;
  return DEFAULT_RECOVERY_HISTORY_MAX_AGE_DAYS;
}

function recoveryHistoryDaysToMs(days = DEFAULT_RECOVERY_HISTORY_MAX_AGE_DAYS) {
  const normalized = normalizeRecoveryHistoryMaxAgeDays(days);
  if (normalized <= 0) return null;
  return normalized * 24 * 60 * 60 * 1000;
}

function applyRecoveryHistoryPolicy(maxAgeDays = DEFAULT_RECOVERY_HISTORY_MAX_AGE_DAYS) {
  const normalizedDays = normalizeRecoveryHistoryMaxAgeDays(maxAgeDays);
  recoveryStore.setHistoryPolicy({
    historyMaxAgeMs: recoveryHistoryDaysToMs(normalizedDays),
  });
  return normalizedDays;
}

function buildDefaultRecoveryHistoryPolicyPayload() {
  return {
    defaultMaxAgeDays: DEFAULT_RECOVERY_HISTORY_MAX_AGE_DAYS,
    projects: {},
  };
}

function normalizeRecoveryHistoryPolicyPayload(rawPayload) {
  const safe = rawPayload && typeof rawPayload === "object" ? rawPayload : {};
  const projectsRaw = safe.projects && typeof safe.projects === "object" ? safe.projects : {};
  const projects = {};
  Object.entries(projectsRaw).forEach(([key, value]) => {
    const projectName = String(key || "").trim();
    if (!projectName) return;
    projects[projectName] = normalizeRecoveryHistoryMaxAgeDays(value);
  });
  return {
    defaultMaxAgeDays: normalizeRecoveryHistoryMaxAgeDays(
      Object.prototype.hasOwnProperty.call(safe, "defaultMaxAgeDays")
        ? safe.defaultMaxAgeDays
        : safe.maxAgeDays
    ),
    projects,
  };
}

function readRecoveryHistoryPolicyPayloadFromStorage() {
  try {
    const raw = window.localStorage.getItem(RECOVERY_HISTORY_POLICY_STORAGE_KEY);
    if (!raw) return buildDefaultRecoveryHistoryPolicyPayload();
    const parsed = JSON.parse(raw);
    return normalizeRecoveryHistoryPolicyPayload(parsed);
  } catch {
    return buildDefaultRecoveryHistoryPolicyPayload();
  }
}

function writeRecoveryHistoryPolicyPayloadToStorage(payload) {
  try {
    window.localStorage.setItem(
      RECOVERY_HISTORY_POLICY_STORAGE_KEY,
      JSON.stringify(normalizeRecoveryHistoryPolicyPayload(payload))
    );
  } catch {
    // ignore storage errors in private mode or blocked storage contexts
  }
}

function normalizePreviewAutoRefreshEnabled(rawValue, fallback = true) {
  if (typeof rawValue === "boolean") return rawValue;
  if (rawValue == null) return fallback;
  const value = String(rawValue || "").trim().toLowerCase();
  if (!value) return fallback;
  if (["0", "false", "off", "no"].includes(value)) return false;
  if (["1", "true", "on", "yes"].includes(value)) return true;
  return fallback;
}

function buildDefaultPreviewAutoRefreshPolicyPayload() {
  return {
    defaultEnabled: true,
    projects: {},
  };
}

function normalizePreviewAutoRefreshPolicyPayload(rawPayload) {
  if (!rawPayload || typeof rawPayload !== "object") {
    return {
      defaultEnabled: normalizePreviewAutoRefreshEnabled(rawPayload, true),
      projects: {},
    };
  }
  const safe = rawPayload;
  const projectsRaw = safe.projects && typeof safe.projects === "object" ? safe.projects : {};
  const projects = {};
  Object.entries(projectsRaw).forEach(([key, value]) => {
    const projectName = String(key || "").trim();
    if (!projectName) return;
    projects[projectName] = normalizePreviewAutoRefreshEnabled(value, true);
  });
  return {
    defaultEnabled: normalizePreviewAutoRefreshEnabled(
      Object.prototype.hasOwnProperty.call(safe, "defaultEnabled")
        ? safe.defaultEnabled
        : safe.enabled,
      true
    ),
    projects,
  };
}

function readPreviewAutoRefreshPolicyPayloadFromStorage() {
  try {
    const raw = window.localStorage.getItem(PREVIEW_AUTO_REFRESH_STORAGE_KEY);
    if (raw == null) return buildDefaultPreviewAutoRefreshPolicyPayload();
    const parsed = JSON.parse(raw);
    return normalizePreviewAutoRefreshPolicyPayload(parsed);
  } catch {
    try {
      const raw = window.localStorage.getItem(PREVIEW_AUTO_REFRESH_STORAGE_KEY);
      return normalizePreviewAutoRefreshPolicyPayload(raw);
    } catch {
      return buildDefaultPreviewAutoRefreshPolicyPayload();
    }
  }
}

function writePreviewAutoRefreshPolicyPayloadToStorage(payload) {
  try {
    window.localStorage.setItem(
      PREVIEW_AUTO_REFRESH_STORAGE_KEY,
      JSON.stringify(normalizePreviewAutoRefreshPolicyPayload(payload))
    );
  } catch {
    // ignore storage errors in private mode or blocked storage contexts
  }
}

function resolvePreviewAutoRefreshEnabledForProject(projectName = "", payload = null) {
  const safeProjectName = String(projectName || "").trim();
  const policyPayload = payload
    ? normalizePreviewAutoRefreshPolicyPayload(payload)
    : readPreviewAutoRefreshPolicyPayloadFromStorage();
  if (
    safeProjectName
    && Object.prototype.hasOwnProperty.call(policyPayload.projects, safeProjectName)
  ) {
    return normalizePreviewAutoRefreshEnabled(policyPayload.projects[safeProjectName], true);
  }
  return normalizePreviewAutoRefreshEnabled(policyPayload.defaultEnabled, true);
}

function resolvePreviewAutoRefreshPolicyScopeForProject(projectName = "", payload = null) {
  const safeProjectName = String(projectName || "").trim();
  if (!safeProjectName) return "global";
  const policyPayload = payload
    ? normalizePreviewAutoRefreshPolicyPayload(payload)
    : readPreviewAutoRefreshPolicyPayloadFromStorage();
  return Object.prototype.hasOwnProperty.call(policyPayload.projects, safeProjectName)
    ? "project"
    : "global";
}

function applyPreviewAutoRefreshPreferenceForProject(projectName = "", payload = null) {
  const policyPayload = payload
    ? normalizePreviewAutoRefreshPolicyPayload(payload)
    : readPreviewAutoRefreshPolicyPayloadFromStorage();
  return {
    enabled: resolvePreviewAutoRefreshEnabledForProject(projectName, policyPayload),
    scope: resolvePreviewAutoRefreshPolicyScopeForProject(projectName, policyPayload),
    policyPayload,
  };
}

function writePreviewAutoRefreshPreference(nextValue, projectName = "") {
  const normalized = normalizePreviewAutoRefreshEnabled(nextValue, true);
  const safeProjectName = String(projectName || "").trim();
  const payload = readPreviewAutoRefreshPolicyPayloadFromStorage();
  if (safeProjectName) {
    payload.projects[safeProjectName] = normalized;
  } else {
    payload.defaultEnabled = normalized;
  }
  writePreviewAutoRefreshPolicyPayloadToStorage(payload);
  return {
    enabled: normalized,
    scope: safeProjectName ? "project" : "global",
    policyPayload: payload,
  };
}

function clearProjectPreviewAutoRefreshPreferenceInStorage(projectName = "") {
  const safeProjectName = String(projectName || "").trim();
  const payload = readPreviewAutoRefreshPolicyPayloadFromStorage();
  const existed = safeProjectName && Object.prototype.hasOwnProperty.call(payload.projects, safeProjectName);
  if (safeProjectName && existed) {
    delete payload.projects[safeProjectName];
    writePreviewAutoRefreshPolicyPayloadToStorage(payload);
  }
  return {
    existed: Boolean(existed),
    scope: resolvePreviewAutoRefreshPolicyScopeForProject(safeProjectName, payload),
    policyPayload: payload,
  };
}

function normalizePreviewAutoRefreshImportMode(rawMode = "replace") {
  const mode = String(rawMode || "replace").trim().toLowerCase();
  return mode === "merge" ? "merge" : "replace";
}

function normalizePolicyImportOptions(rawOptions = {}) {
  if (rawOptions === true) {
    return { includeDefaultOnMerge: true };
  }
  const safe = rawOptions && typeof rawOptions === "object" ? rawOptions : {};
  return {
    includeDefaultOnMerge: safe.includeDefaultOnMerge === true,
  };
}

function mergePreviewAutoRefreshPolicyPayload(basePayload, importedPayload, mode = "replace", rawOptions = {}) {
  const normalizedMode = normalizePreviewAutoRefreshImportMode(mode);
  const options = normalizePolicyImportOptions(rawOptions);
  const base = normalizePreviewAutoRefreshPolicyPayload(basePayload);
  const incoming = normalizePreviewAutoRefreshPolicyPayload(importedPayload);
  if (normalizedMode === "replace") {
    return {
      mode: normalizedMode,
      payload: incoming,
    };
  }
  return {
    mode: normalizedMode,
    payload: {
      defaultEnabled: options.includeDefaultOnMerge ? incoming.defaultEnabled : base.defaultEnabled,
      projects: {
        ...base.projects,
        ...incoming.projects,
      },
    },
  };
}

function resolveRecoveryHistoryMaxAgeDaysForProject(projectName = "", payload = null) {
  const safeProjectName = String(projectName || "").trim();
  const policyPayload = payload
    ? normalizeRecoveryHistoryPolicyPayload(payload)
    : readRecoveryHistoryPolicyPayloadFromStorage();
  if (
    safeProjectName
    && Object.prototype.hasOwnProperty.call(policyPayload.projects, safeProjectName)
  ) {
    return normalizeRecoveryHistoryMaxAgeDays(policyPayload.projects[safeProjectName]);
  }
  return normalizeRecoveryHistoryMaxAgeDays(policyPayload.defaultMaxAgeDays);
}

function resolveRecoveryHistoryPolicyScopeForProject(projectName = "", payload = null) {
  const safeProjectName = String(projectName || "").trim();
  if (!safeProjectName) return "global";
  const policyPayload = payload
    ? normalizeRecoveryHistoryPolicyPayload(payload)
    : readRecoveryHistoryPolicyPayloadFromStorage();
  return Object.prototype.hasOwnProperty.call(policyPayload.projects, safeProjectName)
    ? "project"
    : "global";
}

function applyRecoveryHistoryPolicyForProject(projectName = "", payload = null) {
  const policyPayload = payload
    ? normalizeRecoveryHistoryPolicyPayload(payload)
    : readRecoveryHistoryPolicyPayloadFromStorage();
  const maxAgeDays = resolveRecoveryHistoryMaxAgeDaysForProject(projectName, policyPayload);
  const scope = resolveRecoveryHistoryPolicyScopeForProject(projectName, policyPayload);
  return {
    maxAgeDays: applyRecoveryHistoryPolicy(maxAgeDays),
    scope,
    policyPayload,
  };
}

function writeRecoveryHistoryPolicyToStorage(
  maxAgeDays = DEFAULT_RECOVERY_HISTORY_MAX_AGE_DAYS,
  projectName = ""
) {
  const normalized = normalizeRecoveryHistoryMaxAgeDays(maxAgeDays);
  const safeProjectName = String(projectName || "").trim();
  const payload = readRecoveryHistoryPolicyPayloadFromStorage();
  if (safeProjectName) {
    payload.projects[safeProjectName] = normalized;
  } else {
    payload.defaultMaxAgeDays = normalized;
  }
  writeRecoveryHistoryPolicyPayloadToStorage(payload);
  return {
    maxAgeDays: normalized,
    scope: safeProjectName ? "project" : "global",
    policyPayload: payload,
  };
}

function clearProjectRecoveryHistoryPolicyInStorage(projectName = "") {
  const safeProjectName = String(projectName || "").trim();
  const payload = readRecoveryHistoryPolicyPayloadFromStorage();
  const existed = safeProjectName && Object.prototype.hasOwnProperty.call(payload.projects, safeProjectName);
  if (safeProjectName && existed) {
    delete payload.projects[safeProjectName];
    writeRecoveryHistoryPolicyPayloadToStorage(payload);
  }
  return {
    existed: Boolean(existed),
    scope: resolveRecoveryHistoryPolicyScopeForProject(safeProjectName, payload),
    policyPayload: payload,
  };
}

function normalizeTemplatePreset(rawPreset = "") {
  const preset = String(rawPreset || "").trim().toLowerCase();
  if (!preset) return "";
  if (preset === "custom") return "custom";
  if (Object.prototype.hasOwnProperty.call(CREATE_BOOK_TEMPLATE_PRESETS, preset)) return preset;
  return "custom";
}

function resolveCreateBookModuleIncludes(rawInput = {}) {
  const templatePreset = normalizeTemplatePreset(rawInput?.templatePreset);
  const customFlags = {
    includeCharacters: rawInput?.includeCharacters !== false,
    includeThemes: rawInput?.includeThemes !== false,
    includeTimeline: rawInput?.includeTimeline === true,
    includeInteractive: rawInput?.includeInteractive === true,
  };
  if (!templatePreset || templatePreset === "custom") {
    return {
      templatePreset: templatePreset || "custom",
      ...customFlags,
    };
  }
  return {
    templatePreset,
    ...CREATE_BOOK_TEMPLATE_PRESETS[templatePreset],
  };
}

function formatTemplatePresetForFeedback(preset = "custom") {
  const normalized = normalizeTemplatePreset(preset) || "custom";
  return CREATE_BOOK_TEMPLATE_PRESET_LABELS[normalized] || CREATE_BOOK_TEMPLATE_PRESET_LABELS.custom;
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

function buildRecoverySnapshotPayload(state) {
  const safeState = state && typeof state === "object" ? state : {};
  return {
    format: "rg-editor-recovery-snapshot",
    version: 1,
    projectName: String(safeState.projectName || ""),
    ui: {
      previewBookId: String(safeState.previewBookId || ""),
      previewDevice: String(safeState.previewDevice || "desktop"),
      previewAutoRefresh: safeState.previewAutoRefresh !== false,
    },
    analysisSuggestion: safeState.analysisSuggestion && typeof safeState.analysisSuggestion === "object"
      ? safeState.analysisSuggestion
      : null,
  };
}

async function saveRecoverySnapshotFlow() {
  const state = getState();
  if (!state.projectName || !state.structure?.ok) return;
  if (recoverySnapshotSaving) return;
  recoverySnapshotSaving = true;
  try {
    const payload = buildRecoverySnapshotPayload(state);
    await recoveryStore.saveLatest(payload);
  } catch {
    // recovery storage is best-effort only
  } finally {
    recoverySnapshotSaving = false;
  }
}

function scheduleRecoverySnapshot() {
  if (Date.now() < suppressRecoverySnapshotBeforeTs) return;
  if (recoverySnapshotDebounceTimer) {
    clearTimeout(recoverySnapshotDebounceTimer);
  }
  recoverySnapshotDebounceTimer = setTimeout(() => {
    saveRecoverySnapshotFlow();
  }, RECOVERY_SNAPSHOT_DEBOUNCE_MS);
}

function startRecoverySnapshotTicker() {
  if (recoverySnapshotIntervalId) {
    clearInterval(recoverySnapshotIntervalId);
  }
  recoverySnapshotIntervalId = setInterval(() => {
    saveRecoverySnapshotFlow();
  }, RECOVERY_SNAPSHOT_INTERVAL_MS);
}

async function restoreRecoverySnapshotForProject(books = []) {
  try {
    const state = getState();
    if (!state.projectName) return;
    const history = await recoveryStore.loadProjectHistory(state.projectName);
    const snapshot = await recoveryStore.loadByProject(state.projectName)
      || await recoveryStore.loadLatest();
    if (!snapshot || typeof snapshot !== "object") {
      setState({ recoveryHistory: Array.isArray(history) ? history : [] });
      return;
    }
    if (snapshot.projectName && snapshot.projectName !== state.projectName) {
      setState({ recoveryHistory: Array.isArray(history) ? history : [] });
      return;
    }

    const ui = snapshot.ui && typeof snapshot.ui === "object" ? snapshot.ui : {};
    const previewPatch = buildPreviewStatePatch(state, books, {
      previewBookId: String(ui.previewBookId || ""),
      previewDevice: String(ui.previewDevice || state.previewDevice || "desktop"),
    });
    const patch = {
      ...previewPatch,
      previewAutoRefresh: ui.previewAutoRefresh !== false,
      recoveryFeedback: {
        type: "ok",
        message: `已恢复会话快照：${String(snapshot.savedAt || "unknown")}`,
      },
      recoveryHistory: Array.isArray(history) ? history : [],
    };
    if (snapshot.analysisSuggestion && typeof snapshot.analysisSuggestion === "object") {
      patch.analysisSuggestion = snapshot.analysisSuggestion;
    }
    const previewAutoRefreshPolicy = writePreviewAutoRefreshPreference(
      patch.previewAutoRefresh,
      state.projectName
    );
    patch.previewAutoRefresh = previewAutoRefreshPolicy.enabled;
    patch.previewAutoRefreshPolicyScope = previewAutoRefreshPolicy.scope;
    setState(patch);
  } catch {
    // recovery storage is best-effort only
  }
}

function restoreRecoveryHistorySnapshotFlow(savedAt = "") {
  const state = getState();
  const stamp = String(savedAt || "").trim();
  if (!stamp) {
    setState({
      recoveryFeedback: {
        type: "error",
        message: "请选择要恢复的历史快照。",
      },
    });
    return;
  }
  const history = Array.isArray(state.recoveryHistory) ? state.recoveryHistory : [];
  const snapshot = history.find((item) => String(item?.savedAt || "") === stamp);
  if (!snapshot) {
    setState({
      recoveryFeedback: {
        type: "error",
        message: "未找到对应历史快照，可能已被清理。",
      },
    });
    return;
  }

  const ui = snapshot.ui && typeof snapshot.ui === "object" ? snapshot.ui : {};
  const previewPatch = buildPreviewStatePatch(state, state.books, {
    previewBookId: String(ui.previewBookId || ""),
    previewDevice: String(ui.previewDevice || state.previewDevice || "desktop"),
  });
  const patch = {
    ...previewPatch,
    previewAutoRefresh: ui.previewAutoRefresh !== false,
    recoveryFeedback: {
      type: "ok",
      message: `已恢复历史快照：${stamp}`,
    },
  };
  if (snapshot.analysisSuggestion && typeof snapshot.analysisSuggestion === "object") {
    patch.analysisSuggestion = snapshot.analysisSuggestion;
  }
  const previewAutoRefreshPolicy = writePreviewAutoRefreshPreference(
    patch.previewAutoRefresh,
    state.projectName
  );
  patch.previewAutoRefresh = previewAutoRefreshPolicy.enabled;
  patch.previewAutoRefreshPolicyScope = previewAutoRefreshPolicy.scope;
  setState(patch);
  setStatus("Recovery snapshot restored");
}

async function updateRecoveryHistoryPolicyFlow(maxAgeDays = DEFAULT_RECOVERY_HISTORY_MAX_AGE_DAYS) {
  try {
    const state = getState();
    const projectName = String(state.projectName || "").trim();
    const normalizedDays = applyRecoveryHistoryPolicy(maxAgeDays);
    const policy = writeRecoveryHistoryPolicyToStorage(normalizedDays, projectName);
    const patch = {
      recoveryHistoryMaxAgeDays: normalizedDays,
      recoveryHistoryPolicyScope: policy.scope,
      recoveryFeedback: {
        type: "ok",
        message: normalizedDays > 0
          ? (projectName
              ? `项目快照自动清理阈值已更新为 ${normalizedDays} 天：${projectName}`
              : `会话快照自动清理阈值已更新为 ${normalizedDays} 天。`)
          : (projectName
              ? `项目快照自动清理已关闭：${projectName}`
              : "会话快照自动清理已关闭。"),
      },
    };
    if (projectName) {
      const history = await recoveryStore.loadProjectHistory(projectName);
      patch.recoveryHistory = Array.isArray(history) ? history : [];
    }
    setState(patch);
    setStatus("Recovery policy updated");
  } catch (err) {
    setState({
      recoveryFeedback: {
        type: "error",
        message: `更新快照清理阈值失败：${err?.message || String(err)}`,
      },
    });
    setStatus("Recovery policy update failed");
  }
}

async function resetRecoveryHistoryPolicyFlow() {
  try {
    const state = getState();
    const projectName = String(state.projectName || "").trim();
    if (!projectName) {
      setState({
        recoveryFeedback: {
          type: "error",
          message: "当前未打开项目，无法重置为全局默认策略。",
        },
      });
      return;
    }
    const cleared = clearProjectRecoveryHistoryPolicyInStorage(projectName);
    const defaultDays = resolveRecoveryHistoryMaxAgeDaysForProject("", cleared.policyPayload);
    const normalizedDays = applyRecoveryHistoryPolicy(defaultDays);
    const history = await recoveryStore.loadProjectHistory(projectName);
    setState({
      recoveryHistoryMaxAgeDays: normalizedDays,
      recoveryHistoryPolicyScope: "global",
      recoveryHistory: Array.isArray(history) ? history : [],
      recoveryFeedback: {
        type: "ok",
        message: cleared.existed
          ? `已恢复项目默认策略：${projectName}（全局 ${normalizedDays} 天）`
          : `当前项目未设置覆盖策略，保持全局默认：${normalizedDays} 天`,
      },
    });
    setStatus("Recovery policy reset");
  } catch (err) {
    setState({
      recoveryFeedback: {
        type: "error",
        message: `重置项目快照策略失败：${err?.message || String(err)}`,
      },
    });
    setStatus("Recovery policy reset failed");
  }
}

function exportRecoveryHistoryPolicyFlow() {
  const payload = readRecoveryHistoryPolicyPayloadFromStorage();
  const filename = `recovery-history-policy-${buildTimestampToken()}.json`;
  downloadJsonFile(filename, {
    format: "rg-recovery-history-policy",
    version: 1,
    exportedAt: new Date().toISOString(),
    policy: payload,
  });
  setState({
    recoveryFeedback: {
      type: "ok",
      message: `会话快照策略已导出：${filename}`,
    },
  });
  setStatus("Recovery policy exported");
}

function normalizeRecoveryPolicyImportMode(rawMode = "replace") {
  const mode = String(rawMode || "replace").trim().toLowerCase();
  return mode === "merge" ? "merge" : "replace";
}

function mergeRecoveryHistoryPolicyPayload(basePayload, importedPayload, mode = "replace", rawOptions = {}) {
  const normalizedMode = normalizeRecoveryPolicyImportMode(mode);
  const options = normalizePolicyImportOptions(rawOptions);
  const base = normalizeRecoveryHistoryPolicyPayload(basePayload);
  const incoming = normalizeRecoveryHistoryPolicyPayload(importedPayload);
  if (normalizedMode === "replace") {
    return {
      mode: normalizedMode,
      payload: incoming,
    };
  }
  return {
    mode: normalizedMode,
    payload: {
      defaultMaxAgeDays: options.includeDefaultOnMerge ? incoming.defaultMaxAgeDays : base.defaultMaxAgeDays,
      projects: {
        ...base.projects,
        ...incoming.projects,
      },
    },
  };
}

async function importRecoveryHistoryPolicyFlow(file, mode = "replace", rawOptions = {}) {
  if (!file) {
    setState({
      recoveryFeedback: {
        type: "error",
        message: "未选择会话快照策略文件。",
      },
    });
    return;
  }

  setState({ busy: true, recoveryFeedback: null });
  setStatus("Importing recovery policy...");
  try {
    const options = normalizePolicyImportOptions(rawOptions);
    const text = await file.text();
    const parsed = JSON.parse(text);
    const current = readRecoveryHistoryPolicyPayloadFromStorage();
    const incoming = normalizeRecoveryHistoryPolicyPayload(parsed?.policy || parsed);
    const merged = mergeRecoveryHistoryPolicyPayload(current, incoming, mode, options);
    writeRecoveryHistoryPolicyPayloadToStorage(merged.payload);
    const state = getState();
    const projectName = String(state.projectName || "").trim();
    const applied = applyRecoveryHistoryPolicyForProject(projectName, merged.payload);
    const importedProjects = Object.keys(incoming.projects || {}).length;
    const defaultBehaviorText = merged.mode === "merge"
      ? (options.includeDefaultOnMerge ? "default=imported" : "default=local")
      : "default=imported";
    const patch = {
      recoveryHistoryMaxAgeDays: applied.maxAgeDays,
      recoveryHistoryPolicyScope: applied.scope,
      recoveryFeedback: {
        type: "ok",
        message: projectName
          ? `会话快照策略已导入（mode=${merged.mode}, ${defaultBehaviorText}, projects=${importedProjects}）并应用到项目：${projectName}`
          : `会话快照策略已导入（mode=${merged.mode}, ${defaultBehaviorText}, projects=${importedProjects}）。`,
      },
    };
    if (projectName) {
      const history = await recoveryStore.loadProjectHistory(projectName);
      patch.recoveryHistory = Array.isArray(history) ? history : [];
    }
    setState(patch);
    setStatus("Recovery policy imported");
  } catch (err) {
    setState({
      recoveryFeedback: {
        type: "error",
        message: `导入会话快照策略失败：${err?.message || String(err)}`,
      },
    });
    setStatus("Recovery policy import failed");
  }
  setState({ busy: false });
}

function exportEditorPolicyBundleFlow() {
  const filename = `editor-policy-bundle-${buildTimestampToken()}.json`;
  downloadJsonFile(filename, {
    format: "rg-editor-policy-bundle",
    version: 1,
    exportedAt: new Date().toISOString(),
    recoveryHistoryPolicy: readRecoveryHistoryPolicyPayloadFromStorage(),
    previewAutoRefreshPolicy: readPreviewAutoRefreshPolicyPayloadFromStorage(),
  });
  setState({
    recoveryFeedback: {
      type: "ok",
      message: `组合策略包已导出：${filename}`,
    },
  });
  setStatus("Editor policy bundle exported");
}

function readEditorPolicyBundleSections(parsed) {
  const safe = parsed && typeof parsed === "object" ? parsed : {};
  let recoverySource = safe.recoveryHistoryPolicy
    ?? safe.recoveryPolicy
    ?? safe.recovery;
  let previewSource = safe.previewAutoRefreshPolicy
    ?? safe.previewPolicy
    ?? safe.preview;
  const format = String(safe.format || "").trim();
  const policySource = safe.policy;

  // Backward compatibility: accept old single-policy export files.
  if (!recoverySource && !previewSource && policySource && typeof policySource === "object") {
    if (format === "rg-recovery-history-policy") {
      recoverySource = policySource;
    } else if (format === "rg-preview-auto-refresh-policy") {
      previewSource = policySource;
    } else {
      if (
        Object.prototype.hasOwnProperty.call(policySource, "defaultMaxAgeDays")
        || Object.prototype.hasOwnProperty.call(policySource, "maxAgeDays")
      ) {
        recoverySource = policySource;
      }
      if (
        Object.prototype.hasOwnProperty.call(policySource, "defaultEnabled")
        || Object.prototype.hasOwnProperty.call(policySource, "enabled")
      ) {
        previewSource = policySource;
      }
    }
  }

  // Backward compatibility: accept direct policy objects without wrapper.
  if (!recoverySource && !previewSource) {
    if (
      Object.prototype.hasOwnProperty.call(safe, "defaultMaxAgeDays")
      || Object.prototype.hasOwnProperty.call(safe, "maxAgeDays")
    ) {
      recoverySource = safe;
    }
    if (
      Object.prototype.hasOwnProperty.call(safe, "defaultEnabled")
      || Object.prototype.hasOwnProperty.call(safe, "enabled")
    ) {
      previewSource = safe;
    }
  }

  return {
    recovery: recoverySource?.policy || recoverySource || null,
    preview: previewSource?.policy || previewSource || null,
  };
}

async function importEditorPolicyBundleFlow(file, mode = "replace", rawOptions = {}) {
  if (!file) {
    setState({
      recoveryFeedback: {
        type: "error",
        message: "未选择组合策略包文件。",
      },
    });
    return;
  }

  setState({ busy: true, recoveryFeedback: null });
  setStatus("Importing editor policy bundle...");
  try {
    const options = normalizePolicyImportOptions(rawOptions);
    const text = await file.text();
    const parsed = JSON.parse(text);
    const sections = readEditorPolicyBundleSections(parsed);
    if (!sections.recovery && !sections.preview) {
      throw new Error("文件中未找到可导入的策略数据");
    }

    const currentRecovery = readRecoveryHistoryPolicyPayloadFromStorage();
    const currentPreview = readPreviewAutoRefreshPolicyPayloadFromStorage();
    const incomingRecovery = sections.recovery
      ? normalizeRecoveryHistoryPolicyPayload(sections.recovery)
      : currentRecovery;
    const incomingPreview = sections.preview
      ? normalizePreviewAutoRefreshPolicyPayload(sections.preview)
      : currentPreview;
    const mergedRecovery = mergeRecoveryHistoryPolicyPayload(currentRecovery, incomingRecovery, mode, options);
    const mergedPreview = mergePreviewAutoRefreshPolicyPayload(currentPreview, incomingPreview, mode, options);

    writeRecoveryHistoryPolicyPayloadToStorage(mergedRecovery.payload);
    writePreviewAutoRefreshPolicyPayloadToStorage(mergedPreview.payload);

    const state = getState();
    const projectName = String(state.projectName || "").trim();
    const appliedRecovery = applyRecoveryHistoryPolicyForProject(projectName, mergedRecovery.payload);
    const appliedPreview = applyPreviewAutoRefreshPreferenceForProject(projectName, mergedPreview.payload);
    const importedRecoveryProjects = sections.recovery
      ? Object.keys(incomingRecovery.projects || {}).length
      : 0;
    const importedPreviewProjects = sections.preview
      ? Object.keys(incomingPreview.projects || {}).length
      : 0;
    const normalizedMode = normalizeRecoveryPolicyImportMode(mode);
    const defaultBehaviorText = normalizedMode === "merge"
      ? (options.includeDefaultOnMerge ? "defaults=imported" : "defaults=local")
      : "defaults=imported";

    const patch = {
      recoveryHistoryMaxAgeDays: appliedRecovery.maxAgeDays,
      recoveryHistoryPolicyScope: appliedRecovery.scope,
      previewAutoRefresh: appliedPreview.enabled,
      previewAutoRefreshPolicyScope: appliedPreview.scope,
      recoveryFeedback: {
        type: "ok",
        message: projectName
          ? `组合策略包已导入（mode=${normalizedMode}, ${defaultBehaviorText}, recoveryProjects=${importedRecoveryProjects}, previewProjects=${importedPreviewProjects}）并应用到项目：${projectName}`
          : `组合策略包已导入（mode=${normalizedMode}, ${defaultBehaviorText}, recoveryProjects=${importedRecoveryProjects}, previewProjects=${importedPreviewProjects}）。`,
      },
    };
    if (projectName) {
      const history = await recoveryStore.loadProjectHistory(projectName);
      patch.recoveryHistory = Array.isArray(history) ? history : [];
    }
    setState(patch);
    setStatus("Editor policy bundle imported");
  } catch (err) {
    setState({
      recoveryFeedback: {
        type: "error",
        message: `导入组合策略包失败：${err?.message || String(err)}`,
      },
    });
    setStatus("Editor policy bundle import failed");
  }
  setState({ busy: false });
}

async function removeRecoveryHistorySnapshotFlow(savedAt = "") {
  const state = getState();
  const stamp = String(savedAt || "").trim();
  const projectName = String(state.projectName || "").trim();
  if (!stamp) {
    setState({
      recoveryFeedback: {
        type: "error",
        message: "请选择要删除的历史快照。",
      },
    });
    return;
  }
  if (!projectName) {
    setState({
      recoveryFeedback: {
        type: "error",
        message: "当前项目无效，无法删除历史快照。",
      },
    });
    return;
  }

  setState({ busy: true, recoveryFeedback: null });
  setStatus("Removing recovery snapshot...");
  try {
    const result = await recoveryStore.removeProjectHistorySnapshot(projectName, stamp);
    const history = Array.isArray(result?.history)
      ? result.history
      : await recoveryStore.loadProjectHistory(projectName);
    if (!result?.removed) {
      setState({
        recoveryHistory: history,
        recoveryFeedback: {
          type: "error",
          message: "未找到要删除的历史快照，可能已被其他操作清理。",
        },
      });
      setStatus("Recovery snapshot missing");
    } else {
      setState({
        recoveryHistory: history,
        recoveryFeedback: {
          type: "ok",
          message: `已删除历史快照：${stamp}`,
        },
      });
      setStatus("Recovery snapshot removed");
    }
  } catch (err) {
    setState({
      recoveryFeedback: {
        type: "error",
        message: `删除历史快照失败：${err?.message || String(err)}`,
      },
    });
    setStatus("Recovery snapshot remove failed");
  }
  setState({ busy: false });
}

async function clearRecoverySnapshotFlow() {
  const state = getState();
  const projectName = String(state.projectName || "").trim();
  setState({ busy: true, recoveryFeedback: null });
  setStatus("Clearing recovery snapshot...");
  try {
    if (projectName) {
      await recoveryStore.clearByProject(projectName);
    }
    await recoveryStore.clearLatest();
    suppressRecoverySnapshotBeforeTs = Date.now() + 1500;
    setState({
      recoveryFeedback: {
        type: "ok",
        message: projectName
          ? `项目会话快照已清理：${projectName}`
          : "会话快照已清理。",
      },
      recoveryHistory: [],
    });
    setStatus("Recovery snapshot cleared");
  } catch (err) {
    setState({
      recoveryFeedback: {
        type: "error",
        message: `清理会话快照失败：${err?.message || String(err)}`,
      },
    });
    setStatus("Clear recovery snapshot failed");
  }
  setState({ busy: false });
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
      onUpdatePreviewState: updatePreviewStateFlow,
      onUpdateRecoveryPolicyImportOptions: updateRecoveryPolicyImportOptionsFlow,
      onResetPreviewAutoRefreshPolicy: resetPreviewAutoRefreshPreferenceFlow,
      onExportPreviewAutoRefreshPolicy: exportPreviewAutoRefreshPolicyFlow,
      onImportPreviewAutoRefreshPolicy: importPreviewAutoRefreshPolicyFlow,
      onRefreshPreview: refreshPreviewFlow,
      onClearRecoverySnapshot: clearRecoverySnapshotFlow,
      onRestoreRecoverySnapshot: restoreRecoveryHistorySnapshotFlow,
      onRemoveRecoverySnapshot: removeRecoveryHistorySnapshotFlow,
      onUpdateRecoveryHistoryPolicy: updateRecoveryHistoryPolicyFlow,
      onResetRecoveryHistoryPolicy: resetRecoveryHistoryPolicyFlow,
      onExportRecoveryHistoryPolicy: exportRecoveryHistoryPolicyFlow,
      onImportRecoveryHistoryPolicy: importRecoveryHistoryPolicyFlow,
      onExportEditorPolicyBundle: exportEditorPolicyBundleFlow,
      onImportEditorPolicyBundle: importEditorPolicyBundleFlow,
      onExportPack: exportPackFlow,
      onImportPack: importPackFlow,
      onApplyManualMergeSuggestion: applyManualMergeSuggestionFlow,
      onDownloadValidationReport: downloadValidationReportFlow,
      onExportSite: exportSiteFlow,
      onDownloadImportReport: downloadImportReportFlow,
      onClearRedactionTemplates: clearRedactionTemplatesFlow,
      onExportRedactionTemplates: exportRedactionTemplatesFlow,
      onPreviewRedactionTemplates: previewRedactionTemplatesFlow,
      onImportRedactionTemplates: importRedactionTemplatesFlow,
      onNewBookPresetFeedback: newBookPresetFeedbackFlow,
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

const previewManager = createPreviewManager({
  getState,
  setState,
  setStatus,
  writePreviewAutoRefreshPreference,
  clearProjectPreviewAutoRefreshPreferenceInStorage,
  applyPreviewAutoRefreshPreferenceForProject,
  readPreviewAutoRefreshPolicyPayloadFromStorage,
  normalizePolicyImportOptions,
  normalizePreviewAutoRefreshPolicyPayload,
  mergePreviewAutoRefreshPolicyPayload,
  writePreviewAutoRefreshPolicyPayloadToStorage,
  buildTimestampToken,
  downloadJsonFile,
});

let aiManager = null;
const projectManager = createProjectManager({
  fs,
  getState,
  setState,
  setStatus,
  setNavEnabled,
  render,
  validateBooksData,
  validateProjectStructure,
  validateErrorList,
  validateRegistryData,
  normalizePath,
  buildPreviewStatePatch: (...args) => previewManager.buildPreviewStatePatch(...args),
  buildDefaultAiSettings,
  applyRecoveryHistoryPolicyForProject,
  applyPreviewAutoRefreshPreferenceForProject,
  loadAiSettingsFlow: (...args) => aiManager.loadAiSettingsFlow(...args),
  restoreRecoverySnapshotForProject,
});

const bookManager = createBookManager({
  fs,
  getState,
  setState,
  setStatus,
  resolveCreateBookModuleIncludes,
  sanitizeBookId,
  validateNewBookInput,
  buildNewBookArtifacts,
  refreshProjectData: (...args) => projectManager.refreshProjectData(...args),
  buildPreviewStatePatch: (...args) => previewManager.buildPreviewStatePatch(...args),
  formatTemplatePresetForFeedback,
});

aiManager = createAiManager({
  fs,
  getState,
  setState,
  setStatus,
  analyzeBookText,
  buildAnalysisSuggestionReport,
  buildDefaultAiSettings,
  sanitizeAiSettings,
  AI_SETTINGS_PATH,
  buildTimestampToken,
  downloadJsonFile,
  sanitizeBookId,
  MODULE_TEMPLATE_MAP,
  ensureSuggestedModuleDataFiles,
  createBookFlow: (...args) => bookManager.createBookFlow(...args),
  touchPreviewAfterWrite: (...args) => previewManager.touchPreviewAfterWrite(...args),
});

const importExportManager = createImportExportManager({
  getState,
  setState,
  setStatus,
  bookPackService,
  mergeService,
  sitePackService,
  sanitizeBookId,
  refreshProjectData: (...args) => projectManager.refreshProjectData(...args),
  touchPreviewAfterWrite: (...args) => previewManager.touchPreviewAfterWrite(...args),
});

const {
  buildPreviewStatePatch,
  updateRecoveryPolicyImportOptionsFlow,
  updatePreviewStateFlow,
  resetPreviewAutoRefreshPreferenceFlow,
  exportPreviewAutoRefreshPolicyFlow,
  importPreviewAutoRefreshPolicyFlow,
  refreshPreviewFlow,
  touchPreviewAfterWrite,
} = previewManager;

const {
  resolveFromBookDir,
  refreshProjectData,
  openProjectFlow,
} = projectManager;

const {
  createBookFlow,
  newBookPresetFeedbackFlow,
} = bookManager;

const {
  loadAiSettingsFlow,
  downloadValidationReportFlow,
  analyzeBookTextFlow,
  downloadAnalysisSuggestionFlow,
  applyAnalysisSuggestionFlow,
  saveAiSettingsFlow,
  exportAiSettingsFlow,
  importAiSettingsFlow,
} = aiManager;

const {
  exportPackFlow,
  importPackFlow,
  applyManualMergeSuggestionFlow,
  downloadImportReportFlow,
  clearRedactionTemplatesFlow,
  exportRedactionTemplatesFlow,
  previewRedactionTemplatesFlow,
  importRedactionTemplatesFlow,
  exportSiteFlow,
} = importExportManager;

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
  const historyPolicy = applyRecoveryHistoryPolicyForProject("");
  const previewAutoRefreshPolicy = applyPreviewAutoRefreshPreferenceForProject("");
  setState({
    recoveryHistoryMaxAgeDays: historyPolicy.maxAgeDays,
    recoveryHistoryPolicyScope: historyPolicy.scope,
    previewAutoRefresh: previewAutoRefreshPolicy.enabled,
    previewAutoRefreshPolicyScope: previewAutoRefreshPolicy.scope,
  });
  bindNav();
  detectMode();
  startRecoverySnapshotTicker();

  const openBtn = qs("#openProjectBtn");
  openBtn?.addEventListener("click", openProjectFlow);

  subscribe("*", () => {
    render();
    scheduleRecoverySnapshot();
  });
  setNavEnabled(false);
  render();
}

boot();
