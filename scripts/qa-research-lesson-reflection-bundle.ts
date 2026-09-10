import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeFormalResearchExportQuery } from '../src/server/researchDashboard';
import {
  buildResearchLessonReflectionCodebookRows,
  buildResearchLessonReflectionRows,
  RESEARCH_LESSON_REFLECTION_HEADERS,
  serializeResearchLessonReflectionCsv,
} from '../src/server/researchLessonReflectionExport';
import type { ReflectionRecord } from '../src/server/reflectionPersistence';

const make = (
  researchId: string,
  classId: string,
  localDate: string,
  extra: Partial<ReflectionRecord> = {},
): ReflectionRecord => ({
  reflectionId: `ref-${researchId}-${localDate}`,
  studentId: `student-${researchId}`,
  researchId,
  classId,
  learningId: 'HIDDEN1',
  localDate,
  todayGoal: '相手の話をよく聞く。',
  goalRating: 3,
  communicationRating: 4,
  reflectionText: '今日は相手の話を聞いて、自分の考えを伝えた。',
  reflectionCharCount: 24,
  status: 'submitted',
  revision: 2,
  createdAt: `${localDate}T01:00:00.000Z`,
  updatedAt: `${localDate}T01:10:00.000Z`,
  submittedAt: `${localDate}T01:10:00.000Z`,
  ...extra,
});

const records: ReflectionRecord[] = [
  make('R-MAIN-5-1', '5-1', '2026-09-08'),
  make('R-MAIN-6-2', '6-2', '2026-09-10', { status: 'draft', submittedAt: '', reflectionText: '=1+1' }),
  make('R-PILOT-OFFICIAL', '6-PB', '2026-09-09'),
  make('R-PILOT-OFFDATE', '6-PB', '2026-09-10'),
  make('R-TEST', 'テスト', '2026-09-10'),
  make('R-RESERVE', '予備', '2026-09-10'),
];

const defaultFormal = normalizeFormalResearchExportQuery({});
const mainRows = buildResearchLessonReflectionRows(records, defaultFormal);
assert.equal(mainRows.length, 2, 'formal export default must include only main Reflection rows');
assert.ok(mainRows.every((row) => row.data_scope === 'main'));
assert.ok(mainRows.every((row) => !('learning_id' in row) && !('student_id' in row)), 'formal rows must omit learning/internal IDs');

const pilotRows = buildResearchLessonReflectionRows(records, { dataScope: 'pilot_b' });
assert.deepEqual(pilotRows.map((row) => row.research_id), ['R-PILOT-OFFICIAL'], 'only the official Pilot B date may be pilot_b');
const testRows = buildResearchLessonReflectionRows(records, { dataScope: 'test' });
assert.ok(testRows.some((row) => row.research_id === 'R-PILOT-OFFDATE'), 'off-date Pilot B data must be test scope');
assert.ok(testRows.some((row) => row.research_id === 'R-TEST'), 'explicit test class must remain test scope');

const mainClassRows = buildResearchLessonReflectionRows(records, { dataScope: 'main', grade: '5', classId: '1', start: '2026-09-08', end: '2026-09-08' });
assert.deepEqual(mainClassRows.map((row) => row.research_id), ['R-MAIN-5-1'], 'shared date/grade/class filters must apply');

const aiSpecificFiltersIgnored = buildResearchLessonReflectionRows(records, {
  dataScope: 'main', personaId: 'emma_usa', labelCondition: 'shown', topic: 'favorites', completeOnly: '1',
});
assert.equal(aiSpecificFiltersIgnored.length, mainRows.length, 'AI-session-specific filters must not remove lesson-level reflections');

const csv = serializeResearchLessonReflectionCsv(buildResearchLessonReflectionRows(records, { dataScope: 'all' }));
assert.ok(csv.startsWith('\uFEFF'), 'lesson Reflection CSV must include UTF-8 BOM');
for (const header of RESEARCH_LESSON_REFLECTION_HEADERS) assert.ok(csv.includes(`"${header}"`), `missing header ${header}`);
assert.ok(!csv.includes('learning_id') && !csv.includes('student_id'), 'lesson Reflection CSV must not expose learner/internal IDs');
assert.ok(csv.includes("\"'=1+1\""), 'lesson Reflection CSV must neutralize formula-like text');
assert.ok(csv.includes('"1"') && csv.includes('"4"'), 'fixed four-point scale metadata must be exported');

const codebook = buildResearchLessonReflectionCodebookRows();
assert.equal(codebook.length, RESEARCH_LESSON_REFLECTION_HEADERS.length, 'codebook must define every lesson Reflection field');
assert.ok(codebook.every((row) => row.file_name === 'lesson_reflections.csv'));
assert.ok(codebook.some((row) => row.variable === 'research_id' && String(row.definition).includes('共通')));
assert.ok(codebook.some((row) => row.variable === 'local_date' && String(row.definition).includes('結合キー')));

const server = fs.readFileSync('server.ts', 'utf8');
const page = fs.readFileSync('src/server/managementPage.ts', 'utf8');
assert.ok(server.includes("name:'lesson_reflections.csv'"), 'research bundle must contain lesson_reflections.csv');
assert.ok(server.includes('buildResearchLessonReflectionCodebookRows()'), 'bundle codebook must include lesson Reflection definitions');
assert.ok(server.includes("requested==='codebook'"), 'individual codebook.csv must include sixth-file definitions too');
assert.ok(server.includes("file.dataset==='codebook'"), 'dashboard codebook row count must include sixth-file definitions');
assert.ok(server.includes('schema_version:5'), 'bundle manifest schema version must advance for the sixth formal CSV');
assert.ok(server.includes("requested==='lesson_reflections'"), 'individual formal research CSV route must support lesson_reflections');
assert.ok(server.includes('getAllReflectionRecordsForTeacher()'), 'formal bundle must read canonical Reflection records');
assert.ok(page.includes('6 CSVを一括ZIP'), 'researcher UI must advertise six formal CSVs');
assert.ok(page.includes('lesson_reflections.csv'), 'researcher UI must explain the lesson Reflection file');
assert.ok(page.includes('research_id + local_date'), 'researcher UI must document the cross-app join key');

console.log('Formal sixth lesson_reflections.csv bundle QA: PASS');
