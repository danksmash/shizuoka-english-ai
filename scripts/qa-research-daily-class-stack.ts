import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildCumulativeTurnsByClass,
  buildDailyClassStackRows,
  researchClassLabel,
} from '../src/server/researchDailyClassStackRuntime';
import { buildCumulativeWordsByClass } from '../src/server/researchWordsByClassRuntime';
import { buildCumulativeLessonReflectionRows } from '../src/server/researchDashboard';

const sessions = [
  { local_date:'2026-09-17', class_id:'5-1' },
  { local_date:'2026-09-17', class_id:'5-1' },
  { local_date:'2026-09-17', class_id:'5-2' },
  { local_date:'2026-09-17', class_id:'6-1' },
  { local_date:'2026-09-17', class_id:'' },
  { local_date:'2026-09-18', class_id:'5-2' },
  { local_date:'2026-09-18', class_id:'5-2' },
  { local_date:'2026-09-18', class_id:'6-1' },
  { local_date:'invalid', class_id:'5-1' },
];

assert.equal(researchClassLabel('5-1'), '5年1組');
assert.equal(researchClassLabel('6-C2'), '6年比較2組');
assert.equal(researchClassLabel(''), '学級不明');

const daily = buildDailyClassStackRows(sessions, 'daily');
assert.deepEqual(daily.legend.map((item) => item.class_id), ['5-1','5-2','6-1','unknown']);
assert.equal(daily.rows.length, 2);
assert.equal(daily.rows[0].date, '2026-09-17');
assert.equal(daily.rows[0].sessions, 5);
assert.deepEqual(
  daily.rows[0].by_class.map((item) => [item.class_id,item.sessions,item.share_percent]),
  [
    ['5-1',2,40],
    ['5-2',1,20],
    ['6-1',1,20],
    ['unknown',1,20],
  ],
);
assert.equal(
  daily.rows[0].by_class.reduce((sum, item) => sum + item.sessions, 0),
  daily.rows[0].sessions,
  'stacked class segments must sum to the daily total',
);
assert.equal(daily.rows[1].sessions, 3);

const weekly = buildDailyClassStackRows(sessions, 'weekly');
assert.equal(weekly.rows.length, 1);
assert.equal(weekly.rows[0].date, '2026-09-14');
assert.equal(weekly.rows[0].sessions, 8);
assert.equal(
  weekly.rows[0].by_class.reduce((sum, item) => sum + item.sessions, 0),
  8,
  'weekly class segments must sum to the weekly total',
);

const turnSessions = [
  {
    local_date:'2026-09-17',
    class_id:'5-1',
    dialogue_utterance_count:10,
    child_turn_count:5,
    ai_turn_count:5,
    actual_duration_seconds:120,
  },
  {
    local_date:'2026-09-17',
    class_id:'5-1',
    dialogue_utterance_count:14,
    child_turn_count:7,
    ai_turn_count:7,
    actual_duration_seconds:120,
  },
  {
    local_date:'2026-09-18',
    class_id:'5-1',
    dialogue_utterance_count:'',
    child_turn_count:4,
    ai_turn_count:6,
    actual_duration_seconds:120,
  },
  {
    local_date:'2026-09-18',
    class_id:'5-3',
    dialogue_utterance_count:16,
    child_turn_count:8,
    ai_turn_count:8,
    actual_duration_seconds:120,
  },
  {
    local_date:'2026-09-19',
    class_id:'5-3',
    dialogue_utterance_count:20,
    child_turn_count:10,
    ai_turn_count:10,
    actual_duration_seconds:0,
  },
  {
    local_date:'invalid',
    class_id:'5-1',
    dialogue_utterance_count:99,
    actual_duration_seconds:60,
  },
];

turnSessions.push(
  {
    local_date:'2026-09-20',
    class_id:'5-2',
    dialogue_utterance_count:null,
    child_turn_count:4,
    ai_turn_count:null,
    actual_duration_seconds:120,
  },
);

const turns = buildCumulativeTurnsByClass(turnSessions);
assert.deepEqual(turns.map((series) => series.class_id), ['5-1','5-3']);

const class51 = turns.find((series) => series.class_id === '5-1');
assert.ok(class51);
assert.deepEqual(
  class51.points.map((point) => [point.date,point.value,point.n]),
  [
    ['2026-09-17',6,2],
    ['2026-09-18',5.67,3],
  ],
  '5-1 should use the cumulative mean of valid per-session total turns/minute',
);

const class53 = turns.find((series) => series.class_id === '5-3');
assert.ok(class53);
assert.deepEqual(
  class53.points.map((point) => [point.date,point.value,point.n]),
  [
    ['2026-09-17',null,0],
    ['2026-09-18',8,1],
  ],
  'invalid zero-duration sessions must not alter cumulative turns/minute',
);

const class52 = turns.find((series) => series.class_id === '5-2');
assert.equal(class52, undefined, 'missing AI/dialogue counts must be excluded instead of being coerced to child-only turns');

const lessonTrendSessions = [
  {
    session_id:'lesson-1', local_date:'2026-10-01', class_id:'5-1', data_quality_flag:'complete',
    dialogue_utterance_count:12, child_turn_count:6, ai_turn_count:6, actual_duration_seconds:120,
    child_total_words:20, reflection_scale_version:'4point-v1',
    reflection_understood_partner:3, reflection_conveyed_ideas:2, reflection_noticed_language_culture:3,
  },
  {
    session_id:'home-1', local_date:'2026-10-02', class_id:'5-1', data_quality_flag:'complete',
    dialogue_utterance_count:40, child_turn_count:20, ai_turn_count:20, actual_duration_seconds:120,
    child_total_words:100, reflection_scale_version:'4point-v1',
    reflection_understood_partner:4, reflection_conveyed_ideas:4, reflection_noticed_language_culture:4,
  },
  {
    session_id:'lesson-2', local_date:'2026-10-03', class_id:'5-1', data_quality_flag:'missing_reflection',
    dialogue_utterance_count:20, child_turn_count:10, ai_turn_count:10, actual_duration_seconds:120,
    child_total_words:40, reflection_scale_version:'',
    reflection_understood_partner:'', reflection_conveyed_ideas:'', reflection_noticed_language_culture:'',
  },
];
const lessonIds = new Set(['lesson-1','lesson-2']);

const lessonTurns = buildCumulativeTurnsByClass(lessonTrendSessions, lessonIds);
assert.deepEqual(
  lessonTurns[0].points.map((point) => [point.date,point.value,point.n,point.observed]),
  [
    ['2026-10-01',6,1,true],
    ['2026-10-02',6,1,false],
    ['2026-10-03',8,2,true],
  ],
  'home-use day must carry forward the previous in-lesson turn mean without changing n',
);

const lessonWords = buildCumulativeWordsByClass(lessonTrendSessions, lessonIds);
assert.deepEqual(
  lessonWords[0].points.map((point) => [point.date,point.value,point.n,point.observed]),
  [
    ['2026-10-01',10,1,true],
    ['2026-10-02',10,1,false],
    ['2026-10-03',15,2,true],
  ],
  'home-use day must not affect the cumulative in-lesson word-rate mean',
);

const lessonReflection = buildCumulativeLessonReflectionRows(lessonTrendSessions, lessonIds);
assert.deepEqual(
  lessonReflection.map((row) => [
    row.date,row.reflection_understood,row.reflection_understood_n,row.reflection_understood_observed,
  ]),
  [
    ['2026-10-01',3,1,true],
    ['2026-10-02',3,1,false],
    ['2026-10-03',3,1,false],
  ],
  'reflection trend must carry forward across home use and sessions without a valid reflection',
);
assert.equal(
  lessonReflection.find((row) => row.date === '2026-10-02')?.reflection_conveyed,
  2,
  'home reflection must not enter the lesson-only cumulative mean',
);

const dialogueEligibilitySessions = [
  {
    session_id:'eligible-complete', local_date:'2026-10-01', class_id:'5-3', data_quality_flag:'complete',
    dialogue_utterance_count:10, child_turn_count:5, ai_turn_count:5, actual_duration_seconds:60, child_total_words:10,
  },
  {
    session_id:'eligible-interrupted', local_date:'2026-10-02', class_id:'5-3', data_quality_flag:'interrupted',
    dialogue_utterance_count:8, child_turn_count:4, ai_turn_count:4, actual_duration_seconds:60, child_total_words:8,
  },
  {
    session_id:'eligible-missing-core-with-speech', local_date:'2026-10-03', class_id:'5-3', data_quality_flag:'missing_core',
    dialogue_utterance_count:6, child_turn_count:3, ai_turn_count:3, actual_duration_seconds:60, child_total_words:6,
  },
  {
    session_id:'exploratory-zero-speech', local_date:'2026-10-04', class_id:'5-3', data_quality_flag:'missing_core',
    dialogue_utterance_count:1, child_turn_count:0, ai_turn_count:1, actual_duration_seconds:60, child_total_words:0,
  },
];
const dialogueEligibilityIds = new Set(dialogueEligibilitySessions.map((row) => row.session_id));
const eligibilityTurns = buildCumulativeTurnsByClass(dialogueEligibilitySessions, dialogueEligibilityIds);
assert.deepEqual(
  eligibilityTurns[0].points.map((point) => [point.date,point.n,point.observed]),
  [
    ['2026-10-01',1,true],
    ['2026-10-02',2,true],
    ['2026-10-03',3,true],
    ['2026-10-04',3,false],
  ],
  'interrupted/missing_core sessions with child speech must remain in dialogue trends, while zero-speech exploration is excluded',
);
const eligibilityWords = buildCumulativeWordsByClass(dialogueEligibilitySessions, dialogueEligibilityIds);
assert.deepEqual(
  eligibilityWords[0].points.map((point) => [point.date,point.n,point.observed]),
  [
    ['2026-10-01',1,true],
    ['2026-10-02',2,true],
    ['2026-10-03',3,true],
    ['2026-10-04',3,false],
  ],
  'WPM trend must use the same child-speech eligibility rule as turn trend',
);

const dailyRuntimeSource = fs.readFileSync(new URL('../src/server/researchDailyClassStackRuntime.ts', import.meta.url), 'utf8');
assert.ok(
  dailyRuntimeSource.includes('var visibleTurns=Array.isArray(latestCharts.cumulativeTurnsByClass)?latestCharts.cumulativeTurnsByClass:[];'),
  'turn trend must remain full-range even when daily-session bars use a 7/14/30-day display filter',
);
assert.equal(
  dailyRuntimeSource.includes('filterSeriesByRange(latestCharts.cumulativeTurnsByClass'),
  false,
  'daily-session range control must not crop the cumulative turn trend',
);

console.log('Research daily class-stacked session + lesson-only cumulative trend chart QA passed.');
