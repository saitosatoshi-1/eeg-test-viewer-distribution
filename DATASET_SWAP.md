# Private Dataset Swap Workflow

This repository does not store EDF data in GitHub. Private EDF datasets are uploaded to the Render persistent disk and referenced as `private:<dataset_id>`.

## Current Render Datasets

- `private:gakkai_v1`
  - Earlier temporary Gakkai dataset.
  - Keep it unless the user explicitly asks to replace or remove it.
- `private:validation_tuea_v1`
  - Uploaded on 2026-06-29.
  - Source folders on Saito's Mac:
    - epilepsy: `/Users/saitosatoshi/Desktop/神経/NCNP/研究/montage/test_data/validation前/epilepsy`
    - no_epilepsy: `/Users/saitosatoshi/Desktop/神経/NCNP/研究/montage/test_data/validation前/no_epilepsy/TUEA`
  - Counts: epilepsy 36, no_epilepsy 30, total 66.
  - Test URL:

```text
https://eeg-test-viewer.onrender.com/?dataset=private%3Avalidation_tuea_v1
```

## Standard Rule

When the user wants to try a new dataset, do not overwrite an existing dataset unless explicitly requested. Use a new dataset id, for example:

```text
validation_tuea_v2
validation_tuea_v3
```

This keeps old test links reproducible and avoids accidental data loss.

## Build Zip

Use `tools/build_private_dataset_zip.py`. It expects two folders:

- `--epilepsy`: EDFs treated as `IED_PRESENT`
- `--no-epilepsy`: EDFs treated as `IED_ABSENT`

Example:

```bash
python3 tools/build_private_dataset_zip.py \
  --epilepsy "/Users/saitosatoshi/Desktop/神経/NCNP/研究/montage/test_data/validation前/epilepsy" \
  --no-epilepsy "/Users/saitosatoshi/Desktop/神経/NCNP/研究/montage/test_data/validation前/no_epilepsy/TUEA" \
  --out /tmp/validation_tuea_v2_private.zip
```

Check the zip before upload:

```bash
ls -lh /tmp/validation_tuea_v2_private.zip
zipinfo -1 /tmp/validation_tuea_v2_private.zip | sort | head -80
```

## Upload To Render

The upload requires the Render environment secret `EEG_VIEWER_ADMIN_CODE`. Do not commit this code. Do not include it in shared documentation.

Example:

```bash
EEG_VIEWER_ADMIN_CODE='<actual Render admin code>' python3 tools/upload_private_dataset.py \
  --viewer-url "https://eeg-test-viewer.onrender.com" \
  --access-code ncnp \
  --dataset-id validation_tuea_v2 \
  --name "Validation TUEA v2" \
  --zip /tmp/validation_tuea_v2_private.zip
```

If the command shows a Japanese placeholder error, replace `<管理コード>` or `<actual Render admin code>` with the real value from the Render Dashboard environment variables.

## Verify Render Dataset

After upload, confirm the returned JSON. Expected shape:

```json
{
  "ok": true,
  "datasetPath": "private:validation_tuea_v2",
  "caseCount": 66,
  "epilepsyCount": 36,
  "noEpilepsyCount": 30
}
```

Then open:

```text
https://eeg-test-viewer.onrender.com/?dataset=private%3Avalidation_tuea_v2
```

For API checks, log in first and use the `eeg-viewer-token` from the HTML as `X-EEG-Viewer-Token`.

## Expected Test Session

For the current viewer settings:

- Practice epochs: 2
- Main test epochs: 20
- Main test balance: 10 epileptiform and 10 non_epileptiform
- Sampling: balanced random sampling with assignment exposure counts

Note: Creating a validation session through the session API records assignment exposure counts. This is usually fine because future sampling prioritizes less-exposed cases, but avoid unnecessary repeated test-session API calls before formal testing.

## Submitted Result JSON Storage

When a participant completes the test, the viewer automatically submits the compact JSON result to Render.

Render stores submitted JSON files under:

```text
/data/research/submitted_results/<dataset_id>/
```

For example:

```text
/data/research/submitted_results/validation_tuea_v1/
```

Result filenames include the dataset id, completion timestamp, and reader name:

```text
validation_tuea_v1_20260629_035027_Taro_Yamada.json
```

This makes it clear which dataset version each participant belongs to after datasets are swapped. The participant download/share filename uses the same pattern.

Use the admin submitted-results APIs or `tools/download_submitted_results.py` to download stored JSON files. Keep the participant's downloaded/emailed JSON as a backup because automatic Render submission can fail if the network drops at completion.

## Files That Must Not Be Committed

- EDF files
- private dataset zips
- downloaded result JSON files containing participant data
- `EEG_VIEWER_ADMIN_CODE`
