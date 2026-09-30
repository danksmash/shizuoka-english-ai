import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  isTransientResearchDashboardReadError,
  researchDashboardEffectiveReadRange,
  researchDashboardNeedsStudySchedules,
  retryResearchDashboardRead,
} from '../src/server/researchDashboardResilientRuntime';

assert.equal(isTransientResearchDashboardReadError(new Error('FIRESTORE_LIST_503:backend unavailable')), true);
assert.equal(isTransientResearchDashboardReadError(new Error('FIRESTORE_GET_429:quota')), true);
assert.equal(isTransientResearchDashboardReadError(new Error('AbortError:This operation was aborted')), true);
assert.equal(isTransientResearchDashboardReadError(new Error('FIRESTORE_RANGE_QUERY_503:backend unavailable')), true);
assert.equal(isTransientResearchDashboardReadError(new Error('FIRESTORE_LIST_400:bad request')), false);

let transientAttempts = 0;
const recovered = await retryResearchDashboardRead('qa-transient', async () => {
  transientAttempts += 1;
  if (transientAttempts < 3) throw new Error('FIRESTORE_LIST_503:temporary');
  return 153;
});
assert.equal(recovered, 153);
assert.equal(transientAttempts, 3);

let permanentAttempts = 0;
await assert.rejects(
  retryResearchDashboardRead('qa-permanent', async () => {
    permanentAttempts += 1;
    throw new Error('FIRESTORE_LIST_400:bad request');
  }),
  /FIRESTORE_LIST_400/,
);
assert.equal(permanentAttempts, 1, 'permanent errors must not be retried');

assert.deepEqual(
  researchDashboardEffectiveReadRange({ dataScope: 'pilot_b' }),
  {
    scope: 'pilot_b', requestedStart: '', requestedEnd: '',
    start: '2026-09-09', end: '2026-09-09', inferred: true,
  },
  'Pilot B without a date must never list the entire sessions collection',
);
assert.deepEqual(
  researchDashboardEffectiveReadRange({ dataScope: 'pilot_b', start: '2026-09-09', end: '2026-09-09' }),
  {
    scope: 'pilot_b', requestedStart: '2026-09-09', requestedEnd: '2026-09-09',
    start: '2026-09-09', end: '2026-09-09', inferred: false,
  },
);
assert.deepEqual(
  researchDashboardEffectiveReadRange({ dataScope: 'main' }),
  {
    scope: 'main', requestedStart: '', requestedEnd: '',
    start: '2026-09-17', end: '', inferred: true,
  },
  'Main must start at the formal research boundary when the user asks for all main data',
);
assert.equal(researchDashboardEffectiveReadRange({ dataScope: 'main', start: '2026-09-01' }).start, '2026-09-17');
assert.equal(researchDashboardEffectiveReadRange({ dataScope: 'main', start: '2026-09-20' }).start, '2026-09-20');
assert.deepEqual(
  researchDashboardEffectiveReadRange({ dataScope: 'test' }),
  { scope: 'test', requestedStart: '', requestedEnd: '', start: '', end: '', inferred: false },
  'Test data are not bounded because valid test rows can occur throughout the study',
);
assert.equal(researchDashboardNeedsStudySchedules({ dataScope: 'main' }), true);
assert.equal(researchDashboardNeedsStudySchedules({ dataScope: 'all' }), true);
assert.equal(researchDashboardNeedsStudySchedules({ dataScope: 'pilot_b' }), false);
assert.equal(researchDashboardNeedsStudySchedules({ dataScope: 'test' }), false);
assert.equal(researchDashboardNeedsStudySchedules({ dataScope: 'reserve' }), false);

const resilientSource = fs.readFileSync('src/server/researchDashboardResilientRuntime.ts', 'utf8');
assert.ok(resilientSource.includes("warnings: ['lesson_reflections_unavailable']"), 'Reflection failure must degrade partially, not blank the dashboard');
assert.ok(resilientSource.includes('getSessionsForManagementByLocalDateRange(start, end)'), 'Dashboard session reads must be scoped by effective localDate range before expansion');
assert.ok(resilientSource.includes('getReflectionRecordsForTeacherDateRange(start, end)'), 'Lesson Reflection dashboard reads must use the effective date range');
assert.ok(resilientSource.includes('researchDashboardEffectiveReadRange(query'), 'Dashboard must compute a scope-aware read plan before Firestore access');
assert.ok(resilientSource.includes('needsSchedules ? loadStudySchedulesResilient() : Promise.resolve'), 'Non-main data scopes must not depend on Study 1 schedule reads');
assert.ok(
  resilientSource.includes('res.locals.researchDashboardSessions = analysisSessions'),
  'Phase comparison should reuse the already loaded, manual-exclusion-filtered session snapshot',
);
assert.ok(resilientSource.includes('let phaseComparison = body.phaseComparison'), 'Phase wrapper must reuse the core response instead of rebuilding Phase analytics');
assert.ok(resilientSource.includes("res.setHeader('Server-Timing'"), 'Dashboard must expose coarse server-side timing for future latency audits');
assert.ok(resilientSource.includes('effectiveStart: readPlan.start'), 'Timing log must expose the effective read boundary without personal data');
assert.ok(resilientSource.includes('schedulesRequired: needsSchedules'), 'Timing log must show whether Study 1 schedules were required');
assert.ok(resilientSource.includes("body.success === false"), 'Phase enrichment must not start secondary work for a failed core dashboard response');
assert.ok(resilientSource.includes('isManualResearchExcludedSessionId'), 'Manual research exclusions must be applied before dashboard and Phase analysis');

const firestoreSource = fs.readFileSync('src/server/firestore.ts', 'utf8');
assert.ok(firestoreSource.includes('queryCollectionByStringRange'), 'Firestore helper must support server-side localDate range reads');
assert.ok(firestoreSource.includes("}, 'FIRESTORE_RANGE_QUERY')"), 'Range-query failures must be classifiable for bounded retry');
assert.ok(firestoreSource.includes('signal: controller.signal'), 'runQuery must have an abort timeout instead of hanging until Cloud Run 504');

const questionnaireSource = fs.readFileSync('src/server/questionnaireResearch.ts', 'utf8');
assert.ok(questionnaireSource.includes('QUESTIONNAIRE_READ_CACHE_MS = 2_000'), 'Concurrent questionnaire widgets should share a very short read snapshot');
assert.ok(questionnaireSource.includes('questionnaireReadInFlight'), 'Questionnaire reads must collapse in-flight duplicates');
const questionnaireRuntime = fs.readFileSync('src/server/questionnaireDashboardRuntime.ts', 'utf8');
assert.equal(questionnaireRuntime.includes("path === '/api/management/research.dashboard'"), false, 'Questionnaire runtime must not wrap the Research Dashboard at all');
assert.equal(questionnaireRuntime.includes('questionnairePromise'), false, 'Research Dashboard must not wait for questionnaire reads after the analysis-page split');

const dashboardSource = fs.readFileSync('src/server/researchDashboard.ts', 'utf8');
const dashboardFn = dashboardSource.slice(dashboardSource.indexOf('export function buildResearchDashboardData'), dashboardSource.indexOf('undefined', dashboardSource.indexOf('export function buildResearchDashboardData')));
assert.ok(dashboardFn.includes('buildResearchDataSets(targetSessions)'), 'dashboard must build the detailed research dataset once');
assert.ok(dashboardFn.includes('buildResearchExportDataSetsFromTechnical(technical)'), 'dashboard export rows must reuse that same detailed parse');
assert.equal(dashboardFn.includes('buildResearchExportDataSets(targetSessions)'), false, 'dashboard must not reparse all dialogue history for export rows');

const auditRoute = fs.readFileSync('src/server/researchSessionAuditRoutes.ts', 'utf8');
assert.ok(auditRoute.includes("router.post('/research.session-audit'"), 'session audit must be available as an explicit lazy route');
assert.ok(resilientSource.includes('sessionAuditLazy: true'), 'dashboard response must mark session audit as lazy');
assert.equal(resilientSource.includes('buildResearchSessionAuditDetails'), false, 'session audit details must not run on the dashboard critical path');
assert.ok(resilientSource.includes('buildConsistentPhaseComparisonFromExportSessions'), 'Phase comparison must reuse prepared export session rows');

const entry = fs.readFileSync('server-entry.ts', 'utf8');
assert.ok(entry.includes('manualResearchExclusionGetHandler(path) || resilientResearchDashboardGetHandler(path) || phaseAwareGetHandler(path)'));
assert.ok(entry.includes('withResilientResearchPhaseDashboard'));
assert.equal(
  entry.includes("if (path === '/api/management/research.dashboard') {\n      handlers[handlers.length - 1] = withResearchPhaseDashboardConsistency"),
  false,
  'legacy dashboard consistency wrapper must not own the dashboard API anymore',
);

console.log('Research dashboard resilience QA: PASS');
