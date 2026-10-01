import assert from 'node:assert/strict';
import {
  enhanceRecentSessionWordCounts,
  injectRecentSessionWordCountManagementHtml,
} from '../src/server/researchRecentSessionWordCountRuntime';

const dashboard = {
  metrics: {
    latestAt: '2026-10-01 20:05:07',
  },
  recentSessions: [
    { session_id: 'S1', local_started_at: '2026-10-01 19:55:07', data_quality_flag: 'complete' },
    { session_id: 'S2', local_started_at: '2026-10-01 19:50:00', data_quality_flag: 'missing_core' },
    { session_id: 'S3', local_started_at: '2026-10-01 19:45:00', data_quality_flag: 'interrupted' },
    { session_id: 'S4', local_started_at: '2026-10-01 19:40:00', data_quality_flag: 'complete' },
    { session_id: 'S5', local_started_at: '2026-10-01 19:35:00', data_quality_flag: 'complete' },
  ],
};

const exportSessions = [
  { session_id: 'S1', local_started_at: '2026-10-01 19:55:07', local_ended_at: '2026-10-01 20:00:07', child_total_words: 37, data_quality_flag: 'complete' },
  { session_id: 'S2', local_started_at: '2026-10-01 19:50:00', local_ended_at: '2026-10-01 19:52:00', child_total_words: 0, data_quality_flag: 'missing_core' },
  { session_id: 'S3', local_started_at: '2026-10-01 19:45:00', local_ended_at: '2026-10-01 19:46:10', child_total_words: 0, data_quality_flag: 'interrupted' },
  { session_id: 'S4', local_started_at: '2026-10-01 19:40:00', local_ended_at: '2026-10-01 19:42:00', child_total_words: '18', data_quality_flag: 'complete' },
  { session_id: 'S5', local_started_at: '2026-10-01 20:05:07', local_ended_at: '', child_total_words: '', data_quality_flag: 'complete' },
];

const enhanced = enhanceRecentSessionWordCounts(dashboard, exportSessions);
assert.equal(enhanced.recentSessions[0].child_total_words, 37);
assert.equal(enhanced.recentSessions[1].child_total_words, null);
assert.equal(enhanced.recentSessions[2].child_total_words, 0);
assert.equal(enhanced.recentSessions[3].child_total_words, 18);
assert.equal(enhanced.recentSessions[4].child_total_words, null);
assert.equal(enhanced.recentSessions[0].data_quality_flag, 'complete');
assert.equal(enhanced.recentSessions[1].data_quality_flag, 'missing_core');
assert.deepEqual(enhanced.recentSessions.map((row: any) => row.session_id), ['S1','S2','S3','S4','S5']);
assert.equal(enhanced.metrics.latestAt, '2026-10-01 20:00:07');

const noEndedDashboard = enhanceRecentSessionWordCounts(
  { metrics: { latestAt: '2026-10-01 20:05:07' }, recentSessions: [{ session_id: 'S6' }] },
  [{ session_id: 'S6', local_started_at: '2026-10-01 20:05:07', local_ended_at: '', child_total_words: 3, data_quality_flag: 'complete' }],
);
assert.equal(noEndedDashboard.metrics.latestAt, '');

const html = '<html><body><div class="metrics"><div class="card metric"><span>最終セッション日時</span><b id="mLatest">-</b></div></div><div class="recent-card"><table class="recent"><thead><tr><th>日時</th><th>research_id</th><th>Persona</th><th>テーマ</th><th>時間</th><th>品質</th></tr></thead><tbody id="recentRows"></tbody></table></div></body></html>';
const injected = injectRecentSessionWordCountManagementHtml(html);
assert.match(injected, /id="recentSessionWordCountRuntime"/);
assert.match(injected, /最終セッション終了日時/);
assert.match(injected, /<th>開始日時<\/th>/);
assert.match(injected, /発話語数/);
assert.match(injected, /child_total_words/);
assert.doesNotMatch(injected, />最終セッション日時</);
assert.doesNotMatch(injected, /<th>日時<\/th>/);
assert.equal(injectRecentSessionWordCountManagementHtml(injected), injected);

console.log('qa-research-recent-session-words: PASS');
