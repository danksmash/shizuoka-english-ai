import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildResearchSessionAudit } from '../src/server/researchSessionAudit';
import { buildResearchSessionAuditDetails } from '../src/server/researchSessionAuditDetails';
import { injectResearchSessionAuditManagementHtml } from '../src/server/researchSessionAuditManagementRuntime';

const BASE = Date.parse('2026-09-17T02:00:00.000Z');

function ai(id: string, at: number, text = 'Hello!') {
  return { id, sender: 'ai', englishText: text, japaneseText: 'こんにちは', timestamp: at };
}
function child(id: string, at: number, text: string) {
  return { id, sender: 'child', englishText: text, japaneseText: '', timestamp: at };
}
function completeSession(args: {
  sessionId: string;
  researchId?: string;
  start: number;
  end: number;
  history?: any[];
  createdAt?: number;
}) {
  return {
    schemaVersion: 4,
    sessionId: args.sessionId,
    researchId: args.researchId || 'R-TEST',
    studentId: 'MUST_NOT_LEAK',
    learningId: 'MUST_NOT_LEAK',
    startedAt: new Date(args.start).toISOString(),
    endedAt: new Date(args.end).toISOString(),
    createdAt: new Date(args.createdAt || args.start).toISOString(),
    aiStudentId: 'oliver_uk',
    personaId: 'oliver_uk',
    topic: 'intro',
    targetDurationMinutes: 2,
    history: args.history || [
      ai(`ai-${args.sessionId}`, args.start, 'Hello!'),
      child(`child-${args.sessionId}`, args.start + 10_000, 'Hello. I like soccer.'),
      ai(`reply-${args.sessionId}`, args.start + 12_000, 'Nice! I like soccer too.'),
    ],
    reflection: { scaleVersion: '4point-v1', conveyedIdeas: 3, understoodPartner: 3, noticedLanguageCulture: 3 },
    systemEvents: [{ type: 'session_finish', timestamp: args.end }],
    actualDurationSeconds: Math.round((args.end - args.start) / 1000),
    totalChildWords: 5,
  };
}

// 1) Start-only record followed immediately by a valid session must remain raw,
// but the start-only row must not enter the primary research analysis.
{
  const zero = {
    schemaVersion: 4,
    sessionId: 'session_zero_0001',
    researchId: 'R-RESTART',
    startedAt: new Date(BASE).toISOString(),
    endedAt: new Date(BASE).toISOString(),
    createdAt: new Date(BASE).toISOString(),
    aiStudentId: 'oliver_uk', personaId: 'oliver_uk', topic: 'intro', targetDurationMinutes: 2,
    history: [ai('ai-start-zero', BASE)], reflection: null, systemEvents: [{ type: 'session_start', timestamp: BASE }],
    actualDurationSeconds: 0,
  };
  const valid = completeSession({ sessionId: 'session_valid_0002', researchId: 'R-RESTART', start: BASE + 2_000, end: BASE + 122_000 });
  const result = buildResearchSessionAudit([zero, valid]);
  assert.equal(result.summary.zero_child_near_valid_pairs, 1);
  const zeroRow = result.rows.find((row) => row.session_id === zero.sessionId)!;
  const validRow = result.rows.find((row) => row.session_id === valid.sessionId)!;
  assert.equal(zeroRow.data_quality_flag, 'missing_core');
  assert.equal(zeroRow.audit_status, 'intentional_restart_or_shadow_candidate');
  assert.equal(zeroRow.analysis_include_primary, 0);
  assert.equal(validRow.data_quality_flag, 'complete');
  assert.equal(validRow.analysis_include_primary, 1);
  assert.equal(validRow.analysis_include_strict, 1);
}

// 2) Two genuinely separate complete sessions with different logs and no time overlap
// are both valid research sessions even for the same research_id.
{
  const a = completeSession({ sessionId: 'session_seq_a', researchId: 'R-SEQUENTIAL', start: BASE, end: BASE + 120_000 });
  const b = completeSession({ sessionId: 'session_seq_b', researchId: 'R-SEQUENTIAL', start: BASE + 121_000, end: BASE + 241_000 });
  const result = buildResearchSessionAudit([a, b]);
  assert.equal(result.summary.overlapping_complete_pairs, 0);
  assert.equal(result.summary.exact_duplicate_shadow_sessions, 0);
  assert.equal(result.summary.primary_include_sessions, 2);
  assert.equal(result.summary.strict_include_sessions, 2);
}

// 3) Distinct complete logs that physically overlap are not auto-deleted,
// but are held out of the strict analysis until reviewed.
{
  const a = completeSession({ sessionId: 'session_overlap_a', researchId: 'R-OVERLAP', start: BASE, end: BASE + 120_000 });
  const b = completeSession({ sessionId: 'session_overlap_b', researchId: 'R-OVERLAP', start: BASE + 4_000, end: BASE + 124_000 });
  const result = buildResearchSessionAudit([a, b]);
  assert.equal(result.summary.overlapping_complete_pairs, 1);
  assert.equal(result.summary.requires_review_sessions, 2);
  assert.equal(result.summary.primary_include_sessions, 2);
  assert.equal(result.summary.strict_include_sessions, 0);
  assert.ok(result.rows.every((row) => row.audit_status === 'overlapping_complete_conflict'));

  const details = buildResearchSessionAuditDetails([a, b], result);
  assert.equal(details.pair_count, 1);
  assert.equal(details.pairs[0].pair_kind, 'overlapping_complete');
  assert.equal(details.pairs[0].session_a.transcript.length, 3);
  assert.equal(details.pairs[0].session_b.transcript[1].sender, 'child');
  assert.equal(details.pairs[0].session_a.analysis_include_primary, 1);
  assert.equal(details.pairs[0].session_a.analysis_include_strict, 0);
  const serialized = JSON.stringify(details);
  assert.doesNotMatch(serialized, /MUST_NOT_LEAK/);
  assert.doesNotMatch(serialized, /studentId|learningId/);
}

// 4) A byte-for-byte identical dialogue identity copied under another session_id
// is treated as a duplicate shadow. Raw data remains intact; only one enters analysis.
{
  const sharedHistory = [
    ai('shared-ai', BASE, 'Hello!'),
    child('shared-child', BASE + 10_000, 'Hello. I like soccer.'),
    ai('shared-reply', BASE + 12_000, 'Nice! I like soccer too.'),
  ];
  const a = completeSession({ sessionId: 'session_dup_a', researchId: 'R-DUP', start: BASE, end: BASE + 120_000, history: sharedHistory, createdAt: BASE });
  const b = completeSession({ sessionId: 'session_dup_b', researchId: 'R-DUP', start: BASE, end: BASE + 120_000, history: sharedHistory, createdAt: BASE + 1_000 });
  const result = buildResearchSessionAudit([a, b]);
  assert.equal(result.summary.exact_duplicate_shadow_sessions, 1);
  assert.equal(result.summary.primary_include_sessions, 1);
  assert.equal(result.summary.strict_include_sessions, 1);
  assert.equal(result.rows.filter((row) => row.audit_status === 'duplicate_start_shadow').length, 1);
}

// 5) The setup screen must use a synchronous ref lock so a double click cannot create
// two session IDs before React has re-rendered the disabled state.
{
  const source = fs.readFileSync(new URL('../src/components/SetupScreen.tsx', import.meta.url), 'utf8');
  assert.match(source, /const startLockRef = useRef\(false\)/);
  assert.match(source, /if \(startLockRef\.current\) return;/);
  assert.match(source, /startLockRef\.current = true;/);
  assert.match(source, /startLockRef\.current = false;\s*\n\s*setCodeError/);
}

// 6) The researcher management page must receive the expandable audit comparison UI
// without changing the large baseline managementPage template.
{
  const baseHtml = '<html><head><title>x</title></head><body><div id="quality"></div><script>function renderDashboard(){}</script></body></html>';
  const injected = injectResearchSessionAuditManagementHtml(baseHtml);
  assert.match(injected, /sessionAuditDetailStyle/);
  assert.match(injected, /sessionAuditDetailScript/);
  assert.match(injected, /セッション監査詳細/);
  assert.match(injected, /overlapping_complete/);
  assert.match(injected, /window\.renderDashboard/);
  assert.equal(injectResearchSessionAuditManagementHtml(injected), injected);

  const entrySource = fs.readFileSync(new URL('../server-entry.ts', import.meta.url), 'utf8');
  assert.match(entrySource, /withResearchSessionAuditManagementPage/);
  const dashboardSource = fs.readFileSync(new URL('../src/server/researchDashboardResilientRuntime.ts', import.meta.url), 'utf8');
  assert.match(dashboardSource, /sessionAuditDetails/);
  assert.match(dashboardSource, /buildResearchSessionAuditDetails/);
}

console.log('Research session audit QA passed.');
