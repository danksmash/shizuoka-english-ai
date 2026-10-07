import {
  auditResearchDailyAggregateBackfill,
  backfillResearchDailyAggregates,
} from '../src/server/researchDailyAggregateBackfill';
import {
  auditResearchTurnMetricRepair,
  repairResearchTurnMetricsFromStoredHistory,
} from '../src/server/researchTurnMetricRepair';

async function main() {
  const turnRepairBefore = await auditResearchTurnMetricRepair();
  console.log(`RESEARCH_TURN_METRIC_REPAIR_BEFORE=${JSON.stringify(turnRepairBefore)}`);

  const turnRepair = await repairResearchTurnMetricsFromStoredHistory();
  console.log(`RESEARCH_TURN_METRIC_REPAIR_RESULT=${JSON.stringify(turnRepair)}`);

  const before = await auditResearchDailyAggregateBackfill();
  console.log(`RESEARCH_DAILY_AGGREGATE_BACKFILL_BEFORE=${JSON.stringify(before)}`);

  if (before.expectedCapacity?.nearDocumentLimit === true) {
    throw new Error('RESEARCH_DAILY_AGGREGATE_BACKFILL_ABORTED_CAPACITY');
  }

  const result = await backfillResearchDailyAggregates();
  console.log(`RESEARCH_DAILY_AGGREGATE_BACKFILL_RESULT=${JSON.stringify(result)}`);

  if (
    !result.matches
    || !result.dashboardParity?.matches
    || !result.turnSeriesParity?.matches
    || !result.cutoverReady
  ) {
    throw new Error('RESEARCH_DAILY_AGGREGATE_BACKFILL_NOT_CUTOVER_READY');
  }
}

main().catch((error: any) => {
  console.error('RESEARCH_DAILY_AGGREGATE_BACKFILL_FAILED', {
    message: error?.message || String(error),
  });
  process.exitCode = 1;
});
