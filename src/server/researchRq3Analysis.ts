import { buildRq2Candidates } from './researchRq2Sampling';
import type { StudyScheduleRecord } from './studySchedulePersistence';

export const INTERACTION_CODES_SCHEMA_VERSION = 'interaction-codes-2026-v1';

export const INTERACTION_CODES_HEADERS = [
  'interaction_schema_version',
  'run_id',
  'codebook_version',
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
  'topic',
  'persona_id',
  'utterance_id',
  'child_turn_sequence',
  'previous_ai_english',
  'child_english',
  'next_ai_english',
  'reference_primary_raw',
  'reference_primary_model',
  'reference_aux_labels',
  'function_primary',
  'function_aux_labels',
  'coding_status',
  'human_coder',
  'human_note',
  'human_coded_at',
  'analysis_ready',
] as const;

export function referenceModelCode(raw: unknown): string {
  const code = String(raw || '');
  return code === 'B2a' || code === 'B2b' ? 'B2' : code;
}

export function buildRq3Candidates(
  rawSessions: Record<string, any>[],
  schedules: StudyScheduleRecord[],
  analysisSessionRows: Record<string, any>[],
) {
  const bySession = new Map(analysisSessionRows.map((row) => [String(row.session_id || ''), row]));
  return buildRq2Candidates(rawSessions, schedules, { lessonOnly: false })
    .map((candidate) => {
      const session = bySession.get(candidate.sessionId);
      if (!session || Number(session.analysis_included || 0) !== 1) return null;
      return {
        ...candidate,
        siteId: String(session.site_id || ''),
        participantKey: String(session.participant_key || ''),
        schoolCondition: String(session.school_condition || ''),
        gradeLevel: session.grade_level ?? '',
        studyPhase: String(session.study_phase || ''),
        analysisPeriod: String(session.analysis_period || ''),
        analysisIncluded: 1,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}

function humanConfirmed(row: Record<string, any>) {
  return row.humanStatus === 'confirmed' || row.humanStatus === 'modified';
}

function finalPrimary(row: Record<string, any>, dimension: 'reference' | 'function') {
  const explicit = dimension === 'reference'
    ? String(row.humanReferencePrimary || '').trim()
    : String(row.humanFunctionPrimary || '').trim();
  if (explicit) return explicit;
  const legacy = dimension === 'reference' ? row.humanReferenceCodes : row.humanFunctionCodes;
  return Array.isArray(legacy) && legacy.length ? String(legacy[0] || '') : '';
}

function finalAux(row: Record<string, any>, dimension: 'reference' | 'function') {
  const explicit = dimension === 'reference' ? row.humanReferenceAuxCodes : row.humanFunctionAuxCodes;
  if (Array.isArray(explicit)) return explicit.map(String).filter(Boolean);
  const legacy = dimension === 'reference' ? row.humanReferenceCodes : row.humanFunctionCodes;
  return Array.isArray(legacy) ? legacy.slice(1).map(String).filter(Boolean) : [];
}

function distribution(rows: Record<string, any>[], getter: (row: Record<string, any>) => string) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const code = getter(row);
    if (code) counts[code] = (counts[code] || 0) + 1;
  }
  const n = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const percentages = Object.fromEntries(Object.entries(counts).map(([code, count]) => [
    code,
    n ? Number(((count / n) * 100).toFixed(1)) : 0,
  ]));
  return { n, counts, percentages };
}

export function buildRq3Distribution(items: Record<string, any>[]) {
  const confirmed = items.filter(humanConfirmed);
  const conditions = ['intervention', 'comparison'];
  const periods = ['period1', 'period2', 'period3'];
  const strata = [];
  for (const schoolCondition of conditions) {
    for (const analysisPeriod of periods) {
      const rows = confirmed.filter((row) =>
        String(row.schoolCondition || '') === schoolCondition
        && String(row.analysisPeriod || '') === analysisPeriod
      );
      strata.push({
        schoolCondition,
        analysisPeriod,
        n: rows.length,
        participants: new Set(rows.map((row) => String(row.participantKey || row.researchId || '')).filter(Boolean)).size,
        referenceRaw: distribution(rows, (row) => finalPrimary(row, 'reference')),
        referenceModel: distribution(rows, (row) => referenceModelCode(finalPrimary(row, 'reference'))),
        functions: distribution(rows, (row) => finalPrimary(row, 'function')),
      });
    }
  }
  return {
    codingRule: '人間確認済みの主コードのみ正式分布に含める。参照基盤B2a/B2bは記述では保持し、多項モデル用分布ではB2へ統合する。',
    confirmedN: confirmed.length,
    pendingN: Math.max(0, items.length - confirmed.length),
    strata,
  };
}

export function buildInteractionCodeRows(
  items: Record<string, any>[],
  run: Record<string, any>,
) {
  return items.map((item) => {
    const confirmed = humanConfirmed(item);
    const referenceRaw = confirmed ? finalPrimary(item, 'reference') : '';
    const functionPrimary = confirmed ? finalPrimary(item, 'function') : '';
    return {
      interaction_schema_version: INTERACTION_CODES_SCHEMA_VERSION,
      run_id: String(run.runId || item.runId || ''),
      codebook_version: String(run.codebookVersion || item.aiCodebookVersion || ''),
      site_id: String(item.siteId || ''),
      research_id: String(item.researchId || ''),
      participant_key: String(item.participantKey || ''),
      school_condition: String(item.schoolCondition || ''),
      class_id: String(item.classId || ''),
      grade_level: item.gradeLevel ?? '',
      session_id: String(item.sessionId || ''),
      local_date: String(item.localDate || ''),
      study_phase: String(item.studyPhase || ''),
      analysis_period: String(item.analysisPeriod || ''),
      topic: String(item.topic || ''),
      persona_id: String(item.personaId || ''),
      utterance_id: String(item.childUtteranceId || ''),
      child_turn_sequence: Number(item.childTurnSequence || 0),
      previous_ai_english: String(item.previousAiEnglish || ''),
      child_english: String(item.childEnglish || ''),
      next_ai_english: String(item.nextAiEnglish || ''),
      reference_primary_raw: referenceRaw,
      reference_primary_model: referenceModelCode(referenceRaw),
      reference_aux_labels: confirmed ? finalAux(item, 'reference').join('|') : '',
      function_primary: functionPrimary,
      function_aux_labels: confirmed ? finalAux(item, 'function').join('|') : '',
      coding_status: confirmed ? String(item.humanStatus || 'confirmed') : 'pending',
      human_coder: confirmed ? String(item.humanCoder || '') : '',
      human_note: confirmed ? String(item.humanNote || '') : '',
      human_coded_at: confirmed ? String(item.humanCodedAt || '') : '',
      analysis_ready: confirmed && referenceRaw && functionPrimary ? 1 : 0,
    };
  });
}

function csvCell(value: unknown) {
  const raw = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function serializeInteractionCodesCsv(rows: Record<string, any>[]) {
  const headers = [...INTERACTION_CODES_HEADERS];
  return '\uFEFF' + [
    headers.map(csvCell).join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ].join('\n') + '\n';
}
