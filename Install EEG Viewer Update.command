#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PKG="${ROOT}/dist/macos-installer/EEG Viewer Installer.pkg"
BUILD_SCRIPT="${ROOT}/packaging/macos/build_installer.sh"

if [ ! -f "${PKG}" ]; then
  echo "Installer package was not found. Rebuilding it first..."
  /bin/bash "${BUILD_SCRIPT}"
fi

if [ ! -f "${PKG}" ]; then
  echo "ERROR: ${PKG} was not created."
  read -r -p "Press return to close. " _
  exit 1
fi

TMP_PKG="/private/tmp/eeg_viewer_installer.pkg"
/bin/cp "${PKG}" "${TMP_PKG}"

echo "Installing EEG Viewer update..."
/usr/bin/osascript -e 'do shell script "/usr/sbin/installer -pkg /private/tmp/eeg_viewer_installer.pkg -target /" with administrator privileges'

echo "Starting EEG Viewer..."
/usr/bin/open "/Applications/EEG Viewer.app"

echo
echo "Done."
read -r -p "Press return to close. " _
