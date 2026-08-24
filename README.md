# AI留学生えいご対話 (Shizuoka Global Exchange) 🌸

小学校５・６年生向け 静岡大学AI留学生（9カ国）との1対1英語対話練習＆視覚的語彙ビルダーWebアプリケーションです。

---

## 🌟 主な特徴

1. **9カ国の個性豊かなAI留学生**
   - 🇬🇧 イギリス (Oliver) - 環境科学・オックスフォード出身
   - 🇺🇸 アメリカ (Emma) - メディア・カリフォルニア出身
   - 🇦🇺 オーストラリア (Liam) - 海洋生物学・シドニー出身
   - 🇨🇦 カナダ (Chloe) - 森林環境学・バンクーバー出身
   - 🇭🇺 ハンガリー (Bence) - 情報工学・ブダペスト出身
   - 🇵🇱 ポーランド (Zofia) - 建築デザイン・ワルシャワ出身
   - 🇧🇩 バングラデシュ (Rahul) - 農学/茶葉科学・ダッカ出身
   - 🇻🇳 ベトナム (Linh) - 国際言語文化・ハノイ出身
   - 🇲🇲 ミャンマー (Aung) - 歴史/アジア交流・ヤンゴン出身

2. **小学校外国語（英語）カリキュラム対応**
   - 小学校5・6年生の単元（自己紹介・好きなもの・静岡や浜松の紹介・特技・自由会話）に対応
   - 視覚的語彙ドック（イラスト・発音・例文付き）によるスムーズな発話サポート

3. **学校教育向け安全性・プライバシー配慮設計**
   - **サーバー経由のAI連携**: Anthropic Claude API をバックエンドサーバー経由で連携します。APIキーはブラウザに露出させない構成です。
   - **高リスク個人情報の自動マスキング**:
     - 英語学習に必要な自己紹介（名前・年齢・学年・好きなこと・市レベルの地域名等）は会話機能で扱うことがあります。
     - 一方で、詳細な番地を含む住所・電話番号・メールアドレス・パスワードなどの高リスク情報は、AI送信前に自動でマスキング処理します。
     - 会話を不自然に遮断することなく、児童が安心して英語でやり取りできる環境を維持します。
   - **会話ログの非永続化**: アプリケーションコード上、サーバーDB、Cookie、localStorage、sessionStorage、IndexedDB等へ児童の対話履歴を永続保存する処理は確認されていません。なお、AIサービスへのリクエスト処理中には会話データが一時的にメモリ上で扱われます。
   - **音声データのローカル処理**: Web Speech API を使用し、音声認識および音声合成はブラウザ側で動作する構成です。アプリケーションサーバーが音声データを保存する処理は実装していません。
   - **不適切表現・プロンプトインジェクション対策**: 小学生の学習環境に適したシステムプロンプト、入力チェック、AI出力サニタイズを実装しています。
   - **利用にあたって**: 本アプリは学校での英語学習を支援する目的で設計されています。実際の授業等でのご利用にあたっては、各学校・教育委員会の利用ガイドラインに従ってご活用ください。

---

## 🚀 セットアップと実行手順

### 1. リポジトリのクローン
```bash
git clone <YOUR_GITHUB_REPO_URL>
cd <REPO_NAME>
```

### 2. 依存関係のインストール
```bash
npm install
```

### 3. 環境変数の設定 (Claude API)
`.env.example` をコピーして `.env` を作成し、Claude APIキーを設定します。
```bash
cp .env.example .env
```
`.env` ファイルの内容例:
```env
# Anthropic Claude APIキー (メインAI対話・評価エンジン)
ANTHROPIC_API_KEY="sk-ant-..."
```
**注意:** APIキーが設定されていない場合、現在の実装ではAI会話APIは `503` を返します。APIキーなしでもClaudeによる通常会話が継続するオフラインFallbackを提供する仕様ではありません。

### 4. 開発サーバーの起動
```bash
npm run dev
```
ブラウザで `http://localhost:3000` を開きます。

### 5. 本番用ビルドと起動
```bash
# ビルド
npm run build

# 本番サーバー起動
npm start
```

---

## 🌐 Web公開・デプロイ手順

本アプリは、**フロントエンド（Vite/React）とAI APIを処理するNode.js/Expressバックエンドを分けて考える必要があります。** GitHub Pagesは静的フロントエンドの公開には利用できますが、ExpressサーバーやAnthropic APIをGitHub Pages上で実行することはできません。

### A. GitHub Pagesでフロントエンドを公開する場合

本リポジトリには `.github/workflows/pages.yml` があり、`main` へのpush時にViteビルドを行って `dist` をGitHub Pagesへデプロイします。

1. **GitHubリポジトリへpush**
2. **Settings > Pages > Build and deployment > Source** を `GitHub Actions` に設定
3. GitHub Actionsが `dist` を公開

**重要:** GitHub Pagesで公開されるのは静的フロントエンドです。`/api/chat` や `/api/feedback` を処理するExpressバックエンド、および `ANTHROPIC_API_KEY` を必要とするClaude API連携は、別途Node.js対応のサーバー環境へ配置する必要があります。

### B. Node.jsホスティングへバックエンドを配置する場合

Render / RailwayなどNode.jsを実行できるホスティングを利用できます。

- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Environment Variables**:
  - `ANTHROPIC_API_KEY`: Claude APIキー
  - `NODE_ENV`: `production`

フロントエンドからバックエンドAPIへ接続できるよう、公開URLおよびCORS等の本番構成を環境に合わせて設定してください。

### C. 静的ホスティングだけで公開する場合

GitHub Pages、Vercel、Netlify等の静的ホスティングだけでは、現在のExpressベースの `/api/chat` および `/api/feedback` をそのまま実行できません。AI会話機能を利用する本番構成では、Node.jsバックエンドまたは対応するサーバーレスAPI基盤が別途必要です。

---

## 🛠️ 技術スタック
- **Frontend**: React 19, TypeScript, Tailwind CSS, Motion (Framer Motion), Lucide React
- **Backend / Server**: Express, tsx, esbuild, Node.js
- **AI Engine**: **Anthropic Claude API (`@anthropic-ai/sdk`)**
- **Fallback**: Feedback APIには安全な内蔵Fallbackがあります。通常のAI会話については、APIキー未設定時にClaude会話を代替するオフライン対話エンジンを提供する仕様ではありません。
- **Speech**: Web Speech API (SpeechRecognition & SpeechSynthesis)

---

## 📁 ディレクトリ構成
```
├── public/               # 静的アセット（留学生イラスト・背景画像）
│   └── images/
├── src/
│   ├── components/       # UIコンポーネント（対話画面・語彙ドック・設定等）
│   ├── data/             # カリキュラム・留学生プロファイル・単語データ
│   ├── utils/            # 音声合成・対話ログ・翻訳・フィードバック処理
│   ├── App.tsx           # メインアプリケーションコンポーネント
│   ├── main.tsx          # エントリーポイント
│   └── types.ts          # TypeScript型定義
├── server.ts             # Express & Vite サーバー
├── package.json          # プロジェクト設定・依存関係
├── tsconfig.json         # TypeScript設定
├── vite.config.ts        # Vite設定
└── .gitignore            # Git除外設定
```

---

## 📄 ライセンス
This project is private / educational use.
