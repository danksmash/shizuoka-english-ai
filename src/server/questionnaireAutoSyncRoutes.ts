import express from 'express';
import {
  ingestQuestionnaireAutoSubmission,
  verifyQuestionnaireAutoSignature,
  type QuestionnaireAutoIngestPayload,
} from './questionnaireAutoSync';

const router = express.Router();

function payloadFromBody(value: unknown): QuestionnaireAutoIngestPayload | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as Record<string, unknown>;
  if (!body.answers || typeof body.answers !== 'object' || Array.isArray(body.answers)) return null;
  return {
    formId: String(body.formId ?? ''),
    formResponseId: String(body.formResponseId ?? ''),
    submittedAt: String(body.submittedAt ?? ''),
    learningCode: String(body.learningCode ?? ''),
    answers: body.answers as Record<string, unknown>,
  };
}

router.post('/ingest', async (req, res) => {
  try {
    // Secret Manager values can accidentally include a trailing newline when
    // provisioned from shell output (for example `openssl rand -hex 32`).
    // Apps Script properties are normalized before signing, so normalize the
    // injected Cloud Run value too. This preserves fail-closed HMAC auth while
    // preventing invisible surrounding whitespace from breaking signatures.
    const secret = String(process.env.QUESTIONNAIRE_INGEST_SECRET || '').trim();
    if (!secret) return res.status(503).json({ success: false, error: 'QUESTIONNAIRE_AUTO_SYNC_NOT_CONFIGURED' });

    const payload = payloadFromBody(req.body);
    if (!payload) return res.status(400).json({ success: false, error: 'INVALID_QUESTIONNAIRE_AUTO_PAYLOAD' });

    const timestamp = req.header('X-Questionnaire-Timestamp') || '';
    const signature = req.header('X-Questionnaire-Signature') || '';
    if (!verifyQuestionnaireAutoSignature(secret, timestamp, signature, payload)) {
      return res.status(401).json({ success: false, error: 'INVALID_QUESTIONNAIRE_SIGNATURE' });
    }

    const result = await ingestQuestionnaireAutoSubmission(payload);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, ...result });
  } catch (error: any) {
    const message = String(error?.message || 'QUESTIONNAIRE_AUTO_SYNC_FAILED');
    const validation = message.startsWith('INVALID_')
      || message.startsWith('UNKNOWN_QUESTIONNAIRE_FORM')
      || message.startsWith('FORM_RESPONSE_ID_MISSING')
      || message.startsWith('LEARNING_CODE_NOT_FOUND')
      || message.startsWith('NOT_FORMAL_STUDY1_PARTICIPANT')
      || message.startsWith('NOT_MAIN_STUDY_CLASS');
    console.error('Questionnaire auto ingest failed', { message });
    return res.status(validation ? 400 : 503).json({
      success: false,
      error: validation ? message : 'QUESTIONNAIRE_AUTO_SYNC_UNAVAILABLE',
    });
  }
});

export function createQuestionnaireAutoSyncRouter() {
  return router;
}
