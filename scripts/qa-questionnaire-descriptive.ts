import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { buildQuestionnaireDescriptiveStatistics } from '../src/server/questionnaireDescriptive';
import {
  QUESTIONNAIRE_INSTRUMENT_VERSION,
  QUESTIONNAIRE_ITEMS,
  calculateQuestionnaireScores,
  type QuestionnaireItemScores,
  type QuestionnaireRecord,
  type QuestionnaireWave,
} from '../src/server/questionnaireResearch';

function itemScores(base: number): QuestionnaireItemScores {
  return Object.fromEntries(
    QUESTIONNAIRE_ITEMS.map((item, index) => [item.id, Math.max(1, Math.min(6, base + (index % 2)))]),
  ) as QuestionnaireItemScores;
}

const waveDates: Record<QuestionnaireWave, string> = {
  pre_app: '2026-09-17',
  mid_pre_reveal: '2026-10-01',
  post_pre_exchange: '2026-10-20',
};

function record(
  researchId: string,
  classId: string,
  surveyWave: QuestionnaireWave,
  base: number,
  suffix = '',
): QuestionnaireRecord {
  const items = itemScores(base);
  const scores = calculateQuestionnaireScores(items);
  const surveyDate = waveDates[surveyWave];
  return {
    responseId: `q-${researchId}-${surveyWave}${suffix}`,
    researchId,
    classId,
    gradeLevel: classId.startsWith('5-') ? 5 : 6,
    dataScope: 'main',
    surveyWave,
    surveyDate,
    submittedAt: `${surveyDate}T00:00:00.000Z`,
    instrumentVersion: QUESTIONNAIRE_INSTRUMENT_VERSION,
    items,
    ...scores,
    dataQualityFlag: 'complete',
    importedAt: '2026-09-18T00:00:00.000Z',
  };
}

const records: QuestionnaireRecord[] = [];
for (let i = 0; i < 22; i += 1) records.push(record(`R5-3-${i}`, '5-3', 'pre_app', 3 + (i % 2)));

let stats = buildQuestionnaireDescriptiveStatistics(records);
let row53 = stats.rows.find((row) => row.groupId === '5-3');
assert.ok(row53);
assert.equal(row53.pre.n, 22);
assert.equal(row53.mid.n, 0);
assert.equal(row53.post.n, 0);
assert.ok(typeof row53.pre.attitude.mean === 'number');
assert.equal(row53.mid.attitude.mean, null);
assert.equal(row53.post.attitude.mean, null);

records.push(record('R5-3-22', '5-3', 'pre_app', 4));
for (let i = 0; i < 21; i += 1) records.push(record(`R5-3-${i}`, '5-3', 'mid_pre_reveal', 4 + (i % 2)));
for (let i = 0; i < 20; i += 1) records.push(record(`R5-3-${i}`, '5-3', 'post_pre_exchange', 4 + (i % 2)));
stats = buildQuestionnaireDescriptiveStatistics(records);
row53 = stats.rows.find((row) => row.groupId === '5-3');
assert.equal(row53?.pre.n, 23);
assert.equal(row53?.mid.n, 21);
assert.equal(row53?.post.n, 20);
assert.ok(typeof row53?.mid.l2wtc.mean === 'number');
assert.ok(typeof row53?.post.l2wtc.sd === 'number');

records.push(record('R6-2-ONLY', '6-2', 'mid_pre_reveal', 3));
stats = buildQuestionnaireDescriptiveStatistics(records);
const row62 = stats.rows.find((row) => row.groupId === '6-2');
assert.equal(row62?.mid.n, 1);
assert.ok(typeof row62?.mid.attitude.mean === 'number');
assert.equal(row62?.mid.attitude.sd, null);

records.push(record('R-DUP', '5-2', 'mid_pre_reveal', 3, '-a'));
records.push(record('R-DUP', '5-2', 'mid_pre_reveal', 4, '-b'));
stats = buildQuestionnaireDescriptiveStatistics(records);
const row52 = stats.rows.find((row) => row.groupId === '5-2');
assert.equal(row52?.mid.n, 0, 'duplicate same-wave responses must not be double-counted');

const overall = stats.rows.find((row) => row.groupId === 'all');
assert.ok(overall);
assert.equal(overall.pre.n, 23);
assert.equal(overall.mid.n, 22);
assert.equal(overall.post.n, 20);
assert.equal(stats.rows.length, 8);
assert.deepEqual(stats.calculation.waveOrder, ['pre_app', 'mid_pre_reveal', 'post_pre_exchange']);
assert.equal(stats.calculation.scaleMinimum, 1);
assert.equal(stats.calculation.scaleMaximum, 6);

const routes = fs.readFileSync('src/server/questionnaireRoutes.ts', 'utf8');
const page = fs.readFileSync('public/questionnaire-analysis.html', 'utf8');
assert.ok(routes.includes("router.post('/questionnaire/descriptive'"));
assert.ok(routes.includes("router.post('/questionnaire/analysis'"));
assert.ok(routes.includes("router.post('/questionnaire/lmm-trial'"));
assert.ok(page.includes('Study 1 3時点質問紙分析'));
assert.ok(page.includes('Mid N'));
assert.ok(page.includes("mid=row.mid[key]"));
assert.ok(page.includes("renderChart('chartAttitude',rows,'attitude')"));
assert.equal(page.includes("renderChart('chartAttitude',rows,'total')"), false);
assert.ok(page.includes("bar(mid,cx"));
assert.ok(page.includes("const rows=questionnaireVisibleRows(data?.rows)"), 'the table and every metric chart must share the display-only row filter');
const visibleGroupSet = page.match(/const QUESTIONNAIRE_VISIBLE_GROUP_IDS=new Set\(\[([^\]]+)\]\)/)?.[1];
assert.ok(visibleGroupSet, 'questionnaire display allowlist must exist');
const visibleGroupIds = [...visibleGroupSet.matchAll(/'([^']+)'/g)].map((match) => match[1]);
assert.deepEqual(visibleGroupIds, ['intervention:5-1','intervention:5-2','intervention:5-3','intervention:6-1','intervention:6-2','intervention:grade5','intervention:all','comparison:6-C1']);
assert.ok(page.includes("startsWith('comparison:')"), 'single-school displays without comparison data must retain their existing rows');
assert.equal(visibleGroupIds.includes('comparison:grade6'), false, 'comparison grade rollup must not be displayed');
assert.equal(visibleGroupIds.includes('comparison:all'), false, 'comparison overall rollup must not be displayed');
assert.equal(visibleGroupIds.includes('all'), false, 'both-schools overall rollup must not be displayed');
assert.ok(stats.rows.some((row) => row.groupId === 'all'), 'both-schools aggregate must remain available in the descriptive calculation');
assert.ok(stats.rows.some((row) => row.groupId === 'grade6'), 'grade aggregates must remain available in the descriptive calculation');
const comparisonRecords = [record('R-COMP', '6-C1', 'pre_app', 4)].map((row) => ({ ...row, schoolCondition: 'comparison' as const }));
const comparisonStats = buildQuestionnaireDescriptiveStatistics([...records, ...comparisonRecords]);
assert.ok(comparisonStats.rows.some((row) => row.groupId === 'comparison:6-C1'));
assert.ok(comparisonStats.rows.some((row) => row.groupId === 'comparison:grade6'), 'comparison grade aggregate must remain calculated');
assert.ok(comparisonStats.rows.some((row) => row.groupId === 'comparison:all'), 'comparison overall aggregate must remain calculated');
assert.ok(comparisonStats.rows.some((row) => row.groupId === 'all'), 'both-schools aggregate must remain calculated');
const filterStart = page.indexOf('const QUESTIONNAIRE_VISIBLE_GROUP_IDS=');
const filterEnd = page.indexOf('function renderDescriptive', filterStart);
assert.ok(filterStart >= 0 && filterEnd > filterStart, 'display filter source must be extractable');
const filterContext: { questionnaireVisibleRows?: (rows: Array<{ groupId: string }>) => Array<{ groupId: string }> } = {};
vm.runInNewContext(`${page.slice(filterStart, filterEnd)};globalThis.questionnaireVisibleRows=questionnaireVisibleRows;`, filterContext);
const filteredGroupIds = filterContext.questionnaireVisibleRows!(comparisonStats.rows).map((row) => row.groupId);
assert.deepEqual(filteredGroupIds, visibleGroupIds.filter((groupId) => comparisonStats.rows.some((row) => row.groupId === groupId)));
assert.deepEqual(filterContext.questionnaireVisibleRows!(stats.rows).map((row) => row.groupId), stats.rows.map((row) => row.groupId), 'legacy intervention-only display must remain unchanged');
assert.ok(page.includes('試験的LMM分析（研究者用）'));
assert.ok(page.includes("api('/api/management/questionnaire/lmm-trial'"));
assert.equal(page.includes('事前・事後対応分析'), false);

console.log('Questionnaire three-wave descriptive dashboard QA: PASS');
