import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  isTransientResearchDashboardReadError,
  readResearchDashboardSessionsWithFallback,
  researchDashboardReadPlan,
  retryResearchDashboardRead,
} from '../src/server/researchDashboardResilientRuntime';
import { buildResearchDashboardData, buildResearchDashboardSessionRows } from '../src/server/researchDashboard';
import { researcherRouteAllowed } from '../src/server/auth';

const aggregateOnlySession:any = {
  sessionId:'aggregate-only',researchId:'R-AGG',studentId:'S-AGG',classId:'5-1',aiStudentId:'emma_usa',personaId:'emma_usa',
  topic:'favorites',targetDurationMinutes:2,actualDurationSeconds:60,totalTurns:2,totalChildWords:12,
  startedAt:'2026-09-17T01:00:00.000Z',endedAt:'2026-09-17T01:01:00.000Z',localDate:'2026-09-17',
  reflection:{scaleVersion:'4point-v1',understoodPartner:4,conveyedIdeas:3,noticedLanguageCulture:4},
};
Object.defineProperty(aggregateOnlySession,'history',{get(){throw new Error('dashboard touched history')}});
Object.defineProperty(aggregateOnlySession,'systemEvents',{get(){throw new Error('dashboard touched systemEvents')}});
const aggregateDashboard:any = buildResearchDashboardData([aggregateOnlySession],{dataScope:'main'});
assert.equal(aggregateDashboard.metrics.totalSessions,1);
assert.equal(aggregateDashboard.metrics.childUtteranceCount,2);
assert.equal(aggregateDashboard.metrics.meanChildWordsPerMinute,12);

const clusteredLessonSessions:any[] = Array.from({ length: 15 }, (_value, index) => ({
  ...aggregateOnlySession,
  sessionId:`lesson-cluster-${index + 1}`,
  researchId:`R-LESSON-${index + 1}`,
  startedAt:new Date(Date.parse('2026-10-01T01:00:00.000Z') + index * 20_000).toISOString(),
  endedAt:new Date(Date.parse('2026-10-01T01:01:00.000Z') + index * 20_000).toISOString(),
  localDate:'2026-10-01',
}));
const homeSession:any = {
  ...aggregateOnlySession,
  sessionId:'home-later',
  researchId:'R-HOME',
  startedAt:'2026-10-01T04:00:00.000Z',
  endedAt:'2026-10-01T04:01:00.000Z',
  localDate:'2026-10-01',
};
const lessonContextRows = buildResearchDashboardSessionRows([...clusteredLessonSessions, homeSession]);
assert.equal(
  lessonContextRows.find((row) => row.session_id === 'lesson-cluster-1')?.lesson_context_inferred,
  'in_lesson',
  '15 unique same-class participants inside 10 minutes must be inferred as in_lesson',
);
assert.equal(
  lessonContextRows.find((row) => row.session_id === 'lesson-cluster-1')?.same_class_unique_participants_10min,
  15,
  'dashboard must expose the same unique-participant count used by formal research export',
);
assert.equal(
  lessonContextRows.find((row) => row.session_id === 'lesson-cluster-1')?.lesson_context_rule_version,
  'lesson-context-2026-v2',
);
assert.equal(
  lessonContextRows.find((row) => row.session_id === 'home-later')?.lesson_context_inferred,
  'outside_lesson',
  'same-day individual home use after the 45-minute lesson window must remain outside_lesson',
);

const fourteenOnly = buildResearchDashboardSessionRows(clusteredLessonSessions.slice(0,14));
assert.ok(
  fourteenOnly.every((row) => row.lesson_context_inferred === 'outside_lesson'),
  '14 unique children must not be enough to infer a lesson',
);

assert.equal(isTransientResearchDashboardReadError(new Error('FIRESTORE_LIST_503:backend unavailable')), true);
assert.equal(isTransientResearchDashboardReadError(new Error('FIRESTORE_GET_429:quota')), true);
assert.equal(isTransientResearchDashboardReadError(new Error('AbortError:This operation was aborted')), true);
assert.equal(isTransientResearchDashboardReadError(new Error('FIRESTORE_RANGE_QUERY_503:backend unavailable')), true);
assert.equal(isTransientResearchDashboardReadError(new Error('FIRESTORE_PROJECTED_RANGE_QUERY_503:backend unavailable')), true);
assert.equal(isTransientResearchDashboardReadError(new Error('FIRESTORE_LIST_400:bad request')), false);

const mainPlan = researchDashboardReadPlan({ dataScope: 'main', schoolCondition: 'intervention' });
assert.equal(mainPlan.start, undefined, 'main without dates must preserve full-period reading');
assert.equal(mainPlan.end, undefined, 'main without dates must preserve full-period reading');
assert.equal(mainPlan.loadStudySchedules, true, 'intervention main still needs Study 1 schedules for Phase analysis');
assert.equal(mainPlan.derivedPilotBRange, false);

const comparisonPlan = researchDashboardReadPlan({ dataScope: 'main', schoolCondition: 'comparison' });
assert.equal(comparisonPlan.loadStudySchedules, false, 'comparison dashboard must not depend on Study 1 schedule reads because Phase is not applicable');

const pilotPlan = researchDashboardReadPlan({ dataScope: 'pilot_b' });
assert.equal(pilotPlan.start, '2026-09-09', 'Pilot B without explicit dates must read only the official Pilot B date');
assert.equal(pilotPlan.end, '2026-09-09', 'Pilot B without explicit dates must read only the official Pilot B date');
assert.equal(pilotPlan.loadStudySchedules, false, 'Pilot B must not depend on Study 1 schedules');
assert.equal(pilotPlan.derivedPilotBRange, true);

const explicitPilotPlan = researchDashboardReadPlan({ dataScope: 'pilot_b', start: '2026-09-08' });
assert.equal(explicitPilotPlan.start, '2026-09-08', 'an explicit Pilot B date boundary must keep the user request');
assert.equal(explicitPilotPlan.end, undefined);
assert.equal(explicitPilotPlan.derivedPilotBRange, false);
assert.equal(explicitPilotPlan.loadStudySchedules, false);

const testPlan = researchDashboardReadPlan({ dataScope: 'test' });
assert.equal(testPlan.start, undefined, 'test data are not safely reducible to one fixed date');
assert.equal(testPlan.end, undefined, 'test data are not safely reducible to one fixed date');
assert.equal(testPlan.loadStudySchedules, false, 'test data must not depend on Study 1 schedules');

const reservePlan = researchDashboardReadPlan({ dataScope: 'reserve' });
assert.equal(reservePlan.loadStudySchedules, false, 'reserve data must not depend on Study 1 schedules');

const allPlan = researchDashboardReadPlan({ dataScope: 'all', schoolCondition: 'all' });
assert.equal(allPlan.start, undefined, 'all must preserve full-period reading');
assert.equal(allPlan.end, undefined, 'all must preserve full-period reading');
assert.equal(allPlan.loadStudySchedules, true, 'all includes main intervention data and therefore still needs Phase schedules');

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


let canonicalShouldNotRun = 0;
const aggregatePreferred = await readResearchDashboardSessionsWithFallback(undefined, undefined, {
  aggregate: async () => [aggregateOnlySession],
  canonical: async () => { canonicalShouldNotRun += 1; return []; },
});
assert.equal(aggregatePreferred.source, 'daily_aggregate');
assert.equal(aggregatePreferred.sessions.length, 1);
assert.equal(canonicalShouldNotRun, 0, 'healthy aggregate data must avoid canonical session expansion');

const pendingFallback = await readResearchDashboardSessionsWithFallback(undefined, undefined, {
  aggregate: async () => { throw new Error('RESEARCH_DAILY_AGGREGATE_PENDING_SESSIONS'); },
  canonical: async () => [aggregateOnlySession],
});
assert.equal(pendingFallback.source, 'canonical_fallback');
assert.equal(pendingFallback.sessions.length, 1);
assert.match(pendingFallback.aggregateError, /PENDING_SESSIONS/);

const emptyFallback = await readResearchDashboardSessionsWithFallback('2099-01-01', '2099-01-01', {
  aggregate: async () => [],
  canonical: async () => [],
});
assert.equal(emptyFallback.source, 'canonical_fallback');
assert.equal(emptyFallback.aggregateError, 'empty_aggregate');

const resilientSource = fs.readFileSync('src/server/researchDashboardResilientRuntime.ts', 'utf8');
assert.ok(resilientSource.includes("warnings: ['lesson_reflections_unavailable']"), 'Reflection failure must degrade partially, not blank the dashboard');
assert.ok(resilientSource.includes("warnings: ['lesson_context_overrides_unavailable']"), 'Lesson-context override failure must fall back to inferred context without blanking the dashboard');
assert.ok(resilientSource.includes('getAllAnalysisSessionOverrides'), 'Lesson-only trend charts must honor formal lesson-context overrides');
assert.ok(resilientSource.includes('manuallyExcluded'), 'Lesson-only trend charts must honor explicit analysisIncluded=false overrides');
assert.ok(resilientSource.includes('analysisIncluded'), 'Manual analysis inclusion decisions must be visible to lesson-chart gating');
assert.ok(resilientSource.includes('researchDashboardLessonSessionIds'), 'Dashboard wrappers must share one final in-lesson session set');
assert.ok(resilientSource.includes('buildCumulativeLessonReflectionRows'), 'Reflection trend must be rebuilt from in-lesson sessions only');
assert.ok(resilientSource.includes('getDailyAggregateDashboardSessionsForManagementByLocalDateRange'), 'Dashboard must prefer the daily aggregate summary path');
assert.ok(resilientSource.includes('getDashboardSessionsForManagementByLocalDateRange'), 'Dashboard must retain the projected canonical fallback');
assert.ok(resilientSource.includes("source: 'daily_aggregate'"), 'Dashboard must identify successful aggregate reads');
assert.ok(resilientSource.includes("source: 'canonical_fallback'"), 'Dashboard must identify safe canonical fallback reads');
assert.ok(resilientSource.includes('getReflectionRecordsForTeacherDateRange(start, end)'), 'Lesson Reflection dashboard reads must use the requested date range');
assert.ok(resilientSource.includes("const PILOT_B_OFFICIAL_DATE = '2026-09-09'"), 'Pilot B official date must be encoded in the dashboard read plan');
assert.ok(resilientSource.includes('readResearchDashboardSessionsWithFallback(readPlan.start, readPlan.end)'), 'Dashboard must apply the read plan to the aggregate-first session snapshot');
assert.ok(resilientSource.includes('readPlan.loadStudySchedules'), 'Study schedule reads must be conditional on Phase applicability');
assert.ok(
  resilientSource.includes('res.locals.researchDashboardSessions = analysisSessions'),
  'Phase comparison should reuse the already loaded, manual-exclusion-filtered session snapshot',
);
assert.ok(resilientSource.includes('let phaseComparison = body.phaseComparison'), 'Phase wrapper must reuse the core response instead of rebuilding Phase analytics');
assert.ok(resilientSource.includes("res.setHeader('Server-Timing'"), 'Dashboard must expose coarse server-side timing for future latency audits');
assert.ok(resilientSource.includes("body.success === false"), 'Phase enrichment must not start secondary work for a failed core dashboard response');
assert.ok(resilientSource.includes('isManualResearchExcludedSessionId'), 'Manual research exclusions must be applied before dashboard and Phase analysis');
assert.ok(resilientSource.includes('effectiveStart:'), 'Dashboard timing logs must expose the effective read boundary');
assert.ok(resilientSource.includes('schedulesLoaded:'), 'Dashboard timing logs must expose whether Study 1 schedules were required');
assert.ok(resilientSource.includes('sessionSource:'), 'Dashboard timing logs must expose aggregate versus canonical fallback source');
assert.ok(resilientSource.includes('aggregateError:'), 'Dashboard timing logs must expose why aggregate fallback occurred without changing the UI');

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
assert.ok(dashboardFn.includes('buildResearchDashboardSessionRows(rawSessions)'), 'dashboard must use stored session aggregates');
assert.equal(dashboardFn.includes('buildResearchDataSets('), false, 'dashboard must not expand history, expressions, or system events');
assert.ok(dashboardSource.includes('export function buildResearchTopExpressions'), 'expression analysis must remain available as a lazy computation');

const lazyRoutes = fs.readFileSync('src/server/researchDashboardLazyRoutes.ts', 'utf8');
assert.ok(lazyRoutes.includes("router.get('/research.expressions-summary'"), 'expression summary must have a dedicated lazy endpoint');
assert.ok(lazyRoutes.includes("router.get('/research.recent-sessions'"), 'session summaries must have a dedicated lazy endpoint');
assert.ok(lazyRoutes.includes('getDashboardSessionsForManagementByLocalDateRange(requestedDate, requestedDate)'), 'selected-day endpoint must query only that localDate with projected dashboard fields');
assert.ok(lazyRoutes.includes('buildResearchRecentSessions(selected, effectiveQuery, requestedDate ? undefined : 20)'), 'selected-day endpoint must return all matching summaries while legacy callers remain bounded');

const researcherRouteFiles = fs.readdirSync('src/server').filter((name) => name.endsWith('.ts'));
const researcherRoutePattern = /router\.(?:get|post|put|patch|delete)\(\s*(['"])([^'"]+)\1\s*,\s*requireManagementRole\(\['researcher'\]\)/g;
const researcherProtectedRoutes = new Set<string>();
for (const fileName of researcherRouteFiles) {
  const source = fs.readFileSync(`src/server/${fileName}`, 'utf8');
  for (const match of source.matchAll(researcherRoutePattern)) researcherProtectedRoutes.add(match[2]);
}
assert.ok(researcherProtectedRoutes.size > 0, 'researcher route coverage audit must discover protected routes');
for (const routePath of researcherProtectedRoutes) {
  assert.equal(
    researcherRouteAllowed({ path: routePath } as any),
    true,
    `researcher allowlist must include protected router path ${routePath}`,
  );
}
for (const fullPath of [
  '/api/management/research.recent-sessions',
  '/api/management/research.expressions-summary',
  '/api/reflection/research/lesson-reflections.csv',
]) {
  assert.equal(researcherRouteAllowed({ path: fullPath } as any), true, `researcher allowlist must include full mounted path ${fullPath}`);
}

const managementPage = fs.readFileSync('src/server/managementPage.ts', 'utf8');
assert.ok(managementPage.includes('dashboardController.abort()'), 'a new dashboard request must abort the previous request');
assert.ok(managementPage.includes('表現分析を読み込む'), 'expression analysis must require an explicit user action');
assert.ok(managementPage.includes('async function loadRecentSessionsForDashboard'), 'recent-session loading must have an isolated failure boundary');
assert.ok(managementPage.includes('最新セッションの読み込みに失敗しました'), 'recent-session failure must be shown only in the recent-session area');
const loadDashboardStart = managementPage.indexOf('async function loadDashboard()');
const loadDashboardEnd = managementPage.indexOf('function markDashboardFiltersPending', loadDashboardStart);
const loadDashboardSource = managementPage.slice(loadDashboardStart, loadDashboardEnd);
assert.ok(loadDashboardSource.includes('await loadRecentSessionsForDashboard(params,signal,seq)'), 'dashboard must invoke the isolated recent-session loader after the core result is rendered');
assert.equal(loadDashboardSource.includes('/api/management/research.recent-sessions'), false, 'core dashboard try/catch must not own the recent-session request directly');

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
