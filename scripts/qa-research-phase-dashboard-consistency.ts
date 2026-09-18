import assert from 'node:assert/strict';
import {
  buildConsistentPhaseComparison,
  buildPhaseDashboardErrorPayload,
  phaseDashboardDataScope,
  withResearchPhaseDashboardConsistency,
} from '../src/server/researchPhaseDashboardConsistency';
import { withResearchPhaseAnalyticsRuntime } from '../src/server/researchPhaseAnalyticsRuntime';
import { withResearchPhaseDashboardRecovery } from '../src/server/researchPhaseDashboardRecovery';
import { managementPageHtmlWithStudyPhase } from '../src/server/researchPhaseRuntime';
import type { StudyScheduleRecord } from '../src/server/studySchedulePersistence';

const start = Date.parse('2026-09-17T01:00:00.000Z');
const rawSession = {
  schemaVersion: 4,
  researchSchemaVersion: 'research-2026-v5',
  sessionId: 'qa-5-3-20260917',
  researchId: 'R-QA-53',
  studentId: 'S-QA-53',
  classId: '5-3',
  gradeLevel: 5,
  aiStudentId: 'emma_usa',
  personaId: 'emma_usa',
  topic: 'intro',
  targetDurationMinutes: 2,
  actualDurationSeconds: 120,
  startedAt: new Date(start).toISOString(),
  endedAt: new Date(start + 120_000).toISOString(),
  assignedPartnerId: 'partner-qa',
  assignedPartnerCountry: 'United States',
  assignmentAnnouncedAt: '2026-09-24T00:00:00.000Z',
  appVersion: '1.0.7',
  build: 'qa',
  history: [
    { id: 'qa-a', sender: 'ai', englishText: 'Hello! What do you like?', japaneseText: 'こんにちは。何が好きですか。', timestamp: start },
    { id: 'qa-c', sender: 'child', englishText: 'I like soccer.', japaneseText: 'サッカーが好きです。', timestamp: start + 30_000 },
  ],
  reflection: { scaleVersion: '4point-v1', conveyedIdeas: 3, understoodPartner: 3, noticedLanguageCulture: 3 },
  systemEvents: [{ type: 'session_start', timestamp: start }, { type: 'session_finish', timestamp: start + 119_000 }],
};

const schedule: StudyScheduleRecord = {
  classId: '5-3',
  revision: 1,
  appStartDate: '2026-09-17',
  nationalityRevealDate: '2026-09-24',
  videoViewDate: '2026-10-01',
  exchangeDate: '2026-10-15',
  updatedAt: '2026-09-16T00:00:00.000Z',
  updatedBy: 'qa',
  history: [],
};

const mainComparison = buildConsistentPhaseComparison(
  [rawSession] as any,
  [schedule],
  { dataScope: 'main', grade: '5', classId: '3', start: '2026-09-17', end: '2026-09-17' },
);
assert.equal(mainComparison.applicable, true);
assert.equal(mainComparison.status, 'ok');
assert.equal(mainComparison.phases[0].sessions, 1, '5-3 on 2026-09-17 must be Phase 1');
assert.equal(mainComparison.phases[1].sessions, 0);

const allComparison = buildConsistentPhaseComparison([rawSession] as any, [schedule], { dataScope: 'all' });
assert.equal(allComparison.applicable, true, 'dataScope=all must keep Phase comparison applicable');
assert.equal(allComparison.status, 'ok');
assert.equal(allComparison.phases[0].sessions, 1);

const missingSchedule: StudyScheduleRecord = {
  ...schedule,
  revision: 0,
  appStartDate: '',
  nationalityRevealDate: '',
  videoViewDate: '',
  exchangeDate: '',
};
const missingComparison = buildConsistentPhaseComparison([rawSession] as any, [missingSchedule], { dataScope: 'main' });
assert.equal(missingComparison.applicable, true, 'main remains applicable even when schedule is missing');
assert.equal(missingComparison.status, 'schedule_missing');
assert.ok(missingComparison.reason.includes('日程未設定'));
assert.deepEqual(missingComparison.missingScheduleClassIds, ['5-3']);

const excludedComparison = buildConsistentPhaseComparison([rawSession] as any, [schedule], { dataScope: 'test' });
assert.equal(excludedComparison.applicable, false);
assert.equal(excludedComparison.status, 'not_applicable');

assert.equal(phaseDashboardDataScope({ dataScope: ['MAIN'] }), 'main');
const errorPayload = buildPhaseDashboardErrorPayload({ dataScope: 'main' });
assert.equal(errorPayload.applicable, true);
assert.equal(errorPayload.status, 'error');
assert.ok(errorPayload.reason.includes('取得できません'));

let html = '';
const baseHandler = ((_req: any, res: any) => res.send(managementPageHtmlWithStudyPhase())) as any;
const analyticsHandler = withResearchPhaseAnalyticsRuntime('/management', baseHandler);
const recoveryHandler = withResearchPhaseDashboardRecovery('/management', analyticsHandler);
const consistencyHandler = withResearchPhaseDashboardConsistency('/management', recoveryHandler);
const res: any = { send(body: any) { html = String(body); return body; } };
consistencyHandler({} as any, res, (() => {}) as any);

assert.ok(html.includes('researchPhaseDashboardConsistencyPatch'));
assert.ok(html.includes("window.__renderPhaseComparison=renderPhaseComparison"));
assert.ok(html.includes("window.__renderPhaseComparison=renderPhaseComparison"),'Phase renderer must be registered once in the injected analytics UI');
assert.ok(html.includes("window.__renderPhaseComparison(d)"),'base dashboard renderer must hand the successful payload directly to Phase rendering');
assert.equal(html.includes("fetch('/api/management/research.dashboard?'+phaseParams().toString()"), false, 'Phase UI must not issue a second dashboard request');
assert.ok(html.includes("v!=='all'||id==='dataScope'"), 'dataScope=all must be sent explicitly');
assert.ok(html.includes("status==='schedule_missing'"));
assert.ok(html.includes("box.textContent='日程未設定'"));
assert.ok(html.includes("box.textContent='取得失敗'"));
assert.ok(html.includes("box.textContent='対象外'"));

console.log('Research Phase dashboard consistency QA: PASS');
