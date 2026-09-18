import express from 'express';
import { requireManagementRole } from './auth';
import { buildResearchExportDataSets, filterResearchExportDataSets } from './researchDashboard';
import { getSessionsForManagementByLocalDateRange } from './persistence';
import { getAllStudySchedules } from './studySchedulePersistence';
import { filterSessionsForStudyPhase, normalizeStudyPhaseFilter } from './researchPhaseRuntime';
import { buildResearchSessionAudit } from './researchSessionAudit';
import { buildResearchSessionAuditDetails } from './researchSessionAuditDetails';
import { MANUAL_RESEARCH_EXCLUSIONS } from './researchManualExclusions';

const router = express.Router();

router.post('/research.session-audit', requireManagementRole(['researcher']), async (req, res) => {
  const startedAt = Date.now();
  const filters = req.body?.filters && typeof req.body.filters === 'object'
    ? req.body.filters as Record<string, unknown>
    : {};
  try {
    const [sessions, schedules] = await Promise.all([
      getSessionsForManagementByLocalDateRange(filters.start, filters.end),
      getAllStudySchedules(),
    ]);
    const studyPhase = normalizeStudyPhaseFilter(filters.studyPhase);
    const phaseSessions = filterSessionsForStudyPhase(sessions, schedules, studyPhase);
    const filtered = filterResearchExportDataSets(buildResearchExportDataSets(phaseSessions), filters);
    const selectedIds = new Set(
      filtered.sessions
        .map((row) => String(row.session_id || ''))
        .filter(Boolean),
    );
    for (const record of MANUAL_RESEARCH_EXCLUSIONS) {
      if (phaseSessions.some((session) => String(session.sessionId || '') === record.sessionId)) {
        selectedIds.add(record.sessionId);
      }
    }
    const selectedSessions = phaseSessions.filter((session) => selectedIds.has(String(session.sessionId || '')));
    const audit = buildResearchSessionAudit(selectedSessions);
    const details = buildResearchSessionAuditDetails(selectedSessions, audit);
    const totalMs = Date.now() - startedAt;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Server-Timing', `audit-lazy;dur=${totalMs}`);
    return res.json({
      success: true,
      audit,
      details,
      filters,
      totalMs,
    });
  } catch (error: any) {
    console.error('Research session audit lazy load failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'RESEARCH_SESSION_AUDIT_UNAVAILABLE' });
  }
});

export function createResearchSessionAuditRouter() {
  return router;
}
