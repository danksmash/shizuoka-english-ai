import assert from 'node:assert/strict';
import { getAllSessionsForManagement } from '../src/server/persistence';
import { buildResearchDashboardData } from '../src/server/researchDashboard';
import {
  buildResearchDashboardAggregateDocuments,
  buildResearchDashboardDataFromAggregateSessions,
  flattenResearchDashboardAggregateSessions,
} from '../src/server/researchDashboardAggregate';
import { rebuildStoredResearchDashboardAggregates } from '../src/server/researchDashboardAggregateStorage';

const apply = process.env.APPLY_RESEARCH_DASHBOARD_AGGREGATES === '1';
const verify = process.env.VERIFY_RESEARCH_DASHBOARD_AGGREGATES !== '0';

function comparableDashboard(payload: any) {
  return {
    metrics: payload.metrics,
    researchIndicators: payload.researchIndicators,
    charts: payload.charts,
    dataQuality: payload.dataQuality,
    systemQuality: payload.systemQuality,
    topExpressions: (payload.topExpressions || [])
      .map((row: any) => ({
        expression: String(row.expression || '').trim().toLowerCase(),
        count: Number(row.count || 0),
        source: String(row.source || ''),
      }))
      .sort((a: any, b: any) => b.count - a.count || a.source.localeCompare(b.source) || a.expression.localeCompare(b.expression)),
    recentSessions: payload.recentSessions,
    filters: payload.filters,
    exportFiles: (payload.exportFiles || []).map((row: any) => ({ dataset: row.dataset, rowCount: row.rowCount })),
  };
}

const source = await getAllSessionsForManagement();
assert.ok(source.length > 0, 'Production research source must contain sessions before aggregate rebuild');

let pilotSessions = 0;
let pilotParticipants = 0;
if (verify) {
  const logicalDocuments = buildResearchDashboardAggregateDocuments(source, 'production-read-only-verification');
  const summaries = flattenResearchDashboardAggregateSessions(logicalDocuments.map((item) => item.data));
  const pilot = buildResearchDashboardDataFromAggregateSessions(summaries, { dataScope: 'pilot_b' });
  pilotSessions = Number(pilot.metrics.totalSessions || 0);
  pilotParticipants = Number(pilot.metrics.participantCount || 0);
  assert.equal(pilotSessions, 291, 'Production Pilot B session count must remain 291');
  assert.equal(pilotParticipants, 26, 'Production Pilot B participant count must remain 26');

  for (const query of [
    { dataScope: 'main' },
    { dataScope: 'pilot_b' },
    { dataScope: 'test' },
    { dataScope: 'reserve' },
  ]) {
    const legacy = comparableDashboard(buildResearchDashboardData(source, query));
    const aggregate = comparableDashboard(buildResearchDashboardDataFromAggregateSessions(summaries, query));
    assert.deepEqual(aggregate, legacy, `Production aggregate parity failed: ${JSON.stringify(query)}`);
  }
}

const result = await rebuildStoredResearchDashboardAggregates(source, { dryRun: !apply });
assert.equal(result.sessionCount, source.length, 'Aggregate session count must equal source session count');
assert.ok(result.documentCount > 0, 'Aggregate storage must produce at least one sharded document');

console.log(JSON.stringify({
  success: true,
  mode: apply ? 'apply' : 'dry-run',
  sourceSessionCount: source.length,
  aggregateSessionCount: result.sessionCount,
  logicalDocumentCount: result.logicalDocumentCount,
  storedShardCount: result.documentCount,
  pilotSessions: verify ? pilotSessions : 'not-verified',
  pilotParticipants: verify ? pilotParticipants : 'not-verified',
}, null, 2));
