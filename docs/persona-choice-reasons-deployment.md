# Persona選択理由・追加質問紙：本番接続手順（2026-11-03）

## 対象
- Googleフォーム：AI留学生の選び方についてのアンケート
- フォームID：`1yJZ0nfvYETEnKaV227VBD9_T0WiOMobI6gT-K6BYS7I`
- 回答保存シート：`1kktYzTDTXwzNpOtaiNkWO8MMILCrk1ATaRE4smKxpkw`
- Apps Script原稿：`scripts/persona-choice-reasons-auto-sync.gs`
- API：`/api/questionnaire-auto/ingest`
- 研究画面：`/persona-choice-analysis.html`
- 追加CSV：`persona_choice_reason_responses.csv`

## 0．作業前
1. GitHub PR #266のCI（Build and type-check、Persona choice questionnaire PR QA）を確認する。
2. 既存のApps Scriptのコード、Script Propertiesの**キー名**、インストール済みトリガー設定を記録する。秘密鍵の値は共有しない。
3. 研究アプリの既存Pre/Mid/Post質問紙・対話機能が正常であることを確認する。フォーム回答原本を保全する。
4. PRはドラフト状態とし、Cloud Runへのデプロイは実施しない。

## 1．Apps Scriptへの反映（要編集者権限）
1. 対象GoogleフォームのApps Scriptプロジェクトを開く。既存の同名処理を確認し、必要な部分だけ原稿と同内容に更新する（原稿を貼るだけではGitHubから自動反映されない）。
2. **スクリプトプロパティ**で `QUESTIONNAIRE_INGEST_SECRET` が設定され、Cloud Runの同名シークレットと一致していることを権限を持つ管理者が確認する。鍵をチャット・ログ・リポジトリに貼り付けない。
3. `testPersonaChoiceReasonsConnectionNoWrite()` を手動実行する。
   - インストーラーもフォーム質問の見出し（学習コード、質問1～3）と回答受付状態、および署名付き接続を事前確認します。失敗時は古いトリガーを削除しません。成功時は `ok: true`、`expected: INVALID_LEARNING_CODE`、`writePerformed: false`。エラー時は秘密鍵・URL・署名の不一致を確認し、実回答を送らない。
4. `installPersonaChoiceReasonsAutoSync()` を**一度だけ**実行し、必要なGoogleの権限を許可する。onFormSubmitと5分間隔トリガーが設定される。
5. `auditPersonaChoiceReasonsAutoSync()` を実行し、次の条件を確認する：
   - `secretConfigured === true`
   - `acceptingResponses === true`
   - `submitTriggerInstalled === true`
   - `retryTriggerInstalled === true`
   - `syncLogHidden === true`
   - 児童回答がまだない場合は `formResponseCount === 0`、`syncedResponseCount === 0` でも正常
6. 5分間隔の定期照合はGoogleフォーム原本を確認し、未同期回答を再送する。旧版で保存したpayload列（学習コードを含む場合あり）は照合時に消去する。

## 2．回答後の検証
1. 研究に同意した児童の**実際の回答**が到着してから `auditPersonaChoiceReasonsAutoSync()` を確認する。未承認のテスト児童を正式研究参加者として偽装しない。
2. すべて成功なら `formResponseCount === syncedResponseCount`、`pendingResponseCount === 0`、`unloggedResponseCount === 0` を確認する。
3. Firestore `persona_choice_reason_responses` の回答数、`researchId`、`classId`、`surveyDate`を管理者が照合する（児童の生コードは研究CSVに出さない）。
4. 同じフォーム回答IDを再送してもFirestoreが新しい回答として増えないことを確認する。
5. PRのマージは本番Cloud Runの自動デプロイを起こす可能性があるため、実際の接続と自動テストの合格を確認してから行う。

## 3．本番画面・研究データの確認
1. 研究ダッシュボードの上部から「追加質問紙（Persona選択理由）」を開く。
2. 調査人数、重複・無効件数、選択理由、自由記述を確認する。
3. `research.csv?dataset=persona_choice_reason_responses` と `research.bundle.zip` を検査。後者は既存7 CSVに追加CSVを加えた合計8 CSV＋manifest.jsonを含む。
4. manifestの `exported_at`、`row_counts.persona_choice_reason_responses`、`persona_choice_reason_join_key`、コードブック定義が整合することを確認する。
5. RQ1照合はボタン押下時のみ実行。国籍群選択率の期間1→2と担当国選択率の期間2→3を混同しない。対応国表未固定なら暫定結果として扱う。
6. 自由記述は個人を特定できる情報が混入する場合があるため、共同研究者へ共有する前に研究者が確認する。

## 4．異常時
- API応答が401：署名鍵・時刻・URLを確認。鍵そのものはログに出さない。
- 400 INVALID_LEARNING_CODE / LEARNING_CODE_NOT_FOUND：誤った学習コード。既存studentとの対応を調べ、別の児童へ強制的に結び付けない。
- pendingが残る：`_sync_log`のエラーメッセージを確認し、フォーム原本と比較する。失敗回答を削除しない。
- ダッシュボード異常：新機能の有効化を停止し、Cloud Run前リビジョンへロールバックする。原回答と既存研究データを改変しない。

## 運用上の注意
Apps ScriptはGitHubにコミットしてもGoogle側には自動反映されない。本書とGitHub上のコードは作業手順・実装原稿であり、実行済みの証拠ではない。
