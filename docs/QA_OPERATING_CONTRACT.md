# QA運用契約 — Lean Reliability

この文書は、監査・修正・検査を「必要十分」に保つための共通契約です。  
目的は、検査を減らすことではなく、**重複・小刻みな再実行・個別ルールの増殖を減らし、実運用と研究データの信頼性を維持すること**です。

## 1. QAの責任範囲

開発中の対象確認は、変更内容に対応するQA群を使います。PRでは `npm run qa` を1回通し、全体整合性を確認します。

| QA群 | 主な責任 |
|---|---|
| `qa:foundation` | 対話、音声認識、安全性、データ契約、基本整合性 |
| `qa:experience` | 児童・教師・研究者UIの表示、レスポンシブ、操作性 |
| `qa:research-stack` | Research Dashboard、Phase、session、reflection、questionnaire、export、負荷 |
| `qa:persona-stack` | 研究対象Persona、人数・設定・来日1か月設定 |
| `qa:voice-stack` | Azure/TTS voice profile、primary voice、runtime metadata |
| `qa:full` / `qa` | 上記すべて＋TypeScript型検査 |

### 原則

- 同じ不変条件を複数のQAファイルへ重複して追加しない。
- 既存の責任QAがある場合、新しいQAファイルを作る前に既存QAへ統合する。
- 同種不具合が2回起きた場合、個別症状ではなく上位の不変条件としてテストする。
- テストは「特定の文字列がある」だけでなく、可能な限り「守るべき性質」を検査する。

## 2. 変更リスク別の検査

### Low — 文言・軽微な見た目・文書

例:
- 説明文
- ラベル
- 余白・文字サイズ
- README / docs

開発中:
- 対象QA群のみ。文書だけならQA不要。

PR:
- CIのFull QAに任せる。

本番:
- 通常は既存deploy smokeのみ。

### Medium — UI構造・画面遷移・集計表示・Persona設定

例:
- Research Dashboardのレイアウト
- Phase表示
- session履歴UI
- Reflection UI
- Persona設定変更

開発中:
- 対象QA群
- `npm run lint`
- 必要なら `npm run build`

PR:
- `npm run qa`
- `npm run build`

本番:
- 対象画面または対象APIの既存production smokeを確認。

### High — 保存・認証・研究データ・API契約・deploy基盤

例:
- Firestore保存
- research_id結合
- raw session / reflection / questionnaire
- 認証・権限
- CSV Export
- データ補正
- GitHub Actions / Cloud Run deploy

開発中:
- 関連QA群
- データ契約 / securityを必要に応じて併用
- `npm run lint`
- `npm run build`

PR:
- `npm run qa`
- `npm run build`

本番:
- production health
- 関連API / UI smoke
- データを書き換えないprobeを優先

## 3. 作業の終了条件

通常の改修は、次を満たしたら終了します。

1. 根本原因または変更目的が説明できる。
2. 対象修正が完了している。
3. 対応するQA群が成功している。
4. PRのFull QAとbuildが成功している。
5. 本番影響がある場合、既存production smokeが成功している。

**「さらに確認すれば安心」という理由だけで確認を追加しない。**

## 4. 禁止する非効率

- 同じGitHub Actions状態を短時間に何度も取得する。
- 1ファイル修正するたびにFull QAを実行する。
- 同じ不変条件を複数QAへコピーする。
- 既存QAで保証済みの内容をproduction smokeへ重複追加する。
- 個別バグごとに新しい規則・新しいテストファイルを増やす。
- raw研究データを表示・集計都合で書き換える。

## 5. 共通不変条件の例

- 可変件数の一覧は、隣接領域のレイアウトを支配しない。必要な件数は内部スクロールで吸収する。
- raw研究データは、派生集計やUI修正の都合で書き換えない。
- 同じ入力・条件から同じ研究集計を再現できる。
- 一度のログイン中、不要な重い再集計を繰り返さない。
- 児童用・教師用・研究者用の責務を混在させない。
- 不明・欠測データを都合よく補完しない。
- 変更は既存の本番データと後方互換性を優先する。

## 6. AI・ツール運用

AIによるリポジトリ作業もこの契約に従います。

- ファイル読込・検索は可能な限りまとめる。
- 関連修正はまとめて実装する。
- 開発途中は対象QA群だけを使い、Full QAはPR前後に重複させない。
- CI / deployの途中状態は、次の意思決定に必要なときだけ確認する。
- 完了条件を満たしたら追加のポーリング・監査を続けない。
- 新しい仕組みを追加する前に、既存の仕組みを整理・統合できないか確認する。
