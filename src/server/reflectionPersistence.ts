import crypto from 'node:crypto';
import { createDocumentIfAbsent, getDocument, listCollection, queryCollection, queryCollectionByEqualities, setDocument } from './firestore';

const DEVICE_COLLECTION = 'reflection_devices';
const REFLECTION_COLLECTION = 'lesson_reflections';
const GOAL_MAX_CHARS = 150;
const REFLECTION_MAX_CHARS = 600;

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
  learningId: string;
  localDate: string;
  todayGoal: string;
  goalRating: number | null;
  communicationRating: number | null;
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
  return typeof value === 'string' ? [...value.replace(/\r\n/g, '\n').trim()].slice(0, maxLength).join('') : '';
}

function rating(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 4 ? parsed : null;
}

function normalizeStoredRecord(row: Record<string, any> | null): ReflectionRecord | null {
  if (!row) return null;
  const reflectionText = cleanText(row.reflectionText, REFLECTION_MAX_CHARS);
  return {
    reflectionId: cleanText(row.reflectionId, 200),
    studentId: cleanText(row.studentId, 200),
    researchId: cleanText(row.researchId, 200),
    classId: cleanText(row.classId, 40),
    learningId: cleanText(row.learningId, 20).toUpperCase(),
    localDate: cleanText(row.localDate, 20),
    todayGoal: cleanText(row.todayGoal, GOAL_MAX_CHARS),
    goalRating: rating(row.goalRating),
    communicationRating: rating(row.communicationRating),
    reflectionText,
    reflectionCharCount: [...reflectionText].length,
    status: row.status === 'submitted' ? 'submitted' : 'draft',
    revision: Math.max(1, Number(row.revision || 1)),
    createdAt: cleanText(row.createdAt, 100),
    updatedAt: cleanText(row.updatedAt, 100),
    submittedAt: cleanText(row.submittedAt, 100),
  };
}

export async function saveLessonReflection(
  identity: ReflectionIdentity,
  input: {
    todayGoal?: unknown;
    goalRating?: unknown;
    communicationRating?: unknown;
    reflectionText?: unknown;
    status?: unknown;
  },
): Promise<ReflectionRecord> {
  const localDate = todayInTokyo();
  const reflectionId = reflectionDocumentId(identity.studentId, localDate);
  const existing = normalizeStoredRecord(await getDocument(REFLECTION_COLLECTION, reflectionId));
  const now = new Date().toISOString();
  // Submission is monotonic. A delayed autosave can never downgrade a submitted record to draft.
  const status: 'draft' | 'submitted' = input.status === 'submitted' || existing?.status === 'submitted' ? 'submitted' : 'draft';
  const reflectionText = input.reflectionText === undefined ? (existing?.reflectionText || '') : cleanText(input.reflectionText, REFLECTION_MAX_CHARS);
  const record: ReflectionRecord = {
    reflectionId,
    studentId: identity.studentId,
    researchId: identity.researchId,
    classId: identity.classId,
    learningId: identity.learningId,
    localDate,
    todayGoal: input.todayGoal === undefined ? (existing?.todayGoal || '') : cleanText(input.todayGoal, GOAL_MAX_CHARS),
    goalRating: input.goalRating === undefined ? (existing?.goalRating ?? null) : rating(input.goalRating),
    communicationRating: input.communicationRating === undefined ? (existing?.communicationRating ?? null) : rating(input.communicationRating),
    reflectionText,
    reflectionCharCount: [...reflectionText].length,
    status,
    revision: Math.max(1, Number(existing?.revision || 0) + 1),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    submittedAt: status === 'submitted' ? (existing?.submittedAt || now) : '',
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
  const today = normalizeStoredRecord(await getDocument(REFLECTION_COLLECTION, todayId));
  const rows = await queryCollection(REFLECTION_COLLECTION, 'studentId', identity.studentId, 1000);
  const previousRaw = rows
    .filter((row) => row.localDate && row.localDate < todayDate && row.status === 'submitted')
    .sort((a, b) => String(b.localDate).localeCompare(String(a.localDate)))[0];
  return { today, previous: normalizeStoredRecord(previousRaw || null) };
}

export async function getReflectionHistory(identity: ReflectionIdentity): Promise<ReflectionRecord[]> {
  const rows = await queryCollection(REFLECTION_COLLECTION, 'studentId', identity.studentId, 1000);
  return rows
    .filter((row) => row.status === 'submitted')
    .map((row) => normalizeStoredRecord(row))
    .filter((row): row is ReflectionRecord => Boolean(row))
    .sort((a, b) => b.localDate.localeCompare(a.localDate));
}

export async function getClassReflections(identity: ReflectionIdentity): Promise<Array<Pick<ReflectionRecord, 'reflectionId' | 'localDate' | 'todayGoal' | 'reflectionText'>>> {
  const todayDate = todayInTokyo();
  const { today } = await getTodayAndPrevious(identity);
  if (!today || today.status !== 'submitted') throw new Error('SUBMIT_FIRST');
  const rows = await queryCollectionByEqualities(REFLECTION_COLLECTION, [
    { field: 'classId', value: identity.classId },
    { field: 'localDate', value: todayDate },
  ], 200);
  return rows
    .map((row) => normalizeStoredRecord(row))
    .filter((row): row is ReflectionRecord => Boolean(row))
    .filter((row) => row.studentId !== identity.studentId && row.status === 'submitted')
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .map((row) => ({
      reflectionId: row.reflectionId,
      localDate: row.localDate,
      todayGoal: row.todayGoal,
      reflectionText: row.reflectionText,
    }));
}

export async function getAllReflectionRecordsForTeacher(): Promise<ReflectionRecord[]> {
  const rows = await listCollection(REFLECTION_COLLECTION, 500);
  return rows
    .map((row) => normalizeStoredRecord(row))
    .filter((row): row is ReflectionRecord => Boolean(row))
    .sort((a, b) => b.localDate.localeCompare(a.localDate) || a.classId.localeCompare(b.classId, 'ja') || a.learningId.localeCompare(b.learningId));
}
