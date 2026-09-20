import express from 'express';
import { requireManagementRole } from './auth';
import { getDocument } from './firestore';
import { buildQuestionnaireDescriptiveStatistics } from './questionnaireDescriptive';
import { buildQuestionnaireLmmTrialBundle } from './questionnaireLmmTrial';
import { buildQuestionnaireTimingAudit } from './questionnaireTimingAudit';
import { getAllStudySchedules } from './studySchedulePersistence';
import {
  buildQuestionnaireStatistics,
  getAllQuestionnaireRecords,
  type QuestionnaireWave,
} from './questionnaireResearch';
import {
  importStrictGoogleFormsQuestionnaireCsv,
  QUESTIONNAIRE_SYNC_STATE_COLLECTION,
  QUESTIONNAIRE_SYNC_STATE_DOCUMENT,
} from './questionnaireAutoSync';

const router = express.Router();

function wave(value: unknown): QuestionnaireWave | null {
  if (value === 'pre_app' || value === 'mid_pre_reveal' || value === 'post_pre_exchange') return value;
  if (value === 'post_exchange') return 'post_pre_exchange';
  return null;
}

router.post('/questionnaire/import', requireManagementRole(['researcher']), async (req, res) => {
  try {
    const surveyWave = wave(req.body?.surveyWave);
    const csvText = typeof req.body?.csvText === 'string' ? req.body.csvText : '';
    if (!surveyWave) return res.status(400).json({ success: false, error: 'INVALID_SURVEY_WAVE' });
    if (!csvText || csvText.length > 450_000) return res.status(400).json({ success: false, error: 'INVALID_QUESTIONNAIRE_CSV' });
    const result = await importStrictGoogleFormsQuestionnaireCsv(csvText, surveyWave);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Questionnaire import failed', { message: error?.message });
    const validation = String(error?.message || '').startsWith('QUESTIONNAIRE_') || String(error?.message || '').startsWith('INVALID_');
    return res.status(validation ? 400 : 503).json({ success: false, error: validation ? String(error.message) : 'QUESTIONNAIRE_IMPORT_UNAVAILABLE' });
  }
});

router.post('/questionnaire/statistics', requireManagementRole(['researcher']), async (_req, res) => {
  try {
    const records = await getAllQuestionnaireRecords();
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, ...buildQuestionnaireStatistics(records) });
  } catch (error: any) {
    console.error('Questionnaire statistics failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'QUESTIONNAIRE_STATISTICS_UNAVAILABLE' });
  }
});

router.post('/questionnaire/analysis', requireManagementRole(['researcher']), async (_req, res) => {
  try {
    const [records, state, schedules] = await Promise.all([
      getAllQuestionnaireRecords(),
      getDocument(QUESTIONNAIRE_SYNC_STATE_COLLECTION, QUESTIONNAIRE_SYNC_STATE_DOCUMENT),
      getAllStudySchedules().catch((error: any) => {
        console.warn('Questionnaire timing audit schedule read unavailable', { message: error?.message });
        return [];
      }),
    ]);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      statistics: buildQuestionnaireStatistics(records),
      descriptive: buildQuestionnaireDescriptiveStatistics(records),
      timingAudit: buildQuestionnaireTimingAudit(records, schedules),
      revision: {
        lastIngestedAt: String(state?.lastIngestedAt || ''),
        lastResponseId: String(state?.lastResponseId || ''),
        lastSurveyWave: String(state?.lastSurveyWave || ''),
      },
    });
  } catch (error: any) {
    console.error('Questionnaire analysis failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'QUESTIONNAIRE_ANALYSIS_UNAVAILABLE' });
  }
});

router.post('/questionnaire/lmm-trial', requireManagementRole(['researcher']), async (_req, res) => {
  try {
    const records = await getAllQuestionnaireRecords();
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, ...buildQuestionnaireLmmTrialBundle(records) });
  } catch (error: any) {
    console.error('Questionnaire LMM trial failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'QUESTIONNAIRE_LMM_TRIAL_UNAVAILABLE' });
  }
});

router.post('/questionnaire/descriptive', requireManagementRole(['researcher']), async (_req, res) => {
  try {
    const records = await getAllQuestionnaireRecords();
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, ...buildQuestionnaireDescriptiveStatistics(records) });
  } catch (error: any) {
    console.error('Questionnaire descriptive statistics failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'QUESTIONNAIRE_DESCRIPTIVE_UNAVAILABLE' });
  }
});

router.post('/questionnaire/revision', requireManagementRole(['researcher']), async (_req, res) => {
  try {
    const state = await getDocument(QUESTIONNAIRE_SYNC_STATE_COLLECTION, QUESTIONNAIRE_SYNC_STATE_DOCUMENT);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      lastIngestedAt: String(state?.lastIngestedAt || ''),
      lastResponseId: String(state?.lastResponseId || ''),
      lastSurveyWave: String(state?.lastSurveyWave || ''),
    });
  } catch (error: any) {
    console.error('Questionnaire revision read failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'QUESTIONNAIRE_REVISION_UNAVAILABLE' });
  }
});

export function createQuestionnaireRouter() {
  return router;
}
