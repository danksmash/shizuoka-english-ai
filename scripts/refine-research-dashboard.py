from pathlib import Path

root=Path('.')

p=root/'src/server/researchDashboard.ts'
s=p.read_text(encoding='utf-8')
old="""const ALLOWED_VALUES: Record<string, string> = {
  accent_circle:'Inner | Outer | Expanding', world_englishes_circle:'Inner | Outer | Expanding',
  persona_label_condition:'shown | hidden', speaker:'child | ai', dictionary_source:'curriculum | persona',
  reflection_conveyed_ideas:'1 | 3 | 5', reflection_understood_partner:'1 | 3 | 5',
  reflection_noticed_language_culture:'1 | 3 | 5', data_quality_flag:'complete | missing_reflection | interrupted | missing_core',
  session_status:'complete | dialogue_complete | in_progress_or_interrupted',
  usage_context_inferred:'in_class | out_of_class_school_hours | out_of_school_hours | non_school_day | unknown',
  usage_context_confidence:'high | medium | low', country_label_visible:'0 | 1', accent_label_visible:'0 | 1', flag_visible:'0 | 1',
  session_completed:'0 | 1', is_question:'0 | 1', is_reciprocal_question:'0 | 1', is_repair:'0 | 1', is_reason_expression:'0 | 1'
};"""
new="""const ALLOWED_VALUES: Record<string, string> = {
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
};"""
if old not in s: raise SystemExit('ALLOWED_VALUES anchor not found')
s=s.replace(old,new,1)
old="return /(_count|_tokens|_number|_seconds|_minutes|_rate|_pitch|_year|_level|_flag|_visible|_words|_types|_turns|_completed|starts_|word_count|turn_sequence|speaker_turn_number|days_since|age$|^reflection_)/.test(variable);"
new="return variable === 'schema_version' || /(_count|_tokens|_number|_seconds|_minutes|_rate|_pitch|_year|_level|_flag|_visible|_words|_types|_turns|_completed|starts_|word_count|turn_sequence|speaker_turn_number|days_since|age$|^reflection_)/.test(variable);"
if old not in s: raise SystemExit('numeric anchor not found')
s=s.replace(old,new,1)
old="const latestAt = data.sessions.map((row) => String(row.local_started_at || '')).sort().at(-1) || '';"
new="const latestAt = data.sessions.map((row) => String(row.local_ended_at || row.local_started_at || '')).sort().at(-1) || '';"
if old not in s: raise SystemExit('latest anchor not found')
s=s.replace(old,new,1)
old="const quality = counts('data_quality_flag');"
new="""const quality = counts('data_quality_flag');
  const sumField = (key: string) => data.sessions.reduce((sum,row)=>sum+Number(row[key]||0),0);
  quality.push(
    { label:'AI request failure', value:sumField('ai_request_failure_count') },
    { label:'Mic error', value:sumField('mic_error_count') },
    { label:'TTS fallback', value:sumField('tts_fallback_count') },
  );"""
if old not in s: raise SystemExit('quality anchor not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

p=root/'src/server/managementPage.ts'
s=p.read_text(encoding='utf-8')
for old,new in [
  ('<span>正常保存率</span>','<span>完全ケース率</span>'),
  ('<span>最終データ受信</span>','<span>最終セッション日時</span>'),
  ('児童発話語数の推移（平均）','1セッションあたり児童総語数（平均）'),
]:
  if old not in s: raise SystemExit('management label anchor not found: '+old)
  s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

p=root/'server.ts'
s=p.read_text(encoding='utf-8')
old="""    const datasets=filterResearchExportDataSets(buildResearchExportDataSets(await getAllSessionsForManagement()),req.query);
    const csv=serializeResearchCsv(datasets[dataset],dataset);"""
new="""    const sourceSessions=(dataset==='personas'||dataset==='codebook')?[]:await getAllSessionsForManagement();
    const datasets=filterResearchExportDataSets(buildResearchExportDataSets(sourceSessions),req.query);
    const csv=serializeResearchCsv(datasets[dataset],dataset);"""
if old not in s: raise SystemExit('CSV optimization anchor not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

p=root/'scripts/qa-research-export-complete.ts'
s=p.read_text(encoding='utf-8')
anchor="assert.ok(dashboard.exportFiles.length===5);"
insert="""assert.ok(dashboard.exportFiles.length===5);
assert.ok(dashboard.dataQuality.some((r)=>r.label==='AI request failure'&&r.value===1),'dashboard must expose AI failure quality events');
assert.ok(dashboard.dataQuality.some((r)=>r.label==='Mic error'&&r.value===1),'dashboard must expose microphone error quality events');
assert.ok(dashboard.dataQuality.some((r)=>r.label==='TTS fallback'&&r.value===1),'dashboard must expose TTS fallback quality events');
const schemaCodebook=data.codebook.find((r)=>r.file_name==='sessions.csv'&&r.variable==='schema_version')!;
assert.equal(schemaCodebook.data_type,'number','schema_version must be typed as numeric in codebook');
const rateCodebook=data.codebook.find((r)=>r.file_name==='sessions.csv'&&r.variable==='student_selected_speech_rate')!;
assert.equal(rateCodebook.allowed_values,'0.75–1.25','speech rate range must be documented in codebook');"""
if anchor not in s: raise SystemExit('QA dashboard anchor not found')
s=s.replace(anchor,insert,1)
anchor="assert.ok(server.includes('/api/management/research.dashboard'),'dashboard endpoint missing');"
insert="""assert.ok(server.includes('/api/management/research.dashboard'),'dashboard endpoint missing');
assert.ok(server.includes("(dataset==='personas'||dataset==='codebook')?[]:await getAllSessionsForManagement()"),'static persona/codebook downloads must not scan all Firestore sessions');"""
if anchor not in s: raise SystemExit('QA server anchor not found')
s=s.replace(anchor,insert,1)
p.write_text(s,encoding='utf-8')

print('final research dashboard refinements applied')
