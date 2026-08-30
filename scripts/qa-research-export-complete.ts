import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildResearchDashboardData, buildResearchExportDataSets, filterResearchExportDataSets, RESEARCH_EXPORT_HEADERS, serializeResearchCsv } from '../src/server/researchDashboard';

const base = Date.parse('2026-09-03T01:00:00Z');
const sessions = [
  {
    schemaVersion:4,researchSchemaVersion:'research-2026-v1',researchId:'R100001',classId:'5-1',sessionId:'session_alpha',
    aiStudentId:'emma_usa',personaId:'emma_usa',topic:'favorites',targetDurationMinutes:2,actualDurationSeconds:120,
    startedAt:new Date(base).toISOString(),endedAt:new Date(base+120000).toISOString(),appVersion:'1.0.7',build:'abc123',aiModel:'claude-sonnet-5',
    aiInputTokens:110,aiOutputTokens:44,aiCacheReadTokens:80,aiCacheCreationTokens:20,personaCountry:'United States',personaGender:'female',
    personaAccentName:'General American',worldEnglishesCircle:'Inner',personaLabelCondition:'shown',countryLabelVisible:true,accentLabelVisible:true,flagVisible:true,
    ttsProvider:'google-chirp3-hd',ttsVoiceName:'en-US-Chirp3-HD-Aoede',ttsLanguageCode:'en-US',personaVoiceGender:'female',personaVoicePitch:1,
    personaDefaultVoiceRate:1,studentSelectedSpeechRate:1.1,effectiveTtsSpeechRate:1.1,personaDictionaryVersion:'persona-profile-v1',
    history:[
      {id:'a1',sender:'ai',englishText:'I like surfing and burgers. What do you like?',japaneseText:'私はサーフィンとハンバーガーが好きです。あなたは？',timestamp:base},
      {id:'c1',sender:'child',englishText:"I'm Taro. I like surfing too. How about you?",japaneseText:'私は太郎です。サーフィンも好きです。あなたは？',timestamp:base+30000},
      {id:'a2',sender:'ai',englishText:'I like surfing too.',japaneseText:'私もサーフィンが好きです。',timestamp:base+50000},
      {id:'c2',sender:'child',englishText:'Pardon? I like burgers because they are good.',japaneseText:'もう一度お願いします。ハンバーガーが好きです。',timestamp:base+80000},
    ],
    reflection:{conveyedIdeas:5,understoodPartner:3,noticedLanguageCulture:5},
    systemEvents:[
      {type:'session_start',timestamp:base},{type:'speech_rate_change',timestamp:base+10000,value:'1.10'},
      {type:'help_open',timestamp:base+15000},{type:'vocab_bank_open',timestamp:base+16000},
      {type:'tts_provider',timestamp:base+20000,value:'google-chirp3-hd'},{type:'session_finish',timestamp:base+119000},
    ],
  },
  {
    schemaVersion:4,researchSchemaVersion:'research-2026-v1',researchId:'R100002',classId:'6-2',sessionId:'session_beta',
    aiStudentId:'rahul_bangladesh',personaId:'rahul_bangladesh',topic:'shizuoka_culture',targetDurationMinutes:1,actualDurationSeconds:60,
    startedAt:new Date(base+86400000).toISOString(),endedAt:new Date(base+86460000).toISOString(),appVersion:'1.0.7',build:'abc123',aiModel:'claude-sonnet-5',
    aiInputTokens:90,aiOutputTokens:30,aiCacheReadTokens:0,aiCacheCreationTokens:30,worldEnglishesCircle:'Outer',personaLabelCondition:'hidden',
    countryLabelVisible:false,accentLabelVisible:false,flagVisible:false,studentSelectedSpeechRate:.9,effectiveTtsSpeechRate:.9,
    history:[
      {id:'a3',sender:'ai',englishText:'I study tea science.',japaneseText:'私はお茶の研究をしています。',timestamp:base+86400000},
      {id:'c3',sender:'child',englishText:'I like green tea.',japaneseText:'私は緑茶が好きです。',timestamp:base+86430000},
    ],
    reflection:null,
    systemEvents:[
      {type:'session_start',timestamp:base+86400000},{type:'ai_request_failure',timestamp:base+86410000,value:'503'},
      {type:'mic_error',timestamp:base+86420000,value:'network'},{type:'tts_provider',timestamp:base+86425000,value:'device-speech-synthesis'},
      {type:'session_finish',timestamp:base+86459000},
    ],
  },
];

const data = buildResearchExportDataSets(sessions as any);
assert.deepEqual(Object.keys(data).sort(), ['codebook','expressions','personas','sessions','utterances'].sort(), 'exactly five research CSV datasets must be produced');
assert.equal(data.sessions.length,2);
assert.equal(data.personas.length,9,'all nine fixed personas must be exported');
assert.ok(data.utterances.length>=6,'all child and AI utterances must be preserved');

for (const dataset of ['sessions','utterances','expressions','personas','codebook'] as const) {
  const expected = RESEARCH_EXPORT_HEADERS[dataset];
  assert.ok(expected.length>0, dataset+' headers missing');
  for (const row of data[dataset]) assert.deepEqual(Object.keys(row), expected, dataset+' column order/schema drift detected');
  const csv=serializeResearchCsv(data[dataset],dataset);
  assert.ok(csv.startsWith('\uFEFF'),dataset+' CSV must have UTF-8 BOM for Excel compatibility');
  const headerLine=csv.slice(1).split('\n')[0];
  for (const header of expected) assert.ok(headerLine.includes('"'+header+'"'),dataset+' CSV header missing '+header);
  assert.equal(csv.split('\n').length,data[dataset].length+1,dataset+' CSV row count must exactly match dataset rows');
}

const alpha=data.sessions.find((r)=>r.session_id==='session_alpha')!;
assert.equal(alpha.persona_id,'emma_usa');
assert.equal(alpha.persona_country,'United States');
assert.equal(alpha.persona_gender,'female');
assert.equal(alpha.accent_circle,'Inner');
assert.equal(alpha.persona_label_condition,'shown');
assert.equal(alpha.student_selected_speech_rate,1.1);
assert.equal(alpha.effective_tts_speech_rate,1.1);
assert.equal(alpha.ai_model,'claude-sonnet-5');
assert.equal(alpha.reflection_conveyed_ideas,5);
assert.equal(alpha.reflection_understood_partner,3);
assert.equal(alpha.reflection_noticed_language_culture,5);
assert.equal(alpha.speech_rate_change_count,1);
assert.equal(alpha.help_open_count,1);
assert.equal(alpha.vocab_bank_open_count,1);
assert.equal(alpha.ai_turn_count,2);
assert.equal(alpha.dialogue_utterance_count,4);

const beta=data.sessions.find((r)=>r.session_id==='session_beta')!;
assert.equal(beta.accent_circle,'Outer');
assert.equal(beta.persona_label_condition,'hidden');
assert.equal(beta.country_label_visible,0);
assert.equal(beta.accent_label_visible,0);
assert.equal(beta.flag_visible,0);
assert.equal(beta.ai_request_failure_count,1);
assert.equal(beta.mic_error_count,1);
assert.equal(beta.tts_fallback_count,1);
assert.equal(beta.data_quality_flag,'missing_reflection');

const childAlpha=data.utterances.find((r)=>r.session_id==='session_alpha'&&r.speaker==='child')!;
assert.ok(String(childAlpha.utterance_id).startsWith('u_session_alpha_'));
assert.equal(childAlpha.persona_id,'emma_usa');
assert.equal(childAlpha.topic,'favorites');
assert.equal(String(childAlpha.english_text_anonymized).includes('Taro'),false,'child name must never appear in utterances.csv');
assert.ok(Number(childAlpha.word_count)>0);
assert.ok(data.utterances.every((row)=>data.sessions.some((session)=>session.session_id===row.session_id)),'every utterance must link to sessions.csv');

assert.ok(data.expressions.some((r)=>r.dictionary_source==='persona'&&String(r.expression).toLowerCase().includes('surfing')),'persona likes must flow to expressions.csv');
assert.ok(data.expressions.some((r)=>r.dictionary_source==='persona'&&r.profile_field==='major'),'persona major dictionary must flow to expressions.csv when mentioned');
assert.ok(data.expressions.every((row)=>data.utterances.some((u)=>u.utterance_id===row.utterance_id)),'every expression must link to utterances.csv');

const personaIds=new Set(data.personas.map((r)=>String(r.persona_id)));
assert.equal(personaIds.size,9);
for(const row of data.personas){
  assert.ok(row.country);assert.ok(row.gender);assert.ok(['Inner','Outer','Expanding'].includes(String(row.world_englishes_circle)));
  assert.ok(row.tts_voice_name);assert.ok(row.tts_language_code);assert.ok(row.profile_text_ja);assert.ok(row.persona_dictionary_version);
}
assert.ok(data.personas.some((r)=>r.persona_id==='emma_usa'&&String(r.likes).toLowerCase().includes('surfing')),'persona likes must be fixed master data');

const codebookPairs=new Set(data.codebook.map((r)=>String(r.file_name)+'|'+String(r.variable)));
for(const dataset of ['sessions','utterances','expressions','personas','codebook'] as const){
  for(const variable of RESEARCH_EXPORT_HEADERS[dataset]){
    assert.ok(codebookPairs.has(dataset+'.csv|'+variable),'codebook missing '+dataset+'.csv '+variable);
  }
}
for(const row of data.codebook){assert.ok(String(row.definition).trim());assert.ok(String(row.data_type).trim());assert.ok(String(row.analysis_use).trim());}

const filtered=filterResearchExportDataSets(data,{classId:'5-1',personaId:'emma_usa',circle:'Inner',labelCondition:'shown',topic:'favorites',completeOnly:'1'});
assert.equal(filtered.sessions.length,1);
assert.equal(filtered.sessions[0].session_id,'session_alpha');
assert.ok(filtered.utterances.every((r)=>r.session_id==='session_alpha'));
assert.ok(filtered.expressions.every((r)=>r.session_id==='session_alpha'));
assert.equal(filtered.personas.length,9,'persona master must remain complete regardless of session filters');
assert.equal(filtered.codebook.length,data.codebook.length,'codebook must remain complete regardless of session filters');

const dashboard=buildResearchDashboardData(sessions as any,{});
assert.equal(dashboard.metrics.participantCount,2);
assert.equal(dashboard.metrics.totalSessions,2);
assert.equal(dashboard.metrics.childUtteranceCount,3);
assert.equal(dashboard.metrics.completeRate,50);
assert.ok(dashboard.charts.daily.length===2);
assert.ok(dashboard.charts.personas.length===2);
assert.ok(dashboard.charts.circles.some((r)=>r.label==='Inner'));
assert.ok(dashboard.topExpressions.some((r)=>r.source==='persona'));
assert.equal(dashboard.exportFiles.length,5);
assert.ok(dashboard.systemQuality.some((r)=>r.label==='AI応答失敗'&&r.value===1),'dashboard must expose AI failure events separately');
assert.ok(dashboard.systemQuality.some((r)=>r.label==='マイクエラー'&&r.value===1),'dashboard must expose microphone errors separately');
assert.ok(dashboard.systemQuality.some((r)=>r.label==='TTSフォールバック'&&r.value===1),'dashboard must expose TTS fallback separately');
const schemaCodebook=data.codebook.find((r)=>r.file_name==='sessions.csv'&&r.variable==='schema_version')!;
assert.equal(schemaCodebook.data_type,'number','schema_version must be typed as numeric in codebook');
const rateCodebook=data.codebook.find((r)=>r.file_name==='sessions.csv'&&r.variable==='student_selected_speech_rate')!;
assert.equal(rateCodebook.allowed_values,'0.75–1.25','speech rate range must be documented in codebook');
const betaDate=String(beta.local_date||'');
const betaSeries=dashboard.charts.daily.find((r)=>r.date===betaDate)!;
assert.equal(betaSeries.reflection_conveyed,null,'missing reflection must stay null, never become a false zero score');
for(const utterance of data.utterances){const session=data.sessions.find((r)=>r.session_id===utterance.session_id)!;assert.ok(session,'orphan utterance');assert.equal(utterance.research_id,session.research_id);assert.equal(utterance.class_id,session.class_id);assert.equal(utterance.persona_id,session.persona_id);assert.equal(utterance.topic,session.topic);}
for(const expression of data.expressions){const utterance=data.utterances.find((r)=>r.utterance_id===expression.utterance_id)!;assert.ok(utterance,'orphan expression');assert.equal(expression.session_id,utterance.session_id);assert.equal(expression.research_id,utterance.research_id);assert.equal(expression.class_id,utterance.class_id);assert.equal(expression.speaker,utterance.speaker);}
for(const session of data.sessions)assert.ok(personaIds.has(String(session.persona_id)),'every session persona_id must resolve in personas.csv');
const expectedCodebookRows=['sessions','utterances','expressions','personas','codebook'].reduce((sum,name)=>sum+RESEARCH_EXPORT_HEADERS[name as keyof typeof RESEARCH_EXPORT_HEADERS].length,0);
assert.equal(data.codebook.length,expectedCodebookRows,'codebook must contain exactly one row for every exported column');
const longSessions=Array.from({length:22},(_,i)=>({...sessions[0],sessionId:'long_'+i,researchId:'RLONG',startedAt:new Date(base+i*86400000).toISOString(),endedAt:new Date(base+i*86400000+120000).toISOString()}));
const longDashboard=buildResearchDashboardData(longSessions as any,{});
assert.equal(longDashboard.charts.aggregation,'weekly','more than 21 daily points must aggregate to weekly display');
assert.ok(longDashboard.charts.daily.length<22,'weekly aggregation must reduce chart density');

const forbidden=['studentId','student_id','learningCode','learning_code','teacherStudentId','teacher_student_id','name_raw'];
for(const dataset of ['sessions','utterances','expressions'] as const){
  for(const row of data[dataset])for(const key of forbidden)assert.equal(key in row,false,dataset+' must not expose '+key);
}

const server=fs.readFileSync('server.ts','utf8');
const auth=fs.readFileSync('src/server/auth.ts','utf8');
const page=fs.readFileSync('src/server/managementPage.ts','utf8');
for(const dataset of ['sessions','utterances','expressions','personas','codebook']) assert.ok(server.includes("'"+dataset+"'"),'server dataset allowlist missing '+dataset);
assert.ok(server.includes('/api/management/research.dashboard'),'dashboard endpoint missing');
assert.ok(server.includes("(dataset==='personas'||dataset==='codebook')?[]:await getAllSessionsForManagement()"),'static persona/codebook downloads must not scan all Firestore sessions');
assert.ok(auth.includes('/api/management/research.dashboard'),'researcher auth allowlist missing dashboard endpoint');
for(const dataset of ['sessions','utterances','expressions','personas','codebook']) assert.ok(page.includes(dataset+'.csv'),'research page missing '+dataset+'.csv');
assert.ok(page.includes('data-export-dataset'),'research page CSV buttons are not dynamically bound');
assert.ok(page.includes('chartDaily')&&page.includes('chartPersona')&&page.includes('chartCircle')&&page.includes('chartWords')&&page.includes('chartReflection'),'all five graph containers must exist');

console.log('Research CSV completeness/linkage QA: PASS');
