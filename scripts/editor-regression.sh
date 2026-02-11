#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

REPORT_PATH="${EDITOR_REGRESSION_REPORT:-tmp/editor-regression-report.json}"

echo "[1/3] syntax check (editor js)"
find reading-garden-editor/editor/js -type f -name "*.js" ! -path "*vendor*" -print0 \
  | xargs -0 -n1 node --check

echo "[2/3] syntax check (runtime js)"
find js scripts -type f \( -name "*.js" -o -name "*.mjs" \) ! -path "*vendor*" -print0 \
  | xargs -0 -n1 node --check

echo "[3/3] regression checks"
EDITOR_REGRESSION_REPORT="$REPORT_PATH" node scripts/editor-regression.mjs

echo "editor regression passed (report: $REPORT_PATH)"
