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
  type QuestionnaireRecord,
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

function legacyStatisticsInput(records: QuestionnaireRecord[]) {
  const comparisonRecords = records.filter((record) => record.schoolCondition === 'comparison');
  if (!comparisonRecords.length) {
    return {
      records,
      scope: 'all_records_legacy_compatible',
      comparisonExcluded: 0,
    };
  }
  return {
    records: records.filter((record) => record.schoolCondition !== 'comparison'),
    scope: 'intervention_only_comparison_excluded',
    comparisonExcluded: comparisonRecords.length,
  };
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
    const legacy = legacyStatisticsInput(records);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      ...buildQuestionnaireStatistics(legacy.records),
      legacyStatisticsScope: legacy.scope,
      comparisonExcludedFromLegacyStatistics: legacy.comparisonExcluded,
    });
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
    const legacy = legacyStatisticsInput(records);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      statistics: {
        ...buildQuestionnaireStatistics(legacy.records),
        legacyStatisticsScope: legacy.scope,
        comparisonExcludedFromLegacyStatistics: legacy.comparisonExcluded,
      },
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
