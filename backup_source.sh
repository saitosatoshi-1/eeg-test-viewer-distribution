#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$ROOT/eeg_viewer_app_backups"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$BACKUP_DIR/eeg_viewer_app_backup_${STAMP}_source.zip"

mkdir -p "$BACKUP_DIR"
cd "$ROOT"

/usr/bin/zip -r "$OUT" \
  app.py \
  static \
  README.md \
  requirements.txt \
  environment.yml \
  packaging \
  launcher \
  "Install EEG Viewer Runtime.command" \
  -x "*.DS_Store" "*/__pycache__/*"

echo "$OUT"
