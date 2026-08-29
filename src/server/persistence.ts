import crypto from 'node:crypto';
import { ReflectionAnswers, ResearchSystemEvent, calculateCanonicalStats, maskHistoryForStorage } from '../dataContract';
import type { AIStudentId, ChatMessage, DialogueDurationMinutes, DialogueTopic, VisualVocabularyItem } from '../types';
import { createDocumentIfAbsent, getDocument, listCollection, queryCollection, setDocument } from './firestore';

const STUDENT_COLLECTION = 'students';
const SESSION_COLLECTION = 'sessions';
const RESEARCH_ID_COLLECTION = 'research_ids';
const TEACHER_ID_COLLECTION = 'teacher_ids';
const RESEARCH_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TEACHER_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function retentionDays(): number {
  const value = Number(process.env.SESSION_RETENTION_DAYS || 1095);
  return Number.isFinite(value) ? Math.max(30, Math.min(3650, Math.round(value))) : 1095;
}
function pepper(): string { return process.env.LEARNING_CODE_PEPPER || ''; }
export function persistenceConfigured(): boolean { return Boolean(pepper()); }
export function learningCodeKey(code: string): string {
  if (!pepper()) throw new Error('LEARNING_CODE_PEPPER_NOT_CONFIGURED');
  return crypto.createHmac('sha256', pepper()).update(code.trim().toUpperCase()).digest('hex');
}
function documentId(record: Record<string, any>): string { return String(record._name || '').split('/').pop() || ''; }
function withoutInternal(record: Record<string, any>): Record<string, unknown> {
  const { _name, ...rest } = record;
  return rest;
}
function normalizeClassId(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 40) : '';
}
function validTeacherStudentId(value: unknown): string {
  const id = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return /^[A-HJ-NP-Z2-9]{4}$/.test(id) ? id : '';
}
function randomTeacherStudentId(): string {
  let out = '';
  for (let i = 0; i < 4; i += 1) out += TEACHER_ID_ALPHABET[crypto.randomInt(0, TEACHER_ID_ALPHABET.length)];
  return out;
}
function randomResearchId(): string {
  let out = 'R-';
  for (let i = 0; i < 12; i += 1) out += RESEARCH_ID_ALPHABET[crypto.randomInt(0, RESEARCH_ID_ALPHABET.length)];
  return out;
}
async function generateUniqueResearchId(studentId: string): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = randomResearchId();
    if (await createDocumentIfAbsent(RESEARCH_ID_COLLECTION, candidate, { studentId, createdAt: new Date().toISOString() })) return candidate;
  }
  throw new Error('RESEARCH_ID_EXHAUSTED');
}
async function generateUniqueTeacherStudentId(studentId: string, records?: Record<string, any>[]): Promise<string> {
  const source = records || await listCollection(STUDENT_COLLECTION, 1000);
  const used = new Set(source.map((row) => validTeacherStudentId(row.teacherStudentId)).filter(Boolean));
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = randomTeacherStudentId();
    if (used.has(candidate)) continue;
    if (await createDocumentIfAbsent(TEACHER_ID_COLLECTION, candidate, { studentId, createdAt: new Date().toISOString() })) return candidate;
  }
  throw new Error('TEACHER_STUDENT_ID_EXHAUSTED');
}

export async function resolveStudentByCode(code: string): Promise<{ studentId: string; researchId: string; classId: string; active: boolean } | null> {
  const doc = await getDocument(STUDENT_COLLECTION, learningCodeKey(code));
  if (!doc || doc.active === false) return null;
  const studentId = typeof doc.studentId === 'string' ? doc.studentId : '';
  const researchId = typeof doc.researchId === 'string' ? doc.researchId : '';
  if (!studentId || !researchId) return null;
  return { studentId, researchId, classId: normalizeClassId(doc.classId), active: true };
}

export async function createStudentCode(
  code: string,
  studentId?: string,
  researchId?: string,
  classId?: string,
  teacherId?: string
): Promise<{ studentId: string; researchId: string; classId: string; teacherStudentId: string }> {
  const normalized = code.trim().toUpperCase();
  const key = learningCodeKey(normalized);
  const existing = await getDocument(STUDENT_COLLECTION, key);
  if (existing) throw new Error('LEARNING_CODE_ALREADY_EXISTS');
  const sid = studentId || crypto.randomUUID();
  const rid = researchId || await generateUniqueResearchId(sid);
  const cid = normalizeClassId(classId);
  const tid = validTeacherStudentId(teacherId) || await generateUniqueTeacherStudentId(sid);
  const now = new Date().toISOString();
  const created = await createDocumentIfAbsent(STUDENT_COLLECTION, key, {
    studentId: sid,
    researchId: rid,
    teacherStudentId: tid,
    classId: cid,
    active: true,
    createdAt: now,
    updatedAt: now,
  });
  if (!created) throw new Error('LEARNING_CODE_ALREADY_EXISTS');
  return { studentId: sid, researchId: rid, classId: cid, teacherStudentId: tid };
}

export async function getStudentRecordsForManagement(): Promise<Array<{ studentId: string; teacherStudentId: string; classId: string; active: boolean; createdAt: string; updatedAt: string }>> {
  const records = await listCollection(STUDENT_COLLECTION, 1000);
  const grouped = new Map<string, Record<string, any>[]>();
  for (const record of records) {
    const sid = typeof record.studentId === 'string' ? record.studentId : '';
    if (!sid) continue;
    const list = grouped.get(sid) || [];
    list.push(record);
    grouped.set(sid, list);
  }
  const used = new Set(records.map((row) => validTeacherStudentId(row.teacherStudentId)).filter(Boolean));
  const result: Array<{ studentId: string; teacherStudentId: string; classId: string; active: boolean; createdAt: string; updatedAt: string }> = [];
  for (const [studentId, list] of grouped.entries()) {
    const sorted = list.slice().sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    const activeRecord = sorted.find((row) => row.active !== false) || sorted[0] || {};
    let tid = sorted.map((row) => validTeacherStudentId(row.teacherStudentId)).find(Boolean) || '';
    if (!tid) {
      tid = await generateUniqueTeacherStudentId(studentId, records);
      used.add(tid);
      for (const record of list) {
        const id = documentId(record);
        if (!id) continue;
        await setDocument(STUDENT_COLLECTION, id, { ...withoutInternal(record), teacherStudentId: tid, updatedAt: new Date().toISOString() });
      }
    }
    result.push({
      studentId,
      teacherStudentId: tid,
      classId: normalizeClassId(activeRecord.classId),
      active: sorted.some((row) => row.active !== false),
      createdAt: String(activeRecord.createdAt || ''),
      updatedAt: String(activeRecord.updatedAt || ''),
    });
  }
  return result.sort((a, b) => a.teacherStudentId.localeCompare(b.teacherStudentId));
}

export async function setStudentActive(studentId: string, active: boolean): Promise<void> {
  const records = (await listCollection(STUDENT_COLLECTION, 1000)).filter((row) => row.studentId === studentId);
  if (!records.length) throw new Error('STUDENT_NOT_FOUND');
  if (!active) {
    for (const record of records) {
      const id = documentId(record); if (!id) continue;
      await setDocument(STUDENT_COLLECTION, id, { ...withoutInternal(record), active: false, updatedAt: new Date().toISOString() });
    }
    return;
  }
  const latest = records.slice().sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0];
  const latestId = documentId(latest);
  if (!latestId) throw new Error('STUDENT_DOCUMENT_ID_MISSING');
  for (const record of records) {
    const id = documentId(record); if (!id) continue;
    await setDocument(STUDENT_COLLECTION, id, { ...withoutInternal(record), active: id === latestId, updatedAt: new Date().toISOString() });
  }
}


export async function updateStudentClass(studentId: string, classId: string): Promise<void> {
  const cid = normalizeClassId(classId);
  if (!/^(?:5-[123]|6-[123]|テスト|予備)$/.test(cid)) throw new Error('INVALID_CLASS_ID');
  const records = (await listCollection(STUDENT_COLLECTION, 1000)).filter((row) => row.studentId === studentId);
  if (!records.length) throw new Error('STUDENT_NOT_FOUND');
  const now = new Date().toISOString();
  for (const record of records) {
    const id = documentId(record);
    if (!id) continue;
    await setDocument(STUDENT_COLLECTION, id, { ...withoutInternal(record), classId: cid, updatedAt: now });
  }
}

export async function reissueStudentCode(studentId: string, newCode: string): Promise<{ studentId: string; researchId: string; classId: string; teacherStudentId: string }> {
  const records = (await listCollection(STUDENT_COLLECTION, 1000)).filter((row) => row.studentId === studentId);
  if (!records.length) throw new Error('STUDENT_NOT_FOUND');
  if (await getDocument(STUDENT_COLLECTION, learningCodeKey(newCode))) throw new Error('LEARNING_CODE_ALREADY_EXISTS');
  const latest = records.slice().sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0];
  const tid = validTeacherStudentId(latest.teacherStudentId) || await generateUniqueTeacherStudentId(studentId, await listCollection(STUDENT_COLLECTION, 1000));
  for (const record of records) {
    const id = documentId(record); if (!id) continue;
    await setDocument(STUDENT_COLLECTION, id, { ...withoutInternal(record), teacherStudentId: tid, active: false, updatedAt: new Date().toISOString() });
  }
  return createStudentCode(newCode, studentId, String(latest.researchId || ''), normalizeClassId(latest.classId), tid);
}

function academicYearForLocalDate(localDate: string): number {
  const [yearText, monthText] = localDate.split('-');
  const year = Number(yearText); const month = Number(monthText);
  return Number.isInteger(year) && Number.isInteger(month) ? (month >= 4 ? year : year - 1) : 0;
}
function gradeLevelForClassId(classId: string): number | '' {
  return classId.startsWith('5-') ? 5 : classId.startsWith('6-') ? 6 : '';
}

export interface SaveCanonicalSessionArgs {
  sessionId: string; studentId: string; researchId: string; classId?: string; aiStudentId: AIStudentId; topic: DialogueTopic;
  targetDurationMinutes: DialogueDurationMinutes; startedAt: number; endedAt: number; history: ChatMessage[];
  encounteredVocab: VisualVocabularyItem[]; reflection?: ReflectionAnswers; systemEvents?: ResearchSystemEvent[];
}

export async function saveCanonicalSession(args: SaveCanonicalSessionArgs) {
  const safeHistory = maskHistoryForStorage(args.history);
  const stats = calculateCanonicalStats(safeHistory, args.startedAt, args.endedAt, args.targetDurationMinutes, args.encounteredVocab);
  const existing = await getDocument(SESSION_COLLECTION, args.sessionId);
  if (existing && existing.studentId && existing.studentId !== args.studentId) throw new Error('SESSION_ID_CONFLICT');
  const studentSessions = await queryCollection(SESSION_COLLECTION, 'studentId', args.studentId, 5000);
  const lifetimeSessionNumber = existing?.lifetimeSessionNumber || studentSessions.length + 1;
  const localDate = new Date(args.startedAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
  const dailySessionNumber = existing?.dailySessionNumber || studentSessions.filter((session) => session.localDate === localDate).length + 1;
  const currentClassId = normalizeClassId(args.classId);
  const document = {
    schemaVersion: 3, sessionId: args.sessionId, studentId: args.studentId, researchId: args.researchId,
    classId: currentClassId, academicYear: academicYearForLocalDate(localDate), gradeLevel: gradeLevelForClassId(currentClassId), aiStudentId: args.aiStudentId, topic: args.topic,
    targetDurationMinutes: args.targetDurationMinutes, actualDurationSeconds: stats.actualDurationSeconds,
    startedAt: new Date(args.startedAt).toISOString(), endedAt: new Date(args.endedAt).toISOString(), localDate,
    lifetimeSessionNumber, dailySessionNumber, totalTurns: stats.totalTurns, totalChildWords: stats.totalChildWords,
    uniqueVocabularyCount: stats.uniqueVocabularyCount,
    childUniqueWordTypes: stats.childUniqueWordTypes, meanChildWordsPerTurn: stats.meanChildWordsPerTurn, maxChildWordsPerTurn: stats.maxChildWordsPerTurn,
    childQuestionCount: stats.childQuestionCount, childReciprocalQuestionCount: stats.childReciprocalQuestionCount, childRepairCount: stats.childRepairCount, childReasonExpressionCount: stats.childReasonExpressionCount,
    history: safeHistory, systemEvents: (args.systemEvents || []).slice(0, 500),
    encounteredVocab: args.encounteredVocab.slice(0, 200).map((item) => ({ id: item.id, word: item.word, japanese: item.japanese, category: item.category })),
    reflection: args.reflection || null, updatedAt: new Date().toISOString(), createdAt: existing?.createdAt || new Date().toISOString(),
    retentionExpiresAt: new Date(args.endedAt + retentionDays() * 24 * 60 * 60 * 1000).toISOString(),
  };
  await setDocument(SESSION_COLLECTION, args.sessionId, document);
  return document;
}

export async function getStudentHistory(studentId: string): Promise<Record<string, unknown>[]> {
  const rows = await queryCollection(SESSION_COLLECTION, 'studentId', studentId, 5000);
  return rows.sort((a, b) => String(a.endedAt || '').localeCompare(String(b.endedAt || ''))).map((session) => ({
    sessionId: session.sessionId, aiStudentId: session.aiStudentId, topic: session.topic,
    targetDurationMinutes: session.targetDurationMinutes, actualDurationSeconds: session.actualDurationSeconds,
    endedAt: session.endedAt, lifetimeSessionNumber: session.lifetimeSessionNumber, totalTurns: session.totalTurns,
    totalChildWords: session.totalChildWords, uniqueVocabularyCount: session.uniqueVocabularyCount, reflection: session.reflection || null,
  }));
}

export async function getAllSessionsForManagement(): Promise<Record<string, any>[]> { return listCollection(SESSION_COLLECTION, 1000); }
export async function getTeacherSessionsForManagement(): Promise<Record<string, any>[]> {
  const [rows, students] = await Promise.all([getAllSessionsForManagement(), getStudentRecordsForManagement()]);
  const teacherIds = new Map(students.map((student) => [student.studentId, student.teacherStudentId]));
  return rows.map(({ researchId: _researchId, _name, ...session }) => ({
    ...session,
    teacherStudentId: teacherIds.get(String(session.studentId || '')) || '----',
  }));
}

export function anonymizeSessionForResearch(session: Record<string, any>): Record<string, unknown> {
  return {
    research_id: session.researchId || '', class_id: session.classId || '', session_id: session.sessionId || '',
    lifetime_session_number: session.lifetimeSessionNumber || 0, daily_session_number: session.dailySessionNumber || 0,
    local_date: session.localDate || '', ai_student_id: session.aiStudentId || '', topic: session.topic || '',
    target_duration_minutes: session.targetDurationMinutes || 0, actual_duration_seconds: session.actualDurationSeconds || 0,
    total_turns: session.totalTurns || 0, total_child_words: session.totalChildWords || 0,
    unique_vocabulary_count: session.uniqueVocabularyCount || 0,
    reflection_conveyed_ideas: session.reflection?.conveyedIdeas ?? '',
    reflection_understood_partner: session.reflection?.understoodPartner ?? '',
    reflection_noticed_language_culture: session.reflection?.noticedLanguageCulture ?? '',
  };
}
