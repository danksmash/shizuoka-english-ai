import assert from 'node:assert/strict';
import {
  enhanceRecentSessionWordCounts,
  injectRecentSessionWordCountManagementHtml,
} from '../src/server/researchRecentSessionWordCountRuntime';

const dashboard = {
  recentSessions: [
    { session_id: 'S1', data_quality_flag: 'complete' },
    { session_id: 'S2', data_quality_flag: 'missing_core' },
    { session_id: 'S3', data_quality_flag: 'interrupted' },
    { session_id: 'S4', data_quality_flag: 'complete' },
  ],
};

const exportSessions = [
  { session_id: 'S1', child_total_words: 37, data_quality_flag: 'complete' },
  { session_id: 'S2', child_total_words: 0, data_quality_flag: 'missing_core' },
  { session_id: 'S3', child_total_words: 0, data_quality_flag: 'interrupted' },
  { session_id: 'S4', child_total_words: '18', data_quality_flag: 'complete' },
];

const enhanced = enhanceRecentSessionWordCounts(dashboard, exportSessions);
assert.equal(enhanced.recentSessions[0].child_total_words, 37);
assert.equal(enhanced.recentSessions[1].child_total_words, null);
assert.equal(enhanced.recentSessions[2].child_total_words, 0);
assert.equal(enhanced.recentSessions[3].child_total_words, 18);
assert.equal(enhanced.recentSessions[0].data_quality_flag, 'complete');
assert.equal(enhanced.recentSessions[1].data_quality_flag, 'missing_core');

const html = '<html><body><div class="recent-card"><table class="recent"><thead><tr><th>日時</th><th>research_id</th><th>Persona</th><th>テーマ</th><th>時間</th><th>品質</th></tr></thead><tbody id="recentRows"></tbody></table></div></body></html>';
const injected = injectRecentSessionWordCountManagementHtml(html);
assert.match(injected, /id="recentSessionWordCountRuntime"/);
assert.match(injected, /発話語数/);
assert.match(injected, /child_total_words/);
assert.equal(injectRecentSessionWordCountManagementHtml(injected), injected);

console.log('qa-research-recent-session-words: PASS');
