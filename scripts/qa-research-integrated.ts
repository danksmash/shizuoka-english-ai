import assert from 'node:assert/strict';
import { buildResearchDataSets } from '../src/server/researchExport';
import { analyzeChildCommunication, parseResearchSystemEvents } from '../src/dataContract';
import { maskTextForResearchExport } from '../src/utils/privacy';
import fs from 'node:fs';

const base = Date.parse('2026-09-01T01:00:00Z'); // 10:00 JST, Tuesday
const clustered = Array.from({ length: 8 }, (_, index) => ({
  schemaVersion: 3,
  researchId: `R${100001 + index}`,
  classId: '5-1',
  sessionId: `session_class_${index}`,
  lifetimeSessionNumber: 1,
  dailySessionNumber: 1,
  aiStudentId: 'emma_usa',
  topic: 'favorites',
  targetDurationMinutes: 3,
  actualDurationSeconds: 180,
  startedAt: new Date(base + index * 15_000).toISOString(),
  endedAt: new Date(base + index * 15_000 + 180_000).toISOString(),
  history: [
    { id: `a${index}`, sender: 'ai', englishText: 'I like soccer. How about you?', japaneseText: '私はサッカーが好きです。あなたは？', timestamp: base + index * 15_000 },
    { id: `c${index}`, sender: 'child', englishText: 'I like soccer. How about you?', japaneseText: '私はサッカーが好きです。あなたは？', timestamp: base + index * 15_000 + 30_000 },
    { id: `c2${index}`, sender: 'child', englishText: 'Pardon? I like it because it is fun.', japaneseText: 'もう一度お願いします。楽しいので好きです。', timestamp: base + index * 15_000 + 60_000 },
  ],
  encounteredVocab: [],
  reflection: { conveyedIdeas: 3, understoodPartner: 3, noticedLanguageCulture: 2 },
  systemEvents: [
    { type: 'session_start', timestamp: base + index * 15_000 },
    { type: 'mic_start', timestamp: base + index * 15_000 + 20_000 },
    { type: 'vocab_bank_open', timestamp: base + index * 15_000 + 40_000, value: 'bank' },
    { type: 'session_finish', timestamp: base + index * 15_000 + 179_000 },
  ],
}));

const evening = {
  ...clustered[0], researchId: 'R200001', classId: '5-2', sessionId: 'session_evening',
  startedAt: '2026-09-01T09:30:00.000Z', endedAt: '2026-09-01T09:33:00.000Z', reflection: null,
}; // 18:30 JST
const weekend = {
  ...clustered[0], researchId: 'R200002', classId: '5-2', sessionId: 'session_weekend',
  startedAt: '2026-09-05T01:00:00.000Z', endedAt: '2026-09-05T01:03:00.000Z',
};

const data = buildResearchDataSets([...clustered, evening, weekend]);
assert.equal(data.sessions.length, 10);
assert.ok(data.turns.length > data.sessions.length, 'turn-level dataset must preserve anonymized utterance rows');
assert.ok(data.expressions.some((row) => row.expression_id === 'vocab-soccer'), 'curriculum expression rows must be derived from actual turns');
assert.ok(data.system_events.some((row) => row.event_type === 'vocab_bank_open'), 'system events must be exportable');

const inClass = data.sessions.find((row) => row.session_id === 'session_class_0')!;
assert.equal(inClass.local_date, '2026-09-01');
assert.equal(inClass.local_start_time, '10:00:00');
assert.equal(inClass.weekday, 'Tue');
assert.equal(inClass.usage_context_inferred, 'in_class');
assert.equal(inClass.same_class_starts_5min, 8);
assert.equal(inClass.classification_rule_version, 'time-cluster-v1');
assert.equal(inClass.total_turns, inClass.child_turn_count);
assert.equal(inClass.total_child_words, inClass.child_total_words);
assert.equal(inClass.unique_vocabulary_count, inClass.encountered_curriculum_vocab_count);
assert.equal(inClass.child_question_count, 1);
assert.equal(inClass.child_reciprocal_question_count, 1);
assert.equal(inClass.child_repair_count, 1);
assert.equal(inClass.child_reason_expression_count, 1);
assert.ok(Number(inClass.child_unique_word_types) > 0);
assert.ok(Number(inClass.child_curriculum_vocab_count) >= 1);
assert.ok(Number(inClass.ai_curriculum_vocab_count) >= 1);
assert.ok(!('studentId' in inClass));
assert.ok(!('teacherStudentId' in inClass));
assert.ok(!('learningCode' in inClass));

const eveningRow = data.sessions.find((row) => row.session_id === 'session_evening')!;
assert.equal(eveningRow.usage_context_inferred, 'out_of_school_hours');
assert.equal(eveningRow.data_quality_flag, 'missing_reflection');
assert.equal(eveningRow.session_status, 'dialogue_complete');
const interruptedData = buildResearchDataSets([{...clustered[0], sessionId:'session_interrupted', reflection:null, systemEvents:[
  { type:'session_start', timestamp:base },
  { type:'mic_start', timestamp:base+20_000 },
]}]);
assert.equal(interruptedData.sessions[0].data_quality_flag, 'interrupted', 'checkpoint without session_finish must be distinguishable from reflection missing');
assert.equal(interruptedData.sessions[0].session_status, 'in_progress_or_interrupted');
assert.equal(interruptedData.sessions[0].session_completed, 0);

const legacyComplete = buildResearchDataSets([{...clustered[0], schemaVersion:2, sessionId:'legacy_complete', reflection:{conveyedIdeas:3,understoodPartner:4,noticedLanguageCulture:3}, systemEvents:[]}]).sessions[0];
assert.equal(legacyComplete.data_quality_flag,'complete','pre-event legacy session with reflection must remain a complete case');
assert.equal(legacyComplete.session_status,'complete','legacy completed session status must be inferred');
assert.equal(legacyComplete.session_completed,1,'legacy completed session must not be reclassified as interrupted');

const weekendRow = data.sessions.find((row) => row.session_id === 'session_weekend')!;
assert.equal(weekendRow.usage_context_inferred, 'non_school_day');

const childTurn = data.turns.find((row) => row.session_id === 'session_class_0' && row.speaker === 'child')!;
assert.equal(childTurn.english_text_anonymized, 'I like soccer. How about you?');
assert.equal(childTurn.is_question, 1);
assert.equal(childTurn.question_type, 'reciprocal');

const metrics = analyzeChildCommunication(clustered[0].history as any);
assert.equal(metrics.totalTurns, 2);
assert.equal(metrics.childQuestionCount, 1);
assert.equal(metrics.childReciprocalQuestionCount, 1);
assert.equal(metrics.childRepairCount, 1);
assert.equal(metrics.childReasonExpressionCount, 1);
assert.ok(metrics.childUniqueWordTypes > 0);

const maskedResearch = maskTextForResearchExport('My name is Jonah Smith. I am 11 years old. I go to Kitahama Elementary School. My code is A7M4. My birthday is May 10.');
for (const secret of ['Jonah Smith','11 years old','Kitahama Elementary School','A7M4','May 10']) assert.equal(maskedResearch.includes(secret), false, `research export must mask ${secret}`);
assert.equal(maskTextForResearchExport('I like soccer because it is fun.'), 'I like soccer because it is fun.');

const nameContextData = buildResearchDataSets([{...clustered[0], sessionId:'session_name_context', history:[
  {id:'ai-name',sender:'ai',englishText:"What's your name?",japaneseText:'名前は何ですか。',timestamp:base},
  {id:'child-name',sender:'child',englishText:"I'm Jonah. I like soccer.",japaneseText:'私はジョナです。サッカーが好きです。',timestamp:base+1000},
]}]);
const nameTurn = nameContextData.turns.find((row) => row.speaker === 'child')!;
assert.equal(String(nameTurn.english_text_anonymized).includes('Jonah'), false, 'name response after explicit name question must be masked');
assert.ok(String(nameTurn.english_text_anonymized).includes('I like soccer'), 'non-identifying remainder must be preserved');

const parsedEvents = parseResearchSystemEvents([
  { type: 'mic_start', timestamp: base, value: 'microphone' },
  { type: 'ai_response_latency_ms', timestamp: base + 1, value: '420' },
  { type: 'not_allowed', timestamp: base },
  { type: 'help_open', timestamp: 'bad' },
]);
assert.equal(parsedEvents.length, 2, 'only whitelisted events with valid timestamps may be stored');
const appSource = fs.readFileSync('src/App.tsx','utf8');
assert.ok(appSource.includes('initialSessionSaveRef'), 'dialogue-end snapshot persistence must exist');
assert.ok(appSource.includes('Initial research session snapshot unavailable'), 'snapshot failure handling must exist');
assert.ok(appSource.includes("recordResearchEvent('ai_response_latency_ms'"), 'AI response latency must be captured');


// Research-data hardening regression checks.
const unordered = buildResearchDataSets([
  {...clustered[0], sessionId:'seq_b', researchId:'RSEQ', lifetimeSessionNumber:99, dailySessionNumber:99, startedAt:'2026-09-02T01:00:00.000Z', endedAt:'2026-09-02T01:03:00.000Z'},
  {...clustered[0], sessionId:'seq_a', researchId:'RSEQ', lifetimeSessionNumber:42, dailySessionNumber:42, startedAt:'2026-09-01T01:00:00.000Z', endedAt:'2026-09-01T01:03:00.000Z'},
]);
assert.equal(unordered.sessions.find((r)=>r.session_id==='seq_a')?.lifetime_session_number,1,'research lifetime sequence must be recalculated from timestamps');
assert.equal(unordered.sessions.find((r)=>r.session_id==='seq_b')?.lifetime_session_number,2,'research lifetime sequence must not trust stored count+1 values');
const unassigned = buildResearchDataSets([{...clustered[0],sessionId:'unassigned_class',classId:''}]).sessions[0];
assert.equal(unassigned.usage_context_inferred,'unknown','school-hours sessions without class_id must not be classified as out-of-class');
assert.equal(inClass.academic_year,2026,'Japanese academic year must be available for longitudinal analysis');
assert.equal(inClass.grade_level,5,'grade level must be derived from class_id for legacy-compatible export');
assert.equal(maskTextForResearchExport("I'm Taro."),"I'm [name omitted].",'bare self-introduction names must be masked');
assert.equal(maskTextForResearchExport("I'm good."),"I'm good.",'common self-description must remain analyzable');
const serverHardening=fs.readFileSync('server.ts','utf8');
const firestoreHardening=fs.readFileSync('src/server/firestore.ts','utf8');
const persistenceHardening=fs.readFileSync('src/server/persistence.ts','utf8');
const authHardening=fs.readFileSync('src/server/auth.ts','utf8');
const managementHardening=fs.readFileSync('src/server/managementPage.ts','utf8');
assert.ok(serverHardening.includes("express.json({ limit: '512kb' })"),'session payload limit must support complete five-minute histories');
assert.ok(firestoreHardening.includes('nextPageToken'),'Firestore management reads must paginate beyond 1000 documents');
assert.ok(firestoreHardening.includes('createDocumentIfAbsent'),'atomic create-if-absent helper must exist');
assert.ok(persistenceHardening.includes("RESEARCH_ID_COLLECTION = 'research_ids'"),'research IDs must have an atomic uniqueness index');
assert.ok(persistenceHardening.includes("TEACHER_ID_COLLECTION = 'teacher_ids'"),'teacher-facing student IDs must also be atomically reserved');
assert.ok(persistenceHardening.includes('createDocumentIfAbsent(STUDENT_COLLECTION, key'),'learning-code documents must not overwrite concurrent issuance');
assert.ok(persistenceHardening.includes("queryCollection(SESSION_COLLECTION, 'studentId', studentId, 5000)"),'student longitudinal history must exceed the old 500-session ceiling');
assert.ok(persistenceHardening.includes('updateStudentClass'),'grade/class progression must preserve student and research identity');
assert.ok(persistenceHardening.indexOf('const created = await createStudentCode(newCode') < persistenceHardening.indexOf('teacherStudentId: tid, active: false'),'new learning code must be created successfully before old codes are deactivated');
assert.ok(authHardening.includes('/api/management/research.bundle.zip'),'researcher must be allowed to download the protected one-snapshot bundle');
assert.ok(serverHardening.includes('/api/management/research.bundle.zip'),'one-snapshot ZIP export endpoint must exist');
assert.ok(managementHardening.includes("data_quality_flag||'')!=='complete"),'complete-case filters must include reflection/data-quality status');
assert.ok(managementHardening.includes('bundleCsvBtn'),'research management UI must expose the same-snapshot ZIP export');
assert.ok(appSource.includes('sessionSaveQueueRef'),'checkpoint writes must be serialized to avoid stale overwrite races');
assert.ok(appSource.includes('Research session checkpoint unavailable'),'in-progress session checkpoints must be attempted');

console.log('Integrated research dataset QA: PASS');
