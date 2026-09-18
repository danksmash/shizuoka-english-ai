import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  isTransientResearchDashboardReadError,
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

const resilientSource = fs.readFileSync('src/server/researchDashboardResilientRuntime.ts', 'utf8');
assert.ok(resilientSource.includes("warnings: ['lesson_reflections_unavailable']"), 'Reflection failure must degrade partially, not blank the dashboard');
assert.ok(resilientSource.includes('getSessionsForManagementByLocalDateRange(start, end)'), 'Dashboard session reads must be scoped by requested localDate range before expansion');
assert.ok(resilientSource.includes('getReflectionRecordsForTeacherDateRange(start, end)'), 'Lesson Reflection dashboard reads must use the requested date range');
assert.ok(resilientSource.includes('loadStudySchedulesResilient(),'), 'Study schedules must start in the first parallel read group, not after dashboard aggregation');
assert.ok(
  resilientSource.includes('res.locals.researchDashboardSessions = analysisSessions'),
  'Phase comparison should reuse the already loaded, manual-exclusion-filtered session snapshot',
);
assert.ok(resilientSource.includes('let phaseComparison = body.phaseComparison'), 'Phase wrapper must reuse the core response instead of rebuilding Phase analytics');
assert.ok(resilientSource.includes("res.setHeader('Server-Timing'"), 'Dashboard must expose coarse server-side timing for future latency audits');
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
assert.ok(questionnaireRuntime.includes('const questionnairePromise = getAllQuestionnaireRecords()'), 'Questionnaire row-count enrichment must start in parallel with core dashboard loading');

const entry = fs.readFileSync('server-entry.ts', 'utf8');
assert.ok(entry.includes('manualResearchExclusionGetHandler(path) || resilientResearchDashboardGetHandler(path) || phaseAwareGetHandler(path)'));
assert.ok(entry.includes('withResilientResearchPhaseDashboard'));
assert.equal(
  entry.includes("if (path === '/api/management/research.dashboard') {\n      handlers[handlers.length - 1] = withResearchPhaseDashboardConsistency"),
  false,
  'legacy dashboard consistency wrapper must not own the dashboard API anymore',
);

console.log('Research dashboard resilience QA: PASS');
