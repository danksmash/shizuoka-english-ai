import assert from 'node:assert/strict';
import {
  buildCumulativeTurnsByClass,
  buildDailyClassStackRows,
  researchClassLabel,
} from '../src/server/researchDailyClassStackRuntime';

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

console.log('Research daily class-stacked session + cumulative turns/min chart QA passed.');
