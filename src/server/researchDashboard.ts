import { AI_STUDENTS_LIST } from '../data/curriculum';
import { getPersonaResearchMetadata, PERSONA_DICTIONARY_VERSION } from '../data/personaResearch';
import { buildResearchDataSets } from './researchExport';

export type ResearchExportDatasetName = 'sessions' | 'utterances' | 'expressions' | 'personas' | 'codebook';
export type ResearchFilterQuery = {
  start?: unknown; end?: unknown; classId?: unknown; grade?: unknown; personaId?: unknown;
  circle?: unknown; labelCondition?: unknown; topic?: unknown; completeOnly?: unknown;
};

type Row = Record<string, unknown>;
type ExportDataSets = Record<ResearchExportDatasetName, Row[]>;

export const RESEARCH_EXPORT_HEADERS: Record<ResearchExportDatasetName, string[]> = {
  sessions: [
    'research_id','class_id','session_id','schema_version','research_schema_version','app_version','build','ai_model',
    'ai_input_tokens','ai_output_tokens','ai_cache_read_tokens','ai_cache_creation_tokens','academic_year','grade_level',
    'local_date','local_start_time','local_end_time','local_started_at','local_ended_at','weekday','weekday_flag','school_hours_flag',
    'same_class_starts_5min','same_class_starts_10min','usage_context_inferred','usage_context_confidence','classification_rule_version',
    'lifetime_session_number','daily_session_number','source_lifetime_session_number','source_daily_session_number','days_since_previous_session',
    'persona_id','persona_country','persona_gender','accent_name','accent_circle','persona_label_condition','country_label_visible',
    'accent_label_visible','flag_visible','tts_provider','tts_voice_name','tts_language_code','persona_voice_gender','persona_voice_pitch',
    'persona_default_voice_rate','student_selected_speech_rate','effective_tts_speech_rate','persona_dictionary_version','ai_student_id','topic',
    'target_duration_minutes','actual_duration_seconds','child_turn_count','ai_turn_count','dialogue_utterance_count','child_total_words','total_turns','total_child_words',
    'mean_child_words_per_turn','max_child_words_per_turn','child_unique_word_types','child_question_count','child_reciprocal_question_count',
    'child_repair_count','child_reason_expression_count','child_curriculum_vocab_count','ai_curriculum_vocab_count',
    'encountered_curriculum_vocab_count','unique_vocabulary_count','legacy_unique_vocabulary_count','reflection_conveyed_ideas','reflection_understood_partner',
    'reflection_noticed_language_culture','system_event_count','ai_request_failure_count','mic_error_count','speech_rate_change_count',
    'help_open_count','vocab_bank_open_count','tts_fallback_count','session_completed','session_status','data_quality_flag'
  ],
  utterances: [
    'research_id','class_id','session_id','utterance_id','academic_year','grade_level','local_date','local_start_time','local_end_time',
    'weekday','usage_context_inferred','turn_sequence','speaker_turn_number','speaker','persona_id','topic','target_duration_minutes',
    'persona_label_condition','accent_circle','local_timestamp','english_text_anonymized','japanese_translation','word_count',
    'is_question','question_type','is_reciprocal_question','is_repair','is_reason_expression'
  ],
  expressions: [
    'research_id','class_id','session_id','utterance_id','academic_year','grade_level','local_date','local_start_time','local_end_time',
    'weekday','usage_context_inferred','turn_sequence','speaker','dictionary_source','expression_id','expression','japanese',
    'expression_category','curriculum_grade','curriculum_unit','persona_id','profile_field','persona_category','persona_dictionary_version'
  ],
  personas: [
    'persona_id','name','japanese_name','country','country_japanese','country_native','gender','age','city','role','major','likes',
    'heritage_landmark','accent_name','world_englishes_circle','tts_voice_name','tts_language_code','voice_gender','voice_pitch',
    'default_voice_rate','profile_text_ja','profile_version','persona_dictionary_version'
  ],
  codebook: ['file_name','variable','definition','data_type','allowed_values','analysis_use']
};

const FILE_ANALYSIS_USE: Record<ResearchExportDatasetName, string> = {
  sessions: '縦断分析、条件比較、発話量・振り返り・AI/TTS条件・データ品質のセッション単位分析',
  utterances: '発話長、質問、repair、語彙多様性、相互行為、CAF等の発話単位分析',
  expressions: '教科書辞書・persona辞書への一致、相手志向性、語彙・内容分析',
  personas: '留学生persona、国・性別・World Englishes・音声条件・提示刺激の再現性確認',
  codebook: '変数定義、値域、再現可能性、共同研究者とのデータ共有'
};

const FIELD_DEFINITION: Record<string, string> = {
  research_id:'児童を直接特定しない研究用匿名ID', class_id:'匿名化された学級ID', session_id:'1対話ごとの一意なセッションID',
  schema_version:'保存データ構造の版', research_schema_version:'研究データ構造の版', app_version:'アプリのバージョン',
  build:'アプリのビルド識別子', ai_model:'当該セッションで実際に観測されたAIモデル', ai_input_tokens:'AI入力token合計',
  ai_output_tokens:'AI出力token合計', ai_cache_read_tokens:'Prompt Cacheから読んだtoken合計', ai_cache_creation_tokens:'Prompt Cache作成token合計',
  academic_year:'日本の学校年度', grade_level:'学年', local_date:'日本時間での実施日', local_start_time:'日本時間での開始時刻',
  local_end_time:'日本時間での終了時刻', local_started_at:'日本時間の開始日時', local_ended_at:'日本時間の終了日時',
  weekday:'実施曜日', weekday_flag:'平日なら1', school_hours_flag:'学校時間帯なら1', same_class_starts_5min:'前後5分以内の同学級開始数',
  same_class_starts_10min:'前後10分以内の同学級開始数', usage_context_inferred:'時間帯と同時開始数から推定した利用文脈',
  usage_context_confidence:'利用文脈推定の確信度', classification_rule_version:'利用文脈推定規則の版',
  lifetime_session_number:'研究用に日時から再計算した通算セッション番号', daily_session_number:'研究用に日時から再計算した当日セッション番号',
  source_lifetime_session_number:'保存時の通算セッション番号', source_daily_session_number:'保存時の当日セッション番号',
  days_since_previous_session:'前回セッションからの日数', persona_id:'AI留学生personaの固定ID', persona_country:'personaの国',
  persona_gender:'personaの性別', accent_name:'personaに設定したアクセント名称', accent_circle:'World EnglishesのInner/Outer/Expanding区分',
  persona_label_condition:'personaの国・アクセント等ラベルの提示条件', country_label_visible:'国ラベル表示の有無',
  accent_label_visible:'アクセントラベル表示の有無', flag_visible:'国旗表示の有無', tts_provider:'実際に観測された音声合成provider',
  tts_voice_name:'Google TTS voice名', tts_language_code:'TTS言語コード', persona_voice_gender:'persona音声設定上の性別',
  persona_voice_pitch:'persona音声pitch設定', persona_default_voice_rate:'persona既定発話速度', student_selected_speech_rate:'児童が設定したAI発話速度',
  effective_tts_speech_rate:'実際にTTSへ適用された発話速度', persona_dictionary_version:'persona辞書の版', ai_student_id:'アプリ内部のAI留学生ID',
  topic:'児童が選択した対話テーマ', target_duration_minutes:'児童が選択した対話時間（分）', actual_duration_seconds:'実際の対話経過時間（秒）',
  child_turn_count:'児童発話数', ai_turn_count:'AI発話数', dialogue_utterance_count:'児童とAIを合計した発話数',
  child_total_words:'児童英語発話の総語数', total_turns:'旧互換の児童発話数', total_child_words:'旧互換の児童総語数', mean_child_words_per_turn:'児童1発話あたり平均語数', max_child_words_per_turn:'児童1発話の最大語数',
  child_unique_word_types:'児童発話に出現した異なり語数', child_question_count:'児童の質問発話数',
  child_reciprocal_question_count:'How about you?等の相互的質問数', child_repair_count:'聞き返し・理解困難表現等のrepair数',
  child_reason_expression_count:'because等の理由表現数', child_curriculum_vocab_count:'児童発話に一致した教科書辞書語彙数',
  ai_curriculum_vocab_count:'AI発話に一致した教科書辞書語彙数', encountered_curriculum_vocab_count:'児童・AIを通じて一致した教科書辞書語彙数',
  unique_vocabulary_count:'研究用に再計算した教科書辞書一致語彙数', legacy_unique_vocabulary_count:'保存時に保持された旧互換語彙数', reflection_conveyed_ideas:'自分の考えを伝える振り返り（1/3/5）',
  reflection_understood_partner:'相手の話を聞いて分かる振り返り（1/3/5）',
  reflection_noticed_language_culture:'新しい言葉や文化に気づいた振り返り（1/3/5）', system_event_count:'保存された研究用システムイベント総数',
  ai_request_failure_count:'AIリクエスト失敗イベント数', mic_error_count:'音声認識エラーイベント数', speech_rate_change_count:'児童による発話速度変更回数',
  help_open_count:'ヘルプを開いた回数', vocab_bank_open_count:'語彙バンクを開いた回数', tts_fallback_count:'端末音声等のTTS fallback観測回数',
  session_completed:'対話完了と判定された場合1', session_status:'セッション進行・完了状態', data_quality_flag:'分析用データ品質区分',
  utterance_id:'発話を一意に識別する匿名ID', turn_sequence:'セッション内の発話順', speaker_turn_number:'話者ごとの発話順',
  speaker:'発話者（child/ai）', local_timestamp:'発話の日本時間日時', english_text_anonymized:'個人情報をマスクした英語発話本文',
  japanese_translation:'対応する日本語訳', word_count:'英語発話語数', is_question:'質問と判定された場合1', question_type:'質問タイプ',
  is_reciprocal_question:'相互的質問の場合1', is_repair:'repair表現の場合1', is_reason_expression:'理由表現の場合1',
  dictionary_source:'一致した辞書（curriculum/persona）', expression_id:'辞書内表現ID', expression:'一致した英語表現',
  japanese:'表現の日本語', expression_category:'表現カテゴリー', curriculum_grade:'教科書辞書に対応する学年',
  curriculum_unit:'教科書辞書に対応する単元', profile_field:'personaプロフィール内の項目（likes/major）',
  persona_category:'persona辞書カテゴリー', name:'AI留学生の英語名', japanese_name:'AI留学生の日本語表記',
  country:'AI留学生の国', country_japanese:'国の日本語表記', country_native:'国の現地語表記', gender:'AI留学生personaの性別',
  age:'AI留学生personaの年齢', city:'出身都市', role:'personaの役割', major:'専攻', likes:'好きなもの（|区切り）',
  heritage_landmark:'プロフィール上の関連名所', world_englishes_circle:'World Englishes区分', voice_gender:'音声設定上の性別',
  voice_pitch:'音声pitch', default_voice_rate:'既定発話速度', profile_text_ja:'児童へ提示する日本語プロフィール文',
  profile_version:'プロフィール文の版', file_name:'変数が格納されるCSVファイル', variable:'CSV列名', definition:'変数の操作的定義',
  data_type:'CSV上のデータ型', allowed_values:'主な値域・カテゴリ', analysis_use:'主な分析用途'
};

const ALLOWED_VALUES: Record<string, string> = {
  accent_circle:'Inner | Outer | Expanding', world_englishes_circle:'Inner | Outer | Expanding',
  persona_label_condition:'shown | hidden', speaker:'child | ai', dictionary_source:'curriculum | persona',
  persona_gender:'male | female', gender:'male | female', persona_voice_gender:'male | female', voice_gender:'male | female',
  grade_level:'5 | 6', curriculum_grade:'5 | 6', target_duration_minutes:'1 | 2 | 3 | 5',
  topic:'intro | favorites | shizuoka_culture | talents | free', profile_field:'likes | major', persona_category:'interest | major',
  student_selected_speech_rate:'0.75–1.25', effective_tts_speech_rate:'0.75–1.25',
  reflection_conveyed_ideas:'1 | 3 | 5', reflection_understood_partner:'1 | 3 | 5',
  reflection_noticed_language_culture:'1 | 3 | 5', data_quality_flag:'complete | missing_reflection | interrupted | missing_core',
  session_status:'complete | dialogue_complete | in_progress_or_interrupted',
  usage_context_inferred:'in_class | out_of_class_school_hours | out_of_school_hours | non_school_day | unknown',
  usage_context_confidence:'high | medium | low', country_label_visible:'0 | 1', accent_label_visible:'0 | 1', flag_visible:'0 | 1',
  weekday_flag:'0 | 1', school_hours_flag:'0 | 1', session_completed:'0 | 1', is_question:'0 | 1',
  is_reciprocal_question:'0 | 1', is_repair:'0 | 1', is_reason_expression:'0 | 1'
};

function csvCell(value: unknown): string {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}
function isNumericField(variable: string): boolean {
  return variable === 'schema_version' || /(_count|_tokens|_number|_seconds|_minutes|_rate|_pitch|_year|_level|_flag|_visible|_words|_types|_turns|_completed|starts_|word_count|turn_sequence|speaker_turn_number|days_since|age$|^reflection_)/.test(variable);
}
function metaFor(file: ResearchExportDatasetName, variable: string) {
  return {
    definition: FIELD_DEFINITION[variable] || variable.replace(/_/g, ' '),
    dataType: isNumericField(variable) ? 'number' : 'string',
    allowedValues: ALLOWED_VALUES[variable] || '',
    analysisUse: FILE_ANALYSIS_USE[file],
  };
}
function buildCodebookRows(): Row[] {
  const rows: Row[] = [];
  for (const file of ['sessions','utterances','expressions','personas'] as ResearchExportDatasetName[]) {
    for (const variable of RESEARCH_EXPORT_HEADERS[file]) {
      const meta = metaFor(file, variable);
      rows.push({ file_name: `${file}.csv`, variable, definition: meta.definition, data_type: meta.dataType, allowed_values: meta.allowedValues, analysis_use: meta.analysisUse });
    }
  }
  for (const variable of RESEARCH_EXPORT_HEADERS.codebook) {
    const meta = metaFor('codebook', variable);
    rows.push({ file_name:'codebook.csv', variable, definition:meta.definition, data_type:meta.dataType, allowed_values:meta.allowedValues, analysis_use:meta.analysisUse });
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
    const value = String(row.event_value || '');
    map.set(type, (map.get(type) || 0) + 1);
    if (type === 'tts_provider' && /device|browser|speech/i.test(value)) map.set('tts_fallback', (map.get('tts_fallback') || 0) + 1);
    out.set(sessionId, map);
  }
  return out;
}

function personaRows(): Row[] {
  return AI_STUDENTS_LIST.map((persona) => {
    const meta = getPersonaResearchMetadata(persona.id);
    return {
      persona_id: persona.id, name: persona.name, japanese_name: persona.japaneseName, country: persona.country,
      country_japanese: persona.countryJapanese, country_native: persona.countryNative, gender: persona.gender, age: persona.age,
      city: persona.city, role: persona.role, major: persona.major, likes: persona.likes.join(' | '),
      heritage_landmark: persona.heritageLandmark || '', accent_name: persona.accentName, world_englishes_circle: persona.worldEnglishesCircle,
      tts_voice_name: meta.voiceName, tts_language_code: meta.voiceLanguageCode, voice_gender: persona.voiceGender,
      voice_pitch: persona.voicePitch, default_voice_rate: persona.voiceRate, profile_text_ja: persona.japaneseBio,
      profile_version: PERSONA_DICTIONARY_VERSION, persona_dictionary_version: PERSONA_DICTIONARY_VERSION,
    };
  });
}

export function buildResearchExportDataSets(rawSessions: Record<string, any>[]): ExportDataSets {
  const raw = buildResearchDataSets(rawSessions);
  const events = eventCountMap(raw.system_events);
  const turnCounts = new Map<string, { child: number; ai: number }>();
  for (const row of raw.turns) {
    const id = String(row.session_id || '');
    const counts = turnCounts.get(id) || { child: 0, ai: 0 };
    if (row.speaker === 'child') counts.child += 1;
    if (row.speaker === 'ai') counts.ai += 1;
    turnCounts.set(id, counts);
  }
  const sessions = raw.sessions.map((row) => {
    const id = String(row.session_id || '');
    const event = events.get(id) || new Map<string, number>();
    const counts = turnCounts.get(id) || { child: Number(row.child_turn_count || 0), ai: 0 };
    const copy: Row = {
      ...row,
      ai_turn_count: counts.ai,
      dialogue_utterance_count: counts.child + counts.ai,
      ai_request_failure_count: event.get('ai_request_failure') || 0,
      mic_error_count: event.get('mic_error') || 0,
      speech_rate_change_count: event.get('speech_rate_change') || 0,
      help_open_count: event.get('help_open') || 0,
      vocab_bank_open_count: event.get('vocab_bank_open') || 0,
      tts_fallback_count: event.get('tts_fallback') || 0,
    };
    return Object.fromEntries(RESEARCH_EXPORT_HEADERS.sessions.map((key) => [key, copy[key] ?? '']));
  });
  const sessionById = new Map(sessions.map((row) => [String(row.session_id || ''), row]));
  const utterances = raw.turns.map((row) => {
    const session = sessionById.get(String(row.session_id || '')) || {};
    const copy: Row = {
      ...row,
      utterance_id: `u_${String(row.session_id || '')}_${String(row.turn_sequence || '')}`,
      persona_id: session.persona_id || '', topic: session.topic || '', target_duration_minutes: session.target_duration_minutes || '',
      persona_label_condition: session.persona_label_condition || '', accent_circle: session.accent_circle || '',
    };
    return Object.fromEntries(RESEARCH_EXPORT_HEADERS.utterances.map((key) => [key, copy[key] ?? '']));
  });
  const expressions = raw.expressions.map((row) => {
    const copy: Row = { ...row, utterance_id: `u_${String(row.session_id || '')}_${String(row.turn_sequence || '')}` };
    return Object.fromEntries(RESEARCH_EXPORT_HEADERS.expressions.map((key) => [key, copy[key] ?? '']));
  });
  return { sessions, utterances, expressions, personas: personaRows(), codebook: buildCodebookRows() };
}

function textQuery(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
function gradeMatches(row: Row, grade: string): boolean {
  if (!grade || grade === 'all') return true;
  const storedClass=String(row.class_id || '');
  if (grade === 'test') return storedClass === 'テスト';
  if (grade === 'reserve') return storedClass === '予備';
  return String(row.grade_level || '') === grade;
}
function classMatches(row: Row, classId: string): boolean {
  if (!classId || classId === 'all') return true;
  const storedClass=String(row.class_id || '');
  if (classId === 'test') return storedClass === 'テスト';
  if (classId === 'reserve') return storedClass === '予備';
  if (['1','2','3'].includes(classId)) return storedClass.endsWith(`-${classId}`);
  return storedClass === classId;
}
function filterSessions(rows: Row[], query: ResearchFilterQuery): Row[] {
  const start=textQuery(query.start), end=textQuery(query.end), classId=textQuery(query.classId), grade=textQuery(query.grade);
  const personaId=textQuery(query.personaId), circle=textQuery(query.circle), label=textQuery(query.labelCondition), topic=textQuery(query.topic);
  const completeOnly=String(query.completeOnly || '') === '1';
  return rows.filter((row) => {
    const date=String(row.local_date || '');
    return (!start || date >= start) && (!end || date <= end)
      && classMatches(row,classId) && gradeMatches(row,grade)
      && (!personaId || personaId === 'all' || String(row.persona_id || '') === personaId)
      && (!circle || circle === 'all' || String(row.accent_circle || '') === circle)
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

export function serializeResearchCsv(rows: Row[], dataset: ResearchExportDatasetName): string {
  const headers = RESEARCH_EXPORT_HEADERS[dataset];
  return '\uFEFF' + [headers.map(csvCell).join(','), ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(','))].join('\n');
}

function round(value: number, digits = 2): number {
  const f = 10 ** digits; return Math.round(value * f) / f;
}
function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
function topicLabel(id: string): string {
  return ({ intro:'自己紹介・あいさつ', favorites:'好きなもの・すきなこと', shizuoka_culture:'静岡のじまん＆世界の文化', talents:'できること・得意なこと', free:'自由トーク・おしゃべり' } as Record<string,string>)[id] || id;
}

export function buildResearchDashboardData(rawSessions: Record<string, any>[], query: ResearchFilterQuery = {}) {
  const all = buildResearchExportDataSets(rawSessions);
  const data = filterResearchExportDataSets(all, query);
  const participants = new Set(data.sessions.map((row) => String(row.research_id || '')).filter(Boolean));
  const complete = data.sessions.filter((row) => String(row.data_quality_flag || '') === 'complete').length;
  const latestAt = data.sessions.map((row) => String(row.local_ended_at || row.local_started_at || '')).sort().at(-1) || '';
  let rateWords=0,rateSeconds=0; for(const row of data.sessions){const words=Number(row.child_total_words),seconds=Number(row.actual_duration_seconds);if(Number.isFinite(words)&&Number.isFinite(seconds)&&seconds>0){rateWords+=words;rateSeconds+=seconds;}}
  const meanChildWordsPerMinute=rateSeconds>0?round(rateWords*60/rateSeconds,1):0;
  type SeriesBucket={sessions:number;words:number[];childWords:number;durationSeconds:number;reflections:[number[],number[],number[]]};
  const daily = new Map<string, SeriesBucket>();
  const weekly = new Map<string, SeriesBucket>();
  const weekStart=(date:string):string=>{const d=new Date(`${date}T00:00:00Z`);if(Number.isNaN(d.getTime()))return date;const offset=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-offset);return d.toISOString().slice(0,10);};
  const addSeries=(target:Map<string,SeriesBucket>,key:string,row:Row)=>{const d=target.get(key)||{sessions:0,words:[],childWords:0,durationSeconds:0,reflections:[[],[],[]]};d.sessions+=1;const words=Number(row.child_total_words),seconds=Number(row.actual_duration_seconds);if(Number.isFinite(words))d.words.push(words);if(Number.isFinite(words)&&Number.isFinite(seconds)&&seconds>0){d.childWords+=words;d.durationSeconds+=seconds;}const refs=[row.reflection_conveyed_ideas,row.reflection_understood_partner,row.reflection_noticed_language_culture];refs.forEach((value,index)=>{const n=Number(value);if([1,3,5].includes(n))d.reflections[index].push(n)});target.set(key,d);};
  for (const row of data.sessions) {
    const date = String(row.local_date || '');
    if (!date) continue;
    addSeries(daily,date,row);addSeries(weekly,weekStart(date),row);
  }
  const counts = (key: string) => {
    const map = new Map<string,number>();
    for (const row of data.sessions) { const value=String(row[key] || '未設定'); map.set(value,(map.get(value)||0)+1); }
    return [...map.entries()].map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value || a.label.localeCompare(b.label,'ja'));
  };
  const personaNames = new Map(data.personas.map((row)=>[String(row.persona_id),String(row.name)]));
  const personaUsage = counts('persona_id').map((item)=>({ ...item, label: personaNames.get(item.label) || item.label }));
  const topMap = new Map<string,{count:number,source:string}>();
  for (const row of data.expressions.filter((r)=>r.speaker==='child')) {
    const expression=String(row.expression||'').trim(); if(!expression) continue;
    const key=`${String(row.dictionary_source||'')}:${expression.toLowerCase()}`;
    const current=topMap.get(key)||{count:0,source:String(row.dictionary_source||'')}; current.count+=1; topMap.set(key,current);
  }
  const topExpressions=[...topMap.entries()].map(([key,v])=>({expression:key.split(':').slice(1).join(':'),count:v.count,source:v.source})).sort((a,b)=>b.count-a.count).slice(0,10);
  const quality = counts('data_quality_flag');
  const sumField = (key: string) => data.sessions.reduce((sum,row)=>sum+Number(row[key]||0),0);
  const systemQuality=[
    { label:'AI応答失敗', value:sumField('ai_request_failure_count') },
    { label:'マイクエラー', value:sumField('mic_error_count') },
    { label:'TTSフォールバック', value:sumField('tts_fallback_count') },
  ];
  const recentSessions = [...data.sessions].sort((a,b)=>String(b.local_started_at||'').localeCompare(String(a.local_started_at||''))).slice(0,10).map((row)=>({
    local_started_at:row.local_started_at||'', research_id:row.research_id||'', persona_id:row.persona_id||'', persona_name:personaNames.get(String(row.persona_id||''))||'',
    topic:topicLabel(String(row.topic||'')), target_duration_minutes:row.target_duration_minutes||'', data_quality_flag:row.data_quality_flag||''
  }));
  const seriesRows=(source:Map<string,SeriesBucket>)=>[...source.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([date,value])=>({
    date, sessions:value.sessions, mean_child_words:round(average(value.words),1),
    mean_child_words_per_minute:value.durationSeconds>0?round(value.childWords*60/value.durationSeconds,1):null,
    reflection_conveyed:value.reflections[0].length?round(average(value.reflections[0]),2):null,
    reflection_understood:value.reflections[1].length?round(average(value.reflections[1]),2):null,
    reflection_culture:value.reflections[2].length?round(average(value.reflections[2]),2):null,
  }));
  const dailyRows=seriesRows(daily),weeklyRows=seriesRows(weekly),aggregation=dailyRows.length>21?'weekly':'daily';
  const chartRows=aggregation==='weekly'?weeklyRows:dailyRows;
  return {
    success:true,
    metrics:{
      participantCount:participants.size, totalSessions:data.sessions.length,
      childUtteranceCount:data.utterances.filter((row)=>row.speaker==='child').length, meanChildWordsPerMinute,
      completeRate:data.sessions.length?round((complete/data.sessions.length)*100,1):0, latestAt,
    },
    filters:{
      classes:['1','2','3','test','reserve'], grades:['5','6','test','reserve'], personas:AI_STUDENTS_LIST.map((persona)=>persona.id),
      circles:['Inner','Outer','Expanding'], labelConditions:['shown','hidden'], topics:['intro','favorites','shizuoka_culture','talents','free'],
    },
    charts:{ daily:chartRows, aggregation, personas:personaUsage, circles:counts('accent_circle') },
    dataQuality:quality,
    systemQuality,
    topExpressions,
    recentSessions,
    exportFiles:([
      ['sessions','sessions.csv','セッション基本情報・研究条件・振り返り・システム品質','縦断・条件比較・振り返り・発話量分析'],
      ['utterances','utterances.csv','児童・AIの匿名化された全発話','発話・相互行為・CAF・repair分析'],
      ['expressions','expressions.csv','教科書辞書＋persona辞書への一致表現','語彙・相手志向性・内容分析'],
      ['personas','personas.csv','9人の固定persona・国・性別・World Englishes・音声条件','刺激条件の確認・属性比較・再現性'],
      ['codebook','codebook.csv','全CSV列の定義・型・値域・分析用途','変数理解・共同研究・再現可能性'],
    ] as const).map(([dataset,fileName,contains,analysisUse])=>({dataset,fileName,contains,analysisUse,rowCount:data[dataset as ResearchExportDatasetName].length})),
  };
}
