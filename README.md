# Hybrid EEG Viewer App

Local EEG review app inspired by the Nihon Kohden review workflow. It reads NKT
EEG files with the direct frame reader when possible, opens EDF through MNE, and
keeps annotations in separate JSON/CSV files without modifying raw EEG files.

## Run

```bash
python app.py
```

Then open `http://127.0.0.1:8765`.

## Sync and Update

This project is managed in GitHub as:

`https://github.com/saitosatoshi-1/eeg-viewer-montage-analysis`

On a Mac that already has this project folder, double-click:

`Sync and Open EEG Viewer.command`

That command pulls the latest GitHub changes, reflects this project into
`/Users/Shared/EEG Viewer/app`, stops the old local server, and opens
`/Applications/EEG Viewer.app`.

Use this project folder for the montage_analysis app only. A separate EEG
Viewer project may exist elsewhere and has a different design.

Codex agents on any Mac, including cloud Codex, should read `AGENTS.md` and
`CODEX.md` before working in this project. Those files define the project
identity, GitHub workflow, local install target, and the separate EEG Viewer
project that should not be mixed with this one.

## macOS launcher

`EEG Viewer.app` in this folder is a macOS launcher for this app. Double-clicking
it starts the local server if needed, then opens the viewer URL. The launcher
detects the folder it is inside, so the folder can be copied to another Mac or
opened from Desktop, Downloads, or another location.

The launcher uses the installed EEG Viewer runtime when available:
`~/Library/Application Support/EEG Viewer/runtime`. If that runtime is not
installed, it opens `Install EEG Viewer Runtime.command` from this folder.
After the runtime is installed once on that Mac, double-clicking
`EEG Viewer.app` is enough. It also falls back to a local Python environment
that already has `mne`, `scipy`, and `numpy`.

## Windows collaborators

Windows users can run the same local web app with the Windows batch files in
this folder:

- `Setup EEG Viewer Windows.bat`
- `Install EEG Viewer Runtime Windows.bat`
- `Run EEG Viewer Windows.bat`

They should install Miniforge or another conda distribution first, then run
`Setup EEG Viewer Windows.bat` once. The setup creates a Desktop/Start Menu icon
named `EEG Viewer`, which is used for daily launch.
See `packaging/windows/README_WINDOWS.md` for the full Windows quick start.

For collaborators who should not access GitHub, distribute:

`共同研究者配布用_Windows/配布用_Windows_EEG_Viewer.zip`

## Defaults

- Montage: longitudinal bipolar
- Sensitivity: 10 uV/mm
- Time constant: 0.3 s
- Time window: 10 s with 1 s grid
- Paper speed display: 30 mm/s
- ECG: fixed bottom trace, preferring `X5`, then `E`, `ECG`, or `EKG`
- AC filter: 50 Hz
- High cut filter: 120 Hz

## Controls

- Left/right arrow keys move by 1 second.
- The `◀1` and `1▶` buttons also move by 1 second.
- Up arrow or `+` makes waveforms larger by stepping to the next more sensitive
  uV/mm preset. Down arrow or `-` makes waveforms smaller.
- Number keys change montage: `1` longitudinal, `2` A1/A2, `3` average,
  `4` Cz, `5` transverse.
- Right-click the waveform to add a point or range annotation.
- The right annotation list shows event time and comment; selecting a row jumps
  the viewer to that time.
- The file path box opens `.EEG` and `.edf` files directly. Recently opened
  paths are kept in the browser and the server remembers opened files in
  `user_files.json`.

## Notes

The bundled Windows Nihon Kohden viewer is used only as a reference. The local
web app can run without launching it, but recordings or viewer binaries that are
only symlinked from another folder still need their original files to exist.

## Backup Policy

Keep backups inside `eeg_viewer_app/eeg_viewer_app_backups/`, not on Desktop.
Use `./backup_source.sh` from this folder when preserving the current app state.
That script creates a small source-only zip and intentionally excludes large or
regenerable items:

- existing backups in `eeg_viewer_app_backups/`
- `EEG Viewer Archive ...` and `EEG Viewer Distribution ...`
- `dist/`
- installer `.pkg` and `.dmg` files
- `PortaView.zip`
- `__pycache__/` and `.DS_Store`
- update logs

Do not zip the whole `eeg_viewer_app` folder for routine backups. Whole-folder
zips recursively capture old backups and installer archives, quickly making the
folder several gigabytes. Keep only the latest source backup plus any explicitly
important historical backup.
## Security Notes

This viewer is intended for local EEG review and research test presentation, not as a validated diagnostic or quantitative measurement device. Report filter settings, reference, time window, and montage when exporting results.

The app binds to `127.0.0.1` by default. Mutating API calls require a per-launch browser token and same-origin localhost requests. Do not expose the server with `--host 0.0.0.0` on an untrusted network. Video paths declared by FDS sidecar files are restricted to the selected recording folder.
