#!/bin/bash
set -euo pipefail

SOURCE_ROOT="$(cd "$(dirname "$0")" && pwd)"
SHARED_ROOT="/Users/Shared/EEG Viewer"
SHARED_APP="${SHARED_ROOT}/app"
BUILD_SCRIPT="${SOURCE_ROOT}/packaging/macos/build_installer.sh"
TMP_PAYLOAD="/private/tmp/eeg_viewer_app_update_payload"
TMP_LAUNCHER="/private/tmp/eeg_viewer_launcher_template"
LOG="${SOURCE_ROOT}/update_eeg_viewer.log"
BUILD_NUMBER="${BUILD_NUMBER:-$(date +%Y%m%d%H%M)}"
APP_VERSION="${APP_VERSION:-1.0.${BUILD_NUMBER}}"
NO_PAUSE="${EEG_VIEWER_NO_PAUSE:-0}"

pause_or_exit() {
  if [ "${NO_PAUSE}" = "1" ]; then
    return
  fi
  read -r -p "Press return to close. " _
}

exec > >(tee -a "${LOG}") 2>&1

echo "EEG Viewer update reflection"
echo "Source: ${SOURCE_ROOT}"
echo "Log: ${LOG}"
echo

if [ ! -f "${SOURCE_ROOT}/app.py" ] || [ ! -d "${SOURCE_ROOT}/static" ]; then
  echo "ERROR: app.py or static directory was not found."
  pause_or_exit
  exit 1
fi

/usr/bin/python3 -m py_compile "${SOURCE_ROOT}/app.py"

rm -rf "${TMP_PAYLOAD}"
mkdir -p "${TMP_PAYLOAD}/static" "${TMP_PAYLOAD}/annotations"
printf '{"version":"%s","build":"%s"}\n' "${APP_VERSION}" "${BUILD_NUMBER}" > "${TMP_PAYLOAD}/build_info.json"
install -m 0755 "${SOURCE_ROOT}/app.py" "${TMP_PAYLOAD}/app.py"
install -m 0644 "${SOURCE_ROOT}/__init__.py" "${TMP_PAYLOAD}/__init__.py"
install -m 0644 "${SOURCE_ROOT}/requirements.txt" "${TMP_PAYLOAD}/requirements.txt"
install -m 0644 "${SOURCE_ROOT}/README.md" "${TMP_PAYLOAD}/README.md"
install -m 0644 "${SOURCE_ROOT}/static/index.html" "${TMP_PAYLOAD}/static/index.html"
install -m 0644 "${SOURCE_ROOT}/static/styles.css" "${TMP_PAYLOAD}/static/styles.css"
install -m 0644 "${SOURCE_ROOT}/static/app.js" "${TMP_PAYLOAD}/static/app.js"

rm -rf "${TMP_LAUNCHER}"
mkdir -p "${TMP_LAUNCHER}"
if [ -d "${SOURCE_ROOT}/EEG Viewer.app" ]; then
  /usr/bin/ditto "${SOURCE_ROOT}/EEG Viewer.app" "${TMP_LAUNCHER}/EEG Viewer.app"
elif [ -d "${SOURCE_ROOT}/launcher/EEG Viewer.app" ]; then
  /usr/bin/ditto "${SOURCE_ROOT}/launcher/EEG Viewer.app" "${TMP_LAUNCHER}/EEG Viewer.app"
fi

echo "Updating installed app files..."
/usr/bin/osascript -e "do shell script \"mkdir -p '/Users/Shared/EEG Viewer/app' && /usr/bin/ditto '/private/tmp/eeg_viewer_app_update_payload' '/Users/Shared/EEG Viewer/app' && if [ -d '/private/tmp/eeg_viewer_launcher_template/EEG Viewer.app' ]; then /usr/bin/ditto '/private/tmp/eeg_viewer_launcher_template/EEG Viewer.app' '/Applications/EEG Viewer.app'; fi && /usr/sbin/chown -R root:wheel '/Users/Shared/EEG Viewer/app' && /usr/bin/xattr -cr '/Users/Shared/EEG Viewer/app' && if [ -d '/Applications/EEG Viewer.app' ]; then /usr/sbin/chown -R root:admin '/Applications/EEG Viewer.app' && /bin/chmod -R a+rX '/Applications/EEG Viewer.app' && /bin/chmod 755 '/Applications/EEG Viewer.app/Contents/MacOS/EEG Viewer' && /usr/bin/xattr -cr '/Applications/EEG Viewer.app'; fi\" with administrator privileges"

echo "Rebuilding installer..."
/bin/bash "${BUILD_SCRIPT}"

echo "Stopping old local server so the next launch uses the updated build..."
/usr/bin/pkill -f "app.py --no-browser --port 8765" >/dev/null 2>&1 || true

echo
echo "Done."
echo "Installer DMG: ${SOURCE_ROOT}/dist/macos-installer/EEG Viewer Installer.dmg"
echo "Open /Applications/EEG Viewer.app to start the updated app."
pause_or_exit
