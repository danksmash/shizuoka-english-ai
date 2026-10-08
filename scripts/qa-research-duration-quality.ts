import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateSessionSaveInput } from '../src/dataContract';
import { assessResearchDuration, rateEligibleDurationSeconds } from '../src/server/researchDurationQuality';
import { buildResearchSessionHistorySummary } from '../src/server/researchSessionHistoryRuntime';

const ordinary = { target_duration_minutes: 2, actual_duration_seconds: 120 };
assert.equal(assessResearchDuration(ordinary).quality, 'valid');
assert.equal(rateEligibleDurationSeconds(ordinary), 120);
assert.equal(rateEligibleDurationSeconds({ target_duration_minutes: 2, actual_duration_seconds: 3600 }), null);
assert.equal(assessResearchDuration({ target_duration_minutes: 2, actual_duration_seconds: 3600 }).reason, 'wall_clock_3600_cap');
assert.equal(assessResearchDuration({ target_duration_minutes: 5, actual_duration_seconds: 900 }).quality, 'needs_review');
assert.equal(assessResearchDuration({ target_duration_minutes: 1, actual_duration_seconds: 290 }).quality, 'needs_review');
assert.equal(rateEligibleDurationSeconds({ target_duration_minutes: 1, actual_duration_seconds: 0 }), null);
assert.equal(rateEligibleDurationSeconds({ target_duration_minutes: 5, actual_duration_seconds: 230, duration_quality: 'valid' }), 230);
assert.equal(rateEligibleDurationSeconds({ target_duration_minutes: 5, actual_duration_seconds: 230, duration_quality: 'invalid' }), null);

const baseInput = {
  sessionId: 'session_duration_qa_12345678', learningCode: 'A7M4',
  aiStudentId: 'emma_usa', topic: 'intro', targetDurationMinutes: 2,
  startedAt: 1_000_000, endedAt: 2_000_000,
  activeDialogueSeconds: 80,
  history: [{ id: 'child-test', sender: 'child', englishText: 'Hello.', timestamp: 1_060_000 }],
  systemEvents: [{ type: 'session_interrupted', timestamp: 2_000_000, value: 'background_timeout' }],
};
const valid = validateSessionSaveInput(baseInput);
assert.equal(valid.ok, true);
if (valid.ok) {
  assert.equal(valid.value.activeDialogueSeconds, 80);
  assert.equal(valid.value.systemEvents?.some((event) => event.type === 'session_interrupted'), true);
}
assert.equal(validateSessionSaveInput({ ...baseInput, activeDialogueSeconds: 700 }).ok, false);

const interrupted = buildResearchSessionHistorySummary({
  sessionId: 'session_duration_qa_12345678', researchId: 'RTEST001',
  aiStudentId: 'emma_usa', topic: 'intro', startedAt: '2026-10-08T00:00:00.000Z',
  endedAt: '2026-10-08T01:00:00.000Z',
  sessionStatus: 'interrupted', actualDurationSeconds: 80, totalTurns: 1, totalChildWords: 1,
  history: baseInput.history, systemEvents: baseInput.systemEvents,
  schemaVersion: 4,
});
assert.equal(interrupted.data_quality_flag, 'interrupted');
assert.equal(interrupted.actual_duration_seconds, 80);

const app = readFileSync('src/App.tsx', 'utf8');
const persistence = readFileSync('src/server/persistence.ts', 'utf8');
const server = readFileSync('server.ts', 'utf8');
assert.ok(app.includes("recordResearchEvent('session_interrupted', reason)"));
assert.ok(app.includes("document.addEventListener('visibilitychange', onVisibilityChange)"));
assert.ok(app.includes("activeDialogueSeconds: elapsedSecondsRef.current"));
assert.ok(!app.includes("recordResearchEvent('session_finish', 'background_timeout')"));
assert.ok(persistence.includes("sessionStatus = events.some((event) => event.type === 'session_interrupted')"));
assert.ok(server.includes('activeDialogueSeconds:validated.value.activeDialogueSeconds'));
console.log('Research duration / interruption QA PASS');
