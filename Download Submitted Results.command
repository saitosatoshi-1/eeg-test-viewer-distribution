#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

OUTPUT_DIR="${HOME}/Downloads/eeg_test_results"

echo "EEG test result JSON downloader"
echo "Viewer: https://eeg-test-viewer.onrender.com"
echo "Output: ${OUTPUT_DIR}"
echo

python3 tools/download_submitted_results.py \
  --viewer-url "https://eeg-test-viewer.onrender.com" \
  --access-code "ncnp" \
  --output "${OUTPUT_DIR}"

echo
echo "Downloaded JSON files are in:"
echo "${OUTPUT_DIR}"
open "${OUTPUT_DIR}"
echo
echo "Done. You can close this window."
read -r -p "Press Return to close..." _
