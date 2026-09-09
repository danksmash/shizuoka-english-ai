import { buildTeacherReflectionDashboard, buildTeacherStudentHistory, reflectionDataScopeForClassId, reflectionGradeForClassId, reflectionClassNumberForClassId, serializeTeacherReflectionCsv, type TeacherRosterStudent } from '../src/server/reflectionTeacherModel';
import { researchDataScopeForRow } from '../src/server/researchDashboard';
import type { ReflectionRecord } from '../src/server/reflectionPersistence';

const fail = (message: string): never => { throw new Error(`[qa:reflection-teacher] ${message}`); };
const assert = (condition: unknown, message: string) => { if (!condition) fail(message); };

const roster: TeacherRosterStudent[] = [
  { studentId: 's1', learningId: 'T5A2', classId: '5-1', attendanceNumber: 1, active: true },
  { studentId: 's2', learningId: 'T5B3', classId: '5-1', attendanceNumber: 2, active: true },
  { studentId: 's3', learningId: 'T5C4', classId: '5-1', attendanceNumber: 3, active: true },
  { studentId: 's4', learningId: 'T6D5', classId: '6-1', attendanceNumber: 1, active: true },
  { studentId: 'pb1', learningId: 'P6A2', classId: '6-PB', attendanceNumber: 1, active: true },
  { studentId: 'pb2', learningId: 'P6B3', classId: '6-PB', attendanceNumber: 2, active: true },
  { studentId: 'test1', learningId: '6RSX', classId: 'テスト', attendanceNumber: '', active: true },
  { studentId: 'reserve1', learningId: 'R5A2', classId: '予備', attendanceNumber: '', active: true },
];

const base = {
  researchId: 'R-SYNTHETIC-ONLY', localDate: '2026-09-09', todayGoal: '相手の話をよく聞きながら、自分から話す。', goalRating: 4,
  selfRegulationRating: 3, reflectionText: '今日は相手の話を聞きながら、次に何を言うか考えることができた。友達の話し方も参考になった。',
  reflectionCharCount: 48, revision: 2, createdAt: '2026-09-09T01:00:00.000Z', updatedAt: '2026-09-09T01:10:00.000Z', submittedAt: '2026-09-09T01:10:00.000Z',
  achievements: '', languageUsed: '', thinking: '', difficultyStrategy: '', languageCultureAwareness: '', nextGoal: '',
} satisfies Omit<ReflectionRecord, 'reflectionId' | 'studentId' | 'classId' | 'learningId' | 'status'>;

const legacySix = { ...base, localDate: '2026-09-02', goalRating: null, selfRegulationRating: null, reflectionText: '', reflectionCharCount: 60, achievements: '相手に質問できた。', languageUsed: 'Really?', thinking: '次に何を聞くか考えた。', difficultyStrategy: '聞き返した。', languageCultureAwareness: '食文化の違いに気づいた。', nextGoal: '理由まで聞きたい。' };
const records: ReflectionRecord[] = [
  { ...base, reflectionId: 'r1', studentId: 's1', classId: '5-1', learningId: 'T5A2', status: 'submitted' },
  { ...base, reflectionId: 'r2', studentId: 's2', classId: '5-1', learningId: 'T5B3', status: 'draft', submittedAt: '', reflectionText: '=HYPERLINK("https://example.invalid","x")' },
  { ...base, reflectionId: 'r4', studentId: 's4', classId: '6-1', learningId: 'T6D5', status: 'submitted', reflectionText: '英語で好きなものを伝えて質問した。' },
  { ...base, reflectionId: 'pb-r1', studentId: 'pb1', classId: '6-PB', learningId: 'P6A2', status: 'submitted', reflectionText: 'Pilot Bの振り返り。' },
  { ...base, reflectionId: 'test-r1', studentId: 'test1', classId: 'テスト', learningId: '6RSX', status: 'submitted', reflectionText: '教師テスト。' },
  { ...legacySix, reflectionId: 'legacy', studentId: 's1', classId: '5-1', learningId: 'T5A2', status: 'submitted' },
];

for (const [classId, scope] of [['5-1','main'],['6-PB','pilot_b'],['テスト','test'],['予備','reserve']] as const) {
  assert(reflectionDataScopeForClassId(classId) === scope, `Reflection scope mismatch for ${classId}`);
  assert(researchDataScopeForRow({ class_id: classId, local_date: '2026-09-09' }) === scope, `Research dashboard scope mismatch for ${classId}`);
}
assert(reflectionGradeForClassId('6-PB') === '6', 'Pilot B grade should be derived as 6');
assert(reflectionClassNumberForClassId('6-PB') === '', 'Pilot B must not masquerade as class 1/2/3');
assert(reflectionClassNumberForClassId('5-2') === '2', 'ordinary room number should be derived');

const main5 = buildTeacherReflectionDashboard(roster, records, '2026-09-09', { dataScope:'main', grade:'5', classNumber:'1' }, '2026-09-09');
assert(main5.counts.total === 3, 'main / grade 5 / class 1 total should be 3');
assert(main5.counts.submitted === 1 && main5.counts.draft === 1 && main5.counts.missing === 1, 'main status counts should remain correct');
assert(main5.students[0]?.dataScope === 'main' && main5.students[0]?.grade === '5' && main5.students[0]?.classNumber === '1', 'derived membership should be returned');

const pilot = buildTeacherReflectionDashboard(roster, records, '2026-09-09', { dataScope:'pilot_b', grade:'6', classNumber:'all' }, '2026-09-09');
assert(pilot.counts.total === 2, 'Pilot B grade-6 roster should be isolated');
assert(pilot.students.every((row) => row.classId === '6-PB' && row.dataScope === 'pilot_b'), 'Pilot B rows must be isolated');

const test = buildTeacherReflectionDashboard(roster, records, '2026-09-09', { dataScope:'test', grade:'all', classNumber:'all' }, '2026-09-09');
assert(test.counts.total === 1 && test.students[0]?.learningId === '6RSX', 'test scope should isolate 6RSX');

const all = buildTeacherReflectionDashboard(roster, records, '2026-09-09', { dataScope:'all', grade:'all', classNumber:'all' }, '2026-09-09');
assert(all.counts.total === 8, 'all scope should include all assigned active roster students');

const legacyExact = buildTeacherReflectionDashboard(roster, records, '2026-09-09', '5-1', '2026-09-09');
assert(legacyExact.counts.total === 3, 'legacy cached classId filter should remain compatible');

const history = buildTeacherStudentHistory(roster, records, 't5a2');
assert(history?.history.length === 2, 'student history should contain canonical and six-part legacy records');
assert(history?.dataScope === 'main' && history.grade === '5' && history.classNumber === '1', 'history should expose derived membership only');
const serializedHistory = JSON.stringify(history);
assert(!serializedHistory.includes('R-SYNTHETIC-ONLY'), 'teacher history must not expose researchId');
assert(!serializedHistory.includes('"studentId"'), 'teacher history must not expose internal studentId');

const csv = serializeTeacherReflectionCsv(roster, records, '2026-09-09', { dataScope:'main', grade:'5', classNumber:'1' });
assert(csv.startsWith('\uFEFF'), 'CSV should include UTF-8 BOM');
for (const header of ['data_scope','grade_level','class_number','goal_rating','self_regulation_rating','reflection_text']) assert(csv.includes(`"${header}"`), `CSV missing ${header}`);
assert(csv.includes('"T5A2"') && !csv.includes('"P6A2"') && !csv.includes('"6RSX"'), 'main CSV must match dashboard filters');
assert(csv.includes("\"'=HYPERLINK("), 'CSV formula-like text must be apostrophe-prefixed');
assert(!csv.includes('research_id') && !csv.includes('student_id'), 'teacher CSV must not expose internal IDs');

const pilotCsv = serializeTeacherReflectionCsv(roster, records, '2026-09-09', { dataScope:'pilot_b', grade:'6', classNumber:'all' });
assert(pilotCsv.includes('"P6A2"') && !pilotCsv.includes('"T5A2"') && !pilotCsv.includes('"6RSX"'), 'Pilot B CSV must match Pilot B filter');
const testCsv = serializeTeacherReflectionCsv(roster, records, '2026-09-09', { dataScope:'test', grade:'all', classNumber:'all' });
assert(testCsv.includes('"6RSX"') && !testCsv.includes('"P6A2"'), 'test CSV must isolate test data');

const legacyCsv = serializeTeacherReflectionCsv(roster, records, '2026-09-02', '5-1');
assert(legacyCsv.includes('【できたこと】') && legacyCsv.includes('理由まで聞きたい。'), 'legacy six-part data must remain readable');

console.log('[qa:reflection-teacher] PASS: data-scope/grade/class filters align with research dashboard, CSV follows filters, 6RSX test isolation, privacy, and legacy compatibility verified.');
