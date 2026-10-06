import {
  auditResearchDailyAggregateBackfill,
  backfillResearchDailyAggregates,
} from '../src/server/researchDailyAggregateBackfill';

function summary(audit: any) {
  return {
    sourceSessions: Number(audit?.sourceSessions || 0),
    expectedDocuments: Number(audit?.expectedDocuments || 0),
    actualDocuments: Number(audit?.actualDocuments || 0),
    matches: audit?.matches === true,
    dashboardParity: {
      matches: audit?.dashboardParity?.matches === true,
      cases: Array.isArray(audit?.dashboardParity?.cases) ? audit.dashboardParity.cases : [],
      aggregateSessions: Number(audit?.dashboardParity?.aggregateSessions || 0),
      differences: Array.isArray(audit?.dashboardParity?.differences) ? audit.dashboardParity.differences : [],
    },
    expectedCapacity: audit?.expectedCapacity || null,
    actualCapacity: audit?.actualCapacity || null,
    cutoverReady: audit?.cutoverReady === true,
  };
}

async function main() {
  const before = await auditResearchDailyAggregateBackfill();
  const preflight = summary(before);
  console.log('RESEARCH_DAILY_AGGREGATE_BACKFILL_PREFLIGHT=' + JSON.stringify(preflight));

  if (before?.expectedCapacity?.nearDocumentLimit === true) {
    throw new Error('RESEARCH_DAILY_AGGREGATE_BACKFILL_ABORTED_CAPACITY');
  }

  const after = await backfillResearchDailyAggregates();
  const result = summary(after);
  console.log('RESEARCH_DAILY_AGGREGATE_BACKFILL_RESULT=' + JSON.stringify(result));

  if (!result.matches || !result.dashboardParity.matches || !result.cutoverReady) {
    throw new Error('RESEARCH_DAILY_AGGREGATE_BACKFILL_PARITY_FAILED');
  }
}

main().catch((error: any) => {
  console.error('RESEARCH_DAILY_AGGREGATE_BACKFILL_FAILED', {
    message: String(error?.message || error || 'unknown'),
  });
  process.exitCode = 1;
});
