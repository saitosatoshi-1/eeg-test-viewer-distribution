# EEG Viewer for macOS

## Install

1. Open `EEG Viewer Installer.pkg`.
2. After installation, open `/Applications/EEG Viewer.app`.
3. On first launch, if the Python runtime is not installed yet, the app opens
   `Install EEG Viewer Runtime.command`.
4. Follow the terminal prompt. The runtime is created in:
   `~/Library/Application Support/EEG Viewer/runtime`

## Requirements

- Apple Silicon Mac is recommended for this package build.
- Miniforge, Mambaforge, Miniconda, or Anaconda must already be installed.
- Internet access is required the first time the runtime is created.

## Data

This installer does not include patient EEG recordings or the Nihon Kohden
Windows viewer. Open `.EEG` or `.edf` recordings from the viewer toolbar.

## Start

Open:

`/Applications/EEG Viewer.app`

The app starts a local server and opens:

`http://127.0.0.1:8765/`

This build includes the full-record DSA overview below the waveform, with a visible-window bar and click-to-jump navigation.
Large EDF files may take tens of seconds to build the DSA overview the first time.
The result is cached while the local server is running, so reopening the same recording
with the same filter settings is much faster.

## Troubleshooting

If the app does not open, run:

`/Users/Shared/EEG Viewer/Install EEG Viewer Runtime.command`

Then open `/Applications/EEG Viewer.app` again.

If the viewer still does not open, check:

`/tmp/eeg_viewer_app.log`

When the app files are updated by a newer installer, the launcher detects the
change and restarts the local server automatically. This prevents an older
background server from continuing to serve the previous version.
