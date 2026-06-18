# Codex Instructions

This project is the `montage_analysis` EEG Viewer app.

Also read `AGENTS.md`. It contains the durable workflow for cloud Codex, local
Codex, GitHub sync, and local app reflection.

Use this project root only:

`/Users/saitosatoshi/Desktop/montage/eeg_viewer_app_montage_analysis`

Do not inspect, modify, launch, or compare against this separate EEG Viewer project unless the user explicitly asks for it:

`/Users/saitosatoshi/Desktop/神経/NCNP/研究/IEDs/eeg_viewer_app`

Project identity:

- Project: `montage_analysis`
- App family: `EEG Viewer`
- Runtime install target: `/Users/Shared/EEG Viewer/app`
- Launcher install target: `/Applications/EEG Viewer.app`
- Local server port: `8765`
- Update command: `Update EEG Viewer.command`
- Pull/update command: `Pull and Update EEG Viewer.command`
- One-click sync/update/open command: `Sync and Open EEG Viewer.command`

When the user says "this app" or "this project" in this folder, assume they mean the `montage_analysis` project above.

Before saying an update is reflected, compare these source files with `/Users/Shared/EEG Viewer/app`:

- `app.py`
- `static/index.html`
- `static/styles.css`
- `static/app.js`

Use direct file comparison or timestamps. Do not rely on any unrelated running EEG Viewer process, because another project may also run on port `8765`.
