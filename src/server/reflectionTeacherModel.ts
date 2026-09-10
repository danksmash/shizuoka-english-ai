import type { ReflectionRecord } from './reflectionPersistence';

export interface TeacherRosterStudent {
  studentId: string;
  learningId: string;
  classId: string;
  attendanceNumber: number | '';
  active: boolean;
}

export type ReflectionTeacherDataScope = 'all' | 'main' | 'pilot_b' | 'test' | 'reserve';
export type ReflectionTeacherGrade = 'all' | '5' | '6';
export type ReflectionTeacherClassNumber = 'all' | '1' | '2' | '3';
type ConcreteDataScope = Exclude<ReflectionTeacherDataScope, 'all'>;
type ConcreteGrade = Exclude<ReflectionTeacherGrade, 'all'> | '';
type ConcreteClassNumber = Exclude<ReflectionTeacherClassNumber, 'all'> | '';

export const REFLECTION_RATING_SCALE_MIN = 1;
export const REFLECTION_RATING_SCALE_MAX = 4;
export const REFLECTION_RATING_ITEM_1 = 'めあてに向かって取り組めた';
export const REFLECTION_RATING_ITEM_2 = '相手の話を聞いて分かろうとしたり，自分の気持ちを伝えようとしたりした';

export const RESEARCH_LESSON_REFLECTION_HEADERS = [
  'research_id', 'class_id', 'data_scope', 'grade_level', 'class_number', 'local_date', 'status', 'today_goal',
  'goal_rating', 'communication_rating', 'rating_scale_min', 'rating_scale_max', 'rating_item_1', 'rating_item_2',
  'reflection_text', 'reflection_char_count', 'revision', 'created_at', 'updated_at', 'submitted_at',
] as const;

export interface TeacherReflectionFilterQuery {
  dataScope?: unknown;
  grade?: unknown;
  classNumber?: unknown;
  // Backward compatibility for an older cached teacher bundle's filter request only.
  classId?: unknown;
}

export interface TeacherReflectionStudentRow {
  learningId: string;
  classId: string;
  dataScope: ConcreteDataScope;
  grade: ConcreteGrade;
  classNumber: ConcreteClassNumber;
  attendanceNumber: number | '';
  status: 'submitted' | 'draft' | 'missing';
  reflectionCharCount: number;
  todayGoal: string;
  goalRating: number | null;
  communicationRating: number | null;
  reflectionText: string;
  updatedAt: string;
}

export interface TeacherReflectionDashboard {
  localDate: string;
  dataScope: ReflectionTeacherDataScope;
  grade: ReflectionTeacherGrade;
  classNumber: ReflectionTeacherClassNumber;
  // Retained for compatibility with a previously deployed teacher filter client.
  classId: string;
  classes: string[];
  counts: { total: number; submitted: number; draft: number; missing: number };
  students: TeacherReflectionStudentRow[];
}

export function reflectionDataScopeForClassId(value: unknown): ConcreteDataScope {
  const classId = typeof value === 'string' ? value.trim() : '';
  if (classId === '5-PB' || classId === '6-PB') return 'pilot_b';
  if (classId === 'テスト') return 'test';
  if (classId === '予備') return 'reserve';
  return 'main';
}

export function reflectionGradeForClassId(value: unknown): ConcreteGrade {
  const classId = typeof value === 'string' ? value.trim() : '';
  if (classId.startsWith('5-')) return '5';
  if (classId.startsWith('6-')) return '6';
  return '';
}

export function reflectionClassNumberForClassId(value: unknown): ConcreteClassNumber {
  const classId = typeof value === 'string' ? value.trim() : '';
  const match = classId.match(/^[56]-([123])$/);
  return match ? match[1] as ConcreteClassNumber : '';
}

function safeDate(value: unknown, fallback: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
}

function safeClass(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 40) : '';
}

function normalizeFilters(value: TeacherReflectionFilterQuery | string | undefined) {
  const query: TeacherReflectionFilterQuery = typeof value === 'string' ? { classId: value } : (value || {});
  const legacyClassId = safeClass(query.classId);
  const rawScope = typeof query.dataScope === 'string' ? query.dataScope.trim() : '';
  const rawGrade = typeof query.grade === 'string' ? query.grade.trim() : '';
  const rawClassNumber = typeof query.classNumber === 'string' ? query.classNumber.trim() : '';
  const dataScope: ReflectionTeacherDataScope = ['all','main','pilot_b','test','reserve'].includes(rawScope)
    ? rawScope as ReflectionTeacherDataScope
    : legacyClassId ? 'all' : 'main';
  const grade: ReflectionTeacherGrade = ['5','6'].includes(rawGrade) ? rawGrade as ReflectionTeacherGrade : 'all';
  const classNumber: ReflectionTeacherClassNumber = ['1','2','3'].includes(rawClassNumber) ? rawClassNumber as ReflectionTeacherClassNumber : 'all';
  return { dataScope, grade, classNumber, legacyClassId };
}

function membershipMatches(classId: string, filters: ReturnType<typeof normalizeFilters>): boolean {
  if (filters.legacyClassId) return classId === filters.legacyClassId;
  if (filters.dataScope !== 'all' && reflectionDataScopeForClassId(classId) !== filters.dataScope) return false;
  if (filters.grade !== 'all' && reflectionGradeForClassId(classId) !== filters.grade) return false;
  if (filters.classNumber !== 'all' && reflectionClassNumberForClassId(classId) !== filters.classNumber) return false;
  return true;
}

function activeRosterForFilters(roster: TeacherRosterStudent[], filters: ReturnType<typeof normalizeFilters>): TeacherRosterStudent[] {
  return roster
    .filter((student) => student.active && student.learningId && student.classId)
    .filter((student) => membershipMatches(student.classId, filters));
}

function latestRecordMap(records: ReflectionRecord[], allowedStudentIds: Set<string>, localDate: string): Map<string, ReflectionRecord> {
  const map = new Map<string, ReflectionRecord>();
  for (const record of records) {
    if (record.localDate !== localDate || !allowedStudentIds.has(record.studentId)) continue;
    const current = map.get(record.studentId);
    if (!current || record.updatedAt > current.updatedAt) map.set(record.studentId, record);
  }
  return map;
}

export function buildTeacherReflectionDashboard(
  roster: TeacherRosterStudent[],
  records: ReflectionRecord[],
  requestedDate: unknown,
  requestedFilters: TeacherReflectionFilterQuery | string | undefined,
  today: string,
): TeacherReflectionDashboard {
  const localDate = safeDate(requestedDate, today);
  const filters = normalizeFilters(requestedFilters);
  const activeRoster = roster.filter((student) => student.active && student.learningId && student.classId);
  const classes = Array.from(new Set(activeRoster.map((student) => student.classId))).sort((a, b) => a.localeCompare(b, 'ja'));
  const selectedRoster = activeRosterForFilters(roster, filters);
  const recordsByStudent = latestRecordMap(records, new Set(selectedRoster.map((student) => student.studentId)), localDate);
  const students: TeacherReflectionStudentRow[] = selectedRoster.map((student): TeacherReflectionStudentRow => {
    const record = recordsByStudent.get(student.studentId);
    const status: TeacherReflectionStudentRow['status'] = record?.status === 'submitted' ? 'submitted' : record ? 'draft' : 'missing';
    return {
      learningId: student.learningId,
      classId: student.classId,
      dataScope: reflectionDataScopeForClassId(student.classId),
      grade: reflectionGradeForClassId(student.classId),
      classNumber: reflectionClassNumberForClassId(student.classId),
      attendanceNumber: student.attendanceNumber,
      status,
      reflectionCharCount: record?.reflectionCharCount || 0,
      todayGoal: record?.todayGoal || '',
      goalRating: record?.goalRating ?? null,
      communicationRating: record?.communicationRating ?? null,
      reflectionText: record?.reflectionText || '',
      updatedAt: record?.updatedAt || '',
    };
  }).sort((a, b) => a.classId.localeCompare(b.classId, 'ja') || Number(a.attendanceNumber || 999) - Number(b.attendanceNumber || 999) || a.learningId.localeCompare(b.learningId));
  return {
    localDate,
    dataScope: filters.dataScope,
    grade: filters.grade,
    classNumber: filters.classNumber,
    classId: filters.legacyClassId,
    classes,
    counts: {
      total: students.length,
      submitted: students.filter((row) => row.status === 'submitted').length,
      draft: students.filter((row) => row.status === 'draft').length,
      missing: students.filter((row) => row.status === 'missing').length,
    },
    students,
  };
}

function csvCell(value: unknown): string {
  let text = String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (/^\s*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

const TEACHER_CSV_HEADERS = [
  'local_date', 'class_id', 'data_scope', 'grade_level', 'class_number', 'learning_id', 'attendance_number', 'status', 'today_goal',
  'goal_rating', 'communication_rating', 'rating_scale_min', 'rating_scale_max', 'rating_item_1', 'rating_item_2', 'reflection_text', 'reflection_char_count',
  'revision', 'created_at', 'updated_at', 'submitted_at',
] as const;

function teacherCsvValues(student: TeacherRosterStudent, localDate: string, record: ReflectionRecord | undefined): unknown[] {
  const status = record?.status === 'submitted' ? 'submitted' : record ? 'draft' : 'missing';
  return [
    localDate,
    student.classId,
    reflectionDataScopeForClassId(student.classId),
    reflectionGradeForClassId(student.classId),
    reflectionClassNumberForClassId(student.classId),
    student.learningId,
    student.attendanceNumber || '',
    status,
    record?.todayGoal || '',
    record?.goalRating ?? '',
    record?.communicationRating ?? '',
    REFLECTION_RATING_SCALE_MIN,
    REFLECTION_RATING_SCALE_MAX,
    REFLECTION_RATING_ITEM_1,
    REFLECTION_RATING_ITEM_2,
    record?.reflectionText || '',
    record ? record.reflectionCharCount : '',
    record?.revision ?? '',
    record?.createdAt || '',
    record?.updatedAt || '',
    record?.submittedAt || '',
  ];
}

export function serializeTeacherReflectionCsv(
  roster: TeacherRosterStudent[],
  records: ReflectionRecord[],
  requestedDate: unknown,
  requestedFilters: TeacherReflectionFilterQuery | string | undefined,
): string {
  const filters = normalizeFilters(requestedFilters);
  const dateText = typeof requestedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : '';
  const selectedRoster = activeRosterForFilters(roster, filters);
  const selectedByStudent = new Map(selectedRoster.map((student) => [student.studentId, student]));
  const lines = [TEACHER_CSV_HEADERS.map(csvCell).join(',')];

  if (dateText) {
    const recordsByStudent = latestRecordMap(records, new Set(selectedByStudent.keys()), dateText);
    const ordered = selectedRoster.slice().sort((a, b) => a.classId.localeCompare(b.classId, 'ja') || Number(a.attendanceNumber || 999) - Number(b.attendanceNumber || 999) || a.learningId.localeCompare(b.learningId));
    for (const student of ordered) lines.push(teacherCsvValues(student, dateText, recordsByStudent.get(student.studentId)).map(csvCell).join(','));
  } else {
    const activeRecords = records
      .filter((record) => selectedByStudent.has(record.studentId))
      .sort((a, b) => a.localDate.localeCompare(b.localDate) || (selectedByStudent.get(a.studentId)?.classId || '').localeCompare(selectedByStudent.get(b.studentId)?.classId || '', 'ja') || (selectedByStudent.get(a.studentId)?.learningId || '').localeCompare(selectedByStudent.get(b.studentId)?.learningId || ''));
    for (const record of activeRecords) {
      const student = selectedByStudent.get(record.studentId);
      if (student) lines.push(teacherCsvValues(student, record.localDate, record).map(csvCell).join(','));
    }
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function serializeResearchLessonReflectionCsv(
  records: ReflectionRecord[],
  requestedDate?: unknown,
): string {
  const dateText = typeof requestedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : '';
  const rows = records
    .filter((record) => !dateText || record.localDate === dateText)
    .sort((a, b) => a.localDate.localeCompare(b.localDate) || a.classId.localeCompare(b.classId, 'ja') || a.researchId.localeCompare(b.researchId));
  const lines = [RESEARCH_LESSON_REFLECTION_HEADERS.map(csvCell).join(',')];
  for (const record of rows) {
    lines.push([
      record.researchId,
      record.classId,
      reflectionDataScopeForClassId(record.classId),
      reflectionGradeForClassId(record.classId),
      reflectionClassNumberForClassId(record.classId),
      record.localDate,
      record.status,
      record.todayGoal,
      record.goalRating ?? '',
      record.communicationRating ?? '',
      REFLECTION_RATING_SCALE_MIN,
      REFLECTION_RATING_SCALE_MAX,
      REFLECTION_RATING_ITEM_1,
      REFLECTION_RATING_ITEM_2,
      record.reflectionText,
      record.reflectionCharCount,
      record.revision,
      record.createdAt,
      record.updatedAt,
      record.submittedAt,
    ].map(csvCell).join(','));
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function buildTeacherStudentHistory(
  roster: TeacherRosterStudent[],
  records: ReflectionRecord[],
  learningId: string,
): { learningId: string; classId: string; dataScope: ConcreteDataScope; grade: ConcreteGrade; classNumber: ConcreteClassNumber; attendanceNumber: number | ''; history: Array<Omit<ReflectionRecord, 'studentId' | 'researchId' | 'classId' | 'learningId'>> } | null {
  const normalized = learningId.trim().toUpperCase();
  const student = roster.find((row) => row.active && row.learningId === normalized);
  if (!student) return null;
  const history = records
    .filter((record) => record.studentId === student.studentId)
    .sort((a, b) => b.localDate.localeCompare(a.localDate))
    .map(({ studentId: _studentId, researchId: _researchId, classId: _classId, learningId: _learningId, ...safe }) => safe);
  return {
    learningId: student.learningId,
    classId: student.classId,
    dataScope: reflectionDataScopeForClassId(student.classId),
    grade: reflectionGradeForClassId(student.classId),
    classNumber: reflectionClassNumberForClassId(student.classId),
    attendanceNumber: student.attendanceNumber,
    history,
  };
}
