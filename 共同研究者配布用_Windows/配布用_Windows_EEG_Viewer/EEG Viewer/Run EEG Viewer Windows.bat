@echo off
setlocal

set "ROOT=%~dp0"
set "APP=%ROOT%app.py"
set "RUNTIME_DIR=%LOCALAPPDATA%\EEG Viewer\runtime"
set "PYTHON=%RUNTIME_DIR%\python.exe"
set "URL=http://127.0.0.1:8765/"
set "HEALTH=http://127.0.0.1:8765/api/health"
set "LOG=%TEMP%\eeg_viewer_app.log"

if not exist "%PYTHON%" (
  echo EEG Viewer runtime is not installed yet.
  echo Opening runtime installer...
  start "" "%ROOT%Install EEG Viewer Runtime Windows.bat"
  exit /b 0
)

"%PYTHON%" -c "import mne, scipy, numpy, pandas, edfio" >nul 2>nul
if errorlevel 1 (
  echo EEG Viewer runtime is incomplete.
  echo Opening runtime installer...
  start "" "%ROOT%Install EEG Viewer Runtime Windows.bat"
  exit /b 0
)

echo Starting EEG Viewer...
echo Log: %LOG%
start "EEG Viewer Server" /min "%PYTHON%" "%APP%" --no-browser --port 8765

for /l %%I in (1,1,80) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing '%HEALTH%' -TimeoutSec 1; if ($r.StatusCode -eq 200) { exit 0 } } catch { exit 1 }" >nul 2>nul
  if not errorlevel 1 goto :open_viewer
  timeout /t 1 /nobreak >nul
)

echo EEG Viewer could not start.
echo If another app is using port 8765, close it and try again.
pause
exit /b 1

:open_viewer
start "" "%URL%"
exit /b 0
