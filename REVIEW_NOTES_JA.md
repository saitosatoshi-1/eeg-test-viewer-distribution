# EEG Test Viewer レビュー依頼メモ

このメモは、ボランティアのエンジニアにコードレビューを依頼するときの入口です。大きなリファクタリングより、研究実施前に壊れて困る部分の確認を優先します。

## 現在の目的

脳波判読におけるモンタージュ確認行動とIED判定の関連を調べるためのWebテストビューアです。判読者ごとに20エポックを提示し、判定、表示設定、モンタージュ使用状況、操作ログをJSONとして保存します。

このビューアはRender上で動かすWeb配布版です。EDFデータはGitHubに置かず、Renderのprivate datasetとして管理します。

## 現在の共有リンク

```text
https://eeg-test-viewer.onrender.com/?dataset=private%3Avalidation_v1
```

共有時はURLにアクセスコードを含めません。参加者はパスワード画面で別途案内したコードを入力します。Validationには独立した検証者用コードが必要です。

## 現在のデータセット

- dataset id: `private:validation_v1`
- 由来: validationデータ
- 構成: `epilepsy` と `no_epilepsy`
- 現在の想定: epilepsy 30件、no_epilepsy 30件、合計60件
- EDFはGitHubにコミットしません。

データセット差し替え手順は `DATASET_SWAP.md` を参照します。過去datasetは現在の運用対象ではありません。

## テスト手順の仕様

- 開始前に研究説明を読み、本人情報を入力して同意します。
- 続いて判読者背景を入力し、練習へ進みます。
- チュートリアル/練習エポックを2回提示します。
- 2回目の練習で普段使用するモンタージュを設定します。
- 本番20エポックは、そのモンタージュを初期表示として開始します。
- 各エポックで「てんかん性異常あり」「てんかん性異常なし」「判断困難」を選びます。
- 感度、時定数、HF、表示スケール、モンタージュは変更可能です。
- ACフィルタは60 Hz固定で、操作UIには表示しません。

## サンプリング仕様

本番20問は、各master pool内のエポックが可能な限り均等に提示されるように割り付けます。

- epileptiform 10問、non_epileptiform 10問を基本とします。
- 各エポックの過去の提示回数を数え、提示回数が少ないエポックを優先します。
- 提示回数には、回答済み回数と割付済み回数の大きい方を使います。
- 同じ提示回数の候補内ではランダムに選びます。
- 抽出後の20問の提示順はランダム化します。
- 同一テスト者に同じ患者/元記録由来のエポックが複数入らないようにします。
- ただし、データセットが小さく20問を満たせない場合だけ、最後の補充で重複を許します。

同一患者/元記録キーは、`patientId` や `subjectId` があればそれを使います。なければEDF/recording名の `_start...` より前を同じキーとして扱います。

## JSON保存仕様

各回答はサーバーへ送信します。一時的な通信障害では同じタブ内に保存し再送します。
最終結果の提出は、スマホのtestモードではサーバー自動提出、PCではJSONダウンロード・メール案内です。
回答保存と最終結果提出を区別して確認してください。Validationは専用の提出処理です。

Render保存先:

```text
/data/research/submitted_results/<dataset_id>/
```

JSONには、各エポックで三択を選んだ瞬間の設定を `settingsAtAnswer` として保存します。

例:

```json
"settingsAtAnswer": {
  "sensitivityUvPerMm": 10,
  "tcSec": "0.3",
  "hfHz": "120",
  "acFilter": "60",
  "acFilterUsed": true,
  "timebaseSec": 10
}
```

`cases` はJSON末尾に置き、採用データの概要だけを保持します。

## モンタージュログ仕様

- 各モンタージュの表示時間を記録します。
- モンタージュ切り替え回数を記録します。
- 連続表示時間が1秒未満のモンタージュ表示は主解析から除外します。
- 1エポック内で双極誘導と参照基準導出の両方を表示した場合を、主解析上の「モンタージュ確認行動あり」とします。

## レビューで特に見てほしい点

- サンプリングが意図どおり均等化されているか。
- 同一患者/元記録由来のエポック除外が妥当か。
- 前の問題に戻って回答変更した場合、JSONに最終回答だけが反映されるか。
- Renderへの自動JSON保存と、参加者側ダウンロードの両方が破綻していないか。
- スマホ表示で波形と判定UIが使えるか。
- モンタージュ切り替え時の先読み/キャッシュが過剰な負荷になっていないか。
- 個人情報、Temple University由来データ、管理コードがGitHubへ漏れない構造になっているか。

## 今回お願いしたいリファクタリング範囲

主に波形描画に関与する部分を、挙動を変えずにレビュー・整理していただきたいです。

Main request in English: please review and refactor the waveform rendering path without changing behavior, especially around montage construction, display filters, sensitivity/time constant/high-frequency/AC controls, and canvas drawing.

優先して見ていただきたい範囲:

- 波形データ取得から描画までの流れ。
  - `static/app.js`: `loadWindow`, `applyWindowData`, `draw`, `drawWaveColumn`, `drawViewerWaveformPath`
  - `app.py`: `RecordingStore.window`, `RecordingStore.window_multi`
- モンタージュ構成とチャンネル名処理。
  - `eeg_montage.py`: `build_montage_traces`, `channel_validation_payload`, `channel_configuration_payload`
  - 特に横双極誘導はACNS TB-18.2相当の構成を期待しています。
- 感度、時定数、HF、ACフィルター、表示スケールの操作反映。
  - `static/app.js`: `handleFilterControlChange`, `filterControlKey`, `sensitivityValue`, `displayTraces`
  - `eeg_montage.py`: `tc_to_highpass`, `hf_to_lowpass`, `apply_display_filters`
- キャッシュと先読み。
  - `static/app.js`: `windowCacheKey`, `rememberWindowCache`, `clearWindowCacheForCurrentRecording`, `prefetchResearchWindow`
  - フィルターやモンタージュ変更後に古い波形が表示されないかを確認したいです。
- スマホ表示での描画負荷と可読性。
  - canvasサイズ、行間、ラベル、操作UIが小さい画面でも破綻しないかを確認したいです。

できれば避けたいこと:

- 研究仕様、JSON形式、サンプリング仕様の変更。
- UI全体の作り直し。
- 波形の極性や単位変換を理由なく変更すること。
- 大きなフレームワーク導入。

歓迎する整理:

- 波形関連の再分割は、同端末・同症例で操作速度を測定してから検討します。2026-10-17の分割は実機の遅延報告を受け取り消しました。
- モンタージュ定義、表示フィルター、canvas描画の責務境界を明確にする提案。
- 変更前後で同じケース・同じ設定なら同じ波形が出ることを確認できる簡単なテスト方針。
- 研究者が確認すべき点と、エンジニア側だけで判断できる点の切り分け。

## 今は避けたい作業

- 大規模なファイル分割。
- `app.py` と `static/app.js` の大幅な構造変更。
- UI全体の作り直し。
- 既存datasetの上書き。

将来的には、研究API、サンプリング、JSON export、フロントの研究テストUIを分ける余地があります。ただし、現段階では研究実施前の動作安定を優先します。

## 主要ファイル

- `app.py`: API、private dataset、サンプリング、JSON保存/出力
- `research_export_format.py`: ファイルアクセスや認証を含まない結果JSONの整形
- `static/app.js`: 研究テストUI、波形表示、ログ収集、スマホ対応
- `static/index.html`: テスト用HTML
- `static/styles.css`: UI/CSS
- `tools/build_private_dataset_zip.py`: private dataset zip作成
- `tools/upload_private_dataset.py`: Renderへのprivate dataset upload
- `tools/download_submitted_results.py`: Render保存済みJSONのダウンロード
- `tools/download_validation_results.py`: Validation結果のダウンロード
- `tools/result_download_client.py`: 上記2ツールの共通ログイン・管理ヘッダー・GET取得。アップロード・削除は含まない
- `DATASET_SWAP.md`: データセット差し替え手順

## 確認の入口 / Verification

整形処理の互換性は`tests/test_export_format.py`、実際の提出経路は`tests/test_result_submission.py`で確認します。
認証・保存先・署名検証は`app.py`に残しています。整形モジュールへ移さないでください。
過去の作業ログは履歴であり、現行仕様はコード・テストと照合してください。
