# EEG Viewer for Windows

This is the Windows quick-start path for collaborators.

## Requirements

- Windows 10 or 11
- Miniforge, Miniconda, Mambaforge, or Anaconda
- Network access during the first runtime install

Recommended installer:

https://conda-forge.org/download/

## First-Time Setup

1. Unzip or copy the EEG Viewer folder to the Windows PC.
2. Double-click `Setup EEG Viewer Windows.bat`.
3. Wait until it says setup is complete.
4. Use the `EEG Viewer` icon on the Desktop or Start Menu.

The runtime is installed into:

`%LOCALAPPDATA%\EEG Viewer\runtime`

## Daily Use

Double-click the `EEG Viewer` icon created on the Desktop or Start Menu.

If the icon is deleted, run `Setup EEG Viewer Windows.bat` again.

The app runs only on the local PC at `127.0.0.1`.

## Notes

- EDF files should work through MNE/edfio.
- Nihon Kohden `.EEG` support depends on whether the recording sidecar files are copied together with the `.EEG` file.
- If Windows Defender or institutional security blocks the batch file, ask IT to allow the local Python runtime and localhost access.
- This is not a validated diagnostic medical device. Review outputs should be manually confirmed.
