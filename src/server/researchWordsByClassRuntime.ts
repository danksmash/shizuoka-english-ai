import type { RequestHandler } from 'express';
import {
  buildResearchExportDataSets,
  filterResearchSessionRows,
  type ResearchFilterQuery,
} from './researchDashboard';
import {
  filterSessionsForStudyPhase,
  normalizeStudyPhaseFilter,
} from './researchPhaseRuntime';
import { dialogueAnalysisEligible } from './researchAnalysisEligibility';
import { rateEligibleDurationSeconds } from './researchDurationQuality';

type Row = Record<string, unknown>;
type PhaseAwareQuery = ResearchFilterQuery & { studyPhase?: unknown };

type ClassWordsPoint = {
  date: string;
  value: number | null;
  n: number;
  observed?: boolean;
};

type ClassWordsSeries = {
  class_id: string;
  label: string;
  school_condition: 'intervention' | 'comparison' | 'unknown';
  points: ClassWordsPoint[];
};

function researchClassLabel(classId: unknown): string {
  const value = String(classId || '').trim();
  if (!value || value === 'unknown') return '学級不明';
  const intervention = value.match(/^([1-9])-([1-9])$/);
  if (intervention) return `${intervention[1]}年${intervention[2]}組`;
  const comparison = value.match(/^([1-9])-C([1-9])$/i);
  if (comparison) return `${comparison[1]}年比較${comparison[2]}組`;
  return value;
}

function classSortTuple(classId: string): [number, number, number, string] {
  if (classId === 'unknown') return [999, 999, 999, classId];
  const intervention = classId.match(/^([1-9])-([1-9])$/);
  if (intervention) return [Number(intervention[1]), 0, Number(intervention[2]), classId];
  const comparison = classId.match(/^([1-9])-C([1-9])$/i);
  if (comparison) return [Number(comparison[1]), 1, Number(comparison[2]), classId];
  return [900, 0, 0, classId];
}

function compareClassIds(a: string, b: string): number {
  const aa = classSortTuple(a);
  const bb = classSortTuple(b);
  for (let index = 0; index < 3; index += 1) {
    if (aa[index] !== bb[index]) return Number(aa[index]) - Number(bb[index]);
  }
  return String(aa[3]).localeCompare(String(bb[3]), 'ja');
}

function sessionWordsPerMinute(row: Row): number | null {
  const words = Number(row.child_total_words);
  const seconds = rateEligibleDurationSeconds(row);
  const childTurns = Number(row.child_turn_count);
  if (!Number.isFinite(words) || words < 0) return null;
  if (seconds === null) return null;
  if (!Number.isFinite(childTurns) || childTurns <= 0) return null;
  return words * 60 / seconds;
}

function normalizeSchoolCondition(value: unknown): 'intervention' | 'comparison' | 'unknown' {
  const normalized = String(value || '').trim();
  if (normalized === 'intervention' || normalized === 'comparison') return normalized;
  return 'unknown';
}

export function buildCumulativeWordsByClass(
  sessions: Row[],
  lessonSessionIds?: ReadonlySet<string>,
): ClassWordsSeries[] {
  const lessonOnly = lessonSessionIds !== undefined;
  const validSessions = sessions
    .map((row) => ({
      row,
      classId: String(row.class_id || '').trim() || 'unknown',
      date: String(row.local_date || '').trim(),
      wpm: sessionWordsPerMinute(row),
    }))
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date)
      && item.wpm !== null
      && (!lessonOnly || (
        lessonSessionIds.has(String(item.row.session_id || ''))
        && dialogueAnalysisEligible(item.row.data_quality_flag, item.row.child_turn_count)
      )));

  const dates = [...new Set((lessonOnly ? sessions : validSessions)
    .map((item: any) => String((item.row || item).local_date || item.date || '').trim())
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort();
  const classIds = [...new Set(validSessions.map((item) => item.classId))].sort(compareClassIds);

  return classIds.map((classId) => {
    const classRows = validSessions.filter((item) => item.classId === classId);
    const condition = normalizeSchoolCondition(classRows.find((item) => item.row.school_condition)?.row.school_condition);
    let sum = 0;
    let n = 0;
    const points = dates.map((date) => {
      for (const item of classRows) {
        if (item.date !== date || item.wpm === null) continue;
        sum += item.wpm;
        n += 1;
      }
      return {
        date,
        value: n > 0 ? Math.round((sum / n) * 100) / 100 : null,
        n,
        observed: classRows.some((item) => item.date === date),
      };
    });
    return {
      class_id: classId,
      label: researchClassLabel(classId),
      school_condition: condition,
      points,
    };
  });
}

function dashboardFilteredExportSessions(req: any, res: any): Row[] | null {
  const query = req.query as PhaseAwareQuery;
  const studyPhase = normalizeStudyPhaseFilter(query.studyPhase);
  const prepared = res.locals.researchDashboardExportSessions;

  let exportSessions: Row[] | null = null;
  if (!studyPhase && Array.isArray(prepared)) {
    exportSessions = prepared as Row[];
  } else {
    const rawSessions = res.locals.researchDashboardSessions;
    const schedules = res.locals.researchDashboardSchedules;
    if (!Array.isArray(rawSessions) || !Array.isArray(schedules)) return null;
    const phaseSessions = filterSessionsForStudyPhase(rawSessions, schedules, studyPhase);
    exportSessions = buildResearchExportDataSets(phaseSessions).sessions;
  }
  return filterResearchSessionRows(exportSessions, query);
}

function enhanceDashboardJson(req: any, res: any, body: any): any {
  if (!body || body.success === false || !body.charts) return body;
  const sessions = dashboardFilteredExportSessions(req, res);
  if (!sessions) return body;
  const lessonSessionIds = res.locals.researchDashboardLessonSessionIds instanceof Set
    ? res.locals.researchDashboardLessonSessionIds as Set<string>
    : new Set(sessions
      .filter((row) => String(row.lesson_context_inferred || '') === 'in_lesson')
      .map((row) => String(row.session_id || ''))
      .filter(Boolean));
  return {
    ...body,
    charts: {
      ...body.charts,
      cumulativeWordsByClass: buildCumulativeWordsByClass(sessions, lessonSessionIds),
    },
  };
}

export function withResearchWordsByClassRuntime(path: string, handler: RequestHandler): RequestHandler {
  // The unified chart renderer is the sole owner of /management visualizations.
  if (path === '/api/management/research.dashboard') {
    return (req, res, next) => {
      const originalJson = res.json.bind(res);
      (res as any).json = (body: any) => originalJson(enhanceDashboardJson(req, res, body));
      return handler(req, res, next);
    };
  }
  return handler;
}
