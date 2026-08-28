import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canonicalizeHistory, maskHistoryForStorage, validateSessionSaveInput } from '../src/dataContract';
import { safePlainTextForClipboard } from '../src/utils/privacy';

const history = canonicalizeHistory([
  { id: 'a', sender: 'ai', englishText: 'Hello!', japaneseText: 'こんにちは！', timestamp: 1000 },
  { id: 'b', sender: 'child', englishText: 'I like soccer.', japaneseText: 'サッカーが好きです。', timestamp: 1500 },
]);
const valid = validateSessionSaveInput({
  sessionId: 'session_12345678', learningCode: 'A7M4', aiStudentId: 'emma_usa', topic: 'favorites', targetDurationMinutes: 3, startedAt: 1000, endedAt: 2000, history,
});
assert.equal(valid.ok, true);
for (const code of ['A7M', 'A7M45', 'A-7M', '']) {
  const result = validateSessionSaveInput({ sessionId: 'session_12345678', learningCode: code, aiStudentId: 'emma_usa', topic: 'favorites', targetDurationMinutes: 3, startedAt: 1000, endedAt: 2000, history });
  assert.equal(result.ok, false, `Invalid learner code accepted: ${code}`);
}
for (const duration of [1,2,3,5]) {
  const result = validateSessionSaveInput({ sessionId: 'session_12345678', learningCode: 'A7M4', aiStudentId: 'emma_usa', topic: 'favorites', targetDurationMinutes: duration, startedAt: 1000, endedAt: 2000, history });
  assert.equal(result.ok, true, `Valid duration rejected: ${duration}`);
}
const badDuration = validateSessionSaveInput({ sessionId: 'session_12345678', learningCode: 'A7M4', aiStudentId: 'emma_usa', topic: 'favorites', targetDurationMinutes: 10, startedAt: 1000, endedAt: 2000, history });
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
assert.ok(persistenceSource.includes('reflection_conveyed_ideas'));
assert.ok(persistenceSource.includes('reflection_understood_partner'));
assert.ok(persistenceSource.includes('reflection_noticed_language_culture'));
const serverSource = await readFile('server.ts', 'utf8');
assert.ok(serverSource.includes('teacherStudentId:created.teacherStudentId'));
assert.ok(serverSource.includes("requireManagementRole(['teacher'])"));
assert.ok(serverSource.includes("requireManagementRole(['researcher'])"));
const managementSource = await readFile('src/server/managementPage.ts', 'utf8');
assert.ok(managementSource.includes('teacherStudentId'));
assert.ok(managementSource.includes('/api/management/research.csv'));
assert.ok(managementSource.includes('児童の生の発話本文を表示しません'));

console.log('DATA CONTRACT QA PASS');
