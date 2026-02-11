#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

WORK_DIR="$(mktemp -d /tmp/rg-edgeone-selftest-XXXXXX)"
cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

assert_failure_contains() {
  local expected="$1"
  shift
  set +e
  local output
  output="$("$@" 2>&1)"
  local code=$?
  set -e
  if [ "$code" -eq 0 ]; then
    echo "expected failure but got success: $*" >&2
    exit 1
  fi
  if ! printf '%s' "$output" | grep -Fq "$expected"; then
    echo "expected failure output to include: $expected" >&2
    echo "actual output:" >&2
    printf '%s\n' "$output" >&2
    exit 1
  fi
}

write_manifest_with_checksums() {
  local site_root="$1"
  local books_count="$2"
  node - "$site_root" "$books_count" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const siteRoot = process.argv[2];
const booksCount = Number(process.argv[3] || "1");

function walkFiles(dir, rootDir, acc) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(absPath, rootDir, acc);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const relPath = path.relative(rootDir, absPath).replace(/\\/g, "/");
    if (relPath === "rgsite-manifest.json") {
      continue;
    }
    acc.push(relPath);
  }
}

const relFiles = [];
walkFiles(siteRoot, siteRoot, relFiles);
relFiles.sort();

const checksums = {};
let totalBytes = 0;
for (const relPath of relFiles) {
  const absPath = path.join(siteRoot, relPath);
  const bytes = fs.readFileSync(absPath);
  totalBytes += bytes.length;
  checksums[relPath] = crypto.createHash("sha256").update(bytes).digest("hex");
}

const manifest = {
  format: "rgsite",
  scope: "full",
  books: booksCount,
  files: relFiles.length,
  totalBytes,
  missingAssets: 0,
  selectedBookIds: [],
  checksumMode: "sha256",
  checksums,
};

fs.writeFileSync(
  path.join(siteRoot, "rgsite-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);
NODE
}

build_minimal_sample() {
  local site_root="$1"
  mkdir -p "$site_root/data/demo" "$site_root/css" "$site_root/js"
  printf '<!doctype html>\n' > "$site_root/index.html"
  printf '<!doctype html>\n' > "$site_root/book.html"
  printf 'body { font-family: sans-serif; }\n' > "$site_root/css/style.css"
  printf "console.log('ok');\n" > "$site_root/js/app.js"
  cat > "$site_root/data/books.json" <<'JSON'
{
  "books": [
    {
      "id": "demo",
      "title": "Demo",
      "page": "book.html?book=demo"
    }
  ]
}
JSON
  cat > "$site_root/data/demo/registry.json" <<'JSON'
{
  "id": "demo",
  "modules": []
}
JSON
  printf '# DEPLOY\nEdgeOne\n' > "$site_root/DEPLOY-EDGEONE.md"
  write_manifest_with_checksums "$site_root" "1"
}

build_real_asset_sample() {
  local site_root="$1"
  mkdir -p "$site_root/data"
  cp index.html "$site_root/index.html"
  cp book.html "$site_root/book.html"
  cp -R css "$site_root/css"
  cp -R js "$site_root/js"
  printf '# DEPLOY\nEdgeOne\n' > "$site_root/DEPLOY-EDGEONE.md"

  local selected_book_id
  selected_book_id="$(node - <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const booksPath = path.join(process.cwd(), "data", "books.json");
const booksRaw = fs.readFileSync(booksPath, "utf8");
const booksData = JSON.parse(booksRaw);
const books = Array.isArray(booksData?.books) ? booksData.books : [];
for (const book of books) {
  const bookId = String(book?.id || "").trim();
  if (!bookId) {
    continue;
  }
  const registryPath = path.join(process.cwd(), "data", bookId, "registry.json");
  if (fs.existsSync(registryPath)) {
    process.stdout.write(bookId);
    process.exit(0);
  }
}
process.exit(1);
NODE
)"
  if [ -z "$selected_book_id" ]; then
    echo "no valid book id found for real-asset sample" >&2
    exit 1
  fi

  mkdir -p "$site_root/data/$selected_book_id"
  cp "data/$selected_book_id/registry.json" "$site_root/data/$selected_book_id/registry.json"

  node - "$selected_book_id" "$site_root/data/books.json" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const bookId = String(process.argv[2] || "").trim();
const outputPath = process.argv[3];
const booksPath = path.join(process.cwd(), "data", "books.json");
const booksRaw = fs.readFileSync(booksPath, "utf8");
const booksData = JSON.parse(booksRaw);
const books = Array.isArray(booksData?.books) ? booksData.books : [];
const matched = books.find((item) => String(item?.id || "").trim() === bookId);
if (!matched) {
  process.exit(1);
}
const payload = { books: [matched] };
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
NODE

  write_manifest_with_checksums "$site_root" "1"
}

build_zip_from_site() {
  local site_root="$1"
  local zip_path="$2"
  (
    cd "$site_root"
    zip -qr "$zip_path" .
  )
}

run_preflight_zip() {
  local site_root="$1"
  local zip_path="$2"
  build_zip_from_site "$site_root" "$zip_path"
  ./scripts/edgeone-preflight.sh "$zip_path"
}

echo "[edgeone-selftest] minimal sample"
MINIMAL_ROOT="$WORK_DIR/minimal-site"
MINIMAL_ZIP="$WORK_DIR/minimal.rgsite.zip"
build_minimal_sample "$MINIMAL_ROOT"
run_preflight_zip "$MINIMAL_ROOT" "$MINIMAL_ZIP"

echo "[edgeone-selftest] tamper checksum sample (expected fail)"
printf 'tamper\n' >> "$MINIMAL_ROOT/index.html"
build_zip_from_site "$MINIMAL_ROOT" "$MINIMAL_ZIP"
assert_failure_contains "checksum mismatch:" ./scripts/edgeone-preflight.sh "$MINIMAL_ZIP"

echo "[edgeone-selftest] unsafe checksum path sample (expected fail)"
build_minimal_sample "$MINIMAL_ROOT"
node - "$MINIMAL_ROOT/rgsite-manifest.json" <<'NODE'
const fs = require("node:fs");
const manifestPath = process.argv[2];
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (!manifest.checksums || typeof manifest.checksums !== "object") {
  manifest.checksums = {};
}
manifest.checksums["../outside.txt"] = "0".repeat(64);
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
NODE
build_zip_from_site "$MINIMAL_ROOT" "$MINIMAL_ZIP"
assert_failure_contains "invalid checksum target path:" ./scripts/edgeone-preflight.sh "$MINIMAL_ZIP"

echo "[edgeone-selftest] missing required checksum entry sample (expected fail)"
build_minimal_sample "$MINIMAL_ROOT"
node - "$MINIMAL_ROOT/rgsite-manifest.json" <<'NODE'
const fs = require("node:fs");
const manifestPath = process.argv[2];
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (manifest.checksums && typeof manifest.checksums === "object") {
  delete manifest.checksums["index.html"];
}
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
NODE
build_zip_from_site "$MINIMAL_ROOT" "$MINIMAL_ZIP"
assert_failure_contains "checksum missing for required file: index.html" ./scripts/edgeone-preflight.sh "$MINIMAL_ZIP"

echo "[edgeone-selftest] invalid checksum format sample (expected fail)"
build_minimal_sample "$MINIMAL_ROOT"
node - "$MINIMAL_ROOT/rgsite-manifest.json" <<'NODE'
const fs = require("node:fs");
const manifestPath = process.argv[2];
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (manifest.checksums && typeof manifest.checksums === "object") {
  manifest.checksums["index.html"] = "not-a-sha256-hash";
}
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
NODE
build_zip_from_site "$MINIMAL_ROOT" "$MINIMAL_ZIP"
assert_failure_contains "invalid checksum format: index.html" ./scripts/edgeone-preflight.sh "$MINIMAL_ZIP"

echo "[edgeone-selftest] real-asset sample"
REAL_ROOT="$WORK_DIR/real-site"
REAL_ZIP="$WORK_DIR/real.rgsite.zip"
build_real_asset_sample "$REAL_ROOT"
run_preflight_zip "$REAL_ROOT" "$REAL_ZIP"

echo "[edgeone-selftest] ok"
