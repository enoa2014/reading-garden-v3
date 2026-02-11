import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const REPORT_PATH = path.resolve(ROOT, process.env.EDITOR_REGRESSION_REPORT || "tmp/editor-regression-report.json");
const TEXT_ENCODER = new TextEncoder();
const ASSET_REF_PATTERN = /assets\/[a-zA-Z0-9_./-]+(?:\?[^\s"'`)]+)?/g;
const FULL_INCLUDE_ROOTS = [
  "index.html",
  "book.html",
  "css",
  "js",
  "data",
  "assets",
  "design-system",
];
const SUBSET_CORE_ROOTS = [
  "index.html",
  "book.html",
  "css",
  "js",
  "design-system",
];
const PACK_STATS_CATEGORY_THRESHOLD_ENVS = {
  "book-module": "EDITOR_PACK_STATS_MAX_MISSING_BOOK_MODULE",
  "book-cover": "EDITOR_PACK_STATS_MAX_MISSING_BOOK_COVER",
  "file-ref": "EDITOR_PACK_STATS_MAX_MISSING_FILE_REF",
  unclassified: "EDITOR_PACK_STATS_MAX_MISSING_UNCLASSIFIED",
};
const PACK_STATS_CATEGORY_THRESHOLD_PRESETS = {
  custom: {},
  balanced: {
    "book-module": 0,
  },
  strict: {
    "book-module": 0,
    "book-cover": 0,
    "file-ref": 0,
    unclassified: 0,
  },
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERT_FAILED: ${message}`);
  }
}

function isTruthyEnv(rawValue) {
  const value = String(rawValue || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function parseMaxMissingAssetsThreshold(rawValue, envName = "EDITOR_PACK_STATS_MAX_MISSING_ASSETS") {
  const raw = String(rawValue ?? "").trim();
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) {
    throw new Error(`ASSERT_FAILED: ${envName} must be a non-negative integer`);
  }
  return Number(raw);
}

function normalizeCategoryThresholdPreset(rawValue) {
  const preset = String(rawValue || "custom").trim().toLowerCase();
  if (!preset) return "custom";
  if (!Object.prototype.hasOwnProperty.call(PACK_STATS_CATEGORY_THRESHOLD_PRESETS, preset)) {
    throw new Error(
      "ASSERT_FAILED: EDITOR_PACK_STATS_CATEGORY_THRESHOLD_PRESET must be one of custom/balanced/strict"
    );
  }
  return preset;
}

function enforceMissingAssetsThreshold(missingAssetsCount, maxMissingAssets) {
  if (maxMissingAssets == null) return;
  const missing = Number(missingAssetsCount || 0);
  if (missing > maxMissingAssets) {
    throw new Error(
      `ASSERT_FAILED: subset-minimal missingAssets ${missing} exceeds threshold ${maxMissingAssets}`
    );
  }
}

function enforceCategoryMissingAssetsThreshold(category, missingAssetsCount, maxMissingAssets) {
  if (maxMissingAssets == null) return;
  const missing = Number(missingAssetsCount || 0);
  if (missing > maxMissingAssets) {
    throw new Error(
      `ASSERT_FAILED: missingAssetsByCategory.${category} ${missing} exceeds threshold ${maxMissingAssets}`
    );
  }
}

function resolveMissingAssetsThresholdsByMode() {
  const globalThreshold = parseMaxMissingAssetsThreshold(process.env.EDITOR_PACK_STATS_MAX_MISSING_ASSETS);
  const subsetBalanced = parseMaxMissingAssetsThreshold(
    process.env.EDITOR_PACK_STATS_MAX_MISSING_ASSETS_SUBSET_BALANCED,
    "EDITOR_PACK_STATS_MAX_MISSING_ASSETS_SUBSET_BALANCED"
  );
  const subsetMinimal = parseMaxMissingAssetsThreshold(
    process.env.EDITOR_PACK_STATS_MAX_MISSING_ASSETS_SUBSET_MINIMAL,
    "EDITOR_PACK_STATS_MAX_MISSING_ASSETS_SUBSET_MINIMAL"
  );

  const byMode = {
    "subset-balanced": {
      enabled: subsetBalanced != null || globalThreshold != null,
      maxMissingAssets: subsetBalanced == null ? globalThreshold : subsetBalanced,
      source: subsetBalanced != null ? "env" : (globalThreshold != null ? "global" : "disabled"),
    },
    "subset-minimal": {
      enabled: subsetMinimal != null || globalThreshold != null,
      maxMissingAssets: subsetMinimal == null ? globalThreshold : subsetMinimal,
      source: subsetMinimal != null ? "env" : (globalThreshold != null ? "global" : "disabled"),
    },
  };

  return {
    global: {
      enabled: globalThreshold != null,
      maxMissingAssets: globalThreshold == null ? null : globalThreshold,
    },
    byMode,
  };
}

function readCategoryMissingAssetsThresholdsFromEnv() {
  const preset = normalizeCategoryThresholdPreset(process.env.EDITOR_PACK_STATS_CATEGORY_THRESHOLD_PRESET);
  const presetValues = PACK_STATS_CATEGORY_THRESHOLD_PRESETS[preset] || {};
  const out = {};
  Object.entries(PACK_STATS_CATEGORY_THRESHOLD_ENVS).forEach(([category, envName]) => {
    const parsedFromEnv = parseMaxMissingAssetsThreshold(process.env[envName], envName);
    let parsed = parsedFromEnv;
    if (parsed == null && Object.prototype.hasOwnProperty.call(presetValues, category)) {
      parsed = Number(presetValues[category]);
    }
    out[category] = {
      enabled: parsed != null,
      maxMissingAssets: parsed == null ? null : parsed,
      source: parsedFromEnv != null
        ? "env"
        : (Object.prototype.hasOwnProperty.call(presetValues, category) ? `preset:${preset}` : "disabled"),
    };
  });
  return {
    preset,
    thresholds: out,
  };
}

function normalizePathValue(input) {
  const raw = String(input || "").replaceAll("\\", "/");
  const out = [];
  raw.split("/").forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") {
      if (out.length) out.pop();
      return;
    }
    out.push(part);
  });
  return out.join("/");
}

function isLikelyTextFile(filePath) {
  const lower = String(filePath || "").toLowerCase();
  return (
    lower.endsWith(".html")
    || lower.endsWith(".css")
    || lower.endsWith(".js")
    || lower.endsWith(".json")
    || lower.endsWith(".svg")
    || lower.endsWith(".txt")
    || lower.endsWith(".md")
    || lower.endsWith(".xml")
    || lower.endsWith(".csv")
  );
}

async function pathExists(relativePath) {
  try {
    await stat(path.resolve(ROOT, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function collectRuntimeFiles(relativePath, outputSet) {
  const normalizedPath = normalizePathValue(relativePath);
  if (!normalizedPath) return;
  const absPath = path.resolve(ROOT, normalizedPath);
  let stats = null;
  try {
    stats = await stat(absPath);
  } catch {
    return;
  }

  if (stats.isFile()) {
    outputSet.add(normalizedPath);
    return;
  }

  let entries = [];
  try {
    entries = await readdir(absPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const childPath = normalizePathValue(`${normalizedPath}/${entry.name}`);
    if (entry.isDirectory()) {
      // eslint-disable-next-line no-await-in-loop
      await collectRuntimeFiles(childPath, outputSet);
    } else if (entry.isFile()) {
      outputSet.add(childPath);
    }
  }
}

async function collectFilesFromRoots(roots) {
  const fileSet = new Set();
  for (const root of roots) {
    // eslint-disable-next-line no-await-in-loop
    await collectRuntimeFiles(root, fileSet);
  }
  return fileSet;
}

async function sumFileBytes(fileSet) {
  let total = 0;
  for (const relPath of fileSet) {
    // eslint-disable-next-line no-await-in-loop
    const stats = await stat(path.resolve(ROOT, relPath));
    total += stats.size;
  }
  return total;
}

function extractAssetRefsFromText(text) {
  const refs = new Set();
  const matches = String(text || "").match(ASSET_REF_PATTERN) || [];
  matches.forEach((item) => {
    const clean = String(item).split("?")[0];
    if (clean.startsWith("assets/")) refs.add(clean);
  });
  return refs;
}

function collectStrings(value, output) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, output));
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStrings(item, output));
    return;
  }
  if (typeof value === "string") output.push(value);
}

function normalizeAssetPath(bookId, rawPath) {
  const raw = String(rawPath || "").trim();
  if (!raw) return "";
  if (raw.startsWith("assets/")) return raw.split("?")[0];
  if (raw.includes("assets/")) return raw.slice(raw.indexOf("assets/")).split("?")[0];
  const normalized = normalizePathValue(`data/${bookId}/${raw}`);
  const marker = normalized.indexOf("assets/");
  if (marker >= 0) return normalized.slice(marker).split("?")[0];
  return "";
}

function rememberAssetSource(assetSources, assetPath, source) {
  if (!assetSources || !assetPath) return;
  if (!assetSources.has(assetPath)) {
    assetSources.set(assetPath, new Set());
  }
  if (source) {
    assetSources.get(assetPath).add(source);
  }
}

function detectMissingAssetCategory(source) {
  const raw = String(source || "").trim();
  if (!raw) return "unclassified";
  if (raw.startsWith("book:")) {
    const parts = raw.split(":");
    const scope = parts[2] || "";
    if (scope === "cover") return "book-cover";
    if (scope === "module") return "book-module";
  }
  if (raw.startsWith("file:")) return "file-ref";
  return "unclassified";
}

function buildMissingAssetsCategorySummary(missingAssetDetails = []) {
  const out = {
    "book-cover": 0,
    "book-module": 0,
    "file-ref": 0,
    unclassified: 0,
  };

  missingAssetDetails.forEach((item) => {
    const sources = Array.isArray(item?.sources) && item.sources.length
      ? item.sources
      : ["unclassified"];
    const categories = new Set(sources.map((source) => detectMissingAssetCategory(source)));
    categories.forEach((category) => {
      out[category] = Number(out[category] || 0) + 1;
    });
  });
  return out;
}

function bookIdFromAssetPath(assetPath, allBookIdsSet) {
  const marker = "assets/images/";
  if (!assetPath.startsWith(marker)) return null;
  const candidate = assetPath.slice(marker.length).split("/")[0];
  if (!candidate) return null;
  return allBookIdsSet.has(candidate) ? candidate : null;
}

function buildEdgeOneGuide() {
  return [
    "# EdgeOne 部署说明",
    "",
    "1. 解压 `*.rgsite.zip` 到本地目录。",
    "2. 登录腾讯云 EdgeOne 控制台，创建或进入对应站点。",
    "3. 在静态资源托管/对象存储绑定中上传解压后的全部文件。",
    "4. 确认站点根目录包含 `index.html` 和 `book.html`。",
    "5. 发布后访问域名，并检查首页与书籍详情页是否可正常加载。",
  ].join("\n");
}

function buildMissingAssetsReport(missingAssets = [], missingAssetsByCategory = {}) {
  const lines = [
    "# Missing Assets Report",
    "",
    `count: ${missingAssets.length}`,
    "",
  ];
  lines.push("## Category Summary");
  lines.push("");
  Object.keys(missingAssetsByCategory || {})
    .sort()
    .forEach((category) => {
      lines.push(`- ${category}: ${Number(missingAssetsByCategory[category] || 0)}`);
    });
  lines.push("");
  missingAssets.forEach((item) => lines.push(`- ${item}`));
  return lines.join("\n");
}

function createManifestForStats({
  booksCount,
  selectedBookIds,
  subsetAssetMode,
  missingAssets,
  missingAssetsByCategory,
  filesCount,
  totalBytes,
}) {
  return {
    format: "rgsite",
    formatVersion: "1.2.0",
    booksCount,
    entry: "index.html",
    buildTime: "1970-01-01T00:00:00.000Z",
    includeEditor: false,
    selectedBookIds,
    subsetAssetMode,
    missingAssets,
    missingAssetsByCategory,
    checks: {
      schema: true,
      assets: missingAssets.length === 0,
      crossRefs: true,
      pathRewrite: true,
    },
    files: {
      count: filesCount,
      totalBytes,
    },
    checksumMode: "none",
    redactedFiles: [],
    checksums: {},
  };
}

function toPercent(part, base) {
  if (!base) return 0;
  return Number(((part / base) * 100).toFixed(2));
}

async function importModuleAsDataUrl(relativePath) {
  const absPath = path.resolve(ROOT, relativePath);
  const source = await readFile(absPath, "utf8");
  const url = `data:text/javascript;base64,${Buffer.from(source, "utf8").toString("base64")}`;
  return import(url);
}

async function testPackUtils() {
  const mod = await importModuleAsDataUrl("reading-garden-editor/editor/js/packaging/pack-utils.js");
  assert(mod.isSafeZipEntryPath("book/data/chapters.json"), "safe zip path should pass");
  assert(!mod.isSafeZipEntryPath("../book/data/chapters.json"), "path traversal should fail");
  assert(!mod.isSafeZipEntryPath("book\\data\\a.json"), "backslash path should fail");
  assert(mod.isSafeRelativePath("images/cover.svg"), "safe relative path should pass");
  assert(!mod.isSafeRelativePath("../images/cover.svg"), "unsafe relative path should fail");
  assert(mod.hasAllowedPrefix("book/data/a.json", ["book/data"]), "prefix allow should pass");
  assert(!mod.hasAllowedPrefix("evil/a.json", ["book/data"]), "prefix allow should fail");

  const digest = await mod.sha256Text("reading-garden");
  if (digest != null) {
    assert(/^sha256:[a-f0-9]{64}$/.test(digest), "sha256Text output format invalid");
  }
}

async function testMergeService() {
  const mod = await importModuleAsDataUrl("reading-garden-editor/editor/js/packaging/import-merge-service.js");
  const service = new mod.ImportMergeService();

  const noConflictPlan = service.planMerge({
    incomingBookId: "new-book",
    existingBooks: [{ id: "old-book" }],
  });
  const noConflictDecision = service.applyMergePlan({
    plan: noConflictPlan,
    existingBooks: [{ id: "old-book" }],
    strategy: "rename",
  });
  assert(noConflictDecision.shouldImport, "no conflict should import");
  assert(noConflictDecision.targetBookId === "new-book", "no conflict target id mismatch");

  const conflictPlan = service.planMerge({
    incomingBookId: "wave",
    existingBooks: [{ id: "wave" }, { id: "wave-imported-1" }],
  });
  const renameDecision = service.applyMergePlan({
    plan: conflictPlan,
    existingBooks: [{ id: "wave" }, { id: "wave-imported-1" }],
    strategy: "rename",
  });
  assert(renameDecision.shouldImport, "rename should import");
  assert(renameDecision.targetBookId === "wave-imported-2", "rename id generation mismatch");

  const skipDecision = service.applyMergePlan({
    plan: conflictPlan,
    existingBooks: [{ id: "wave" }],
    strategy: "skip",
  });
  assert(!skipDecision.shouldImport, "skip should not import");
}

async function testSitePackSourceMarkers() {
  const absPath = path.resolve(ROOT, "reading-garden-editor/editor/js/packaging/site-pack-service.js");
  const source = await readFile(absPath, "utf8");
  assert(source.includes("selectedBookIds"), "site pack should support selectedBookIds");
  assert(source.includes("scope: subset"), "site pack should expose subset scope");
  assert(source.includes("data/books.json"), "site pack should handle books.json rewrite in subset");
  assert(source.includes("subsetAssetMode"), "site pack should support subsetAssetMode");
  assert(source.includes("missingAssets"), "site pack should report missingAssets in subset");
  assert(source.includes("missingAssetsByGroup"), "site pack should report grouped missing assets");
  assert(source.includes("missingAssetsByCategory"), "site pack should report categorized missing assets");
  assert(source.includes("missingAssetFallbackMode"), "site pack should expose missing-asset fallback mode");
  assert(source.includes("svg-placeholder"), "site pack should support svg placeholder fallback");
  assert(source.includes("buildMissingAssetFallbackPlan"), "site pack should plan fallback placeholders");
  assert(source.includes("MISSING-ASSETS.txt"), "site pack should emit missing assets report file");
  assert(source.includes("## Category Summary"), "missing assets report should include category summary");
  assert(source.includes("## Fallback"), "missing assets report should include fallback summary");
  assert(source.includes("## Groups"), "missing assets report should include grouped section");
}

async function testDiagnosticSourceMarkers() {
  const appSource = await readFile(
    path.resolve(ROOT, "reading-garden-editor/editor/js/core/app.js"),
    "utf8"
  );
  const dashboardSource = await readFile(
    path.resolve(ROOT, "reading-garden-editor/editor/js/ui/dashboard.js"),
    "utf8"
  );
  const stateSource = await readFile(
    path.resolve(ROOT, "reading-garden-editor/editor/js/core/state.js"),
    "utf8"
  );
  const cssSource = await readFile(
    path.resolve(ROOT, "reading-garden-editor/editor/css/editor.css"),
    "utf8"
  );
  const validatorSource = await readFile(
    path.resolve(ROOT, "reading-garden-editor/editor/js/core/validator.js"),
    "utf8"
  );
  const recoveryStoreSource = await readFile(
    path.resolve(ROOT, "reading-garden-editor/editor/js/core/recovery-store.js"),
    "utf8"
  );
  const analysisSource = await readFile(
    path.resolve(ROOT, "reading-garden-editor/editor/js/core/analysis-assistant.js"),
    "utf8"
  );
  const bookTemplateSource = await readFile(
    path.resolve(ROOT, "reading-garden-editor/editor/js/core/book-template.js"),
    "utf8"
  );
  const edgeonePreflightSource = await readFile(
    path.resolve(ROOT, "scripts/edgeone-preflight.mjs"),
    "utf8"
  );
  const edgeonePreflightShellSource = await readFile(
    path.resolve(ROOT, "scripts/edgeone-preflight.sh"),
    "utf8"
  );
  const edgeonePreflightSelftestSource = await readFile(
    path.resolve(ROOT, "scripts/edgeone-preflight-selftest.sh"),
    "utf8"
  );
  assert(appSource.includes("buildCustomRedactedDiagnostic"), "app should support custom redaction");
  assert(appSource.includes("saveAiSettingsFlow"), "app should support saving ai settings");
  assert(appSource.includes("exportAiSettingsFlow"), "app should support exporting ai settings");
  assert(appSource.includes("importAiSettingsFlow"), "app should support importing ai settings");
  assert(appSource.includes("analyzeBookTextFlow"), "app should support text analysis flow");
  assert(appSource.includes("downloadAnalysisSuggestionFlow"), "app should support analysis suggestion download");
  assert(appSource.includes("applyAnalysisSuggestionFlow"), "app should support applying analysis suggestion");
  assert(appSource.includes("updatePreviewStateFlow"), "app should support updating preview state");
  assert(appSource.includes("refreshPreviewFlow"), "app should support refreshing preview");
  assert(appSource.includes("touchPreviewAfterWrite"), "app should support auto refreshing preview after writes");
  assert(appSource.includes("buildPreviewUrl"), "app should build preview urls");
  assert(appSource.includes("resetPreviewAutoRefreshPreferenceFlow"), "app should support resetting preview auto-refresh policy to global");
  assert(appSource.includes("manual 预检查"), "app should support manual merge preview feedback");
  assert(appSource.includes("Manual merge plan ready"), "app should set status for manual merge preview");
  assert(appSource.includes("applyManualMergeSuggestionFlow"), "app should support applying recommended manual merge strategy");
  assert(appSource.includes("onApplyManualMergeSuggestion"), "app should wire manual merge apply handler");
  assert(appSource.includes("downloadValidationReportFlow"), "app should support validation report download");
  assert(appSource.includes("buildValidationReport"), "app should build validation report payload");
  assert(appSource.includes("validateRegistryData"), "app should validate registry with structured rules");
  assert(appSource.includes("createRecoveryStore"), "app should initialize recovery store");
  assert(appSource.includes("scheduleRecoverySnapshot"), "app should schedule recovery snapshots");
  assert(appSource.includes("restoreRecoverySnapshotForProject"), "app should restore recovery snapshot");
  assert(appSource.includes("loadByProject"), "app should prefer project-scoped recovery snapshot");
  assert(appSource.includes("loadProjectHistory"), "app should load project recovery history");
  assert(appSource.includes("restoreRecoveryHistorySnapshotFlow"), "app should support restoring recovery snapshot history");
  assert(appSource.includes("removeRecoveryHistorySnapshotFlow"), "app should support removing recovery snapshot history item");
  assert(appSource.includes("updateRecoveryHistoryPolicyFlow"), "app should support updating recovery history policy");
  assert(appSource.includes("resetRecoveryHistoryPolicyFlow"), "app should support resetting recovery history policy");
  assert(appSource.includes("clearRecoverySnapshotFlow"), "app should support clearing recovery snapshot");
  assert(appSource.includes("onRestoreRecoverySnapshot"), "app should wire recovery history restore handler");
  assert(appSource.includes("onRemoveRecoverySnapshot"), "app should wire recovery history remove handler");
  assert(appSource.includes("onUpdateRecoveryHistoryPolicy"), "app should wire recovery history policy handler");
  assert(appSource.includes("onResetRecoveryHistoryPolicy"), "app should wire recovery history policy reset handler");
  assert(appSource.includes("onExportRecoveryHistoryPolicy"), "app should wire recovery history policy export handler");
  assert(appSource.includes("onImportRecoveryHistoryPolicy"), "app should wire recovery history policy import handler");
  assert(appSource.includes("suppressRecoverySnapshotBeforeTs"), "app should support suppressing immediate resave after clear");
  assert(appSource.includes("RECOVERY_HISTORY_POLICY_STORAGE_KEY"), "app should persist recovery history policy key");
  assert(appSource.includes("PREVIEW_AUTO_REFRESH_STORAGE_KEY"), "app should persist preview auto-refresh preference key");
  assert(appSource.includes("applyRecoveryHistoryPolicy"), "app should apply recovery history policy");
  assert(appSource.includes("readPreviewAutoRefreshPolicyPayloadFromStorage"), "app should read preview auto-refresh policy payload");
  assert(appSource.includes("writePreviewAutoRefreshPreference"), "app should write preview auto-refresh preference");
  assert(appSource.includes("applyPreviewAutoRefreshPreferenceForProject"), "app should support project-scoped preview auto-refresh preference");
  assert(appSource.includes("clearProjectPreviewAutoRefreshPreferenceInStorage"), "app should support clearing project-scoped preview auto-refresh policy");
  assert(appSource.includes("normalizePreviewAutoRefreshImportMode"), "app should normalize preview auto-refresh policy import mode");
  assert(appSource.includes("normalizePolicyImportOptions"), "app should normalize shared policy import options");
  assert(appSource.includes("mergePreviewAutoRefreshPolicyPayload"), "app should support merging preview auto-refresh policy payloads");
  assert(appSource.includes("exportPreviewAutoRefreshPolicyFlow"), "app should support exporting preview auto-refresh policy");
  assert(appSource.includes("importPreviewAutoRefreshPolicyFlow"), "app should support importing preview auto-refresh policy");
  assert(appSource.includes("previewAutoRefreshPolicyScope"), "app should track preview auto-refresh policy scope");
  assert(appSource.includes("applyRecoveryHistoryPolicyForProject"), "app should support project-scoped recovery history policy");
  assert(appSource.includes("resolveRecoveryHistoryPolicyScopeForProject"), "app should resolve recovery policy scope");
  assert(appSource.includes("clearProjectRecoveryHistoryPolicyInStorage"), "app should support clearing project-scoped recovery policy");
  assert(appSource.includes("exportRecoveryHistoryPolicyFlow"), "app should support exporting recovery history policy");
  assert(appSource.includes("importRecoveryHistoryPolicyFlow"), "app should support importing recovery history policy");
  assert(appSource.includes("normalizeRecoveryPolicyImportMode"), "app should normalize recovery policy import mode");
  assert(appSource.includes("mergeRecoveryHistoryPolicyPayload"), "app should support merging recovery policy payloads");
  assert(appSource.includes("mode=${merged.mode}"), "app should surface recovery policy import mode in feedback");
  assert(appSource.includes("defaultBehaviorText"), "app should surface import default behavior in policy feedback");
  assert(appSource.includes("exportEditorPolicyBundleFlow"), "app should support exporting editor policy bundle");
  assert(appSource.includes("importEditorPolicyBundleFlow"), "app should support importing editor policy bundle");
  assert(appSource.includes("readEditorPolicyBundleSections"), "app should parse editor policy bundle sections");
  assert(appSource.includes("rg-recovery-history-policy"), "app should support legacy recovery policy file import via bundle flow");
  assert(appSource.includes("rg-preview-auto-refresh-policy"), "app should support legacy preview policy file import via bundle flow");
  assert(appSource.includes("newBookPresetFeedbackFlow"), "app should support new-book preset feedback updates");
  assert(appSource.includes("onNewBookPresetFeedback"), "app should wire new-book preset feedback handler");
  assert(appSource.includes("onResetPreviewAutoRefreshPolicy"), "app should wire preview auto-refresh policy reset handler");
  assert(appSource.includes("onUpdateRecoveryPolicyImportOptions"), "app should wire policy import option updates");
  assert(appSource.includes("onExportPreviewAutoRefreshPolicy"), "app should wire preview auto-refresh policy export handler");
  assert(appSource.includes("onImportPreviewAutoRefreshPolicy"), "app should wire preview auto-refresh policy import handler");
  assert(appSource.includes("onExportEditorPolicyBundle"), "app should wire editor policy bundle export handler");
  assert(appSource.includes("onImportEditorPolicyBundle"), "app should wire editor policy bundle import handler");
  assert(appSource.includes("defaultMaxAgeDays"), "app should store default recovery max-age policy");
  assert(appSource.includes("payload.projects"), "app should persist per-project recovery policy entries");
  assert(appSource.includes("normalizeAnalysisApplyMode"), "app should normalize analysis apply mode");
  assert(appSource.includes("resolveCreateBookModuleIncludes"), "app should normalize create-book module includes");
  assert(appSource.includes("formatTemplatePresetForFeedback"), "app should format template preset feedback");
  assert(appSource.includes("templatePreset"), "app should track template preset in create-book flow");
  assert(appSource.includes("buildAutoCreateBookInputFromSuggestion"), "app should support auto-creating target book from suggestion");
  assert(appSource.includes("await createBookFlow(draftInput)"), "app should auto-create book when target is missing");
  assert(appSource.includes("includeTimeline: resolveSuggestionInclude"), "app should include timeline suggestion in auto create");
  assert(appSource.includes("includeInteractive: resolveSuggestionInclude"), "app should include interactive suggestion in auto create");
  assert(appSource.includes("confirmOverwrite"), "app should support overwrite confirmation flag");
  assert(appSource.includes("overwrite 模式需要先勾选确认项"), "app should block overwrite when confirmation is missing");
  assert(appSource.includes("ensureSuggestedModuleDataFiles"), "app should support seeding suggested module data");
  assert(appSource.includes("buildSuggestedModuleDataSeed"), "app should define default data seeds for suggested modules");
  assert(appSource.includes("registry.suggested.json"), "app should write safe suggested registry file");
  assert(appSource.includes("backupPath"), "app should surface overwrite backup path");
  assert(appSource.includes("image-prompts.md"), "app should support image prompt template output");
  assert(appSource.includes("AI_SETTINGS_PATH"), "app should define ai settings path");
  assert(appSource.includes("clearRedactionTemplatesFlow"), "app should support clearing redaction templates");
  assert(appSource.includes("previewRedactionTemplatesFlow"), "app should support previewing redaction templates");
  assert(appSource.includes("importRedactionTemplatesFlow"), "app should support importing redaction templates");
  assert(appSource.includes("exportRedactionTemplatesFlow"), "app should support exporting redaction templates");
  assert(appSource.includes("模板导入预览"), "app should surface template preview feedback");
  assert(appSource.includes("新增示例"), "app should surface template preview detail examples");
  assert(dashboardSource.includes('data-mode="custom"'), "dashboard should expose custom report action");
  assert(dashboardSource.includes("recentRedactionTemplate"), "dashboard should support recent redaction templates");
  assert(dashboardSource.includes("aiSettingsForm"), "dashboard should expose ai settings form");
  assert(dashboardSource.includes("export-ai-settings-btn"), "dashboard should expose ai settings export action");
  assert(dashboardSource.includes("import-ai-settings-btn"), "dashboard should expose ai settings import action");
  assert(dashboardSource.includes("analysisForm"), "dashboard should expose text analysis form");
  assert(dashboardSource.includes("renderPreviewPanel"), "dashboard should render preview panel");
  assert(dashboardSource.includes("previewForm"), "dashboard should expose preview form");
  assert(dashboardSource.includes("preview-refresh-btn"), "dashboard should expose preview refresh action");
  assert(dashboardSource.includes("previewAutoRefresh"), "dashboard should expose preview auto refresh toggle");
  assert(dashboardSource.includes("自动刷新来源："), "dashboard should show preview auto-refresh policy source");
  assert(dashboardSource.includes("preview-reset-auto-refresh-policy-btn"), "dashboard should expose preview auto-refresh policy reset action");
  assert(dashboardSource.includes("preview-export-auto-refresh-policy-btn"), "dashboard should expose preview auto-refresh policy export action");
  assert(dashboardSource.includes("preview-import-auto-refresh-policy-btn"), "dashboard should expose preview auto-refresh policy import action");
  assert(dashboardSource.includes("preview-export-policy-bundle-btn"), "dashboard should expose editor policy bundle export action");
  assert(dashboardSource.includes("preview-import-policy-bundle-btn"), "dashboard should expose editor policy bundle import action");
  assert(dashboardSource.includes("preview-clear-recovery-btn"), "dashboard should expose recovery clear action");
  assert(dashboardSource.includes("preview-restore-recovery-btn"), "dashboard should expose recovery restore action");
  assert(dashboardSource.includes("preview-remove-recovery-btn"), "dashboard should expose recovery remove action");
  assert(dashboardSource.includes("preview-reset-recovery-policy-btn"), "dashboard should expose recovery policy reset action");
  assert(dashboardSource.includes("preview-export-recovery-policy-btn"), "dashboard should expose recovery policy export action");
  assert(dashboardSource.includes("preview-import-recovery-policy-btn"), "dashboard should expose recovery policy import action");
  assert(dashboardSource.includes("recoveryPolicyImportMode"), "dashboard should expose recovery policy import mode selector");
  assert(dashboardSource.includes("recoveryPolicyImportIncludeDefaultOnMerge"), "dashboard should expose merge-include-default option");
  assert(dashboardSource.includes("importRecoveryPolicyMode"), "dashboard should pass recovery policy import mode");
  assert(dashboardSource.includes("importPolicyOptions"), "dashboard should pass policy import options");
  assert(dashboardSource.includes("recoveryHistoryMaxAgeDays"), "dashboard should expose recovery history max-age selector");
  assert(dashboardSource.includes("关闭自动清理"), "dashboard should expose disable history cleanup option");
  assert(dashboardSource.includes("当前来源："), "dashboard should show recovery policy source");
  assert(dashboardSource.includes("Use Global Default"), "dashboard should expose global-default reset button");
  assert(dashboardSource.includes("NEW_BOOK_TEMPLATE_PRESETS_KEY"), "dashboard should persist custom new-book presets");
  assert(dashboardSource.includes("save-template-preset-btn"), "dashboard should expose save preset action");
  assert(dashboardSource.includes("apply-template-preset-btn"), "dashboard should expose apply preset action");
  assert(dashboardSource.includes("export-template-presets-btn"), "dashboard should expose export preset action");
  assert(dashboardSource.includes("import-template-presets-btn"), "dashboard should expose import preset action");
  assert(dashboardSource.includes("clear-template-presets-btn"), "dashboard should expose clear preset action");
  assert(dashboardSource.includes("recoverySavedAt"), "dashboard should expose recovery history selector");
  assert(dashboardSource.includes("Restore Selected Snapshot"), "dashboard should expose restore snapshot button label");
  assert(dashboardSource.includes("Delete Selected Snapshot"), "dashboard should expose remove snapshot button label");
  assert(dashboardSource.includes("onClearRecoverySnapshot"), "dashboard should wire recovery clear handler");
  assert(dashboardSource.includes("onRestoreRecoverySnapshot"), "dashboard should wire recovery restore handler");
  assert(dashboardSource.includes("onRemoveRecoverySnapshot"), "dashboard should wire recovery remove handler");
  assert(dashboardSource.includes("onResetPreviewAutoRefreshPolicy"), "dashboard should wire preview auto-refresh policy reset handler");
  assert(dashboardSource.includes("onExportPreviewAutoRefreshPolicy"), "dashboard should wire preview auto-refresh policy export handler");
  assert(dashboardSource.includes("onImportPreviewAutoRefreshPolicy"), "dashboard should wire preview auto-refresh policy import handler");
  assert(dashboardSource.includes("onExportEditorPolicyBundle"), "dashboard should wire editor policy bundle export handler");
  assert(dashboardSource.includes("onImportEditorPolicyBundle"), "dashboard should wire editor policy bundle import handler");
  assert(dashboardSource.includes("onUpdateRecoveryPolicyImportOptions"), "dashboard should wire policy import option updates");
  assert(dashboardSource.includes("onResetRecoveryHistoryPolicy"), "dashboard should wire recovery policy reset handler");
  assert(dashboardSource.includes("onExportRecoveryHistoryPolicy"), "dashboard should wire recovery policy export handler");
  assert(dashboardSource.includes("onImportRecoveryHistoryPolicy"), "dashboard should wire recovery policy import handler");
  assert(dashboardSource.includes("Live Preview"), "dashboard should expose live preview title");
  assert(dashboardSource.includes("auto create from suggestion"), "dashboard should expose auto-create target option");
  assert(dashboardSource.includes("confirmOverwriteAnalysis"), "dashboard should expose overwrite confirmation checkbox");
  assert(dashboardSource.includes("Analyze Text"), "dashboard should expose text analysis action");
  assert(dashboardSource.includes("download-analysis-btn"), "dashboard should expose analysis download action");
  assert(dashboardSource.includes("apply-analysis-btn"), "dashboard should expose analysis apply action");
  assert(dashboardSource.includes("analysisApplyMode"), "dashboard should expose analysis apply mode selector");
  assert(dashboardSource.includes("templatePreset"), "dashboard should expose template preset selector");
  assert(dashboardSource.includes("standard（阅读+人物+主题）"), "dashboard should expose standard preset label");
  assert(dashboardSource.includes("custom（手动勾选）"), "dashboard should expose custom preset label");
  assert(dashboardSource.includes("applyNewBookTemplatePreset"), "dashboard should support applying new-book preset");
  assert(dashboardSource.includes("AI Settings (Local)"), "dashboard should render ai settings panel");
  assert(dashboardSource.includes("customRedactionTemplates"), "dashboard should persist redaction templates");
  assert(dashboardSource.includes("clear-redaction-templates-btn"), "dashboard should expose clear-template action");
  assert(dashboardSource.includes("preview-redaction-templates-btn"), "dashboard should expose preview-template action");
  assert(dashboardSource.includes("import-redaction-templates-btn"), "dashboard should expose import-template action");
  assert(dashboardSource.includes("export-redaction-templates-btn"), "dashboard should expose export-template action");
  assert(dashboardSource.includes("manual (preview plan only)"), "dashboard should expose manual merge strategy");
  assert(dashboardSource.includes("Manual Merge Preview"), "dashboard should expose manual merge preview section");
  assert(dashboardSource.includes("apply-manual-plan-btn"), "dashboard should expose manual plan apply action");
  assert(dashboardSource.includes("download-validation-report-btn"), "dashboard should expose validation report download action");
  assert(dashboardSource.includes("Download Validation Report"), "dashboard should render validation report button label");
  assert(dashboardSource.includes("importTemplateMode"), "dashboard should expose template import mode");
  assert(dashboardSource.includes("当前图片策略"), "dashboard should surface current image mode for new book flow");
  assert(dashboardSource.includes("includeTimeline"), "dashboard should expose timeline template option");
  assert(dashboardSource.includes("includeInteractive"), "dashboard should expose interactive template option");
  assert(dashboardSource.includes("missingAssetFallbackMode"), "dashboard should expose missing-asset fallback mode");
  assert(appSource.includes("mode ${mode}"), "app should surface template import mode in feedback");
  assert(appSource.includes("fallback ${result.missingAssetFallbackMode}"), "app should surface fallback mode in export feedback");
  assert(stateSource.includes("previewBookId"), "state should track preview book");
  assert(stateSource.includes("previewDevice"), "state should track preview device");
  assert(stateSource.includes("previewAutoRefresh"), "state should track preview auto refresh setting");
  assert(stateSource.includes("previewAutoRefreshPolicyScope"), "state should track preview auto-refresh policy scope");
  assert(stateSource.includes("packManualPlan"), "state should track manual merge plan");
  assert(stateSource.includes("validationFeedback"), "state should track validation feedback");
  assert(stateSource.includes("recoveryFeedback"), "state should track recovery feedback");
  assert(stateSource.includes("recoveryHistory"), "state should track recovery snapshot history");
  assert(stateSource.includes("recoveryHistoryMaxAgeDays"), "state should track recovery history max-age policy");
  assert(stateSource.includes("recoveryHistoryPolicyScope"), "state should track recovery history policy scope");
  assert(stateSource.includes("recoveryPolicyImportIncludeDefaultOnMerge"), "state should track merge-include-default import option");
  assert(stateSource.includes("previewUrl"), "state should track preview url");
  assert(cssSource.includes(".preview-stage"), "css should style preview stage");
  assert(cssSource.includes(".preview-mobile"), "css should style mobile preview mode");
  assert(validatorSource.includes("validateRegistryData"), "validator should expose registry validation");
  assert(validatorSource.includes("$.books"), "validator should emit path-based books errors");
  assert(validatorSource.includes("$.modules"), "validator should emit path-based registry errors");
  assert(validatorSource.includes("模板级别无效"), "validator should reject unsupported template presets");
  assert(recoveryStoreSource.includes("indexedDB"), "recovery store should use indexedDB");
  assert(recoveryStoreSource.includes("saveLatest"), "recovery store should support snapshot save");
  assert(recoveryStoreSource.includes("loadLatest"), "recovery store should support snapshot load");
  assert(recoveryStoreSource.includes("loadByProject"), "recovery store should support loading project snapshot");
  assert(recoveryStoreSource.includes("loadProjectHistory"), "recovery store should support loading project history");
  assert(recoveryStoreSource.includes("removeProjectHistorySnapshot"), "recovery store should support removing selected project history");
  assert(recoveryStoreSource.includes("project-history:"), "recovery store should persist project history namespace");
  assert(recoveryStoreSource.includes("HISTORY_LIMIT"), "recovery store should enforce history limit");
  assert(recoveryStoreSource.includes("HISTORY_MAX_AGE_MS"), "recovery store should enforce history max age");
  assert(recoveryStoreSource.includes("pruneRecoveryHistory"), "recovery store should prune stale recovery history");
  assert(recoveryStoreSource.includes("historyMaxAgeMs"), "recovery store should support configurable history max age");
  assert(recoveryStoreSource.includes("setHistoryPolicy"), "recovery store should support runtime history policy update");
  assert(recoveryStoreSource.includes("getHistoryPolicy"), "recovery store should expose current history policy");
  assert(recoveryStoreSource.includes("clearByProject"), "recovery store should support clearing project snapshot");
  assert(recoveryStoreSource.includes("clearLatest"), "recovery store should support snapshot clear");
  assert(analysisSource.includes("analyzeBookText"), "analysis assistant should expose analyze function");
  assert(analysisSource.includes("llm-fallback"), "analysis assistant should support llm fallback mode");
  assert(analysisSource.includes("requestLlmModuleSuggestions"), "analysis assistant should support llm request");
  assert(bookTemplateSource.includes("cover-emoji.svg"), "book template should support emoji cover mode");
  assert(bookTemplateSource.includes("cover-none.svg"), "book template should support no-image cover mode");
  assert(bookTemplateSource.includes("imageMode: ${imageMode}"), "book template should include image mode in prompt template");
  assert(bookTemplateSource.includes("includeTimeline"), "book template should support timeline module option");
  assert(bookTemplateSource.includes("includeInteractive"), "book template should support interactive module option");
  assert(bookTemplateSource.includes("timeline.json"), "book template should support timeline data output");
  assert(bookTemplateSource.includes("scenarios.json"), "book template should support scenarios data output");
  assert(edgeonePreflightSource.includes("edgeone-preflight: ok"), "edgeone preflight script should output success marker");
  assert(edgeonePreflightSource.includes("rgsite-manifest.json"), "edgeone preflight script should validate rgsite manifest");
  assert(edgeonePreflightSource.includes("MISSING-ASSETS.txt"), "edgeone preflight script should check missing-assets report");
  assert(edgeonePreflightSource.includes("checksumMode"), "edgeone preflight script should validate manifest checksum mode");
  assert(edgeonePreflightSource.includes("sha256"), "edgeone preflight script should support sha256 checksum verification");
  assert(edgeonePreflightSource.includes("checksum missing for required file"), "edgeone preflight script should require checksum entries for critical files");
  assert(edgeonePreflightSource.includes("invalid checksum format"), "edgeone preflight script should validate checksum hash format");
  assert(edgeonePreflightSource.includes("invalid checksum target path"), "edgeone preflight script should reject unsafe checksum target paths");
  assert(edgeonePreflightShellSource.includes("edgeone-preflight.mjs"), "edgeone preflight shell wrapper should call node script");
  assert(edgeonePreflightSelftestSource.includes("real-asset sample"), "edgeone preflight selftest should include real-asset sample flow");
  assert(edgeonePreflightSelftestSource.includes("checksum mismatch"), "edgeone preflight selftest should validate checksum mismatch failures");
  assert(edgeonePreflightSelftestSource.includes("checksum missing for required file"), "edgeone preflight selftest should validate missing required checksum entry failures");
  assert(edgeonePreflightSelftestSource.includes("invalid checksum format"), "edgeone preflight selftest should validate invalid checksum format failures");
  assert(edgeonePreflightSelftestSource.includes("invalid checksum target path"), "edgeone preflight selftest should validate unsafe checksum path failures");
}

async function collectReferencedAssetsFromBook(book, assetSet, assetSources = null) {
  const bookId = String(book?.id || "").trim();
  if (!bookId) return;

  const coverPath = normalizeAssetPath(bookId, book?.cover);
  if (coverPath) {
    assetSet.add(coverPath);
    rememberAssetSource(assetSources, coverPath, `book:${bookId}:cover`);
  }

  const registryPath = `data/${bookId}/registry.json`;
  if (!(await pathExists(registryPath))) return;

  let registry = null;
  try {
    registry = JSON.parse(await readFile(path.resolve(ROOT, registryPath), "utf8"));
  } catch {
    return;
  }

  const modules = Array.isArray(registry?.modules) ? registry.modules : [];
  for (const mod of modules) {
    const modId = String(mod?.id || "unknown").trim() || "unknown";
    const dataRaw = String(mod?.data || "").trim();
    if (!dataRaw) continue;
    const dataPath = normalizePathValue(`data/${bookId}/${dataRaw}`);
    // eslint-disable-next-line no-await-in-loop
    if (!(await pathExists(dataPath))) continue;
    try {
      // eslint-disable-next-line no-await-in-loop
      const text = await readFile(path.resolve(ROOT, dataPath), "utf8");
      const parsed = JSON.parse(text);
      const strings = [];
      collectStrings(parsed, strings);
      strings.forEach((item) => {
        const assetPath = normalizeAssetPath(bookId, item);
        if (assetPath) {
          assetSet.add(assetPath);
          rememberAssetSource(assetSources, assetPath, `book:${bookId}:module:${modId}`);
        }
      });
    } catch {
      // ignore non-json or parse errors
    }
  }
}

async function collectAssetRefsFromFileSet(fileSet, assetSet, assetSources = null) {
  const candidates = Array.from(fileSet).filter((item) => isLikelyTextFile(item));
  for (const filePath of candidates) {
    // eslint-disable-next-line no-await-in-loop
    if (!(await pathExists(filePath))) continue;
    // eslint-disable-next-line no-await-in-loop
    const text = await readFile(path.resolve(ROOT, filePath), "utf8");
    const refs = extractAssetRefsFromText(text);
    refs.forEach((item) => {
      assetSet.add(item);
      rememberAssetSource(assetSources, item, `file:${filePath}`);
    });
  }
}

async function addExistingAssetsToFileSet(assetSet, fileSet, assetSources = null) {
  const missingAssets = [];
  const missingAssetDetails = [];
  for (const assetPath of assetSet) {
    // eslint-disable-next-line no-await-in-loop
    if (await pathExists(assetPath)) {
      fileSet.add(assetPath);
    } else {
      missingAssets.push(assetPath);
      missingAssetDetails.push({
        path: assetPath,
        sources: Array.from(assetSources?.get(assetPath) || []),
      });
    }
  }
  return {
    missingAssets,
    missingAssetDetails,
  };
}

async function buildModeStats({
  mode,
  fileSet,
  books,
  selectedBookIds,
  subsetAssetMode,
  missingAssets,
  missingAssetsByCategory,
  includeSubsetBooksJson,
}) {
  const extras = [];
  if (includeSubsetBooksJson) {
    extras.push(`${JSON.stringify({ books }, null, 2)}\n`);
  }
  extras.push(buildEdgeOneGuide());
  if (missingAssets.length) {
    extras.push(buildMissingAssetsReport(missingAssets, missingAssetsByCategory));
  }

  const fileBytes = await sumFileBytes(fileSet);
  const extraBytes = extras.reduce((sum, text) => sum + TEXT_ENCODER.encode(text).byteLength, 0);
  const filesWithoutManifest = fileSet.size + extras.length;
  const bytesWithoutManifest = fileBytes + extraBytes;
  const manifest = createManifestForStats({
    booksCount: books.length,
    selectedBookIds,
    subsetAssetMode,
    missingAssets,
    missingAssetsByCategory,
    filesCount: filesWithoutManifest + 1,
    totalBytes: bytesWithoutManifest,
  });
  const manifestText = JSON.stringify(manifest, null, 2);
  const manifestBytes = TEXT_ENCODER.encode(manifestText).byteLength;

  return {
    mode,
    books: books.length,
    files: filesWithoutManifest + 1,
    totalBytes: bytesWithoutManifest + manifestBytes,
    missingAssets: missingAssets.length,
    missingAssetsByCategory,
    selectedBookIds,
  };
}

async function estimateSitePackStats() {
  const booksDataPath = path.resolve(ROOT, "data/books.json");
  const booksData = JSON.parse(await readFile(booksDataPath, "utf8"));
  const allBooks = Array.isArray(booksData?.books) ? booksData.books : [];
  assert(allBooks.length > 0, "books.json should contain books for pack stats");

  const dedupRequested = [];
  const seenRequested = new Set();
  const invalidFormatBookIds = [];
  const BOOK_ID_PATTERN = /^[a-z0-9-]+$/;
  String(process.env.EDITOR_PACK_STATS_SELECTED_BOOKS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((id) => {
      if (!BOOK_ID_PATTERN.test(id)) {
        invalidFormatBookIds.push(id);
      }
      if (seenRequested.has(id)) return;
      seenRequested.add(id);
      dedupRequested.push(id);
    });

  const bookMap = new Map(
    allBooks
      .map((book) => [String(book?.id || "").trim(), book])
      .filter(([id]) => Boolean(id))
  );
  let selectedBooks = allBooks.slice(0, Math.min(2, allBooks.length));
  const selectionMeta = {
    mode: "auto",
    requestedBookIds: dedupRequested,
    missingBookIds: [],
    invalidFormatBookIds,
  };

  if (dedupRequested.length) {
    selectionMeta.mode = "env";
    const selectedFromEnv = [];
    dedupRequested.forEach((id) => {
      const book = bookMap.get(id);
      if (book) {
        selectedFromEnv.push(book);
      } else {
        selectionMeta.missingBookIds.push(id);
      }
    });
    selectedBooks = selectedFromEnv;
  }

  const requireValidSelection = isTruthyEnv(process.env.EDITOR_PACK_STATS_REQUIRE_VALID_SELECTION);
  const missingAssetsThresholdConfig = resolveMissingAssetsThresholdsByMode();
  const categoryThresholdConfig = readCategoryMissingAssetsThresholdsFromEnv();
  const categoryMissingAssetsThresholds = categoryThresholdConfig.thresholds;
  if (requireValidSelection && selectionMeta.invalidFormatBookIds.length) {
    throw new Error(
      `ASSERT_FAILED: invalid pack stats selected book id format -> ${selectionMeta.invalidFormatBookIds.join(", ")}`
    );
  }
  if (requireValidSelection && selectionMeta.missingBookIds.length) {
    throw new Error(
      `ASSERT_FAILED: pack stats selected books not found -> ${selectionMeta.missingBookIds.join(", ")}`
    );
  }

  const selectedBookIds = selectedBooks
    .map((item) => String(item?.id || "").trim())
    .filter(Boolean);
  assert(
    selectedBookIds.length > 0,
    "pack stats needs at least one selected book (check EDITOR_PACK_STATS_SELECTED_BOOKS)"
  );

  const allBookIdsSet = new Set(
    allBooks
      .map((item) => String(item?.id || "").trim())
      .filter(Boolean)
  );
  const selectedIdsSet = new Set(selectedBookIds);

  const fullFiles = await collectFilesFromRoots(FULL_INCLUDE_ROOTS);
  const fullStats = await buildModeStats({
    mode: "full",
    fileSet: fullFiles,
    books: allBooks,
    selectedBookIds: [],
    subsetAssetMode: "balanced",
    missingAssets: [],
    missingAssetsByCategory: {},
    includeSubsetBooksJson: false,
  });

  const subsetBalancedFiles = await collectFilesFromRoots(SUBSET_CORE_ROOTS);
  for (const id of selectedBookIds) {
    // eslint-disable-next-line no-await-in-loop
    await collectRuntimeFiles(`data/${id}`, subsetBalancedFiles);
  }

  const allAssets = await collectFilesFromRoots(["assets"]);
  allAssets.forEach((assetPath) => {
    const ownerId = bookIdFromAssetPath(assetPath, allBookIdsSet);
    if (ownerId && !selectedIdsSet.has(ownerId)) return;
    subsetBalancedFiles.add(assetPath);
  });

  const subsetBalancedStats = await buildModeStats({
    mode: "subset-balanced",
    fileSet: subsetBalancedFiles,
    books: selectedBooks,
    selectedBookIds,
    subsetAssetMode: "balanced",
    missingAssets: [],
    missingAssetsByCategory: {},
    includeSubsetBooksJson: true,
  });
  enforceMissingAssetsThreshold(
    subsetBalancedStats.missingAssets,
    missingAssetsThresholdConfig.byMode["subset-balanced"].maxMissingAssets
  );

  const subsetMinimalFiles = await collectFilesFromRoots(SUBSET_CORE_ROOTS);
  for (const id of selectedBookIds) {
    // eslint-disable-next-line no-await-in-loop
    await collectRuntimeFiles(`data/${id}`, subsetMinimalFiles);
  }

  const referencedAssets = new Set();
  const assetSources = new Map();
  for (const book of selectedBooks) {
    // eslint-disable-next-line no-await-in-loop
    await collectReferencedAssetsFromBook(book, referencedAssets, assetSources);
  }
  await collectAssetRefsFromFileSet(subsetMinimalFiles, referencedAssets, assetSources);
  const missing = await addExistingAssetsToFileSet(referencedAssets, subsetMinimalFiles, assetSources);
  const missingAssets = missing.missingAssets;
  const missingAssetsByCategory = buildMissingAssetsCategorySummary(missing.missingAssetDetails);

  const subsetMinimalStats = await buildModeStats({
    mode: "subset-minimal",
    fileSet: subsetMinimalFiles,
    books: selectedBooks,
    selectedBookIds,
    subsetAssetMode: "minimal",
    missingAssets,
    missingAssetsByCategory,
    includeSubsetBooksJson: true,
  });
  enforceMissingAssetsThreshold(
    subsetMinimalStats.missingAssets,
    missingAssetsThresholdConfig.byMode["subset-minimal"].maxMissingAssets
  );
  Object.entries(categoryMissingAssetsThresholds).forEach(([category, threshold]) => {
    const missingByCategory = Number(subsetMinimalStats.missingAssetsByCategory?.[category] || 0);
    enforceCategoryMissingAssetsThreshold(category, missingByCategory, threshold.maxMissingAssets);
  });

  return {
    sampleSelectedBookIds: selectedBookIds,
    selection: selectionMeta,
    requireValidSelection,
    missingAssetsThreshold: missingAssetsThresholdConfig.global,
    missingAssetsThresholdsByMode: missingAssetsThresholdConfig.byMode,
    missingAssetsCategoryThresholds: categoryMissingAssetsThresholds,
    missingAssetsCategoryThresholdPreset: categoryThresholdConfig.preset,
    full: fullStats,
    subsetBalanced: subsetBalancedStats,
    subsetMinimal: subsetMinimalStats,
    comparePercent: {
      subsetBalancedVsFull: toPercent(subsetBalancedStats.totalBytes, fullStats.totalBytes),
      subsetMinimalVsFull: toPercent(subsetMinimalStats.totalBytes, fullStats.totalBytes),
      subsetMinimalVsBalanced: toPercent(subsetMinimalStats.totalBytes, subsetBalancedStats.totalBytes),
    },
  };
}

async function testPackSizeStats() {
  const stats = await estimateSitePackStats();
  assert(stats.full.totalBytes > 0, "full pack totalBytes should be positive");
  assert(stats.subsetBalanced.totalBytes > 0, "subset-balanced totalBytes should be positive");
  assert(stats.subsetMinimal.totalBytes > 0, "subset-minimal totalBytes should be positive");
  assert(stats.subsetMinimal.totalBytes <= stats.subsetBalanced.totalBytes, "minimal should not exceed balanced");
  return stats;
}

async function testPackStatsStrictSelection() {
  const prevSelected = process.env.EDITOR_PACK_STATS_SELECTED_BOOKS;
  const prevStrict = process.env.EDITOR_PACK_STATS_REQUIRE_VALID_SELECTION;
  process.env.EDITOR_PACK_STATS_SELECTED_BOOKS = "missing-book-for-strict-test";
  process.env.EDITOR_PACK_STATS_REQUIRE_VALID_SELECTION = "1";

  let failed = false;
  try {
    await estimateSitePackStats();
  } catch (err) {
    failed = String(err?.message || "").includes("selected books not found");
  } finally {
    if (typeof prevSelected === "undefined") {
      delete process.env.EDITOR_PACK_STATS_SELECTED_BOOKS;
    } else {
      process.env.EDITOR_PACK_STATS_SELECTED_BOOKS = prevSelected;
    }
    if (typeof prevStrict === "undefined") {
      delete process.env.EDITOR_PACK_STATS_REQUIRE_VALID_SELECTION;
    } else {
      process.env.EDITOR_PACK_STATS_REQUIRE_VALID_SELECTION = prevStrict;
    }
  }

  assert(failed, "strict pack stats should fail when selected books are missing");
}

async function testPackStatsStrictFormat() {
  const prevSelected = process.env.EDITOR_PACK_STATS_SELECTED_BOOKS;
  const prevStrict = process.env.EDITOR_PACK_STATS_REQUIRE_VALID_SELECTION;
  process.env.EDITOR_PACK_STATS_SELECTED_BOOKS = "bad;id";
  process.env.EDITOR_PACK_STATS_REQUIRE_VALID_SELECTION = "1";

  let failed = false;
  try {
    await estimateSitePackStats();
  } catch (err) {
    failed = String(err?.message || "").includes("invalid pack stats selected book id format");
  } finally {
    if (typeof prevSelected === "undefined") {
      delete process.env.EDITOR_PACK_STATS_SELECTED_BOOKS;
    } else {
      process.env.EDITOR_PACK_STATS_SELECTED_BOOKS = prevSelected;
    }
    if (typeof prevStrict === "undefined") {
      delete process.env.EDITOR_PACK_STATS_REQUIRE_VALID_SELECTION;
    } else {
      process.env.EDITOR_PACK_STATS_REQUIRE_VALID_SELECTION = prevStrict;
    }
  }

  assert(failed, "strict pack stats should fail when selection format is invalid");
}

function testPackStatsThresholdConfig() {
  assert(parseMaxMissingAssetsThreshold("") === null, "empty threshold should be disabled");
  assert(parseMaxMissingAssetsThreshold("0") === 0, "threshold zero should be valid");
  assert(parseMaxMissingAssetsThreshold("3") === 3, "threshold parse mismatch");
  assert(
    parseMaxMissingAssetsThreshold("2", "EDITOR_PACK_STATS_MAX_MISSING_BOOK_COVER") === 2,
    "category threshold parse mismatch"
  );

  let invalidFailed = false;
  try {
    parseMaxMissingAssetsThreshold("bad");
  } catch (err) {
    invalidFailed = String(err?.message || "").includes("non-negative integer");
  }
  assert(invalidFailed, "threshold parser should reject invalid input");

  let exceededFailed = false;
  try {
    enforceMissingAssetsThreshold(2, 1);
  } catch (err) {
    exceededFailed = String(err?.message || "").includes("exceeds threshold");
  }
  assert(exceededFailed, "threshold guard should fail when missing assets exceed limit");
  enforceMissingAssetsThreshold(1, 1);
}

function testPackStatsThresholdByModeConfig() {
  const backup = {
    global: process.env.EDITOR_PACK_STATS_MAX_MISSING_ASSETS,
    balanced: process.env.EDITOR_PACK_STATS_MAX_MISSING_ASSETS_SUBSET_BALANCED,
    minimal: process.env.EDITOR_PACK_STATS_MAX_MISSING_ASSETS_SUBSET_MINIMAL,
  };

  try {
    process.env.EDITOR_PACK_STATS_MAX_MISSING_ASSETS = "2";
    process.env.EDITOR_PACK_STATS_MAX_MISSING_ASSETS_SUBSET_BALANCED = "";
    process.env.EDITOR_PACK_STATS_MAX_MISSING_ASSETS_SUBSET_MINIMAL = "0";
    const config = resolveMissingAssetsThresholdsByMode();
    assert(config.global.maxMissingAssets === 2, "global threshold should be parsed");
    assert(config.byMode["subset-balanced"]?.maxMissingAssets === 2, "balanced should inherit global threshold");
    assert(config.byMode["subset-minimal"]?.maxMissingAssets === 0, "minimal should override global threshold");

    process.env.EDITOR_PACK_STATS_MAX_MISSING_ASSETS_SUBSET_BALANCED = "bad";
    let invalidFailed = false;
    try {
      resolveMissingAssetsThresholdsByMode();
    } catch (err) {
      invalidFailed = String(err?.message || "").includes("EDITOR_PACK_STATS_MAX_MISSING_ASSETS_SUBSET_BALANCED");
    }
    assert(invalidFailed, "mode threshold parser should report invalid env");
  } finally {
    if (typeof backup.global === "undefined") {
      delete process.env.EDITOR_PACK_STATS_MAX_MISSING_ASSETS;
    } else {
      process.env.EDITOR_PACK_STATS_MAX_MISSING_ASSETS = backup.global;
    }
    if (typeof backup.balanced === "undefined") {
      delete process.env.EDITOR_PACK_STATS_MAX_MISSING_ASSETS_SUBSET_BALANCED;
    } else {
      process.env.EDITOR_PACK_STATS_MAX_MISSING_ASSETS_SUBSET_BALANCED = backup.balanced;
    }
    if (typeof backup.minimal === "undefined") {
      delete process.env.EDITOR_PACK_STATS_MAX_MISSING_ASSETS_SUBSET_MINIMAL;
    } else {
      process.env.EDITOR_PACK_STATS_MAX_MISSING_ASSETS_SUBSET_MINIMAL = backup.minimal;
    }
  }
}

function testPackStatsCategoryThresholdConfig() {
  enforceCategoryMissingAssetsThreshold("book-module", 0, 0);
  enforceCategoryMissingAssetsThreshold("book-cover", 1, 1);
  enforceCategoryMissingAssetsThreshold("file-ref", 0, 0);
  let exceededFailed = false;
  try {
    enforceCategoryMissingAssetsThreshold("book-module", 2, 1);
  } catch (err) {
    exceededFailed = String(err?.message || "").includes("missingAssetsByCategory.book-module");
  }
  assert(exceededFailed, "category threshold guard should fail when category missing exceeds limit");

  const backup = {
    module: process.env.EDITOR_PACK_STATS_MAX_MISSING_BOOK_MODULE,
    cover: process.env.EDITOR_PACK_STATS_MAX_MISSING_BOOK_COVER,
    fileRef: process.env.EDITOR_PACK_STATS_MAX_MISSING_FILE_REF,
    unclassified: process.env.EDITOR_PACK_STATS_MAX_MISSING_UNCLASSIFIED,
    preset: process.env.EDITOR_PACK_STATS_CATEGORY_THRESHOLD_PRESET,
  };
  try {
    process.env.EDITOR_PACK_STATS_CATEGORY_THRESHOLD_PRESET = "custom";
    process.env.EDITOR_PACK_STATS_MAX_MISSING_BOOK_MODULE = "0";
    process.env.EDITOR_PACK_STATS_MAX_MISSING_BOOK_COVER = "2";
    process.env.EDITOR_PACK_STATS_MAX_MISSING_FILE_REF = "";
    process.env.EDITOR_PACK_STATS_MAX_MISSING_UNCLASSIFIED = "1";
    const categoryThresholdConfig = readCategoryMissingAssetsThresholdsFromEnv();
    const categoryThresholds = categoryThresholdConfig.thresholds;
    assert(categoryThresholdConfig.preset === "custom", "custom preset should be reported");
    assert(categoryThresholds["book-module"]?.maxMissingAssets === 0, "module threshold should be parsed");
    assert(categoryThresholds["book-cover"]?.maxMissingAssets === 2, "cover threshold should be parsed");
    assert(categoryThresholds["file-ref"]?.enabled === false, "file-ref threshold should be disabled by default");
    assert(categoryThresholds.unclassified?.maxMissingAssets === 1, "unclassified threshold should be parsed");

    delete process.env.EDITOR_PACK_STATS_MAX_MISSING_BOOK_MODULE;
    delete process.env.EDITOR_PACK_STATS_MAX_MISSING_BOOK_COVER;
    delete process.env.EDITOR_PACK_STATS_MAX_MISSING_FILE_REF;
    delete process.env.EDITOR_PACK_STATS_MAX_MISSING_UNCLASSIFIED;
    process.env.EDITOR_PACK_STATS_CATEGORY_THRESHOLD_PRESET = "balanced";
    const balanced = readCategoryMissingAssetsThresholdsFromEnv();
    assert(balanced.preset === "balanced", "balanced preset should be reported");
    assert(balanced.thresholds["book-module"]?.maxMissingAssets === 0, "balanced preset should enforce module");
    assert(balanced.thresholds["book-cover"]?.enabled === false, "balanced preset should not enforce cover");

    process.env.EDITOR_PACK_STATS_CATEGORY_THRESHOLD_PRESET = "strict";
    const strict = readCategoryMissingAssetsThresholdsFromEnv();
    assert(strict.preset === "strict", "strict preset should be reported");
    assert(strict.thresholds["book-cover"]?.maxMissingAssets === 0, "strict preset should enforce cover");
    assert(strict.thresholds["file-ref"]?.maxMissingAssets === 0, "strict preset should enforce file-ref");

    process.env.EDITOR_PACK_STATS_MAX_MISSING_BOOK_COVER = "bad";
    let invalidFailed = false;
    try {
      readCategoryMissingAssetsThresholdsFromEnv();
    } catch (err) {
      invalidFailed = String(err?.message || "").includes("EDITOR_PACK_STATS_MAX_MISSING_BOOK_COVER");
    }
    assert(invalidFailed, "category threshold parser should report env name");

    process.env.EDITOR_PACK_STATS_MAX_MISSING_BOOK_COVER = "";
    process.env.EDITOR_PACK_STATS_CATEGORY_THRESHOLD_PRESET = "invalid";
    let invalidPresetFailed = false;
    try {
      readCategoryMissingAssetsThresholdsFromEnv();
    } catch (err) {
      invalidPresetFailed = String(err?.message || "").includes("EDITOR_PACK_STATS_CATEGORY_THRESHOLD_PRESET");
    }
    assert(invalidPresetFailed, "category threshold parser should reject invalid preset");
  } finally {
    if (typeof backup.module === "undefined") {
      delete process.env.EDITOR_PACK_STATS_MAX_MISSING_BOOK_MODULE;
    } else {
      process.env.EDITOR_PACK_STATS_MAX_MISSING_BOOK_MODULE = backup.module;
    }
    if (typeof backup.cover === "undefined") {
      delete process.env.EDITOR_PACK_STATS_MAX_MISSING_BOOK_COVER;
    } else {
      process.env.EDITOR_PACK_STATS_MAX_MISSING_BOOK_COVER = backup.cover;
    }
    if (typeof backup.fileRef === "undefined") {
      delete process.env.EDITOR_PACK_STATS_MAX_MISSING_FILE_REF;
    } else {
      process.env.EDITOR_PACK_STATS_MAX_MISSING_FILE_REF = backup.fileRef;
    }
    if (typeof backup.unclassified === "undefined") {
      delete process.env.EDITOR_PACK_STATS_MAX_MISSING_UNCLASSIFIED;
    } else {
      process.env.EDITOR_PACK_STATS_MAX_MISSING_UNCLASSIFIED = backup.unclassified;
    }
    if (typeof backup.preset === "undefined") {
      delete process.env.EDITOR_PACK_STATS_CATEGORY_THRESHOLD_PRESET;
    } else {
      process.env.EDITOR_PACK_STATS_CATEGORY_THRESHOLD_PRESET = backup.preset;
    }
  }
}

async function writeReport(report) {
  await mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function runChecks() {
  const checks = [
    { name: "pack-utils", run: testPackUtils },
    { name: "merge-service", run: testMergeService },
    { name: "site-pack-markers", run: testSitePackSourceMarkers },
    { name: "diagnostic-markers", run: testDiagnosticSourceMarkers },
    { name: "pack-size-strict-selection", run: testPackStatsStrictSelection },
    { name: "pack-size-strict-format", run: testPackStatsStrictFormat },
    { name: "pack-size-threshold-config", run: testPackStatsThresholdConfig },
    { name: "pack-size-threshold-by-mode-config", run: testPackStatsThresholdByModeConfig },
    { name: "pack-size-category-threshold-config", run: testPackStatsCategoryThresholdConfig },
    { name: "pack-size-stats", run: testPackSizeStats },
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    reportPath: path.relative(ROOT, REPORT_PATH),
    checks: [],
    status: "pass",
  };

  for (const item of checks) {
    const startedAt = Date.now();
    try {
      // eslint-disable-next-line no-await-in-loop
      const details = await item.run();
      const checkItem = {
        name: item.name,
        status: "pass",
        durationMs: Date.now() - startedAt,
      };
      if (details && typeof details === "object") {
        checkItem.details = details;
        if (item.name === "pack-size-stats") {
          report.packStats = details;
        }
      }
      report.checks.push(checkItem);
    } catch (err) {
      report.status = "fail";
      report.checks.push({
        name: item.name,
        status: "fail",
        durationMs: Date.now() - startedAt,
        error: String(err?.message || err),
      });
    }
  }

  await writeReport(report);

  if (report.status !== "pass") {
    const failed = report.checks.filter((c) => c.status === "fail").map((c) => c.name).join(", ");
    throw new Error(`editor-regression: failed checks -> ${failed}`);
  }

  console.log("editor-regression: ok");
  console.log(`editor-regression-report: ${path.relative(ROOT, REPORT_PATH)}`);
}

await runChecks();
