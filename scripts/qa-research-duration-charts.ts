import assert from 'node:assert/strict';
import { buildResearchDashboardData } from '../src/server/researchDashboard';
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
const started = Date.parse('2026-10-06T04:35:04Z');
const mkRaw = (sessionId: string, seconds: number, childWords: number, childTurns: number) => ({
  sessionId, researchId: 'RTEST001', studentId: 'STEST001', classId: '5-3',
  schoolCondition: 'intervention', formalStudyParticipant: true, studyStartDate: '2026-09-17',
  aiStudentId: 'emma_usa', personaId: 'emma_usa', topic: 'intro',
  targetDurationMinutes: childTurns > 0 ? 2 : 1,
  actualDurationSeconds: seconds, totalChildWords: childWords, totalTurns: childTurns,
  startedAt: new Date(started).toISOString(), endedAt: new Date(started + seconds * 1000).toISOString(),
  schemaVersion: 4,
  history: childTurns > 0 ? [
    {id:'ai-start',sender:'ai',englishText:'Hello.',timestamp:started},
    {id:'child-start',sender:'child',englishText:'I like apples.',timestamp:started+10_000},
  ] : [{id:'ai-start',sender:'ai',englishText:'Hello.',timestamp:started}],
  systemEvents: [{type:'session_start',timestamp:started},{type:'session_finish',timestamp:started+seconds*1000,value:'timer'}],
});
const pooled = buildResearchDashboardData([
  mkRaw('normal-duration', 120, 40, 4),
  mkRaw('zero-speech-capped-duration', 3600, 0, 0),
], {dataScope: 'main', schoolCondition: 'all'});
assert.equal(pooled.metrics.totalSessions, 2);
assert.equal(pooled.charts.daily[0].mean_child_words_per_minute, 20,
  'AI-only 3600-second cap must not dilute pooled WPM');
assert.equal(pooled.charts.daily[0].sessions, 2,
  'exclude invalid duration from rate denominators, not session counts');

console.log('Research capped-duration chart regression QA PASS');
