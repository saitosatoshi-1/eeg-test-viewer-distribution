# 波形処理の構成と性能回復 / Waveform Layout and Recovery

## 2026-10-17の判断 / Decision

ファイル分割後、実機で感度・モンタージュ・TC/HF・表示時間の操作遅延が報告された。
原因確定前の回復措置として、`ef386d0`と`b29678b`の波形ファイル分割のみを取り消す。
波形処理は`78111c3`と同じ`static/app.js`内の構成へ戻す。
認証・アクセス保護、保存エラー分類、`viewer_cache.py`と`request_errors.js`は維持する。

## エンジニア向け案内 / Code Map

- `static/app.js`: 表示変更は`onControlChange`と`handle*ControlChange`、取得は`loadWindow`。
- 同ファイル: キャッシュは`windowCacheKey`と`cachedWindowForParams`、先読みは`prefetchResearchWindow`。
- 同ファイル: 描画は`draw`→`drawWaveColumn`→`drawViewerWaveformPath`。
- 同ファイル: 入力は`onWaveClick`、`openResearchRatingMenu`、`canvasToData`。
- `eeg_montage.py`: モンタージュ・フィルター数値処理。
- `app.py`: EDF取得・波形API、サーバー側キャッシュ。

## 次に必要な確認 / Follow-up

関数本体の一致と合成テストだけでは、実機の性能回帰を判定できなかった。
今後の再分割前には、同じ端末・症例・条件で操作から描画完了までの時間、
通信回数、長時間処理、先読みとの競合を分割前後で測定する。
今回の復元だけで遅延が解消するかは、本番反映後の実機確認が必要。
