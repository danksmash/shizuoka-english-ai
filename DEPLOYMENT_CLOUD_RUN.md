# 本番公開：GitHub Pages + Google Cloud Run

## 正式な公開構成

児童が授業で使用する正式なフロントエンドURLはGitHub Pagesです。

```text
https://danksmash.github.io/shizuoka-english-ai/
```

GitHub Pagesで動くReact/Viteフロントエンドが、AI対話・TTS・学習履歴などのAPIをCloud Runへ送ります。

```text
児童Chromebook
  ↓
GitHub Pages
  ↓ API
Google Cloud Run
  ├─ Anthropic Claude
  ├─ Google Cloud Text-to-Speech
  └─ Firestore / 研究データAPI
```

Cloud Runの本番API URLは次です。

```text
https://shizuoka-english-ai-1075707511474.asia-northeast1.run.app
```

Cloud Run URLを直接開くとアプリ画面が表示される場合がありますが、授業配布・QRコード・Google Classroom等ではGitHub Pages URLへ統一します。

## GitHub Pages

`.github/workflows/pages.yml` が `main` へのpushで自動実行されます。

主な処理：

1. Node.js 20
2. `npm ci`
3. `npm run qa`
4. `npm run build:pages`
5. GitHub Pages artifactを作成
6. GitHub Pagesへdeploy

Pages build時には `VITE_API_BASE_URL` としてCloud Run URLを設定します。

## Cloud Run

`.github/workflows/cloud-run-deploy.yml` が `main` へのpushで自動実行されます。

主な処理：

1. Node.js 20
2. `npm ci`
3. 全QAとproduction build
4. Workload Identity FederationでGoogle Cloudへ認証
5. `gcloud run deploy` を実行
6. `/api/health` を本番確認
7. Anthropic AIの実応答をsmoke test
8. Google TTSのMP3生成を確認

通常運用では手元からの手動 `gcloud run deploy` より、GitHub Actions経由の再現可能なデプロイを使用します。

## 本番設定

Cloud Run workflowが次の本番メタデータを渡します。

- `ANTHROPIC_MODEL=claude-sonnet-5`
- `SESSION_RETENTION_DAYS=1095`
- `APP_VERSION`: workflowで明示したVersion
- `APP_BUILD`: デプロイ対象Gitコミットの短縮SHA

`server.ts` は設定モデルを優先し、必要時には互換モデルへのフォールバックを持ちます。

Anthropic APIキーはGoogle Cloud Secret ManagerからCloud Runへ渡し、React/ViteコードやGitHub Pagesへ埋め込みません。

## `/api/health`

本番確認には次を使用します。

```text
https://shizuoka-english-ai-1075707511474.asia-northeast1.run.app/api/health
```

主要項目：

```text
status
aiConfigured
model
appVersion
build
ttsProvider
learningDataConfigured
managementConfigured
```

現在のデプロイworkflowは、`status=ok`、AI設定、モデル、Version、Google Chirp 3 HD、学習データ設定、管理認証設定を検査します。

## 音声

音声出力はCloud Runの `/api/tts` からGoogle Cloud Text-to-Speech Chirp 3 HDを使用します。Google TTSが利用できない場合に備え、児童端末側の音声フォールバックも維持します。

## 管理・研究画面

研究データ管理はCloud Run側の `/management` で提供し、児童用GitHub Pagesから直接リンクしません。研究者用データは匿名化された研究用経路で扱います。

## 本番合格条件

本番変更は、少なくとも次をすべて満たした場合のみ完了とします。

1. PRまたは作業ブランチで全QAが成功
2. production buildが成功
3. GitHub Pages deployが成功
4. Cloud Run deployが成功
5. `/api/health` が正常
6. Anthropic AI smoke testが成功
7. Google TTS voice checkが成功、または明示された端末フォールバック条件を満たす
8. APIキー等の秘密情報がブラウザへ露出しない
9. 児童の高リスク個人情報を外部AIへ送らない既存安全処理を維持する
