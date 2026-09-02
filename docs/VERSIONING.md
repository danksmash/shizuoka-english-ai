# Version / Build 表示の現行仕様

## 児童用画面

児童用画面には Version / Build 情報を表示しない。

児童メイン画面・対話画面・振り返り画面へVersion表示を後から注入する処理も使用しない。児童用UIは学習操作を優先し、Version表示によるDOM変更やレイアウト変化を避ける。

## 研究者用管理画面

研究者用の `/management` では、Cloud Run の `/api/health` が返す本番メタデータを表示する。

- `appVersion`: Cloud Run 環境変数 `APP_VERSION`
- `build`: Cloud Run 環境変数 `APP_BUILD`

現在の本番デプロイでは `.github/workflows/cloud-run-deploy.yml` がこれらを設定する。`APP_BUILD` はデプロイ対象コミットの短縮SHAを使用する。

## Version管理方針

過去に使用していた、Git履歴を数えて `1.0.x` を自動生成する方式は廃止した。

Versionは本番デプロイ設定で明示的に管理し、Buildは実際にデプロイされたGitコミットから追跡できる値を使用する。これにより、表示上のVersionと実際の本番コードを分離して確認できる。

## QA

Version専用の旧自動生成QAは使用しない。本番整合性はCloud Runデプロイworkflowの `/api/health` smoke testで確認する。

本番検査では少なくとも次を確認する。

- `status: ok`
- `aiConfigured: true`
- 使用モデル
- `appVersion`
- `ttsProvider: google-chirp3-hd`
- 学習データ設定
- 管理認証設定

児童用Version表示を再導入する場合は、既存UIを変更しないことを別途検証してから実施する。
