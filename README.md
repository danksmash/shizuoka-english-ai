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
   - **サーバー経由の安全なAI連携**: Anthropic Claude API をバックエンドサーバー経由で安全に連携（APIキーはブラウザに露出しません）。
   - **自然な対話と高リスク個人情報の自動マスキング**:
     - 英語学習に必要な自己紹介（名前・年齢・学年・好きなこと・静岡や浜松などの市レベルの地域名）は自然に対話で利用できます。
     - 一方で、詳細な番地を含む住所・電話番号・メールアドレス・パスワードなどの高リスク情報は、AI送信前に自動でマスキング処理（`[phone number omitted]` など）が行われます。
     - 会話を不自然に遮断することなく、児童が安心して英語でやり取りできる環境を維持します。
   - **会話ログの非永続化**: サーバー、データベース、Cookie、ローカルストレージに児童の対話履歴や個人情報を永続保存しません（セッション終了時に破棄されます）。
   - **音声データのローカル処理**: Web Speech API を使用し、音声認識および音声合成は端末（ブラウザ）側で動作します。音声データそのものをサーバーへ送信・保存することはありません。
   - **不適切表現・プロンプトインジェクション対策**: 小学生の学習環境に適したシステムプロンプト、入力チェック、AI出力サニタイズ（最大2文制限、不適切語句の防止）を実装しています。
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
※ APIキー未設定時でも、内蔵のインテリジェント・フォールバック対話エンジンにより対話や音声練習が安全に動作します。

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

GitHubリポジトリから簡単にWeb上に公開・デプロイできます。

### A. 🚀 GitHub Pages で公開（最も簡単・無料・推奨）
本リポジトリには `.github/workflows/deploy.yml` が同梱されているため、GitHubにプッシュするだけで自動ビルド＆公開されます。

1. **リポジトリをGitHubにプッシュ**:
   ```bash
   git init
   git branch -M main
   git add .
   git commit -m "feat: AI留学生えいご対話アプリ"
   git remote add origin https://github.com/<あなたのユーザー名>/<リポジトリ名>.git
   git push -u origin main
   ```
2. **GitHubリポジトリの設定**:
   - リポジトリの **Settings** タブを開く
   - 左メニューの **Pages** を選択
   - **Build and deployment** > **Source** を **`GitHub Actions`** に設定
3. 数十秒で自動的に `https://<あなたのユーザー名>.github.io/<リポジトリ名>/` に公開されます！
   *(※相対パス `base: './'` および画像パス最適化済みのため、サブディレクトリ環境でも全ての留学生イラスト・音声・機能が完全動作します)*

---

### B. Render / Railway などの Node.js ホスティング (Claude API サーバー常駐)
1. GitHubリポジトリを連携
2. 設定:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
3. 環境変数（Environment Variables）に設定:
   - **`ANTHROPIC_API_KEY`**: *(お持ちのClaude APIキー)*
   - **`NODE_ENV`**: `production`

---

### C. Vercel / Netlify などの静的ホスティング
1. GitHubリポジトリをインポート
2. 設定:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. ※ ブラウザ完結のインテリジェント対話エンジンにより、音声入力・TTS再生・評価フィードバック・語彙ドックが安全に動作します。

---

## 🛠️ 技術スタック
- **Frontend**: React 19, TypeScript, Tailwind CSS, Motion (Framer Motion), Lucide React
- **Backend / Server**: Express, tsx, esbuild, Node.js
- **AI Engine**: **Anthropic Claude API (`@anthropic-ai/sdk`)** (Claude 3.5 / 3.7 Sonnet & Claude 3.5 Haiku)
- **Offline / Safe Fallback**: 内蔵対話エンジン（ルールベース・小学生向け応答設計）
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
