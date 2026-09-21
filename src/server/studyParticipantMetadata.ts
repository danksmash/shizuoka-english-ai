import crypto from 'node:crypto';
import { STUDY1_FORMAL_PARTICIPANT_HASHES } from './study1FormalParticipantHashes';

export type StudySiteId = 'site_a' | 'site_b';
export type SchoolCondition = 'intervention' | 'comparison';

export interface StudyParticipantMetadata {
  formalStudyParticipant: boolean;
  studySiteId: StudySiteId | '';
  schoolCondition: SchoolCondition | '';
  gradeLevel: 5 | 6 | '';
  studyStartDate: string;
}

const LEGACY_FORMAL_CLASS_SIZES: Record<string, number> = {
  '5-1': 26,
  '5-2': 25,
  '5-3': 25,
  '6-1': 34,
  '6-2': 35,
};

export function formalStudy1ParticipantHash(studentId: string): string {
  return crypto.createHash('sha256').update(`study1-formal-v1|${String(studentId || '').trim()}`).digest('hex');
}

export function isLegacyFormalStudy1ParticipantHash(
  studentIdHash: string,
  classId: string,
  attendanceNumber: number | '',
): boolean {
  const max = LEGACY_FORMAL_CLASS_SIZES[classId];
  const attendance = Number(attendanceNumber);
  return STUDY1_FORMAL_PARTICIPANT_HASHES.has(studentIdHash)
    && Boolean(max)
    && Number.isInteger(attendance)
    && attendance >= 1
    && attendance <= max;
}

export function isLegacyFormalStudy1Participant(student: {
  studentId: string;
  classId: string;
  attendanceNumber: number | '';
}): boolean {
  return isLegacyFormalStudy1ParticipantHash(
    formalStudy1ParticipantHash(student.studentId),
    student.classId,
    student.attendanceNumber,
  );
}

export function gradeLevelForStudyClassId(classId: unknown): 5 | 6 | '' {
  const normalized = String(classId || '').trim();
  if (/^5-/.test(normalized)) return 5;
  if (/^6-/.test(normalized)) return 6;
  return '';
}

function normalizedStudyStartDate(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

export function normalizeStudyParticipantMetadata(
  record: Record<string, any> | undefined,
  fallback: { studentId?: string; classId?: string; attendanceNumber?: number | '' } = {},
): StudyParticipantMetadata {
  const classId = String(record?.classId || fallback.classId || '').trim();
  const attendanceNumber = Number.isInteger(Number(record?.attendanceNumber))
    ? Number(record?.attendanceNumber)
    : (fallback.attendanceNumber ?? '');
  const studentId = String(record?.studentId || fallback.studentId || '').trim();

  const explicitSite: StudySiteId | '' = record?.studySiteId === 'site_a' || record?.studySiteId === 'site_b'
    ? record.studySiteId
    : '';
  const explicitCondition: SchoolCondition | '' = record?.schoolCondition === 'intervention' || record?.schoolCondition === 'comparison'
    ? record.schoolCondition
    : '';
  const explicitGrade = Number(record?.studyGradeLevel);
  const gradeLevel: 5 | 6 | '' = explicitGrade === 5 || explicitGrade === 6
    ? explicitGrade
    : gradeLevelForStudyClassId(classId);
  const explicitFormal = record?.formalStudyParticipant === true;

  if (explicitFormal && explicitSite && explicitCondition && gradeLevel) {
    return {
      formalStudyParticipant: true,
      studySiteId: explicitSite,
      schoolCondition: explicitCondition,
      gradeLevel,
      studyStartDate: normalizedStudyStartDate(record?.studyStartDate),
    };
  }

  if (studentId && isLegacyFormalStudy1Participant({
    studentId,
    classId,
    attendanceNumber: attendanceNumber as number | '',
  })) {
    return {
      formalStudyParticipant: true,
      studySiteId: 'site_a',
      schoolCondition: 'intervention',
      gradeLevel: gradeLevelForStudyClassId(classId),
      studyStartDate: '2026-09-17',
    };
  }

  return {
    formalStudyParticipant: false,
    studySiteId: '',
    schoolCondition: '',
    gradeLevel,
    studyStartDate: normalizedStudyStartDate(record?.studyStartDate),
  };
}

export function normalizeStudySiteId(value: unknown): StudySiteId | '' {
  return value === 'site_a' || value === 'site_b' ? value : '';
}

export function normalizeSchoolCondition(value: unknown): SchoolCondition | '' {
  return value === 'intervention' || value === 'comparison' ? value : '';
}

export function normalizeStudyGradeLevel(value: unknown): 5 | 6 | '' {
  const numeric = Number(value);
  return numeric === 5 || numeric === 6 ? numeric : '';
}

export function validComparisonClassId(classId: unknown): boolean {
  return /^[56]-C[1-9]$/.test(String(classId || '').trim());
}
