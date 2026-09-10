import { buildTeacherReflectionDashboard, buildTeacherStudentHistory, reflectionDataScopeForClassId, reflectionGradeForClassId, reflectionClassNumberForClassId, serializeResearchLessonReflectionCsv, serializeTeacherReflectionCsv, type TeacherRosterStudent } from '../src/server/reflectionTeacherModel';
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
  { studentId: 'inactive1', learningId: 'OLD1', classId: '5-1', attendanceNumber: 9, active: false },
];

const base = {
  researchId: 'R-SYNTHETIC-ONLY', localDate: '2026-09-09', todayGoal: '相手の話をよく聞きながら、自分から話す。', goalRating: 3,
  communicationRating: 4,
  reflectionText: '今日は相手の話を聞きながら、次に何を言うか考えることができた。友達の話し方も参考になった。',
  reflectionCharCount: 48, revision: 2, createdAt: '2026-09-09T01:00:00.000Z', updatedAt: '2026-09-09T01:10:00.000Z', submittedAt: '2026-09-09T01:10:00.000Z',
} satisfies Omit<ReflectionRecord, 'reflectionId' | 'studentId' | 'classId' | 'learningId' | 'status'>;

const records: ReflectionRecord[] = [
  { ...base, researchId: 'R-MAIN-0001', reflectionId: 'r1', studentId: 's1', classId: '5-1', learningId: 'T5A2', status: 'submitted' },
  { ...base, researchId: 'R-MAIN-0002', reflectionId: 'r2', studentId: 's2', classId: '5-1', learningId: 'T5B3', status: 'draft', submittedAt: '', reflectionText: '=HYPERLINK("https://example.invalid","x")' },
  { ...base, researchId: 'R-MAIN-0004', reflectionId: 'r4', studentId: 's4', classId: '6-1', learningId: 'T6D5', status: 'submitted', reflectionText: '英語で好きなものを伝えて質問した。' },
  { ...base, researchId: 'R-PILOT-0001', reflectionId: 'pb-r1', studentId: 'pb1', classId: '6-PB', learningId: 'P6A2', status: 'submitted', reflectionText: 'Pilot Bの振り返り。' },
  { ...base, researchId: 'R-TEST-6RSX', reflectionId: 'test-r1', studentId: 'test1', classId: 'テスト', learningId: '6RSX', status: 'submitted', reflectionText: '教師テスト。' },
  { ...base, researchId: 'R-INACTIVE-OLD', reflectionId: 'old-r1', studentId: 'inactive1', classId: '5-1', learningId: 'OLD1', status: 'submitted', reflectionText: '非アクティブ旧データ。' },
];

for (const [classId, scope] of [['5-1','main'],['6-PB','pilot_b'],['テスト','test'],['予備','reserve']] as const) {
  assert(reflectionDataScopeForClassId(classId) === scope, `Reflection scope mismatch for ${classId}`);
}
assert(researchDataScopeForRow({ class_id: '5-1', local_date: '2026-09-09' }) === 'test', 'Pre-study ordinary class must be research test scope');
assert(researchDataScopeForRow({ class_id: '5-1', local_date: '2026-09-17' }) === 'main', 'Ordinary class becomes research main on study start date');
assert(researchDataScopeForRow({ class_id: '6-PB', local_date: '2026-09-09' }) === 'pilot_b', 'Official Pilot B date must remain pilot scope');
assert(researchDataScopeForRow({ class_id: 'テスト', local_date: '2026-09-17' }) === 'test', 'Explicit test class must remain test scope');
assert(researchDataScopeForRow({ class_id: '予備', local_date: '2026-09-17' }) === 'reserve', 'Reserve class must remain reserve scope');
assert(reflectionGradeForClassId('6-PB') === '6', 'Pilot B grade should be derived as 6');
assert(reflectionClassNumberForClassId('6-PB') === '', 'Pilot B must not masquerade as class 1/2/3');
assert(reflectionClassNumberForClassId('5-2') === '2', 'ordinary room number should be derived');

const main5 = buildTeacherReflectionDashboard(roster, records, '2026-09-09', { dataScope:'main', grade:'5', classNumber:'1' }, '2026-09-09');
assert(main5.counts.total === 3, 'main / grade 5 / class 1 total should be 3 active roster students');
assert(main5.counts.submitted === 1 && main5.counts.draft === 1 && main5.counts.missing === 1, 'main status counts should remain correct');
assert(main5.students[0]?.dataScope === 'main' && main5.students[0]?.grade === '5' && main5.students[0]?.classNumber === '1', 'derived membership should be returned');
assert(main5.students[0]?.goalRating === 3 && main5.students[0]?.communicationRating === 4, 'teacher row should expose four-point ratings');
assert(!main5.students.some((row) => row.learningId === 'OLD1'), 'inactive roster student must be excluded from dashboard');

const pilot = buildTeacherReflectionDashboard(roster, records, '2026-09-09', { dataScope:'pilot_b', grade:'6', classNumber:'all' }, '2026-09-09');
assert(pilot.counts.total === 2, 'Pilot B grade-6 roster should be isolated');
assert(pilot.students.every((row) => row.classId === '6-PB' && row.dataScope === 'pilot_b'), 'Pilot B rows must be isolated');

const test = buildTeacherReflectionDashboard(roster, records, '2026-09-09', { dataScope:'test', grade:'all', classNumber:'all' }, '2026-09-09');
assert(test.counts.total === 1 && test.students[0]?.learningId === '6RSX', 'test scope should isolate 6RSX');

const all = buildTeacherReflectionDashboard(roster, records, '2026-09-09', { dataScope:'all', grade:'all', classNumber:'all' }, '2026-09-09');
assert(all.counts.total === 8, 'all scope should include exactly the eight assigned active roster students');

const legacyExact = buildTeacherReflectionDashboard(roster, records, '2026-09-09', '5-1', '2026-09-09');
assert(legacyExact.counts.total === 3, 'legacy cached classId filter should remain compatible');

const history = buildTeacherStudentHistory(roster, records, 't5a2');
assert(history?.history.length === 1, 'student history should contain the canonical record');
assert(history?.dataScope === 'main' && history.grade === '5' && history.classNumber === '1', 'history should expose derived membership only');
assert(history?.history[0]?.goalRating === 3 && history.history[0]?.communicationRating === 4, 'history should retain four-point ratings');
const serializedHistory = JSON.stringify(history);
assert(!serializedHistory.includes('R-MAIN-0001'), 'teacher history must not expose researchId');
assert(!serializedHistory.includes('"studentId"'), 'teacher history must not expose internal studentId');

const csv = serializeTeacherReflectionCsv(roster, records, '2026-09-09', { dataScope:'main', grade:'5', classNumber:'1' });
assert(csv.startsWith('\uFEFF'), 'CSV should include UTF-8 BOM');
for (const header of ['data_scope','grade_level','class_number','goal_rating','communication_rating','rating_scale_min','rating_scale_max','rating_item_1','rating_item_2','reflection_text']) assert(csv.includes(`"${header}"`), `CSV missing ${header}`);
assert(csv.includes('"1"') && csv.includes('"4"'), 'CSV should make the fixed four-point scale explicit');
assert(csv.includes('"めあてに向かって取り組めた"'), 'CSV should include item 1 label');
assert(csv.includes('"相手の話を聞いて分かろうとしたり，自分の気持ちを伝えようとしたりした"'), 'CSV should include item 2 label');
assert(csv.includes('"T5A2"') && csv.includes('"T5B3"') && csv.includes('"T5C4"'), 'daily main CSV must include every selected active roster student');
assert(csv.includes('"missing"'), 'daily CSV must emit missing status for active student without a reflection record');
assert(csv.split('\r\n').filter(Boolean).length === 4, 'daily CSV row count must equal dashboard total plus header');
assert(!csv.includes('"OLD1"'), 'inactive roster student must be excluded from teacher CSV even when an old record exists');
assert(!csv.includes('"P6A2"') && !csv.includes('"6RSX"'), 'main CSV must match dashboard filters');
assert(csv.includes("\"'=HYPERLINK("), 'CSV formula-like text must be apostrophe-prefixed');
assert(!csv.includes('research_id') && !csv.includes('student_id'), 'teacher CSV must not expose internal IDs');
assert(!csv.includes('self_regulation_rating') && !csv.includes('rating_schema_version'), 'obsolete rating columns must be absent');

const pilotCsv = serializeTeacherReflectionCsv(roster, records, '2026-09-09', { dataScope:'pilot_b', grade:'6', classNumber:'all' });
assert(pilotCsv.includes('"P6A2"') && pilotCsv.includes('"P6B3"') && pilotCsv.includes('"missing"'), 'Pilot B daily CSV must include its missing active roster row');
assert(!pilotCsv.includes('"T5A2"') && !pilotCsv.includes('"6RSX"'), 'Pilot B CSV must match Pilot B filter');
const testCsv = serializeTeacherReflectionCsv(roster, records, '2026-09-09', { dataScope:'test', grade:'all', classNumber:'all' });
assert(testCsv.includes('"6RSX"') && !testCsv.includes('"P6A2"'), 'test CSV must isolate test data');

const researchCsv = serializeResearchLessonReflectionCsv(records, '2026-09-09');
assert(researchCsv.includes('"research_id"') && researchCsv.includes('"local_date"'), 'research lesson Reflection CSV must expose join keys');
assert(researchCsv.includes('"R-TEST-6RSX"') && researchCsv.includes('"2026-09-09"'), '6RSX test Reflection must carry the internal research_id + local_date join pair');
assert(researchCsv.includes('"goal_rating"') && researchCsv.includes('"communication_rating"') && researchCsv.includes('"reflection_text"'), 'research lesson Reflection CSV must retain canonical lesson reflection fields');
assert(!researchCsv.includes('"learning_id"') && !researchCsv.includes('"student_id"'), 'research lesson Reflection CSV must not expose learning or internal student IDs');
assert(researchCsv.includes("\"'=HYPERLINK("), 'research Reflection CSV must retain formula-injection protection');

console.log('[qa:reflection-teacher] PASS: active-roster parity, daily missing rows, four-point fields, 6RSX isolation, research_id+local_date join export, formula safety, and privacy verified.');
