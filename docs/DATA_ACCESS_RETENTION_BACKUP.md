# 学習履歴・研究データのアクセス／保存／復元設計

## 1. 現在の識別方式

児童画面で使用する正式名称は **「学習者ID」** です。4文字の学習者IDを児童が入力し、サーバー側で本人確認と学習履歴の紐付けに使用します。

コード内部では、過去からの互換性のため一部の変数名・API項目名に `learningCode` が残っていますが、児童向けUI上の意味は「学習者ID」です。

学習者IDは次のように扱います。

1. 入力された4文字を正規化する。
2. `LEARNING_CODE_PEPPER` を使ってHMAC-SHA256索引を生成する。
3. Firestoreの `students` 対応表から内部 `studentId` と研究用 `researchId` を解決する。
4. セッション保存では4文字の学習者IDそのものをセッション文書へ保存せず、内部 `studentId` と `researchId` を使用する。

重要な点として、4文字の学習者IDは **`students` 対応表には `learningId` として保持**されます。したがって「学習者IDがデータベースのどこにも保存されない」という設計ではありません。研究用セッションデータや研究Exportへ直接出さないための分離設計です。

## 2. 児童用アクセス

児童用APIは、入力された学習者IDをサーバーで解決した後、その本人に対応する学習履歴だけを返します。

- 学習者ID確認：`POST /api/student/resolve`
- 本人の学習履歴：`POST /api/student/history`
- セッション保存：`POST /api/sessions`

児童ブラウザには完全な研究データベースや他児童の履歴を配布しません。

## 3. 研究者用アクセス

研究者用管理画面は児童画面から直接リンクしない別経路 `/management` です。

現在公開している管理ログインは **研究者専用** です。ログイン成功後に利用できる研究用APIも `researcher` 権限へ限定されています。

主な経路：

- `/api/management/research.summary`
- `/api/management/research.dashboard`
- `/api/management/research.csv`
- `/api/management/research.bundle.zip`

研究Exportでは学習者IDや内部 `studentId` を研究分析用の識別子として使用せず、匿名化された `research_id` を中心に扱います。

管理認証Cookieは `HttpOnly` / `Secure` / `SameSite=Strict` で、8時間で失効します。

## 4. セッションへ保存する主なデータ

完全セッションには、研究・学習履歴に必要な次の情報を保存します。

- `sessionId`
- 内部 `studentId`
- 研究用 `researchId`
- 学級・学年関連情報
- AI留学生 / Persona情報
- 対話テーマ
- 設定時間・実対話時間
- 開始・終了時刻
- 通算回数・当日回数
- ターン数・児童発話語数・語彙等の統計値
- PIIマスキング後の対話履歴
- 児童の3項目振り返り
- AI / TTS / システムイベント等の研究用メタデータ
- `appVersion` / `build`
- `retentionExpiresAt`

氏名、学校名、メール、電話番号、学習者ID等の高リスク情報は保存前のマスキング対象です。

統計値はクライアントの自己申告値だけに依存せず、サーバー側で履歴と時刻から再計算します。

## 5. 保存期間とTTL

既定のセッション保存期間は **1095日（3年）** です。

Cloud Run環境変数 `SESSION_RETENTION_DAYS` で30〜3650日の範囲に変更できます。各セッション文書には、この値から計算した `retentionExpiresAt` を保存します。

ただし、**`retentionExpiresAt` が存在するだけではFirestoreから自動削除されません。** 実際の自動削除には、Google Cloud側でFirestore TTLポリシーを `retentionExpiresAt` フィールドへ設定する必要があります。

研究倫理審査、共同研究契約、所属機関の規程等で別の保存期間が決まった場合は、その要件を優先してCloud Run設定とFirestore TTL設定を一致させます。

## 6. バックアップの現在位置

リポジトリのアプリコードはFirestoreへの保存・取得を行いますが、**FirestoreのScheduled Backup、PITR、Google Driveへの自動バックアップをこのリポジトリから自動設定する処理は現在ありません。**

したがって、バックアップを有効にしたい場合はGoogle Cloud側の運用設定として別途構成し、設定済みであることをGoogle Cloud Console等で確認する必要があります。

推奨運用：

- Firestore Scheduled Backupを有効化する。
- 必要に応じてPITRを併用する。
- バックアップ保持期間は研究倫理・組織規程・費用を踏まえて決める。
- 復元試験は本番 `(default)` を直接上書きせず、可能な範囲で別データベース／検証環境へ復元して確認する。
- 復元後は件数、代表セッション、匿名化Exportの整合性を確認する。

Google Driveへ研究用CSV等を定期保存する仕組みを追加する場合は、Firestoreの正式バックアップとは別系統の **二次バックアップ／研究用Export保管** として設計し、Googleアカウント権限、保存先、暗号化、保持期間、研究倫理上の扱いを別途決めます。

## 7. 秘密情報

次の秘密情報はGitHubへ直接保存しません。

- `LEARNING_CODE_PEPPER`
- `MANAGEMENT_SESSION_SECRET`
- `MANAGEMENT_ACCOUNTS_JSON`
- `ANTHROPIC_API_KEY`

Cloud Run / Google Cloud Secret Manager / GitHub Actions等の適切な秘密情報管理機構を使用します。

## 8. 運用上の確認事項

アプリが正常に動いていることと、TTL・バックアップ設定が有効であることは別です。研究利用前には少なくとも次を個別に確認します。

- Cloud Runの `SESSION_RETENTION_DAYS`
- Firestore TTLポリシーが `retentionExpiresAt` に設定されているか
- Scheduled Backupの有効／無効
- PITRの有効／無効
- 復元権限と復元手順
- 研究Exportの保存先とアクセス権限

この文書はアプリコード上の現在仕様と、Google Cloud側で別途必要となる運用設定を区別して記載します。
