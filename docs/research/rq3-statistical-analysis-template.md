# RQ3 類型分布分析 統計分析テンプレート

更新日: 2026-09-22  
状態: **テンプレートのみ。実データ分析未実行**

## 1. 使用ソフト

主分析は **jamovi + GAMLj3** を用いる。

2026-09-22に公式GAMLj資料を再確認し、GAMLj3のGeneralized Mixed Modelsがmultinomial mixed modelを扱えることを確認した。実分析時には、論文の再現性確保のため、実際に使用したjamovi・GAMLjのバージョン番号を記録する。

Rは、データ点検、記述統計の再現、収束不良時の感度分析等の補助に用いる。

## 2. 入力データ

使用ファイル: `interaction_codes.csv`

正式分析に含める条件:

- `analysis_ready == 1`
- 人間確認済みの主コードのみ
- `participant_key` を児童クラスタIDとして使用
- `reference_primary_raw` は記述用
- `reference_primary_model` はB2a/B2bをB2に統合した主モデル用
- `function_primary` は対話機能主コード

## 3. 最初に必ず行う記述統計

学校条件×時期ごとに、以下を別々に出す。

### 参照基盤

1. 原コード: B0 / B1 / B2a / B2b / B3 / B4
2. 主モデル用: B0 / B1 / B2 / B3 / B4

### 対話機能

ACK / RES / Q / TOP / COMP / REP

各セルについて、

- 発話系列数 n
- 参加児童数
- 各カテゴリーの度数
- 各カテゴリーの割合

を確認する。

ゼロセル、極端に少ないセルがある場合は、モデル結果を解釈する前に必ず記録する。統計的都合だけでカテゴリーを統合しない。

## 4. 主分析モデル1：参照基盤

### 従属変数

`reference_primary_model`

水準:

- B0
- B1
- B2
- B3
- B4

B2a/B2bは記述では分けて保持し、学校間比較の主モデルだけB2へ統合する。

### 固定効果

- 学校条件: `school_condition`
- 時期: `analysis_period`
- 学校条件×時期

### ランダム効果

- 児童ID `participant_key` のランダム切片

主分析式の考え方:

`reference_primary_model ~ school_condition * analysis_period + (1 | participant_key)`

参照カテゴリーはB0を基本とする。

## 5. 主分析モデル2：対話機能

### 従属変数

`function_primary`

水準:

- ACK
- RES
- Q
- TOP
- COMP
- REP

### 固定効果

- 学校条件
- 時期
- 学校条件×時期

### ランダム効果

- 児童IDのランダム切片

主分析式の考え方:

`function_primary ~ school_condition * analysis_period + (1 | participant_key)`

参照カテゴリーは、直接的な応答・自己開示という基底機能であるRESを基本とする。

## 6. jamovi + GAMLj3 の設定

1. `interaction_codes.csv` を開く。
2. `analysis_ready == 1` の行だけを分析対象にする。
3. `school_condition`, `analysis_period`, 従属変数を名義尺度として確認する。
4. `participant_key` をID／名義尺度として確認する。
5. GAMLj3 → **Generalized Mixed Models** を開く。
6. Model typeを **Multinomial** にする。
7. Dependent Variableに、まず `reference_primary_model` を入れる。
8. Factorsに `school_condition` と `analysis_period` を入れる。
9. Cluster variableに `participant_key` を入れる。
10. Fixed effectsに `school_condition`, `analysis_period`, `school_condition × analysis_period` を入れる。
11. Random effectsはまず児童ごとのrandom interceptのみとする。
12. 95%信頼区間、モデル適合指標、固定効果の検定、推定確率／marginal effectsを出す。
13. 同じ設定で従属変数を `function_primary` に変更して第2モデルを実行する。

学校条件の参照水準はcomparison、時期の参照水準はperiod1を基本とする。

## 7. 主要な報告対象

係数表だけで結論を出さない。

主に報告するのは、

- 学校条件の主効果
- 時期の主効果
- **学校条件×時期の交互作用**
- 学校条件×時期ごとの各カテゴリーの**推定確率**
- 推定確率の95%信頼区間

とする。

多項モデルでは参照カテゴリーの選択によって係数表の見え方が変わるため、論文本文では推定確率の図・表を中心に解釈する。

## 8. 収束・疎セルへの対応

次の場合は警告として扱う。

- 特定の学校条件×時期でカテゴリーが0件
- 極端に少ないカテゴリーがある
- 標準誤差が非常に大きい
- 係数が異常に大きい
- モデルが収束しない

対応順序:

1. 入力データ・コード化エラーを確認
2. 度数分布を再確認
3. モデルを無理に解釈しない
4. 理論的に妥当なカテゴリー統合があるか共同研究者と検討
5. 必要なら記述統計を主として報告
6. Rによる感度分析で結果の頑健性を確認

**出現数が少ないという統計上の理由だけで、研究後にカテゴリーを恣意的に統合しない。**

## 9. セッション内依存の感度分析

主分析は現在の研究計画どおり、児童IDのランダム切片のみとする。

ただし1セッション内に複数の児童発話系列が含まれるため、必要に応じて、

`(1 | participant_key) + (1 | session_id)`

を用いたモデルを**感度分析**として検討する。

これを主分析に自動昇格させない。収束状況、モデル適合、推定確率が主分析と大きく異なるかを確認するために用いる。

## 10. 解釈上の制約

実践校1校・比較校1校の場合、学校条件の係数を「一般的な実践効果」とは解釈しない。

論文では、

- 本研究で観察された実践校と比較校の差
- 本研究の期間内で観察された分布変化

として記述する。

また、REPはAIや音声認識の誤認識によって誘発される可能性があるため、REP増加を児童の能力向上と自動的に同一視しない。

## 11. 再現性のため保存するもの

最終分析時には次を同一フォルダに保存する。

- `analysis_sessions.csv`
- `interaction_codes.csv`
- `rq2_reliability.csv`
- `analysis_manifest.json`
- jamoviの分析ファイル
- 使用したjamoviバージョン
- 使用したGAMLjバージョン
- Rを使用した場合はRバージョンとスクリプト
- コードブックversion
- RQ3 run ID

## 12. 事前に固定する事項

本分析開始前に以下を変更履歴付きで固定する。

- 2つの主モデルを別々に実施すること
- B2a/B2bを主モデルではB2へ統合すること
- 学校条件×時期を主要な検討対象とすること
- 児童IDをランダム切片とすること
- 推定確率と95%信頼区間を主要な解釈資料とすること
- 疎セル時の対応手順
- 実践校1校・比較校1校の場合の一般化制約
