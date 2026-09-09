import crypto from 'node:crypto';
import { createDocumentIfAbsent, getDocument, listCollection, queryCollection, queryCollectionByEqualities, setDocument } from './firestore';

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
  learningId: string;
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
  // Compatibility only: records created during the temporary six-part UI are retained.
  achievements: string;
  languageUsed: string;
  thinking: string;
  difficultyStrategy: string;
  languageCultureAwareness: string;
  nextGoal: string;
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

function sixPartCharCount(record: Pick<ReflectionRecord, 'achievements' | 'languageUsed' | 'thinking' | 'difficultyStrategy' | 'languageCultureAwareness' | 'nextGoal'>): number {
  return [record.achievements, record.languageUsed, record.thinking, record.difficultyStrategy, record.languageCultureAwareness, record.nextGoal]
    .reduce((sum, value) => sum + [...value].length, 0);
}

function canonicalCharCount(record: Pick<ReflectionRecord, 'reflectionText' | 'achievements' | 'languageUsed' | 'thinking' | 'difficultyStrategy' | 'languageCultureAwareness' | 'nextGoal'>): number {
  return record.reflectionText ? [...record.reflectionText].length : sixPartCharCount(record);
}

function normalizeStoredRecord(row: Record<string, any> | null): ReflectionRecord | null {
  if (!row) return null;
  const normalized: ReflectionRecord = {
    reflectionId: cleanText(row.reflectionId, 200),
    studentId: cleanText(row.studentId, 200),
    researchId: cleanText(row.researchId, 200),
    classId: cleanText(row.classId, 40),
    learningId: cleanText(row.learningId, 20).toUpperCase(),
    localDate: cleanText(row.localDate, 20),
    todayGoal: cleanText(row.todayGoal, 1000),
    goalRating: rating(row.goalRating),
    selfRegulationRating: rating(row.selfRegulationRating),
    reflectionText: cleanText(row.reflectionText, 12000),
    reflectionCharCount: Number(row.reflectionCharCount || 0),
    status: row.status === 'submitted' ? 'submitted' : 'draft',
    revision: Math.max(1, Number(row.revision || 1)),
    createdAt: cleanText(row.createdAt, 100),
    updatedAt: cleanText(row.updatedAt, 100),
    submittedAt: cleanText(row.submittedAt, 100),
    achievements: cleanText(row.achievements, 5000),
    languageUsed: cleanText(row.languageUsed, 5000),
    thinking: cleanText(row.thinking, 5000),
    difficultyStrategy: cleanText(row.difficultyStrategy, 5000),
    languageCultureAwareness: cleanText(row.languageCultureAwareness, 5000),
    nextGoal: cleanText(row.nextGoal, 5000),
  };
  normalized.reflectionCharCount = canonicalCharCount(normalized);
  return normalized;
}

export async function saveLessonReflection(
  identity: ReflectionIdentity,
  input: {
    todayGoal?: unknown;
    goalRating?: unknown;
    selfRegulationRating?: unknown;
    reflectionText?: unknown;
    status?: unknown;
    // Accepted only for backward compatibility with the briefly deployed six-part client.
    achievements?: unknown;
    languageUsed?: unknown;
    thinking?: unknown;
    difficultyStrategy?: unknown;
    languageCultureAwareness?: unknown;
    nextGoal?: unknown;
  },
): Promise<ReflectionRecord> {
  const localDate = todayInTokyo();
  const reflectionId = reflectionDocumentId(identity.studentId, localDate);
  const existingRaw = await getDocument(REFLECTION_COLLECTION, reflectionId);
  const existing = normalizeStoredRecord(existingRaw);
  const now = new Date().toISOString();
  // Submission is monotonic. A delayed autosave can never downgrade a submitted record to draft.
  const status: 'draft' | 'submitted' = input.status === 'submitted' || existing?.status === 'submitted' ? 'submitted' : 'draft';
  const record: ReflectionRecord = {
    reflectionId,
    studentId: identity.studentId,
    researchId: identity.researchId,
    classId: identity.classId,
    learningId: identity.learningId,
    localDate,
    todayGoal: input.todayGoal === undefined ? (existing?.todayGoal || '') : cleanText(input.todayGoal, 1000),
    goalRating: input.goalRating === undefined ? (existing?.goalRating ?? null) : rating(input.goalRating),
    selfRegulationRating: input.selfRegulationRating === undefined ? (existing?.selfRegulationRating ?? null) : rating(input.selfRegulationRating),
    reflectionText: input.reflectionText === undefined ? (existing?.reflectionText || '') : cleanText(input.reflectionText, 12000),
    reflectionCharCount: 0,
    status,
    revision: Math.max(1, Number(existing?.revision || 0) + 1),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    submittedAt: status === 'submitted' ? (existing?.submittedAt || now) : '',
    achievements: input.achievements === undefined ? (existing?.achievements || '') : cleanText(input.achievements, 5000),
    languageUsed: input.languageUsed === undefined ? (existing?.languageUsed || '') : cleanText(input.languageUsed, 5000),
    thinking: input.thinking === undefined ? (existing?.thinking || '') : cleanText(input.thinking, 5000),
    difficultyStrategy: input.difficultyStrategy === undefined ? (existing?.difficultyStrategy || '') : cleanText(input.difficultyStrategy, 5000),
    languageCultureAwareness: input.languageCultureAwareness === undefined ? (existing?.languageCultureAwareness || '') : cleanText(input.languageCultureAwareness, 5000),
    nextGoal: input.nextGoal === undefined ? (existing?.nextGoal || '') : cleanText(input.nextGoal, 5000),
  };
  record.reflectionCharCount = canonicalCharCount(record);
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

export async function getClassReflections(identity: ReflectionIdentity): Promise<Array<Pick<ReflectionRecord,
  'reflectionId' | 'localDate' | 'todayGoal' | 'goalRating' | 'selfRegulationRating' | 'reflectionText' | 'achievements' | 'languageUsed' | 'thinking' | 'difficultyStrategy' | 'languageCultureAwareness' | 'nextGoal'
>>> {
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
      goalRating: row.goalRating,
      selfRegulationRating: row.selfRegulationRating,
      reflectionText: row.reflectionText,
      achievements: row.achievements,
      languageUsed: row.languageUsed,
      thinking: row.thinking,
      difficultyStrategy: row.difficultyStrategy,
      languageCultureAwareness: row.languageCultureAwareness,
      nextGoal: row.nextGoal,
    }));
}

export async function getAllReflectionRecordsForTeacher(): Promise<ReflectionRecord[]> {
  const rows = await listCollection(REFLECTION_COLLECTION, 500);
  return rows
    .map((row) => normalizeStoredRecord(row))
    .filter((row): row is ReflectionRecord => Boolean(row))
    .sort((a, b) => b.localDate.localeCompare(a.localDate) || a.classId.localeCompare(b.classId, 'ja') || a.learningId.localeCompare(b.learningId));
}
