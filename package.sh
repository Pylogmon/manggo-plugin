#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="$ROOT/dist"
OUT_FILE="$OUT_DIR/com.manggo.examples.openai-compatible-services.mplugin"

mkdir -p "$OUT_DIR"
rm -f "$OUT_FILE"
cd "$ROOT"
zip -r "$OUT_FILE" manggo.plugin.json main.js icon.png README.md

echo "$OUT_FILE"
