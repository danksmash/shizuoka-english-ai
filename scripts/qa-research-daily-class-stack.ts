import assert from 'node:assert/strict';
import {
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

console.log('Research daily class-stacked session chart QA passed.');
