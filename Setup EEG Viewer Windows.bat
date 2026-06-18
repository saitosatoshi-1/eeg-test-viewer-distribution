@echo off
setlocal

set "ROOT=%~dp0"
set "ENV_FILE=%ROOT%packaging\windows\environment.yml"
set "RUNTIME_ROOT=%LOCALAPPDATA%\EEG Viewer"
set "RUNTIME_DIR=%RUNTIME_ROOT%\runtime"
set "PYTHON=%RUNTIME_DIR%\python.exe"
set "START_VBS=%ROOT%Start EEG Viewer Windows.vbs"
set "DESKTOP_LINK=%USERPROFILE%\Desktop\EEG Viewer.lnk"
set "START_MENU_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\EEG Viewer"
set "START_MENU_LINK=%START_MENU_DIR%\EEG Viewer.lnk"

echo EEG Viewer Setup for Windows
echo Folder: %ROOT%
echo Runtime: %RUNTIME_DIR%
echo.

if exist "%PYTHON%" (
  "%PYTHON%" -c "import mne, scipy, numpy, pandas, edfio" >nul 2>nul
  if not errorlevel 1 goto :runtime_ready
)

set "CONDA_EXE="
for %%P in (
  "%USERPROFILE%\miniforge3\Scripts\mamba.exe"
  "%USERPROFILE%\miniforge3\Scripts\conda.exe"
  "%USERPROFILE%\mambaforge\Scripts\mamba.exe"
  "%USERPROFILE%\mambaforge\Scripts\conda.exe"
  "%USERPROFILE%\miniconda3\Scripts\conda.exe"
  "%USERPROFILE%\anaconda3\Scripts\conda.exe"
  "%ProgramData%\miniforge3\Scripts\mamba.exe"
  "%ProgramData%\miniforge3\Scripts\conda.exe"
  "%ProgramData%\miniconda3\Scripts\conda.exe"
  "%ProgramData%\anaconda3\Scripts\conda.exe"
) do (
  if exist "%%~P" (
    set "CONDA_EXE=%%~P"
    goto :found_conda
  )
)

echo Could not find conda or mamba.
echo.
echo Please install Miniforge for Windows first, then run this setup again:
echo https://conda-forge.org/download/
pause
exit /b 1

:found_conda
echo Installing EEG Viewer runtime with:
echo %CONDA_EXE%
echo.

if not exist "%RUNTIME_ROOT%" mkdir "%RUNTIME_ROOT%"
if exist "%RUNTIME_DIR%" rmdir /s /q "%RUNTIME_DIR%"

"%CONDA_EXE%" env create -p "%RUNTIME_DIR%" -f "%ENV_FILE%"
if errorlevel 1 (
  echo.
  echo Runtime install failed.
  pause
  exit /b 1
)

"%PYTHON%" -c "import mne, scipy, numpy, pandas, edfio"
if errorlevel 1 (
  echo.
  echo Runtime verification failed.
  pause
  exit /b 1
)

:runtime_ready
echo Runtime is ready.
echo Creating EEG Viewer icons...

if not exist "%START_MENU_DIR%" mkdir "%START_MENU_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws=New-Object -ComObject WScript.Shell; $s=$ws.CreateShortcut('%DESKTOP_LINK%'); $s.TargetPath='wscript.exe'; $s.Arguments='""%START_VBS%""'; $s.WorkingDirectory='%ROOT%'; $s.IconLocation='%SystemRoot%\System32\shell32.dll,220'; $s.Save(); $s=$ws.CreateShortcut('%START_MENU_LINK%'); $s.TargetPath='wscript.exe'; $s.Arguments='""%START_VBS%""'; $s.WorkingDirectory='%ROOT%'; $s.IconLocation='%SystemRoot%\System32\shell32.dll,220'; $s.Save()"
if errorlevel 1 (
  echo.
  echo Shortcut creation failed, but the app can still be started with:
  echo Run EEG Viewer Windows.bat
  pause
  exit /b 1
)

echo.
echo Setup complete.
echo Use the EEG Viewer icon on the Desktop or Start Menu.
pause
