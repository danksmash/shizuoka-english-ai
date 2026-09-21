import assert from 'node:assert/strict';
import {
  QUESTIONNAIRE_MID_FORM_ID,
  computeQuestionnaireAutoSignature,
  type QuestionnaireAutoIngestPayload,
} from '../src/server/questionnaireAutoSync';

const apiUrl = String(process.env.API_URL || 'https://shizuoka-english-ai-1075707511474.asia-northeast1.run.app').replace(/\/$/, '');
const secret = String(process.env.QUESTIONNAIRE_INGEST_SECRET || '').trim();

assert.ok(secret, 'QUESTIONNAIRE_INGEST_SECRET is required for the signed production smoke');
assert.ok(QUESTIONNAIRE_MID_FORM_ID, 'Mid questionnaire form ID must be configured');

const requestTimestamp = String(Date.now());
const payload: QuestionnaireAutoIngestPayload = {
  formId: QUESTIONNAIRE_MID_FORM_ID,
  formResponseId: `production-mid-signed-probe-${requestTimestamp}`,
  submittedAt: new Date().toISOString(),
  // Intentionally invalid and impossible for a formal participant.
  // The request must pass HMAC + form-wave recognition and then fail before
  // any questionnaire item parsing or Firestore write can occur.
  learningCode: '0000',
  answers: {},
};

const signature = computeQuestionnaireAutoSignature(secret, requestTimestamp, payload);
const response = await fetch(`${apiUrl}/api/questionnaire-auto/ingest`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Questionnaire-Timestamp': requestTimestamp,
    'X-Questionnaire-Signature': signature,
  },
  body: JSON.stringify(payload),
});

const body = await response.json().catch(() => ({})) as Record<string, unknown>;

assert.equal(response.status, 400, `expected 400, got ${response.status}: ${JSON.stringify(body)}`);
assert.equal(
  body.error,
  'INVALID_LEARNING_CODE',
  `signed Mid request did not reach the expected post-auth/post-form validation point: ${JSON.stringify(body)}`,
);

console.log(
  `QUESTIONNAIRE MID SIGNED PRODUCTION SMOKE PASS: HMAC accepted; Mid form recognized; write safely blocked before participant lookup/items.`,
);
