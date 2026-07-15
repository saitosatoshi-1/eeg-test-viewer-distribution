# EEG Test Viewer Web配布版

このリポジトリは、読影テストをWeb上で実施するための配布版です。以前のWindows/macOSローカル配布パッケージは、Webテスト形式へ移行したため削除済みです。

## 共同研究者用リンク

```text
https://eeg-test-viewer.onrender.com/?dataset=private%3Avalidation_v1
```

共有時は `access=ncnp` を付けません。リンクを開くとパスワード入力画面が表示され、`ncnp` 入力後にテスト画面へ進みます。

## 残しているもの

- `app.py`: テストAPI、private dataset、結果保存
- `static/`: テスト専用UI
- `tools/`: private dataset作成・アップロード用スクリプト
- `Dockerfile` / `render.yaml`: Renderデプロイ設定
- `DEPLOY_WEB.md`: Web運用手順
- `DATASET_SWAP.md`: Render上のprivate dataset差し替え手順
- `REVIEW_NOTES_JA.md`: エンジニア向けレビュー依頼メモ

## 削除したもの

- Windows `.bat` / `.vbs` 起動ファイル
- macOS `.app` ランチャー
- installer作成用 `packaging/`
- 共同研究者向けWindows配布フォルダ
- 古い配布方針ドキュメント

## データ方針

Temple University由来など再配布禁止の可能性があるEDFはGitHubに置きません。現在のテスト/validation用データは `private:validation_v1` としてRenderの永続ディスク上に置く運用です。過去datasetは現在の運用対象ではありません。

データセットを差し替える・追加する場合は `DATASET_SWAP.md` を参照します。過去datasetの再現性が不要な場合は、現在のdataset idを更新する運用で構いません。

## レビュー前の方針

現時点では大規模リファクタリングより、研究実施前の動作安定を優先します。エンジニアにレビューを依頼する場合は `REVIEW_NOTES_JA.md` を入口にしてください。
