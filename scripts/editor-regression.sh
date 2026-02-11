#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "[1/2] syntax check (editor js)"
find reading-garden-editor/editor/js -type f -name "*.js" ! -path "*vendor*" -print0 \
  | xargs -0 -n1 node --check

echo "[2/2] regression checks"
node scripts/editor-regression.mjs

echo "editor regression passed"
