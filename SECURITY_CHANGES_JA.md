# セキュリティ修正と反映 / Security Deployment Notes

## 反映前 / Before Deploy

本修正は2026-10-17のソース確認で見つかった認証・権限・端末内保存の問題に対応します。実際の漏出が起きたという意味ではありません。

進行中の判読がない時に反映してください。署名鍵はブラウザーに公開しない独立したランダム鍵になり、更新・再起動で旧ログインとsessionは失効します。/ Deploy between study sessions; old cookies/tokens are invalidated.

RenderのEnvironmentで、値をチャット・Git・この文書に貼らず、次の秘密設定を行います。

- `EEG_VIEWER_ACCESS_CODE`: 過去のコードから交換した、十分長いランダムな参加者用コード。
- `EEG_VIEWER_VALIDATION_CODE`: 参加者用とは別の、検証者だけに渡すランダムなコード。
- `EEG_VIEWER_ADMIN_CODE`: 管理者だけが保持する独立したコード。過去に共有・チャット入力した値は交換。
- `EEG_VIEWER_PUBLIC_DATASET_IDS`: 公開可能なprivate dataset IDをカンマ区切りで指定。既定は`validation_v1`。別IDへ変更時はこの設定も更新。

Validationリンクのログインでは検証者用コードを入力します。検証者用コード未設定時は管理者コードを管理者自身だけが使用できますが、検証者に管理者コードを配布しないでください。/ Separate reviewer login; never distribute the administrator credential.

`Manual Deploy`で修正commitを反映します。ソース内の`sync: false`だけでは既存のRenderコードは交換されません。/ Existing deployed secrets require explicit rotation.

## 保護の内容 / Enforced Boundaries

- 要求用tokenとcookie/session署名鍵を分離。署名と保存済みownerの両方を結果read/writeで検証。
- testとvalidationのownerはサーバー側sidecarに保存。validationは署名付きreviewer権限も必須。
- 新しいvalidationはrunごとのIDを使い、旧結果を上書きしない。所有者不明の旧データを新ブラウザーからclaimしない。
- 公開データセットを許可リストへ限定。session開始前は概要だけ、開始後はそのsessionの症例だけをブラウザーへ返す。
- 本番・練習・回答済みの提示症例だけEDFを開ける。metadata、通常window、複数montage window、cache経由でも同じ制限。
- 前の参加者のJSONをfallbackで返さない。回復データはtab内sessionStorageへ保存し、owner照合と24時間の期限を適用。旧localStorageのbackup/未送信queueは移行せず削除。
- 通信不良中の同じtabでの未送信回答再送は維持。未送信回答が残る間は別の判読を開始しない。情報初期化操作はそのtabの未送信回答も削除する。
- 管理toolは外部HTTPSと同一origin redirectを強制。コードのCLI既定値を削除し、環境変数または非表示入力を使用。
- API結果にno-storeを付け、要求ログにquery内の識別子・tokenを残さない。Docker contextから.env/EDF/ZIP/結果保存先も除外。

## 過去結果 / Historical Results

データセット、既存responses、submitted_results、validation_resultsは削除しません。旧結果は管理者の既存JSONダウンロードtoolで取得できます。所有者を確認できない旧結果を、名前だけで一般利用者へ渡すことはしません。/ Historic results remain available to authorized administrator downloads.

管理用コマンドは、`EEG_VIEWER_ACCESS_CODE`と`EEG_VIEWER_ADMIN_CODE`を環境変数へ設定して使えます。参加者用コードがなければ非表示で入力します。

## 検証 / Verification

`python -m unittest discover -s tests -p 'test_security_access.py' -v`は、合成データとloopback模擬サーバーだけで、旧方式の署名偽造、他ownerのread/write、cookie hash偽装、validation role/owner、任意EDF、旧結果claim、admin取得、HTTP/redirectを検査します。

`node tests/security_browser.test.js`は、別参加者・別dataset・期限切れbackupの拒否と旧localStorageの消去を確認します。実患者データと実Renderへの攻撃リクエストは使いません。

2026-10-17の実行結果: 最新の電子同意・中断再開・スマホ自動提出の更新を取り込み、関数テスト51件（tmp_pathを使う2件を含む）、HTTP認証・権限/転送テスト7件、スマホ提出Nodeテスト10件、電子同意Node検査、browser recovery/再開時の認証情報/通信先分離のNode検査が成功。Python/JavaScript構文とgit差分形式も確認済みです。pytestが未導入のため、既存関数は一時directoryを渡して直接実行、新規API検査は標準unittestを使用しました。

中断再開はそのtabのsessionStorageに認証用tokenも保持し、再開時にヘッダーで提示します。名前・メール・readerIdだけで旧sessionを再取得できません。session開始後に提示済み症例の情報を取り直すため、回答済み問題への戻り操作も維持します。/ Resume preserves its tab-scoped proof and refreshes authorized revisit metadata.

修正前の独立した互換性調査は実施済みです。修正後の別agentレビューは利用上限で実行できず、修正者による別観点のsource-to-sink差分確認で代替しました。実ブラウザー/実EDFでの描画・本番反映確認はこの合成データ検査に含みません。/ Independent post-patch review was unavailable; source-path review and synthetic regression checks completed.

## 運用上の確認 / Operational Checks

EDFのヘッダー・ファイル名の匿名化はupload前に必要です。ZIP作成toolは匿名化しません。メール/OS共有の実送信先は利用者が選択するため確認が必要です。保存期間、研究終了後の削除、Temple Universityへの提供、Render/メール/端末の管理は別途運用で確認してください。
