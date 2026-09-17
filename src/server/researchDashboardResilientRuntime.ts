import type { RequestHandler } from 'express';
import {
  buildResearchDashboardData,
  buildResearchExportDataSets,
  filterResearchExportDataSets,
  normalizeFormalResearchExportQuery,
  type ResearchFilterQuery,
} from './researchDashboard';
import { getAllSessionsForManagement } from './persistence';
import { getAllReflectionRecordsForTeacher } from './reflectionPersistence';
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

type PhaseAwareResearchQuery = ResearchFilterQuery & { studyPhase?: unknown; dataset?: unknown };

const RETRY_DELAYS_MS = [120, 320];

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name}:${error.message}`;
  return String(error || '');
}

export function isTransientResearchDashboardReadError(error: unknown): boolean {
  const text = errorText(error);
  return /FIRESTORE_(?:GET|LIST|QUERY|MULTI_QUERY)_(?:408|429|500|502|503|504)/i.test(text)
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

async function loadSessionsResilient(): Promise<Record<string, any>[]> {
  return retryResearchDashboardRead('sessions_and_students', () => getAllSessionsForManagement());
}

async function loadOptionalReflections(): Promise<{ records: Awaited<ReturnType<typeof getAllReflectionRecordsForTeacher>>; warnings: string[] }> {
  try {
    return {
      records: await retryResearchDashboardRead('lesson_reflections', () => getAllReflectionRecordsForTeacher()),
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
  try {
    const query = req.query as PhaseAwareResearchQuery;
    const studyPhase = normalizeStudyPhaseFilter(query.studyPhase);
    const schedulesPromise = studyPhase ? loadStudySchedulesResilient() : Promise.resolve([] as StudyScheduleRecord[]);
    const [schedules, sessions, reflectionSnapshot] = await Promise.all([
      schedulesPromise,
      loadSessionsResilient(),
      loadOptionalReflections(),
    ]);

    const phaseSessions = filterSessionsForStudyPhase(sessions, schedules, studyPhase);
    const phaseReflections = filterReflectionsForStudyPhase(reflectionSnapshot.records, schedules, studyPhase);
    const dashboard = buildResearchDashboardData(phaseSessions, query);
    const filteredAuditData = filterResearchExportDataSets(buildResearchExportDataSets(phaseSessions), query);
    const auditSessionIds = new Set(filteredAuditData.sessions.map((row) => String(row.session_id || '')).filter(Boolean));
    const sessionAudit = buildResearchSessionAudit(
      phaseSessions.filter((session) => auditSessionIds.has(String(session.sessionId || ''))),
    );
    const auditQualityRows = [
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
      ...(sessionAudit.summary.requires_review_sessions > 0
        ? [`session_audit_review_required:${sessionAudit.summary.requires_review_sessions}`]
        : []),
    ];

    res.locals.researchDashboardSessions = sessions;
    if (schedules.length) res.locals.researchDashboardSchedules = schedules;
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      ...dashboard,
      dataQuality: [...dashboard.dataQuality, ...auditQualityRows],
      filters,
      exportFiles,
      lessonReflectionRowCount,
      sessionAudit,
      dashboardWarnings,
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
      let phaseComparison;
      try {
        const sessions = Array.isArray(res.locals.researchDashboardSessions)
          ? res.locals.researchDashboardSessions
          : await loadSessionsResilient();
        const schedules = Array.isArray(res.locals.researchDashboardSchedules) && res.locals.researchDashboardSchedules.length
          ? res.locals.researchDashboardSchedules
          : await loadStudySchedulesResilient();
        phaseComparison = buildConsistentPhaseComparison(sessions, schedules, query);
      } catch (error: any) {
        console.error('Resilient phase dashboard read failed', { message: error?.message });
        phaseComparison = buildPhaseDashboardErrorPayload(query);
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