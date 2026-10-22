# 検証の入口 / Test Guide

## 今回の変更範囲 / Scope

結果JSONの純粋な整形関数だけを`research_export_format.py`へ移動した。
APIの認証・保存先・研究進行・波形表示・操作処理は変更しない。
`app.py`は既存名をimportするため、呼び出し側のインターフェースは維持する。

## 合成データによる確認 / Synthetic Checks

### 一括実行 / Run All

```bash
python3 tools/run_checks.py
```

NodeがPATHにない場合は`--node /absolute/path/to/node`を追加します。
unittest形式とトップレベル関数形式（tmp_pathを含む）を両方実行し、Nodeテストと公開データセット設定も検査します。
未知のfixture・Node未導入・一部失敗は終了コード1で停止し、未実行を成功扱いしません。
認証HTTPテスト用のloopbackポートを利用できる環境で実行してください。

### 個別実行 / Focused Checks

リポジトリ直下で、依存関係を導入済みのPython/Nodeを使う。

```bash
python3 -m unittest discover -s tests -p 'test_export_format.py' -v
python3 -m unittest discover -s tests -p 'test_result_download_client.py' -v
python3 -m unittest discover -s tests -p 'test_security_access.py' -v
python3 -m unittest discover -s tests -p 'test_login_limiter.py' -v
node --test tests/test_mobile_submission.mjs tests/security_browser.test.js tests/request_errors.test.js tests/test_electronic_consent.js
node tests/pending_queue.test.js
python3 tools/check_dataset_config.py
```

- JSON整形: 回答時設定、usage、空値、false、同意情報、入力データの不変性。
- 管理ツール: 偽の通信応答と一時フォルダーのみで、ログイン・ヘッダー・接続先・保存バイト列を確認する。本番には接続しない。
- 認証: 合成データとloopback HTTPを使用し、実EDFや参加者情報は使わない。ローカルポートの利用許可が必要。
- ブラウザー模擬: 同意、提出、タブ内回復、通信失敗。実ブラウザー性能の保証ではない。
- その他のPythonテストには関数形式もある。unittest discover単独では全件を実行したことにならないため、全体確認は上の一括コマンドを使う。

## 実機確認との区別 / Live Verification

コードテスト成功とRender反映・実機動作確認は別の状態として報告する。
波形関連の再分割は、同一端末・症例・条件での操作速度比較なしに行わない。
研究用JSONの項目、値、順序の変更は別途承認を得る。実データを外部テストサービスへ送信しない。
