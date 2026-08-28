import assert from 'node:assert/strict';
import {
  AI_STUDENT_IDS,
  DIALOGUE_DURATIONS_MINUTES,
  DIALOGUE_TOPIC_IDS,
  calculateCanonicalStats,
  canonicalizeHistory,
  isAIStudentId,
  isDialogueDuration,
  isDialogueTopic,
  validateSessionSaveInput,
} from '../src/dataContract';

assert.equal(AI_STUDENT_IDS.length, 9);
assert.deepEqual(DIALOGUE_DURATIONS_MINUTES, [1, 2, 3, 5]);
assert.equal(DIALOGUE_TOPIC_IDS.length, 5);
assert.equal(isAIStudentId('emma_usa'), true);
assert.equal(isAIStudentId('unknown_person'), false);
assert.equal(isDialogueTopic('free'), true);
assert.equal(isDialogueTopic('invalid'), false);
assert.equal(isDialogueDuration(5), true);
assert.equal(isDialogueDuration(10), false);

const history = canonicalizeHistory([
  { id: 'a', sender: 'child', englishText: 'I like soccer.', timestamp: 1000 },
  { id: 'b', sender: 'ai', englishText: 'Me too!', timestamp: 2000 },
  { id: 'c', sender: 'child', englishText: 'How about you?', timestamp: 3000 },
]);
const stats = calculateCanonicalStats(history, 1000, 61000, 1, [{ id: 'soccer' }, { id: 'soccer' }, { id: 'tea' }]);
assert.equal(stats.totalTurns, 2);
assert.equal(stats.totalChildWords, 6);
assert.equal(stats.actualDurationSeconds, 60);
assert.equal(stats.uniqueVocabularyCount, 2);

const valid = validateSessionSaveInput({
  sessionId: 'session_12345678',
  learningCode: 'A7M4',
  aiStudentId: 'emma_usa',
  topic: 'favorites',
  targetDurationMinutes: 3,
  startedAt: 1000,
  endedAt: 181000,
  history,
});
assert.equal(valid.ok, true);

const badStudent = validateSessionSaveInput({
  sessionId: 'session_12345678', learningCode: 'A7M4', aiStudentId: 'nope', topic: 'favorites', targetDurationMinutes: 3, startedAt: 1000, endedAt: 2000, history,
});
assert.equal(badStudent.ok, false);
const badDuration = validateSessionSaveInput({
  sessionId: 'session_12345678', learningCode: 'A7M4', aiStudentId: 'emma_usa', topic: 'favorites', targetDurationMinutes: 10, startedAt: 1000, endedAt: 2000, history,
});
assert.equal(badDuration.ok, false);

console.log('DATA CONTRACT QA PASS');
