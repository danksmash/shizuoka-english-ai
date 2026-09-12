import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  QUESTIONNAIRE_POST_FORM_ID,
  QUESTIONNAIRE_PRE_FORM_ID,
  canonicalQuestionnaireAutoPayload,
  computeQuestionnaireAutoSignature,
  formalStudy1ParticipantHash,
  isFormalStudy1Participant,
  isFormalStudy1ParticipantHash,
  normalizeQuestionnaireSubmittedAt,
  questionnaireWaveForFormId,
  verifyQuestionnaireAutoSignature,
  type QuestionnaireAutoIngestPayload,
} from '../src/server/questionnaireAutoSync';
import {
  STUDY1_FORMAL_PARTICIPANT_COUNT,
  STUDY1_FORMAL_PARTICIPANT_HASHES,
} from '../src/server/study1FormalParticipantHashes';

assert.equal(questionnaireWaveForFormId(QUESTIONNAIRE_PRE_FORM_ID), 'pre_app');
assert.equal(questionnaireWaveForFormId(QUESTIONNAIRE_POST_FORM_ID), 'post_exchange');
assert.equal(questionnaireWaveForFormId('unknown-form'), null);

assert.equal(STUDY1_FORMAL_PARTICIPANT_COUNT, 145);
assert.equal(STUDY1_FORMAL_PARTICIPANT_HASHES.size, 145);
assert.ok([...STUDY1_FORMAL_PARTICIPANT_HASHES].every((hash) => /^[0-9a-f]{64}$/.test(hash)));
const formalHash = [...STUDY1_FORMAL_PARTICIPANT_HASHES][0];
assert.equal(isFormalStudy1ParticipantHash(formalHash, '5-1', 1), true);
assert.equal(isFormalStudy1ParticipantHash(formalHash, '5-1', 26), true);
assert.equal(isFormalStudy1ParticipantHash(formalHash, '5-1', 27), false);
assert.equal(isFormalStudy1ParticipantHash(formalHash, '5-2', 25), true);
assert.equal(isFormalStudy1ParticipantHash(formalHash, '5-3', 25), true);
assert.equal(isFormalStudy1ParticipantHash(formalHash, '6-1', 34), true);
assert.equal(isFormalStudy1ParticipantHash(formalHash, '6-2', 35), true);
assert.equal(isFormalStudy1ParticipantHash(formalHash, '6-3', 1), false);
assert.equal(isFormalStudy1ParticipantHash(formalHash, '6-PB', 1), false);
assert.equal(isFormalStudy1ParticipantHash(formalHash, 'テスト', 1), false);
assert.equal(isFormalStudy1ParticipantHash(formalHash, '5-2', ''), false);
assert.equal(STUDY1_FORMAL_PARTICIPANT_HASHES.has(formalStudy1ParticipantHash('not-a-formal-student-uuid')), false);
assert.equal(isFormalStudy1Participant({ studentId: 'not-a-formal-student-uuid', classId: '5-1', attendanceNumber: 1 }), false);

// Slash-formatted Google Forms timestamps must be interpreted as Japan local time,
// not as the Cloud Run host timezone. Milliseconds are normalized away so auto
// and manual fallback imports produce the same deterministic response ID input.
assert.equal(normalizeQuestionnaireSubmittedAt('2026/09/17 09:30:15'), '2026-09-17T00:30:15.000Z');
assert.equal(normalizeQuestionnaireSubmittedAt('2026-09-17T00:30:15.987Z'), '2026-09-17T00:30:15.000Z');
assert.equal(normalizeQuestionnaireSubmittedAt('not-a-date'), '');

const answers = Object.fromEntries([
  ...Array.from({ length: 5 }, (_, i) => [`1-${i + 1}`, 'よくあてはまる']),
  ...Array.from({ length: 5 }, (_, i) => [`2-${i + 1}`, 'あてはまる']),
  ...Array.from({ length: 5 }, (_, i) => [`3-${i + 1}`, 'まあまああてはまる']),
]);
const payload: QuestionnaireAutoIngestPayload = {
  formId: QUESTIONNAIRE_PRE_FORM_ID,
  formResponseId: '2_ABaOnufakeResponseId',
  submittedAt: '2026-09-17T00:30:15.987Z',
  learningCode: '7k8m',
  answers,
};
const canonical = canonicalQuestionnaireAutoPayload(payload);
assert.ok(canonical.includes('"learningCode":"7K8M"'));
assert.ok(canonical.indexOf('"1-1"') < canonical.indexOf('"3-5"'));

const secret = 'qa-secret-with-enough-entropy-for-tests-only';
const now = Date.parse('2026-09-17T00:30:30.000Z');
const requestTimestamp = String(Math.floor(now / 1000));
const signature = computeQuestionnaireAutoSignature(secret, requestTimestamp, payload);
assert.match(signature, /^[0-9a-f]{64}$/);
assert.equal(verifyQuestionnaireAutoSignature(secret, requestTimestamp, signature, payload, now), true);
assert.equal(verifyQuestionnaireAutoSignature(secret, requestTimestamp, '0'.repeat(64), payload, now), false);
assert.equal(verifyQuestionnaireAutoSignature(secret, String(Math.floor((now - 301_000) / 1000)), signature, payload, now), false);
assert.equal(verifyQuestionnaireAutoSignature('', requestTimestamp, signature, payload, now), false);

const entry = fs.readFileSync('server-entry.ts', 'utf8');
const route = fs.readFileSync('src/server/questionnaireAutoSyncRoutes.ts', 'utf8');
const manualRoute = fs.readFileSync('src/server/questionnaireRoutes.ts', 'utf8');
const core = fs.readFileSync('src/server/questionnaireAutoSync.ts', 'utf8');
const dashboardRuntime = fs.readFileSync('src/server/questionnaireAutoSyncDashboardRuntime.ts', 'utf8');
const participantHashes = fs.readFileSync('src/server/study1FormalParticipantHashes.ts', 'utf8');
assert.ok(entry.includes("this.use('/api/questionnaire-auto', createQuestionnaireAutoSyncRouter())"));
assert.ok(entry.includes('withQuestionnaireAutoSyncDashboardRuntime'));
assert.ok(route.includes("router.post('/ingest'"));
assert.ok(route.includes('QUESTIONNAIRE_INGEST_SECRET'));
assert.ok(route.includes('X-Questionnaire-Timestamp'));
assert.ok(route.includes('X-Questionnaire-Signature'));
assert.ok(core.includes('NOT_FORMAL_STUDY1_PARTICIPANT'));
assert.ok(core.includes('STUDY1_FORMAL_PARTICIPANT_HASHES'));
assert.ok(core.includes('createDocumentIfAbsent'));
assert.ok(core.includes('QUESTIONNAIRE_SYNC_STATE_COLLECTION'));
assert.equal((participantHashes.match(/[0-9a-f]{64}/g) || []).length, 145, 'allowlist file must contain exactly 145 irreversible hashes');
assert.ok(!participantHashes.includes('learningCode') && !participantHashes.includes('researchId') && !participantHashes.includes('studentId:'), 'allowlist source must not expose operational identifiers');
assert.ok(manualRoute.includes('importStrictGoogleFormsQuestionnaireCsv'), 'manual CSV fallback must use the same formal-roster gate');
assert.ok(!manualRoute.includes('importGoogleFormsQuestionnaireCsv'), 'old permissive importer must not remain on the management route');
assert.ok(manualRoute.includes("router.post('/questionnaire/revision'"));
assert.ok(dashboardRuntime.includes('/api/management/questionnaire/revision'));
assert.ok(dashboardRuntime.includes('setInterval(pollQuestionnaireRevision,30000)'));
assert.ok(dashboardRuntime.includes('Pre M(SD)［paired］'));
assert.ok(dashboardRuntime.includes('Post M(SD)［paired］'));

console.log('Study 1 questionnaire auto-sync QA: PASS');
