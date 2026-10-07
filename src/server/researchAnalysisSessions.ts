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
import {
  dialogueAnalysisEligible,
  qualityExclusionReason,
  reflectionAnalysisEligible,
} from './researchAnalysisEligibility';

export const RESEARCH_ANALYSIS_SESSION_OVERRIDE_COLLECTION = 'research_analysis_session_overrides';
export const ANALYSIS_SESSION_SCHEMA_VERSION = 'analysis-session-2026-v3';

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
  'dialogue_analysis_eligible',
  'dialogue_analysis_included',
  'dialogue_exclusion_reason',
  'reflection_analysis_eligible',
  'reflection_analysis_included',
  'reflection_exclusion_reason',
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

function structuralExclusionReason(
  dataScope: string,
  analysisPeriod: string,
  manualReason: string,
): string {
  if (manualReason) return `manual:${manualReason}`;
  if (dataScope !== 'main') return `data_scope:${dataScope || 'unknown'}`;
  if (!analysisPeriod) return 'outside_analysis_period';
  return '';
}

function legacyHardExclusionReason(
  row: Record<string, any>,
  dataScope: string,
  analysisPeriod: string,
  manualReason: string,
): string {
  const structural = structuralExclusionReason(dataScope, analysisPeriod, manualReason);
  if (structural) return structural;
  if (String(row.data_quality_flag || '') !== 'complete') return `data_quality:${String(row.data_quality_flag || 'unknown')}`;
  return '';
}

function finalExclusionReason(args: {
  structuralReason: string;
  qualityReason: string;
  overridePresent: boolean;
  requestedIncluded: boolean;
  lessonContextFinal: string;
}) {
  if (args.structuralReason) return args.structuralReason;
  if (args.qualityReason) return args.qualityReason;
  if (args.overridePresent && !args.requestedIncluded) return 'manual_override_excluded';
  if (args.lessonContextFinal === 'outside_lesson') return 'outside_lesson';
  if (args.lessonContextFinal !== 'in_lesson') return 'lesson_context_not_confirmed';
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
    const manualReason = manual?.reason || '';
    const structuralReason = structuralExclusionReason(dataScope, analysisPeriod, manualReason);
    const legacyHardReason = legacyHardExclusionReason(row, dataScope, analysisPeriod, manualReason);
    const inferred = String(row.lesson_context_inferred || 'unknown');
    const override = overrideBySession.get(sessionId);
    const lessonContextFinal = override?.lessonContextFinal || inferred;

    const legacyDefaultIncluded = !legacyHardReason && inferred === 'in_lesson';
    const legacyRequestedIncluded = override ? Boolean(override.analysisIncluded) : legacyDefaultIncluded;
    const legacyIncluded = !legacyHardReason && legacyRequestedIncluded && lessonContextFinal === 'in_lesson';
    const legacyExclusionReason = legacyIncluded
      ? ''
      : legacyHardReason
        || (override && !legacyRequestedIncluded ? 'manual_override_excluded' : '')
        || (lessonContextFinal === 'outside_lesson' ? 'outside_lesson' : 'lesson_context_not_confirmed');

    const purposeDefaultIncluded = !structuralReason && inferred === 'in_lesson';
    const purposeRequestedIncluded = override ? Boolean(override.analysisIncluded) : purposeDefaultIncluded;
    const dataQualityFlag = String(row.data_quality_flag || '');
    const childTurnCount = Math.max(0, Number(row.child_turn_count || 0));
    const dialogueEligible = dialogueAnalysisEligible(dataQualityFlag, childTurnCount);
    const reflectionEligible = reflectionAnalysisEligible(dataQualityFlag);
    const dialogueIncluded = !structuralReason
      && dialogueEligible
      && purposeRequestedIncluded
      && lessonContextFinal === 'in_lesson';
    const reflectionIncluded = !structuralReason
      && reflectionEligible
      && purposeRequestedIncluded
      && lessonContextFinal === 'in_lesson';
    const dialogueExclusionReason = dialogueIncluded ? '' : finalExclusionReason({
      structuralReason,
      qualityReason: qualityExclusionReason(dataQualityFlag, 'dialogue', childTurnCount),
      overridePresent: Boolean(override),
      requestedIncluded: purposeRequestedIncluded,
      lessonContextFinal,
    });
    const reflectionExclusionReason = reflectionIncluded ? '' : finalExclusionReason({
      structuralReason,
      qualityReason: qualityExclusionReason(dataQualityFlag, 'reflection'),
      overridePresent: Boolean(override),
      requestedIncluded: purposeRequestedIncluded,
      lessonContextFinal,
    });

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
      data_quality_flag: dataQualityFlag,
      lesson_context_inferred: inferred,
      lesson_context_final: lessonContextFinal,
      dialogue_analysis_eligible: dialogueEligible ? 1 : 0,
      dialogue_analysis_included: dialogueIncluded ? 1 : 0,
      dialogue_exclusion_reason: dialogueExclusionReason,
      reflection_analysis_eligible: reflectionEligible ? 1 : 0,
      reflection_analysis_included: reflectionIncluded ? 1 : 0,
      reflection_exclusion_reason: reflectionExclusionReason,
      analysis_included_default: legacyDefaultIncluded ? 1 : 0,
      analysis_included: legacyIncluded ? 1 : 0,
      analysis_decision_source: override ? 'manual_override' : 'default_rule',
      exclusion_reason: legacyExclusionReason,
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
