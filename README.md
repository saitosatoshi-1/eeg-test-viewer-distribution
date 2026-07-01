# EEG Test / Validation Viewer Distribution

Web-based EEG reading test and cut-epoch validation viewer for research use. This repository is now maintained for the Render-hosted web workflow, not for Windows/macOS desktop distribution packages.

## Current Test Link

Use the password-protected link when sharing the viewer:

```text
https://eeg-test-viewer.onrender.com/?dataset=private%3Avalidation_tuea_v2
```

The link shows a password screen. Enter `ncnp` to set an HTTP-only access cookie. Do not place the password in the URL.

Use URL parameters to select the workflow:

```text
https://eeg-test-viewer.onrender.com/?mode=test&dataset=private%3Avalidation_tuea_v2
https://eeg-test-viewer.onrender.com/?mode=validation&dataset=private%3Avalidation_tuea_v2
```

`mode` defaults to `test` for compatibility. Validation asks only for Reviewer ID and evaluation target, then records `採用` / `除外` decisions. Results are saved separately from test submissions under `/data/research/validation_results/<datasetId>/<reviewerId>.json`.

## What This Repo Contains

- `app.py`: backend server, test/validation APIs, private dataset support, and result submission
- `static/`: web frontend UI for test and validation workflows
- `tools/`: private dataset zip builder/uploader and result download helpers
- `Dockerfile`, `render.yaml`: Render deployment
- `DEPLOY_WEB.md`: deployment and private dataset upload notes

Old Windows/macOS installer bundles, desktop launchers, and packaged distribution folders were intentionally removed after switching to the web test workflow.



## Private Dataset Policy

Typical dataset path for the viewer:

```text
private:validation_tuea_v2
```

## Local Development

```bash
python3 -m py_compile app.py
python3 app.py
```

Then open `http://127.0.0.1:8765`. For the deployed service, use the Render URL above.

## Safety Notes

This viewer is for research test presentation, not as a validated diagnostic or quantitative measurement device. Keep access-code protection enabled and do not push EDF data unless redistribution is explicitly permitted.
