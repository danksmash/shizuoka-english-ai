import { getDocument, setDocument } from './firestore';

export const RQ2_CODEBOOK_COLLECTION = 'research_rq2_codebooks';
export const RQ2_DEFAULT_CODEBOOK_ID = 'draft-current';
export const RQ2_CODEBOOK_SCHEMA_VERSION = 4;

export const DEFAULT_RQ2_CODEBOOK = {
  schemaVersion: RQ2_CODEBOOK_SCHEMA_VERSION,
  version: 'literature-v1-2026-09-22',
  status: 'draft',
  developmentStatus: 'literature_draft',
  title: 'RQ2 文献根拠型コードブック v1',
  methodologicalPosition: '国内外のL2相互行為能力、interactive listening、Small Talk、AI対話・grounding研究を理論的出発点とし、実データによる帰納的精緻化を組み合わせる演繹的＋帰納的方式。',
  codingUnit: 'AI前ターン→児童ターン→必要に応じAI後ターン。B2a/B2b判定では、必要に応じて同一セッション以前の保存ログ、Persona資料、実在留学生動画資料を確認する。',
  analysisDimensions: ['referenceBasis', 'interactionFunction'],
  referenceBasisRule: '児童発話が「何を手掛かりに相手に合わせられているか」を1つの主コードで表す。単に直前の質問に答えただけではB3にしない。B2a/B2bは記述では区別し、RQ3学校間モデルではB2へ統合する。',
  referencePriorityRule: '主コードが競合する場合は、原則 B4（相手の理解・トラブル状態）→B3（直前ターンで新たに提示された内容）→B2b（実在留学生本人の既知情報）→B2a（AI Personaの既知情報）→B1（カテゴリー情報）→B0 の順に検討する。B3は「直前ターンで新たに提示された内容」の取り上げに限定し、以前から既知の人物情報はB2a/B2bを優先する。副次的根拠は補助ラベルに残す。',
  interactionFunctionRule: '児童発話が対話の中で主に「何をしているか」を1つの主コードで表す。複数機能が明確な場合は、その局所系列で中心となる機能を主コードとし、その他を補助ラベルに残す。形式（疑問文、説明文）ではなく対話上の働きで判定する。',
  functionBoundaryRule: 'ACKは傾聴・反応の表示、RESは質問への直接応答や自己開示、Qは相手の直前内容に依存しない情報要求、TOPは相手が提示した内容を受けた関連質問・関連コメント・話題の深掘り、COMPは理解を確認・要求・交渉する行動、REPは理解上の問題を解消するために自分の発話を訂正・反復・言い換える行動とする。',
  excludedConstructs: [
    'turn-taking timing/overlap：本アプリは押して話す方式であり、システム側のターン制御の影響が大きいため、今回の主コードから除外する。',
    'prosody：研究ログに音響信号を分析可能な形で保存していないため、今回の主コードから除外する。',
    'recipient locus：博士研究等への将来拡張用の互換情報としてのみ残し、今回の共同研究RQ2/RQ3正式分析には使用しない。',
    'Su & Chen (2026) の delay/mitigation/justification/alternative：拒否ロールプレイに特化した機能であり、本研究の自由度の高い小学生対話にはそのまま移植しない。',
    'Storch (2002) のペア相互作用4類型：ペア全体を単位とする枠組みであり、本研究の児童1発話系列単位とは分析単位が異なるため主コードには採用しない。',
  ],
  deprecatedFunctionCodes: [
    { code: 'A/SD', replacement: 'RES', rule: '旧版の応答・自己開示。新規コードではRESを用いる。' },
    { code: 'T', replacement: 'TOP', rule: '旧版の話題展開。新規コードではTOPを用いる。' },
    { code: 'U', replacement: 'COMP', rule: '旧版の理解確認・調整。新規コードではCOMPを用いる。' },
    { code: 'R', replacement: 'REP', rule: '旧版の修復。新規コードではREPを用いる。' },
    { code: 'E', replacement: 'manual_review', rule: '「説明」という形式だけでは機能を決めない。RES/TOP/COMP/REPのいずれかを文脈に基づき人間が再判定する。' },
  ],
  referenceBasis: [
    {
      code: 'B0',
      label: '一般・非特定',
      origin: 'study_specific_baseline',
      definition: '相手の国籍・人物固有情報・直前に相手が新たに提示した内容・理解状態を用いたことが観察できず、一般的な質問、直接応答、自己開示等を行う。',
      theoreticalBasis: 'recipient design／context-sensitive conductを捉えるための比較基準となる本研究独自の基底カテゴリー。',
      sourceRefs: ['SACKS1974','PEKAREK2018'],
      include: ['一般的な質問', 'AIの一般的な質問への直接回答', '相手固有情報を参照しない自己開示'],
      exclude: ['相手が直前に新たに述べた内容を取り上げる場合はB3', '既知の国籍・人物固有情報を利用する場合はB1/B2'],
      boundaryRule: '直前にAIが質問したという事実だけではB3にしない。児童の語彙・命題選択が相手の新規内容に依存している証拠がなければB0。',
      examples: ['AI: What sport do you like? / Child: I like soccer.'],
    },
    {
      code: 'B1',
      label: 'カテゴリー情報',
      origin: 'study_specific_theory_informed',
      definition: '国籍、国・地域、文化等のカテゴリー情報を、相手に合わせた質問・コメント・説明の手掛かりとして用いる。',
      theoreticalBasis: 'recipient designとcontext-sensitive conductを、本研究のPhase 2で操作可能なカテゴリー情報に具体化した本研究独自コード。',
      sourceRefs: ['SACKS1974','PEKAREK2018','CLARKBRENNAN1991'],
      include: ['相手の国・国籍を明示して尋ねる', '既知の文化・地域カテゴリーを対話内容の選択に明示的に使う'],
      exclude: ['国籍との関連を研究者が推測しただけの話題選択', '直前ターンで初めて提示された国・文化内容の取り上げは原則B3'],
      boundaryRule: 'カテゴリー情報の利用が発話表面または確認可能な直前文脈から示せる場合のみ付与し、ステレオタイプ的推測で付与しない。',
      examples: ['Child: You are from Brazil. What food is popular in Brazil?'],
    },
    {
      code: 'B2a',
      label: 'AI Persona 固有情報',
      origin: 'study_specific_theory_informed',
      definition: '当該AI Personaについて以前の対話やPersona資料から既に得ていた趣味・経験・好み等の人物固有情報を用いる。',
      theoreticalBasis: 'recipient design／common groundを、本研究のAI Personaとの反復対話で形成される人物固有の共有基盤に操作化した本研究独自コード。',
      sourceRefs: ['SACKS1974','CLARKBRENNAN1991','PEKAREK2018','CHOIOH2026'],
      include: ['以前のセッションで知ったAI Personaの好みを再利用する', '既知のPersona固有情報に基づき質問を具体化する'],
      exclude: ['直前AIターンで初めて提示された人物情報はB3', '実在留学生動画から得た情報はB2b'],
      boundaryRule: 'Persona資料または保存ログで情報源を検証できる場合のみ付与する。局所系列だけで情報源を確定できない場合はneeds_reviewとする。',
      examples: ['以前にAI Personaがsoccer好きと分かっている状況で Child: Who is your favorite soccer player?'],
    },
    {
      code: 'B2b',
      label: '実在留学生本人情報',
      origin: 'study_specific_theory_informed',
      definition: '実践校Phase 3で、本人動画等から事前に得た実在留学生本人の名前、趣味、出身地、経験等の人物固有情報を用いる。',
      theoreticalBasis: 'recipient design／common groundを、将来対面する実在他者に関する事前情報へ拡張した本研究独自コード。本研究の新規性が最も強い部分。',
      sourceRefs: ['SACKS1974','CLARKBRENNAN1991','PEKAREK2018','KOBAYASHI2021'],
      include: ['本人動画で知った趣味を話題選択に利用する', '実在留学生本人に関する既知情報をAI対話の中で関連付ける'],
      exclude: ['AI Persona自身の情報はB2a', '国籍など人物を特定しないカテゴリー情報のみならB1'],
      boundaryRule: '本人動画・紹介資料の内容と照合可能な場合のみ付与する。研究者が児童の意図を推測して付与しない。',
      examples: ['実在留学生Mariaの動画でanime好きと知った後 Child: Maria likes anime. Do you like anime?'],
    },
    {
      code: 'B3',
      label: '直前対話情報',
      origin: 'adapted',
      definition: '直前のAIターンで新たに提示された具体的内容を児童が取り上げ、関連質問、関連コメント、自己との関連付け等に用いる。',
      theoreticalBasis: 'Lamのcontingent responses、interactive listening、Galacziのother-initiated topic development、小学校ビデオ通話研究の「相手の応答内容を理解した追加質問」を本研究用に操作化。',
      sourceRefs: ['GALACZI2014','LAM2018','LAM2021','KOBAYASHI2021','YAMAGUCHIYOSHIZAWA2023'],
      include: ['AIが直前に述べた趣味・経験・理由等を使った追加質問', '直前内容を自分の経験と関連付ける'],
      exclude: ['直前の一般的質問に答えただけの直接応答', '以前から既知の人物固有情報を使う場合はB2a/B2b'],
      boundaryRule: '「直前ターンが存在する」ことではなく、「AIが直前に新たに提示した命題・語句が児童の次発話の内容選択に取り込まれている」ことを必要条件とする。',
      examples: ['AI: I have a dog. / Child: What is your dog’s name?'],
    },
    {
      code: 'B4',
      label: '相手の理解・トラブル状態',
      origin: 'adapted',
      definition: '相手が聞き取れない、意味が分からない、誤解している等の理解・コミュニケーション上の状態を手掛かりに児童が発話を調整する。',
      theoreticalBasis: 'comprehension management、repair management、grounding／clarification研究を本研究用に操作化。',
      sourceRefs: ['GALACZITAYLOR2018','SUCHEN2026','CLARKBRENNAN1991','SHAIKH2024'],
      include: ['AIのI do not understand等に応じた言い換え・説明', '相手の誤解を受けた訂正'],
      exclude: ['児童自身が理解できず確認するだけで、相手の理解状態を根拠にしていない場合は参照基盤B3/B0等を検討し、機能COMPを付与'],
      boundaryRule: '相手側の理解・知覚・解釈上の問題が局所系列に明示され、それへの適応が児童発話に観察できる場合に付与する。',
      examples: ['AI: I do not understand “ekiben.” / Child: Ekiben is a lunch box at a station.'],
    },
  ],
  interactionFunction: [
    {
      code: 'ACK',
      label: '反応・傾聴表示',
      origin: 'adapted',
      definition: '相手の発話を聞いていること、受け止めたこと、驚き・同意・関心等を短く示し、対話継続を支える。',
      theoreticalBasis: 'listener support／interactive listening／acknowledgementを、日本の小学校Small Talkの「反応」と接続して操作化。',
      sourceRefs: ['GALACZI2014','LAM2021','SUCHEN2026','YAMAGUCHITATSUMI2020','YAMAGUCHIYOSHIZAWA2023'],
      include: ['Oh.', 'I see.', 'Really?（主に反応として使用）', '相手語句の反応的な繰り返し'],
      exclude: ['新たな情報を求める実質的質問', '内容を発展させる追加質問はTOP'],
      boundaryRule: '発話の主目的が新情報の獲得ではなく、傾聴・受け止め・関与の表示である場合にACK。Really?等は局所文脈で実質的確認要求ならCOMP/Qを検討する。',
      examples: ['AI: I love dogs. / Child: Really?'],
    },
    {
      code: 'RES',
      aliases: ['A/SD','A-SD'],
      label: '応答・自己開示',
      origin: 'adapted_baseline',
      definition: '相手から求められた情報へ直接答える、または自分の好み・経験・考え等を提示する。',
      theoreticalBasis: '小学校Small Talkにおける応答・自己表現と、一般的なquestion-answer／inform機能を本研究の基底機能として整理。',
      sourceRefs: ['YAMAGUCHITATSUMI2020','ISO24617_2'],
      include: ['質問への直接回答', '自分の好み・経験の提示'],
      exclude: ['相手の内容を受けて話題を広げることが主ならTOP', '理解問題への訂正・言い換えが主ならREP'],
      boundaryRule: '質問に必要な情報を直接返す範囲をRESとし、相手の提示内容を取り込んで一段話題を発展させる場合はTOPを優先する。',
      examples: ['AI: What sport do you like? / Child: I like soccer.'],
    },
    {
      code: 'Q',
      label: '質問・情報要求',
      origin: 'adapted_baseline',
      definition: '相手から新しい情報を得るために質問する。直前の相手固有内容を発展させる追加質問ではなく、一般的・新規の情報要求を中心とする。',
      theoreticalBasis: '小学校「話すこと［やり取り］」研究で重視される質問作成・疑問詞使用と、一般的dialogue actのQuestionを本研究用に整理。',
      sourceRefs: ['KOBAYASHI2021','YAMAGUCHIYOSHIZAWA2023','ISO24617_2'],
      include: ['What food do you like?', 'Can you play tennis? 等の一般的質問'],
      exclude: ['直前に相手が述べた内容を深掘りする追加質問はTOP', '聞き取れない・意味不明への確認要求はCOMP'],
      boundaryRule: '質問形式かどうかではなく、相手の直前内容への依存性と目的で判定する。contingentな追加質問はTOP。',
      examples: ['Child: What food do you like?'],
    },
    {
      code: 'TOP',
      aliases: ['T'],
      label: '話題展開・関連付け',
      origin: 'adapted',
      definition: '相手が提示した内容や現在の話題を受け、それに関連する質問、コメント、比較、自己との関連付け等によって話題を広げる・深める。',
      theoreticalBasis: 'Galacziのtopic development、Lamのcontingent responses、interactive listening、小学校ビデオ通話研究の関連する追加質問を統合。',
      sourceRefs: ['GALACZI2014','GALACZITAYLOR2018','LAM2018','LAM2021','KOBAYASHI2021','YAMAGUCHIYOSHIZAWA2023'],
      include: ['相手の答えを受けたWhy/Who/When等の追加質問', '相手の経験と自分の経験を関連付けるコメント'],
      exclude: ['一般的な準備質問はQ', '質問に直接答えるだけならRES', '短い受け止めだけならACK'],
      boundaryRule: '当該発話を理解するのに相手の直前内容または現在の具体的話題が不可欠で、発話がその話題を前進させる場合にTOP。',
      examples: ['AI: I play soccer every Sunday. / Child: Who do you play with?'],
    },
    {
      code: 'COMP',
      aliases: ['U'],
      label: '理解確認・意味交渉',
      origin: 'adapted',
      definition: '自分または相手の理解を監視し、聞き返し、意味確認、確認要求等によって相互理解を確かめたり交渉したりする。',
      theoreticalBasis: 'comprehension management、interactive listening、grounding／clarification actsに基づく。',
      sourceRefs: ['GALACZITAYLOR2018','LAM2021','SUCHEN2026','CLARKBRENNAN1991','SHAIKH2024'],
      include: ['What does ___ mean?', 'Again, please.', 'Do you mean ___?'],
      exclude: ['問題を解消するために自分の発話を訂正・言い換える行動はREP', '単なる情報質問はQ'],
      boundaryRule: '新しい内容を知ることより、「聞こえたか／意味が分かったか／解釈が合っているか」を確かめることが中心ならCOMP。',
      examples: ['AI: I enjoy hiking. / Child: What does “hiking” mean?'],
    },
    {
      code: 'REP',
      aliases: ['R'],
      label: '修復・言い換え',
      origin: 'adapted',
      definition: '理解上の問題や自分の誤りを解消するために、自分の発話を訂正、反復、言い換え、簡略化する。',
      theoreticalBasis: 'repair managementおよびgrounding研究に基づく。AI/ASRが引き起こした修復も起こり得るため、原因と能力を同一視しない。',
      sourceRefs: ['GALACZITAYLOR2018','SUCHEN2026','GOKTURK2024','SHAIKH2024'],
      include: ['自分の言い間違いを即時訂正', '相手の理解困難を受けて同じ内容をより簡単に言い換える'],
      exclude: ['理解できないことを尋ねるだけならCOMP', '単なる詳しい説明で理解問題がない場合はRES/TOP'],
      boundaryRule: 'トラブル源となった自分の先行発話を置き換える／修正する働きが観察できる場合にREP。AI/ASR由来のトラブルかどうかはhumanNote等に記録し、REP出現を能力向上と直結させない。',
      examples: ['Child: I like baseball—sorry, I like basketball.'],
    },
  ],
  recipientLocus: [
    { code: '現在のAI', label: '現在のAI', definition: '過去データ互換用。今回の共同研究RQ2/RQ3正式分析には使用しない。' },
    { code: '将来の実在留学生', label: '将来の実在留学生', definition: '過去データ互換用。今回の共同研究RQ2/RQ3正式分析には使用しない。' },
    { code: 'AIと実在他者を橋渡し', label: 'AIと実在他者を橋渡し', definition: '過去データ互換用。今回の共同研究RQ2/RQ3正式分析には使用しない。' },
    { code: '判定不能', label: '判定不能', definition: '過去データ互換用。今回の共同研究RQ2/RQ3正式分析には使用しない。' },
  ],
  references: [
    { id: 'GALACZI2014', citation: 'Galaczi, E. D. (2014). Interactional competence across proficiency levels: How do learners manage interaction in paired speaking tests? Applied Linguistics, 35(5), 553–574. https://doi.org/10.1093/applin/amt017', role: 'topic development, listener support, turn-taking' },
    { id: 'GALACZITAYLOR2018', citation: 'Galaczi, E. D., & Taylor, L. (2018). Interactional competence: Conceptualisations, operationalisations, and outstanding questions. Language Assessment Quarterly, 15(3), 219–236. https://doi.org/10.1080/15434303.2018.1453816', role: 'IC概念と操作化の中核' },
    { id: 'LAM2018', citation: 'Lam, D. M. K. (2018). What counts as “responding”? Contingency on previous speaker contribution as a feature of interactional competence. Language Testing, 35(3), 377–401. https://doi.org/10.1177/0265532218758126', role: 'contingent response / B3・TOP' },
    { id: 'LAM2021', citation: 'Lam, D. M. K. (2021). Don’t turn a deaf ear: A case for assessing interactive listening. Applied Linguistics, 42(4), 740–764. https://doi.org/10.1093/applin/amaa064', role: 'listenership displays, contingent responses, interactive listening' },
    { id: 'PEKAREK2018', citation: 'Pekarek Doehler, S., & Berger, E. (2018). L2 interactional competence as increased ability for context-sensitive conduct: A longitudinal study of story-openings. Applied Linguistics, 39(4), 555–578. https://doi.org/10.1093/applin/amw021', role: 'recipient design / context-sensitive conduct' },
    { id: 'GOKTURK2024', citation: 'Gokturk, N., & Chukharev, E. (2024). Exploring the potential of a spoken dialog system-delivered paired discussion task for assessing interactional competence. Language Assessment Quarterly, 21(1), 60–99. https://doi.org/10.1080/15434303.2023.2289173', role: 'GalacziコードのSDS対話への適用・改変という方法論的先例' },
    { id: 'SUCHEN2026', citation: 'Su, Y., & Chen, X. (2026). Second language interactional competence in roleplay: Comparing generative artificial intelligence and human interlocutors. Language Learning. https://doi.org/10.1111/lang.70040', role: 'GenAI対話におけるacknowledgement/comprehension等のデータ駆動操作化' },
    { id: 'MENG2026', citation: 'Meng, Y., Shen, C., Qian, X., & Wang, C. (2026). Chatbot versus human peer: Effects on college EFL learners’ interactional competence development. Language Learning. https://doi.org/10.1111/lang.70044', role: 'GenAI対話とhuman peerのIC比較、interactive listening' },
    { id: 'CHOIOH2026', citation: 'Choi, J., & Oh, S. (2026). Developing L2 turn-taking with ChatGPT: A longitudinal conversation analytic study. System, 138, 103959. https://doi.org/10.1016/j.system.2025.103959', role: 'AI interlocutorへのrecipient designの縦断的変化' },
    { id: 'YAMAGUCHITATSUMI2020', citation: '山口美穂・巽徹 (2020). Small Talkの継続的な実施による児童生徒の発話パフォーマンスの変化. 小学校英語教育学会誌, 20(01), 84–99. https://doi.org/10.20597/jesjournal.20.01_84', role: '小学校Small Talkにおける発話・反応の国内基盤' },
    { id: 'YAMAGUCHIYOSHIZAWA2023', citation: '山口美穂・吉澤寛之 (2023). 小学校外国語「話すこと［やり取り］」Small Talkにおける児童の発話パフォーマンスの変化に英語学習に対する情意が及ぼす影響. 小学校英語教育学会誌, 23(01), 67–82. https://doi.org/10.20597/jesjournal.23.01_67', role: '反応数、繰り返し、Oh/Really/I see、Why等による話題継続' },
    { id: 'KOBAYASHI2021', citation: '小林翔・古屋雄一朗・中川右也 (2021). 小学校児童のスピーキング力向上とコミュニケーションをしようとする意思の育成を目指したビデオ通話の実践. 小学校英語教育学会誌, 21(01), 4–19. https://doi.org/10.20597/jesjournal.21.01_4', role: '相手の応答内容を理解した追加質問・関連質問' },
    { id: 'SACKS1974', citation: 'Sacks, H., Schegloff, E. A., & Jefferson, G. (1974). A simplest systematics for the organization of turn-taking for conversation. Language, 50(4), 696–735. https://doi.org/10.2307/412243', role: 'recipient designの基礎概念' },
    { id: 'CLARKBRENNAN1991', citation: 'Clark, H. H., & Brennan, S. E. (1991). Grounding in communication. In Perspectives on socially shared cognition (pp. 127–149). APA. https://doi.org/10.1037/10096-006', role: 'common groundとgrounding' },
    { id: 'SHAIKH2024', citation: 'Shaikh, O., Gligorić, K., Khetan, A., Gerstgrasser, M., Yang, D., & Jurafsky, D. (2024). Grounding gaps in language model generations. NAACL 2024, 6279–6296. https://doi.org/10.18653/v1/2024.naacl-long.348', role: 'human/LLM grounding acts、clarification、acknowledgement' },
    { id: 'ISO24617_2', citation: 'ISO 24617-2:2020. Language resource management—Semantic annotation framework (SemAF)—Part 2: Dialogue acts.', role: '多機能性とdialogue actの一般的分類を確認する補助的参照' },
  ],
  notes: [
    '本v1は「文献による演繹的出発点」であり、最終コードブックではない。300系列のうちコードブック開発用120系列で境界事例・未分類行動を確認して精緻化する。',
    '開発用120系列は6区分×20系列、一致度確認用60系列は6区分×10系列で、両者を混用しない。',
    'コードブックを確定（freeze）する前に、developmentStatusをvalidated_with_development_sampleへ変更し、開発用標本での検討を完了したことを明示する。',
    '確定後の一致度確認用60系列は独立二重コードとし、参照基盤主コード・対話機能主コードそれぞれでCohenのκ係数を算出する。出現率の偏りが大きい場合はGwet AC1/AC2を補助確認する。',
    'RQ3では参照基盤主コードと対話機能主コードを別々の多項モデルに用いる。B2a/B2bは原コードを保持し、学校間モデル用列ではB2へ統合する。',
    'AIの出力は候補コードであり、正式コード、児童意図、因果解釈、研究結論をAIだけで確定しない。',
  ],
};

function rowsForDimension(codebook: Record<string, any>, dimension: 'reference' | 'function' | 'locus') {
  const key = dimension === 'reference' ? 'referenceBasis' : dimension === 'function' ? 'interactionFunction' : 'recipientLocus';
  return Array.isArray(codebook[key]) ? codebook[key] : [];
}

function codebookLooksLegacy(codebook: Record<string, any>): boolean {
  return Number(codebook.schemaVersion || 0) < RQ2_CODEBOOK_SCHEMA_VERSION;
}

export async function getRq2Codebook() {
  const stored = await getDocument(RQ2_CODEBOOK_COLLECTION, RQ2_DEFAULT_CODEBOOK_ID);
  if (!stored) return DEFAULT_RQ2_CODEBOOK;
  if (codebookLooksLegacy(stored)) {
    return {
      ...DEFAULT_RQ2_CODEBOOK,
      status: 'draft',
      migratedFromRevision: Number(stored.revision || 0),
      migratedFromVersion: String(stored.version || ''),
      migratedFromStatus: String(stored.status || ''),
      migrationNote: '旧コードブックを、国内外の相互行為能力・Small Talk・AI対話研究を根拠とした文献根拠型v1（schema 4）へ移行する未保存プレビューです。旧定義を自動流用せず、新v1を開発用120系列で検証してから確定してください。',
    };
  }
  return stored;
}

function freezeRowIncomplete(row: any): boolean {
  return !String(row?.code || '').trim()
    || !String(row?.definition || '').trim()
    || !String(row?.origin || '').trim()
    || !String(row?.boundaryRule || '').trim()
    || !Array.isArray(row?.sourceRefs)
    || row.sourceRefs.length === 0
    || !Array.isArray(row?.include)
    || !Array.isArray(row?.exclude);
}

export async function saveRq2Codebook(input: Record<string, any>, updatedBy: string, freeze = false) {
  const referenceBasis = Array.isArray(input.referenceBasis) ? input.referenceBasis : [];
  const interactionFunction = Array.isArray(input.interactionFunction) ? input.interactionFunction : [];
  const recipientLocus = Array.isArray(input.recipientLocus) ? input.recipientLocus : DEFAULT_RQ2_CODEBOOK.recipientLocus;
  if (!referenceBasis.length || !interactionFunction.length) throw new Error('RQ2_CODEBOOK_REQUIRED_DIMENSIONS');
  const allCodes = [...referenceBasis, ...interactionFunction, ...recipientLocus].map((row: any) => String(row?.code || '').trim()).filter(Boolean);
  if (new Set(allCodes).size !== allCodes.length) throw new Error('RQ2_CODEBOOK_DUPLICATE_CODE');
  if (freeze) {
    if (String(input.developmentStatus || '') !== 'validated_with_development_sample') {
      throw new Error('RQ2_CODEBOOK_DEVELOPMENT_VALIDATION_REQUIRED');
    }
    if ([...referenceBasis, ...interactionFunction].some(freezeRowIncomplete)) {
      throw new Error('RQ2_CODEBOOK_INCOMPLETE');
    }
  }
  const now = new Date().toISOString();
  const previous = await getDocument(RQ2_CODEBOOK_COLLECTION, RQ2_DEFAULT_CODEBOOK_ID);
  const revision = Number(previous?.revision || 0) + 1;
  const version = freeze
    ? `rq2-v${revision}`
    : String(input.version || DEFAULT_RQ2_CODEBOOK.version);
  const record = {
    ...input,
    schemaVersion: RQ2_CODEBOOK_SCHEMA_VERSION,
    analysisDimensions: ['referenceBasis', 'interactionFunction'],
    recipientLocus,
    version,
    status: freeze ? 'frozen' : 'draft',
    revision,
    updatedAt: now,
    updatedBy: String(updatedBy || 'researcher').slice(0, 100),
  };
  delete (record as Record<string, any>).migratedFromRevision;
  delete (record as Record<string, any>).migratedFromVersion;
  delete (record as Record<string, any>).migrationNote;
  delete (record as Record<string, any>).migratedFromStatus;
  await setDocument(RQ2_CODEBOOK_COLLECTION, RQ2_DEFAULT_CODEBOOK_ID, record);
  if (freeze) await setDocument(RQ2_CODEBOOK_COLLECTION, version, record);
  return record;
}

function aliasMap(codebook: Record<string, any>, dimension: 'reference' | 'function' | 'locus') {
  const map = new Map<string, string>();
  for (const row of rowsForDimension(codebook, dimension)) {
    const canonical = String(row?.code || '').trim();
    if (!canonical) continue;
    map.set(canonical, canonical);
    for (const alias of Array.isArray(row?.aliases) ? row.aliases : []) {
      const text = String(alias || '').trim();
      if (text) map.set(text, canonical);
    }
  }
  return map;
}

export function rq2CanonicalizeCodes(
  codebook: Record<string, any>,
  dimension: 'reference' | 'function' | 'locus',
  values: unknown,
) {
  const map = aliasMap(codebook, dimension);
  const raw = Array.isArray(values) ? values.map((value) => String(value || '').trim()).filter(Boolean) : [];
  const valid = raw.map((value) => map.get(value)).filter((value): value is string => Boolean(value));
  return {
    valid: [...new Set(valid)],
    invalid: raw.filter((value) => !map.has(value)),
  };
}

export function rq2CanonicalPrimaryAndAux(
  codebook: Record<string, any>,
  dimension: 'reference' | 'function',
  primary: unknown,
  aux: unknown,
) {
  const primaryResult = rq2CanonicalizeCodes(codebook, dimension, primary ? [primary] : []);
  const auxResult = rq2CanonicalizeCodes(codebook, dimension, aux);
  const primaryCode = primaryResult.valid[0] || '';
  const auxCodes = auxResult.valid.filter((code) => code !== primaryCode);
  return {
    primary: primaryCode,
    aux: [...new Set(auxCodes)],
    invalid: [...primaryResult.invalid, ...auxResult.invalid],
  };
}

export function rq2AllowedCodes(codebook: Record<string, any>) {
  return {
    reference: new Set(rowsForDimension(codebook, 'reference').map((row: any) => String(row.code || ''))),
    functions: new Set(rowsForDimension(codebook, 'function').map((row: any) => String(row.code || ''))),
    locus: new Set(rowsForDimension(codebook, 'locus').map((row: any) => String(row.code || ''))),
  };
}
