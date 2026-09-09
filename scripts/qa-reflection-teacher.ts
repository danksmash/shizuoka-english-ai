import { buildTeacherReflectionDashboard, buildTeacherStudentHistory, serializeTeacherReflectionCsv, type TeacherRosterStudent } from '../src/server/reflectionTeacherModel';
import type { ReflectionRecord } from '../src/server/reflectionPersistence';

const fail = (message: string): never => { throw new Error(`[qa:reflection-teacher] ${message}`); };
const check = (condition: unknown, message: string) => { if (!condition) fail(message); };

const roster: TeacherRosterStudent[] = [
  { studentId: 'synthetic-student-1', learningId: 'T5A2', classId: '5-1', attendanceNumber: 1, active: true },
  { studentId: 'synthetic-student-2', learningId: 'T5B3', classId: '5-1', attendanceNumber: 2, active: true },
  { studentId: 'synthetic-student-3', learningId: 'T5C4', classId: '5-1', attendanceNumber: 3, active: true },
  { studentId: 'synthetic-student-4', learningId: 'T6D5', classId: '6-1', attendanceNumber: 1, active: true },
];

const base = {
  researchId: 'R-SYNTHETIC-ONLY', localDate: '2026-09-09', todayGoal: '相手の答えを聞いて質問を続ける',
  achievements: '相手の答えを聞いて、もう一つ質問できた。', languageUsed: 'Really? / How about you?',
  thinking: '相手の答えから次の質問を考えた。', difficultyStrategy: '聞き取れないときにもう一度言ってもらった。',
  languageCultureAwareness: '食べ方の違いに気づいた。', nextGoal: '次は理由まで聞きたい。', reflectionCharCount: 96,
  revision: 2, createdAt: '2026-09-09T01:00:00.000Z', updatedAt: '2026-09-09T01:10:00.000Z', submittedAt: '2026-09-09T01:10:00.000Z',
  reflectionText: '', goalRating: null, selfRegulationRating: null,
} satisfies Omit<ReflectionRecord, 'reflectionId' | 'studentId' | 'classId' | 'learningId' | 'status'>;

const records: ReflectionRecord[] = [
  { ...base, reflectionId: 'r1', studentId: 'synthetic-student-1', classId: '5-1', learningId: 'T5A2', status: 'submitted' },
  { ...base, reflectionId: 'r2', studentId: 'synthetic-student-2', classId: '5-1', learningId: 'T5B3', status: 'draft', submittedAt: '', achievements: '=HYPERLINK("https://example.invalid","x")' },
  { ...base, reflectionId: 'r4', studentId: 'synthetic-student-4', classId: '6-1', learningId: 'T6D5', status: 'submitted' },
  { ...base, reflectionId: 'legacy-b', studentId: 'synthetic-student-1', classId: '5-1', learningId: 'T5A2', localDate: '2026-09-02', status: 'submitted', achievements: '', languageUsed: '', thinking: '', difficultyStrategy: '', languageCultureAwareness: '', nextGoal: '', reflectionText: 'B設計期間の旧形式振り返り', goalRating: 4, selfRegulationRating: 3, reflectionCharCount: 14 },
];

const dashboard = buildTeacherReflectionDashboard(roster, records, '2026-09-09', '5-1', '2026-09-09');
check(dashboard.counts.total === 3, 'total count'); check(dashboard.counts.submitted === 1, 'submitted count'); check(dashboard.counts.draft === 1, 'draft count'); check(dashboard.counts.missing === 1, 'missing count');
check(dashboard.students[0]?.achievements.includes('もう一つ質問'), 'six-part dashboard'); check(dashboard.students[0]?.nextGoal === '次は理由まで聞きたい。', 'next goal dashboard');

const history = buildTeacherStudentHistory(roster, records, 't5a2');
check(history?.history.length === 2, 'history length');
const historyJson = JSON.stringify(history);
check(!historyJson.includes('R-SYNTHETIC-ONLY'), 'researchId redaction'); check(!historyJson.includes('synthetic-student-1'), 'studentId redaction');

const csv = serializeTeacherReflectionCsv(roster, records, '2026-09-09', '5-1');
check(csv.startsWith('\uFEFF'), 'CSV BOM');
for (const header of ['achievements','language_used','thinking','difficulty_strategy','language_culture_awareness','next_goal']) check(csv.includes(`"${header}"`), `CSV missing ${header}`);
check(csv.includes('"T5A2"'), 'operational learning ID'); check(csv.includes("'=HYPERLINK"), 'formula injection guard');
check(!csv.includes('research_id'), 'research_id must not be exported'); check(!csv.includes('student_id'), 'student_id must not be exported'); check(!csv.includes('T5C4'), 'missing pupil must not be fabricated in CSV');

const legacyCsv = serializeTeacherReflectionCsv(roster, records, '2026-09-02', '5-1');
check(legacyCsv.includes('B設計期間の旧形式振り返り'), 'legacy B reflection preserved');
console.log('[qa:reflection-teacher] PASS: six-part canonical teacher data, redaction, legacy B preservation and CSV safety verified.');
