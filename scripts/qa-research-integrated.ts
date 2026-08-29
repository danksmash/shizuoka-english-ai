import assert from 'node:assert/strict';
import { buildResearchDataSets } from '../src/server/researchExport';
import { analyzeChildCommunication, parseResearchSystemEvents } from '../src/dataContract';

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
  ],
}));

const evening = {
  ...clustered[0], researchId: 'R200001', classId: '5-2', sessionId: 'session_evening',
  startedAt: '2026-09-01T09:30:00.000Z', endedAt: '2026-09-01T09:33:00.000Z',
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

const parsedEvents = parseResearchSystemEvents([
  { type: 'mic_start', timestamp: base, value: 'microphone' },
  { type: 'not_allowed', timestamp: base },
  { type: 'help_open', timestamp: 'bad' },
]);
assert.equal(parsedEvents.length, 1, 'only whitelisted events with valid timestamps may be stored');

console.log('Integrated research dataset QA: PASS');
