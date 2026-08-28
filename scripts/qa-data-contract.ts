import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  AI_STUDENT_IDS,
  DIALOGUE_DURATIONS_MINUTES,
  DIALOGUE_TOPIC_IDS,
  calculateCanonicalStats,
  canonicalizeHistory,
  isAIStudentId,
  isDialogueDuration,
  isDialogueTopic,
  isValidLearningCode,
  normalizeLearningCode,
  validateSessionSaveInput,
  maskHistoryForStorage,
} from '../src/dataContract';
import { safePlainTextForClipboard } from '../src/utils/privacy';

assert.equal(AI_STUDENT_IDS.length, 9);
assert.deepEqual(DIALOGUE_DURATIONS_MINUTES, [1, 2, 3, 5]);
assert.equal(DIALOGUE_TOPIC_IDS.length, 5);
assert.equal(isAIStudentId('emma_usa'), true);
assert.equal(isAIStudentId('unknown_person'), false);
assert.equal(isDialogueTopic('free'), true);
assert.equal(isDialogueTopic('invalid'), false);
assert.equal(isDialogueDuration(5), true);
assert.equal(isDialogueDuration(10), false);
assert.equal(isValidLearningCode('A7M4'), true);
assert.equal(isValidLearningCode('A7M45'), false);
assert.equal(isValidLearningCode('A7M'), false);
assert.equal(normalizeLearningCode('a7m45'), 'A7M4');

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
  sessionId: 'session_12345678', learningCode: 'A7M4', aiStudentId: 'emma_usa', topic: 'favorites', targetDurationMinutes: 3,
  startedAt: 1000, endedAt: 181000, history,
});
assert.equal(valid.ok, true);
const badCode = validateSessionSaveInput({
  sessionId: 'session_12345678', learningCode: 'A7M', aiStudentId: 'emma_usa', topic: 'favorites', targetDurationMinutes: 3,
  startedAt: 1000, endedAt: 2000, history,
});
assert.equal(badCode.ok, false);
const badStudent = validateSessionSaveInput({
  sessionId: 'session_12345678', learningCode: 'A7M4', aiStudentId: 'nope', topic: 'favorites', targetDurationMinutes: 3, startedAt: 1000, endedAt: 2000, history,
});
assert.equal(badStudent.ok, false);
const badDuration = validateSessionSaveInput({
  sessionId: 'session_12345678', learningCode: 'A7M4', aiStudentId: 'emma_usa', topic: 'favorites', targetDurationMinutes: 10, startedAt: 1000, endedAt: 2000, history,
});
assert.equal(badDuration.ok, false);

const privateHistory = canonicalizeHistory([{ id: 'p', sender: 'child', englishText: 'My email is child@example.com and phone is 090-1234-5678.', timestamp: 1000 }]);
const maskedHistory = maskHistoryForStorage(privateHistory);
assert.equal(maskedHistory[0].englishText.includes('child@example.com'), false);
assert.equal(maskedHistory[0].englishText.includes('090-1234-5678'), false);
const copied = safePlainTextForClipboard('Email child@example.com phone 090-1234-5678');
assert.equal(copied.includes('child@example.com'), false);
assert.equal(copied.includes('090-1234-5678'), false);

const persistenceSource = await readFile('src/server/persistence.ts', 'utf8');
assert.ok(persistenceSource.includes("const TEACHER_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'"));
assert.ok(persistenceSource.includes('teacherStudentId: tid'));
assert.ok(persistenceSource.includes('class_id: session.classId'));
assert.equal(persistenceSource.includes('child_utterances:'), false, 'Research export must not contain raw learner utterances');
const serverSource = await readFile('server.ts', 'utf8');
assert.ok(serverSource.includes('teacherStudentId:created.teacherStudentId'));
const managementSource = await readFile('src/server/managementPage.ts', 'utf8');
assert.ok(managementSource.includes("String(d.teacherStudentId||'----')"));

console.log('DATA CONTRACT QA PASS');
