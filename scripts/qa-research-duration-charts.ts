import assert from 'node:assert/strict';
import { buildCumulativeWordsByClass } from '../src/server/researchWordsByClassRuntime';
import { buildCumulativeTurnsByClass } from '../src/server/researchDailyClassStackRuntime';

const sessions = [
  {session_id:'normal',class_id:'5-3',school_condition:'intervention',local_date:'2026-10-07',data_quality_flag:'complete',
    target_duration_minutes:2,actual_duration_seconds:120,child_total_words:40,child_turn_count:4,dialogue_utterance_count:8},
  {session_id:'capped',class_id:'5-3',school_condition:'intervention',local_date:'2026-10-07',data_quality_flag:'missing_reflection',
    target_duration_minutes:2,actual_duration_seconds:3600,child_total_words:26,child_turn_count:3,dialogue_utterance_count:6},
  {session_id:'active',class_id:'5-3',school_condition:'intervention',local_date:'2026-10-08',data_quality_flag:'interrupted',
    target_duration_minutes:2,actual_duration_seconds:90,duration_quality:'valid',child_total_words:15,child_turn_count:2,dialogue_utterance_count:4},
];
const allIds = new Set(sessions.map((x)=>x.session_id));
const words = buildCumulativeWordsByClass(sessions, allIds);
const turns = buildCumulativeTurnsByClass(sessions, allIds);
assert.equal(words.length,1);
assert.equal(turns.length,1);
assert.deepEqual(words[0].points.map((x)=>({value:x.value,n:x.n})),[{value:20,n:1},{value:15,n:2}]);
assert.deepEqual(turns[0].points.map((x)=>({value:x.value,n:x.n})),[{value:4,n:1},{value:3.33,n:2}]);
console.log('Research capped-duration chart regression QA PASS');
