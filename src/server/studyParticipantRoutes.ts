import express from 'express';
import { requireManagementRole, type AuthenticatedRequest } from './auth';
import {
  getStudentRecordsForManagement,
  updateStudentStudyMetadata,
  type ResearchStudyMetadataUpdateInput,
} from './persistence';

const router = express.Router();

router.get('/study-participants', requireManagementRole(['researcher']), async (_req, res) => {
  try {
    const students = await getStudentRecordsForManagement();
    const rows = students
      .filter((student) => student.formalStudyParticipant)
      .map((student) => ({
        researchId: student.researchId,
        classId: student.classId,
        gradeLevel: student.gradeLevel,
        active: student.active,
        studySiteId: student.studySiteId,
        schoolCondition: student.schoolCondition,
        studyStartDate: student.studyStartDate,
      }))
      .sort((a, b) => String(a.studySiteId).localeCompare(String(b.studySiteId))
        || String(a.classId).localeCompare(String(b.classId), 'ja')
        || String(a.researchId).localeCompare(String(b.researchId)));
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      participants: rows,
      counts: {
        total: rows.length,
        intervention: rows.filter((row) => row.schoolCondition === 'intervention').length,
        comparison: rows.filter((row) => row.schoolCondition === 'comparison').length,
      },
    });
  } catch (error: any) {
    console.error('Study participant list failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'STUDY_PARTICIPANTS_UNAVAILABLE' });
  }
});

router.post('/study-participants/metadata', requireManagementRole(['researcher']), async (req: AuthenticatedRequest, res) => {
  try {
    const inputs = Array.isArray(req.body?.participants) ? req.body.participants as ResearchStudyMetadataUpdateInput[] : [];
    if (!inputs.length || inputs.length > 250) {
      return res.status(400).json({ success: false, error: 'INVALID_RESEARCH_STUDY_METADATA_BATCH' });
    }
    const results = await updateStudentStudyMetadata(inputs, req.managementUser?.username || 'researcher');
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, updated: results.filter((row) => row.changed).length, results });
  } catch (error: any) {
    const message = String(error?.message || '');
    console.error('Study participant metadata update failed', { message });
    const validation = /^(?:INVALID_|FORMAL_|COMPARISON_|INTERVENTION_|RESEARCH_PARTICIPANT_)/.test(message);
    return res.status(validation ? 400 : 503).json({
      success: false,
      error: validation ? message : 'STUDY_PARTICIPANT_UPDATE_UNAVAILABLE',
    });
  }
});

export function createStudyParticipantRouter() {
  return router;
}
