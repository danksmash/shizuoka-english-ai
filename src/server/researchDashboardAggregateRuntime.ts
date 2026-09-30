import type { RequestHandler } from 'express';
import {
  buildResearchDashboardDataFromAggregateSessions,
  type ResearchDashboardAggregateSession,
} from './researchDashboardAggregate';
import {
  flattenStoredResearchDashboardAggregateSessions,
  getStoredResearchDashboardAggregateState,
  loadStoredResearchDashboardAggregates,
  refreshStoredResearchDashboardAggregatesToDate,
} from './researchDashboardAggregateStorage';
import {
  researchDashboardEffectiveReadRange,
  researchDashboardNeedsStudySchedules,
  resilientResearchDashboardGetHandler,
  retryResearchDashboardRead,
} from './researchDashboardResilientRuntime';
import { getReflectionRecordsForTeacherDateRange } from './reflectionPersistence';
import {
  buildResearchLessonReflectionCodebookRows,
  buildResearchLessonReflectionRows,
} from './researchLessonReflectionExport';
import { normalizeFormalResearchExportQuery, type ResearchFilterQuery } from './researchDashboard';
import { getAllStudySchedules, type StudyScheduleRecord } from './studySchedulePersistence';
import { STUDY_PHASE_FILTER_IDS, normalizeStudyPhaseFilter } from './researchPhaseRuntime';
import { QUESTIONNAIRE_EXPORT_HEADERS } from './questionnaireResearch';
import {
  buildConsistentPhaseComparisonFromExportSessions,
} from './researchPhaseDashboardConsistency';
import {
  MANUAL_RESEARCH_EXCLUSIONS,
  isManualResearchExcludedSessionId,
} from './researchManualExclusions';

type PhaseAwareResearchQuery = ResearchFilterQuery & { studyPhase?: unknown; dataset?: unknown };

function jstToday(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function queryText(value: unknown): string {
  if (Array.isArray(value)) return queryText(value[0]);
  return typeof value === 'string' ? value.trim() : '';
}

async function loadSchedulesIfNeeded(needsSchedules: boolean): Promise<StudyScheduleRecord[]> {
  if (!needsSchedules) return [];
  return retryResearchDashboardRead('aggregate_study_schedules', () => getAllStudySchedules());
}

async function loadOptionalReflections(start?: unknown, end?: unknown) {
  try {
    return {
      records: await retryResearchDashboardRead(
        'aggregate_lesson_reflections',
        () => getReflectionRecordsForTeacherDateRange(start, end),
      ),
      warnings: [] as string[],
    };
  } catch (error: any) {
    console.error('Aggregate dashboard optional reflection read failed', { message: error?.message });
    return { records: [], warnings: ['lesson_reflections_unavailable'] };
  }
}

/**
 * Uses compact materialized session summaries for the normal dashboard path.
 * Any uncertainty falls back to the existing resilient Raw path; research data
 * correctness takes precedence over the optimization.
 */
export function aggregateAwareResearchDashboardGetHandler(path: string): RequestHandler | null {
  if (path !== '/api/management/research.dashboard') return null;
  const fallback = resilientResearchDashboardGetHandler(path);
  if (!fallback) return null;

  return async (req, res, next) => {
    const startedAt = Date.now();
    const query = req.query as PhaseAwareResearchQuery;

    // Existing downstream graph wrappers rebuild export rows from Raw sessions
    // when a Study Phase filter is active. Keep that less-common path on the
    // proven Raw implementation until those wrappers are migrated as well.
    if (normalizeStudyPhaseFilter(query.studyPhase)) return fallback(req, res, next);

    try {
      const state = await retryResearchDashboardRead(
        'aggregate_state',
        () => getStoredResearchDashboardAggregateState(),
      );
      if (!state || state.status !== 'ready') return fallback(req, res, next);

      const today = jstToday();
      const explicitEnd = queryText(query.end);
      const shouldRefresh = !explicitEnd || explicitEnd >= today;
      let refreshedDocuments = 0;
      if (shouldRefresh) {
        refreshedDocuments = await retryResearchDashboardRead(
          'aggregate_incremental_refresh',
          () => refreshStoredResearchDashboardAggregatesToDate(today),
        );
      }

      const readPlan = researchDashboardEffectiveReadRange(query as Record<string, unknown>);
      const needsSchedules = researchDashboardNeedsStudySchedules(query as Record<string, unknown>);
      const readStartedAt = Date.now();
      const [aggregateSnapshot, schedules, reflectionSnapshot] = await Promise.all([
        retryResearchDashboardRead(
          'dashboard_aggregate_documents',
          () => loadStoredResearchDashboardAggregates(readPlan.start, readPlan.end),
        ),
        loadSchedulesIfNeeded(needsSchedules),
        loadOptionalReflections(readPlan.start, readPlan.end),
      ]);
      const readMs = Date.now() - readStartedAt;
      if (!aggregateSnapshot.available) return fallback(req, res, next);

      const allAggregateSessions = flattenStoredResearchDashboardAggregateSessions(aggregateSnapshot.documents);
      const analysisSessions = allAggregateSessions.filter((row) => !isManualResearchExcludedSessionId(String(row.session_id || '')));
      const manualExcludedCount = Math.max(0, allAggregateSessions.length - analysisSessions.length);

      const dashboardStartedAt = Date.now();
      const dashboardBuilt = buildResearchDashboardDataFromAggregateSessions(
        analysisSessions as ResearchDashboardAggregateSession[],
        query,
        { includeInternal: true },
      ) as any;
      const { __internal: dashboardInternal = {}, ...dashboard } = dashboardBuilt;
      const dashboardMs = Date.now() - dashboardStartedAt;

      const lessonReflectionRowCount = buildResearchLessonReflectionRows(
        reflectionSnapshot.records,
        normalizeFormalResearchExportQuery(query),
      ).length;
      const lessonCodebookCount = buildResearchLessonReflectionCodebookRows().length;
      const questionnaireCodebookCount = QUESTIONNAIRE_EXPORT_HEADERS.length;
      const exportFiles = dashboard.exportFiles.map((file: any) => file.dataset === 'codebook'
        ? { ...file, rowCount: Number(file.rowCount || 0) + lessonCodebookCount + questionnaireCodebookCount }
        : file);
      const filters = { ...dashboard.filters, studyPhases: [...STUDY_PHASE_FILTER_IDS] } as Record<string, unknown>;
      delete filters.labelConditions;

      const preparedPhaseSessions = Array.isArray(dashboardInternal.exportSessions)
        ? dashboardInternal.exportSessions
        : analysisSessions;
      const phaseStartedAt = Date.now();
      const phaseComparison = buildConsistentPhaseComparisonFromExportSessions(
        preparedPhaseSessions,
        schedules,
        query,
      );
      const phaseMs = Date.now() - phaseStartedAt;
      const totalMs = Date.now() - startedAt;

      // The daily/words dashboard enrichers reuse this prepared compact snapshot
      // when no Study Phase filter is active, avoiding a second Raw parse.
      res.locals.researchDashboardSessions = [];
      res.locals.researchDashboardSchedules = schedules;
      res.locals.researchDashboardExportSessions = preparedPhaseSessions;
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Server-Timing', `aggregate-reads;dur=${readMs}, dashboard;dur=${dashboardMs}, phase;dur=${phaseMs}, core;dur=${totalMs}`);
      console.info('Research dashboard aggregate timing', {
        dataSource: 'materialized-aggregate',
        totalMs,
        readMs,
        dashboardMs,
        phaseMs,
        rawSessionsLoaded: 0,
        aggregateDocuments: aggregateSnapshot.documents.length,
        aggregateSessions: allAggregateSessions.length,
        refreshedDocuments,
        requestedStart: readPlan.requestedStart,
        requestedEnd: readPlan.requestedEnd,
        effectiveStart: readPlan.start,
        effectiveEnd: readPlan.end,
        dataScope: readPlan.scope,
      });

      return res.json({
        ...dashboard,
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
        dashboardWarnings: [
          ...reflectionSnapshot.warnings,
          ...(manualExcludedCount > 0 ? [`manual_research_exclusions:${manualExcludedCount}`] : []),
          'materialized_aggregate_active',
        ],
        phaseComparison,
      });
    } catch (error: any) {
      console.error('Materialized aggregate dashboard failed; using Raw fallback', {
        name: error?.name,
        message: error?.message,
      });
      return fallback(req, res, next);
    }
  };
}
