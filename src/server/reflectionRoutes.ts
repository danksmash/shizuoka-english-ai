import express from 'express';
import { isValidLearningCode, normalizeLearningCode } from '../dataContract';
import { resolveStudentByCode } from './persistence';
import {
  getClassReflections,
  getReflectionHistory,
  getTodayAndPrevious,
  issueReflectionDevice,
  resolveReflectionDevice,
  saveLessonReflection,
} from './reflectionPersistence';

const router = express.Router();

function tokenFromBody(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const token = (body as Record<string, unknown>).deviceToken;
  return typeof token === 'string' ? token.trim() : '';
}

async function requireIdentity(req: express.Request, res: express.Response) {
  const identity = await resolveReflectionDevice(tokenFromBody(req.body));
  if (!identity) {
    res.status(401).json({ success: false, error: 'INVALID_REFLECTION_DEVICE' });
    return null;
  }
  return identity;
}

router.post('/register', async (req, res) => {
  const rawCode = req.body?.learningCode;
  if (!isValidLearningCode(rawCode)) return res.status(400).json({ success: false, error: 'INVALID_LEARNING_CODE' });
  try {
    const learningCode = normalizeLearningCode(rawCode);
    const student = await resolveStudentByCode(learningCode);
    if (!student) return res.status(401).json({ success: false, error: 'LEARNING_CODE_NOT_FOUND' });
    const deviceToken = await issueReflectionDevice({
      studentId: student.studentId,
      researchId: student.researchId,
      classId: student.classId,
      learningId: student.learningId,
    });
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
    return res.json({
      success: true,
      learningId: identity.learningId,
      classId: identity.classId,
      today: data.today,
      previous: data.previous,
    });
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
      selfRegulationRating: req.body?.selfRegulationRating,
      reflectionText: req.body?.reflectionText,
      status: req.body?.status,
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, reflection: saved });
  } catch (error: any) {
    console.error('Reflection save failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'REFLECTION_SAVE_UNAVAILABLE' });
  }
});

router.post('/history', async (req, res) => {
  try {
    const identity = await requireIdentity(req, res);
    if (!identity) return;
    const history = await getReflectionHistory(identity);
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
    const reflections = await getClassReflections(identity);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, reflections });
  } catch (error: any) {
    if (error?.message === 'SUBMIT_FIRST') return res.status(403).json({ success: false, error: 'SUBMIT_FIRST' });
    console.error('Class reflections failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'CLASS_REFLECTIONS_UNAVAILABLE' });
  }
});

export function createReflectionRouter() {
  return router;
}
