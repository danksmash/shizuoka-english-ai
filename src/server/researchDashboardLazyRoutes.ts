import express from 'express';
import { requireManagementRole } from './auth';
import { buildResearchRecentSessions, buildResearchTopExpressions } from './researchDashboard';
import { getDashboardSessionsForManagementByLocalDateRange, getRecentSessionsForManagement, getSessionsForManagementByLocalDateRange } from './persistence';
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
    const requestedDate = typeof query.sessionDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.sessionDate)
      ? query.sessionDate
      : '';

    // Day view: query only the selected localDate and only projected dashboard fields.
    // Legacy callers without sessionDate keep the old bounded latest-20 behavior.
    const sessions = requestedDate
      ? await getDashboardSessionsForManagementByLocalDateRange(requestedDate, requestedDate)
      : await getRecentSessionsForManagement(200);
    const studyPhase = normalizeStudyPhaseFilter(query.studyPhase);
    const schedules = studyPhase ? await getAllStudySchedules() : [];
    const selected = filterSessionsForStudyPhase(sessions, schedules, studyPhase)
      .filter((session) => !isManualResearchExcludedSessionId(session.sessionId));
    const effectiveQuery = requestedDate ? { ...query, start:requestedDate, end:requestedDate } : query;
    const recentSessions = buildResearchRecentSessions(selected, effectiveQuery, requestedDate ? undefined : 20);
    const sessionDate = requestedDate || String(recentSessions[0]?.local_started_at || '').slice(0, 10);

    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success:true,
      recentSessions,
      sessionDate,
      total:recentSessions.length,
      limit:requestedDate ? null : 20,
    });
  } catch (error:any) {
    console.error('Research recent sessions failed', { message:error?.message });
    return res.status(503).json({ success:false, error:'RESEARCH_RECENT_SESSIONS_UNAVAILABLE' });
  }
});

export function createResearchDashboardLazyRouter() {
  return router;
}
