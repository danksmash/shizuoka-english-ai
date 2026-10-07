import type { RequestHandler } from 'express';
import {
  buildCumulativeLessonReflectionRows,
  buildResearchDashboardData,
  filterResearchSessionRows,
  normalizeFormalResearchExportQuery,
  type ResearchFilterQuery,
} from './researchDashboard';
import {
  getDailyAggregateDashboardSessionsForManagementByLocalDateRange,
  getDashboardSessionsForManagementByLocalDateRange,
} from './persistence';
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
import { QUESTIONNAIRE_EXPORT_HEADERS } from './questionnaireResearch';
import {
  buildConsistentPhaseComparison,
  buildConsistentPhaseComparisonFromExportSessions,
  buildPhaseDashboardErrorPayload,
} from './researchPhaseDashboardConsistency';
import {
  MANUAL_RESEARCH_EXCLUSIONS,
  isManualResearchExcludedSessionId,
} from './researchManualExclusions';
import { getAllAnalysisSessionOverrides } from './researchAnalysisSessions';

type PhaseAwareResearchQuery = ResearchFilterQuery & { studyPhase?: unknown; dataset?: unknown };

const RETRY_DELAYS_MS = [120, 320];
const PILOT_B_OFFICIAL_DATE = '2026-09-09';

function queryText(value: unknown): string {
  if (Array.isArray(value)) return queryText(value[0]);
  return typeof value === 'string' ? value.trim() : '';
}

function queryDateBoundary(value: unknown): string {
  const text = queryText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

export type ResearchDashboardReadPlan = {
  dataScope: string;
  start: unknown;
  end: unknown;
  loadStudySchedules: boolean;
  derivedPilotBRange: boolean;
};

export function researchDashboardReadPlan(query: PhaseAwareResearchQuery | Record<string, unknown>): ResearchDashboardReadPlan {
  const dataScope = queryText(query.dataScope) || 'main';
  const schoolCondition = queryText(query.schoolCondition) || 'intervention';
  const explicitStart = queryDateBoundary(query.start);
  const explicitEnd = queryDateBoundary(query.end);
  const derivedPilotBRange = dataScope === 'pilot_b' && !explicitStart && !explicitEnd;
  const phaseApplicable = (dataScope === 'main' || dataScope === 'all') && schoolCondition !== 'comparison';
  return {
    dataScope,
    start: derivedPilotBRange ? PILOT_B_OFFICIAL_DATE : query.start,
    end: derivedPilotBRange ? PILOT_B_OFFICIAL_DATE : query.end,
    loadStudySchedules: phaseApplicable,
    derivedPilotBRange,
  };
}

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name}:${error.message}`;
  return String(error || '');
}

export function isTransientResearchDashboardReadError(error: unknown): boolean {
  const text = errorText(error);
  return /FIRESTORE_(?:GET|LIST|QUERY|MULTI_QUERY|RANGE_QUERY|PROJECTED_RANGE_QUERY|LATEST_QUERY)_(?:408|429|500|502|503|504)/i.test(text)
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

export type ResearchDashboardSessionReadResult = {
  sessions: Record<string, any>[];
  source: 'daily_aggregate' | 'canonical_fallback';
  aggregateError: string;
};

export async function readResearchDashboardSessionsWithFallback(
  start?: unknown,
  end?: unknown,
  readers: {
    aggregate?: (start?: unknown, end?: unknown) => Promise<Record<string, any>[]>;
    canonical?: (start?: unknown, end?: unknown) => Promise<Record<string, any>[]>;
  } = {},
): Promise<ResearchDashboardSessionReadResult> {
  const aggregateReader = readers.aggregate || getDailyAggregateDashboardSessionsForManagementByLocalDateRange;
  const canonicalReader = readers.canonical || getDashboardSessionsForManagementByLocalDateRange;
  try {
    const aggregateSessions = await retryResearchDashboardRead(
      'daily_aggregates_and_students',
      () => aggregateReader(start, end),
    );
    if (aggregateSessions.length > 0) {
      return { sessions: aggregateSessions, source: 'daily_aggregate', aggregateError: '' };
    }
    const canonicalSessions = await retryResearchDashboardRead(
      'sessions_and_students_fallback',
      () => canonicalReader(start, end),
    );
    return { sessions: canonicalSessions, source: 'canonical_fallback', aggregateError: 'empty_aggregate' };
  } catch (error) {
    const aggregateError = errorText(error);
    console.warn('Research dashboard aggregate read fallback', { aggregateError });
    const canonicalSessions = await retryResearchDashboardRead(
      'sessions_and_students_fallback',
      () => canonicalReader(start, end),
    );
    return { sessions: canonicalSessions, source: 'canonical_fallback', aggregateError };
  }
}

async function loadSessionsResilient(start?: unknown, end?: unknown): Promise<Record<string, any>[]> {
  return (await readResearchDashboardSessionsWithFallback(start, end)).sessions;
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

async function loadOptionalLessonContextOverrides(): Promise<{ records: Awaited<ReturnType<typeof getAllAnalysisSessionOverrides>>; warnings: string[] }> {
  try {
    return {
      records: await retryResearchDashboardRead('lesson_context_overrides', () => getAllAnalysisSessionOverrides()),
      warnings: [],
    };
  } catch (error: any) {
    console.error('Research dashboard lesson-context override read failed', { message: error?.message });
    return {
      records: [],
      warnings: ['lesson_context_overrides_unavailable'],
    };
  }
}

const resilientDashboardHandler: RequestHandler = async (req, res) => {
  const requestStartedAt = Date.now();
  try {
    const query = req.query as PhaseAwareResearchQuery;
    const readPlan = researchDashboardReadPlan(query);
    const studyPhase = readPlan.loadStudySchedules ? normalizeStudyPhaseFilter(query.studyPhase) : '';
    const readStartedAt = Date.now();
    const schedulePromise = readPlan.loadStudySchedules
      ? loadStudySchedulesResilient()
      : Promise.resolve([] as StudyScheduleRecord[]);
    const [schedules, sessionSnapshot, reflectionSnapshot, lessonOverrideSnapshot] = await Promise.all([
      schedulePromise,
      readResearchDashboardSessionsWithFallback(readPlan.start, readPlan.end),
      loadOptionalReflections(readPlan.start, readPlan.end),
      loadOptionalLessonContextOverrides(),
    ]);
    const readMs = Date.now() - readStartedAt;
    const sessions = sessionSnapshot.sessions;

    const analysisSessions = sessions.filter((session) => !isManualResearchExcludedSessionId(session.sessionId));
    const phaseSessionsRaw = filterSessionsForStudyPhase(sessions, schedules, studyPhase);
    const phaseSessions = filterSessionsForStudyPhase(analysisSessions, schedules, studyPhase);
    const phaseReflections = filterReflectionsForStudyPhase(reflectionSnapshot.records, schedules, studyPhase);
    const dashboardStartedAt = Date.now();
    const dashboardBuilt = buildResearchDashboardData(phaseSessions, query, { includeInternal: true }) as any;
    const { __internal: dashboardInternal = {}, ...dashboard } = dashboardBuilt;
    const dashboardMs = Date.now() - dashboardStartedAt;
    const manualExcludedCount = Math.max(0, phaseSessionsRaw.length - phaseSessions.length);
    const lessonReflectionRowCount = buildResearchLessonReflectionRows(
      phaseReflections,
      normalizeFormalResearchExportQuery(query),
    ).length;
    const lessonCodebookCount = buildResearchLessonReflectionCodebookRows().length;
    // Questionnaire answer data are not read here. Only the static CSV schema length
    // is included so the seven-file codebook card reports the correct definition count.
    const questionnaireCodebookCount = QUESTIONNAIRE_EXPORT_HEADERS.length;
    const exportFiles = dashboard.exportFiles.map((file: any) => file.dataset === 'codebook'
      ? { ...file, rowCount: Number(file.rowCount || 0) + lessonCodebookCount + questionnaireCodebookCount }
      : file);
    const filters = { ...dashboard.filters, studyPhases: [...STUDY_PHASE_FILTER_IDS] } as Record<string, unknown>;
    delete filters.labelConditions;
    const dashboardWarnings = [
      ...reflectionSnapshot.warnings,
      ...lessonOverrideSnapshot.warnings,
      ...(manualExcludedCount > 0 ? [`manual_research_exclusions:${manualExcludedCount}`] : []),
      'session_audit_details_lazy',
    ];

    const phaseStartedAt = Date.now();
    const preparedPhaseSessions = Array.isArray(dashboardInternal.exportSessions) ? dashboardInternal.exportSessions : [];
    const lessonOverrideBySession = new Map(
      lessonOverrideSnapshot.records
        .filter((row) => ['in_lesson','outside_lesson','unknown'].includes(String(row.lessonContextFinal || '')))
        .map((row) => [String(row.sessionId || ''), String(row.lessonContextFinal || '')]),
    );
    const overrideRecordBySession = new Map(
      lessonOverrideSnapshot.records.map((row) => [String(row.sessionId || ''), row]),
    );
    const lessonSessionIds = new Set<string>(
      preparedPhaseSessions
        .filter((row: any) => {
          const sessionId = String(row.session_id || '');
          const override = overrideRecordBySession.get(sessionId);
          const finalContext = lessonOverrideBySession.get(sessionId) || String(row.lesson_context_inferred || 'unknown');
          const manuallyExcluded = Boolean(override) && (override as any).analysisIncluded === false;
          return !manuallyExcluded && finalContext === 'in_lesson';
        })
        .map((row: any) => String(row.session_id || ''))
        .filter((sessionId: string) => Boolean(sessionId)),
    );
    const filteredPreparedPhaseSessions = filterResearchSessionRows(preparedPhaseSessions, query);
    const lessonCumulativeReflection = buildCumulativeLessonReflectionRows(filteredPreparedPhaseSessions, lessonSessionIds);
    const phaseComparison = preparedPhaseSessions.length || analysisSessions.length === 0
      ? buildConsistentPhaseComparisonFromExportSessions(preparedPhaseSessions, schedules, query)
      : buildConsistentPhaseComparison(analysisSessions, schedules, query);
    const phaseMs = Date.now() - phaseStartedAt;
    const totalMs = Date.now() - requestStartedAt;
    res.locals.researchDashboardSessions = analysisSessions;
    res.locals.researchDashboardSchedules = schedules;
    res.locals.researchDashboardExportSessions = preparedPhaseSessions;
    res.locals.researchDashboardLessonSessionIds = lessonSessionIds;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Server-Timing', `reads;dur=${readMs}, dashboard;dur=${dashboardMs}, audit;dur=0;desc="lazy", phase;dur=${phaseMs}, core;dur=${totalMs}`);
    console.info('Research dashboard timing', {
      totalMs,
      readMs,
      dashboardMs,
      auditMs: 0,
      phaseMs,
      loadedSessions: sessions.length,
      sessionSource: sessionSnapshot.source,
      aggregateError: sessionSnapshot.aggregateError,
      loadedReflections: reflectionSnapshot.records.length,
      start: typeof query.start === 'string' ? query.start : '',
      end: typeof query.end === 'string' ? query.end : '',
      effectiveStart: typeof readPlan.start === 'string' ? readPlan.start : '',
      effectiveEnd: typeof readPlan.end === 'string' ? readPlan.end : '',
      derivedPilotBRange: readPlan.derivedPilotBRange,
      schedulesLoaded: readPlan.loadStudySchedules,
      dataScope: readPlan.dataScope,
    });
    return res.json({
      ...dashboard,
      charts: {
        ...dashboard.charts,
        lessonCumulativeReflection,
      },
      dataQuality: manualExcludedCount > 0
        ? [...dashboard.dataQuality, { label: '研究分析対象外: 手動除外', value: manualExcludedCount }]
        : dashboard.dataQuality,
      filters,
      exportFiles,
      lessonReflectionRowCount,
      sessionAudit: null,
      sessionAuditDetails: null,
      sessionAuditLazy: true,
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
      const readPlan = researchDashboardReadPlan(query);
      let phaseComparison = body.phaseComparison;
      if (!phaseComparison) {
        try {
          const sessions = Array.isArray(res.locals.researchDashboardSessions)
            ? res.locals.researchDashboardSessions
            : (await loadSessionsResilient(readPlan.start, readPlan.end)).filter((session) => !isManualResearchExcludedSessionId(session.sessionId));
          const schedules = Array.isArray(res.locals.researchDashboardSchedules)
            ? res.locals.researchDashboardSchedules
            : readPlan.loadStudySchedules
              ? await loadStudySchedulesResilient()
              : [];
          const prepared = Array.isArray(res.locals.researchDashboardExportSessions)
            ? res.locals.researchDashboardExportSessions
            : [];
          phaseComparison = prepared.length || sessions.length === 0
            ? buildConsistentPhaseComparisonFromExportSessions(prepared, schedules, query)
            : buildConsistentPhaseComparison(sessions, schedules, query);
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
