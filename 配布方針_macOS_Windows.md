# EEG Test Viewer 配布方針 macOS / Windows

## 目標

読影者がPythonやGitを意識せず、インストーラをクリックするだけでテストを開始できる形を目指す。

## 目指すユーザー体験

1. 研究者からインストーラまたは配布URLを受け取る
2. インストーラをクリックする
3. Desktopに `EEG Test Viewer` アイコンが作成される
4. アイコンを開く
5. テスト問題を取得してTestモードが起動する
6. 終了後、結果JSONをDesktopへ保存してメール送付する

## GitHubアクセスの考え方

読影者にGitHubログインや権限設定を求めない場合、テスト問題プールは以下のいずれかに置く必要がある。

- public repository
- public GitHub Release asset
- public download URL

private repository は、認証なしではアクセスできない。したがって「許可なしでアクセス」は、実質的には公開配布物として置く設計を意味する。

## macOS

現在の配布版では、macOSインストーラ生成スクリプト `packaging/macos/build_installer.sh` にDesktopアイコン作成処理を追加済み。

目標形:

- `EEG Viewer Installer.pkg` または `.dmg` を配布
- インストール後 `/Applications/EEG Viewer.app` を配置
- Desktopに `EEG Test Viewer.app` への起動アイコンを作成
- 読影者はDesktopアイコンを開くだけ

残課題:

- Python/condaを読影者に触らせないため、Python runtime同梱または自動導入が必要
- 初回起動時のセキュリティ警告を最小化するため、署名/公証の検討が必要

## Windows

現在のWindowsセットアップ `Setup EEG Viewer Windows.bat` は、DesktopとStart Menuに `EEG Viewer` ショートカットを作成する。

目標形:

- Windows用インストーラまたはzipを配布
- インストーラ/セットアップをクリック
- Desktopに `EEG Test Viewer` ショートカットを作成
- 読影者はDesktopアイコンを開くだけ

残課題:

- 現状はconda/miniforgeが必要
- PC初心者向けには、Python runtime同梱版または完全自動セットアップが望ましい
- Windows Defenderや施設PCの制限に対する説明文が必要

## 推奨する次段階

1. Test専用UIを固める
2. テスト問題プールをpublic GitHub Releaseに置く
3. Viewer起動時に問題プールを自動取得する機能を追加
4. macOS pkg/dmg と Windows installer/zip を作る
5. 研究協力者1-2名のPCで実地テストする
