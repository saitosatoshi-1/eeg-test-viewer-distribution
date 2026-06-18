# AGENTS.md

## Project Identity

This repository is the `montage_analysis` EEG Viewer app.

GitHub repository:

`https://github.com/saitosatoshi-1/eeg-viewer-montage-analysis`

Primary local project path on Saito's Mac:

`/Users/saitosatoshi/Desktop/montage/eeg_viewer_app_montage_analysis`

Installed runtime target:

`/Users/Shared/EEG Viewer/app`

Installed launcher:

`/Applications/EEG Viewer.app`

Local server port:

`8765`

## Do Not Confuse With Other EEG Viewer Projects

This project is separate from other EEG Viewer projects. In particular, do not
inspect, modify, launch, or compare against this folder unless the user
explicitly asks for it:

`/Users/saitosatoshi/Desktop/神経/NCNP/研究/IEDs/eeg_viewer_app`

If the user says "this app" or "this project" while working in this repository,
assume they mean this `montage_analysis` repository.

## Cloud Codex vs Local Codex

Use cloud Codex or any Mac's Codex for repository code changes:

- edit source files
- review diffs
- commit and push to GitHub
- create PRs or branch-based changes
- update documentation and scripts

Use local Codex or the user's local Mac for machine-specific actions:

- reflecting files into `/Users/Shared/EEG Viewer/app`
- installing or updating `/Applications/EEG Viewer.app`
- running `.command` files
- approving macOS administrator prompts
- testing local EDF/NKT files
- testing `localhost:8765`
- opening the macOS app

Do not assume a cloud environment can verify local macOS app installation,
local EEG data, or `/Users/Shared` state.

## Standard Workflow

For code changes:

1. Work in this Git repository.
2. Run focused checks when possible.
3. Commit meaningful changes.
4. Push to `origin/main` unless the user asks for a branch or PR.

For syncing another Mac after changes were pushed:

1. Open this repository on that Mac.
2. Double-click `Sync and Open EEG Viewer.command`.

That command should pull the latest GitHub changes, reflect the project into
`/Users/Shared/EEG Viewer/app`, stop the old local server, and open
`/Applications/EEG Viewer.app`.

## Update Reflection Verification

Before saying an update is reflected locally, compare these source files with
`/Users/Shared/EEG Viewer/app`:

- `app.py`
- `static/index.html`
- `static/styles.css`
- `static/app.js`

Use direct file comparison or timestamps. Do not rely on a running process alone,
because another EEG Viewer project may also use port `8765`.

## Git Policy

Track source and reproducible project assets:

- `app.py`
- `static/`
- `packaging/`
- `launcher/`
- `README.md`
- `AGENTS.md`
- `CODEX.md`
- `APP_ID.json`
- `requirements.txt`
- `environment.yml`
- `*.command`

Do not track generated or local-only files:

- `dist/`
- `*.dmg`
- `*.pkg`
- `__pycache__/`
- `.DS_Store`
- `*.log`
- `annotations/`
- `_CodeSignature/`

Do not manually copy source changes between Macs. Use GitHub push/pull.

## Useful Commands

Check Python syntax:

```bash
PYTHONPYCACHEPREFIX=/private/tmp/eeg_viewer_pycache /Users/saitosatoshi/miniforge3/envs/eeg-tn22/bin/python -m py_compile app.py
```

Check JavaScript syntax when the Codex bundled Node runtime is available:

```bash
/Users/saitosatoshi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check static/app.js
```

Reflect and open locally:

```bash
./Sync\ and\ Open\ EEG\ Viewer.command
```

