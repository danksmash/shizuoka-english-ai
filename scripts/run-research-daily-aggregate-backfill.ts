import {
  auditResearchDailyAggregateBackfill,
  backfillResearchDailyAggregates,
} from '../src/server/researchDailyAggregateBackfill';

function print(label: string, value: unknown) {
  console.log(`RESEARCH_AGGREGATE_${label}=${JSON.stringify(value)}`);
}

const confirmation = process.env.RESEARCH_AGGREGATE_BACKFILL_CONFIRM || '';
if (confirmation !== 'BACKFILL_RESEARCH_DAILY_AGGREGATES') {
  throw new Error('RESEARCH_AGGREGATE_BACKFILL_CONFIRMATION_REQUIRED');
}

const before = await auditResearchDailyAggregateBackfill();
print('BEFORE', before);

if (before.cutoverReady) {
  print('RESULT', { status:'already_ready', cutoverReady:true });
  process.exit(0);
}

const after = await backfillResearchDailyAggregates();
print('AFTER', after);

if (!after.matches || !after.dashboardParity?.matches || after.expectedCapacity?.nearDocumentLimit || !after.cutoverReady) {
  print('RESULT', {
    status:'not_ready',
    matches:after.matches,
    dashboardParity:after.dashboardParity?.matches === true,
    nearDocumentLimit:after.expectedCapacity?.nearDocumentLimit === true,
    cutoverReady:after.cutoverReady === true,
  });
  process.exit(2);
}

print('RESULT', {
  status:'ready',
  sourceSessions:after.sourceSessions,
  expectedDays:after.expectedDays,
  expectedContributions:after.expectedContributions,
  maxDocumentBytes:after.expectedCapacity?.maxDocumentBytes,
  maxContributionsPerDay:after.expectedCapacity?.maxContributionsPerDay,
  cutoverReady:true,
});
