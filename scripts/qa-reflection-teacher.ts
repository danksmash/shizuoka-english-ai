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
  todayGoal: '相手の答えを聞いて質問を続ける',
  achievements: '相手の答えを聞いて、もう一つ質問できた。',
  languageUsed: 'Really? / How about you?',
  thinking: '相手の答えから次の質問を考えた。',
  difficultyStrategy: '聞き取れないときにもう一度言ってもらった。',
  languageCultureAwareness: '同じ食べ物でも国によって食べ方が違うことに気づいた。',
  nextGoal: '次は理由まで聞きたい。',
  reflectionCharCount: 96,
  revision: 2,
  createdAt: '2026-09-09T01:00:00.000Z',
  updatedAt: '2026-09-09T01:10:00.000Z',
  submittedAt: '2026-09-09T01:10:00.000Z',
  reflectionText: '',
  goalRating: null,
  selfRegulationRating: null,
} satisfies Omit<ReflectionRecord, 'reflectionId' | 'studentId' | 'classId' | 'learningId' | 'status'>;

const records: ReflectionRecord[] = [
  { ...base, reflectionId: 'synthetic-reflection-1', studentId: 'synthetic-student-1', classId: '5-1', learningId: 'T5A2', status: 'submitted' },
  { ...base, reflectionId: 'synthetic-reflection-2', studentId: 'synthetic-student-2', classId: '5-1', learningId: 'T5B3', status: 'draft', submittedAt: '' },
  { ...base, reflectionId: 'synthetic-reflection-4', studentId: 'synthetic-student-4', classId: '6-1', learningId: 'T6D5', status: 'submitted', achievements: '英語で「好きなもの」を伝えた, そして質問した。' },
  { ...base, reflectionId: 'synthetic-legacy', studentId: 'synthetic-student-1', classId: '5-1', learningId: 'T5A2', localDate: '2026-09-02', status: 'submitted', achievements: '', languageUsed: '', thinking: '', difficultyStrategy: '', languageCultureAwareness: '', nextGoal: '', reflectionCharCount: 34, reflectionText: '旧形式で書いた振り返り。データを消さない。' },
];

const dashboard = buildTeacherReflectionDashboard(roster, records, '2026-09-09', '5-1', '2026-09-09');
assert(dashboard.counts.total === 3, '5-1 roster total should be 3');
assert(dashboard.counts.submitted === 1, 'submitted count should be 1');
assert(dashboard.counts.draft === 1, 'draft count should be 1');
assert(dashboard.counts.missing === 1, 'missing count should be 1');
assert(dashboard.students[0]?.learningId === 'T5A2', 'attendance order should be preserved');
assert(dashboard.students.find((row) => row.learningId === 'T5C4')?.status === 'missing', 'missing pupil must remain visible');

const history = buildTeacherStudentHistory(roster, records, 't5a2');
assert(history?.history.length === 2, 'student history should contain both current and legacy records');
const serializedHistory = JSON.stringify(history);
assert(!serializedHistory.includes('R-SYNTHETIC-ONLY'), 'teacher history must not expose researchId');
assert(!serializedHistory.includes('synthetic-student-1'), 'teacher history must not expose internal studentId');

const csv = serializeTeacherReflectionCsv(roster, records, '2026-09-09', '5-1');
assert(csv.startsWith('\uFEFF'), 'CSV should include UTF-8 BOM for Japanese spreadsheet compatibility');
for (const header of ['achievements','language_used','thinking','difficulty_strategy','language_culture_awareness','next_goal']) assert(csv.includes(`"${header}"`), `CSV missing ${header}`);
assert(csv.includes('"T5A2"'), 'CSV should use operational learning ID');
assert(!csv.includes('research_id'), 'CSV must not expose research_id column');
assert(!csv.includes('student_id'), 'CSV must not expose internal student_id column');
assert(!csv.includes('T5C4'), 'CSV should not fabricate a row for a missing reflection');

console.log('[qa:reflection-teacher] PASS: synthetic roster, missing-state, history redaction, six-part CSV, and legacy compatibility verified.');
