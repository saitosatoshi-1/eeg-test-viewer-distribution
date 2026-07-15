# EEG Test Viewer レビュー依頼メモ

このメモは、ボランティアのエンジニアにコードレビューを依頼するときの入口です。大きなリファクタリングより、研究実施前に壊れて困る部分の確認を優先します。

## 現在の目的

脳波判読におけるモンタージュ確認行動とIED判定の関連を調べるためのWebテストビューアです。判読者ごとに20エポックを提示し、判定、表示設定、モンタージュ使用状況、操作ログをJSONとして保存します。

このビューアはRender上で動かすWeb配布版です。EDFデータはGitHubに置かず、Renderのprivate datasetとして管理します。

## 現在の共有リンク

```text
https://eeg-test-viewer.onrender.com/?dataset=private%3Avalidation_v1
```

共有時はURLにアクセスコードを含めません。参加者はパスワード画面で `ncnp` を入力します。

## 現在のデータセット

- dataset id: `private:validation_v1`
- 由来: validationデータ
- 構成: `epilepsy` と `no_epilepsy`
- 現在の想定: epilepsy 30件、no_epilepsy 30件、合計60件
- EDFはGitHubにコミットしません。

データセット差し替え手順は `DATASET_SWAP.md` を参照します。過去datasetは現在の運用対象ではありません。

## テスト手順の仕様

- 判読者背景を入力します。
- 同意チェック後にテストへ進みます。
- チュートリアル/練習エポックを2回提示します。
- 2回目の練習で普段使用するモンタージュを設定します。
- 本番20エポックは、そのモンタージュを初期表示として開始します。
- 各エポックで「てんかん性異常あり」「てんかん性異常なし」「判断困難」を選びます。
- 感度、時定数、HF、ACフィルタ、表示スケール、モンタージュは変更可能です。
- ACフィルタは `OFF`、`50 Hz`、`60 Hz` です。

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

結果JSONは参加者側でダウンロードできます。完了時にはRenderにも自動保存します。ただしネットワーク不安定時に備え、参加者側のダウンロード/メール送付もバックアップとして残します。

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

## 今は避けたい作業

- 大規模なファイル分割。
- `app.py` と `static/app.js` の大幅な構造変更。
- UI全体の作り直し。
- 既存datasetの上書き。

将来的には、研究API、サンプリング、JSON export、フロントの研究テストUIを分ける余地があります。ただし、現段階では研究実施前の動作安定を優先します。

## 主要ファイル

- `app.py`: API、private dataset、サンプリング、JSON保存/出力
- `static/app.js`: 研究テストUI、波形表示、ログ収集、スマホ対応
- `static/index.html`: テスト用HTML
- `static/styles.css`: UI/CSS
- `tools/build_private_dataset_zip.py`: private dataset zip作成
- `tools/upload_private_dataset.py`: Renderへのprivate dataset upload
- `tools/download_submitted_results.py`: Render保存済みJSONのダウンロード
- `DATASET_SWAP.md`: データセット差し替え手順
