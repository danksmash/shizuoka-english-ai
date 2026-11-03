import assert from 'node:assert/strict';
import fs from 'node:fs';
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
