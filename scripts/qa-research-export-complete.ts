import assert from 'node:assert/strict';
import { buildResearchDashboardData, buildResearchExportDataSets, RESEARCH_EXPORT_HEADERS, RESEARCH_EXPORT_SCHEMA_VERSION, serializeResearchCsv } from '../src/server/researchDashboard';

const before=Date.parse('2026-09-01T01:00:00Z');
const after=Date.parse('2026-09-03T01:00:00Z');
const announced='2026-09-02T00:00:00.000Z';
const make=(sessionId:string,started:number,extra:Record<string,any>={})=>({
 schemaVersion:4,researchSchemaVersion:'research-2026-v1',researchId:'R1',studentId:'S1',classId:'5-1',sessionId,
 aiStudentId:'emma_usa',personaId:'emma_usa',personaCountry:'United States',personaGender:'female',topic:'favorites',targetDurationMinutes:2,actualDurationSeconds:120,
 startedAt:new Date(started).toISOString(),endedAt:new Date(started+120000).toISOString(),appVersion:'1.0.7',build:'abc',
 assignedPartnerId:'P1',assignedPartnerCountry:'United States',assignmentAnnouncedAt:announced,studentSelectedSpeechRate:1,
 history:[{id:'a',sender:'ai',englishText:'What do you like?',japaneseText:'何が好きですか。',timestamp:started},{id:'c',sender:'child',englishText:'I like soccer because it is fun.',japaneseText:'サッカーが好きです。',timestamp:started+30000}],
 reflection:{conveyedIdeas:5,understoodPartner:3,noticedLanguageCulture:5},
 systemEvents:[{type:'session_start',timestamp:started},{type:'help_open',timestamp:started+1000},{type:'vocab_bank_open',timestamp:started+2000},{type:'session_finish',timestamp:started+119000}],
 ...extra,
});
const raw=[make('before',before),make('after',after),make('other',after+3600000,{researchId:'R2',studentId:'S2',classId:'6-2',aiStudentId:'rahul_bangladesh',personaId:'rahul_bangladesh',personaCountry:'Bangladesh',assignedPartnerId:'P2',assignedPartnerCountry:'India',reflection:null,systemEvents:[{type:'session_start',timestamp:after+3600000},{type:'ai_request_failure',timestamp:after+3610000,value:'503'},{type:'mic_error',timestamp:after+3620000,value:'network'},{type:'tts_provider',timestamp:after+3625000,value:'device-fallback'},{type:'session_finish',timestamp:after+3659000}]})];
const data=buildResearchExportDataSets(raw as any);
assert.deepEqual(Object.keys(data).sort(),['codebook','expressions','personas','sessions','utterances'].sort());
assert.equal(data.sessions.length,3);assert.equal(data.personas.length,20);
for(const dataset of ['sessions','utterances','expressions','personas','codebook'] as const){for(const row of data[dataset])assert.deepEqual(Object.keys(row),RESEARCH_EXPORT_HEADERS[dataset]);assert.ok(serializeResearchCsv(data[dataset],dataset).startsWith('\uFEFF'));}
for(const required of ['assigned_partner_id','assigned_partner_country','assignment_announced_at','same_class_starts_5min','same_class_starts_10min','usage_context_inferred'])assert.ok(RESEARCH_EXPORT_HEADERS.sessions.includes(required));
for(const removed of ['ai_model','ai_input_tokens','accent_circle','world_englishes_circle','tts_provider','tts_voice_name','school_hours_flag','weekday_flag','classification_rule_version'])assert.equal(RESEARCH_EXPORT_HEADERS.sessions.includes(removed),false,removed+' must not be formal research data');
assert.equal(RESEARCH_EXPORT_HEADERS.personas.includes('world_englishes_circle'),false);assert.equal(RESEARCH_EXPORT_HEADERS.personas.includes('tts_voice_name'),false);
const beforeRow=data.sessions.find(r=>r.session_id==='before')!;assert.equal(beforeRow.research_schema_version,RESEARCH_EXPORT_SCHEMA_VERSION);assert.equal(beforeRow.assigned_partner_country,'United States');assert.equal(beforeRow.help_open_count,1);assert.equal(beforeRow.vocab_bank_open_count,1);
assert.ok(data.utterances.every(u=>data.sessions.some(s=>s.session_id===u.session_id)));assert.ok(data.expressions.every(e=>data.utterances.some(u=>u.utterance_id===e.utterance_id)));
const dashboard=buildResearchDashboardData(raw as any,{});assert.equal(dashboard.charts.personas.length,20);assert.equal(dashboard.researchIndicators.beforeAnnouncementSessions,1);assert.equal(dashboard.researchIndicators.afterAnnouncementSessions,2);assert.equal(dashboard.researchIndicators.assignedCountryPersonaMatchedSessions,1);assert.equal(dashboard.researchIndicators.assignedCountryPersonaSharePercent,50);assert.ok(dashboard.systemQuality.some(r=>r.label==='AI応答失敗'&&r.value===1));assert.ok(dashboard.systemQuality.some(r=>r.label==='TTSフォールバック'&&r.value===1));
const formula=serializeResearchCsv([{english_text_anonymized:'=1+1'}] as any,'utterances');assert.ok(formula.includes("\"'=1+1\""));
console.log('Complete five-file research export QA: PASS');
