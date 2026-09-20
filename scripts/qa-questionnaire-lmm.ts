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
const grouped = buildQuestionnaireLmmTrial(twoGroup, 'l2wtc');
assert.equal(grouped.mode, 'group_time');
assert.equal(grouped.status, 'ok');
assert.equal(grouped.interventionParticipants, 12);
assert.equal(grouped.comparisonParticipants, 12);
const primary = grouped.contrasts.find((row) => row.id === 'mid_post');
assert.ok(primary);
assert.ok(typeof primary.estimate === 'number');
assert.ok((primary.estimate || 0) > 0, 'intervention Mid→Post change should exceed comparison in synthetic data');

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
const badPost = record('BAD', 'post_pre_exchange', 4, 'intervention', '5-1');
badPost.surveyDate = '2026-10-09';
const timingBad = buildQuestionnaireTimingAudit([badPost], schedules);
assert.equal(timingBad.issueCount, 1);
assert.equal(timingBad.issues[0].code, 'POST_AFTER_EXCHANGE');

console.log('Questionnaire LMM trial and timing audit QA: PASS');
