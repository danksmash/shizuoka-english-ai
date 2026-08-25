# 本番公開：Google Cloud Run

## 重要

GitHub Pages は静的フロントエンド公開用です。このアプリの `/api/chat` と `/api/feedback` は Express/Node.js バックエンドで実行するため、AI対話の本番URLには GitHub Pages を使用しません。

本リポジトリは Google Cloud Run でフロントエンドと Express API を同一オリジンから提供できる構成です。

## Cloud Run

Google Cloud で Cloud Run サービスを作成し、このリポジトリの `main` をソースとしてデプロイします。

```bash
gcloud run deploy shizuoka-english-ai \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated
```

`Dockerfile` が存在するため、Cloud Run のソースデプロイではこの Dockerfile が使用されます。

## 必須のサーバー設定

Cloud Run の Secret/環境変数として次を設定します。

```text
ANTHROPIC_API_KEY = <Anthropic API key>
```

モデルは Dockerfile で現行の `claude-sonnet-4-6` を既定値として設定しています。必要なら Cloud Run の環境変数 `ANTHROPIC_MODEL` で上書きできます。

**APIキーを React/Vite のコード、GitHub Pages、`.env` のコミット済みファイルには置かないでください。**

## 動作確認

デプロイ後、まず次を確認します。

```text
https://<CLOUD_RUN_URL>/api/health
```

期待値：

```json
{"status":"ok","version":"1.0.0"}
```

次に実際のブラウザから AI 留学生との会話を行い、`/api/chat` が成功して AI の返答が画面に表示されることを確認します。

その後、対話終了時の `/api/feedback` も実測します。

## 本番合格条件

1. Cloud Run サービスが起動する
2. `/api/health` が 200 を返す
3. 実際の児童向け画面から `/api/chat` が成功する
4. Claude の実応答が画面に表示される
5. `/api/feedback` が成功する
6. APIキーがブラウザへ露出しない
7. 児童名が外部AI用プロンプトへ送信されない
8. GitHub Pages を AI API の本番サーバーとして使用しない
