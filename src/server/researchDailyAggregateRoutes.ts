import express from 'express';
import { requireManagementRole } from './auth';
import { auditResearchDailyAggregateBackfill, backfillResearchDailyAggregates } from './researchDailyAggregateBackfill';

const router = express.Router();
const CONFIRMATION = 'BACKFILL_RESEARCH_DAILY_AGGREGATES';

router.get('/research.daily-aggregates/audit', requireManagementRole(['researcher']), async (_req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, ...(await auditResearchDailyAggregateBackfill()) });
  } catch (error: any) {
    console.error('Research daily aggregate audit failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'RESEARCH_DAILY_AGGREGATE_AUDIT_UNAVAILABLE' });
  }
});

router.post('/research.daily-aggregates/backfill', requireManagementRole(['researcher']), async (req, res) => {
  if (req.body?.confirm !== CONFIRMATION) {
    return res.status(400).json({ success: false, error: 'RESEARCH_DAILY_AGGREGATE_CONFIRMATION_REQUIRED' });
  }
  try {
    res.setHeader('Cache-Control', 'no-store');
    const audit = await backfillResearchDailyAggregates();
    return res.status(audit.matches ? 200 : 409).json({ success: audit.matches, ...audit });
  } catch (error: any) {
    console.error('Research daily aggregate backfill failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'RESEARCH_DAILY_AGGREGATE_BACKFILL_UNAVAILABLE' });
  }
});

export function createResearchDailyAggregateRouter() {
  return router;
}
