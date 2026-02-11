import { readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

function usage() {
  console.error("Usage: node scripts/edgeone-preflight.mjs <extracted-site-root> [--report <path>]");
}

function parseCliOptions(argv) {
  const options = {
    siteRootArg: "",
    reportPath: "",
    help: false,
  };

  for (let idx = 0; idx < argv.length; idx += 1) {
    const arg = String(argv[idx] || "").trim();
    if (!arg) {
      // eslint-disable-next-line no-continue
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      // eslint-disable-next-line no-continue
      continue;
    }
    if (arg === "--report") {
      const next = String(argv[idx + 1] || "").trim();
      if (!next) {
        throw new Error("missing value for --report");
      }
      options.reportPath = next;
      idx += 1;
      // eslint-disable-next-line no-continue
      continue;
    }
    if (!options.siteRootArg) {
      options.siteRootArg = arg;
      // eslint-disable-next-line no-continue
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }

  return options;
}

function buildReportPayload(status, siteRoot, manifest, warnings, errorMessage) {
  return {
    status,
    checkedAt: new Date().toISOString(),
    siteRoot,
    scope: String(manifest?.scope || "all"),
    books: Number(manifest?.books || 0),
    files: Number(manifest?.files || 0),
    totalBytes: Number(manifest?.totalBytes || 0),
    missingAssets: Number(manifest?.missingAssets || 0),
    warnings: Array.isArray(warnings) ? warnings : [],
    error: errorMessage ? String(errorMessage) : "",
  };
}

async function maybeWriteReport(reportPath, payload) {
  const resolvedReportPath = String(reportPath || "").trim();
  if (!resolvedReportPath) {
    return "";
  }
  const absReportPath = path.resolve(resolvedReportPath);
  await writeFile(absReportPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return absReportPath;
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

async function sha256File(filePath) {
  const bytes = await readFile(filePath);
  return createHash("sha256").update(bytes).digest("hex");
}

function resolveSafePathWithinRoot(rootDir, relPath) {
  const normalizedRelPath = String(relPath || "").trim();
  if (!normalizedRelPath || path.isAbsolute(normalizedRelPath) || normalizedRelPath.includes("\0")) {
    return null;
  }
  const resolvedPath = path.resolve(rootDir, normalizedRelPath);
  const relativeToRoot = path.relative(rootDir, resolvedPath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    return null;
  }
  return resolvedPath;
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

    if (manifest.checksumMode === "sha256") {
      const checksums = manifest.checksums && typeof manifest.checksums === "object"
        ? manifest.checksums
        : null;
      if (!checksums) {
        errors.push("manifest.checksumMode=sha256 but checksums is missing");
      } else {
        const requiredChecksumTargets = [
          "index.html",
          "book.html",
          "data/books.json",
          "DEPLOY-EDGEONE.md",
        ];
        if (missingAssetsCount > 0) {
          requiredChecksumTargets.push("MISSING-ASSETS.txt");
        }
        requiredChecksumTargets.forEach((requiredPath) => {
          if (!(requiredPath in checksums)) {
            errors.push(`checksum missing for required file: ${requiredPath}`);
          }
        });

        const checksumEntries = Object.entries(checksums);
        for (const [relPath, expected] of checksumEntries) {
          const normalizedRelPath = String(relPath || "").trim();
          const expectedHash = String(expected || "").trim().toLowerCase();
          if (!normalizedRelPath || !expectedHash) {
            errors.push(`invalid checksum entry: ${String(relPath)}`);
            // eslint-disable-next-line no-continue
            continue;
          }
          if (!/^[a-f0-9]{64}$/.test(expectedHash)) {
            errors.push(`invalid checksum format: ${normalizedRelPath}`);
            // eslint-disable-next-line no-continue
            continue;
          }
          const targetPath = resolveSafePathWithinRoot(siteRoot, normalizedRelPath);
          if (!targetPath) {
            errors.push(`invalid checksum target path: ${normalizedRelPath}`);
            // eslint-disable-next-line no-continue
            continue;
          }
          // eslint-disable-next-line no-await-in-loop
          if (!(await exists(targetPath))) {
            errors.push(`checksum target missing: ${normalizedRelPath}`);
            // eslint-disable-next-line no-continue
            continue;
          }
          // eslint-disable-next-line no-await-in-loop
          const actualHash = await sha256File(targetPath);
          if (actualHash !== expectedHash) {
            errors.push(`checksum mismatch: ${normalizedRelPath}`);
          }
        }
      }
    } else if (manifest.checksumMode === "none" || manifest.checksumMode == null) {
      warnings.push("manifest checksum verification is disabled (checksumMode=none)");
    } else {
      warnings.push(`manifest checksum mode is unsupported: ${String(manifest.checksumMode)}`);
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

async function run(options) {
  const siteRootArg = String(options?.siteRootArg || "").trim();
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

  return {
    siteRoot,
    manifest,
    warnings: result.warnings || [],
  };
}

async function main() {
  let cliOptions = null;
  try {
    cliOptions = parseCliOptions(process.argv.slice(2));
  } catch (err) {
    usage();
    throw err;
  }

  if (cliOptions.help) {
    usage();
    return;
  }
  if (!cliOptions.siteRootArg) {
    usage();
    throw new Error("site root path is required");
  }

  try {
    const output = await run(cliOptions);
    const reportPayload = buildReportPayload("ok", output.siteRoot, output.manifest, output.warnings, "");
    const reportPath = await maybeWriteReport(cliOptions.reportPath, reportPayload);

    console.log("edgeone-preflight: ok");
    console.log(`siteRoot: ${output.siteRoot}`);
    console.log(`scope: ${String(output.manifest.scope || "all")}`);
    console.log(`books: ${Number(output.manifest.books || 0)}`);
    console.log(`files: ${Number(output.manifest.files || 0)}`);
    console.log(`totalBytes: ${Number(output.manifest.totalBytes || 0)}`);
    console.log(`missingAssets: ${Number(output.manifest.missingAssets || 0)}`);
    if (output.warnings.length) {
      console.log(`warnings: ${output.warnings.length}`);
      output.warnings.forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item}`);
      });
    }
    if (reportPath) {
      console.log(`report: ${reportPath}`);
    }
  } catch (err) {
    const siteRootForReport = cliOptions?.siteRootArg
      ? path.resolve(String(cliOptions.siteRootArg))
      : "";
    const reportPayload = buildReportPayload(
      "fail",
      siteRootForReport,
      {},
      [],
      String(err?.message || err)
    );
    try {
      const reportPath = await maybeWriteReport(cliOptions?.reportPath || "", reportPayload);
      if (reportPath) {
        console.error(`report: ${reportPath}`);
      }
    } catch (reportErr) {
      console.error(`edgeone-preflight: report write failed: ${String(reportErr?.message || reportErr)}`);
    }
    console.error("edgeone-preflight: fail");
    console.error(String(err?.message || err));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("edgeone-preflight: fail");
  console.error(String(err?.message || err));
  process.exitCode = 1;
});
