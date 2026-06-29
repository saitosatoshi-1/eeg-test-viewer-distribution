# AGENTS.md

## Project Identity

This repository is the web-hosted EEG Test Viewer distribution. It is maintained for Render-based research testing, not for Windows/macOS desktop app distribution.

GitHub repository:

`https://github.com/saitosatoshi-1/eeg-test-viewer-distribution`

Primary local path on Saito's Mac:

`/Users/saitosatoshi/Desktop/神経/NCNP/研究/montage/配布用_viewer/github_repos/eeg-test-viewer-distribution`

Render URL:

`https://eeg-test-viewer.onrender.com/`

Shared test link:

`https://eeg-test-viewer.onrender.com/?dataset=private%3Agakkai_v1`

## Current Scope

Keep this repository focused on the web test workflow:

- `app.py` backend server and research test APIs
- `static/` test-only frontend
- `tools/` private dataset zip/upload scripts
- `Dockerfile`, `render.yaml`, and `DEPLOY_WEB.md`
- documentation for Render and private dataset operation

For dataset replacement or adding a new Render private dataset, read `DATASET_SWAP.md` first. Prefer adding a new `private:<dataset_id>` such as `validation_tuea_v2` instead of overwriting an existing dataset.

Do not reintroduce old Windows/macOS distribution bundles, launchers, installer scripts, or packaged collaborator folders unless the user explicitly asks to rebuild desktop distribution.

## Security Rules

- Keep access-code protection enabled for shared Render use.
- Do not set `EEG_VIEWER_ALLOW_UNPROTECTED_PUBLIC=1` on the shared Render service.
- Shared links should not include the password. Users enter `ncnp` on the password screen.
- Do not commit Temple University-derived or otherwise redistribution-restricted EDF files.
- Do not commit private EDF datasets to GitHub. Use the private dataset upload workflow.
- Never commit `EEG_VIEWER_ADMIN_CODE`; use it only as an environment variable or one-time command value for private dataset upload.

## Standard Workflow

1. Work in this Git repository.
2. Run focused checks when possible.
3. Update `/Users/saitosatoshi/Desktop/神経/NCNP/研究/montage/配布用_viewer/作業ログ.md` for changes under the distribution folder.
4. Commit meaningful changes.
5. Push to `origin/main` unless the user asks for a branch or PR.
6. If Render Auto Deploy does not start, ask the user to run Manual Deploy from the Render Dashboard.

## Checks

Python syntax:

```bash
python3 -m py_compile app.py
```

JavaScript syntax with Codex bundled Node, if local `node` is unavailable:

```bash
/Users/saitosatoshi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check static/app.js
```

## Files That Should Stay Out of Git

- `dist/`
- `__pycache__/`
- `.DS_Store`
- `annotations/`
- `exports/`
- `responses/`
- `validation/`
- `*.edf` / `*.EDF`
- generated installers and desktop app bundles
