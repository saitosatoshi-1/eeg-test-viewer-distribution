# 波形処理の案内 / Waveform Code Map

## ファイルの役割 / Responsibilities

| ファイル | 役割 |
| --- | --- |
| `static/app.js` | 起動、共有state/els、研究進行、イベント登録、研究回答への振り分け |
| `static/waveform_controls.js` | 感度・モンタージュ・TC/HF・表示時間の変更、重複イベント抑制、取得済み波形の再利用判定 |
| `static/waveform_input.js` | 波形のクリック・タッチ・ドラッグ、三択メニュー開閉、座標からサンプル位置への変換 |
| `static/request_errors.js` | 同一オリジンのAPI通信、認証ヘッダー、再試行とエラー分類 |
| `static/waveform_window.js` | 表示条件のキャッシュキー、`loadWindow`、取得結果の適用、モンタージュ利用可否 |
| `static/waveform_prefetch.js` | 次の2症例と現在症例の全モンタージュの先読み、中止・再開 |
| `static/waveform_render.js` | `draw`、波形・目盛り・校正のcanvas描画、時間と座標の変換用ヘルパー |
| `static/viewer_utils.js` | チャンネル表示名、左右・正中の色、時刻表示 |
| `app.py` | `/api/window`、EDF読込、元波形・フィルター済みデータの取得 |
| `eeg_montage.py` | モンタージュ構成、TC/HF/固定ACの数値処理、表示用データ生成 |
| `viewer_cache.py` | サーバーキャッシュのメモリ上限管理 |

## データ経路 / Data Flow

操作イベント → `loadWindow` → 応答キャッシュ、または `/api/window`
→ サーバーで読込・フィルター・モンタージュ生成
→ `applyWindowData` → `draw` → `drawWaveColumn` → `drawViewerWaveformPath`。
感度は取得済みデータの描画倍率を変える。TC/HF/表示時間の操作と再利用判定は `waveform_controls.js` にある。
イベント登録は `app.js` の `bindControls`、波形操作は `waveform_input.js` が担当する。
三択からの回答保存やValidation決定への振り分けは `app.js` に残す。

## 読み込みと依存 / Loading and Dependencies

段階的分割のため、ES modulesへの移行や独立した状態管理は今回行わない。
各ファイルの関数は従来と同じ共有スコープの `state`、`els`、定数を利用する。
`index.html` はヘルパー群を `app.js` より前に読み込み、`app.js` 末尾だけで `init()` を開始する。
ヘルパーにトップレベルの描画・通信・DOM参照を追加しないこと。

## 変更しない仕様 / Preserved Contracts

関数本体はそのまま移動する。サンプル値、フィルター、モンタージュ順序、感度、標本数、
先読み範囲・並列数、キャッシュキー、操作ログ、同意文、提出方法は変更しない。
旧形式・複数モンタージュ表示のコードは依存確認なしに削除しない。

## 次の整理候補 / Next Boundaries

サーバーの波形ストアと、描画に残る旧複数表示分岐の整理を別段階で検討する。
今回は操作イベントの登録方法・待機時間・監視タイマー・三択メニュー挙動を変更しない。
共有状態の完全分離はAPI・操作の回帰試験を整備してから行い、一括置換しない。
