import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PERSONA_CHOICE_REASON_EXPORT_HEADERS,
  buildPersonaChoiceReasonExportRows,
  buildPersonaChoiceReasonCodebookRows,
  serializePersonaChoiceReasonCsv,
} from '../src/server/personaChoiceReasonExport';
import {
  buildPersonaChoiceReasonAnalysis,
  type PersonaChoiceReasonRecord,
} from '../src/server/personaChoiceReasonAnalysis';

function answer(
  researchId: string,
  before: string[],
  after: string[],
  overrides: Partial<PersonaChoiceReasonRecord> = {},
): PersonaChoiceReasonRecord {
  return {
    researchId,
    classId: '5-1',
    gradeLevel: 5,
    schoolCondition: 'intervention',
    dataScope: 'main',
    surveyDate: '2026-11-03',
    submittedAt: '2026-11-03T00:00:00.000Z',
    initialReasons: before,
    finalReasons: after,
    comment: '',
    dataQualityFlag: 'complete',
    ...overrides,
  };
}

const data = [
  answer('R-AAAA', ['国籍', '見た目'], ['国籍'], { comment: '国籍が気になった' }),
  answer('R-BBBB', ['声'], ['声', '話しやすい'], { classId: '5-2' }),
  answer('R-CCCC', ['声'], ['話しやすい']),
  answer('R-CCCC', ['国籍'], ['声']),
  answer('R-DDDD', [], ['声']),
];
const result = buildPersonaChoiceReasonAnalysis(data);
assert.deepEqual(result.counts, {
  storedRecords: 5,
  validUniqueRespondents: 2,
  invalidRecords: 1,
  duplicateRespondents: 1,
  duplicateRecordsExcluded: 2,
});
assert.equal(result.groups[0].groupId, 'all');
assert.equal(result.groups[0].n, 2);
assert.equal(result.groups.find((group) => group.groupId === 'intervention:5-1')?.n, 1);
assert.equal(result.groups.find((group) => group.groupId === 'intervention:5-2')?.n, 1);
assert.equal(result.comments.length, 1);
assert.equal(result.comments[0].researchId, 'R-AAAA');

const byReason = new Map(result.groups[0].reasons.map((row) => [row.reason, row]));
assert.deepEqual({
  before: byReason.get('国籍')?.initialCount,
  after: byReason.get('国籍')?.finalCount,
  continued: byReason.get('国籍')?.continuedCount,
}, { before: 1, after: 1, continued: 1 });
assert.equal(byReason.get('見た目')?.removedCount, 1);
assert.equal(byReason.get('話しやすい')?.addedCount, 1);
assert.equal(byReason.get('国籍')?.initialPercent, 50);
assert.equal(result.groups.length, 5); // all + intervention + grade5 + 2 classes
assert.equal(buildPersonaChoiceReasonAnalysis([]).counts.validUniqueRespondents, 0);
assert.equal(buildPersonaChoiceReasonAnalysis([]).groups[0].n, 0);


const exportRows = buildPersonaChoiceReasonExportRows(data);
assert.equal(exportRows.length, data.length);
assert.equal(exportRows.filter((row) => row.analysis_status === 'valid_unique').length, 2);
assert.equal(exportRows.filter((row) => row.analysis_status === 'duplicate_research_id').length, 2);
assert.equal(exportRows.filter((row) => row.analysis_status === 'invalid_or_incomplete').length, 1);
assert.ok(exportRows.every((row) => Object.keys(row).length === PERSONA_CHOICE_REASON_EXPORT_HEADERS.length));
assert.equal(buildPersonaChoiceReasonCodebookRows().length, PERSONA_CHOICE_REASON_EXPORT_HEADERS.length);
assert.ok(buildPersonaChoiceReasonCodebookRows().every((row) => row.file_name === 'persona_choice_reason_responses.csv'));
const filtered = buildPersonaChoiceReasonExportRows(data, { classId: '5-1' });
assert.equal(filtered.find((row) => row.research_id === 'R-CCCC')?.analysis_status, 'duplicate_research_id');
assert.equal(filtered.some((row) => row.research_id === 'R-BBBB'), false);
const hazard = answer('R-HHHH', ['声'], ['国籍'], { comment: '=HYPERLINK("http://invalid.test","click")' });
const hazardCsv = serializePersonaChoiceReasonCsv(buildPersonaChoiceReasonExportRows([hazard]));
assert.ok(hazardCsv.startsWith('\uFEFF'));
assert.ok(hazardCsv.includes("'=HYPERLINK"));
assert.ok(!hazardCsv.includes('"=HYPERLINK'));
assert.ok(!hazardCsv.includes('learningCode'));
assert.deepEqual(buildPersonaChoiceReasonExportRows([]), []);

const exportRuntime = fs.readFileSync('src/server/researchStreamingExportRuntime.ts', 'utf8');
assert.ok(exportRuntime.includes("if (requested === 'persona_choice_reason_responses')"));
assert.ok(exportRuntime.includes("zip.addFile('persona_choice_reason_responses.csv'"));
assert.ok(exportRuntime.includes('persona_choice_reason_responses: personaReasonRows.length'));
assert.ok(exportRuntime.includes('persona_choice_reason_join_key'));
assert.ok(exportRuntime.includes('buildPersonaChoiceReasonCodebookRows'));

const route = fs.readFileSync('src/server/questionnaireRoutes.ts', 'utf8');
const oldPage = fs.readFileSync('public/questionnaire-analysis.html', 'utf8');
const newPage = fs.readFileSync('public/persona-choice-analysis.html', 'utf8');
assert.ok(route.includes("router.post('/questionnaire/persona-choice-analysis', requireManagementRole(['researcher'])"));
assert.ok(oldPage.includes('href="/persona-choice-analysis.html"'));
assert.ok(newPage.includes('/api/management/questionnaire/persona-choice-analysis'));
assert.ok(newPage.includes('esc(r.comment)'));
assert.ok(newPage.includes('escape') === false || newPage.includes('esc('));
assert.ok(!JSON.stringify(result).includes('learningCode'));

console.log('Persona choice reason analysis QA: PASS');
