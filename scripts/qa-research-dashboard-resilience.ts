import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  isTransientResearchDashboardReadError,
  retryResearchDashboardRead,
} from '../src/server/researchDashboardResilientRuntime';

assert.equal(isTransientResearchDashboardReadError(new Error('FIRESTORE_LIST_503:backend unavailable')), true);
assert.equal(isTransientResearchDashboardReadError(new Error('FIRESTORE_GET_429:quota')), true);
assert.equal(isTransientResearchDashboardReadError(new Error('AbortError:This operation was aborted')), true);
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
assert.ok(resilientSource.includes('res.locals.researchDashboardSessions = sessions'), 'Phase comparison should reuse the already loaded session snapshot');
assert.ok(resilientSource.includes("body.success === false"), 'Phase enrichment must not start secondary work for a failed core dashboard response');

const entry = fs.readFileSync('server-entry.ts', 'utf8');
assert.ok(entry.includes('resilientResearchDashboardGetHandler(path) || phaseAwareGetHandler(path)'));
assert.ok(entry.includes('withResilientResearchPhaseDashboard'));
assert.equal(
  entry.includes("if (path === '/api/management/research.dashboard') {\n      handlers[handlers.length - 1] = withResearchPhaseDashboardConsistency"),
  false,
  'legacy dashboard consistency wrapper must not own the dashboard API anymore',
);

console.log('Research dashboard resilience QA: PASS');
