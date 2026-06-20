# EEG Test Viewer Web Deploy

This is the first web-deployable setup for the test-only EEG Viewer.

## What Runs Online

- The viewer runs as a Python web service.
- Test datasets can be loaded from a GitHub `dataset.json` URL.
- EDF files referenced by `edfUrl` are cached on the server when opened.
- Submitted results are saved under:

```text
$EEG_VIEWER_DATA_DIR/research/submitted_results/
```

For Docker/Render, `EEG_VIEWER_DATA_DIR` is `/data`.

## Render Deployment

1. Push this repository to GitHub.
2. In Render, create a new Blueprint from the repository.
3. Render will use `render.yaml` and `Dockerfile`.
4. Confirm `EEG_VIEWER_ACCESS_CODE=ncnp` is set in Render environment variables.
5. Keep the persistent disk mounted at `/data`.
6. Share a test link without the password in the URL. Users enter `ncnp` on the password screen.

## Access Control

Public mode requires the password screen unless explicitly disabled. No username is required.

Required production environment variables:

```text
EEG_VIEWER_PUBLIC_MODE=1
EEG_VIEWER_ACCESS_CODE=ncnp
EEG_VIEWER_ADMIN_CODE=<separate admin-only secret>
EEG_VIEWER_ALLOWED_REMOTE_HOSTS=raw.githubusercontent.com,github.com
EEG_VIEWER_MAX_REMOTE_EEG_MB=512
EEG_VIEWER_MAX_RAW_CACHE_RECORDS=4
```

If `EEG_VIEWER_ACCESS_CODE` is missing in public mode, the app returns `401 Unauthorized`.

Share links in this form:

```text
https://<your-viewer-host>/
```

The viewer will show a password screen. Enter `ncnp`.

To start with a dataset already filled in:

```text
https://<your-viewer-host>/?dataset=https%3A%2F%2Fraw.githubusercontent.com%2F<owner>%2F<repo>%2Fmain%2Fdatasets%2Fv1%2Fdataset.json
```

After a valid password is submitted, the app stores a signed HTTP-only cookie and redirects to the requested URL.

Administrative APIs for private dataset upload and submitted result download require `EEG_VIEWER_ADMIN_CODE` in addition to normal viewer login. Do not share the admin code with test participants.

Only use `EEG_VIEWER_ALLOW_UNPROTECTED_PUBLIC=1` for a temporary private test network. Do not set it on a shared deployment.

## Dataset URL

Both GitHub blob URLs and raw URLs are accepted:

```text
https://github.com/<owner>/<repo>/blob/main/datasets/v1/dataset.json
https://raw.githubusercontent.com/<owner>/<repo>/main/datasets/v1/dataset.json
```

Each case should include `edfUrl`. Relative `edfUrl` values are resolved from the `dataset.json` URL.

In public mode, remote dataset and EDF downloads are restricted to HTTPS URLs on `EEG_VIEWER_ALLOWED_REMOTE_HOSTS`. Redirects are rejected.

## Private Server Dataset

For data that must not be redistributed on GitHub, upload the EDF files to the deployed viewer's persistent disk.

Build a local zip:

```bash
python tools/build_private_dataset_zip.py \
  --epilepsy "/Users/saitosatoshi/Desktop/montage/test_data/学会用/epilepsy" \
  --no-epilepsy "/Users/saitosatoshi/Desktop/montage/test_data/学会用/no_epilepsy" \
  --out /tmp/gakkai_v1_private.zip
```

Upload it to the deployed viewer:

```bash
python tools/upload_private_dataset.py \
  --viewer-url "https://<your-viewer-host>" \
  --access-code ncnp \
  --admin-code "<admin-code>" \
  --dataset-id gakkai_v1 \
  --name "Gakkai EEG Test v1" \
  --zip /tmp/gakkai_v1_private.zip
```

Then share this link:

```text
https://<your-viewer-host>/?dataset=private:gakkai_v1
```

This keeps EDF files off GitHub. They are stored only in the Render persistent disk at `/data`.

## Local Docker Test

```bash
docker build -t eeg-test-viewer .
docker run --rm -p 8765:8765 -v eeg-test-viewer-data:/data eeg-test-viewer
```

Then open:

```text
http://127.0.0.1:8765/
```

## Important Notes

- Only public, fully anonymized EEG data should be referenced from public GitHub URLs.
- The password screen protects the viewer URL. Do not put the password in shared URLs.
- The per-page token also protects API calls after login.
- For a large study, rotate the access code periodically or add per-user accounts.
