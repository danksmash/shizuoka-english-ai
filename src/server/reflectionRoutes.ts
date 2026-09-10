import express from 'express';
import { isValidLearningCode, normalizeLearningCode } from '../dataContract';
import { authenticateManagement, clearManagementCookie, managementAuthConfigured, requireManagementRole, setManagementCookie, type AuthenticatedRequest } from './auth';
import { getStudentRecordsForManagement, resolveStudentByCode } from './persistence';
import {
  getAllReflectionRecordsForTeacher,
  getClassReflections,
  getReflectionHistory,
  getTodayAndPrevious,
  issueReflectionDevice,
  resolveReflectionDevice,
  saveLessonReflection,
  todayInTokyo,
  type ReflectionIdentity,
  type ReflectionRecord,
} from './reflectionPersistence';
import { buildTeacherReflectionDashboard, buildTeacherStudentHistory, serializeResearchLessonReflectionCsv, serializeTeacherReflectionCsv } from './reflectionTeacherModel';

const router = express.Router();

function tokenFromBody(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const token = (body as Record<string, unknown>).deviceToken;
  return typeof token === 'string' ? token.trim() : '';
}

function publicReflection(record: ReflectionRecord | null) {
  if (!record) return null;
  return {
    reflectionId: record.reflectionId,
    localDate: record.localDate,
    todayGoal: record.todayGoal,
    goalRating: record.goalRating,
    communicationRating: record.communicationRating,
    reflectionText: record.reflectionText,
    reflectionCharCount: record.reflectionCharCount,
    status: record.status,
    revision: record.revision,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    submittedAt: record.submittedAt,
  };
}

function publicClassReflection(record: Awaited<ReturnType<typeof getClassReflections>>[number]) {
  return {
    reflectionId: record.reflectionId,
    localDate: record.localDate,
    todayGoal: record.todayGoal,
    reflectionText: record.reflectionText,
  };
}

async function requireIdentity(req: express.Request, res: express.Response): Promise<ReflectionIdentity | null> {
  const registered = await resolveReflectionDevice(tokenFromBody(req.body));
  if (!registered) {
    res.status(401).json({ success: false, error: 'INVALID_REFLECTION_DEVICE' });
    return null;
  }
  const current = await resolveStudentByCode(registered.learningId);
  if (!current || current.studentId !== registered.studentId || current.researchId !== registered.researchId) {
    res.status(401).json({ success: false, error: 'REFLECTION_DEVICE_REBIND_REQUIRED' });
    return null;
  }
  return {
    studentId: current.studentId,
    researchId: current.researchId,
    classId: current.classId,
    learningId: current.learningId,
  };
}

const reflectionFailedCodeAttempts = new Map<string, { count: number; resetTime: number }>();
function reflectionCodeBlocked(ip: string): boolean {
  const now = Date.now();
  const existing = reflectionFailedCodeAttempts.get(ip);
  if (!existing || now > existing.resetTime) {
    if (existing) reflectionFailedCodeAttempts.delete(ip);
    return false;
  }
  return existing.count >= 30;
}
function noteReflectionCodeFailure(ip: string): boolean {
  const now = Date.now();
  const existing = reflectionFailedCodeAttempts.get(ip);
  if (!existing || now > existing.resetTime) {
    reflectionFailedCodeAttempts.set(ip, { count: 1, resetTime: now + 10 * 60_000 });
    return true;
  }
  existing.count += 1;
  return existing.count < 30;
}

const teacherLoginAttempts = new Map<string, { count: number; resetTime: number }>();
function teacherLoginAllowed(ip: string): boolean {
  const now = Date.now();
  const existing = teacherLoginAttempts.get(ip);
  if (!existing || now > existing.resetTime) {
    teacherLoginAttempts.set(ip, { count: 1, resetTime: now + 15 * 60_000 });
    return true;
  }
  if (existing.count >= 10) return false;
  existing.count += 1;
  return true;
}

router.post('/register', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (reflectionCodeBlocked(ip)) return res.status(429).json({ success: false, error: 'TOO_MANY_FAILED_CODE_ATTEMPTS' });
  const rawCode = req.body?.learningCode;
  if (!isValidLearningCode(rawCode)) {
    const allowed = noteReflectionCodeFailure(ip);
    return res.status(allowed ? 400 : 429).json({ success: false, error: allowed ? 'INVALID_LEARNING_CODE' : 'TOO_MANY_FAILED_CODE_ATTEMPTS' });
  }
  try {
    const learningCode = normalizeLearningCode(rawCode);
    const student = await resolveStudentByCode(learningCode);
    if (!student) {
      const allowed = noteReflectionCodeFailure(ip);
      return res.status(allowed ? 401 : 429).json({ success: false, error: allowed ? 'LEARNING_CODE_NOT_FOUND' : 'TOO_MANY_FAILED_CODE_ATTEMPTS' });
    }
    if (!student.classId) return res.status(409).json({ success: false, error: 'REFLECTION_CLASS_NOT_ASSIGNED' });
    const deviceToken = await issueReflectionDevice({ studentId: student.studentId, researchId: student.researchId, classId: student.classId, learningId: student.learningId });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, deviceToken });
  } catch (error: any) {
    console.error('Reflection register failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'REFLECTION_REGISTER_UNAVAILABLE' });
  }
});

router.post('/bootstrap', async (req, res) => {
  try {
    const identity = await requireIdentity(req, res);
    if (!identity) return;
    const data = await getTodayAndPrevious(identity);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, learningId: identity.learningId, today: publicReflection(data.today), previous: publicReflection(data.previous) });
  } catch (error: any) {
    console.error('Reflection bootstrap failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'REFLECTION_BOOTSTRAP_UNAVAILABLE' });
  }
});

router.post('/save', async (req, res) => {
  try {
    const identity = await requireIdentity(req, res);
    if (!identity) return;
    const saved = await saveLessonReflection(identity, {
      todayGoal: req.body?.todayGoal,
      goalRating: req.body?.goalRating,
      communicationRating: req.body?.communicationRating,
      reflectionText: req.body?.reflectionText,
      status: req.body?.status,
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, reflection: publicReflection(saved) });
  } catch (error: any) {
    console.error('Reflection save failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'REFLECTION_SAVE_UNAVAILABLE' });
  }
});

router.post('/history', async (req, res) => {
  try {
    const identity = await requireIdentity(req, res);
    if (!identity) return;
    const history = (await getReflectionHistory(identity)).map((row) => publicReflection(row));
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, history });
  } catch (error: any) {
    console.error('Reflection history failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'REFLECTION_HISTORY_UNAVAILABLE' });
  }
});

router.post('/class', async (req, res) => {
  try {
    const identity = await requireIdentity(req, res);
    if (!identity) return;
    const reflections = (await getClassReflections(identity)).map(publicClassReflection);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, reflections });
  } catch (error: any) {
    if (error?.message === 'SUBMIT_FIRST') return res.status(403).json({ success: false, error: 'SUBMIT_FIRST' });
    console.error('Class reflections failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'CLASS_REFLECTIONS_UNAVAILABLE' });
  }
});

router.post('/teacher/login', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!teacherLoginAllowed(ip)) return res.status(429).json({ success: false, error: 'TOO_MANY_LOGIN_ATTEMPTS' });
  const username = typeof req.body?.username === 'string' ? req.body.username.slice(0, 100) : '';
  const password = typeof req.body?.password === 'string' ? req.body.password.slice(0, 300) : '';
  const result = authenticateManagement(username, password);
  if (!result) return res.status(managementAuthConfigured() ? 401 : 503).json({ success: false, error: managementAuthConfigured() ? 'INVALID_CREDENTIALS' : 'MANAGEMENT_AUTH_NOT_CONFIGURED' });
  if (result.role !== 'teacher') return res.status(403).json({ success: false, error: 'TEACHER_ONLY' });
  setManagementCookie(res, result.token);
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ success: true, role: result.role });
});

router.post('/teacher/logout', (_req, res) => {
  clearManagementCookie(res);
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ success: true });
});

router.post('/teacher/me', requireManagementRole(['teacher']), (req: AuthenticatedRequest, res) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ success: true, user: req.managementUser });
});

router.post('/teacher/dashboard', requireManagementRole(['teacher']), async (req, res) => {
  try {
    const [roster, records] = await Promise.all([getStudentRecordsForManagement(), getAllReflectionRecordsForTeacher()]);
    const dashboard = buildTeacherReflectionDashboard(roster, records, req.body?.localDate, { dataScope: req.body?.dataScope, grade: req.body?.grade, classNumber: req.body?.classNumber, classId: req.body?.classId }, todayInTokyo());
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, ...dashboard });
  } catch (error: any) {
    console.error('Reflection teacher dashboard failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'REFLECTION_TEACHER_DASHBOARD_UNAVAILABLE' });
  }
});

router.post('/teacher/student', requireManagementRole(['teacher']), async (req, res) => {
  try {
    const learningId = typeof req.body?.learningId === 'string' ? req.body.learningId.slice(0, 20) : '';
    const [roster, records] = await Promise.all([getStudentRecordsForManagement(), getAllReflectionRecordsForTeacher()]);
    const student = buildTeacherStudentHistory(roster, records, learningId);
    if (!student) return res.status(404).json({ success: false, error: 'REFLECTION_STUDENT_NOT_FOUND' });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, student });
  } catch (error: any) {
    console.error('Reflection teacher student history failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'REFLECTION_STUDENT_HISTORY_UNAVAILABLE' });
  }
});

router.post('/teacher/export.csv', requireManagementRole(['teacher']), async (req, res) => {
  try {
    const [roster, records] = await Promise.all([getStudentRecordsForManagement(), getAllReflectionRecordsForTeacher()]);
    const csv = serializeTeacherReflectionCsv(roster, records, req.body?.localDate, { dataScope: req.body?.dataScope, grade: req.body?.grade, classNumber: req.body?.classNumber, classId: req.body?.classId });
    const dateLabel = typeof req.body?.localDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.localDate) ? req.body.localDate.replace(/-/g, '') : 'all';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="my-english-growth-reflections-${dateLabel}.csv"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(csv);
  } catch (error: any) {
    console.error('Reflection teacher CSV export failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'REFLECTION_CSV_EXPORT_UNAVAILABLE' });
  }
});

router.get('/research/lesson-reflections.csv', requireManagementRole(['researcher']), async (req, res) => {
  try {
    const records = await getAllReflectionRecordsForTeacher();
    const localDate = typeof req.query?.localDate === 'string' ? req.query.localDate : '';
    const csv = serializeResearchLessonReflectionCsv(records, localDate);
    const dateLabel = /^\d{4}-\d{2}-\d{2}$/.test(localDate) ? localDate.replace(/-/g, '') : 'all';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="lesson_reflections-${dateLabel}.csv"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(csv);
  } catch (error: any) {
    console.error('Reflection research CSV export failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'REFLECTION_RESEARCH_CSV_EXPORT_UNAVAILABLE' });
  }
});

export function createReflectionRouter() {
  return router;
}
