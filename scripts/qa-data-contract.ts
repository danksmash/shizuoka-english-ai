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
assert.ok(persistenceSource.includes('learningId: normalized'), 'Teacher-facing learner ID must be the distributed four-character ID');
assert.ok(persistenceSource.includes('attendanceNumber'), 'Attendance number must be stored separately from names');
assert.ok(persistenceSource.includes('learnerTeacherVisibleSession'), 'Learner/teacher ordinary views must exclude checkpoint-only sessions');
assert.equal(persistenceSource.includes('child_utterances:'), false, 'Persistence must not create a raw research-export field');
const researchExportSource = await readFile('src/server/researchExport.ts', 'utf8');
assert.ok(researchExportSource.includes('reflection_conveyed_ideas'));
assert.ok(researchExportSource.includes('reflection_understood_partner'));
assert.ok(researchExportSource.includes('reflection_noticed_language_culture'));
assert.ok(!researchExportSource.includes('learningId'), 'Research export must not expose learner IDs');
const serverSource = await readFile('server.ts', 'utf8');
assert.ok(serverSource.includes('learningId:created.learningId'));
assert.ok(serverSource.includes("requireManagementRole(['teacher'])"));
assert.ok(serverSource.includes("requireManagementRole(['researcher'])"));
const managementSource = await readFile('src/server/managementPage.ts', 'utf8');
assert.ok(managementSource.includes('learningId'));
assert.ok(managementSource.includes('/api/management/research.csv'));
assert.ok(managementSource.includes('児童の生の発話本文を表示しません'));

console.log('DATA CONTRACT QA PASS');
