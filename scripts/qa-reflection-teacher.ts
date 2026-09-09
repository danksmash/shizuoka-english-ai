import { buildTeacherReflectionDashboard, buildTeacherStudentHistory, serializeTeacherReflectionCsv, type TeacherRosterStudent } from '../src/server/reflectionTeacherModel';
import type { ReflectionRecord } from '../src/server/reflectionPersistence';

const fail = (message: string): never => { throw new Error(`[qa:reflection-teacher] ${message}`); };
const assert = (condition: unknown, message: string) => { if (!condition) fail(message); };

const roster: TeacherRosterStudent[] = [
  { studentId: 'synthetic-student-1', learningId: 'T5A2', classId: '5-1', attendanceNumber: 1, active: true },
  { studentId: 'synthetic-student-2', learningId: 'T5B3', classId: '5-1', attendanceNumber: 2, active: true },
  { studentId: 'synthetic-student-3', learningId: 'T5C4', classId: '5-1', attendanceNumber: 3, active: true },
  { studentId: 'synthetic-student-4', learningId: 'T6D5', classId: '6-1', attendanceNumber: 1, active: true },
];

const base = {
  researchId: 'R-SYNTHETIC-ONLY',
  localDate: '2026-09-09',
  todayGoal: '相手の話をよく聞きながら、自分から話す。',
  goalRating: 4,
  selfRegulationRating: 3,
  reflectionText: '今日は相手の話を聞きながら、次に何を言うか考えることができた。友達の話し方も参考になった。',
  reflectionCharCount: 48,
  revision: 2,
  createdAt: '2026-09-09T01:00:00.000Z',
  updatedAt: '2026-09-09T01:10:00.000Z',
  submittedAt: '2026-09-09T01:10:00.000Z',
  achievements: '',
  languageUsed: '',
  thinking: '',
  difficultyStrategy: '',
  languageCultureAwareness: '',
  nextGoal: '',
} satisfies Omit<ReflectionRecord, 'reflectionId' | 'studentId' | 'classId' | 'learningId' | 'status'>;

const legacySix = {
  ...base,
  localDate: '2026-09-02',
  goalRating: null,
  selfRegulationRating: null,
  reflectionText: '',
  reflectionCharCount: 60,
  achievements: '相手に質問できた。',
  languageUsed: 'Really?',
  thinking: '次に何を聞くか考えた。',
  difficultyStrategy: '聞き返した。',
  languageCultureAwareness: '食文化の違いに気づいた。',
  nextGoal: '理由まで聞きたい。',
};

const records: ReflectionRecord[] = [
  { ...base, reflectionId: 'synthetic-reflection-1', studentId: 'synthetic-student-1', classId: '5-1', learningId: 'T5A2', status: 'submitted' },
  { ...base, reflectionId: 'synthetic-reflection-2', studentId: 'synthetic-student-2', classId: '5-1', learningId: 'T5B3', status: 'draft', submittedAt: '', reflectionText: '=HYPERLINK("https://example.invalid","x")' },
  { ...base, reflectionId: 'synthetic-reflection-4', studentId: 'synthetic-student-4', classId: '6-1', learningId: 'T6D5', status: 'submitted', reflectionText: '英語で好きなものを伝えて質問した。' },
  { ...legacySix, reflectionId: 'synthetic-legacy', studentId: 'synthetic-student-1', classId: '5-1', learningId: 'T5A2', status: 'submitted' },
];

const dashboard = buildTeacherReflectionDashboard(roster, records, '2026-09-09', '5-1', '2026-09-09');
assert(dashboard.counts.total === 3, '5-1 roster total should be 3');
assert(dashboard.counts.submitted === 1, 'submitted count should be 1');
assert(dashboard.counts.draft === 1, 'draft count should be 1');
assert(dashboard.counts.missing === 1, 'missing count should be 1');
assert(dashboard.students[0]?.learningId === 'T5A2', 'attendance order should be preserved');
assert(dashboard.students[0]?.goalRating === 4, 'goal rating should be available to teacher dashboard');
assert(dashboard.students[0]?.selfRegulationRating === 3, 'self-regulation rating should be available to teacher dashboard');
assert(dashboard.students[0]?.reflectionText.includes('友達の話し方'), 'canonical free reflection should be available to teacher dashboard');
assert(dashboard.students.find((row) => row.learningId === 'T5C4')?.status === 'missing', 'missing pupil must remain visible');

const history = buildTeacherStudentHistory(roster, records, 't5a2');
assert(history?.history.length === 2, 'student history should contain both canonical and six-part legacy records');
const serializedHistory = JSON.stringify(history);
assert(!serializedHistory.includes('R-SYNTHETIC-ONLY'), 'teacher history must not expose researchId');
assert(!serializedHistory.includes('synthetic-student-1'), 'teacher history must not expose internal studentId');

const csv = serializeTeacherReflectionCsv(roster, records, '2026-09-09', '5-1');
assert(csv.startsWith('\uFEFF'), 'CSV should include UTF-8 BOM for Japanese spreadsheet compatibility');
for (const header of ['goal_rating','self_regulation_rating','reflection_text']) assert(csv.includes(`"${header}"`), `CSV missing ${header}`);
for (const header of ['achievements','language_used','thinking','difficulty_strategy','language_culture_awareness','next_goal']) assert(csv.includes(`"${header}"`), `CSV missing compatibility ${header}`);
assert(csv.includes('"T5A2"'), 'CSV should use operational learning ID');
assert(csv.includes("\"'=HYPERLINK("), 'CSV formula-like text must be apostrophe-prefixed');
assert(!csv.includes('research_id'), 'CSV must not expose research_id column');
assert(!csv.includes('student_id'), 'CSV must not expose internal student_id column');
assert(!csv.includes('T5C4'), 'CSV should not fabricate a row for a missing reflection');

const legacyCsv = serializeTeacherReflectionCsv(roster, records, '2026-09-02', '5-1');
assert(legacyCsv.includes('【できたこと】'), 'legacy six-part data should remain readable in canonical reflection_text export');
assert(legacyCsv.includes('理由まで聞きたい。'), 'legacy next-goal content must not be lost');

console.log('[qa:reflection-teacher] PASS: canonical B-schema, ratings, missing-state, redaction, legacy compatibility, and CSV formula safety verified.');
