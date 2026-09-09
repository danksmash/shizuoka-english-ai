import crypto from 'node:crypto';
import { createDocumentIfAbsent, getDocument, queryCollection, setDocument } from './firestore';

const DEVICE_COLLECTION = 'reflection_devices';
const REFLECTION_COLLECTION = 'lesson_reflections';

export interface ReflectionIdentity {
  studentId: string;
  researchId: string;
  classId: string;
  learningId: string;
}

export interface ReflectionRecord {
  reflectionId: string;
  studentId: string;
  researchId: string;
  classId: string;
  localDate: string;
  todayGoal: string;
  goalRating: number | null;
  selfRegulationRating: number | null;
  reflectionText: string;
  reflectionCharCount: number;
  status: 'draft' | 'submitted';
  revision: number;
  createdAt: string;
  updatedAt: string;
  submittedAt: string;
}

function tokenPepper(): string {
  return process.env.LEARNING_CODE_PEPPER || '';
}

function tokenKey(token: string): string {
  const pepper = tokenPepper();
  if (!pepper) throw new Error('REFLECTION_TOKEN_PEPPER_NOT_CONFIGURED');
  return crypto.createHmac('sha256', pepper).update(token).digest('hex');
}

function reflectionDocumentId(studentId: string, localDate: string): string {
  return crypto.createHash('sha256').update(`${studentId}|${localDate}`).digest('hex');
}

export function todayInTokyo(now = new Date()): string {
  return now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
}

export async function issueReflectionDevice(identity: ReflectionIdentity): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const token = crypto.randomBytes(32).toString('base64url');
    const created = await createDocumentIfAbsent(DEVICE_COLLECTION, tokenKey(token), {
      studentId: identity.studentId,
      researchId: identity.researchId,
      classId: identity.classId,
      learningId: identity.learningId,
      active: true,
      createdAt: new Date().toISOString(),
    });
    if (created) return token;
  }
  throw new Error('REFLECTION_DEVICE_TOKEN_EXHAUSTED');
}

export async function resolveReflectionDevice(token: string): Promise<ReflectionIdentity | null> {
  if (!/^[A-Za-z0-9_-]{40,120}$/.test(token)) return null;
  const record = await getDocument(DEVICE_COLLECTION, tokenKey(token));
  if (!record || record.active === false) return null;
  const studentId = typeof record.studentId === 'string' ? record.studentId : '';
  const researchId = typeof record.researchId === 'string' ? record.researchId : '';
  const classId = typeof record.classId === 'string' ? record.classId : '';
  const learningId = typeof record.learningId === 'string' ? record.learningId : '';
  if (!studentId || !researchId || !classId || !learningId) return null;
  return { studentId, researchId, classId, learningId };
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim().slice(0, maxLength) : '';
}

function rating(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null;
}

export async function saveLessonReflection(
  identity: ReflectionIdentity,
  input: {
    todayGoal?: unknown;
    goalRating?: unknown;
    selfRegulationRating?: unknown;
    reflectionText?: unknown;
    status?: unknown;
  },
): Promise<ReflectionRecord> {
  const localDate = todayInTokyo();
  const reflectionId = reflectionDocumentId(identity.studentId, localDate);
  const existing = await getDocument(REFLECTION_COLLECTION, reflectionId);
  const now = new Date().toISOString();
  const status: 'draft' | 'submitted' = input.status === 'submitted' ? 'submitted' : 'draft';
  const reflectionText = cleanText(input.reflectionText, 5000);
  const record: ReflectionRecord = {
    reflectionId,
    studentId: identity.studentId,
    researchId: identity.researchId,
    classId: identity.classId,
    localDate,
    todayGoal: cleanText(input.todayGoal, 1000),
    goalRating: rating(input.goalRating),
    selfRegulationRating: rating(input.selfRegulationRating),
    reflectionText,
    reflectionCharCount: [...reflectionText].length,
    status,
    revision: Math.max(1, Number(existing?.revision || 0) + 1),
    createdAt: typeof existing?.createdAt === 'string' ? existing.createdAt : now,
    updatedAt: now,
    submittedAt: status === 'submitted' ? now : (typeof existing?.submittedAt === 'string' ? existing.submittedAt : ''),
  };
  await setDocument(REFLECTION_COLLECTION, reflectionId, { ...record });
  return record;
}

export async function getTodayAndPrevious(identity: ReflectionIdentity): Promise<{
  today: ReflectionRecord | null;
  previous: ReflectionRecord | null;
}> {
  const todayDate = todayInTokyo();
  const todayId = reflectionDocumentId(identity.studentId, todayDate);
  const today = await getDocument(REFLECTION_COLLECTION, todayId) as ReflectionRecord | null;
  const rows = await queryCollection(REFLECTION_COLLECTION, 'studentId', identity.studentId, 500);
  const previous = rows
    .filter((row) => row.localDate && row.localDate < todayDate && row.status === 'submitted')
    .sort((a, b) => String(b.localDate).localeCompare(String(a.localDate)))[0] as ReflectionRecord | undefined;
  return { today, previous: previous || null };
}

export async function getReflectionHistory(identity: ReflectionIdentity): Promise<ReflectionRecord[]> {
  const rows = await queryCollection(REFLECTION_COLLECTION, 'studentId', identity.studentId, 500);
  return rows
    .filter((row) => row.status === 'submitted')
    .sort((a, b) => String(b.localDate).localeCompare(String(a.localDate))) as ReflectionRecord[];
}

export async function getClassReflections(identity: ReflectionIdentity): Promise<Array<Pick<ReflectionRecord, 'reflectionId' | 'localDate' | 'todayGoal' | 'reflectionText'>>> {
  const { today } = await getTodayAndPrevious(identity);
  if (!today || today.status !== 'submitted') throw new Error('SUBMIT_FIRST');
  const rows = await queryCollection(REFLECTION_COLLECTION, 'classId', identity.classId, 500);
  return rows
    .filter((row) => row.studentId !== identity.studentId && row.status === 'submitted' && row.localDate === todayInTokyo())
    .sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)))
    .map((row) => ({
      reflectionId: String(row.reflectionId || ''),
      localDate: String(row.localDate || ''),
      todayGoal: String(row.todayGoal || ''),
      reflectionText: String(row.reflectionText || ''),
    }));
}
