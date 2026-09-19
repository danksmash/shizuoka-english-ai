import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildResearchSessionHistoryDetail,
  buildResearchSessionHistorySummary,
  injectResearchSessionHistoryManagementHtml,
} from '../src/server/researchSessionHistoryRuntime';
import { managementPageHtml } from '../src/server/managementPage';

const base = {
  schemaVersion: 4,
  sessionId: 'session-qa-001',
  studentId: 'SECRET-STUDENT',
  learningId: 'SECRET-CODE',
  researchId: 'R-ABCDEFGHJKLM',
  classId: '5-3',
  gradeLevel: 5,
  aiStudentId: 'emma_usa',
  personaId: 'emma_usa',
  topic: 'favorites',
  targetDurationMinutes: 2,
  actualDurationSeconds: 119,
  totalTurns: 4,
  totalChildWords: 5,
  lifetimeSessionNumber: 3,
  startedAt: '2026-09-18T06:00:00.000Z',
  endedAt: '2026-09-18T06:01:59.000Z',
  localDate: '2026-09-18',
  history: [
    { id: 'a1', sender: 'ai', englishText: 'What do you like?', japaneseText: '何が好きですか。', timestamp: 1 },
    { id: 'c1', sender: 'child', englishText: 'I like soccer.', japaneseText: 'サッカーが好きです。', timestamp: 2 },
  ],
  reflection: { scaleVersion: '4point-v1', conveyedIdeas: 3, understoodPartner: 4, noticedLanguageCulture: 3 },
  systemEvents: [{ type: 'session_finish', value: '', timestamp: 3 }],
};

const summary = buildResearchSessionHistorySummary(base);
assert.equal(summary.session_id, 'session-qa-001');
assert.equal(summary.research_id, 'R-ABCDEFGHJKLM');
assert.equal(summary.persona_name, 'Emma Johnson');
assert.equal(summary.topic_label, '好きなもの・すきなこと');
assert.equal(summary.data_quality_flag, 'complete');
assert.equal('studentId' in summary, false);
assert.equal('learningId' in summary, false);

const detail = buildResearchSessionHistoryDetail(base);
assert.equal(detail.transcript.length, 2);
assert.equal(detail.transcript[1].english_text, 'I like soccer.');
assert.equal(detail.reflection?.understood_partner, 4);
assert.equal('studentId' in detail, false);
assert.equal('learningId' in detail, false);
assert.equal(JSON.stringify(detail).includes('SECRET-STUDENT'), false);
assert.equal(JSON.stringify(detail).includes('SECRET-CODE'), false);

const html = injectResearchSessionHistoryManagementHtml(managementPageHtml());
assert.ok(html.includes('researchSessionHistoryScript'));
assert.ok(html.includes('rshRecentSearch'));
assert.ok(html.includes('rshOpenSearchBtn'));
assert.ok(html.includes('履歴を開く'));
assert.ok(html.includes("e.key==='Enter'"));
assert.ok(html.includes("openHistory(upper,'')"), 'exact research_id search must open full history even when it is outside the recent 50 rows');
assert.ok(html.includes('全セッション一覧'));
assert.ok(html.includes("api('research.session-history'"));
assert.ok(html.includes("api('research.session-detail'"));
assert.ok(html.includes("api('research.sessions'"));
assert.ok(html.includes('さらに50件'));
assert.ok(html.includes('detailCache=new Map()'), 'session detail should be cached in the browser after first load');
assert.ok(html.includes('.analysis-session-layout .recent-card .table-wrap'),'E-layout recent-session column must expand vertically');
assert.ok(html.includes('min-height:620px'),'desktop E-layout must expose a useful vertical session list');
assert.ok(html.includes('@media(max-width:1240px)'),'recent-session explorer must fall back cleanly when the two-column workspace collapses');

const dashboardSource = fs.readFileSync('src/server/researchDashboard.ts', 'utf8');
assert.ok(dashboardSource.includes('.slice(0,50)'), 'recent anonymized sessions must expose up to 50 rows');
assert.ok(dashboardSource.includes('session_id:row.session_id'), 'recent rows need session_id for direct detail opening');

const authSource = fs.readFileSync('src/server/auth.ts', 'utf8');
for (const route of ['research.sessions','research.session-history','research.session-detail']) {
  assert.ok(authSource.includes(route), route + ' must be explicitly permitted for researcher auth');
}

const entry = fs.readFileSync('server-entry.ts', 'utf8');
assert.ok(entry.includes('createResearchSessionHistoryRouter'));
assert.ok(entry.includes('withResearchSessionHistoryManagementPage'));
assert.ok(entry.includes("this.use('/api/management', createResearchSessionHistoryRouter())"));

console.log('Research session history explorer QA: PASS');
