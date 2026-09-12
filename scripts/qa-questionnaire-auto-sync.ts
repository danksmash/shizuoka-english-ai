import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  QUESTIONNAIRE_POST_FORM_ID,
  QUESTIONNAIRE_PRE_FORM_ID,
  canonicalQuestionnaireAutoPayload,
  computeQuestionnaireAutoSignature,
  isFormalStudy1Participant,
  normalizeQuestionnaireSubmittedAt,
  questionnaireWaveForFormId,
  verifyQuestionnaireAutoSignature,
  type QuestionnaireAutoIngestPayload,
} from '../src/server/questionnaireAutoSync';

assert.equal(questionnaireWaveForFormId(QUESTIONNAIRE_PRE_FORM_ID), 'pre_app');
assert.equal(questionnaireWaveForFormId(QUESTIONNAIRE_POST_FORM_ID), 'post_exchange');
assert.equal(questionnaireWaveForFormId('unknown-form'), null);

assert.equal(isFormalStudy1Participant({ classId: '5-1', attendanceNumber: 1 }), true);
assert.equal(isFormalStudy1Participant({ classId: '5-1', attendanceNumber: 26 }), true);
assert.equal(isFormalStudy1Participant({ classId: '5-1', attendanceNumber: 27 }), false);
assert.equal(isFormalStudy1Participant({ classId: '5-2', attendanceNumber: 25 }), true);
assert.equal(isFormalStudy1Participant({ classId: '5-3', attendanceNumber: 25 }), true);
assert.equal(isFormalStudy1Participant({ classId: '6-1', attendanceNumber: 34 }), true);
assert.equal(isFormalStudy1Participant({ classId: '6-2', attendanceNumber: 35 }), true);
assert.equal(isFormalStudy1Participant({ classId: '6-3', attendanceNumber: 1 }), false);
assert.equal(isFormalStudy1Participant({ classId: '6-PB', attendanceNumber: 1 }), false);
assert.equal(isFormalStudy1Participant({ classId: 'テスト', attendanceNumber: 1 }), false);
assert.equal(isFormalStudy1Participant({ classId: '5-2', attendanceNumber: '' }), false);

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
assert.ok(entry.includes("this.use('/api/questionnaire-auto', createQuestionnaireAutoSyncRouter())"));
assert.ok(entry.includes('withQuestionnaireAutoSyncDashboardRuntime'));
assert.ok(route.includes("router.post('/ingest'"));
assert.ok(route.includes('QUESTIONNAIRE_INGEST_SECRET'));
assert.ok(route.includes('X-Questionnaire-Timestamp'));
assert.ok(route.includes('X-Questionnaire-Signature'));
assert.ok(core.includes('NOT_FORMAL_STUDY1_PARTICIPANT'));
assert.ok(core.includes('createDocumentIfAbsent'));
assert.ok(core.includes('QUESTIONNAIRE_SYNC_STATE_COLLECTION'));
assert.ok(manualRoute.includes('importStrictGoogleFormsQuestionnaireCsv'), 'manual CSV fallback must use the same formal-roster gate');
assert.ok(!manualRoute.includes('importGoogleFormsQuestionnaireCsv'), 'old permissive importer must not remain on the management route');
assert.ok(manualRoute.includes("router.post('/questionnaire/revision'"));
assert.ok(dashboardRuntime.includes('/api/management/questionnaire/revision'));
assert.ok(dashboardRuntime.includes('setInterval(pollQuestionnaireRevision,30000)'));
assert.ok(dashboardRuntime.includes('Pre M(SD)［paired］'));
assert.ok(dashboardRuntime.includes('Post M(SD)［paired］'));

console.log('Study 1 questionnaire auto-sync QA: PASS');
