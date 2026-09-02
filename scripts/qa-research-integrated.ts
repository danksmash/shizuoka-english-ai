import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildResearchDataSets } from '../src/server/researchExport';
import { analyzeChildCommunication, parseResearchSystemEvents } from '../src/dataContract';
import { maskTextForResearchExport } from '../src/utils/privacy';

const base = Date.parse('2026-09-01T01:00:00Z');
const clustered = Array.from({ length: 8 }, (_, index) => ({
  schemaVersion: 4,
  researchSchemaVersion: 'research-2026-v1',
  researchId: `R${100001 + index}`,
  studentId: `S${100001 + index}`,
  classId: '5-1',
  sessionId: `session_class_${index}`,
  lifetimeSessionNumber: 1,
  dailySessionNumber: 1,
  aiStudentId: 'emma_usa',
  personaId: 'emma_usa',
  topic: 'favorites',
  targetDurationMinutes: 3,
  actualDurationSeconds: 180,
  startedAt: new Date(base + index * 15_000).toISOString(),
  endedAt: new Date(base + index * 15_000 + 180_000).toISOString(),
  assignedPartnerId: 'PARTNER-01',
  assignedPartnerCountry: 'United States',
  assignmentAnnouncedAt: '2026-09-02T00:00:00.000Z',
  history: [
    { id: `a${index}`, sender: 'ai', englishText: 'I like soccer. How about you?', japaneseText: '私はサッカーが好きです。あなたは？', timestamp: base + index * 15_000 },
    { id: `c${index}`, sender: 'child', englishText: 'I like soccer. How about you?', japaneseText: '私はサッカーが好きです。あなたは？', timestamp: base + index * 15_000 + 30_000 },
    { id: `c2${index}`, sender: 'child', englishText: 'Pardon? I like it because it is fun.', japaneseText: 'もう一度お願いします。楽しいので好きです。', timestamp: base + index * 15_000 + 60_000 },
  ],
  encounteredVocab: [],
  reflection: { conveyedIdeas: 3, understoodPartner: 3, noticedLanguageCulture: 3 },
  systemEvents: [
    { type: 'session_start', timestamp: base + index * 15_000 },
    { type: 'mic_start', timestamp: base + index * 15_000 + 20_000 },
    { type: 'vocab_bank_open', timestamp: base + index * 15_000 + 40_000, value: 'bank' },
    { type: 'session_finish', timestamp: base + index * 15_000 + 179_000 },
  ],
}));

const individual = {
  ...clustered[0], researchId: 'R200001', studentId: 'S200001', classId: '5-2', sessionId: 'session_individual',
  startedAt: '2026-09-01T09:30:00.000Z', endedAt: '2026-09-01T09:33:00.000Z', reflection: null,
};
const weekend = {
  ...clustered[0], researchId: 'R200002', studentId: 'S200002', classId: '5-2', sessionId: 'session_weekend',
  startedAt: '2026-09-05T01:00:00.000Z', endedAt: '2026-09-05T01:03:00.000Z',
};

const data = buildResearchDataSets([...clustered, individual, weekend]);
assert.equal(data.sessions.length, 10);
assert.ok(data.turns.length > data.sessions.length, 'turn-level dataset must preserve anonymized utterance rows');
assert.ok(data.expressions.some((row) => row.expression_id === 'vocab-soccer'), 'curriculum expression rows must be derived from actual turns');
assert.ok(data.system_events.some((row) => row.event_type === 'vocab_bank_open'), 'system events must remain available for technical quality monitoring');

const grouped = data.sessions.find((row) => row.session_id === 'session_class_0')!;
assert.equal(grouped.local_date, '2026-09-01');
assert.equal(grouped.local_start_time, '10:00:00');
assert.equal(grouped.usage_context_inferred, 'group_like');
assert.equal(grouped.same_class_starts_5min, 8);
assert.equal(grouped.assigned_partner_id, 'PARTNER-01');
assert.equal(grouped.assigned_partner_country, 'United States');
assert.equal(grouped.assignment_announced_at, '2026-09-02T00:00:00.000Z');
assert.equal(grouped.total_turns, grouped.child_turn_count);
assert.equal(grouped.total_child_words, grouped.child_total_words);
assert.equal(grouped.child_question_count, 1);
assert.equal(grouped.child_reciprocal_question_count, 1);
assert.equal(grouped.child_repair_count, 1);
assert.equal(grouped.child_reason_expression_count, 1);
assert.ok(Number(grouped.child_unique_word_types) > 0);
assert.ok(!('studentId' in grouped));
assert.ok(!('learningCode' in grouped));

const individualRow = data.sessions.find((row) => row.session_id === 'session_individual')!;
assert.equal(individualRow.usage_context_inferred, 'individual_like');
assert.equal(individualRow.data_quality_flag, 'missing_reflection');
assert.equal(individualRow.session_status, 'dialogue_complete');
assert.equal(data.sessions.find((row) => row.session_id === 'session_weekend')?.usage_context_inferred, 'individual_like');
const unassigned = buildResearchDataSets([{ ...clustered[0], sessionId:'unassigned_class', classId:'' }]).sessions[0];
assert.equal(unassigned.usage_context_inferred, 'unknown');

const interruptedData = buildResearchDataSets([{ ...clustered[0], sessionId:'session_interrupted', reflection:null, systemEvents:[
  { type:'session_start', timestamp:base }, { type:'mic_start', timestamp:base + 20_000 },
] }]);
assert.equal(interruptedData.sessions[0].data_quality_flag, 'interrupted');
assert.equal(interruptedData.sessions[0].session_status, 'in_progress_or_interrupted');
assert.equal(interruptedData.sessions[0].session_completed, 0);

const legacyComplete = buildResearchDataSets([{ ...clustered[0], schemaVersion:2, sessionId:'legacy_complete', reflection:{conveyedIdeas:3,understoodPartner:3,noticedLanguageCulture:3}, systemEvents:[] }]).sessions[0];
assert.equal(legacyComplete.data_quality_flag, 'complete');
assert.equal(legacyComplete.session_completed, 1);

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

const maskedResearch = maskTextForResearchExport('My name is Jonah Smith. I am 11 years old. I go to Kitahama Elementary School. My code is A7M4. My birthday is May 10.');
for (const secret of ['Jonah Smith','11 years old','Kitahama Elementary School','A7M4','May 10']) {
  assert.equal(maskedResearch.includes(secret), false, `research export must mask ${secret}`);
}
assert.equal(maskTextForResearchExport('I like soccer because it is fun.'), 'I like soccer because it is fun.');

const nameContextData = buildResearchDataSets([{ ...clustered[0], sessionId:'session_name_context', history:[
  { id:'ai-name', sender:'ai', englishText:"What's your name?", japaneseText:'名前は何ですか。', timestamp:base },
  { id:'child-name', sender:'child', englishText:"I'm Jonah. I like soccer.", japaneseText:'私はジョナです。サッカーが好きです。', timestamp:base + 1000 },
] }]);
const nameTurn = nameContextData.turns.find((row) => row.speaker === 'child')!;
assert.equal(String(nameTurn.english_text_anonymized).includes('Jonah'), false);
assert.ok(String(nameTurn.english_text_anonymized).includes('I like soccer'));

const parsedEvents = parseResearchSystemEvents([
  { type:'mic_start', timestamp:base, value:'microphone' },
  { type:'ai_response_latency_ms', timestamp:base + 1, value:'420' },
  { type:'not_allowed', timestamp:base },
  { type:'help_open', timestamp:'bad' },
]);
assert.equal(parsedEvents.length, 2);

const unordered = buildResearchDataSets([
  { ...clustered[0], sessionId:'seq_b', researchId:'RSEQ', lifetimeSessionNumber:99, dailySessionNumber:99, startedAt:'2026-09-02T01:00:00.000Z', endedAt:'2026-09-02T01:03:00.000Z' },
  { ...clustered[0], sessionId:'seq_a', researchId:'RSEQ', lifetimeSessionNumber:42, dailySessionNumber:42, startedAt:'2026-09-01T01:00:00.000Z', endedAt:'2026-09-01T01:03:00.000Z' },
]);
assert.equal(unordered.sessions.find((row) => row.session_id === 'seq_a')?.lifetime_session_number, 1);
assert.equal(unordered.sessions.find((row) => row.session_id === 'seq_b')?.lifetime_session_number, 2);
assert.equal(grouped.academic_year, 2026);
assert.equal(grouped.grade_level, 5);

const exportSource = fs.readFileSync('src/server/researchExport.ts','utf8');
assert.equal(exportSource.includes('SCHOOL_START_MINUTE'), false, 'research context inference must not hard-code school hours');
assert.equal(exportSource.includes('SCHOOL_END_MINUTE'), false, 'research context inference must not hard-code school hours');
assert.ok(exportSource.includes("'group_like' | 'individual_like' | 'unknown'"));

const serverSource = fs.readFileSync('server.ts','utf8');
const firestoreSource = fs.readFileSync('src/server/firestore.ts','utf8');
const persistenceSource = fs.readFileSync('src/server/persistence.ts','utf8');
const authSource = fs.readFileSync('src/server/auth.ts','utf8');
const managementSource = fs.readFileSync('src/server/managementPage.ts','utf8');
const appSource = fs.readFileSync('src/App.tsx','utf8');
assert.ok(serverSource.includes("express.json({ limit: '512kb' })"));
assert.ok(firestoreSource.includes('nextPageToken'));
assert.ok(persistenceSource.includes("RESEARCH_ID_COLLECTION = 'research_ids'"));
assert.ok(persistenceSource.includes('assignedPartnerCountry'));
assert.ok(persistenceSource.includes('assignmentAnnouncedAt'));
assert.ok(persistenceSource.includes("queryCollection(SESSION_COLLECTION, 'studentId', studentId, 5000)"));
assert.ok(authSource.includes('/api/management/research.bundle.zip'));
assert.ok(serverSource.includes('/api/management/research.bundle.zip'));
assert.ok(managementSource.includes('/api/management/research.bundle.zip'));
assert.ok(managementSource.includes('/api/management/research.dashboard'));
assert.ok(!managementSource.includes('教師用管理'));
assert.ok(appSource.includes('sessionSaveQueueRef'));
assert.ok(appSource.includes('initialSessionSaveRef'));

console.log('Integrated research dataset QA: PASS');
