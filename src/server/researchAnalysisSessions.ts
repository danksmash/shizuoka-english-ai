import { listCollection, setDocument } from './firestore';
import {
  buildResearchExportDataSets,
  researchDataScopeForRow,
} from './researchDashboard';
import {
  analysisPeriodForLocalDate,
  phaseForLocalDate,
  type StudyScheduleRecord,
} from './studySchedulePersistence';
import { getManualResearchExclusion } from './researchManualExclusions';

export const RESEARCH_ANALYSIS_SESSION_OVERRIDE_COLLECTION = 'research_analysis_session_overrides';
export const ANALYSIS_SESSION_SCHEMA_VERSION = 'analysis-session-2026-v1';

export const ANALYSIS_SESSION_HEADERS = [
  'analysis_schema_version',
  'site_id',
  'research_id',
  'participant_key',
  'school_condition',
  'class_id',
  'grade_level',
  'session_id',
  'local_date',
  'study_phase',
  'analysis_period',
  'data_scope',
  'data_quality_flag',
  'lesson_context_inferred',
  'lesson_context_final',
  'analysis_included_default',
  'analysis_included',
  'analysis_decision_source',
  'exclusion_reason',
  'decision_note',
  'decision_updated_at',
] as const;

function safeId(value: unknown): string {
  return String(value || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 180);
}

export async function getAllAnalysisSessionOverrides() {
  const rows = await listCollection(RESEARCH_ANALYSIS_SESSION_OVERRIDE_COLLECTION, 1000);
  return rows.filter((row) => String(row.sessionId || ''));
}

export async function saveAnalysisSessionOverride(args: {
  sessionId: string;
  analysisIncluded: boolean;
  lessonContextFinal?: string;
  note?: string;
  updatedBy: string;
}) {
  const sessionId = String(args.sessionId || '').trim();
  if (!sessionId) throw new Error('RQ3_SESSION_ID_REQUIRED');
  const lessonContextFinal = ['in_lesson', 'outside_lesson', 'unknown'].includes(String(args.lessonContextFinal || ''))
    ? String(args.lessonContextFinal)
    : '';
  const record = {
    sessionId,
    analysisIncluded: Boolean(args.analysisIncluded),
    lessonContextFinal,
    note: String(args.note || '').trim().slice(0, 500),
    updatedAt: new Date().toISOString(),
    updatedBy: String(args.updatedBy || 'researcher').slice(0, 100),
  };
  await setDocument(RESEARCH_ANALYSIS_SESSION_OVERRIDE_COLLECTION, safeId(sessionId), record);
  return record;
}

function phaseId(row: Record<string, any>, schedule: StudyScheduleRecord | undefined): string {
  if (!schedule || String(row.school_condition || '') === 'comparison') return '';
  const phase = phaseForLocalDate(String(row.local_date || ''), schedule);
  if (phase === 'unknown_virtual_other') return 'phase1';
  if (phase === 'anticipated_other') return 'phase2';
  if (phase === 'identified_real_other') return 'phase3';
  if (phase === 'exchange_or_after') return 'phase4';
  return '';
}

function hardExclusionReason(
  row: Record<string, any>,
  dataScope: string,
  analysisPeriod: string,
  manualReason: string,
): string {
  if (manualReason) return `manual:${manualReason}`;
  if (dataScope !== 'main') return `data_scope:${dataScope || 'unknown'}`;
  if (String(row.data_quality_flag || '') !== 'complete') return `data_quality:${String(row.data_quality_flag || 'unknown')}`;
  if (!analysisPeriod) return 'outside_analysis_period';
  return '';
}

export async function buildAnalysisSessionRows(
  rawSessions: Record<string, any>[],
  schedules: StudyScheduleRecord[],
) {
  const datasets = buildResearchExportDataSets(rawSessions);
  const scheduleByClass = new Map(schedules.map((schedule) => [schedule.classId, schedule]));
  const overrides = await getAllAnalysisSessionOverrides();
  const overrideBySession = new Map(overrides.map((row) => [String(row.sessionId || ''), row]));

  return datasets.sessions.map((row: Record<string, any>) => {
    const sessionId = String(row.session_id || '');
    const classId = String(row.class_id || '');
    const schedule = scheduleByClass.get(classId);
    const analysisPeriod = schedule ? analysisPeriodForLocalDate(String(row.local_date || ''), schedule) : '';
    const studyPhase = phaseId(row, schedule);
    const dataScope = researchDataScopeForRow(row);
    const manual = getManualResearchExclusion(sessionId);
    const hardReason = hardExclusionReason(row, dataScope, analysisPeriod, manual?.reason || '');
    const inferred = String(row.lesson_context_inferred || 'unknown');
    const defaultIncluded = !hardReason && inferred === 'in_lesson';
    const override = overrideBySession.get(sessionId);
    const lessonContextFinal = override?.lessonContextFinal || inferred;
    const requestedIncluded = override ? Boolean(override.analysisIncluded) : defaultIncluded;
    const included = !hardReason && requestedIncluded && lessonContextFinal === 'in_lesson';
    const exclusionReason = included
      ? ''
      : hardReason
        || (override && !requestedIncluded ? 'manual_override_excluded' : '')
        || (lessonContextFinal === 'outside_lesson' ? 'outside_lesson' : 'lesson_context_not_confirmed');
    const siteId = String(row.site_id || '');
    const researchId = String(row.research_id || '');
    return {
      analysis_schema_version: ANALYSIS_SESSION_SCHEMA_VERSION,
      site_id: siteId,
      research_id: researchId,
      participant_key: [siteId, researchId].filter(Boolean).join(':'),
      school_condition: String(row.school_condition || ''),
      class_id: classId,
      grade_level: row.grade_level ?? '',
      session_id: sessionId,
      local_date: String(row.local_date || ''),
      study_phase: studyPhase,
      analysis_period: analysisPeriod,
      data_scope: dataScope,
      data_quality_flag: String(row.data_quality_flag || ''),
      lesson_context_inferred: inferred,
      lesson_context_final: lessonContextFinal,
      analysis_included_default: defaultIncluded ? 1 : 0,
      analysis_included: included ? 1 : 0,
      analysis_decision_source: override ? 'manual_override' : 'default_rule',
      exclusion_reason: exclusionReason,
      decision_note: String(override?.note || ''),
      decision_updated_at: String(override?.updatedAt || ''),
    };
  });
}

function csvCell(value: unknown) {
  const raw = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function serializeAnalysisSessionsCsv(rows: Record<string, any>[]) {
  const headers = [...ANALYSIS_SESSION_HEADERS];
  return '\uFEFF' + [
    headers.map(csvCell).join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ].join('\n') + '\n';
}
