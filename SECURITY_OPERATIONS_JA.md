# 認証の運用確認 / Authentication Operations

## 管理者本人が行うこと / Account Owner Actions

秘密コードや回復コードをチャット・Git・文書へ貼らないでください。
パスワード管理アプリで、参加者・検証者・管理者それぞれ異なる長いランダム値を作成します。
Renderの対象サービスのEnvironmentで次を交換し、判読中の参加者がいない時に反映します。

- `EEG_VIEWER_ACCESS_CODE`: 参加者用。
- `EEG_VIEWER_VALIDATION_CODE`: 検証者用。管理者用コードを代用して配布しない。
- `EEG_VIEWER_ADMIN_CODE`: 管理者のみが保持。過去にチャット等へ入力した値は再利用しない。

管理ツール実行時の環境変数も新しい値へ更新します。
Render・GitHub・利用メールの二要素認証を有効にし、回復コードを別の安全な場所へ保管します。
実際の設定状態はこのリポジトリから確認できません。

公式手順: [Render login settings](https://render.com/docs/login-settings)。
RenderのWorkspace Settingsではメンバーへの2FA必須化も設定できます。

## viewerの試行制限 / Viewer Throttling

パスワードと管理コードの照合を、接続元ごとに60秒間30回、プロセス全体で120回までに制限します。
失敗した照合を数えます。同一HTTPリクエスト内の同じ照合は一回だけ数えます。
成功時に過去の失敗履歴は消しません。上限に達すると正しいコードでも期限まで新規照合を待ちます。
参加者・検証者ログイン、HTTP Basic、管理用ヘッダーで予算を共有します。
URL内コード認証は従来どおり無効です。
上限に達したログインはHTTP429とRetry-Afterを返します。管理API等は既存の認証エラー形式を維持します。
通常のcookie/session検証・波形取得・描画はこの予算を消費しません。

接続元の原文は保存せず、一時鍵によるハッシュを最大60秒間メモリに保持します。
生IPのファイル保存、ログ追加、外部サービスへの送信はしません。

## 制限と注意 / Limitations

- 転送IPヘッダーを無条件には信用しません。Renderのproxy越しでは複数参加者が同じ接続元として数えられる可能性があります。大量同時ログインでは約1分待つ場合があります。
- メモリ内・プロセス単位の制限です。再起動で初期化され、複数インスタンス間では共有しません。
- 大量攻撃中は新規ログインや管理操作の可用性が低下しえます。分散攻撃やDDoSを完全に防ぐものではありません。
- 既存cookieでの通常判読は継続できますが、再デプロイは以前からcookie/sessionを失効させるため判読の合間に行ってください。
- 本番の設定・proxy構成・操作確認は別途必要です。秘密交換・二要素認証を実施済みとみなさないでください。

設計参考: [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)。
