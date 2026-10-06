import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  isTransientResearchDashboardReadError,
  researchDashboardReadPlan,
  retryResearchDashboardRead,
} from '../src/server/researchDashboardResilientRuntime';
import { buildResearchDashboardData } from '../src/server/researchDashboard';

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

const resilientSource = fs.readFileSync('src/server/researchDashboardResilientRuntime.ts', 'utf8');
assert.ok(resilientSource.includes("warnings: ['lesson_reflections_unavailable']"), 'Reflection failure must degrade partially, not blank the dashboard');
assert.ok(resilientSource.includes('getDashboardSessionsForManagementByLocalDateRange(start, end)'), 'Dashboard reads must use projected session fields scoped by localDate');
assert.ok(resilientSource.includes('getReflectionRecordsForTeacherDateRange(start, end)'), 'Lesson Reflection dashboard reads must use the requested date range');
assert.ok(resilientSource.includes("const PILOT_B_OFFICIAL_DATE = '2026-09-09'"), 'Pilot B official date must be encoded in the dashboard read plan');
assert.ok(resilientSource.includes('loadSessionsResilient(readPlan.start, readPlan.end)'), 'Dashboard must apply the read plan before Firestore session expansion');
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
assert.ok(lazyRoutes.includes("router.get('/research.recent-sessions'"), 'recent sessions must have a dedicated bounded endpoint');
assert.ok(lazyRoutes.includes('buildResearchRecentSessions(selected, query, 20)'), 'recent endpoint must return at most 20 rows');
const managementPage = fs.readFileSync('src/server/managementPage.ts', 'utf8');
assert.ok(managementPage.includes('dashboardController.abort()'), 'a new dashboard request must abort the previous request');
assert.ok(managementPage.includes('表現分析を読み込む'), 'expression analysis must require an explicit user action');

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
