#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TARGET_DIR="/var/www/sed/frontend"

cd "$ROOT_DIR/frontend"

if [ ! -d dist ]; then
  echo "frontend/dist not found. Run deploy/scripts/build-frontend.sh first." >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"
cp -r dist/. "$TARGET_DIR/"
