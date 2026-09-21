import crypto from 'node:crypto';
import { ReflectionAnswers, ResearchSystemEvent, calculateCanonicalStats, isAIStudentId, maskHistoryForStorage } from '../dataContract';
import type { AIStudentId, ChatMessage, DialogueDurationMinutes, DialogueTopic, PersonaLabelCondition, VisualVocabularyItem } from '../types';
import { getPersonaResearchMetadata } from '../data/personaResearch';
import { createDocumentIfAbsent, getDocument, listCollection, queryCollection, queryCollectionByStringRange, setDocument } from './firestore';
import { resolveTtsRuntimeMetadata } from './ttsRuntimeMetadata';
import {
  normalizeSchoolCondition,
  normalizeStudyGradeLevel,
  normalizeStudyParticipantMetadata,
  normalizeStudySiteId,
  type SchoolCondition,
  type StudySiteId,
} from './studyParticipantMetadata';

const STUDENT_COLLECTION = 'students';
const SESSION_COLLECTION = 'sessions';
const RESEARCH_ID_COLLECTION = 'research_ids';
const RESEARCH_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type ResearchAssignmentMetadata = {
  assignedPartnerId: string;
  assignedPartnerCountry: string;
  assignmentAnnouncedAt: string;
};

export type ResearchAssignmentUpdateInput = {
  researchId: unknown;
  assignedPartnerId?: unknown;
  assignedPartnerCountry?: unknown;
  assignmentAnnouncedAt?: unknown;
  expectedAssignedPartnerId?: unknown;
  expectedAssignedPartnerCountry?: unknown;
};

export type ResearchAssignmentUpdateResult = {
  researchId: string;
  assignedPartnerId: string;
  assignedPartnerCountry: string;
  assignmentAnnouncedAt: string;
  changed: boolean;
};

export type ResearchStudyMetadata = {
  formalStudyParticipant: boolean;
  studySiteId: StudySiteId;
  schoolCondition: SchoolCondition;
  studyGradeLevel: 5 | 6;
  studyStartDate?: string;
};

export type ResearchStudyMetadataUpdateInput = {
  researchId: unknown;
  formalStudyParticipant?: unknown;
  studySiteId?: unknown;
  schoolCondition?: unknown;
  studyGradeLevel?: unknown;
  studyStartDate?: unknown;
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
function normalizeStudyStartDate(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}
function researchStudyMetadataFromRecord(
  record: Record<string, any> | undefined,
  fallback: { studentId?: string; classId?: string; attendanceNumber?: number | '' } = {},
) {
  return normalizeStudyParticipantMetadata(record, fallback);
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

export async function resolveStudentByCode(code: string): Promise<{
  studentId: string;
  researchId: string;
  classId: string;
  active: boolean;
  learningId: string;
  attendanceNumber: number | '';
  formalStudyParticipant: boolean;
  studySiteId: StudySiteId | '';
  schoolCondition: SchoolCondition | '';
  gradeLevel: 5 | 6 | '';
  studyStartDate: string;
  assignedPartnerId: string;
  assignedPartnerCountry: string;
  assignmentAnnouncedAt: string;
} | null> {
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
  const classId = normalizeClassId(doc.classId);
  const attendanceNumber = normalizeAttendanceNumber(doc.attendanceNumber);
  const study = researchStudyMetadataFromRecord(doc, { studentId, classId, attendanceNumber });
  return {
    studentId,
    researchId,
    classId,
    active: true,
    learningId,
    attendanceNumber,
    formalStudyParticipant: study.formalStudyParticipant,
    studySiteId: study.studySiteId,
    schoolCondition: study.schoolCondition,
    gradeLevel: study.gradeLevel,
    studyStartDate: study.studyStartDate,
    ...researchAssignmentFromRecord(doc),
  };
}

export async function createStudentCode(
  code: string,
  studentId?: string,
  researchId?: string,
  classId?: string,
  teacherId?: string,
  attendanceNumber?: unknown,
  researchAssignment?: Partial<ResearchAssignmentMetadata>,
  researchStudy?: Partial<ResearchStudyMetadata>,
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
  const explicitSite = normalizeStudySiteId(researchStudy?.studySiteId);
  const explicitCondition = normalizeSchoolCondition(researchStudy?.schoolCondition);
  const explicitGrade = normalizeStudyGradeLevel(researchStudy?.studyGradeLevel);
  const explicitStartDate = normalizeStudyStartDate(researchStudy?.studyStartDate);
  const explicitFormal = researchStudy?.formalStudyParticipant === true;
  if (explicitFormal && (!explicitSite || !explicitCondition || !explicitGrade)) throw new Error('INVALID_RESEARCH_STUDY_METADATA');
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
    ...(explicitFormal ? {
      formalStudyParticipant: true,
      studySiteId: explicitSite,
      schoolCondition: explicitCondition,
      studyGradeLevel: explicitGrade,
      ...(explicitStartDate ? { studyStartDate: explicitStartDate } : {}),
    } : {}),
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
  formalStudyParticipant: boolean;
  studySiteId: StudySiteId | '';
  schoolCondition: SchoolCondition | '';
  gradeLevel: 5 | 6 | '';
  studyStartDate: string;
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
    formalStudyParticipant: boolean; studySiteId: StudySiteId | ''; schoolCondition: SchoolCondition | ''; gradeLevel: 5 | 6 | ''; studyStartDate: string;
  }> = [];
  for (const [studentId, list] of grouped.entries()) {
    const sorted = list.slice().sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    const activeRecord = sorted.find((row) => row.active !== false) || sorted[0] || {};
    const assignmentRecord = sorted.find((row) => row.assignedPartnerId || row.assignedPartnerCountry || row.assignmentAnnouncedAt) || activeRecord;
    const assignment = researchAssignmentFromRecord(assignmentRecord);
    const study = researchStudyMetadataFromRecord(activeRecord, {
      studentId,
      classId: normalizeClassId(activeRecord.classId),
      attendanceNumber: normalizeAttendanceNumber(activeRecord.attendanceNumber),
    });
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
      formalStudyParticipant: study.formalStudyParticipant,
      studySiteId: study.studySiteId,
      schoolCondition: study.schoolCondition,
      gradeLevel: study.gradeLevel,
      studyStartDate: study.studyStartDate,
    });
  }
  return result.sort((a, b) => a.classId.localeCompare(b.classId, 'ja') || (Number(a.attendanceNumber || 999) - Number(b.attendanceNumber || 999)) || a.learningId.localeCompare(b.learningId));
}

export async function updateStudentStudyMetadata(
  inputs: ResearchStudyMetadataUpdateInput[],
  updatedBy: string,
): Promise<Array<{ researchId: string; changed: boolean; formalStudyParticipant: boolean; studySiteId: StudySiteId; schoolCondition: SchoolCondition; studyGradeLevel: 5 | 6; studyStartDate: string }>> {
  if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 250) throw new Error('INVALID_RESEARCH_STUDY_METADATA_BATCH');
  const allRecords = await listCollection(STUDENT_COLLECTION, 1000);
  const byResearchId = new Map<string, Record<string, any>[]>();
  for (const record of allRecords) {
    const researchId = String(record.researchId || '').trim().toUpperCase();
    if (!researchId) continue;
    const list = byResearchId.get(researchId) || [];
    list.push(record);
    byResearchId.set(researchId, list);
  }

  const now = new Date().toISOString();
  const actor = String(updatedBy || 'researcher').slice(0, 100);
  const results = [];
  for (const input of inputs) {
    const researchId = typeof input?.researchId === 'string' ? input.researchId.trim().toUpperCase() : '';
    if (!/^R-[A-Z2-9]{8,20}$/.test(researchId)) throw new Error('INVALID_RESEARCH_ID');
    if (input.formalStudyParticipant !== true) throw new Error('FORMAL_STUDY_PARTICIPANT_REQUIRED');
    const studySiteId = normalizeStudySiteId(input.studySiteId);
    const schoolCondition = normalizeSchoolCondition(input.schoolCondition);
    const studyGradeLevel = normalizeStudyGradeLevel(input.studyGradeLevel);
    const studyStartDate = normalizeStudyStartDate(input.studyStartDate);
    if (!studySiteId || !schoolCondition || !studyGradeLevel) throw new Error('INVALID_RESEARCH_STUDY_METADATA');
    if (schoolCondition === 'comparison' && studySiteId !== 'site_b') throw new Error('COMPARISON_SITE_MISMATCH');
    if (schoolCondition === 'intervention' && studySiteId !== 'site_a') throw new Error('INTERVENTION_SITE_MISMATCH');
    const records = byResearchId.get(researchId) || [];
    if (!records.length) throw new Error('RESEARCH_PARTICIPANT_NOT_FOUND');
    let changed = false;
    for (const record of records) {
      const id = documentId(record);
      if (!id) continue;
      const current = researchStudyMetadataFromRecord(record, {
        studentId: String(record.studentId || ''),
        classId: normalizeClassId(record.classId),
        attendanceNumber: normalizeAttendanceNumber(record.attendanceNumber),
      });
      const differs = !current.formalStudyParticipant
        || current.studySiteId !== studySiteId
        || current.schoolCondition !== schoolCondition
        || current.gradeLevel !== studyGradeLevel
        || current.studyStartDate !== studyStartDate;
      if (!differs) continue;
      changed = true;
      const history = Array.isArray(record.researchStudyMetadataHistory) ? record.researchStudyMetadataHistory.slice(-99) : [];
      await setDocument(STUDENT_COLLECTION, id, {
        ...withoutInternal(record),
        formalStudyParticipant: true,
        studySiteId,
        schoolCondition,
        studyGradeLevel,
        ...(studyStartDate ? { studyStartDate } : {}),
        researchStudyMetadataHistory: [...history, {
          previous: current,
          next: { formalStudyParticipant: true, studySiteId, schoolCondition, gradeLevel: studyGradeLevel, studyStartDate },
          updatedAt: now,
          updatedBy: actor,
        }],
        updatedAt: now,
      });
    }
    results.push({ researchId, changed, formalStudyParticipant: true, studySiteId, schoolCondition, studyGradeLevel, studyStartDate });
  }
  return results;
}

export async function updateStudentResearchAssignments(
  inputs: ResearchAssignmentUpdateInput[],
  updatedBy: string,
): Promise<ResearchAssignmentUpdateResult[]> {
  if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 250) throw new Error('INVALID_RESEARCH_ASSIGNMENT_BATCH');
  const allRecords = await listCollection(STUDENT_COLLECTION, 1000);
  const byResearchId = new Map<string, Record<string, any>[]>();
  for (const record of allRecords) {
    const researchId = String(record.researchId || '').trim().toUpperCase();
    if (!researchId) continue;
    const list = byResearchId.get(researchId) || [];
    list.push(record);
    byResearchId.set(researchId, list);
  }

  const normalizedInputs = inputs.map((input) => {
    const researchId = typeof input?.researchId === 'string' ? input.researchId.trim().toUpperCase() : '';
    if (!/^R-[A-Z2-9]{8,20}$/.test(researchId)) throw new Error('INVALID_RESEARCH_ID');
    const assignedPartnerId = normalizeAssignmentText(input.assignedPartnerId);
    const assignedPartnerCountry = normalizeAssignmentText(input.assignedPartnerCountry);
    const rawAnnouncedAt = typeof input.assignmentAnnouncedAt === 'string' ? input.assignmentAnnouncedAt.trim() : '';
    const assignmentAnnouncedAt = normalizeAssignmentAnnouncedAt(rawAnnouncedAt);
    if (rawAnnouncedAt && !assignmentAnnouncedAt) throw new Error('INVALID_ASSIGNMENT_ANNOUNCED_AT');
    return {
      researchId,
      assignedPartnerId,
      assignedPartnerCountry,
      assignmentAnnouncedAt,
      expectedAssignedPartnerId: normalizeAssignmentText(input.expectedAssignedPartnerId),
      expectedAssignedPartnerCountry: normalizeAssignmentText(input.expectedAssignedPartnerCountry),
      hasExpectedPartnerId: Object.prototype.hasOwnProperty.call(input || {}, 'expectedAssignedPartnerId'),
      hasExpectedCountry: Object.prototype.hasOwnProperty.call(input || {}, 'expectedAssignedPartnerCountry'),
    };
  });
  if (new Set(normalizedInputs.map((item) => item.researchId)).size !== normalizedInputs.length) throw new Error('DUPLICATE_RESEARCH_ASSIGNMENT');

  const now = new Date().toISOString();
  const actor = String(updatedBy || 'researcher').slice(0, 100);
  const results: ResearchAssignmentUpdateResult[] = [];
  for (const input of normalizedInputs) {
    const records = byResearchId.get(input.researchId) || [];
    if (!records.length) throw new Error('RESEARCH_PARTICIPANT_NOT_FOUND');
    const sorted = records.slice().sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    const activeRecord = sorted.find((row) => row.active !== false) || sorted[0] || {};
    const assignmentRecord = sorted.find((row) => row.assignedPartnerId || row.assignedPartnerCountry || row.assignmentAnnouncedAt) || activeRecord;
    const current = researchAssignmentFromRecord(assignmentRecord);
    if (input.hasExpectedCountry && input.expectedAssignedPartnerCountry !== current.assignedPartnerCountry) throw new Error('RESEARCH_ASSIGNMENT_CONFLICT');
    if (input.hasExpectedPartnerId && input.expectedAssignedPartnerId !== current.assignedPartnerId) throw new Error('RESEARCH_ASSIGNMENT_CONFLICT');

    const changed = current.assignedPartnerId !== input.assignedPartnerId
      || current.assignedPartnerCountry !== input.assignedPartnerCountry
      || current.assignmentAnnouncedAt !== input.assignmentAnnouncedAt;
    if (changed) {
      const historyEvent = {
        previousPartnerId: current.assignedPartnerId,
        newPartnerId: input.assignedPartnerId,
        previousCountry: current.assignedPartnerCountry,
        newCountry: input.assignedPartnerCountry,
        previousAnnouncedAt: current.assignmentAnnouncedAt,
        newAnnouncedAt: input.assignmentAnnouncedAt,
        updatedAt: now,
        updatedBy: actor,
      };
      for (const record of records) {
        const id = documentId(record);
        if (!id) continue;
        const history = Array.isArray(record.researchAssignmentHistory) ? record.researchAssignmentHistory.slice(-99) : [];
        await setDocument(STUDENT_COLLECTION, id, {
          ...withoutInternal(record),
          assignedPartnerId: input.assignedPartnerId,
          assignedPartnerCountry: input.assignedPartnerCountry,
          assignmentAnnouncedAt: input.assignmentAnnouncedAt,
          researchAssignmentHistory: [...history, historyEvent],
          updatedAt: now,
        });
      }
    }
    results.push({
      researchId: input.researchId,
      assignedPartnerId: input.assignedPartnerId,
      assignedPartnerCountry: input.assignedPartnerCountry,
      assignmentAnnouncedAt: input.assignmentAnnouncedAt,
      changed,
    });
  }
  return results;
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
  if (!/^(?:[56]-(?:[123]|C[1-9]|PB)|テスト|予備)$/.test(cid)) throw new Error('INVALID_CLASS_ID');
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
  assignedPartnerId?: string; assignedPartnerCountry?: string; assignmentAnnouncedAt?: string;
}

export async function saveCanonicalSession(args: SaveCanonicalSessionArgs) {
  const safeHistory = maskHistoryForStorage(args.history);
  // Research metrics must describe the learner's original English, not anonymization placeholders.
  const stats = calculateCanonicalStats(args.history, args.startedAt, args.endedAt, args.targetDurationMinutes, args.encounteredVocab);
  const existing = await getDocument(SESSION_COLLECTION, args.sessionId);
  if (existing && existing.studentId && existing.studentId !== args.studentId) throw new Error('SESSION_ID_CONFLICT');
  const assignmentSnapshot = existing ? researchAssignmentFromRecord(existing) : researchAssignmentFromRecord(args as unknown as Record<string, any>);
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
  const ttsRuntime = resolveTtsRuntimeMetadata(args.aiStudentId, latestEvent('tts_provider'));
  const ttsProviderEvents = events.filter((event) => event.type === 'tts_provider').map((event) => String(event.value || '')).filter(Boolean);
  const distinctTtsProviders = Array.from(new Set(ttsProviderEvents));
  const ttsActualProvider = distinctTtsProviders.length === 0 ? 'not_observed' : distinctTtsProviders.length === 1 ? distinctTtsProviders[0] : 'mixed';
  const ttsFallbackCount = events.filter((event) => event.type === 'tts_fallback_from' && event.value === 'azure-speech').length;
  const ttsLatencyRaw = Number(latestEvent('tts_latency_ms'));
  const ttsProviderObserved = ttsActualProvider === 'not_observed' ? 0 : 1;
  const ttsProviderDeviation: number | '' = ttsActualProvider === 'not_observed' ? '' : ttsActualProvider === 'azure-speech' ? 0 : 1;
  const document = {
    schemaVersion: 4, researchSchemaVersion: 'research-2026-v1', sessionId: args.sessionId, studentId: args.studentId, researchId: args.researchId,
    classId: currentClassId, academicYear: academicYearForLocalDate(localDate), gradeLevel: gradeLevelForClassId(currentClassId), aiStudentId: args.aiStudentId, topic: args.topic,
    appVersion: process.env.APP_VERSION || 'unknown', build: process.env.APP_BUILD || 'unknown', aiModel: latestEvent('ai_model') || process.env.ANTHROPIC_MODEL || 'unknown',
    aiInputTokens: sumEvent('ai_input_tokens'), aiOutputTokens: sumEvent('ai_output_tokens'), aiCacheReadTokens: sumEvent('ai_cache_read_tokens'), aiCacheCreationTokens: sumEvent('ai_cache_creation_tokens'),
    personaId: personaMeta.personaId, personaCountry: personaMeta.country, personaGender: personaMeta.gender, personaAccentName: personaMeta.accentName, worldEnglishesCircle: personaMeta.worldEnglishesCircle,
    assignedPartnerId: assignmentSnapshot.assignedPartnerId, assignedPartnerCountry: assignmentSnapshot.assignedPartnerCountry, assignmentAnnouncedAt: assignmentSnapshot.assignmentAnnouncedAt,
    personaLabelCondition: args.personaLabelCondition === 'hidden' ? 'hidden' : 'shown', countryLabelVisible: args.countryLabelVisible !== false, accentLabelVisible: args.accentLabelVisible !== false, flagVisible: args.flagVisible !== false,
    ttsProvider: ttsRuntime.provider, ttsVoiceName: ttsRuntime.voiceName, ttsLanguageCode: ttsRuntime.languageCode,
    ttsTelemetryVersion: 'cors-visible-v1', ttsPrimaryProvider: 'azure-speech', ttsActualProvider, ttsProviderObserved, ttsProviderEventCount: ttsProviderEvents.length,
    ttsFallbackCount, ttsFallbackFrom: latestEvent('tts_fallback_from'), ttsFallbackReason: latestEvent('tts_fallback_reason'),
    ttsLatencyMs: Number.isFinite(ttsLatencyRaw) && ttsLatencyRaw >= 0 ? Math.round(ttsLatencyRaw) : 0, ttsProviderDeviation,
    personaVoiceGender: personaMeta.voiceGender, personaVoicePitch: personaMeta.voicePitch, personaDefaultVoiceRate: personaMeta.defaultVoiceRate,
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
function managementSessionsWithAssignments(
  sessions: Record<string, any>[],
  students: Awaited<ReturnType<typeof getStudentRecordsForManagement>>,
): Record<string, any>[] {
  const studentById = new Map(students.map((student) => [student.studentId, student]));
  return sessions.map((session) => {
    const student = studentById.get(String(session.studentId || ''));
    return {
      ...session,
      assignedPartnerId: normalizeAssignmentText(session.assignedPartnerId),
      assignedPartnerCountry: normalizeAssignmentText(session.assignedPartnerCountry),
      assignmentAnnouncedAt: normalizeAssignmentAnnouncedAt(session.assignmentAnnouncedAt),
      formalStudyParticipant: student?.formalStudyParticipant === true,
      studySiteId: student?.studySiteId || '',
      schoolCondition: student?.schoolCondition || '',
      studyGradeLevel: student?.gradeLevel || '',
      studyStartDate: student?.studyStartDate || '',
    };
  });
}

function managementDateBoundary(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

export async function getSessionsForManagementByLocalDateRange(start?: unknown, end?: unknown): Promise<Record<string, any>[]> {
  const from = managementDateBoundary(start);
  const to = managementDateBoundary(end);
  const [sessions, students] = await Promise.all([
    (from || to)
      ? queryCollectionByStringRange(SESSION_COLLECTION, 'localDate', from, to)
      : listCollection(SESSION_COLLECTION, 1000),
    getStudentRecordsForManagement(),
  ]);
  return managementSessionsWithAssignments(sessions, students);
}

export async function getAllSessionsForManagement(): Promise<Record<string, any>[]> {
  return getSessionsForManagementByLocalDateRange();
}

export async function getResearchSessionsByResearchIdForManagement(researchId: string): Promise<Record<string, any>[]> {
  const normalized = String(researchId || '').trim().toUpperCase();
  if (!normalized) return [];
  return queryCollection(SESSION_COLLECTION, 'researchId', normalized, 1000);
}

export async function getResearchSessionByIdForManagement(sessionId: string): Promise<Record<string, any> | null> {
  const normalized = String(sessionId || '').trim();
  if (!normalized) return null;
  return getDocument(SESSION_COLLECTION, normalized);
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
    reflection_scale_version: session.reflection?.scaleVersion || (session.reflection ? 'legacy-135' : ''),
    reflection_understood_partner: session.reflection?.understoodPartner ?? '',
    reflection_conveyed_ideas: session.reflection?.conveyedIdeas ?? '',
    reflection_noticed_language_culture: session.reflection?.noticedLanguageCulture ?? '',
  };
}
