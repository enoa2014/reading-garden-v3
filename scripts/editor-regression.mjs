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

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERT_FAILED: ${message}`);
  }
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

function buildMissingAssetsReport(missingAssets = []) {
  const lines = [
    "# Missing Assets Report",
    "",
    `count: ${missingAssets.length}`,
    "",
  ];
  missingAssets.forEach((item) => lines.push(`- ${item}`));
  return lines.join("\n");
}

function createManifestForStats({
  booksCount,
  selectedBookIds,
  subsetAssetMode,
  missingAssets,
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
  assert(source.includes("MISSING-ASSETS.txt"), "site pack should emit missing assets report file");
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
  assert(appSource.includes("buildCustomRedactedDiagnostic"), "app should support custom redaction");
  assert(appSource.includes("clearRedactionTemplatesFlow"), "app should support clearing redaction templates");
  assert(dashboardSource.includes('data-mode="custom"'), "dashboard should expose custom report action");
  assert(dashboardSource.includes("recentRedactionTemplate"), "dashboard should support recent redaction templates");
  assert(dashboardSource.includes("customRedactionTemplates"), "dashboard should persist redaction templates");
  assert(dashboardSource.includes("clear-redaction-templates-btn"), "dashboard should expose clear-template action");
}

async function collectReferencedAssetsFromBook(book, assetSet) {
  const bookId = String(book?.id || "").trim();
  if (!bookId) return;

  const coverPath = normalizeAssetPath(bookId, book?.cover);
  if (coverPath) assetSet.add(coverPath);

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
        if (assetPath) assetSet.add(assetPath);
      });
    } catch {
      // ignore non-json or parse errors
    }
  }
}

async function collectAssetRefsFromFileSet(fileSet, assetSet) {
  const candidates = Array.from(fileSet).filter((item) => isLikelyTextFile(item));
  for (const filePath of candidates) {
    // eslint-disable-next-line no-await-in-loop
    if (!(await pathExists(filePath))) continue;
    // eslint-disable-next-line no-await-in-loop
    const text = await readFile(path.resolve(ROOT, filePath), "utf8");
    const refs = extractAssetRefsFromText(text);
    refs.forEach((item) => assetSet.add(item));
  }
}

async function addExistingAssetsToFileSet(assetSet, fileSet) {
  const missingAssets = [];
  for (const assetPath of assetSet) {
    // eslint-disable-next-line no-await-in-loop
    if (await pathExists(assetPath)) {
      fileSet.add(assetPath);
    } else {
      missingAssets.push(assetPath);
    }
  }
  return missingAssets;
}

async function buildModeStats({
  mode,
  fileSet,
  books,
  selectedBookIds,
  subsetAssetMode,
  missingAssets,
  includeSubsetBooksJson,
}) {
  const extras = [];
  if (includeSubsetBooksJson) {
    extras.push(`${JSON.stringify({ books }, null, 2)}\n`);
  }
  extras.push(buildEdgeOneGuide());
  if (missingAssets.length) {
    extras.push(buildMissingAssetsReport(missingAssets));
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
    selectedBookIds,
  };
}

async function estimateSitePackStats() {
  const booksDataPath = path.resolve(ROOT, "data/books.json");
  const booksData = JSON.parse(await readFile(booksDataPath, "utf8"));
  const allBooks = Array.isArray(booksData?.books) ? booksData.books : [];
  assert(allBooks.length > 0, "books.json should contain books for pack stats");

  const selectedBooks = allBooks.slice(0, Math.min(2, allBooks.length));
  const selectedBookIds = selectedBooks
    .map((item) => String(item?.id || "").trim())
    .filter(Boolean);
  assert(selectedBookIds.length > 0, "pack stats needs at least one selected book");

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
    includeSubsetBooksJson: true,
  });

  const subsetMinimalFiles = await collectFilesFromRoots(SUBSET_CORE_ROOTS);
  for (const id of selectedBookIds) {
    // eslint-disable-next-line no-await-in-loop
    await collectRuntimeFiles(`data/${id}`, subsetMinimalFiles);
  }

  const referencedAssets = new Set();
  for (const book of selectedBooks) {
    // eslint-disable-next-line no-await-in-loop
    await collectReferencedAssetsFromBook(book, referencedAssets);
  }
  await collectAssetRefsFromFileSet(subsetMinimalFiles, referencedAssets);
  const missingAssets = await addExistingAssetsToFileSet(referencedAssets, subsetMinimalFiles);

  const subsetMinimalStats = await buildModeStats({
    mode: "subset-minimal",
    fileSet: subsetMinimalFiles,
    books: selectedBooks,
    selectedBookIds,
    subsetAssetMode: "minimal",
    missingAssets,
    includeSubsetBooksJson: true,
  });

  return {
    sampleSelectedBookIds: selectedBookIds,
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
