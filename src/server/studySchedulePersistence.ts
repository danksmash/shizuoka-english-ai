import { getDocument, listCollection, setDocument } from './firestore';

export const STUDY_SCHEDULE_COLLECTION = 'study_schedules';
export const STUDY_CLASS_IDS = ['5-1', '5-2', '5-3', '6-1', '6-2', '6-3'] as const;
export type StudyClassId = typeof STUDY_CLASS_IDS[number];
export type StudyPhase = 'unconfigured' | 'pre_start' | 'unknown_virtual_other' | 'anticipated_other' | 'identified_real_other' | 'exchange_or_after';

export interface StudyScheduleSnapshot {
  revision: number;
  appStartDate: string;
  nationalityRevealDate: string;
  videoViewDate: string;
  exchangeDate: string;
  updatedAt: string;
  updatedBy: string;
}

export interface StudyScheduleRecord extends StudyScheduleSnapshot {
  classId: StudyClassId;
  history: StudyScheduleSnapshot[];
}

export interface StudyScheduleInput {
  classId: unknown;
  appStartDate?: unknown;
  nationalityRevealDate?: unknown;
  videoViewDate?: unknown;
  exchangeDate?: unknown;
  expectedRevision?: unknown;
}

export function isStudyClassId(value: unknown): value is StudyClassId {
  return typeof value === 'string' && (STUDY_CLASS_IDS as readonly string[]).includes(value);
}

function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function normalizeStudyDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  const text = typeof value === 'string' ? value.trim() : '';
  if (!isRealIsoDate(text)) throw new Error('INVALID_STUDY_DATE');
  return text;
}

function normalizeSnapshot(value: Record<string, any> | undefined, fallbackRevision = 0): StudyScheduleSnapshot {
  const safeDate = (raw: unknown) => {
    try { return normalizeStudyDate(raw); } catch { return ''; }
  };
  const revision = Number(value?.revision);
  return {
    revision: Number.isInteger(revision) && revision >= 0 ? revision : fallbackRevision,
    appStartDate: safeDate(value?.appStartDate),
    nationalityRevealDate: safeDate(value?.nationalityRevealDate),
    videoViewDate: safeDate(value?.videoViewDate),
    exchangeDate: safeDate(value?.exchangeDate),
    updatedAt: typeof value?.updatedAt === 'string' ? value.updatedAt : '',
    updatedBy: typeof value?.updatedBy === 'string' ? value.updatedBy.slice(0, 100) : '',
  };
}

function blankSchedule(classId: StudyClassId): StudyScheduleRecord {
  return {
    classId,
    revision: 0,
    appStartDate: '',
    nationalityRevealDate: '',
    videoViewDate: '',
    exchangeDate: '',
    updatedAt: '',
    updatedBy: '',
    history: [],
  };
}

function normalizeRecord(row: Record<string, any> | null, classId: StudyClassId): StudyScheduleRecord {
  if (!row) return blankSchedule(classId);
  const current = normalizeSnapshot(row);
  const history = Array.isArray(row.history)
    ? row.history.map((item: any) => normalizeSnapshot(item)).filter((item: StudyScheduleSnapshot) => item.revision > 0).slice(-100)
    : [];
  return { classId, ...current, history };
}

export function validateStudyScheduleOrder(schedule: Pick<StudyScheduleSnapshot, 'appStartDate' | 'nationalityRevealDate' | 'videoViewDate' | 'exchangeDate'>): void {
  const ordered = [schedule.appStartDate, schedule.nationalityRevealDate, schedule.videoViewDate, schedule.exchangeDate].filter(Boolean);
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index] < ordered[index - 1]) throw new Error('INVALID_STUDY_DATE_ORDER');
  }
}

export function phaseForLocalDate(localDate: string, schedule: Pick<StudyScheduleSnapshot, 'appStartDate' | 'nationalityRevealDate' | 'videoViewDate' | 'exchangeDate'>): StudyPhase {
  if (!isRealIsoDate(localDate) || !schedule.appStartDate) return 'unconfigured';
  if (localDate < schedule.appStartDate) return 'pre_start';
  if (!schedule.nationalityRevealDate || localDate < schedule.nationalityRevealDate) return 'unknown_virtual_other';
  if (!schedule.videoViewDate || localDate < schedule.videoViewDate) return 'anticipated_other';
  if (!schedule.exchangeDate || localDate < schedule.exchangeDate) return 'identified_real_other';
  return 'exchange_or_after';
}

export async function getStudySchedule(classId: StudyClassId): Promise<StudyScheduleRecord> {
  return normalizeRecord(await getDocument(STUDY_SCHEDULE_COLLECTION, classId), classId);
}

export async function getAllStudySchedules(): Promise<StudyScheduleRecord[]> {
  const rows = await listCollection(STUDY_SCHEDULE_COLLECTION, 100);
  const byClass = new Map<string, Record<string, any>>();
  for (const row of rows) {
    const classId = typeof row.classId === 'string' ? row.classId : String(row._name || '').split('/').pop() || '';
    if (isStudyClassId(classId)) byClass.set(classId, row);
  }
  return STUDY_CLASS_IDS.map((classId) => normalizeRecord(byClass.get(classId) || null, classId));
}

export async function saveStudySchedule(input: StudyScheduleInput, updatedBy: string): Promise<StudyScheduleRecord> {
  if (!isStudyClassId(input.classId)) throw new Error('INVALID_STUDY_CLASS_ID');
  const classId = input.classId;
  const current = await getStudySchedule(classId);
  const expectedRevision = Number(input.expectedRevision ?? current.revision);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) throw new Error('INVALID_EXPECTED_REVISION');
  if (expectedRevision !== current.revision) throw new Error('STUDY_SCHEDULE_REVISION_CONFLICT');

  const nextDates = {
    appStartDate: normalizeStudyDate(input.appStartDate),
    nationalityRevealDate: normalizeStudyDate(input.nationalityRevealDate),
    videoViewDate: normalizeStudyDate(input.videoViewDate),
    exchangeDate: normalizeStudyDate(input.exchangeDate),
  };
  validateStudyScheduleOrder(nextDates);

  const unchanged = current.appStartDate === nextDates.appStartDate
    && current.nationalityRevealDate === nextDates.nationalityRevealDate
    && current.videoViewDate === nextDates.videoViewDate
    && current.exchangeDate === nextDates.exchangeDate;
  if (unchanged) return current;

  const now = new Date().toISOString();
  const snapshot: StudyScheduleSnapshot = {
    revision: current.revision + 1,
    ...nextDates,
    updatedAt: now,
    updatedBy: String(updatedBy || 'researcher').slice(0, 100),
  };
  const record: StudyScheduleRecord = {
    classId,
    ...snapshot,
    history: [...current.history, snapshot].slice(-100),
  };
  await setDocument(STUDY_SCHEDULE_COLLECTION, classId, record as unknown as Record<string, unknown>);
  return record;
}
