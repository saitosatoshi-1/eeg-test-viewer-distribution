# EEG Test Viewer Distribution

Web-based EEG reading test viewer for research use. This repository is now maintained for the Render-hosted test workflow, not for Windows/macOS desktop distribution packages.

## Current Test Link

Use the access-code link when sharing the viewer:

```text
https://eeg-test-viewer.onrender.com/?access=ncnp&dataset=private%3Agakkai_v1
```

The `access=ncnp` parameter sets an HTTP-only access cookie and is then removed from the visible URL. Do not publish an unprotected public link.

## What This Repo Contains

- `app.py`: backend server, test session APIs, private dataset support, and result submission
- `static/`: test-only frontend UI
- `tools/`: private dataset zip builder and uploader
- `Dockerfile`, `render.yaml`: Render deployment
- `DEPLOY_WEB.md`: deployment and private dataset upload notes

Old Windows/macOS installer bundles, desktop launchers, and packaged distribution folders were intentionally removed after switching to the web test workflow.

## Deployment

Render reads `render.yaml` from the `main` branch. Required environment values are documented in `DEPLOY_WEB.md`; the shared deployment should keep:

```text
EEG_VIEWER_PUBLIC_MODE=1
EEG_VIEWER_DATA_DIR=/data
EEG_VIEWER_ACCESS_CODE=ncnp
```

`EEG_VIEWER_ALLOW_UNPROTECTED_PUBLIC=1` must not be enabled on the shared Render service.

## Private Dataset Policy

Temple University-derived or otherwise redistribution-restricted EDF files must not be committed to GitHub. Use the private dataset upload workflow so EDFs live only on the private Render persistent disk.

Typical dataset path for the viewer:

```text
private:gakkai_v1
```

## Local Development

```bash
python3 -m py_compile app.py
python3 app.py
```

Then open `http://127.0.0.1:8765`. For the deployed service, use the Render URL above.

## Safety Notes

This viewer is for research test presentation, not as a validated diagnostic or quantitative measurement device. Keep access-code protection enabled and do not push EDF data unless redistribution is explicitly permitted.
