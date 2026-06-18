#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
UPDATE_SCRIPT="${ROOT}/Update EEG Viewer.command"
LOG="${ROOT}/pull_update_eeg_viewer.log"
REPO_URL="https://github.com/saitosatoshi-1/eeg-viewer-montage-analysis.git"

exec > >(tee -a "${LOG}") 2>&1

echo "EEG Viewer pull and update"
echo "Project: montage_analysis"
echo "Root: ${ROOT}"
echo "Log: ${LOG}"
echo

if [ -d "${ROOT}/.git" ]; then
  echo "Preparing GitHub sync..."
  if git -C "${ROOT}" remote get-url origin >/dev/null 2>&1; then
    git -C "${ROOT}" remote set-url origin "${REPO_URL}"
  else
    git -C "${ROOT}" remote add origin "${REPO_URL}"
  fi

  echo "Pulling latest changes from GitHub..."
  if git -C "${ROOT}" fetch --prune origin && git -C "${ROOT}" pull --ff-only --autostash origin main; then
    echo
  else
    echo
    echo "ERROR: Could not pull latest changes from GitHub."
    echo "Make sure this Mac can access:"
    echo "${REPO_URL}"
    read -r -p "Press return to close. " _
    exit 1
  fi
else
  echo "No .git directory found in this project."
  echo "Skipping git pull and using the files currently in this folder."
  echo
fi

if [ ! -x "${UPDATE_SCRIPT}" ]; then
  echo "ERROR: update script is missing or not executable:"
  echo "${UPDATE_SCRIPT}"
  read -r -p "Press return to close. " _
  exit 1
fi

echo "Reflecting this project into the installed EEG Viewer app..."
/bin/bash "${UPDATE_SCRIPT}"
