#!/bin/bash
set -euo pipefail

APP_SRC="$(cd "$(dirname "$0")/../.." && pwd)"
ROOT="${APP_SRC}"
PKG_NAME="EEG Viewer Installer.pkg"
DMG_NAME="EEG Viewer Installer.dmg"
BUILD_DIR="/private/tmp/eeg-viewer-macos-installer-build"
FINAL_DIR="${ROOT}/dist/macos-installer"
SUPPORT_PAYLOAD="${BUILD_DIR}/support-payload"
SCRIPTS="${BUILD_DIR}/scripts"
OUTPUT="${BUILD_DIR}/${PKG_NAME}"
FINAL_OUTPUT="${FINAL_DIR}/${PKG_NAME}"
FINAL_DMG="${FINAL_DIR}/${DMG_NAME}"
APP_SUPPORT="${SUPPORT_PAYLOAD}"
LAUNCHER_DIR="${APP_SUPPORT}/launcher-template"
SUPPORT_COMPONENT="${BUILD_DIR}/eeg-viewer-support.pkg"
DMG_STAGING="${BUILD_DIR}/dmg"
BUILD_NUMBER="${BUILD_NUMBER:-$(date +%Y%m%d%H%M)}"
APP_VERSION="${APP_VERSION:-1.0.${BUILD_NUMBER}}"

export COPYFILE_DISABLE=1
export APP_VERSION BUILD_NUMBER

rm -rf "${BUILD_DIR}"
rm -rf "${FINAL_DIR}"
mkdir -p "${FINAL_DIR}"
mkdir -p "${APP_SUPPORT}/app" "${APP_SUPPORT}/FDS" "${LAUNCHER_DIR}" "${SCRIPTS}"

mkdir -p "${APP_SUPPORT}/app/static"
install -m 0644 "${APP_SRC}/static/index.html" "${APP_SUPPORT}/app/static/index.html"
install -m 0644 "${APP_SRC}/static/styles.css" "${APP_SUPPORT}/app/static/styles.css"
install -m 0644 "${APP_SRC}/static/app.js" "${APP_SUPPORT}/app/static/app.js"
install -m 0755 "${APP_SRC}/app.py" "${APP_SUPPORT}/app/app.py"
install -m 0644 "${APP_SRC}/__init__.py" "${APP_SUPPORT}/app/__init__.py"
install -m 0644 "${APP_SRC}/requirements.txt" "${APP_SUPPORT}/app/requirements.txt"
install -m 0644 "${APP_SRC}/README.md" "${APP_SUPPORT}/app/README.md"
install -m 0644 "${APP_SRC}/packaging/macos/environment.yml" "${APP_SUPPORT}/environment.yml"
install -m 0644 "${APP_SRC}/packaging/macos/INSTALL_README.md" "${APP_SUPPORT}/README_FIRST.md"
mkdir -p "${APP_SUPPORT}/app/annotations"
printf '{"version":"%s","build":"%s"}\n' "${APP_VERSION}" "${BUILD_NUMBER}" > "${APP_SUPPORT}/app/build_info.json"

if [ -f "${APP_SRC}/launcher/EEG Viewer.app/Contents/Resources/AppIcon.icns" ]; then
  install -m 0644 "${APP_SRC}/launcher/EEG Viewer.app/Contents/Resources/AppIcon.icns" "${LAUNCHER_DIR}/AppIcon.icns"
fi

/usr/bin/python3 - "${LAUNCHER_DIR}/Info.plist" <<'PY'
from pathlib import Path
import os
import plistlib
import sys

path = Path(sys.argv[1])
app_version = os.environ["APP_VERSION"]
build_number = os.environ["BUILD_NUMBER"]
payload = {
    "CFBundleDevelopmentRegion": "ja",
    "CFBundleDisplayName": "EEG Viewer",
    "CFBundleExecutable": "EEG Viewer",
    "CFBundleIconFile": "AppIcon",
    "CFBundleIdentifier": "local.eeg.viewer",
    "CFBundleInfoDictionaryVersion": "6.0",
    "CFBundleName": "EEG Viewer",
    "CFBundlePackageType": "APPL",
    "CFBundleShortVersionString": app_version,
    "CFBundleVersion": build_number,
    "LSMinimumSystemVersion": "12.0",
    "NSHighResolutionCapable": True,
}
path.parent.mkdir(parents=True, exist_ok=True)
path.write_bytes(plistlib.dumps(payload))
PY

/usr/bin/python3 - "${LAUNCHER_DIR}/EEG Viewer" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
script = r'''#!/bin/bash
set -euo pipefail
export PYTHONDONTWRITEBYTECODE=1

APP_SUPPORT="/Users/Shared/EEG Viewer"
APP_ROOT="${APP_SUPPORT}/app"
if [ -d "${APP_ROOT}/FDS" ]; then
  FDS_DIR="${APP_ROOT}/FDS"
else
  FDS_DIR="${APP_SUPPORT}/FDS"
fi
RUNTIME_DIR="${HOME}/Library/Application Support/EEG Viewer/runtime"
PYTHON="${RUNTIME_DIR}/bin/python"
URL="http://127.0.0.1:8765/"
HEALTH_URL="http://127.0.0.1:8765/api/health"
LOG="/tmp/eeg_viewer_app.log"
STATE_FILE="/tmp/eeg_viewer_app.state"
LAUNCH_AGENT_DIR="${HOME}/Library/LaunchAgents"
LAUNCH_AGENT_LABEL="local.eeg.viewer.server"
LAUNCH_AGENT_PLIST="${LAUNCH_AGENT_DIR}/${LAUNCH_AGENT_LABEL}.plist"
APP_FINGERPRINT="$(APP_ROOT="${APP_ROOT}" /usr/bin/python3 -c 'import hashlib, os
from pathlib import Path

root = Path(os.environ["APP_ROOT"])
digest = hashlib.sha256()
for rel in ("app.py", "static/index.html", "static/styles.css", "static/app.js"):
    path = root / rel
    try:
        digest.update(rel.encode("utf-8") + b"\0")
        digest.update(path.read_bytes())
    except OSError:
        digest.update(rel.encode("utf-8") + b":missing\0")
print(digest.hexdigest())' 2>/dev/null || true)"

show_dialog() {
  /usr/bin/osascript -e "display dialog \"$1\" buttons {\"OK\"} default button \"OK\"" >/dev/null 2>&1 || true
}

show_start_failure() {
  show_dialog "EEG Viewer could not start the local server. Please open ${LOG} and send the last lines to support."
}

if [ ! -x "${PYTHON}" ]; then
  show_dialog "EEG Viewer runtime is not installed yet. The runtime installer will open in Terminal."
  /usr/bin/open "${APP_SUPPORT}/Install EEG Viewer Runtime.command"
  exit 0
fi

xml_escape() {
  printf '%s' "$1" | /usr/bin/sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'
}

write_launch_agent() {
  /bin/mkdir -p "${LAUNCH_AGENT_DIR}"
  {
    printf '%s\n' '<?xml version="1.0" encoding="UTF-8"?>'
    printf '%s\n' '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">'
    printf '%s\n' '<plist version="1.0">'
    printf '%s\n' '<dict>'
    printf '%s\n' '  <key>Label</key>'
    printf '  <string>%s</string>\n' "$(xml_escape "${LAUNCH_AGENT_LABEL}")"
    printf '%s\n' '  <key>ProgramArguments</key>'
    printf '%s\n' '  <array>'
    printf '    <string>%s</string>\n' "$(xml_escape "${PYTHON}")"
    printf '    <string>%s</string>\n' "$(xml_escape "${APP_ROOT}/app.py")"
    printf '%s\n' '    <string>--no-browser</string>'
    printf '%s\n' '    <string>--port</string>'
    printf '%s\n' '    <string>8765</string>'
    printf '%s\n' '    <string>--fds-dir</string>'
    printf '    <string>%s</string>\n' "$(xml_escape "${FDS_DIR}")"
    printf '%s\n' '  </array>'
    printf '%s\n' '  <key>WorkingDirectory</key>'
    printf '  <string>%s</string>\n' "$(xml_escape "${APP_ROOT}")"
    printf '%s\n' '  <key>StandardOutPath</key>'
    printf '  <string>%s</string>\n' "$(xml_escape "${LOG}")"
    printf '%s\n' '  <key>StandardErrorPath</key>'
    printf '  <string>%s</string>\n' "$(xml_escape "${LOG}")"
    printf '%s\n' '  <key>EnvironmentVariables</key>'
    printf '%s\n' '  <dict>'
    printf '%s\n' '    <key>PYTHONDONTWRITEBYTECODE</key>'
    printf '%s\n' '    <string>1</string>'
    printf '%s\n' '  </dict>'
    printf '%s\n' '  <key>RunAtLoad</key>'
    printf '%s\n' '  <true/>'
    printf '%s\n' '</dict>'
    printf '%s\n' '</plist>'
  } > "${LAUNCH_AGENT_PLIST}"
}

start_server() {
  echo "Starting EEG Viewer from ${APP_ROOT}" >> "${LOG}"
  write_launch_agent
  /bin/launchctl bootout "gui/${UID}/${LAUNCH_AGENT_LABEL}" >/dev/null 2>&1 || true
  /bin/launchctl bootstrap "gui/${UID}" "${LAUNCH_AGENT_PLIST}" >> "${LOG}" 2>&1 || true
  /bin/launchctl kickstart -k "gui/${UID}/${LAUNCH_AGENT_LABEL}" >> "${LOG}" 2>&1 || true
}

SERVER_OK=0
HEALTH_PAYLOAD=""
SERVER_FINGERPRINT=""
if HEALTH_PAYLOAD="$(/usr/bin/curl -fsS "${HEALTH_URL}" 2>/dev/null)"; then
  SERVER_OK=1
  SERVER_FINGERPRINT="$(printf '%s' "${HEALTH_PAYLOAD}" | "${PYTHON}" -c 'import json,sys; print(json.load(sys.stdin).get("appFingerprint",""))' 2>/dev/null || true)"
fi

if [ "${SERVER_OK}" -eq 1 ] && [ "${SERVER_FINGERPRINT}" != "${APP_FINGERPRINT}" ]; then
  echo "Restarting EEG Viewer because the running server is not this app build: ${APP_ROOT}" >> "${LOG}"
  /usr/bin/pkill -f "app.py --no-browser --port 8765" >/dev/null 2>&1 || true
  sleep 0.5
  SERVER_OK=0
fi

if [ "${SERVER_OK}" -eq 0 ]; then
  start_server
  for _ in $(seq 1 120); do
    if /usr/bin/curl -fsS "${HEALTH_URL}" >/dev/null 2>&1; then
      break
    fi
    sleep 0.25
  done
fi

if /usr/bin/curl -fsS "${HEALTH_URL}" >/dev/null 2>&1; then
  printf '%s\n' "${APP_FINGERPRINT}" > "${STATE_FILE}"
else
  show_start_failure
  exit 1
fi

/usr/bin/open "${URL}"
'''
path.write_text(script, encoding="utf-8")
path.chmod(0o755)
PY

/usr/bin/python3 - "${APP_SUPPORT}/Install EEG Viewer Runtime.command" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
script = r'''#!/bin/bash
set -euo pipefail
export PYTHONDONTWRITEBYTECODE=1

APP_SUPPORT="/Users/Shared/EEG Viewer"
ENV_FILE="${APP_SUPPORT}/environment.yml"
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
    echo "Open /Applications/EEG Viewer.app"
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

CONDA_BIN="$(find_conda || true)"
if [ -z "${CONDA_BIN}" ]; then
  echo "Miniforge/Mambaforge/Conda was not found."
  echo
  echo "Install Miniforge first, then run this command again:"
  echo "  /Users/Shared/EEG Viewer/Install EEG Viewer Runtime.command"
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
echo "Done. Open /Applications/EEG Viewer.app"
read -r -p "Press return to close this window. " _
'''
path.write_text(script, encoding="utf-8")
path.chmod(0o755)
PY

/usr/bin/python3 - "${SCRIPTS}/postinstall" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
script = r'''#!/bin/bash
set -e
APP_DIR="/Applications/EEG Viewer.app"
rm -rf "${APP_DIR}"
mkdir -p "${APP_DIR}/Contents/MacOS" "${APP_DIR}/Contents/Resources"
install -m 0755 "/Users/Shared/EEG Viewer/launcher-template/EEG Viewer" "${APP_DIR}/Contents/MacOS/EEG Viewer"
install -m 0644 "/Users/Shared/EEG Viewer/launcher-template/Info.plist" "${APP_DIR}/Contents/Info.plist"
if [ -f "/Users/Shared/EEG Viewer/launcher-template/AppIcon.icns" ]; then
  install -m 0644 "/Users/Shared/EEG Viewer/launcher-template/AppIcon.icns" "${APP_DIR}/Contents/Resources/AppIcon.icns"
fi
chmod +x "/Users/Shared/EEG Viewer/Install EEG Viewer Runtime.command" || true
xattr -cr "${APP_DIR}" "/Users/Shared/EEG Viewer" 2>/dev/null || true
codesign --force --deep --sign - "${APP_DIR}" >/dev/null 2>&1 || true
CONSOLE_USER="$(/usr/bin/stat -f %Su /dev/console 2>/dev/null || true)"
if [ -n "${CONSOLE_USER}" ] && [ "${CONSOLE_USER}" != "root" ] && [ -d "/Users/${CONSOLE_USER}/Desktop" ]; then
  DESKTOP_LINK="/Users/${CONSOLE_USER}/Desktop/EEG Test Viewer.app"
  /bin/rm -f "${DESKTOP_LINK}" 2>/dev/null || true
  /bin/ln -s "/Applications/EEG Viewer.app" "${DESKTOP_LINK}" 2>/dev/null || true
  /usr/sbin/chown -h "${CONSOLE_USER}:staff" "${DESKTOP_LINK}" 2>/dev/null || true
fi
rm -f /tmp/eeg_viewer_app.state 2>/dev/null || true
/usr/bin/pkill -f "app.py --no-browser --port 8765" >/dev/null 2>&1 || true
exit 0
'''
path.write_text(script, encoding="utf-8")
path.chmod(0o755)
PY

xattr -cr "${SUPPORT_PAYLOAD}" "${SCRIPTS}" 2>/dev/null || true
find "${SUPPORT_PAYLOAD}" "${SCRIPTS}" -name '._*' -delete

pkgbuild \
  --root "${SUPPORT_PAYLOAD}" \
  --scripts "${SCRIPTS}" \
  --identifier "local.eeg.viewer.support" \
  --version "${APP_VERSION}" \
  --install-location "/Users/Shared/EEG Viewer" \
  "${SUPPORT_COMPONENT}"

productbuild \
  --package "${SUPPORT_COMPONENT}" \
  "${OUTPUT}"

install -m 0644 "${OUTPUT}" "${FINAL_OUTPUT}"
install -m 0644 "${APP_SRC}/packaging/macos/INSTALL_README.md" "${FINAL_DIR}/README_FIRST.md"

mkdir -p "${DMG_STAGING}"
install -m 0644 "${FINAL_OUTPUT}" "${DMG_STAGING}/${PKG_NAME}"
install -m 0644 "${FINAL_DIR}/README_FIRST.md" "${DMG_STAGING}/README_FIRST.md"
if hdiutil create -volname "EEG Viewer Installer" -srcfolder "${DMG_STAGING}" -ov -format UDZO "${FINAL_DMG}" >/dev/null; then
  echo "Built: ${FINAL_DMG}"
else
  echo "Skipped DMG creation; ${FINAL_OUTPUT} is ready."
fi

echo "Built: ${FINAL_OUTPUT}"
echo "Version: ${APP_VERSION}"
