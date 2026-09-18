import type { RequestHandler } from 'express';
import {
  buildResearchDashboardData,
  buildResearchExportDataSets,
  filterResearchExportDataSets,
  normalizeFormalResearchExportQuery,
  type ResearchFilterQuery,
} from './researchDashboard';
import { getAllSessionsForManagement, getSessionsForManagementByLocalDateRange } from './persistence';
import { getAllReflectionRecordsForTeacher, getReflectionRecordsForTeacherDateRange } from './reflectionPersistence';
import {
  buildResearchLessonReflectionCodebookRows,
  buildResearchLessonReflectionRows,
} from './researchLessonReflectionExport';
import { getAllStudySchedules, type StudyScheduleRecord } from './studySchedulePersistence';
import {
  STUDY_PHASE_FILTER_IDS,
  filterReflectionsForStudyPhase,
  filterSessionsForStudyPhase,
  normalizeStudyPhaseFilter,
} from './researchPhaseRuntime';
import { PHASE_CODEBOOK_ROWS } from './researchPhaseAnalyticsRuntime';
import {
  buildConsistentPhaseComparison,
  buildPhaseDashboardErrorPayload,
} from './researchPhaseDashboardConsistency';
import { buildResearchSessionAudit } from './researchSessionAudit';
import { buildResearchSessionAuditDetails } from './researchSessionAuditDetails';
import {
  MANUAL_RESEARCH_EXCLUSIONS,
  isManualResearchExcludedSessionId,
} from './researchManualExclusions';

type PhaseAwareResearchQuery = ResearchFilterQuery & { studyPhase?: unknown; dataset?: unknown };

const RETRY_DELAYS_MS = [120, 320];

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name}:${error.message}`;
  return String(error || '');
}

export function isTransientResearchDashboardReadError(error: unknown): boolean {
  const text = errorText(error);
  return /FIRESTORE_(?:GET|LIST|QUERY|MULTI_QUERY|RANGE_QUERY)_(?:408|429|500|502|503|504)/i.test(text)
    || /METADATA_TOKEN_(?:408|429|500|502|503|504)/i.test(text)
    || /AbortError|aborted|fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|UND_ERR/i.test(text);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryResearchDashboardRead<T>(
  label: string,
  read: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown = null;
  const attempts = Math.max(1, Math.min(3, Math.trunc(maxAttempts) || 1));
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await read();
    } catch (error) {
      lastError = error;
      if (!isTransientResearchDashboardReadError(error) || attempt >= attempts) throw error;
      console.warn('Research dashboard read retry', {
        label,
        attempt,
        message: error instanceof Error ? error.message : String(error),
      });
      await delay(RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)]);
    }
  }
  throw lastError;
}

async function loadStudySchedulesResilient(): Promise<StudyScheduleRecord[]> {
  return retryResearchDashboardRead('study_schedules', () => getAllStudySchedules());
}

async function loadSessionsResilient(start?: unknown, end?: unknown): Promise<Record<string, any>[]> {
  return retryResearchDashboardRead('sessions_and_students', () => getSessionsForManagementByLocalDateRange(start, end));
}

async function loadOptionalReflections(start?: unknown, end?: unknown): Promise<{ records: Awaited<ReturnType<typeof getAllReflectionRecordsForTeacher>>; warnings: string[] }> {
  try {
    return {
      records: await retryResearchDashboardRead('lesson_reflections', () => getReflectionRecordsForTeacherDateRange(start, end)),
      warnings: [],
    };
  } catch (error: any) {
    console.error('Research dashboard optional reflection read failed', { message: error?.message });
    return {
      records: [],
      warnings: ['lesson_reflections_unavailable'],
    };
  }
}

const resilientDashboardHandler: RequestHandler = async (req, res) => {
  const requestStartedAt = Date.now();
  try {
    const query = req.query as PhaseAwareResearchQuery;
    const studyPhase = normalizeStudyPhaseFilter(query.studyPhase);
    const readStartedAt = Date.now();
    const [schedules, sessions, reflectionSnapshot] = await Promise.all([
      loadStudySchedulesResilient(),
      loadSessionsResilient(query.start, query.end),
      loadOptionalReflections(query.start, query.end),
    ]);
    const readMs = Date.now() - readStartedAt;

    const phaseSessionsRaw = filterSessionsForStudyPhase(sessions, schedules, studyPhase);
    const phaseSessions = phaseSessionsRaw.filter((session) => !isManualResearchExcludedSessionId(session.sessionId));
    const phaseReflections = filterReflectionsForStudyPhase(reflectionSnapshot.records, schedules, studyPhase);
    const dashboardStartedAt = Date.now();
    const dashboard = buildResearchDashboardData(phaseSessions, query);
    const dashboardMs = Date.now() - dashboardStartedAt;
    const auditStartedAt = Date.now();
    const filteredAuditData = filterResearchExportDataSets(buildResearchExportDataSets(phaseSessionsRaw), query);
    const auditSessionIds = new Set(filteredAuditData.sessions.map((row) => String(row.session_id || '')).filter(Boolean));
    for (const record of MANUAL_RESEARCH_EXCLUSIONS) {
      if (phaseSessionsRaw.some((session) => String(session.sessionId || '') === record.sessionId)) auditSessionIds.add(record.sessionId);
    }
    const filteredAuditSessions = phaseSessionsRaw.filter((session) => auditSessionIds.has(String(session.sessionId || '')));
    const sessionAudit = buildResearchSessionAudit(filteredAuditSessions);
    const sessionAuditDetails = buildResearchSessionAuditDetails(filteredAuditSessions, sessionAudit);
    const auditMs = Date.now() - auditStartedAt;
    const manualExcludedCount = filteredAuditSessions.filter((session) => isManualResearchExcludedSessionId(session.sessionId)).length;
    const auditQualityRows = [
      { label: '研究分析対象外: 手動除外', value: manualExcludedCount },
      { label: '監査候補: 近接開始', value: sessionAudit.summary.near_start_pairs },
      { label: '監査候補: 0発話→近接有効session', value: sessionAudit.summary.zero_child_near_valid_pairs },
      { label: '監査除外候補: 完全重複shadow', value: sessionAudit.summary.exact_duplicate_shadow_sessions },
      { label: '監査要確認: complete同時進行', value: sessionAudit.summary.overlapping_complete_pairs },
      { label: '監査要確認session', value: sessionAudit.summary.requires_review_sessions },
    ];
    const lessonReflectionRowCount = buildResearchLessonReflectionRows(
      phaseReflections,
      normalizeFormalResearchExportQuery(query),
    ).length;
    const lessonCodebookCount = buildResearchLessonReflectionCodebookRows().length;
    const exportFiles = dashboard.exportFiles.map((file: any) => file.dataset === 'codebook'
      ? { ...file, rowCount: Number(file.rowCount || 0) + lessonCodebookCount }
      : file);
    const filters = { ...dashboard.filters, studyPhases: [...STUDY_PHASE_FILTER_IDS] } as Record<string, unknown>;
    delete filters.labelConditions;
    const dashboardWarnings = [
      ...reflectionSnapshot.warnings,
      ...(manualExcludedCount > 0 ? [`manual_research_exclusions:${manualExcludedCount}`] : []),
      ...(sessionAudit.summary.requires_review_sessions > 0
        ? [`session_audit_review_required:${sessionAudit.summary.requires_review_sessions}`]
        : []),
    ];

    const analysisSessions = sessions.filter((session) => !isManualResearchExcludedSessionId(session.sessionId));
    const phaseStartedAt = Date.now();
    const phaseComparison = buildConsistentPhaseComparison(analysisSessions, schedules, query);
    const phaseMs = Date.now() - phaseStartedAt;
    const totalMs = Date.now() - requestStartedAt;
    res.locals.researchDashboardSessions = analysisSessions;
    res.locals.researchDashboardSchedules = schedules;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Server-Timing', `reads;dur=${readMs}, dashboard;dur=${dashboardMs}, audit;dur=${auditMs}, phase;dur=${phaseMs}, core;dur=${totalMs}`);
    console.info('Research dashboard timing', {
      totalMs,
      readMs,
      dashboardMs,
      auditMs,
      phaseMs,
      loadedSessions: sessions.length,
      loadedReflections: reflectionSnapshot.records.length,
      start: typeof query.start === 'string' ? query.start : '',
      end: typeof query.end === 'string' ? query.end : '',
      dataScope: typeof query.dataScope === 'string' ? query.dataScope : 'main',
    });
    return res.json({
      ...dashboard,
      dataQuality: [...dashboard.dataQuality, ...auditQualityRows],
      filters,
      exportFiles,
      lessonReflectionRowCount,
      sessionAudit,
      sessionAuditDetails,
      manualResearchExclusions: MANUAL_RESEARCH_EXCLUSIONS,
      dashboardWarnings,
      phaseComparison,
    });
  } catch (error: any) {
    console.error('Resilient research dashboard failed', {
      name: error?.name,
      message: error?.message,
    });
    return res.status(503).json({ success: false, error: 'RESEARCH_DASHBOARD_UNAVAILABLE' });
  }
};

export function resilientResearchDashboardGetHandler(path: string): RequestHandler | null {
  return path === '/api/management/research.dashboard' ? resilientDashboardHandler : null;
}

export function withResilientResearchPhaseDashboard(path: string, handler: RequestHandler): RequestHandler {
  if (path !== '/api/management/research.dashboard') return handler;
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    (res as any).json = async (body: any) => {
      if (!body || body.success === false) return originalJson(body);
      const query = req.query as Record<string, unknown>;
      let phaseComparison = body.phaseComparison;
      if (!phaseComparison) {
        try {
          const sessions = Array.isArray(res.locals.researchDashboardSessions)
            ? res.locals.researchDashboardSessions
            : (await loadSessionsResilient(query.start, query.end)).filter((session) => !isManualResearchExcludedSessionId(session.sessionId));
          const schedules = Array.isArray(res.locals.researchDashboardSchedules)
            ? res.locals.researchDashboardSchedules
            : await loadStudySchedulesResilient();
          phaseComparison = buildConsistentPhaseComparison(sessions, schedules, query);
        } catch (error: any) {
          console.error('Resilient phase dashboard read failed', { message: error?.message });
          phaseComparison = buildPhaseDashboardErrorPayload(query);
        }
      }
      const exportFiles = Array.isArray(body.exportFiles)
        ? body.exportFiles.map((file: any) => file.dataset === 'codebook'
          ? { ...file, rowCount: Number(file.rowCount || 0) + PHASE_CODEBOOK_ROWS.length }
          : file)
        : body.exportFiles;
      return originalJson({ ...body, phaseComparison, exportFiles });
    };
    return handler(req, res, next);
  };
}
