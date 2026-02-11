import { readFile, stat } from "node:fs/promises";
import path from "node:path";

function usage() {
  console.error("Usage: node scripts/edgeone-preflight.mjs <extracted-site-root>");
}

async function exists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

function readJsonSafe(rawText, label) {
  try {
    return JSON.parse(rawText);
  } catch (err) {
    throw new Error(`${label} parse failed: ${err?.message || String(err)}`);
  }
}

async function validateExtractedSiteRoot(siteRoot) {
  const errors = [];
  const warnings = [];

  const requiredPaths = [
    ["index.html", "file"],
    ["book.html", "file"],
    ["data/books.json", "file"],
    ["css", "directory"],
    ["js", "directory"],
    ["rgsite-manifest.json", "file"],
    ["DEPLOY-EDGEONE.md", "file"],
  ];

  for (const [relPath, label] of requiredPaths) {
    const absPath = path.join(siteRoot, relPath);
    // eslint-disable-next-line no-await-in-loop
    if (!(await exists(absPath))) {
      errors.push(`missing required ${label}: ${relPath}`);
    }
  }

  const booksPath = path.join(siteRoot, "data/books.json");
  if (await exists(booksPath)) {
    const booksData = readJsonSafe(await readFile(booksPath, "utf8"), "books.json");
    const books = Array.isArray(booksData?.books) ? booksData.books : [];
    if (!books.length) {
      errors.push("books.json contains zero books");
    }

    const missingRegistryBooks = [];
    for (const book of books) {
      const bookId = String(book?.id || "").trim();
      if (!bookId) {
        errors.push("books.json contains an empty book id");
        // eslint-disable-next-line no-continue
        continue;
      }
      const registryPath = path.join(siteRoot, "data", bookId, "registry.json");
      // eslint-disable-next-line no-await-in-loop
      if (!(await exists(registryPath))) {
        missingRegistryBooks.push(bookId);
      }
    }
    if (missingRegistryBooks.length) {
      errors.push(`registry.json missing for books: ${missingRegistryBooks.join(", ")}`);
    }
  }

  const manifestPath = path.join(siteRoot, "rgsite-manifest.json");
  let manifest = null;
  if (await exists(manifestPath)) {
    manifest = readJsonSafe(await readFile(manifestPath, "utf8"), "rgsite-manifest.json");
    if (manifest?.format !== "rgsite") {
      errors.push(`manifest.format should be rgsite, got: ${String(manifest?.format || "")}`);
    }
    if (!Number.isFinite(Number(manifest?.files)) || Number(manifest?.files) <= 0) {
      errors.push(`manifest.files should be positive number, got: ${String(manifest?.files ?? "")}`);
    }
    if (!Number.isFinite(Number(manifest?.totalBytes)) || Number(manifest?.totalBytes) <= 0) {
      errors.push(`manifest.totalBytes should be positive number, got: ${String(manifest?.totalBytes ?? "")}`);
    }

    const missingAssetsCount = Number(manifest?.missingAssets || 0);
    const hasMissingAssetsReport = await exists(path.join(siteRoot, "MISSING-ASSETS.txt"));
    if (missingAssetsCount > 0 && !hasMissingAssetsReport) {
      errors.push("manifest.missingAssets > 0 but MISSING-ASSETS.txt is missing");
    }
    if (missingAssetsCount === 0 && hasMissingAssetsReport) {
      warnings.push("MISSING-ASSETS.txt exists while manifest.missingAssets is 0");
    }
    if (
      Array.isArray(manifest?.selectedBookIds)
      && manifest.selectedBookIds.length === 0
      && manifest.scope === "subset"
    ) {
      warnings.push("manifest.scope=subset but selectedBookIds is empty");
    }
  }

  const deployGuidePath = path.join(siteRoot, "DEPLOY-EDGEONE.md");
  if (await exists(deployGuidePath)) {
    const deployText = await readFile(deployGuidePath, "utf8");
    if (!deployText.includes("EdgeOne")) {
      warnings.push("DEPLOY-EDGEONE.md does not mention EdgeOne keyword");
    }
  }

  if (errors.length) {
    throw new Error(errors.join(" | "));
  }

  return {
    manifest: manifest || {},
    warnings,
  };
}

async function run() {
  const siteRootArg = String(process.argv[2] || "").trim();
  if (!siteRootArg) {
    usage();
    throw new Error("site root path is required");
  }

  const siteRoot = path.resolve(siteRootArg);
  let siteStats = null;
  try {
    siteStats = await stat(siteRoot);
  } catch {
    throw new Error(`site root not found: ${siteRoot}`);
  }
  if (!siteStats.isDirectory()) {
    throw new Error(`site root should be a directory: ${siteRoot}`);
  }

  const result = await validateExtractedSiteRoot(siteRoot);
  const manifest = result.manifest || {};

  console.log("edgeone-preflight: ok");
  console.log(`siteRoot: ${siteRoot}`);
  console.log(`scope: ${String(manifest.scope || "all")}`);
  console.log(`books: ${Number(manifest.books || 0)}`);
  console.log(`files: ${Number(manifest.files || 0)}`);
  console.log(`totalBytes: ${Number(manifest.totalBytes || 0)}`);
  console.log(`missingAssets: ${Number(manifest.missingAssets || 0)}`);
  if (result.warnings.length) {
    console.log(`warnings: ${result.warnings.length}`);
    result.warnings.forEach((item, idx) => {
      console.log(`  ${idx + 1}. ${item}`);
    });
  }
}

run().catch((err) => {
  console.error("edgeone-preflight: fail");
  console.error(String(err?.message || err));
  process.exitCode = 1;
});
