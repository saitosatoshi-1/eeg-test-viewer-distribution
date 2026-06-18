#!/bin/bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")" && pwd)"
if [ -f "${APP_ROOT}/environment.yml" ]; then
  ENV_FILE="${APP_ROOT}/environment.yml"
else
  ENV_FILE="${APP_ROOT}/packaging/macos/environment.yml"
fi
RUNTIME_ROOT="${HOME}/Library/Application Support/EEG Viewer"
RUNTIME_DIR="${RUNTIME_ROOT}/runtime"
LOG="${RUNTIME_ROOT}/runtime-install.log"

mkdir -p "${RUNTIME_ROOT}"
exec > >(tee -a "${LOG}") 2>&1

echo "EEG Viewer Runtime Installer"
echo "Log: ${LOG}"
echo

if [ -x "${RUNTIME_DIR}/bin/python" ]; then
  if "${RUNTIME_DIR}/bin/python" -c "import mne, scipy, numpy" >/dev/null 2>&1; then
    echo "Runtime is already installed: ${RUNTIME_DIR}"
    echo "Open: ${APP_ROOT}/EEG Viewer.app"
    read -r -p "Press return to close this window. " _
    exit 0
  fi
fi

find_conda() {
  for candidate in \
    "${HOME}/miniforge3/bin/mamba" \
    "${HOME}/miniforge3/bin/conda" \
    "${HOME}/mambaforge/bin/mamba" \
    "${HOME}/mambaforge/bin/conda" \
    "${HOME}/miniconda3/bin/conda" \
    "${HOME}/anaconda3/bin/conda" \
    "/opt/homebrew/bin/mamba" \
    "/opt/homebrew/bin/conda" \
    "/opt/anaconda3/bin/conda"
  do
    if [ -x "${candidate}" ]; then
      printf '%s\n' "${candidate}"
      return 0
    fi
  done
  return 1
}

if [ ! -f "${ENV_FILE}" ]; then
  echo "environment.yml was not found."
  echo "Expected: ${ENV_FILE}"
  read -r -p "Press return to close this window. " _
  exit 1
fi

CONDA_BIN="$(find_conda || true)"
if [ -z "${CONDA_BIN}" ]; then
  echo "Miniforge/Mambaforge/Conda was not found."
  echo
  echo "Install Miniforge first, then run this command again:"
  echo "  ${APP_ROOT}/Install EEG Viewer Runtime.command"
  echo
  echo "Miniforge download:"
  echo "  https://github.com/conda-forge/miniforge"
  read -r -p "Press return to close this window. " _
  exit 1
fi

echo "Using: ${CONDA_BIN}"
echo "Creating runtime at: ${RUNTIME_DIR}"
rm -rf "${RUNTIME_DIR}"
"${CONDA_BIN}" env create -p "${RUNTIME_DIR}" -f "${ENV_FILE}" -y
"${RUNTIME_DIR}/bin/python" -c "import mne, scipy, numpy; print('Runtime OK')"

echo
echo "Done. Open: ${APP_ROOT}/EEG Viewer.app"
read -r -p "Press return to close this window. " _
