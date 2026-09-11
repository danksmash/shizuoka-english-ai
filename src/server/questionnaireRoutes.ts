import express from 'express';
import { requireManagementRole } from './auth';
import {
  buildQuestionnaireExportRows,
  buildQuestionnaireStatistics,
  getAllQuestionnaireRecords,
  importGoogleFormsQuestionnaireCsv,
  serializeQuestionnaireCsv,
  type QuestionnaireWave,
} from './questionnaireResearch';

const router = express.Router();

function wave(value: unknown): QuestionnaireWave | null {
  return value === 'pre_app' || value === 'post_exchange' ? value : null;
}

router.post('/questionnaire/import', requireManagementRole(['researcher']), async (req, res) => {
  try {
    const surveyWave = wave(req.body?.surveyWave);
    const csvText = typeof req.body?.csvText === 'string' ? req.body.csvText : '';
    if (!surveyWave) return res.status(400).json({ success: false, error: 'INVALID_SURVEY_WAVE' });
    if (!csvText || csvText.length > 2_000_000) return res.status(400).json({ success: false, error: 'INVALID_QUESTIONNAIRE_CSV' });
    const result = await importGoogleFormsQuestionnaireCsv(csvText, surveyWave);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Questionnaire import failed', { message: error?.message });
    const validation = String(error?.message || '').startsWith('QUESTIONNAIRE_') || String(error?.message || '').startsWith('INVALID_');
    return res.status(validation ? 400 : 503).json({ success: false, error: validation ? String(error.message) : 'QUESTIONNAIRE_IMPORT_UNAVAILABLE' });
  }
});

router.get('/questionnaire/statistics', requireManagementRole(['researcher']), async (_req, res) => {
  try {
    const records = await getAllQuestionnaireRecords();
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, ...buildQuestionnaireStatistics(records) });
  } catch (error: any) {
    console.error('Questionnaire statistics failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'QUESTIONNAIRE_STATISTICS_UNAVAILABLE' });
  }
});

router.get('/questionnaire/export.csv', requireManagementRole(['researcher']), async (req, res) => {
  try {
    const rows = buildQuestionnaireExportRows(await getAllQuestionnaireRecords(), req.query as Record<string, unknown>);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="student_questionnaires.csv"');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(serializeQuestionnaireCsv(rows));
  } catch (error: any) {
    console.error('Questionnaire export failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'QUESTIONNAIRE_EXPORT_UNAVAILABLE' });
  }
});

export function createQuestionnaireRouter() {
  return router;
}
