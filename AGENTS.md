# AI Agent Persistent Project Rules

## 1. プロジェクト構造と軽量化ルール
- 本プロジェクトは小学校5・6年生向け「AI留学生えいご対話」Webアプリケーションです。
- リポジトリ容量を極限まで軽量かつシンプルに保ち、GitHub Pagesでの即時ビルド・デプロイおよび高速なファイルアップロードを維持します。
- 重複した巨大バイナリ画像や不要なバックアップディレクトリは保持せず、軽量・最適化されたアセット構成を採用します。

## 2. 9人のAI留学生イラスト・画像コード完全保護ルール（Checkpoint）
- `src/assets/images/` 内の9枚の人物画像（`oliver_uk.jpg`, `emma_usa.jpg`, `liam_aus.jpg`, `chloe_can.jpg`, `bence_hun.jpg`, `zofia_pol.jpg`, `rahul_ban.jpg`, `linh_vie.jpg`, `aung_mya.jpg`）は確定済み・正常バイナリとして固定されています。
- **これ以降、9枚の画像ファイルの再生成・上書き・削除・移動・名前変更を固く禁止します。**
- **`src/components/StudentAvatar.tsx`、`src/data/studentImages.ts`、`src/data/curriculum.ts` の画像読み込み・解決ロジックの変更・再書き換えを固く禁止します。**
- すべての追加開発や機能改修において、現在の画像表示・正常ビルド状態を100%維持してください。

