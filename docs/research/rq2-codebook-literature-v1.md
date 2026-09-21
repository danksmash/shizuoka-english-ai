# RQ2 文献根拠型コードブック v1

作成日: 2026-09-22

## 1. 位置づけ

本コードブックは、RQ2「相手に応じた英語対話行動の類型化」のための**文献根拠型の暫定v1**である。最終コードブックではない。

方法論は、既存研究から候補概念を導く**演繹的手続き**と、実際の児童―AI対話データから境界事例・未分類行動を確認して修正する**帰納的手続き**を組み合わせる。

300系列のうち、
- コードブック開発用: 6区分×20系列 = 120系列
- 評定者間一致確認用: 6区分×10系列 = 60系列
- その他確認用: 6区分×20系列 = 120系列

とし、開発用と一致度確認用を混用しない。

## 2. 文献選定方針

優先したのは以下である。

1. Applied Linguistics, Language Testing, Language Learning, Language Assessment Quarterly, System等の査読付き国際誌
2. 小学校英語教育学会誌（JES Journal）の国内研究
3. L2 interactional competence、interactive listening、Small Talk、AI/SDS対話、groundingに直接関係する研究
4. 基盤研究については被引用実績も確認
5. 2024–2026年のAI研究は刊行直後で被引用数が少ないため、掲載誌・方法・RQへの直接性を重視

被引用数はデータベースで変動するため参考値にとどめる。確認時点の例として、Storch (2002) はWileyのCrossRef表示で約603件、Galaczi & Taylor (2018) はTaylor & FrancisのCrossRef表示で約165件、Hall (2018) は約75件、Gokturk & Chukharev (2024) は約20件、Lam (2021) は所属機関ポータルのScopus表示で42件、山口・巽 (2020) はJ-STAGE被引用文献9件であった。Su & Chen (2026) 等の最新研究は引用蓄積がまだ少ない。

## 3. 中核となる理論・実証研究

### 3.1 L2 interactional competence

**Galaczi (2014)**  
topic developmentだけでなく、listener supportとturn-taking managementをICの重要要素として示した。今回のTOPとACKの主要な理論的根拠。

**Galaczi & Taylor (2018)**  
ICの概念化・操作化を整理する中核研究。今回のコード体系全体の理論的背景。

**Pekarek Doehler & Berger (2018)**  
L2 ICの発達を、よりcontext-sensitiveにtalkを設計し、他者に理解されるように調整する能力の発達として示す。参照基盤軸のrecipient design的発想の主要根拠。

### 3.2 contingent response / interactive listening

**Lam (2018)**  
前話者の発話内容に依存して次の発話を構成するcontingent responseをICの重要特徴として詳細分析。B3とTOPの直接的根拠。

**Lam (2021)**  
interactive listeningを、listenership displays、contingent responses、collaborative completionsの3特徴から検討。ACKとTOPの根拠。

### 3.3 日本の小学校英語・Small Talk

**山口・巽 (2020)**  
Small Talkの継続実施による即興的な会話の発話量・表現の変化を検討。国内小学校英語での基盤研究。

**山口・吉澤 (2023)**  
相手の発話語の繰り返し、Oh、Me too、Really?、I see、Good、Nice等を「反応数」として操作化。さらにWhy等の理由を尋ねて会話を継続する表現が増加したことを報告。ACKとTOPの国内直接根拠。

**小林・古屋・中川 (2021)**  
小学校6年生の外国とのビデオ通話実践で、相手の応答内容を理解した上で追加質問するなど、関連性のある質問が増えたことを報告。B3とTOPの国内直接根拠。

### 3.4 AI / Spoken Dialog System

**Gokturk & Chukharev (2024)**  
Galaczi (2014) の4カテゴリー（topic management, turn management, interactive listening, repair management）をSDS対話へ適用・改変。既存コードを基礎に研究対象へ合わせて修正するという今回と同型の方法論的先例。

**Su & Chen (2026)**  
GenAIとhuman interlocutorでL2 ICを比較。acknowledgement, turn-taking, prosody, comprehension等を、実際のperformance dataから操作化。今回のACK・COMPに強い直接性がある。一方、delay, mitigation, justification, alternativeは拒否ロールプレイ特有なので採用しない。

**Meng et al. (2026)**  
GenAI chatbot群とhuman peer群のIC発達を比較し、両群で改善がみられる一方、human peer群がinteractive listeningで優れていた。AI相手ではinteractive listeningの出現・解釈に注意が必要。

**Choi & Oh (2026)**  
ChatGPTとの縦断対話で、学習者がAIを特有のinterlocutorとして再カテゴリー化し、recipient-designed talkを行うようになることを報告。B2aの理論的補助。

### 3.5 grounding / recipient design

**Sacks, Schegloff, & Jefferson (1974)**  
recipient designを会話のcontext-sensitiveな設計の基盤として扱う。参照基盤軸全体の理論背景。

**Clark & Brennan (1991)**  
common groundとgroundingを、共同活動における相互理解の形成・更新として整理。B2・B4の理論背景。

**Shaikh et al. (2024)**  
humanとLLMのgrounding actsを比較し、clarificationやacknowledgement等を扱う。COMP・ACK・B4のAI対話側の補助根拠。

**ISO 24617-2:2020**  
dialogue actを多次元的に捉え、発話が複数機能を持つことを認める。今回の「主コード1つ＋補助ラベル」は、研究上の統計分析のため主機能を1つ固定しつつ、多機能性を補助ラベルに残す方式として整合的。

## 4. 採用しなかった主要枠組み

### Storch (2002)

非常に高引用で信頼性が高いが、equality × mutualityによる**ペア全体の相互作用パターン**を分類する枠組みであり、児童1発話系列を単位とする本RQ2とは分析単位が異なる。理論背景として参照するが主コードにはしない。

### turn-taking / prosody

GalacziやSu & Chenでは重要なIC要素だが、本アプリは「押して話す」方式でシステムがターン境界を強く規定し、研究ログにも音響信号を分析可能な形で保持していない。したがって今回の主コードから除外する。

### 詳細なISO dialogue act taxonomy

ISO 24617-2は理論的に有用だが、50以上のcommunicative functionを含み、小学5・6年生の短時間AI対話へそのまま導入すると過剰分類になる。本研究ではQ/RES等の基本機能の妥当性確認に補助的に用いる。

## 5. 参照基盤 v1

| Code | 名称 | 文献との関係 | 中核判定 |
|---|---|---|---|
| B0 | 一般・非特定 | 本研究独自の比較基準 | 相手固有情報の利用が観察できない |
| B1 | カテゴリー情報 | recipient designを本研究Phase 2へ操作化 | 国籍・国・文化等を明示的に手掛かり化 |
| B2a | AI Persona固有情報 | recipient design/common groundをAI反復対話へ操作化 | 以前から既知のAI Persona固有情報を利用 |
| B2b | 実在留学生本人情報 | 本研究固有の拡張 | 動画等で以前から既知の実在本人情報を利用 |
| B3 | 直前対話情報 | Lam (2018, 2021), Galaczi, 小林ら | 直前AIターンで新たに提示された具体的内容を取り上げる |
| B4 | 相手の理解・トラブル状態 | comprehension/repair/grounding | AI側の理解・知覚・解釈上の問題へ適応 |

### B3の重要な限定

以下はB3ではない。

AI: What sport do you like?  
Child: I like soccer.

これは、AIが新しい「相手自身の内容」を提示したのではなく、児童が一般的質問へ直接回答しただけなので、参照基盤は原則B0、対話機能はRES。

一方、

AI: I have a dog.  
Child: What is your dog's name?

は、AIが新たに提示した "I have a dog" を次発話に取り込んでいるためB3。対話機能はTOP。

## 6. 対話機能 v1

| Code | 名称 | 主な根拠 |
|---|---|---|
| ACK | 反応・傾聴表示 | Galaczi; Lam; Su & Chen; 山口・巽; 山口・吉澤 |
| RES | 応答・自己開示 | Small Talk; question-answer / informの基底機能 |
| Q | 質問・情報要求 | 小林ら; Small Talk; ISO Question |
| TOP | 話題展開・関連付け | Galaczi; Lam; 小林ら; 山口・吉澤 |
| COMP | 理解確認・意味交渉 | Galaczi & Taylor; Lam; Su & Chen; grounding |
| REP | 修復・言い換え | repair management; Su & Chen; Gokturk; grounding |

### 主要境界規則

- **ACK vs TOP**: 短い受け止め・傾聴表示だけならACK。新たに話題を前進させるならTOP。
- **RES vs TOP**: 質問への必要十分な直接回答ならRES。相手内容へ関連付けて話題を追加・発展させるならTOP。
- **Q vs TOP**: 一般的・準備的な新規質問ならQ。直前相手内容に依存した追加質問ならTOP。
- **COMP vs Q**: 新しい事実を知る質問はQ。聞き取り・意味・解釈の確認が目的ならCOMP。
- **COMP vs REP**: 理解問題を確認・要求する側の行動はCOMP。自分の発話を訂正・反復・言い換えて問題を解消する行動はREP。
- **旧E「説明」**: 形式として説明していても、目的に応じRES/TOP/COMP/REPへ振り分ける。自動変換しない。

## 7. 主コードと補助ラベル

発話は多機能になり得るため、情報を捨てないため補助ラベルを保持する。ただしRQ3の多項ロジスティック混合モデルでは各軸1カテゴリーが必要なため、局所系列で中心となる機能を**主コード1つ**に固定する。

主コード決定で迷う場合は、発話形式ではなく「その発話が局所系列で何を達成しているか」を優先する。

## 8. 次の検証手順

1. 本v1をdraftとしてシステムへ登録
2. コードブック開発用120系列のみを使用
3. 2名以上で境界事例を検討
4. 未分類行動、重複、過少・過大カテゴリーを記録
5. コード名・定義・含む例・含まない例・境界規則を改訂
6. developmentStatusを `validated_with_development_sample` へ変更
7. codebookをfreeze
8. 未使用の一致度確認用60系列を独立二重コード
9. 参照基盤・対話機能それぞれでCohen κ、必要に応じGwet AC1/AC2
10. 確定コードをRQ3全縦断データへ適用

## 9. 主要文献

- Galaczi, E. D. (2014). *Applied Linguistics, 35*(5), 553–574. https://doi.org/10.1093/applin/amt017
- Galaczi, E. D., & Taylor, L. (2018). *Language Assessment Quarterly, 15*(3), 219–236. https://doi.org/10.1080/15434303.2018.1453816
- Lam, D. M. K. (2018). *Language Testing, 35*(3), 377–401. https://doi.org/10.1177/0265532218758126
- Lam, D. M. K. (2021). *Applied Linguistics, 42*(4), 740–764. https://doi.org/10.1093/applin/amaa064
- Pekarek Doehler, S., & Berger, E. (2018). *Applied Linguistics, 39*(4), 555–578. https://doi.org/10.1093/applin/amw021
- Gokturk, N., & Chukharev, E. (2024). *Language Assessment Quarterly, 21*(1), 60–99. https://doi.org/10.1080/15434303.2023.2289173
- Su, Y., & Chen, X. (2026). *Language Learning*. https://doi.org/10.1111/lang.70040
- Meng, Y., Shen, C., Qian, X., & Wang, C. (2026). *Language Learning*. https://doi.org/10.1111/lang.70044
- Choi, J., & Oh, S. (2026). *System, 138*, 103959. https://doi.org/10.1016/j.system.2025.103959
- 山口美穂・巽徹 (2020). 小学校英語教育学会誌, 20(01), 84–99. https://doi.org/10.20597/jesjournal.20.01_84
- 山口美穂・吉澤寛之 (2023). 小学校英語教育学会誌, 23(01), 67–82. https://doi.org/10.20597/jesjournal.23.01_67
- 小林翔・古屋雄一朗・中川右也 (2021). 小学校英語教育学会誌, 21(01), 4–19. https://doi.org/10.20597/jesjournal.21.01_4
- Sacks, H., Schegloff, E. A., & Jefferson, G. (1974). *Language, 50*(4), 696–735. https://doi.org/10.2307/412243
- Clark, H. H., & Brennan, S. E. (1991). *Grounding in communication*. https://doi.org/10.1037/10096-006
- Shaikh, O., et al. (2024). NAACL 2024, 6279–6296. https://doi.org/10.18653/v1/2024.naacl-long.348
- ISO 24617-2:2020. Semantic annotation framework—Part 2: Dialogue acts.
