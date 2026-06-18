@echo off
setlocal

set "ROOT=%~dp0"
set "ENV_FILE=%ROOT%packaging\windows\environment.yml"
set "RUNTIME_ROOT=%LOCALAPPDATA%\EEG Viewer"
set "RUNTIME_DIR=%RUNTIME_ROOT%\runtime"
set "PYTHON=%RUNTIME_DIR%\python.exe"

echo EEG Viewer Runtime Installer for Windows
echo Root: %ROOT%
echo Runtime: %RUNTIME_DIR%
echo.

if exist "%PYTHON%" (
  "%PYTHON%" -c "import mne, scipy, numpy, pandas, edfio" >nul 2>nul
  if not errorlevel 1 (
    echo Runtime is already installed.
    echo You can run "Run EEG Viewer Windows.bat".
    pause
    exit /b 0
  )
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
echo Install Miniforge for Windows first, then run this file again:
echo https://conda-forge.org/download/
pause
exit /b 1

:found_conda
echo Using: %CONDA_EXE%
if not exist "%RUNTIME_ROOT%" mkdir "%RUNTIME_ROOT%"
if exist "%RUNTIME_DIR%" rmdir /s /q "%RUNTIME_DIR%"

"%CONDA_EXE%" env create -p "%RUNTIME_DIR%" -f "%ENV_FILE%"
if errorlevel 1 (
  echo Runtime install failed.
  pause
  exit /b 1
)

"%PYTHON%" -c "import mne, scipy, numpy, pandas, edfio"
if errorlevel 1 (
  echo Runtime verification failed.
  pause
  exit /b 1
)

echo.
echo Runtime installed successfully.
echo You can run "Run EEG Viewer Windows.bat".
pause
