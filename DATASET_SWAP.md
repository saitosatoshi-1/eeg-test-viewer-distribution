# Private Dataset Swap Workflow

This repository does not store EDF data in GitHub. Private EDF datasets are uploaded to the Render persistent disk and referenced as `private:<dataset_id>`.

## Current Render Dataset

- `private:validation_v1`
  - Prepared on 2026-07-15 from the validation source folders.
  - Current shared/default dataset for both test mode and validation mode.
  - Source folders on Saito's Mac:
    - epilepsy: `/Users/saitosatoshi/Desktop/神経/NCNP/研究/montage/test_data/validation/epilepsy`
    - no_epilepsy: `/Users/saitosatoshi/Desktop/神経/NCNP/研究/montage/test_data/validation/no_epilepsy`
  - Counts: epilepsy 30, no_epilepsy 30, total 60.
  - URLs:

```text
https://eeg-test-viewer.onrender.com/?mode=test&dataset=private%3Avalidation_v1
https://eeg-test-viewer.onrender.com/?mode=validation&dataset=private%3Avalidation_v1
```

## Standard Rule

When the user wants to try a new dataset, use the current dataset id when they do not need to preserve older datasets. If a reproducible comparison is needed, use a new dataset id, for example:

```text
validation_v1
validation_v2
```

Old private datasets are not part of the active workflow unless the user explicitly asks to keep or restore them.

After uploading and verifying a new dataset, update the viewer default and shared links with:

```bash
python3 tools/set_default_dataset.py \
  --dataset-id validation_v1 \
  --cache-tag 20260715-validation-v1
```

This updates `static/app.js`, `static/index.html`, `APP_ID.json`, and the main instruction/readme files together. Do this before committing and pushing, otherwise links without a `dataset=` query can fall back to an older dataset.

## Build Zip

Use `tools/build_private_dataset_zip.py`. It expects two folders:

- `--epilepsy`: EDFs treated as `IED_PRESENT`
- `--no-epilepsy`: EDFs treated as `IED_ABSENT`

Example:

```bash
python3 tools/build_private_dataset_zip.py \
  --epilepsy "/Users/saitosatoshi/Desktop/神経/NCNP/研究/montage/test_data/validation/epilepsy" \
  --no-epilepsy "/Users/saitosatoshi/Desktop/神経/NCNP/研究/montage/test_data/validation/no_epilepsy" \
  --out /tmp/validation_v1_private.zip
```

Check the zip before upload:

```bash
ls -lh /tmp/validation_v1_private.zip
zipinfo -1 /tmp/validation_v1_private.zip | sort | head -80
```

## Upload To Render

The upload requires the Render environment secret `EEG_VIEWER_ADMIN_CODE`. Do not commit this code. Do not include it in shared documentation.

Example:

```bash
EEG_VIEWER_ADMIN_CODE='<actual Render admin code>' python3 tools/upload_private_dataset.py \
  --viewer-url "https://eeg-test-viewer.onrender.com" \
  --access-code ncnp \
  --dataset-id validation_v1 \
  --name "Validation v1" \
  --zip /tmp/validation_v1_private.zip
```

If the command shows a Japanese placeholder error, replace `<管理コード>` or `<actual Render admin code>` with the real value from the Render Dashboard environment variables.

## Verify Render Dataset

After upload, confirm the returned JSON. Expected shape:

```json
{
  "ok": true,
  "datasetPath": "private:validation_v1",
  "caseCount": 60,
  "epilepsyCount": 30,
  "noEpilepsyCount": 30
}
```

Then open:

```text
https://eeg-test-viewer.onrender.com/?dataset=private%3Avalidation_v1
```

For API checks, log in first and use the `eeg-viewer-token` from the HTML as `X-EEG-Viewer-Token`.

If a downloaded result JSON filename or JSON `dataset.datasetId` shows the previous dataset, check:

- The opened URL includes the intended `dataset=private%3A...`.
- `static/app.js` has the intended `DEFAULT_PUBLIC_DATASET_PATH`.
- `static/index.html` has the intended hidden `researchSetupDatasetPathInput` value.
- The HTML served by Render has the latest cache tag from `tools/set_default_dataset.py`.

## Expected Test Session

For the current viewer settings:

- Practice epochs: 2
- Main test epochs: 20
- Main test balance: 10 epileptiform and 10 non_epileptiform
- Sampling: balanced random sampling with assignment exposure counts
- Within each reader's main 20 epochs, avoid assigning multiple epochs from the same patient/source recording when possible.
- Patient/source recording identity is read from `patientId`/`subjectId` if present; otherwise the viewer uses the EDF/recording name before `_start...`.

Note: Creating a validation session through the session API records assignment exposure counts. This is usually fine because future sampling prioritizes less-exposed cases, but avoid unnecessary repeated test-session API calls before formal testing.

## Submitted Result JSON Storage

When a participant completes the test, the viewer automatically submits the compact JSON result to Render.

Render stores submitted JSON files under:

```text
/data/research/submitted_results/<dataset_id>/
```

For example:

```text
/data/research/submitted_results/validation_v1/
```

Result filenames include the dataset id, completion timestamp, and reader name:

```text
validation_v1_20260715_035027_Taro_Yamada.json
```

This makes it clear which dataset version each participant belongs to after datasets are swapped. The participant download/share filename uses the same pattern.

Use the admin submitted-results APIs or `tools/download_submitted_results.py` to download stored JSON files. Keep the participant's downloaded/emailed JSON as a backup because automatic Render submission can fail if the network drops at completion.

## Files That Must Not Be Committed

- EDF files
- private dataset zips
- downloaded result JSON files containing participant data
- `EEG_VIEWER_ADMIN_CODE`
