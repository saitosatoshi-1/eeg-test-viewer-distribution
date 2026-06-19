# EEG Test Viewer Web配布版

このリポジトリは、読影テストをWeb上で実施するための配布版です。以前のWindows/macOSローカル配布パッケージは、Webテスト形式へ移行したため削除済みです。

## 共同研究者用リンク

```text
https://eeg-test-viewer.onrender.com/?access=ncnp&dataset=private%3Agakkai_v1
```

共有時は必ず `access=ncnp` を付けます。アクセス成功後、サーバーはCookieを設定し、URLからアクセスコードを外します。

## 残しているもの

- `app.py`: テストAPI、private dataset、結果保存
- `static/`: テスト専用UI
- `tools/`: private dataset作成・アップロード用スクリプト
- `Dockerfile` / `render.yaml`: Renderデプロイ設定
- `DEPLOY_WEB.md`: Web運用手順

## 削除したもの

- Windows `.bat` / `.vbs` 起動ファイル
- macOS `.app` ランチャー
- installer作成用 `packaging/`
- 共同研究者向けWindows配布フォルダ
- 古い配布方針ドキュメント

## データ方針

Temple University由来など再配布禁止の可能性があるEDFはGitHubに置きません。学会用データは `private:gakkai_v1` としてRenderの永続ディスク上に置く運用です。
