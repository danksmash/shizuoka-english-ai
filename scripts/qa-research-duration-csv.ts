import assert from 'node:assert/strict';
import { auditDurationCsv, parseSessionCsv } from './audit-research-duration-csv-core';

const input = '\uFEFFsession_id,class_id,local_date,actual_duration_seconds,target_duration_minutes,child_total_words,child_turn_count,dialogue_utterance_count,lesson_context_inferred,topic\r\n'
+ 's1,5-3,2026-10-07,120,2,40,4,8,in_lesson,"favorites, food"\r\n'
+ 's2,5-3,2026-10-07,3600,2,26,3,6,outside_lesson,intro\r\n'
+ 's3,5-1,2026-10-08,60,1,30,3,6,in_lesson,"note ""quoted"""\r\n';
const rows=parseSessionCsv(input);
assert.equal(rows.length,3);
assert.equal(rows[0].topic,'favorites, food');
assert.equal(rows[2].topic,'note "quoted"');
const result = auditDurationCsv(input);
assert.equal(result.totalRows,3);
assert.equal(result.quality.invalid,1);
assert.equal(result.quality.capped3600,1);
assert.equal(result.quality.valid,2);
assert.equal(result.overall.before.durationUsable,3);
assert.equal(result.overall.after.durationUsable,2);
assert.equal(result.overall.after.meanWpm,25);
assert.equal(result.overall.after.pooledWpm,23.33);
assert.equal(result.lessonOnly.after.durationUsable,2);
assert.equal(result.byClass.find((c)=>c.classId==='5-3')?.invalid,1);
assert.equal(result.byDate.find((c)=>c.date==='2026-10-07')?.invalid,1);
assert.equal(result.duplicateSessionIds,0);
assert.throws(()=>parseSessionCsv('foo,bar\na,b'),/MISSING_CSV_COLUMNS/);
console.log('Read-only research duration CSV audit QA PASS');
