import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  RESEARCH_DASHBOARD_SESSION_FIELDS,
  auditResearchDailyAggregateDocuments,
  buildResearchDailyContribution,
  buildResearchDailyAggregateDocuments,
  researchDailyAggregateCapacity,
  researchDailyAggregateDocumentsToDashboardSessions,
  researchDailyContributionKey,
  syncResearchDailyAggregateContribution,
} from '../src/server/researchDailyAggregates';

const base = {
  sessionId: 'session-1', researchId: 'R001', classId: '5-1', localDate: '2026-10-07',
  studySiteId: 'site_a', schoolCondition: 'intervention', formalStudyParticipant: true,
  studyStartDate: '2026-09-17', gradeLevel: 5,
  personaId: 'emma_usa', personaCountry: 'United States', topic: 'intro', targetDurationMinutes: 3,
  startedAt: '2026-10-07T01:00:00.000Z', endedAt: '2026-10-07T01:03:00.000Z',
  personaLabelCondition: 'shown', assignedPartnerCountry: 'United States', assignmentAnnouncedAt: '2026-10-06T00:00:00.000Z',
  actualDurationSeconds: 180, totalTurns: 8, totalChildWords: 42, aiTurnCount: 9,
  micErrorCount: 1, ttsFallbackCount: 0, aiRequestFailureCount: 0,
  reflection: { scaleVersion: '4point-v1', understoodPartner: 3, conveyedIdeas: 4, noticedLanguageCulture: 2 },
  updatedAt: '2026-10-07T01:03:00.000Z',
};

const contribution = buildResearchDailyContribution(base);
assert.equal(contribution.totalChildWords, 42);
assert.equal(contribution.reflectionConveyed, 4);
assert.equal('sessionId' in contribution, false, 'daily aggregate values must not duplicate raw session identifiers');
assert.equal('studentId' in contribution, false, 'daily aggregate values must not copy student identifiers');
assert.equal(contribution.schoolCondition, 'intervention');
assert.equal(contribution.topic, 'intro');
assert.equal(contribution.reflectionScaleVersion, '4point-v1');
assert.ok(RESEARCH_DASHBOARD_SESSION_FIELDS.includes('updatedAt'));
assert.equal(researchDailyContributionKey('session-1'), researchDailyContributionKey('session-1'));
assert.notEqual(researchDailyContributionKey('session-1'), researchDailyContributionKey('session-2'));

const calls: Array<{ type: string; collection: string; id: string; path: string; value?: unknown }> = [];
const writer = {
  patch: async (collection: string, id: string, path: string, value: unknown) => { calls.push({ type:'patch', collection, id, path, value }); },
  remove: async (collection: string, id: string, path: string) => { calls.push({ type:'remove', collection, id, path }); },
};

await syncResearchDailyAggregateContribution(null, base, writer);
await syncResearchDailyAggregateContribution(base, { ...base, totalChildWords: 50, reflection: { ...base.reflection, conveyedIdeas: 3 } }, writer);
assert.equal(calls.length, 2, 'repeat saves overwrite the same contribution instead of incrementing');
assert.equal(calls[0].path, calls[1].path);
assert.equal((calls[1].value as any).totalChildWords, 50);

await syncResearchDailyAggregateContribution(base, { ...base, localDate:'2026-10-08' }, writer);
assert.equal(calls.at(-2)?.type, 'remove');
assert.equal(calls.at(-2)?.id, '2026-10-07');
assert.equal(calls.at(-1)?.type, 'patch');
assert.equal(calls.at(-1)?.id, '2026-10-08');

assert.throws(() => buildResearchDailyContribution({ ...base, localDate:'bad' }), /LOCAL_DATE_INVALID/);

const expected = buildResearchDailyAggregateDocuments([
  base,
  { ...base, sessionId:'session-2', totalChildWords:11 },
  { ...base, sessionId:'session-3', localDate:'2026-10-08' },
]);
assert.equal(expected.length, 2);
assert.equal(Object.keys(expected[0].contributions).length, 2);
assert.equal(auditResearchDailyAggregateDocuments(expected, expected).matches, true);
assert.equal(auditResearchDailyAggregateDocuments(expected, [
  { _name:'projects/example/databases/(default)/documents/research_daily_aggregates/2026-10-07', contributions:expected[0].contributions },
  { _name:'projects/example/databases/(default)/documents/research_daily_aggregates/2026-10-08', contributions:expected[1].contributions },
]).matches, true, 'shadow documents without localDate must be audited by document id');
const mismatch = auditResearchDailyAggregateDocuments(expected, [{ ...expected[0], contributions:{} }]);
assert.equal(mismatch.matches, false);
assert.deepEqual(mismatch.differences.map((row) => row.kind), ['contribution_mismatch','missing_date']);

const reconstructed = researchDailyAggregateDocumentsToDashboardSessions(expected as any);
assert.equal(reconstructed.length, 3);
assert.equal(reconstructed[0].sessionId, researchDailyContributionKey('session-1'), 'aggregate dashboard rows use the hashed contribution key');
assert.equal(reconstructed[0].schoolCondition, 'intervention');
assert.equal(reconstructed[0].topic, 'intro');
assert.equal(reconstructed[0].totalChildWords, 42);
assert.equal(reconstructed[0].reflection?.scaleVersion, '4point-v1');
assert.equal('studentId' in reconstructed[0], false, 'reconstructed dashboard rows must remain anonymous');

const capacity = researchDailyAggregateCapacity(expected as any);
assert.equal(capacity.nearDocumentLimit, false);
assert.equal(capacity.maxContributionsPerDay, 2);
assert.ok(capacity.maxDocumentBytes > 0);

const [entry, auth, routes, backfill, firestore, persistence, server, runner, deployWorkflow] = await Promise.all([
  readFile('server-entry.ts','utf8'),
  readFile('src/server/auth.ts','utf8'),
  readFile('src/server/researchDailyAggregateRoutes.ts','utf8'),
  readFile('src/server/researchDailyAggregateBackfill.ts','utf8'),
  readFile('src/server/firestore.ts','utf8'),
  readFile('src/server/persistence.ts','utf8'),
  readFile('server.ts','utf8'),
  readFile('scripts/run-research-daily-aggregate-backfill.ts','utf8'),
  readFile('.github/workflows/cloud-run-deploy.yml','utf8'),
]);
assert.ok(entry.includes('createResearchDailyAggregateRouter()'));
assert.ok(auth.includes("path.startsWith('/research.daily-aggregates/')"));
assert.ok(routes.includes("req.body?.confirm !== CONFIRMATION"), 'backfill must require explicit confirmation');
assert.ok(routes.includes("requireManagementRole(['researcher'])"));
assert.ok(backfill.includes('getDashboardSessionsForManagementByLocalDateRange()'), 'backfill must use the exact canonical dashboard source including student-master study metadata');
assert.ok(backfill.includes('dashboardParity'), 'backfill audit must compare dashboard output parity');
assert.ok(backfill.includes('cutoverReady'), 'aggregate cutover must have an explicit readiness gate');
assert.ok(backfill.includes('researchDailyAggregateCapacity'), 'aggregate audit must report document-capacity headroom');
assert.ok(persistence.includes('const DASHBOARD_SESSION_FIELDS = RESEARCH_DASHBOARD_SESSION_FIELDS;'), 'live dashboard projection must share the aggregate field contract');
assert.ok(persistence.includes('formalStudyParticipant: args.formalStudyParticipant === true'), 'shadow writes must include current study participation metadata');
assert.ok(persistence.includes("schoolCondition: args.schoolCondition || ''"), 'shadow writes must include current study condition metadata');
assert.ok(server.includes('formalStudyParticipant:student.formalStudyParticipant'), 'session route must pass resolved study metadata to the shadow index');
assert.ok(firestore.includes("params.append('mask.fieldPaths', fieldPath)"));
assert.ok(runner.includes("RESEARCH_AGGREGATE_BACKFILL_CONFIRMATION_REQUIRED"), 'one-shot runner must require an explicit confirmation value');
assert.ok(runner.includes("!after.cutoverReady"), 'one-shot runner must fail closed unless the parity/capacity gate passes');
assert.ok(deployWorkflow.includes('MARKER="ops/run-research-aggregate-backfill-v2-20261007"'), 'production backfill must be one-shot marker gated');
assert.ok(deployWorkflow.includes('--service-account "$RUNTIME_SA"'), 'backfill job must use the production runtime service account');
assert.ok(deployWorkflow.includes('--max-retries 0'), 'one-shot backfill must not automatically repeat writes');
console.log('Research daily aggregate shadow-write QA: PASS');
