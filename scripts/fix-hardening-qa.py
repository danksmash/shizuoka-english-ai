from pathlib import Path
p=Path(__file__).resolve().parents[1]
qa=r'''import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canonicalizeHistory, maskHistoryForStorage, validateSessionSaveInput } from '../src/dataContract';
import { safePlainTextForClipboard } from '../src/utils/privacy';

const history=canonicalizeHistory([{id:'a',sender:'ai',englishText:'Hello!',japaneseText:'こんにちは！',timestamp:1000},{id:'b',sender:'child',englishText:'I like soccer.',japaneseText:'サッカーが好きです。',timestamp:1500}]);
const valid=validateSessionSaveInput({sessionId:'session_12345678',learningCode:'A7M4',aiStudentId:'emma_usa',topic:'favorites',targetDurationMinutes:3,startedAt:1000,endedAt:2000,history,reflection:{conveyedIdeas:3,understoodPartner:3,noticedLanguageCulture:3},personaLabelCondition:'shown',studentSelectedSpeechRate:1,effectiveTtsSpeechRate:1});assert.equal(valid.ok,true);
for(const code of ['A7M','A7M45','A-7M',''])assert.equal(validateSessionSaveInput({sessionId:'session_12345678',learningCode:code,aiStudentId:'emma_usa',topic:'favorites',targetDurationMinutes:3,startedAt:1000,endedAt:2000,history}).ok,false);
for(const duration of [1,2,3,5])assert.equal(validateSessionSaveInput({sessionId:'session_12345678',learningCode:'A7M4',aiStudentId:'emma_usa',topic:'favorites',targetDurationMinutes:duration,startedAt:1000,endedAt:2000,history}).ok,true);
assert.equal(validateSessionSaveInput({sessionId:'session_12345678',learningCode:'A7M4',aiStudentId:'emma_usa',topic:'favorites',targetDurationMinutes:10,startedAt:1000,endedAt:2000,history}).ok,false);
for(const reflection of [{conveyedIdeas:2,understoodPartner:3,noticedLanguageCulture:3},{conveyedIdeas:5,understoodPartner:4,noticedLanguageCulture:1}]){const r=validateSessionSaveInput({sessionId:'session_12345678',learningCode:'A7M4',aiStudentId:'emma_usa',topic:'favorites',targetDurationMinutes:1,startedAt:1000,endedAt:2000,history,reflection});assert.equal(r.ok,true);if(r.ok)assert.equal(r.value.reflection,undefined);}
const privateHistory=canonicalizeHistory([{id:'p',sender:'child',englishText:'My name is Jonah Smith. I go to Kitahama Elementary School. My code is A7M4. Email child@example.com phone 090-1234-5678.',timestamp:1000}]);const masked=maskHistoryForStorage(privateHistory);for(const secret of ['Jonah Smith','Kitahama Elementary School','A7M4','child@example.com','090-1234-5678'])assert.equal(masked[0].englishText.includes(secret),false,secret);
const copied=safePlainTextForClipboard('Email child@example.com phone 090-1234-5678');assert.equal(copied.includes('child@example.com'),false);assert.equal(copied.includes('090-1234-5678'),false);
const persistence=await readFile('src/server/persistence.ts','utf8');assert.ok(persistence.includes('learningId: normalized'));assert.ok(persistence.includes("existing ? [] : await queryCollection"));assert.ok(persistence.includes("schemaVersion: 4"));
const exportSource=await readFile('src/server/researchExport.ts','utf8');assert.ok(exportSource.includes('persona_label_condition'));assert.ok(exportSource.includes('student_selected_speech_rate'));assert.ok(exportSource.includes("dictionary_source:'persona'"));assert.equal(exportSource.includes('learningId'),false);
const server=await readFile('server.ts','utf8');assert.ok(server.includes("'claude-sonnet-5'"));assert.ok(server.includes("output_config: { effort: 'medium' }"));assert.ok(server.includes("requireManagementRole(['researcher'])"));assert.equal(server.includes("requireManagementRole(['teacher'])"),false);assert.equal(server.includes("'/api/management/student-codes'"),false);assert.equal(server.includes("'/api/management/sessions'"),false);
const management=await readFile('src/server/managementPage.ts','utf8');assert.ok(management.includes('/api/management/research.csv'));assert.ok(management.includes('匿名化'));assert.equal(management.includes('教師用管理'),false);
console.log('DATA CONTRACT QA PASS');
'''
(p/'scripts/qa-data-contract.ts').write_text(qa,encoding='utf-8')

rq=(p/'scripts/qa-research-integrated.ts').read_text(encoding='utf-8')
rq=rq.replace("assert.ok(managementHardening.includes(\"data_quality_flag||'')!=='complete'\"),'complete-case filters must include reflection/data-quality status');\nassert.ok(managementHardening.includes('bundleCsvBtn'),'research management UI must expose the same-snapshot ZIP export');", "assert.ok(managementHardening.includes('/api/management/research.bundle.zip'),'research management UI must expose the same-snapshot ZIP export');\nassert.ok(managementHardening.includes('/api/management/research.summary'),'research management UI must expose anonymous summary data');\nassert.ok(!managementHardening.includes('教師用管理'),'teacher management UI must be removed');")
rq=rq.replace("'teacher views must use the distributed learner ID'", "'learner identity records must retain the distributed learner ID'")
(p/'scripts/qa-research-integrated.ts').write_text(rq,encoding='utf-8')
print('Aligned data-contract and integrated QA with final researcher-only architecture.')
