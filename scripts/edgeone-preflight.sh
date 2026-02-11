#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ $# -lt 1 ]; then
  echo "Usage: ./scripts/edgeone-preflight.sh <path/to/site.rgsite.zip>" >&2
  exit 1
fi

ZIP_PATH="$1"
if [ ! -f "$ZIP_PATH" ]; then
  echo "zip file not found: $ZIP_PATH" >&2
  exit 1
fi

WORK_DIR="$(mktemp -d /tmp/rg-edgeone-preflight-XXXXXX)"
cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

unzip -q "$ZIP_PATH" -d "$WORK_DIR"
node scripts/edgeone-preflight.mjs "$WORK_DIR"
