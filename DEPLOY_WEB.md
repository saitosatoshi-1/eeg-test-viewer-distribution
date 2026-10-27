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

### Participant completion / 参加者の提出

- スマホ版の本番課題は、事後アンケート送信後に結果JSONをサーバーへ自動保存します。保存成功を確認した時点で提出完了となり、参加者によるJSONダウンロードやメール送付は不要です。
- 保存中は画面を閉じないでください。保存失敗時は画面を閉じず、通信環境を確認して「結果の保存を再試行」を押してください。参加者IDや課題割付は変わりません。
- PC版とValidationの提出手順は従来どおりです。管理者は従来の管理APIで保存済みJSONを取得できます。
- `render.yaml`は`autoDeploy: false`です。GitHubへのpush後、Render DashboardでManual Deployを実施してください。

## Render Deployment

1. Push this repository to GitHub.
2. In Render, create a new Blueprint from the repository.
3. Render will use `render.yaml` and `Dockerfile`.
4. Set `EEG_VIEWER_ACCESS_CODE` to a new random secret in Render; never use a value from source/history.
5. Keep the persistent disk mounted at `/data`.
6. Share a test link without its password. Provide the participant code separately. / コードは別途案内してください。

## Access Control

Public mode requires the password screen unless explicitly disabled. No username is required.

Required production environment variables:

```text
EEG_VIEWER_PUBLIC_MODE=1
EEG_VIEWER_VALIDATION_WORKFLOW=1
EEG_VIEWER_PRIVATE_DATASET_ADMIN=1
EEG_VIEWER_ACCESS_CODE=<participant-only secret>
EEG_VIEWER_VALIDATION_CODE=<different reviewer-only secret>
EEG_VIEWER_PUBLIC_DATASET_IDS=validation_v1
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

The viewer will show a password screen. Use the separately supplied participant code; validation links require the reviewer code.

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
  --epilepsy "/path/to/epilepsy" \
  --no-epilepsy "/path/to/no_epilepsy" \
  --out /tmp/<dataset_id>_private.zip
```

Upload it to the deployed viewer:

```bash
python tools/upload_private_dataset.py \
  --viewer-url "https://<your-viewer-host>" \
  --admin-code "<admin-code>" \
  --dataset-id <dataset_id> \
  --name "<Dataset display name>" \
  --zip /tmp/<dataset_id>_private.zip
```

Then set the default dataset and share this link:

```bash
python tools/set_default_dataset.py \
  --dataset-id <dataset_id> \
  --cache-tag <yyyymmdd-datasetN>
```

```text
https://<your-viewer-host>/?dataset=private:<dataset_id>
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

### 2026-10-27 CA Update / 証明書更新

Render公式: https://render.com/docs/advisory-emudhra

- Dockerの`ca-certificates`と、Pythonの`certifi>=2026.10.19`を両方更新します。波形・認証・科学計算ライブラリの版は変更しません。
- Renderでは判読中でない時に`Manual Deploy`から`Clear build cache & deploy`を選び、対象commitとビルド成功を確認します。通常の再起動だけでは更新できません。
- Dockerのベースイメージcacheも存在するため、デプロイ完了やパッケージ版だけで保護済みと判断しません。
- デプロイ後のRender Shellで`python tools/check_tls_trust.py --network`を実行し、`verified: true`を確認します。
- この検査はRender公式案内の固定テスト先と通常のRenderサイトにだけ接続し、研究データ・認証情報・ファイルを送信しません。viewer本体に公開APIは追加しません。
- system/certifiの両方で、通常サイトは接続成功、問題の証明書2経路は信頼経路・失効関連エラーで拒否される必要があります。旧emSign ECC G3ルートの残存も検査します。DNS失敗・timeout・期限切れ・ホスト名不一致は未確認扱いです。
- `--network`なしは版と経路の表示だけです。Macでの成功はRender本番の確認を代替しません。
- Macで実行する管理用ダウンロード/アップロードのPython環境も別途証明書更新が必要です。Renderイメージ更新だけではMac環境は変わりません。

- Only public, fully anonymized EEG data should be referenced from public GitHub URLs.
- The password screen protects the viewer URL. Do not put the password in shared URLs.
- The per-page token also protects API calls after login.
- For a large study, rotate the access code periodically or add per-user accounts.
