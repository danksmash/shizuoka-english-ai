import express from 'express';
import { requireManagementRole } from './auth';
import { buildResearchRecentSessions, buildResearchTopExpressions } from './researchDashboard';
import { getRecentSessionsForManagement, getSessionsForManagementByLocalDateRange } from './persistence';
import { getAllStudySchedules } from './studySchedulePersistence';
import { filterSessionsForStudyPhase, normalizeStudyPhaseFilter } from './researchPhaseRuntime';
import { isManualResearchExcludedSessionId } from './researchManualExclusions';

const router = express.Router();

router.get('/research.expressions-summary', requireManagementRole(['researcher']), async (req, res) => {
  try {
    const query = req.query as Record<string, unknown>;
    const sessions = await getSessionsForManagementByLocalDateRange(query.start, query.end);
    const studyPhase = normalizeStudyPhaseFilter(query.studyPhase);
    const schedules = studyPhase ? await getAllStudySchedules() : [];
    const selected = filterSessionsForStudyPhase(sessions, schedules, studyPhase)
      .filter((session) => !isManualResearchExcludedSessionId(session.sessionId));
    const topExpressions = buildResearchTopExpressions(selected, query);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success:true, topExpressions });
  } catch (error:any) {
    console.error('Research expressions summary failed', { message:error?.message });
    return res.status(503).json({ success:false, error:'RESEARCH_EXPRESSIONS_SUMMARY_UNAVAILABLE' });
  }
});

router.get('/research.recent-sessions', requireManagementRole(['researcher']), async (req, res) => {
  try {
    const query = req.query as Record<string, unknown>;
    // Read a bounded, projected Firestore window; never load history/systemEvents.
    const sessions = await getRecentSessionsForManagement(200);
    const studyPhase = normalizeStudyPhaseFilter(query.studyPhase);
    const schedules = studyPhase ? await getAllStudySchedules() : [];
    const selected = filterSessionsForStudyPhase(sessions, schedules, studyPhase)
      .filter((session) => !isManualResearchExcludedSessionId(session.sessionId));
    const recentSessions = buildResearchRecentSessions(selected, query, 20);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success:true, recentSessions, limit:20 });
  } catch (error:any) {
    console.error('Research recent sessions failed', { message:error?.message });
    return res.status(503).json({ success:false, error:'RESEARCH_RECENT_SESSIONS_UNAVAILABLE' });
  }
});

export function createResearchDashboardLazyRouter() {
  return router;
}
