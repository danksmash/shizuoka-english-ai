# AI留学生えいご対話 (Shizuoka Global Exchange) 🌸

小学校5・6年生向けの1対1英語対話Webアプリです。児童は複数のAI留学生から相手を選び、音声を使って短時間の英語対話を行います。学習履歴は学習者用コードと紐づけてサーバー側に保存し、教師用・研究者用画面では権限に応じて確認・集計できます。

---

## 🌟 現在の構成

### 1. 研究対象のAI留学生は20人

児童用画面で扱う正式な研究対象は `TARGET_20_AI_STUDENT_IDS` に定義した20人です。

- Emma / United States
- Oliver / United Kingdom
- Liam / Australia
- Minji / Korea
- Pavel / Belarus
- Lukas / Germany
- Aina / Malaysia
- Dimas / Indonesia
- Bence / Hungary
- Yuting / Taiwan
- Zofia / Poland
- Matas / Lithuania
- Ananya / India
- Xinyi / China
- Linh / Vietnam
- Rahul / Bangladesh
- Nadeesha / Sri Lanka
- Suman / Nepal
- Amara / Nigeria
- Andrei / Romania

20人の人物画像は `src/assets/personas/*.webp` に統一しています。画像マッピングは `src/data/studentImages.ts` で管理します。

Chloe / Canada と Aung / Myanmar は過去データや旧IDとの後方互換のためマスター定義に残していますが、現在の研究対象20人には含めていません。

### 2. 小学校外国語（英語）の短時間対話

主な対話テーマは次の5種類です。

- じこしょうかい＆あいさつ
- すきなもの・すきなこと
- 静岡のじまん＆世界の文化
- できること・得意なこと
- じゆうトーク・おしゃべり

対話時間は1・2・3・5分から選択します。

### 3. 音声入力・音声出力

- **音声入力**: 対応ブラウザの Web Speech API (`SpeechRecognition`) を利用します。
- **AI留学生の音声出力**: Cloud Run の `/api/tts` から Google Cloud Text-to-Speech の Chirp 3 HD 音声を取得します。
- Google TTSを利用できない場合に備え、端末側の音声合成へ切り替えるfallbackを維持しています。
- アプリケーションは児童の録音音声ファイルをFirestoreへ保存しません。

### 4. AI対話

- AI対話は Cloud Run 上の Node.js / Express API を経由して Anthropic Claude API に接続します。
- `ANTHROPIC_API_KEY` はブラウザへ露出させません。
- APIキー未設定時やAI接続不可時に、通常会話を装ったローカルAI対話へ置き換える仕様ではありません。
- 高リスク個人情報、プロンプトインジェクション、不適切出力に対する検査を実装しています。

### 5. 学習履歴・研究データ

- 学習者用コードはサーバー側で照合し、コードそのものを研究用CSVへ出力しません。
- 対話セッション、児童の発話、振り返り等は Cloud Run 経由で Firestore に保存します。
- 児童端末の `localStorage` を学習履歴の正本には使用しません。
- 研究者用データでは `research_id` を使用し、研究用Exportから直接識別情報を分離します。
- 教師用・研究者用管理画面は児童用画面とは分離しています。

---

## 🌐 本番構成

```text
児童・教員ブラウザ
      │
      ▼
GitHub Pages
https://danksmash.github.io/shizuoka-english-ai/
      │
      ▼
Cloud Run API
https://shizuoka-english-ai-1075707511474.asia-northeast1.run.app
      │
      ├─ Anthropic Claude API
      ├─ Google Cloud Text-to-Speech
      └─ Firestore
```

授業で案内する正式なフロントエンドURLはGitHub Pages側です。Cloud Run URLは主にバックエンドAPIとして使用します。

### GitHub Pages

`.github/workflows/pages.yml` が `main` へのpush時に以下を実行します。

1. Node.js 20 セットアップ
2. `npm ci`
3. 全QA
4. GitHub Pages用Vite build
5. Pages artifact upload
6. GitHub Pages deploy

### Cloud Run

`.github/workflows/cloud-run-deploy.yml` が `main` へのpush時に以下を実行します。

1. Node.js 20 セットアップ
2. `npm ci`
3. 全QA＋production build
4. Google Cloud認証
5. Cloud Run deploy
6. production health / AI smoke test
7. Google TTS voice check

---

## 🔒 学校利用時の安全性

- APIキーはサーバー側のみで保持
- 高リスク個人情報のAI送信前マスキング
- 学習者用コードのサーバー照合
- 研究用Exportでは匿名化IDを使用
- 児童画面と教師・研究者画面を分離
- Prompt Injection対策
- AI出力の安全性検査
- 児童の録音音声を学習履歴として保存しない

実際の授業利用では、学校・教育委員会の情報セキュリティ、個人情報保護、ネットワーク利用基準に従って運用してください。

---

## 🚀 ローカル開発

### 必要環境

- Node.js 20系
- npm
- Anthropic APIキー（AI対話を実行する場合）

### セットアップ

```bash
git clone <YOUR_GITHUB_REPO_URL>
cd <REPO_NAME>
npm ci
cp .env.example .env
```

`.env` の例:

```env
ANTHROPIC_API_KEY="sk-ant-..."
```

### 開発サーバー

```bash
npm run dev
```

### 全QA

```bash
npm run qa
```

### 本番ビルド

```bash
npm run build
```

### 本番サーバー

```bash
npm start
```

---

## 🛠️ 技術スタック

- **Frontend**: React 19 / TypeScript / Vite / Tailwind CSS / Motion / Lucide React
- **Backend**: Node.js / Express
- **AI**: Anthropic Claude API
- **Speech Recognition**: Web Speech API
- **Speech Output**: Google Cloud Text-to-Speech Chirp 3 HD + device TTS fallback
- **Database**: Firestore
- **Frontend Hosting**: GitHub Pages
- **Backend Hosting**: Google Cloud Run
- **CI/CD**: GitHub Actions

---

## 📁 主なディレクトリ

```text
├── .github/workflows/          # CI / GitHub Pages / Cloud Run deploy
├── scripts/                    # QA・検証スクリプト
├── src/
│   ├── assets/
│   │   └── personas/           # 研究対象20人のWebP人物画像
│   ├── components/             # 児童・教師・研究者UI
│   ├── data/
│   │   ├── curriculum.ts       # AI留学生・対話テーマ
│   │   ├── personaResearch.ts  # 研究用人物属性・Google TTS設定
│   │   └── studentImages.ts    # 人物画像マッピング
│   ├── server/                 # 保存・管理・研究データ関連処理
│   ├── utils/                  # 音声・安全対策等
│   └── App.tsx
├── server.ts                   # Express API
├── package.json
└── vite.config.ts
```

---

## 📄 ライセンス

Private / educational use.
