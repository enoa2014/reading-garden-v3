import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

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
}

async function main() {
  await testPackUtils();
  await testMergeService();
  await testSitePackSourceMarkers();
  console.log("editor-regression: ok");
}

await main();
