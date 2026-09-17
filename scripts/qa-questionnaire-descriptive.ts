import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildQuestionnaireDescriptiveStatistics } from '../src/server/questionnaireDescriptive';
import {
  QUESTIONNAIRE_INSTRUMENT_VERSION,
  QUESTIONNAIRE_ITEMS,
  calculateQuestionnaireScores,
  type QuestionnaireItemScores,
  type QuestionnaireRecord,
} from '../src/server/questionnaireResearch';

function itemScores(base: number): QuestionnaireItemScores {
  return Object.fromEntries(
    QUESTIONNAIRE_ITEMS.map((item, index) => [item.id, Math.max(1, Math.min(6, base + (index % 2)))]),
  ) as QuestionnaireItemScores;
}

function record(
  researchId: string,
  classId: string,
  surveyWave: 'pre_app' | 'post_exchange',
  base: number,
  suffix = '',
): QuestionnaireRecord {
  const items = itemScores(base);
  const scores = calculateQuestionnaireScores(items);
  return {
    responseId: `q-${researchId}-${surveyWave}${suffix}`,
    researchId,
    classId,
    gradeLevel: classId.startsWith('5-') ? 5 : 6,
    dataScope: 'main',
    surveyWave,
    surveyDate: surveyWave === 'pre_app' ? '2026-09-17' : '2026-10-20',
    submittedAt: surveyWave === 'pre_app' ? '2026-09-17T00:00:00.000Z' : '2026-10-20T00:00:00.000Z',
    instrumentVersion: QUESTIONNAIRE_INSTRUMENT_VERSION,
    items,
    ...scores,
    dataQualityFlag: 'complete',
    importedAt: '2026-09-18T00:00:00.000Z',
  };
}

const records: QuestionnaireRecord[] = [];

// 5-3: 24 enrolled is not assumed. If 2 pupils are absent, the current descriptive N is 22.
for (let i = 0; i < 22; i += 1) {
  records.push(record(`R5-3-${i}`, '5-3', 'pre_app', 3 + (i % 2)));
}

let stats = buildQuestionnaireDescriptiveStatistics(records);
let row53 = stats.rows.find((row) => row.groupId === '5-3');
assert.ok(row53);
assert.equal(row53.pre.n, 22, 'current Pre N must equal currently available valid responses');
assert.equal(row53.post.n, 0, 'missing Post responses must remain N=0');
assert.ok(typeof row53.pre.total.mean === 'number', 'Pre mean must be available even before Post exists');
assert.ok(typeof row53.pre.total.sd === 'number', 'Pre SD must use current valid respondents');
assert.equal(row53.post.total.mean, null);
assert.equal(row53.post.total.sd, null);

// Late responses update the descriptive N and statistics without waiting for a complete class.
records.push(record('R5-3-22', '5-3', 'pre_app', 4));
stats = buildQuestionnaireDescriptiveStatistics(records);
row53 = stats.rows.find((row) => row.groupId === '5-3');
assert.equal(row53?.pre.n, 23, 'late response must immediately increase the current Pre N');

// Post may have a different current N because absences are handled independently at each wave.
for (let i = 0; i < 20; i += 1) {
  records.push(record(`R5-3-${i}`, '5-3', 'post_exchange', 4 + (i % 2)));
}
stats = buildQuestionnaireDescriptiveStatistics(records);
row53 = stats.rows.find((row) => row.groupId === '5-3');
assert.equal(row53?.pre.n, 23);
assert.equal(row53?.post.n, 20);
assert.ok(typeof row53?.post.l2wtc.mean === 'number');
assert.ok(typeof row53?.post.l2wtc.sd === 'number');

// N=1: mean is shown but sample SD is unavailable.
records.push(record('R6-2-ONLY', '6-2', 'pre_app', 3));
stats = buildQuestionnaireDescriptiveStatistics(records);
const row62 = stats.rows.find((row) => row.groupId === '6-2');
assert.equal(row62?.pre.n, 1);
assert.ok(typeof row62?.pre.total.mean === 'number');
assert.equal(row62?.pre.total.sd, null);

// Same research_id + same wave duplicates are excluded from descriptive statistics, matching current data-quality policy.
records.push(record('R-DUP', '5-2', 'pre_app', 3, '-a'));
records.push(record('R-DUP', '5-2', 'pre_app', 4, '-b'));
stats = buildQuestionnaireDescriptiveStatistics(records);
const row52 = stats.rows.find((row) => row.groupId === '5-2');
assert.equal(row52?.pre.n, 0, 'duplicate same-wave responses must not be double-counted');

const overall = stats.rows.find((row) => row.groupId === 'all');
assert.ok(overall);
assert.equal(overall.pre.n, 24, 'overall Pre N must be the current unique valid responses across classes');
assert.equal(stats.rows.length, 8, 'five classes, two grades, and overall are required');
assert.equal(stats.calculation.scaleMinimum, 1);
assert.equal(stats.calculation.scaleMaximum, 6);
assert.ok(stats.calculation.absenceRule.includes('current_N_mean_SD'));

const routes = fs.readFileSync('src/server/questionnaireRoutes.ts', 'utf8');
const runtime = fs.readFileSync('src/server/questionnaireDescriptiveDashboardRuntime.ts', 'utf8');
const entry = fs.readFileSync('server-entry.ts', 'utf8');
assert.ok(routes.includes("router.post('/questionnaire/descriptive'"));
assert.ok(runtime.includes('欠席者がいる場合も、その時点で回答済みの児童だけ'));
assert.ok(runtime.includes("fetch('/api/management/questionnaire/descriptive',{method:'POST'"));
assert.ok(runtime.includes('事前・事後対応分析（Pre/Post 両方がある同一児童のみ）'));
assert.ok(runtime.includes('6件法平均値'));
assert.ok(entry.includes('withQuestionnaireDescriptiveDashboardRuntime'));

console.log('Questionnaire descriptive dashboard QA: PASS');
