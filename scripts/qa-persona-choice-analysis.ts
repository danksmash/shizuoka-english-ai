import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PERSONA_REASON_RQ1_LINK_HEADERS, buildPersonaReasonRq1LinkRows } from '../src/server/personaReasonRq1Link';
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


const rq1Rows = [
  { research_id: 'R-AAAA', class_id: '5-1', school_condition: 'intervention', analysis_period: 'period1', visitor_choice_denominator: 4, visitor_selection_rate: 0.25 },
  { research_id: 'R-AAAA', class_id: '5-1', school_condition: 'intervention', analysis_period: 'period2', visitor_choice_denominator: 4, visitor_selection_rate: 0.5, assigned_choice_denominator: 4, assigned_selection_rate: 0.25 },
  { research_id: 'R-AAAA', class_id: '5-1', school_condition: 'intervention', analysis_period: 'period3', assigned_choice_denominator: 4, assigned_selection_rate: 0.75 },
  { research_id: 'R-BBBB', class_id: '5-2', school_condition: 'intervention', analysis_period: 'period1', visitor_choice_denominator: 2, visitor_selection_rate: 0 },
];
const joined = buildPersonaReasonRq1LinkRows(data, rq1Rows);
assert.equal(joined.length, 2, 'duplicate and incomplete questionnaire respondents must not be joined');
assert.equal(joined[0].research_id, 'R-AAAA');
assert.equal(joined[0].rq1_join_status, 'complete');
assert.equal(joined[0].visitor_rate_change_p2_minus_p1, 0.25);
assert.equal(joined[0].assigned_rate_change_p3_minus_p2, 0.5);
assert.equal(joined[1].rq1_join_status, 'partial_periods');
assert.equal(joined[1].period2_assigned_rate, '', 'missing RQ1 period must never become zero');
assert.equal(Object.keys(joined[0]).length, PERSONA_REASON_RQ1_LINK_HEADERS.length);
const mismatchRows = buildPersonaReasonRq1LinkRows([data[0]], [{ ...rq1Rows[0], class_id: '5-2' }]);
assert.equal(mismatchRows[0].rq1_join_status, 'mismatch_or_duplicate_period');
assert.equal(mismatchRows[0].period1_visitor_rate, '');
assert.equal(buildPersonaReasonRq1LinkRows([data[0]], [])[0].rq1_join_status, 'rq1_not_found');
const rq1Routes = fs.readFileSync('src/server/researchRq1Routes.ts', 'utf8');
assert.ok(rq1Routes.includes("router.get('/research-rq1/persona-choice-link', requireManagementRole(['researcher'])"));
assert.ok(rq1Routes.includes("router.get('/research-rq1/persona-choice-link.csv', requireManagementRole(['researcher'])"));

// A valid submission plus an incomplete retry from the SAME research ID is
// still a duplicate respondent, not a unique valid participant.
const mixedQualityDuplicate = [
  answer('R-MIXED', ['国籍'], ['見た目']),
  answer('R-MIXED', [], ['見た目']),
];
const mixedResult = buildPersonaChoiceReasonAnalysis(mixedQualityDuplicate);
assert.equal(mixedResult.counts.validUniqueRespondents, 0);
assert.equal(mixedResult.counts.invalidRecords, 1);
assert.equal(mixedResult.counts.duplicateRespondents, 1);
assert.equal(mixedResult.counts.duplicateRecordsExcluded, 1);
const mixedCsvRows = buildPersonaChoiceReasonExportRows(mixedQualityDuplicate);
assert.equal(mixedCsvRows.filter((row) => row.analysis_status === 'valid_unique').length, 0);
assert.equal(mixedCsvRows.filter((row) => row.analysis_status === 'duplicate_research_id').length, 1);
assert.equal(mixedCsvRows.filter((row) => row.analysis_status === 'invalid_or_incomplete').length, 1);

const managementLink = fs.readFileSync('src/server/researchRq1DashboardRuntime.ts', 'utf8');
assert.ok(managementLink.includes('personaChoiceReasonsBtn'));
assert.ok(managementLink.includes('8 CSVを一括ZIP'));

const route = fs.readFileSync('src/server/questionnaireRoutes.ts', 'utf8');
const oldPage = fs.readFileSync('public/questionnaire-analysis.html', 'utf8');
const newPage = fs.readFileSync('public/persona-choice-analysis.html', 'utf8');
assert.ok(route.includes("router.post('/questionnaire/persona-choice-analysis', requireManagementRole(['researcher'])"));
assert.ok(oldPage.includes('href="/persona-choice-analysis.html"'));
assert.ok(newPage.includes('/api/management/questionnaire/persona-choice-analysis'));
assert.ok(newPage.includes('esc(r.comment)'));
assert.ok(newPage.includes('runRq1Link'));
assert.ok(newPage.includes('downloadRq1LinkCsv'));

assert.ok(newPage.includes('escape') === false || newPage.includes('esc('));
assert.ok(!JSON.stringify(result).includes('learningCode'));

console.log('Persona choice reason analysis QA: PASS');
