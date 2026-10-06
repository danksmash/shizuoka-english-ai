import { getDocument, listCollection, setDocument } from './firestore';

export const STUDY_SCHEDULE_COLLECTION = 'study_schedules';
export const STUDY_CLASS_IDS = ['5-1', '5-2', '5-3', '6-1', '6-2'] as const;
export type StudyClassId = string;
export type StudyPhase = 'unconfigured' | 'pre_start' | 'unknown_virtual_other' | 'anticipated_other' | 'identified_real_other' | 'exchange_or_after';
export type AnalysisPeriod = 'period1' | 'period2' | 'period3' | '';

export interface StudyScheduleSnapshot {
  revision: number;
  appStartDate: string;
  nationalityRevealDate: string;
  announcedVisitorCountries: string[];
  announcedVisitorCountryCounts: Record<string, number>;
  videoViewDate: string;
  assignmentRevealDate: string;
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
  announcedVisitorCountries?: unknown;
  announcedVisitorCountryCounts?: unknown;
  videoViewDate?: unknown;
  assignmentRevealDate?: unknown;
  exchangeDate?: unknown;
  expectedRevision?: unknown;
}

export function isStudyClassId(value: unknown): value is StudyClassId {
  return typeof value === 'string'
    && ((STUDY_CLASS_IDS as readonly string[]).includes(value) || /^[56]-C[1-9]$/.test(value));
}

function configuredComparisonClassIds(): StudyClassId[] {
  const raw = process.env.STUDY_COMPARISON_CLASS_IDS || '6-C1';
  return [...new Set(raw
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter((value) => /^[56]-C[1-9]$/.test(value)))];
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

function normalizeVisitorCountries(value: unknown): string[] {
  if (value === null || value === undefined || value === '') return [];
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[|,\n]/)
      : [];
  const out: string[] = [];
  for (const item of raw) {
    const country = typeof item === 'string' ? item.trim().slice(0, 120) : '';
    if (country && !out.includes(country)) out.push(country);
  }
  if (out.length > 20) throw new Error('INVALID_VISITOR_COUNTRY_LIST');
  return out;
}

function normalizeVisitorCountryCounts(value: unknown, countries: string[]): Record<string, number> {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const out: Record<string, number> = {};
  for (const country of countries) {
    const parsed = Number(source[country]);
    if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 1 && parsed <= 20) out[country] = parsed;
    else out[country] = 1;
  }
  return out;
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
    announcedVisitorCountries: normalizeVisitorCountries(value?.announcedVisitorCountries),
    announcedVisitorCountryCounts: normalizeVisitorCountryCounts(value?.announcedVisitorCountryCounts, normalizeVisitorCountries(value?.announcedVisitorCountries)),
    videoViewDate: safeDate(value?.videoViewDate),
    assignmentRevealDate: safeDate(value?.assignmentRevealDate),
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
    announcedVisitorCountries: [],
    announcedVisitorCountryCounts: {},
    videoViewDate: '',
    assignmentRevealDate: '',
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

export function identifiedOtherStartDate(schedule: Pick<StudyScheduleSnapshot, 'videoViewDate' | 'assignmentRevealDate' | 'announcedVisitorCountries'>): string {
  const visitorSetConfigured = Array.isArray(schedule.announcedVisitorCountries) && schedule.announcedVisitorCountries.length > 0;
  if (visitorSetConfigured) {
    if (!schedule.videoViewDate || !schedule.assignmentRevealDate) return '';
    return schedule.videoViewDate > schedule.assignmentRevealDate ? schedule.videoViewDate : schedule.assignmentRevealDate;
  }
  return schedule.assignmentRevealDate || schedule.videoViewDate || '';
}

export function validateStudyScheduleOrder(schedule: Pick<StudyScheduleSnapshot, 'appStartDate' | 'nationalityRevealDate' | 'videoViewDate' | 'assignmentRevealDate' | 'exchangeDate'>): void {
  if (schedule.appStartDate && schedule.nationalityRevealDate && schedule.nationalityRevealDate < schedule.appStartDate) throw new Error('INVALID_STUDY_DATE_ORDER');
  if (schedule.nationalityRevealDate && schedule.videoViewDate && schedule.videoViewDate < schedule.nationalityRevealDate) throw new Error('INVALID_STUDY_DATE_ORDER');
  if (schedule.nationalityRevealDate && schedule.assignmentRevealDate && schedule.assignmentRevealDate < schedule.nationalityRevealDate) throw new Error('INVALID_STUDY_DATE_ORDER');
  if (schedule.nationalityRevealDate && schedule.exchangeDate && schedule.exchangeDate < schedule.nationalityRevealDate) throw new Error('INVALID_STUDY_DATE_ORDER');
  for (const date of [schedule.videoViewDate, schedule.assignmentRevealDate].filter(Boolean)) {
    if (schedule.exchangeDate && schedule.exchangeDate < date) throw new Error('INVALID_STUDY_DATE_ORDER');
  }
}

export function phaseForLocalDate(localDate: string, schedule: Pick<StudyScheduleSnapshot, 'appStartDate' | 'nationalityRevealDate' | 'announcedVisitorCountries' | 'videoViewDate' | 'assignmentRevealDate' | 'exchangeDate'>): StudyPhase {
  if (!isRealIsoDate(localDate) || !schedule.appStartDate) return 'unconfigured';
  if (localDate < schedule.appStartDate) return 'pre_start';
  if (!schedule.nationalityRevealDate || localDate < schedule.nationalityRevealDate) return 'unknown_virtual_other';
  if (schedule.exchangeDate && localDate >= schedule.exchangeDate) return 'exchange_or_after';
  const phase3Start = identifiedOtherStartDate(schedule);
  if (!phase3Start || localDate < phase3Start) return 'anticipated_other';
  return 'identified_real_other';
}

export function analysisPeriodForLocalDate(
  localDate: string,
  schedule: Pick<StudyScheduleSnapshot, 'appStartDate' | 'nationalityRevealDate' | 'announcedVisitorCountries' | 'videoViewDate' | 'assignmentRevealDate' | 'exchangeDate'>,
): AnalysisPeriod {
  if (!isRealIsoDate(localDate) || !schedule.appStartDate) return '';
  if (localDate < schedule.appStartDate) return '';
  if (schedule.exchangeDate && localDate >= schedule.exchangeDate) return '';
  if (!schedule.nationalityRevealDate || localDate < schedule.nationalityRevealDate) return 'period1';
  const phase3Start = identifiedOtherStartDate(schedule);
  if (phase3Start && localDate >= phase3Start) return 'period3';
  return 'period2';
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
  const classIds = [...new Set([
    ...STUDY_CLASS_IDS,
    ...configuredComparisonClassIds(),
    ...[...byClass.keys()].filter((classId) => /^[56]-C[1-9]$/.test(classId)),
  ])].sort((a, b) => a.localeCompare(b, 'ja'));
  return classIds.map((classId) => normalizeRecord(byClass.get(classId) || null, classId));
}

export async function saveStudySchedule(input: StudyScheduleInput, updatedBy: string): Promise<StudyScheduleRecord> {
  if (!isStudyClassId(input.classId)) throw new Error('INVALID_STUDY_CLASS_ID');
  const classId = input.classId;
  const current = await getStudySchedule(classId);
  const expectedRevision = Number(input.expectedRevision ?? current.revision);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) throw new Error('INVALID_EXPECTED_REVISION');
  if (expectedRevision !== current.revision) throw new Error('STUDY_SCHEDULE_REVISION_CONFLICT');

  const hasVisitorCountries = Object.prototype.hasOwnProperty.call(input, 'announcedVisitorCountries');
  const announcedVisitorCountries = hasVisitorCountries
    ? normalizeVisitorCountries(input.announcedVisitorCountries)
    : current.announcedVisitorCountries;
  const announcedVisitorCountryCounts = Object.prototype.hasOwnProperty.call(input, 'announcedVisitorCountryCounts')
    ? normalizeVisitorCountryCounts(input.announcedVisitorCountryCounts, announcedVisitorCountries)
    : normalizeVisitorCountryCounts(current.announcedVisitorCountryCounts, announcedVisitorCountries);
  const nextDates = {
    appStartDate: Object.prototype.hasOwnProperty.call(input, 'appStartDate') ? normalizeStudyDate(input.appStartDate) : current.appStartDate,
    nationalityRevealDate: Object.prototype.hasOwnProperty.call(input, 'nationalityRevealDate') ? normalizeStudyDate(input.nationalityRevealDate) : current.nationalityRevealDate,
    videoViewDate: Object.prototype.hasOwnProperty.call(input, 'videoViewDate') ? normalizeStudyDate(input.videoViewDate) : current.videoViewDate,
    assignmentRevealDate: Object.prototype.hasOwnProperty.call(input, 'assignmentRevealDate') ? normalizeStudyDate(input.assignmentRevealDate) : current.assignmentRevealDate,
    exchangeDate: Object.prototype.hasOwnProperty.call(input, 'exchangeDate') ? normalizeStudyDate(input.exchangeDate) : current.exchangeDate,
  };
  validateStudyScheduleOrder(nextDates);

  const unchanged = current.appStartDate === nextDates.appStartDate
    && current.nationalityRevealDate === nextDates.nationalityRevealDate
    && JSON.stringify(current.announcedVisitorCountries) === JSON.stringify(announcedVisitorCountries)
    && JSON.stringify(current.announcedVisitorCountryCounts) === JSON.stringify(announcedVisitorCountryCounts)
    && current.videoViewDate === nextDates.videoViewDate
    && current.assignmentRevealDate === nextDates.assignmentRevealDate
    && current.exchangeDate === nextDates.exchangeDate;
  if (unchanged) return current;

  const now = new Date().toISOString();
  const snapshot: StudyScheduleSnapshot = {
    revision: current.revision + 1,
    ...nextDates,
    announcedVisitorCountries,
    announcedVisitorCountryCounts,
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
