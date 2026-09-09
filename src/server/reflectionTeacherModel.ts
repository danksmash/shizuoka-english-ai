import type { ReflectionRecord } from './reflectionPersistence';

export interface TeacherRosterStudent {
  studentId: string;
  learningId: string;
  classId: string;
  attendanceNumber: number | '';
  active: boolean;
}

export interface TeacherReflectionStudentRow {
  learningId: string;
  classId: string;
  attendanceNumber: number | '';
  status: 'submitted' | 'draft' | 'missing';
  reflectionCharCount: number;
  todayGoal: string;
  achievements: string;
  nextGoal: string;
  updatedAt: string;
}

export interface TeacherReflectionDashboard {
  localDate: string;
  classId: string;
  classes: string[];
  counts: { total: number; submitted: number; draft: number; missing: number };
  students: TeacherReflectionStudentRow[];
}

function safeDate(value: unknown, fallback: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
}

function safeClass(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 40) : '';
}

export function buildTeacherReflectionDashboard(
  roster: TeacherRosterStudent[],
  records: ReflectionRecord[],
  requestedDate: unknown,
  requestedClass: unknown,
  today: string,
): TeacherReflectionDashboard {
  const localDate = safeDate(requestedDate, today);
  const classId = safeClass(requestedClass);
  const activeRoster = roster.filter((student) => student.active && student.learningId && student.classId);
  const classes = Array.from(new Set(activeRoster.map((student) => student.classId))).sort((a, b) => a.localeCompare(b, 'ja'));
  const selectedRoster = activeRoster.filter((student) => !classId || student.classId === classId);
  const recordsByStudent = new Map<string, ReflectionRecord>();
  for (const record of records) {
    if (record.localDate !== localDate) continue;
    if (classId && record.classId !== classId) continue;
    const current = recordsByStudent.get(record.studentId);
    if (!current || record.updatedAt > current.updatedAt) recordsByStudent.set(record.studentId, record);
  }
  const students: TeacherReflectionStudentRow[] = selectedRoster.map((student): TeacherReflectionStudentRow => {
    const record = recordsByStudent.get(student.studentId);
    const status: TeacherReflectionStudentRow['status'] = record?.status === 'submitted' ? 'submitted' : record ? 'draft' : 'missing';
    return {
      learningId: student.learningId,
      classId: student.classId,
      attendanceNumber: student.attendanceNumber,
      status,
      reflectionCharCount: record?.reflectionCharCount || 0,
      todayGoal: record?.todayGoal || '',
      achievements: record?.achievements || record?.reflectionText || '',
      nextGoal: record?.nextGoal || '',
      updatedAt: record?.updatedAt || '',
    };
  }).sort((a, b) => a.classId.localeCompare(b.classId, 'ja') || Number(a.attendanceNumber || 999) - Number(b.attendanceNumber || 999) || a.learningId.localeCompare(b.learningId));
  return {
    localDate,
    classId,
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
  const text = String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return `"${text.replace(/"/g, '""')}"`;
}

export function serializeTeacherReflectionCsv(
  roster: TeacherRosterStudent[],
  records: ReflectionRecord[],
  requestedDate: unknown,
  requestedClass: unknown,
): string {
  const classId = safeClass(requestedClass);
  const dateText = typeof requestedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : '';
  const rosterByStudent = new Map(roster.map((student) => [student.studentId, student]));
  const rows = records
    .filter((record) => (!classId || record.classId === classId) && (!dateText || record.localDate === dateText))
    .sort((a, b) => a.localDate.localeCompare(b.localDate) || a.classId.localeCompare(b.classId, 'ja') || (rosterByStudent.get(a.studentId)?.learningId || '').localeCompare(rosterByStudent.get(b.studentId)?.learningId || ''));
  const headers = [
    'local_date', 'class_id', 'learning_id', 'attendance_number', 'status', 'today_goal',
    'achievements', 'language_used', 'thinking', 'difficulty_strategy', 'language_culture_awareness', 'next_goal',
    'reflection_char_count', 'revision', 'created_at', 'updated_at', 'submitted_at', 'legacy_reflection_text',
  ];
  const lines = [headers.map(csvCell).join(',')];
  for (const record of rows) {
    const rosterStudent = rosterByStudent.get(record.studentId);
    lines.push([
      record.localDate,
      record.classId,
      rosterStudent?.learningId || record.learningId,
      rosterStudent?.attendanceNumber || '',
      record.status,
      record.todayGoal,
      record.achievements,
      record.languageUsed,
      record.thinking,
      record.difficultyStrategy,
      record.languageCultureAwareness,
      record.nextGoal,
      record.reflectionCharCount,
      record.revision,
      record.createdAt,
      record.updatedAt,
      record.submittedAt,
      record.reflectionText,
    ].map(csvCell).join(','));
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function buildTeacherStudentHistory(
  roster: TeacherRosterStudent[],
  records: ReflectionRecord[],
  learningId: string,
): { learningId: string; classId: string; attendanceNumber: number | ''; history: Array<Omit<ReflectionRecord, 'studentId' | 'researchId' | 'classId' | 'learningId'>> } | null {
  const normalized = learningId.trim().toUpperCase();
  const student = roster.find((row) => row.active && row.learningId === normalized);
  if (!student) return null;
  const history = records
    .filter((record) => record.studentId === student.studentId)
    .sort((a, b) => b.localDate.localeCompare(a.localDate))
    .map(({ studentId: _studentId, researchId: _researchId, classId: _classId, learningId: _learningId, ...safe }) => safe);
  return { learningId: student.learningId, classId: student.classId, attendanceNumber: student.attendanceNumber, history };
}
