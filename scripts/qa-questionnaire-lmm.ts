import assert from 'node:assert/strict';
import { buildQuestionnaireLmmTrial } from '../src/server/questionnaireLmmTrial';
import { buildQuestionnaireTimingAudit } from '../src/server/questionnaireTimingAudit';
import {
  QUESTIONNAIRE_INSTRUMENT_VERSION,
  QUESTIONNAIRE_ITEMS,
  calculateQuestionnaireScores,
  type QuestionnaireItemScores,
  type QuestionnaireRecord,
  type QuestionnaireWave,
} from '../src/server/questionnaireResearch';
import type { StudyScheduleRecord } from '../src/server/studySchedulePersistence';

function assertClose(actual: number | null, expected: number, tolerance: number, label: string) {
  assert.ok(typeof actual === 'number' && Number.isFinite(actual), `${label} should be finite`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected} ± ${tolerance}, got ${actual}`);
}

function scoresFromMean(seed: number): QuestionnaireItemScores {
  return Object.fromEntries(QUESTIONNAIRE_ITEMS.map((item, index) => {
    const raw = Math.max(1, Math.min(6, Math.round(seed + ((index % 3) - 1) * 0.25)));
    return [item.id, raw];
  })) as QuestionnaireItemScores;
}

function record(
  researchId: string,
  wave: QuestionnaireWave,
  seed: number,
  condition: 'intervention' | 'comparison' = 'intervention',
  classId = '5-1',
): QuestionnaireRecord {
  const items = scoresFromMean(seed);
  const scores = calculateQuestionnaireScores(items);
  const date = wave === 'pre_app' ? '2026-09-10' : wave === 'mid_pre_reveal' ? '2026-09-24' : '2026-10-08';
  return {
    responseId: `q-${researchId}-${wave}`,
    researchId,
    classId,
    gradeLevel: 5,
    dataScope: 'main',
    surveyWave: wave,
    surveyDate: date,
    submittedAt: `${date}T00:00:00.000Z`,
    instrumentVersion: QUESTIONNAIRE_INSTRUMENT_VERSION,
    items,
    ...scores,
    dataQualityFlag: 'complete',
    importedAt: '2026-09-10T00:00:00.000Z',
    schoolCondition: condition,
  } as QuestionnaireRecord;
}

const interventionOnly: QuestionnaireRecord[] = [];
for (let i = 0; i < 12; i += 1) {
  const jitter = (i % 4) * 0.2;
  interventionOnly.push(
    record(`I-${i}`, 'pre_app', 3 + jitter),
    record(`I-${i}`, 'mid_pre_reveal', 3.2 + jitter),
    record(`I-${i}`, 'post_pre_exchange', 3.8 + jitter),
  );
}
const within = buildQuestionnaireLmmTrial(interventionOnly, 'l2wtc');
assert.equal(within.mode, 'intervention_time_only');
assert.equal(within.status, 'ok');
assert.equal(within.nParticipants, 12);
assert.equal(within.complete3, 12);
const withinMidPost = within.contrasts.find((row) => row.id === 'mid_post');
assert.ok(withinMidPost);
assert.ok(typeof withinMidPost.estimate === 'number');
assert.ok((withinMidPost.estimate || 0) > 0);

const twoGroup: QuestionnaireRecord[] = [...interventionOnly];
for (let i = 0; i < 12; i += 1) {
  const jitter = (i % 4) * 0.2;
  twoGroup.push(
    record(`C-${i}`, 'pre_app', 3 + jitter, 'comparison', '5-2'),
    record(`C-${i}`, 'mid_pre_reveal', 3.2 + jitter, 'comparison', '5-2'),
    record(`C-${i}`, 'post_pre_exchange', 3.3 + jitter, 'comparison', '5-2'),
  );
}
const attitudeTrial = buildQuestionnaireLmmTrial(interventionOnly, 'attitude');
assert.equal(attitudeTrial.metric, 'attitude');
assert.equal(attitudeTrial.metricLabel, '主体的に学習に取り組む態度');
const grouped = buildQuestionnaireLmmTrial(twoGroup, 'l2wtc');
assert.equal(grouped.mode, 'group_time');
assert.equal(grouped.status, 'ok');
assert.equal(grouped.interventionParticipants, 12);
assert.equal(grouped.comparisonParticipants, 12);
const primary = grouped.contrasts.find((row) => row.id === 'mid_post');
assert.ok(primary);
assert.ok(typeof primary.estimate === 'number');
assert.ok((primary.estimate || 0) > 0, 'intervention Mid→Post change should exceed comparison in synthetic data');
assert.equal(grouped.estimationMethod, 'REML_random_intercept');
assert.equal(grouped.inferenceMethod, 'Wald_z_approximation');
// Independent reference fixture checked against statsmodels MixedLM REML.
assertClose(primary.estimate, 0.35, 1e-6, 'reference Mid→Post interaction estimate');
assertClose(primary.se, 0.090453, 2e-5, 'reference Mid→Post interaction SE');
assertClose(grouped.randomInterceptVariance, 0.083182, 3e-5, 'reference random-intercept variance');
assertClose(grouped.residualVariance, 0.024545, 3e-5, 'reference residual variance');

const missingTwoGroup = twoGroup.filter((row) => !(
  (row.researchId === 'C-0' && row.surveyWave === 'mid_pre_reveal')
  || (row.researchId === 'I-1' && row.surveyWave === 'post_pre_exchange')
  || (row.researchId === 'C-2' && row.surveyWave === 'pre_app')
));
const missingFit = buildQuestionnaireLmmTrial(missingTwoGroup, 'l2wtc');
assert.equal(missingFit.status, 'ok');
assert.equal(missingFit.mode, 'group_time');
assert.equal(missingFit.nObservations, 69);
assert.equal(missingFit.complete3, 21);
assert.equal(missingFit.partialParticipants, 3);
const missingPrimary = missingFit.contrasts.find((row) => row.id === 'mid_post');
assert.ok(missingPrimary);
assertClose(missingPrimary.estimate, 0.365725, 2e-5, 'missing-data Mid→Post interaction estimate');
assertClose(missingPrimary.se, 0.094429, 5e-5, 'missing-data Mid→Post interaction SE');

const oneComparison: QuestionnaireRecord[] = [
  ...interventionOnly,
  record('C-ONLY', 'pre_app', 3, 'comparison', '5-2'),
  record('C-ONLY', 'mid_pre_reveal', 3.2, 'comparison', '5-2'),
  record('C-ONLY', 'post_pre_exchange', 3.3, 'comparison', '5-2'),
];
const earlyComparison = buildQuestionnaireLmmTrial(oneComparison, 'l2wtc');
assert.equal(earlyComparison.mode, 'group_time');
assert.equal(earlyComparison.status, 'insufficient_data');
assert.equal(earlyComparison.comparisonParticipants, 1);
assert.ok(earlyComparison.note.includes('実践校内分析へ自動的に戻らず'));

const inconsistentCondition = interventionOnly.map((row) => (
  row.researchId === 'I-0' && row.surveyWave === 'mid_pre_reveal'
    ? { ...row, schoolCondition: 'comparison' as const }
    : row
));
const inconsistentFit = buildQuestionnaireLmmTrial(inconsistentCondition, 'l2wtc');
assert.equal(inconsistentFit.status, 'invalid_data');
assert.equal(inconsistentFit.mode, 'group_time');
assert.equal(inconsistentFit.conditionConflictParticipants, 1);

const duplicateWave = [
  ...interventionOnly,
  { ...interventionOnly[0], responseId: 'q-duplicate-pre' },
];
const duplicateFit = buildQuestionnaireLmmTrial(duplicateWave, 'l2wtc');
assert.equal(duplicateFit.status, 'ok');
assert.equal(duplicateFit.duplicateWaveKeys, 1);
assert.equal(duplicateFit.nObservations, 35);
assert.equal(duplicateFit.complete3, 11);
assert.equal(duplicateFit.partialParticipants, 1);

const schedules: StudyScheduleRecord[] = [{
  classId: '5-1',
  revision: 1,
  appStartDate: '2026-09-10',
  nationalityRevealDate: '2026-09-24',
  videoViewDate: '2026-10-01',
  exchangeDate: '2026-10-08',
  updatedAt: '',
  updatedBy: '',
  history: [],
}];
const timingOk = buildQuestionnaireTimingAudit(interventionOnly.filter((row) => row.classId === '5-1'), schedules);
assert.equal(timingOk.issueCount, 0);
assert.equal(timingOk.status, 'ok');
const timingUnavailable = buildQuestionnaireTimingAudit(interventionOnly.slice(0, 1), []);
assert.equal(timingUnavailable.status, 'unavailable');
const badPost = record('BAD', 'post_pre_exchange', 4, 'intervention', '5-1');
badPost.surveyDate = '2026-10-09';
const timingBad = buildQuestionnaireTimingAudit([badPost], schedules);
assert.equal(timingBad.issueCount, 1);
assert.equal(timingBad.issues[0].code, 'POST_AFTER_EXCHANGE');

console.log('Questionnaire LMM trial and timing audit QA: PASS');
