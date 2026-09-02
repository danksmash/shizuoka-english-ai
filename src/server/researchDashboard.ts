import { AI_STUDENTS_MASTER_LIST, TARGET_20_AI_STUDENT_IDS } from '../data/curriculum';
import { buildResearchDataSets } from './researchExport';

export type ResearchExportDatasetName = 'sessions' | 'utterances' | 'expressions' | 'personas' | 'codebook';
export type ResearchFilterQuery = {
  start?: unknown;
  end?: unknown;
  classId?: unknown;
  grade?: unknown;
  personaId?: unknown;
  labelCondition?: unknown;
  topic?: unknown;
  completeOnly?: unknown;
};

type Row = Record<string, unknown>;
type ExportDataSets = Record<ResearchExportDatasetName, Row[]>;

export const RESEARCH_EXPORT_SCHEMA_VERSION = 'research-2026-v2';

const RESEARCH_PERSONAS = TARGET_20_AI_STUDENT_IDS.map((id) => {
  const persona = AI_STUDENTS_MASTER_LIST.find((item) => item.id === id);
  if (!persona) throw new Error(`RESEARCH_PERSONA_MISSING:${id}`);
  return persona;
});
const RESEARCH_PERSONA_IDS = new Set(RESEARCH_PERSONAS.map((persona) => String(persona.id)));

function isResearchTargetSession(session: Record<string, any>): boolean {
  const personaId = String(session.personaId || session.aiStudentId || '');
  return RESEARCH_PERSONA_IDS.has(personaId);
}

export const RESEARCH_EXPORT_HEADERS: Record<ResearchExportDatasetName, string[]> = {
  sessions: [
    'research_id','class_id','session_id','grade_level',
    'local_date','local_start_time','local_end_time','local_started_at','local_ended_at',
    'lifetime_session_number','daily_session_number','days_since_previous_session',
    'persona_id','persona_country','persona_gender','ai_student_id',
    'assigned_partner_id','assigned_partner_country','assignment_announced_at',
    'topic',
    'child_total_words','mean_child_words_per_turn','max_child_words_per_turn','child_unique_word_types',
    'child_turn_count','ai_turn_count','dialogue_utterance_count',
    'child_repair_count','child_reason_expression_count',
    'target_duration_minutes','actual_duration_seconds',
    'reflection_conveyed_ideas','reflection_understood_partner','reflection_noticed_language_culture',
    'same_class_starts_5min','same_class_starts_10min','usage_context_inferred',
    'persona_label_condition','country_label_visible','accent_label_visible','flag_visible',
    'help_open_count','vocab_bank_open_count',
    'speech_rate_change_count','student_selected_speech_rate',
    'schema_version','research_schema_version','app_version','build',
    'session_completed','session_status','data_quality_flag',
  ],
  utterances: [
    'research_id','class_id','session_id','utterance_id','persona_id','topic',
    'turn_sequence','speaker_turn_number','speaker','local_timestamp',
    'english_text_anonymized','japanese_translation',
    'is_question','question_type','is_reciprocal_question','is_repair','is_reason_expression',
  ],
  expressions: [
    'research_id','class_id','session_id','utterance_id','dictionary_source','expression_id','expression',
    'persona_id','profile_field','persona_category','curriculum_grade','curriculum_unit',
  ],
  personas: [
    'persona_id','name','country','gender','city','major','likes','heritage_landmark','profile_text_ja',
  ],
  codebook: ['file_name','variable','definition','data_type','allowed_values','analysis_use'],
};

const FILE_ANALYSIS_USE: Record<ResearchExportDatasetName, string> = {
  sessions: '縦断分析、告知前後比較、担当国Persona選択、発話量、振り返り、利用文脈のセッション単位分析',
  utterances: '原発話に基づく内容分析、相互行為、質問、repair、理由表現、専有の再判定',
  expressions: '教科書辞書・persona辞書との一致を用いた内容層・相手志向性の補助分析',
  personas: '研究対象20名の固定Persona属性とプロフィール刺激の再現性確認',
  codebook: '変数定義、値域、再現可能性、共同研究者とのデータ共有',
};

const FIELD_DEFINITION: Record<string, string> = {
  research_id:'児童を直接特定しない研究用匿名ID',
  class_id:'匿名化された学級ID',
  session_id:'1対話ごとの一意なセッションID',
  grade_level:'学年',
  local_date:'日本時間での実施日',
  local_start_time:'日本時間での開始時刻',
  local_end_time:'日本時間での終了時刻',
  local_started_at:'日本時間の開始日時',
  local_ended_at:'日本時間の終了日時',
  lifetime_session_number:'研究用に日時から再計算した通算セッション番号',
  daily_session_number:'研究用に日時から再計算した当日セッション番号',
  days_since_previous_session:'同一research_idの前回セッションからの日数',
  persona_id:'AI留学生Personaの固定ID',
  persona_country:'選択したPersonaの国',
  persona_gender:'選択したPersonaの性別',
  ai_student_id:'アプリ内部のAI留学生ID',
  assigned_partner_id:'実際に交流する担当留学生を識別する研究用ID',
  assigned_partner_country:'実際に交流する担当留学生の出身国',
  assignment_announced_at:'担当留学生の氏名・出身国が児童へ告知された日時',
  topic:'児童が選択した対話テーマ',
  child_total_words:'児童英語発話の総語数',
  mean_child_words_per_turn:'児童1発話あたり平均語数',
  max_child_words_per_turn:'児童1発話の最大語数',
  child_unique_word_types:'児童発話に出現した異なり語数',
  child_turn_count:'児童発話数',
  ai_turn_count:'AI発話数',
  dialogue_utterance_count:'児童とAIを合計した発話数',
  child_repair_count:'聞き返し・理解困難表現等のrepair数',
  child_reason_expression_count:'because等の理由表現数',
  target_duration_minutes:'児童が選択した対話時間（分）',
  actual_duration_seconds:'実際の対話経過時間（秒）',
  reflection_conveyed_ideas:'自分の考えを伝える振り返り（1/3/5）',
  reflection_understood_partner:'相手の話を聞いて分かる振り返り（1/3/5）',
  reflection_noticed_language_culture:'新しい言葉や文化に気づいた振り返り（1/3/5）',
  same_class_starts_5min:'当該開始時刻の前後5分以内に開始した同学級セッション数（当該sessionを含む）',
  same_class_starts_10min:'当該開始時刻の前後10分以内に開始した同学級セッション数（当該sessionを含む）',
  usage_context_inferred:'同学級の開始時刻の集中度だけから推定した一斉利用らしさ／個別利用らしさ',
  persona_label_condition:'Personaの国等のラベル提示条件',
  country_label_visible:'国ラベル表示の有無',
  accent_label_visible:'アクセント関連ラベル表示の有無',
  flag_visible:'国旗表示の有無',
  help_open_count:'ヘルプを開いた回数',
  vocab_bank_open_count:'語彙バンクを開いた回数',
  speech_rate_change_count:'児童による発話速度変更回数',
  student_selected_speech_rate:'児童が選択したAI音声の再生速度',
  schema_version:'Firestore保存データ構造の版',
  research_schema_version:'正式研究Export構造の版',
  app_version:'アプリのバージョン',
  build:'アプリのビルド識別子',
  session_completed:'対話完了と判定された場合1',
  session_status:'セッション進行・完了状態',
  data_quality_flag:'分析用データ品質区分',
  utterance_id:'発話を一意に識別する匿名ID',
  turn_sequence:'セッション内の発話順',
  speaker_turn_number:'話者ごとの発話順',
  speaker:'発話者',
  local_timestamp:'発話の日本時間日時',
  english_text_anonymized:'個人情報をマスクした英語発話本文',
  japanese_translation:'対応する日本語訳',
  is_question:'質問と判定された場合1',
  question_type:'質問タイプ',
  is_reciprocal_question:'How about you?等の相互的質問の場合1',
  is_repair:'repair表現の場合1',
  is_reason_expression:'理由表現の場合1',
  dictionary_source:'一致した辞書',
  expression_id:'辞書内表現ID',
  expression:'一致した英語表現',
  profile_field:'Personaプロフィール内の項目',
  persona_category:'Persona辞書カテゴリー',
  curriculum_grade:'教科書辞書に対応する学年',
  curriculum_unit:'教科書辞書に対応する単元',
  name:'AI留学生の英語名',
  country:'AI留学生の国',
  gender:'AI留学生Personaの性別',
  city:'出身都市',
  major:'専攻',
  likes:'好きなもの（|区切り）',
  heritage_landmark:'プロフィール上の関連名所',
  profile_text_ja:'児童へ提示する日本語プロフィール文',
  file_name:'変数が格納されるCSVファイル',
  variable:'CSV列名',
  definition:'変数の操作的定義',
  data_type:'CSV上のデータ型',
  allowed_values:'主な値域・カテゴリ',
  analysis_use:'主な分析用途',
};

const ALLOWED_VALUES: Record<string, string> = {
  grade_level:'5 | 6',
  persona_gender:'male | female', gender:'male | female',
  target_duration_minutes:'1 | 2 | 3 | 5',
  topic:'intro | favorites | shizuoka_culture | talents | free',
  reflection_conveyed_ideas:'1 | 3 | 5',
  reflection_understood_partner:'1 | 3 | 5',
  reflection_noticed_language_culture:'1 | 3 | 5',
  usage_context_inferred:'group_like | individual_like | unknown',
  persona_label_condition:'shown | hidden',
  country_label_visible:'0 | 1', accent_label_visible:'0 | 1', flag_visible:'0 | 1', session_completed:'0 | 1',
  student_selected_speech_rate:'0.75–1.25',
  research_schema_version:RESEARCH_EXPORT_SCHEMA_VERSION,
  speaker:'child | ai',
  dictionary_source:'curriculum | persona',
  profile_field:'likes | major | city | landmark',
  persona_category:'interest | major | place',
  curriculum_grade:'5 | 6',
  data_quality_flag:'complete | missing_reflection | interrupted | missing_core',
};

const NUMERIC_FIELDS = new Set([
  'grade_level','lifetime_session_number','daily_session_number','days_since_previous_session','child_total_words',
  'mean_child_words_per_turn','max_child_words_per_turn','child_unique_word_types','child_turn_count','ai_turn_count',
  'dialogue_utterance_count','child_repair_count','child_reason_expression_count','target_duration_minutes','actual_duration_seconds',
  'reflection_conveyed_ideas','reflection_understood_partner','reflection_noticed_language_culture','same_class_starts_5min',
  'same_class_starts_10min','country_label_visible','accent_label_visible','flag_visible','help_open_count','vocab_bank_open_count',
  'speech_rate_change_count','student_selected_speech_rate','schema_version','session_completed','turn_sequence','speaker_turn_number',
  'is_question','is_reciprocal_question','is_repair','is_reason_expression',
]);

function metaFor(file: ResearchExportDatasetName, variable: string) {
  return {
    definition: FIELD_DEFINITION[variable] || variable.replace(/_/g, ' '),
    dataType: NUMERIC_FIELDS.has(variable) ? 'number' : 'string',
    allowedValues: ALLOWED_VALUES[variable] || '',
    analysisUse: FILE_ANALYSIS_USE[file],
  };
}

function buildCodebookRows(): Row[] {
  const rows: Row[] = [];
  for (const file of ['sessions','utterances','expressions','personas'] as ResearchExportDatasetName[]) {
    for (const variable of RESEARCH_EXPORT_HEADERS[file]) {
      const meta = metaFor(file, variable);
      rows.push({
        file_name: `${file}.csv`, variable, definition: meta.definition, data_type: meta.dataType,
        allowed_values: meta.allowedValues, analysis_use: meta.analysisUse,
      });
    }
  }
  for (const variable of RESEARCH_EXPORT_HEADERS.codebook) {
    const meta = metaFor('codebook', variable);
    rows.push({
      file_name: 'codebook.csv', variable, definition: meta.definition, data_type: meta.dataType,
      allowed_values: meta.allowedValues, analysis_use: meta.analysisUse,
    });
  }
  return rows;
}

function eventCountMap(rows: Row[]): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const sessionId = String(row.session_id || '');
    if (!sessionId) continue;
    const map = out.get(sessionId) || new Map<string, number>();
    const type = String(row.event_type || '');
    map.set(type, (map.get(type) || 0) + 1);
    out.set(sessionId, map);
  }
  return out;
}

function personaRows(): Row[] {
  return RESEARCH_PERSONAS.map((persona) => ({
    persona_id: persona.id,
    name: persona.name,
    country: persona.country,
    gender: persona.gender,
    city: persona.city,
    major: persona.major,
    likes: persona.likes.join(' | '),
    heritage_landmark: persona.heritageLandmark || '',
    profile_text_ja: persona.japaneseBio,
  }));
}

export function buildResearchExportDataSets(rawSessions: Record<string, any>[]): ExportDataSets {
  const researchSessions = rawSessions.filter(isResearchTargetSession);
  const raw = buildResearchDataSets(researchSessions);
  const eventCounts = eventCountMap(raw.system_events);
  const turnCounts = new Map<string, { child: number; ai: number }>();
  for (const row of raw.turns) {
    const sessionId = String(row.session_id || '');
    const counts = turnCounts.get(sessionId) || { child: 0, ai: 0 };
    if (row.speaker === 'child') counts.child += 1;
    if (row.speaker === 'ai') counts.ai += 1;
    turnCounts.set(sessionId, counts);
  }

  const sessions = raw.sessions.map((row) => {
    const sessionId = String(row.session_id || '');
    const counts = turnCounts.get(sessionId) || { child: Number(row.child_turn_count || 0), ai: 0 };
    const events = eventCounts.get(sessionId) || new Map<string, number>();
    const copy: Row = {
      ...row,
      research_schema_version: RESEARCH_EXPORT_SCHEMA_VERSION,
      ai_turn_count: counts.ai,
      dialogue_utterance_count: counts.child + counts.ai,
      help_open_count: events.get('help_open') || 0,
      vocab_bank_open_count: events.get('vocab_bank_open') || 0,
      speech_rate_change_count: events.get('speech_rate_change') || 0,
    };
    return Object.fromEntries(RESEARCH_EXPORT_HEADERS.sessions.map((key) => [key, copy[key] ?? '']));
  });

  const sessionById = new Map(sessions.map((row) => [String(row.session_id || ''), row]));
  const utterances = raw.turns.map((row) => {
    const session = sessionById.get(String(row.session_id || '')) || {};
    const copy: Row = {
      ...row,
      utterance_id: `u_${String(row.session_id || '')}_${String(row.turn_sequence || '')}`,
      persona_id: session.persona_id || '',
      topic: session.topic || '',
    };
    return Object.fromEntries(RESEARCH_EXPORT_HEADERS.utterances.map((key) => [key, copy[key] ?? '']));
  });

  const expressions = raw.expressions.map((row) => {
    const copy: Row = {
      ...row,
      utterance_id: `u_${String(row.session_id || '')}_${String(row.turn_sequence || '')}`,
    };
    return Object.fromEntries(RESEARCH_EXPORT_HEADERS.expressions.map((key) => [key, copy[key] ?? '']));
  });

  return {
    sessions,
    utterances,
    expressions,
    personas: personaRows(),
    codebook: buildCodebookRows(),
  };
}

function textQuery(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
function gradeMatches(row: Row, grade: string): boolean {
  if (!grade || grade === 'all') return true;
  const storedClass = String(row.class_id || '');
  if (grade === 'test') return storedClass === 'テスト';
  if (grade === 'reserve') return storedClass === '予備';
  return String(row.grade_level || '') === grade;
}
function classMatches(row: Row, classId: string): boolean {
  if (!classId || classId === 'all') return true;
  const storedClass = String(row.class_id || '');
  if (classId === 'test') return storedClass === 'テスト';
  if (classId === 'reserve') return storedClass === '予備';
  if (['1','2','3'].includes(classId)) return storedClass.endsWith(`-${classId}`);
  return storedClass === classId;
}
function filterSessions(rows: Row[], query: ResearchFilterQuery): Row[] {
  const start = textQuery(query.start);
  const end = textQuery(query.end);
  const classId = textQuery(query.classId);
  const grade = textQuery(query.grade);
  const personaId = textQuery(query.personaId);
  const label = textQuery(query.labelCondition);
  const topic = textQuery(query.topic);
  const completeOnly = String(query.completeOnly || '') === '1';
  return rows.filter((row) => {
    const date = String(row.local_date || '');
    return (!start || date >= start) && (!end || date <= end)
      && classMatches(row, classId) && gradeMatches(row, grade)
      && (!personaId || personaId === 'all' || String(row.persona_id || '') === personaId)
      && (!label || label === 'all' || String(row.persona_label_condition || '') === label)
      && (!topic || topic === 'all' || String(row.topic || '') === topic)
      && (!completeOnly || String(row.data_quality_flag || '') === 'complete');
  });
}

export function filterResearchExportDataSets(data: ExportDataSets, query: ResearchFilterQuery): ExportDataSets {
  const sessions = filterSessions(data.sessions, query);
  const allowed = new Set(sessions.map((row) => String(row.session_id || '')));
  return {
    sessions,
    utterances: data.utterances.filter((row) => allowed.has(String(row.session_id || ''))),
    expressions: data.expressions.filter((row) => allowed.has(String(row.session_id || ''))),
    personas: data.personas,
    codebook: data.codebook,
  };
}

function csvCell(value: unknown): string {
  const numeric = typeof value === 'number' && Number.isFinite(value);
  const original = value === null || value === undefined ? '' : String(value);
  const safe = !numeric && /^\s*[=+\-@]/.test(original) ? `'${original}` : original;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function serializeResearchCsv(rows: Row[], dataset: ResearchExportDatasetName): string {
  const headers = RESEARCH_EXPORT_HEADERS[dataset];
  return '\uFEFF' + [
    headers.map(csvCell).join(','),
    ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(',')),
  ].join('\n');
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
function topicLabel(id: string): string {
  return ({
    intro:'自己紹介・あいさつ', favorites:'好きなもの・すきなこと', shizuoka_culture:'静岡のじまん＆世界の文化',
    talents:'できること・得意なこと', free:'自由トーク・おしゃべり',
  } as Record<string,string>)[id] || id;
}
function localDateTimeMs(value: unknown): number {
  const text = String(value || '').trim();
  if (!text) return 0;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text) ? `${text.replace(' ', 'T')}+09:00` : text;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}
function normalizedCountry(value: unknown): string {
  const raw = String(value || '').trim().toLowerCase().replace(/[._-]/g, ' ').replace(/\s+/g, ' ');
  const aliases: Record<string, string> = {
    'usa':'united states','u s a':'united states','united states of america':'united states',
    'uk':'united kingdom','u k':'united kingdom','great britain':'united kingdom',
    'korea':'south korea','republic of korea':'south korea',
  };
  return aliases[raw] || raw;
}

export function buildResearchDashboardData(rawSessions: Record<string, any>[], query: ResearchFilterQuery = {}) {
  const targetSessions = rawSessions.filter(isResearchTargetSession);
  const allData = buildResearchExportDataSets(targetSessions);
  const data = filterResearchExportDataSets(allData, query);
  const allowedSessionIds = new Set(data.sessions.map((row) => String(row.session_id || '')));
  const technical = buildResearchDataSets(targetSessions);
  const filteredTechnicalEvents = technical.system_events.filter((row) => allowedSessionIds.has(String(row.session_id || '')));
  const filteredTechnicalExpressions = technical.expressions.filter((row) => allowedSessionIds.has(String(row.session_id || '')));

  const participants = new Set(data.sessions.map((row) => String(row.research_id || '')).filter(Boolean));
  const complete = data.sessions.filter((row) => String(row.data_quality_flag || '') === 'complete').length;
  const latestAt = data.sessions.map((row) => String(row.local_ended_at || row.local_started_at || '')).sort().at(-1) || '';
  let totalWords = 0; let totalSeconds = 0;
  for (const row of data.sessions) {
    const words = Number(row.child_total_words);
    const seconds = Number(row.actual_duration_seconds);
    if (Number.isFinite(words) && Number.isFinite(seconds) && seconds > 0) {
      totalWords += words; totalSeconds += seconds;
    }
  }
  const meanChildWordsPerMinute = totalSeconds > 0 ? round(totalWords * 60 / totalSeconds, 1) : 0;

  type SeriesBucket = { sessions:number; words:number[]; childWords:number; durationSeconds:number; reflections:[number[],number[],number[]] };
  const daily = new Map<string, SeriesBucket>();
  const weekly = new Map<string, SeriesBucket>();
  const weekStart = (date: string): string => {
    const parsed = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return date;
    const offset = (parsed.getUTCDay() + 6) % 7;
    parsed.setUTCDate(parsed.getUTCDate() - offset);
    return parsed.toISOString().slice(0, 10);
  };
  const addSeries = (target: Map<string, SeriesBucket>, key: string, row: Row) => {
    const bucket = target.get(key) || { sessions:0, words:[], childWords:0, durationSeconds:0, reflections:[[],[],[]] as [number[],number[],number[]] };
    bucket.sessions += 1;
    const words = Number(row.child_total_words);
    const seconds = Number(row.actual_duration_seconds);
    if (Number.isFinite(words)) bucket.words.push(words);
    if (Number.isFinite(words) && Number.isFinite(seconds) && seconds > 0) {
      bucket.childWords += words; bucket.durationSeconds += seconds;
    }
    [row.reflection_conveyed_ideas,row.reflection_understood_partner,row.reflection_noticed_language_culture].forEach((value, index) => {
      const rating = Number(value);
      if ([1,3,5].includes(rating)) bucket.reflections[index].push(rating);
    });
    target.set(key, bucket);
  };
  for (const row of data.sessions) {
    const date = String(row.local_date || '');
    if (!date) continue;
    addSeries(daily, date, row);
    addSeries(weekly, weekStart(date), row);
  }

  const counts = (key: string) => {
    const map = new Map<string, number>();
    for (const row of data.sessions) {
      const value = String(row[key] || '未設定');
      map.set(value, (map.get(value) || 0) + 1);
    }
    return [...map.entries()].map(([label,value]) => ({ label,value })).sort((a,b) => b.value - a.value || a.label.localeCompare(b.label,'ja'));
  };
  const personaNames = new Map(data.personas.map((row) => [String(row.persona_id), String(row.name)]));
  const personaUsage = counts('persona_id').map((item) => ({ ...item, label: personaNames.get(item.label) || item.label }));

  const topMap = new Map<string, { count:number; source:string }>();
  for (const row of filteredTechnicalExpressions.filter((item) => item.speaker === 'child')) {
    const expression = String(row.expression || '').trim();
    if (!expression) continue;
    const key = `${String(row.dictionary_source || '')}:${expression.toLowerCase()}`;
    const current = topMap.get(key) || { count:0, source:String(row.dictionary_source || '') };
    current.count += 1;
    topMap.set(key, current);
  }
  const topExpressions = [...topMap.entries()]
    .map(([key,value]) => ({ expression:key.split(':').slice(1).join(':'), count:value.count, source:value.source }))
    .sort((a,b) => b.count - a.count)
    .slice(0,10);

  const quality = counts('data_quality_flag');
  let aiFailures = 0; let micErrors = 0; let ttsFallbacks = 0;
  for (const row of filteredTechnicalEvents) {
    const type = String(row.event_type || '');
    const value = String(row.event_value || '');
    if (type === 'ai_request_failure') aiFailures += 1;
    if (type === 'mic_error') micErrors += 1;
    if (type === 'tts_provider' && /device|fallback/i.test(value)) ttsFallbacks += 1;
  }
  const systemQuality = [
    { label:'AI応答失敗', value:aiFailures },
    { label:'マイクエラー', value:micErrors },
    { label:'TTSフォールバック', value:ttsFallbacks },
  ];

  let beforeAnnouncement = 0;
  let afterAnnouncement = 0;
  let afterCountryEligible = 0;
  let afterCountryMatched = 0;
  const configuredParticipants = new Set<string>();
  const individualSessions = data.sessions.filter((row) => row.usage_context_inferred === 'individual_like');
  const groupLikeSessions = data.sessions.filter((row) => row.usage_context_inferred === 'group_like');
  for (const row of data.sessions) {
    const announcedMs = localDateTimeMs(row.assignment_announced_at);
    const startedMs = localDateTimeMs(row.local_started_at);
    if (!announcedMs || !startedMs) continue;
    configuredParticipants.add(String(row.research_id || ''));
    if (startedMs < announcedMs) {
      beforeAnnouncement += 1;
      continue;
    }
    afterAnnouncement += 1;
    const assignedCountry = normalizedCountry(row.assigned_partner_country);
    const personaCountry = normalizedCountry(row.persona_country);
    if (assignedCountry && personaCountry) {
      afterCountryEligible += 1;
      if (assignedCountry === personaCountry) afterCountryMatched += 1;
    }
  }
  const individualDays = new Set(individualSessions.map((row) => `${String(row.research_id || '')}|${String(row.local_date || '')}`).filter((value) => !value.endsWith('|')));
  const individualTotalSeconds = individualSessions.reduce((sum,row) => sum + Math.max(0, Number(row.actual_duration_seconds || 0)), 0);

  const recentSessions = [...data.sessions]
    .sort((a,b) => String(b.local_started_at || '').localeCompare(String(a.local_started_at || '')))
    .slice(0,10)
    .map((row) => ({
      local_started_at:row.local_started_at || '', research_id:row.research_id || '', persona_id:row.persona_id || '',
      persona_name:personaNames.get(String(row.persona_id || '')) || '', topic:topicLabel(String(row.topic || '')),
      target_duration_minutes:row.target_duration_minutes || '', data_quality_flag:row.data_quality_flag || '',
    }));

  const seriesRows = (source: Map<string, SeriesBucket>) => [...source.entries()]
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([date,value]) => ({
      date,
      sessions:value.sessions,
      mean_child_words:round(average(value.words),1),
      mean_child_words_per_minute:value.durationSeconds > 0 ? round(value.childWords * 60 / value.durationSeconds,1) : null,
      reflection_conveyed:value.reflections[0].length ? round(average(value.reflections[0]),2) : null,
      reflection_understood:value.reflections[1].length ? round(average(value.reflections[1]),2) : null,
      reflection_culture:value.reflections[2].length ? round(average(value.reflections[2]),2) : null,
    }));
  const dailyRows = seriesRows(daily);
  const weeklyRows = seriesRows(weekly);
  const aggregation = dailyRows.length > 21 ? 'weekly' : 'daily';
  const chartRows = aggregation === 'weekly' ? weeklyRows : dailyRows;

  return {
    success:true,
    metrics:{
      participantCount:participants.size,
      totalSessions:data.sessions.length,
      childUtteranceCount:data.utterances.filter((row) => row.speaker === 'child').length,
      meanChildWordsPerMinute,
      completeRate:data.sessions.length ? round((complete / data.sessions.length) * 100,1) : 0,
      latestAt,
    },
    researchIndicators:{
      announcementConfiguredParticipants:configuredParticipants.size,
      beforeAnnouncementSessions:beforeAnnouncement,
      afterAnnouncementSessions:afterAnnouncement,
      assignedCountryPersonaEligibleSessions:afterCountryEligible,
      assignedCountryPersonaMatchedSessions:afterCountryMatched,
      assignedCountryPersonaSharePercent:afterCountryEligible ? round(afterCountryMatched * 100 / afterCountryEligible,1) : null,
      individualUseCount:individualSessions.length,
      individualUseDays:individualDays.size,
      individualUseTotalSeconds:individualTotalSeconds,
      groupLikeUseCount:groupLikeSessions.length,
    },
    filters:{
      classes:['1','2','3','test','reserve'],
      grades:['5','6','test','reserve'],
      personas:RESEARCH_PERSONAS.map((persona) => persona.id),
      labelConditions:['shown','hidden'],
      topics:['intro','favorites','shizuoka_culture','talents','free'],
    },
    charts:{ daily:chartRows, aggregation, personas:personaUsage },
    dataQuality:quality,
    systemQuality,
    topExpressions,
    recentSessions,
    exportFiles:([
      ['sessions','sessions.csv','匿名ID・日時・Persona・担当留学生・発話量・振り返り・利用文脈・再現性','縦断・告知前後・担当国選択・専有関連分析'],
      ['utterances','utterances.csv','児童・AIの匿名化された全発話と相互行為フラグ','発話内容・repair・応答性・専有の再判定'],
      ['expressions','expressions.csv','教科書辞書＋Persona辞書への一致表現','内容層・相手志向性の補助分析'],
      ['personas','personas.csv','研究対象20名の固定Personaプロフィール','刺激条件・Persona属性の確認'],
      ['codebook','codebook.csv','全CSV列の定義・型・値域・分析用途','変数理解・共同研究・再現可能性'],
    ] as const).map(([dataset,fileName,contains,analysisUse]) => ({
      dataset,fileName,contains,analysisUse,rowCount:data[dataset as ResearchExportDatasetName].length,
    })),
  };
}
