import crypto from 'node:crypto';
import { ReflectionAnswers, ResearchSystemEvent, calculateCanonicalStats, isAIStudentId, maskHistoryForStorage } from '../dataContract';
import type { AIStudentId, ChatMessage, DialogueDurationMinutes, DialogueTopic, PersonaLabelCondition, VisualVocabularyItem } from '../types';
import { getPersonaResearchMetadata } from '../data/personaResearch';
import { createDocumentIfAbsent, getDocument, listCollection, queryCollection, setDocument } from './firestore';

const STUDENT_COLLECTION = 'students';
const SESSION_COLLECTION = 'sessions';
const RESEARCH_ID_COLLECTION = 'research_ids';
const RESEARCH_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type ResearchAssignmentMetadata = {
  assignedPartnerId: string;
  assignedPartnerCountry: string;
  assignmentAnnouncedAt: string;
};

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
function normalizeAttendanceNumber(value: unknown): number | '' {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 99 ? parsed : '';
}
function validTeacherStudentId(value: unknown): string {
  const id = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return /^[A-HJ-NP-Z2-9]{4}$/.test(id) ? id : '';
}
function normalizeAssignmentText(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 120) : '';
}
function normalizeAssignmentAnnouncedAt(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}
function researchAssignmentFromRecord(record: Record<string, any> | undefined): ResearchAssignmentMetadata {
  return {
    assignedPartnerId: normalizeAssignmentText(record?.assignedPartnerId),
    assignedPartnerCountry: normalizeAssignmentText(record?.assignedPartnerCountry),
    assignmentAnnouncedAt: normalizeAssignmentAnnouncedAt(record?.assignmentAnnouncedAt),
  };
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

export async function resolveStudentByCode(code: string): Promise<{ studentId: string; researchId: string; classId: string; active: boolean; learningId: string; attendanceNumber: number | '' } | null> {
  const learningId = code.trim().toUpperCase();
  const key = learningCodeKey(learningId);
  const doc = await getDocument(STUDENT_COLLECTION, key);
  if (!doc || doc.active === false) return null;
  const studentId = typeof doc.studentId === 'string' ? doc.studentId : '';
  const researchId = typeof doc.researchId === 'string' ? doc.researchId : '';
  if (!studentId || !researchId) return null;
  if (String(doc.learningId || '') !== learningId) {
    await setDocument(STUDENT_COLLECTION, key, { ...withoutInternal(doc), learningId, updatedAt: new Date().toISOString() });
  }
  return { studentId, researchId, classId: normalizeClassId(doc.classId), active: true, learningId, attendanceNumber: normalizeAttendanceNumber(doc.attendanceNumber) };
}

export async function createStudentCode(
  code: string,
  studentId?: string,
  researchId?: string,
  classId?: string,
  teacherId?: string,
  attendanceNumber?: unknown,
  researchAssignment?: Partial<ResearchAssignmentMetadata>,
): Promise<{ studentId: string; researchId: string; classId: string; teacherStudentId: string; learningId: string; attendanceNumber: number | '' }> {
  const normalized = code.trim().toUpperCase();
  const key = learningCodeKey(normalized);
  const existing = await getDocument(STUDENT_COLLECTION, key);
  if (existing) throw new Error('LEARNING_CODE_ALREADY_EXISTS');
  const sid = studentId || crypto.randomUUID();
  const rid = researchId || await generateUniqueResearchId(sid);
  const cid = normalizeClassId(classId);
  const tid = validTeacherStudentId(teacherId);
  const attendance = normalizeAttendanceNumber(attendanceNumber);
  const assignment = researchAssignmentFromRecord(researchAssignment || {});
  const now = new Date().toISOString();
  const created = await createDocumentIfAbsent(STUDENT_COLLECTION, key, {
    studentId: sid,
    researchId: rid,
    ...(tid ? { teacherStudentId: tid } : {}),
    learningId: normalized,
    attendanceNumber: attendance,
    classId: cid,
    active: true,
    ...(assignment.assignedPartnerId ? { assignedPartnerId: assignment.assignedPartnerId } : {}),
    ...(assignment.assignedPartnerCountry ? { assignedPartnerCountry: assignment.assignedPartnerCountry } : {}),
    ...(assignment.assignmentAnnouncedAt ? { assignmentAnnouncedAt: assignment.assignmentAnnouncedAt } : {}),
    createdAt: now,
    updatedAt: now,
  });
  if (!created) throw new Error('LEARNING_CODE_ALREADY_EXISTS');
  return { studentId: sid, researchId: rid, classId: cid, teacherStudentId: tid, learningId: normalized, attendanceNumber: attendance };
}

export async function getStudentRecordsForManagement(): Promise<Array<{
  studentId: string;
  researchId: string;
  learningId: string;
  classId: string;
  attendanceNumber: number | '';
  active: boolean;
  createdAt: string;
  updatedAt: string;
  assignedPartnerId: string;
  assignedPartnerCountry: string;
  assignmentAnnouncedAt: string;
}>> {
  const records = await listCollection(STUDENT_COLLECTION, 1000);
  const grouped = new Map<string, Record<string, any>[]>();
  for (const record of records) {
    const sid = typeof record.studentId === 'string' ? record.studentId : '';
    if (!sid) continue;
    const list = grouped.get(sid) || []; list.push(record); grouped.set(sid, list);
  }
  const result: Array<{
    studentId: string; researchId: string; learningId: string; classId: string; attendanceNumber: number | ''; active: boolean;
    createdAt: string; updatedAt: string; assignedPartnerId: string; assignedPartnerCountry: string; assignmentAnnouncedAt: string;
  }> = [];
  for (const [studentId, list] of grouped.entries()) {
    const sorted = list.slice().sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    const activeRecord = sorted.find((row) => row.active !== false) || sorted[0] || {};
    const assignmentRecord = sorted.find((row) => row.assignedPartnerId || row.assignedPartnerCountry || row.assignmentAnnouncedAt) || activeRecord;
    const assignment = researchAssignmentFromRecord(assignmentRecord);
    result.push({
      studentId,
      researchId: String(activeRecord.researchId || assignmentRecord.researchId || ''),
      learningId: String(activeRecord.learningId || '').trim().toUpperCase(),
      classId: normalizeClassId(activeRecord.classId),
      attendanceNumber: normalizeAttendanceNumber(activeRecord.attendanceNumber),
      active: sorted.some((row) => row.active !== false),
      createdAt: String(activeRecord.createdAt || ''),
      updatedAt: String(activeRecord.updatedAt || ''),
      ...assignment,
    });
  }
  return result.sort((a, b) => a.classId.localeCompare(b.classId, 'ja') || (Number(a.attendanceNumber || 999) - Number(b.attendanceNumber || 999)) || a.learningId.localeCompare(b.learningId));
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

export async function updateStudentClass(studentId: string, classId: string, attendanceNumber?: unknown): Promise<void> {
  const cid = normalizeClassId(classId);
  if (!/^(?:5-[123]|6-[123]|テスト|予備)$/.test(cid)) throw new Error('INVALID_CLASS_ID');
  const records = (await listCollection(STUDENT_COLLECTION, 1000)).filter((row) => row.studentId === studentId);
  const attendance = normalizeAttendanceNumber(attendanceNumber);
  if (!records.length) throw new Error('STUDENT_NOT_FOUND');
  const now = new Date().toISOString();
  for (const record of records) {
    const id = documentId(record);
    if (!id) continue;
    await setDocument(STUDENT_COLLECTION, id, { ...withoutInternal(record), classId: cid, ...(attendance !== '' ? { attendanceNumber: attendance } : {}), updatedAt: now });
  }
}

export async function reissueStudentCode(studentId: string, newCode: string): Promise<{ studentId: string; researchId: string; classId: string; teacherStudentId: string; learningId: string; attendanceNumber: number | '' }> {
  const records = (await listCollection(STUDENT_COLLECTION, 1000)).filter((row) => row.studentId === studentId);
  if (!records.length) throw new Error('STUDENT_NOT_FOUND');
  if (await getDocument(STUDENT_COLLECTION, learningCodeKey(newCode))) throw new Error('LEARNING_CODE_ALREADY_EXISTS');
  const latest = records.slice().sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0];
  const tid = validTeacherStudentId(latest.teacherStudentId);
  const created = await createStudentCode(
    newCode,
    studentId,
    String(latest.researchId || ''),
    normalizeClassId(latest.classId),
    tid,
    latest.attendanceNumber,
    researchAssignmentFromRecord(latest),
  );
  for (const record of records) {
    const id = documentId(record); if (!id) continue;
    await setDocument(STUDENT_COLLECTION, id, { ...withoutInternal(record), teacherStudentId: tid, active: false, updatedAt: new Date().toISOString() });
  }
  return created;
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
  personaLabelCondition?: PersonaLabelCondition; countryLabelVisible?: boolean; accentLabelVisible?: boolean; flagVisible?: boolean;
  studentSelectedSpeechRate?: number; effectiveTtsSpeechRate?: number;
}

export async function saveCanonicalSession(args: SaveCanonicalSessionArgs) {
  const safeHistory = maskHistoryForStorage(args.history);
  const stats = calculateCanonicalStats(safeHistory, args.startedAt, args.endedAt, args.targetDurationMinutes, args.encounteredVocab);
  const existing = await getDocument(SESSION_COLLECTION, args.sessionId);
  if (existing && existing.studentId && existing.studentId !== args.studentId) throw new Error('SESSION_ID_CONFLICT');
  const studentSessions = existing ? [] : (await queryCollection(SESSION_COLLECTION, 'studentId', args.studentId, 5000)).filter((session) => isAIStudentId(session.aiStudentId));
  const lifetimeSessionNumber = existing?.lifetimeSessionNumber || studentSessions.length + 1;
  const localDate = new Date(args.startedAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
  const dailySessionNumber = existing?.dailySessionNumber || studentSessions.filter((session) => session.localDate === localDate).length + 1;
  const currentClassId = normalizeClassId(args.classId);
  const personaMeta = getPersonaResearchMetadata(args.aiStudentId);
  const events = (args.systemEvents || []).slice(0, 500);
  const eventValues = (type: string) => events.filter((event) => event.type === type).map((event) => Number(event.value || 0)).filter(Number.isFinite);
  const sumEvent = (type: string) => eventValues(type).reduce((sum, value) => sum + value, 0);
  const latestEvent = (type: string) => [...events].reverse().find((event) => event.type === type)?.value || '';
  const document = {
    schemaVersion: 4, researchSchemaVersion: 'research-2026-v1', sessionId: args.sessionId, studentId: args.studentId, researchId: args.researchId,
    classId: currentClassId, academicYear: academicYearForLocalDate(localDate), gradeLevel: gradeLevelForClassId(currentClassId), aiStudentId: args.aiStudentId, topic: args.topic,
    appVersion: process.env.APP_VERSION || 'unknown', build: process.env.APP_BUILD || 'unknown', aiModel: latestEvent('ai_model') || process.env.ANTHROPIC_MODEL || 'unknown',
    aiInputTokens: sumEvent('ai_input_tokens'), aiOutputTokens: sumEvent('ai_output_tokens'), aiCacheReadTokens: sumEvent('ai_cache_read_tokens'), aiCacheCreationTokens: sumEvent('ai_cache_creation_tokens'),
    personaId: personaMeta.personaId, personaCountry: personaMeta.country, personaGender: personaMeta.gender, personaAccentName: personaMeta.accentName, worldEnglishesCircle: personaMeta.worldEnglishesCircle,
    personaLabelCondition: args.personaLabelCondition === 'hidden' ? 'hidden' : 'shown', countryLabelVisible: args.countryLabelVisible !== false, accentLabelVisible: args.accentLabelVisible !== false, flagVisible: args.flagVisible !== false,
    ttsProvider: latestEvent('tts_provider') || 'not_observed', ttsVoiceName: personaMeta.voiceName, ttsLanguageCode: personaMeta.voiceLanguageCode, personaVoiceGender: personaMeta.voiceGender, personaVoicePitch: personaMeta.voicePitch, personaDefaultVoiceRate: personaMeta.defaultVoiceRate,
    studentSelectedSpeechRate: Number(args.studentSelectedSpeechRate || 1), effectiveTtsSpeechRate: Number(latestEvent('tts_effective_rate') || args.effectiveTtsSpeechRate || args.studentSelectedSpeechRate || 1), personaDictionaryVersion: personaMeta.personaDictionaryVersion,
    targetDurationMinutes: args.targetDurationMinutes, actualDurationSeconds: stats.actualDurationSeconds,
    startedAt: new Date(args.startedAt).toISOString(), endedAt: new Date(args.endedAt).toISOString(), localDate,
    lifetimeSessionNumber, dailySessionNumber, totalTurns: stats.totalTurns, totalChildWords: stats.totalChildWords,
    uniqueVocabularyCount: stats.uniqueVocabularyCount,
    childUniqueWordTypes: stats.childUniqueWordTypes, meanChildWordsPerTurn: stats.meanChildWordsPerTurn, maxChildWordsPerTurn: stats.maxChildWordsPerTurn,
    childQuestionCount: stats.childQuestionCount, childReciprocalQuestionCount: stats.childReciprocalQuestionCount, childRepairCount: stats.childRepairCount, childReasonExpressionCount: stats.childReasonExpressionCount,
    history: safeHistory, systemEvents: events,
    encounteredVocab: args.encounteredVocab.slice(0, 200).map((item) => ({ id: item.id, word: item.word, japanese: item.japanese, category: item.category })),
    reflection: args.reflection || null, updatedAt: new Date().toISOString(), createdAt: existing?.createdAt || new Date().toISOString(),
    retentionExpiresAt: new Date(args.endedAt + retentionDays() * 24 * 60 * 60 * 1000),
  };
  await setDocument(SESSION_COLLECTION, args.sessionId, document);
  return document;
}

function learnerTeacherVisibleSession(session: Record<string, any>): boolean {
  const events = Array.isArray(session.systemEvents) ? session.systemEvents : [];
  const hasFinish = events.some((event: any) => event?.type === 'session_finish');
  const hasReflection = Boolean(session.reflection && typeof session.reflection === 'object');
  const schemaVersion = Number(session.schemaVersion || 0);
  const turns = Number(session.totalTurns || 0);
  return hasFinish || hasReflection || (schemaVersion < 3 && turns > 0);
}

export async function getStudentHistory(studentId: string): Promise<Record<string, unknown>[]> {
  const rows = (await queryCollection(SESSION_COLLECTION, 'studentId', studentId, 5000))
    .filter(learnerTeacherVisibleSession)
    .filter((session) => isAIStudentId(session.aiStudentId))
    .sort((a, b) => String(a.endedAt || '').localeCompare(String(b.endedAt || '')));
  return rows.map((session, index) => ({
    sessionId: session.sessionId, aiStudentId: session.aiStudentId, topic: session.topic,
    targetDurationMinutes: session.targetDurationMinutes, actualDurationSeconds: session.actualDurationSeconds,
    endedAt: session.endedAt, lifetimeSessionNumber: index + 1, totalTurns: session.totalTurns,
    totalChildWords: session.totalChildWords, uniqueVocabularyCount: session.uniqueVocabularyCount, reflection: session.reflection || null,
  }));
}

export async function getAllSessionsForManagement(): Promise<Record<string, any>[]> {
  const [sessions, students] = await Promise.all([
    listCollection(SESSION_COLLECTION, 1000),
    getStudentRecordsForManagement(),
  ]);
  const studentById = new Map(students.map((student) => [student.studentId, student]));
  return sessions.map((session) => {
    const student = studentById.get(String(session.studentId || ''));
    return {
      ...session,
      assignedPartnerId: normalizeAssignmentText(session.assignedPartnerId || student?.assignedPartnerId),
      assignedPartnerCountry: normalizeAssignmentText(session.assignedPartnerCountry || student?.assignedPartnerCountry),
      assignmentAnnouncedAt: normalizeAssignmentAnnouncedAt(session.assignmentAnnouncedAt || student?.assignmentAnnouncedAt),
    };
  });
}

export async function getTeacherSessionsForManagement(): Promise<Record<string, any>[]> {
  const [rows, students] = await Promise.all([getAllSessionsForManagement(), getStudentRecordsForManagement()]);
  const records = new Map(students.map((student) => [student.studentId, student]));
  return rows.filter(learnerTeacherVisibleSession).map(({ researchId: _researchId, _name, ...session }) => {
    const rec = records.get(String(session.studentId || ''));
    return {
      ...session,
      classId: normalizeClassId(session.classId || rec?.classId || ''),
      learningId: rec?.learningId || '',
      attendanceNumber: rec?.attendanceNumber ?? '',
    };
  });
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
