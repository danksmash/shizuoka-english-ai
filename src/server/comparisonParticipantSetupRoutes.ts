import crypto from 'node:crypto';
import express from 'express';
import { requireManagementRole, type AuthenticatedRequest } from './auth';
import {
  createStudentCode,
  getStudentRecordsForManagement,
  setStudentActive,
  updateStudentClass,
  updateStudentStudyMetadata,
} from './persistence';
import { validComparisonClassId } from './studyParticipantMetadata';

const router = express.Router();
const LEARNING_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function normalizeClassId(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function normalizeCount(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function normalizeIsoDate(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function gradeForClassId(classId: string): 5 | 6 {
  return classId.startsWith('5-') ? 5 : 6;
}

function reserveClassId(classId: string): string {
  return `${classId}-R`;
}

function randomLearningCode(): string {
  let code = '';
  for (let index = 0; index < 4; index += 1) {
    code += LEARNING_CODE_ALPHABET[crypto.randomInt(0, LEARNING_CODE_ALPHABET.length)];
  }
  return code;
}

async function createUniqueStudentCode(classId: string, attendanceNumber: number) {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    try {
      return await createStudentCode(randomLearningCode(), undefined, undefined, classId, undefined, attendanceNumber);
    } catch (error: any) {
      if (String(error?.message || '') === 'LEARNING_CODE_ALREADY_EXISTS') continue;
      throw error;
    }
  }
  throw new Error('LEARNING_CODE_GENERATION_EXHAUSTED');
}

function operationalRow(student: Awaited<ReturnType<typeof getStudentRecordsForManagement>>[number]) {
  return {
    learningCode: student.learningId,
    researchId: student.researchId,
    classId: student.classId,
    attendanceNumber: student.attendanceNumber,
    active: student.active,
    formalStudyParticipant: student.formalStudyParticipant,
    studySiteId: student.studySiteId,
    schoolCondition: student.schoolCondition,
    gradeLevel: student.gradeLevel,
    studyStartDate: student.studyStartDate,
  };
}

router.get('/comparison-participants/setup', requireManagementRole(['researcher']), async (req, res) => {
  try {
    const classId = normalizeClassId(req.query.classId || '6-C1');
    if (!validComparisonClassId(classId)) return res.status(400).json({ success: false, error: 'INVALID_COMPARISON_CLASS_ID' });
    const reserveId = reserveClassId(classId);
    const rows = (await getStudentRecordsForManagement())
      .filter((student) => student.classId === classId || student.classId === reserveId)
      .sort((a, b) => Number(a.attendanceNumber || 999) - Number(b.attendanceNumber || 999));
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      classId,
      reserveClassId: reserveId,
      participantCount: rows.filter((row) => row.classId === classId).length,
      formalParticipantCount: rows.filter((row) => row.classId === classId && row.formalStudyParticipant).length,
      reserveCount: rows.filter((row) => row.classId === reserveId).length,
      rows: rows.map(operationalRow),
    });
  } catch (error: any) {
    console.error('Comparison participant setup status failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'COMPARISON_SETUP_STATUS_UNAVAILABLE' });
  }
});

router.post('/comparison-participants/bootstrap', requireManagementRole(['researcher']), async (req: AuthenticatedRequest, res) => {
  try {
    const classId = normalizeClassId(req.body?.classId || '6-C1');
    if (!validComparisonClassId(classId)) return res.status(400).json({ success: false, error: 'INVALID_COMPARISON_CLASS_ID' });
    const actualCount = normalizeCount(req.body?.actualCount, 28, 1, 60);
    const reserveCount = normalizeCount(req.body?.reserveCount, 1, 0, 5);
    const reserveId = reserveClassId(classId);
    const existing = await getStudentRecordsForManagement();
    const existingByKey = new Map(existing.map((student) => [`${student.classId}:${student.attendanceNumber}`, student]));
    const created: Array<Record<string, unknown>> = [];
    const reused: Array<Record<string, unknown>> = [];

    for (let attendanceNumber = 1; attendanceNumber <= actualCount; attendanceNumber += 1) {
      const key = `${classId}:${attendanceNumber}`;
      const current = existingByKey.get(key);
      if (current) {
        reused.push(operationalRow(current));
        continue;
      }
      const student = await createUniqueStudentCode(classId, attendanceNumber);
      created.push({
        learningCode: student.learningId,
        researchId: student.researchId,
        classId: student.classId,
        attendanceNumber: student.attendanceNumber,
        active: true,
        formalStudyParticipant: false,
      });
    }

    for (let offset = 1; offset <= reserveCount; offset += 1) {
      const attendanceNumber = actualCount + offset;
      const key = `${reserveId}:${attendanceNumber}`;
      const current = existingByKey.get(key);
      if (current) {
        reused.push(operationalRow(current));
        continue;
      }
      const student = await createUniqueStudentCode(reserveId, attendanceNumber);
      await setStudentActive(student.studentId, false);
      created.push({
        learningCode: student.learningId,
        researchId: student.researchId,
        classId: reserveId,
        attendanceNumber: student.attendanceNumber,
        active: false,
        formalStudyParticipant: false,
      });
    }

    const finalRows = (await getStudentRecordsForManagement())
      .filter((student) => student.classId === classId || student.classId === reserveId)
      .sort((a, b) => Number(a.attendanceNumber || 999) - Number(b.attendanceNumber || 999));

    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      classId,
      actualCount,
      reserveCount,
      createdCount: created.length,
      reusedCount: reused.length,
      created,
      reused,
      rows: finalRows.map(operationalRow),
      note: 'ID発行時点ではformalStudyParticipant=false。正式開始日を登録するまで本研究参加者にはしない。',
    });
  } catch (error: any) {
    const message = String(error?.message || '');
    console.error('Comparison participant bootstrap failed', { message });
    const validation = /^(?:INVALID_|LEARNING_CODE_)/.test(message);
    return res.status(validation ? 400 : 503).json({
      success: false,
      error: validation ? message : 'COMPARISON_BOOTSTRAP_UNAVAILABLE',
    });
  }
});

router.post('/comparison-participants/activate', requireManagementRole(['researcher']), async (req: AuthenticatedRequest, res) => {
  try {
    const classId = normalizeClassId(req.body?.classId || '6-C1');
    if (!validComparisonClassId(classId)) return res.status(400).json({ success: false, error: 'INVALID_COMPARISON_CLASS_ID' });
    const actualCount = normalizeCount(req.body?.actualCount, 28, 1, 60);
    const studyStartDate = normalizeIsoDate(req.body?.studyStartDate);
    if (!studyStartDate) return res.status(400).json({ success: false, error: 'INVALID_STUDY_START_DATE' });
    const grade = gradeForClassId(classId);
    const students = (await getStudentRecordsForManagement())
      .filter((student) => student.classId === classId && student.active)
      .filter((student) => Number(student.attendanceNumber) >= 1 && Number(student.attendanceNumber) <= actualCount)
      .sort((a, b) => Number(a.attendanceNumber) - Number(b.attendanceNumber));
    const attendance = new Set(students.map((student) => Number(student.attendanceNumber)));
    if (students.length !== actualCount || attendance.size !== actualCount) {
      return res.status(409).json({
        success: false,
        error: 'COMPARISON_PARTICIPANT_COUNT_MISMATCH',
        expected: actualCount,
        actual: students.length,
      });
    }
    const inputs = students.map((student) => ({
      researchId: student.researchId,
      formalStudyParticipant: true,
      studySiteId: 'site_b',
      schoolCondition: 'comparison',
      studyGradeLevel: grade,
      studyStartDate,
    }));
    const results = await updateStudentStudyMetadata(inputs, req.managementUser?.username || 'researcher');
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      classId,
      studyStartDate,
      participantCount: results.length,
      updated: results.filter((row) => row.changed).length,
      results,
    });
  } catch (error: any) {
    const message = String(error?.message || '');
    console.error('Comparison participant activation failed', { message });
    const validation = /^(?:INVALID_|FORMAL_|COMPARISON_|RESEARCH_PARTICIPANT_)/.test(message);
    return res.status(validation ? 400 : 503).json({
      success: false,
      error: validation ? message : 'COMPARISON_ACTIVATION_UNAVAILABLE',
    });
  }
});

router.post('/comparison-participants/activate-reserve', requireManagementRole(['researcher']), async (req: AuthenticatedRequest, res) => {
  try {
    const classId = normalizeClassId(req.body?.classId || '6-C1');
    if (!validComparisonClassId(classId)) return res.status(400).json({ success: false, error: 'INVALID_COMPARISON_CLASS_ID' });
    const attendanceNumber = normalizeCount(req.body?.attendanceNumber, 29, 1, 99);
    const studyStartDate = normalizeIsoDate(req.body?.studyStartDate);
    if (!studyStartDate) return res.status(400).json({ success: false, error: 'INVALID_STUDY_START_DATE' });
    const reserveId = reserveClassId(classId);
    const reserve = (await getStudentRecordsForManagement())
      .find((student) => student.classId === reserveId && Number(student.attendanceNumber) === attendanceNumber);
    if (!reserve) return res.status(404).json({ success: false, error: 'COMPARISON_RESERVE_NOT_FOUND' });
    await updateStudentClass(reserve.studentId, classId, attendanceNumber);
    await setStudentActive(reserve.studentId, true);
    const [result] = await updateStudentStudyMetadata([{
      researchId: reserve.researchId,
      formalStudyParticipant: true,
      studySiteId: 'site_b',
      schoolCondition: 'comparison',
      studyGradeLevel: gradeForClassId(classId),
      studyStartDate,
    }], req.managementUser?.username || 'researcher');
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, classId, attendanceNumber, result });
  } catch (error: any) {
    const message = String(error?.message || '');
    console.error('Comparison reserve activation failed', { message });
    const validation = /^(?:INVALID_|FORMAL_|COMPARISON_|RESEARCH_PARTICIPANT_|COMPARISON_RESERVE_)/.test(message);
    return res.status(validation ? 400 : 503).json({
      success: false,
      error: validation ? message : 'COMPARISON_RESERVE_ACTIVATION_UNAVAILABLE',
    });
  }
});

export function createComparisonParticipantSetupRouter() {
  return router;
}
