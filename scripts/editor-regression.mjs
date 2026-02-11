import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const REPORT_PATH = path.resolve(ROOT, process.env.EDITOR_REGRESSION_REPORT || "tmp/editor-regression-report.json");

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERT_FAILED: ${message}`);
  }
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
  assert(dashboardSource.includes('data-mode="custom"'), "dashboard should expose custom report action");
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
      await item.run();
      report.checks.push({
        name: item.name,
        status: "pass",
        durationMs: Date.now() - startedAt,
      });
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
