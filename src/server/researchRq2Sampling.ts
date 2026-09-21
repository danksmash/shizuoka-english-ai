import crypto from 'node:crypto';
import { buildResearchExportDataSets, researchDataScopeForRow } from './researchDashboard';
import { filterManualResearchExcludedSessions } from './researchManualExclusions';
import { analysisPeriodForLocalDate, phaseForLocalDate, type StudyScheduleRecord } from './studySchedulePersistence';

export const RQ2_STRATA = [
  'intervention_phase1',
  'intervention_phase2',
  'intervention_phase3',
  'comparison_period1',
  'comparison_period2',
  'comparison_period3',
] as const;
export type Rq2StratumId = typeof RQ2_STRATA[number];
export type Rq2Purpose = 'codebook_development' | 'reliability' | 'main_other';

export const RQ2_STRATUM_LABELS: Record<Rq2StratumId, string> = {
  intervention_phase1: '実践校 Phase 1',
  intervention_phase2: '実践校 Phase 2',
  intervention_phase3: '実践校 Phase 3',
  comparison_period1: '比較校 対応期間1',
  comparison_period2: '比較校 対応期間2',
  comparison_period3: '比較校 対応期間3',
};

export interface Rq2Candidate {
  sequenceId: string;
  stratum: Rq2StratumId;
  researchId: string;
  classId: string;
  sessionId: string;
  localDate: string;
  lessonContext: string;
  topic: string;
  personaId: string;
  childUtteranceId: string;
  childTurnSequence: number;
  previousAiEnglish: string;
  childEnglish: string;
  nextAiEnglish: string;
}

export interface Rq2SampledItem extends Rq2Candidate {
  purpose: Rq2Purpose;
  stratumRank: number;
}


function localDateOf(session: Record<string, any>): string {
  const stored = String(session.localDate || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(stored)) return stored;
  const raw = session.startedAt || session.endedAt;
  const date = raw ? new Date(raw) : null;
  return date && Number.isFinite(date.getTime())
    ? date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
    : '';
}

function stratumFor(sessionRow: Record<string, any>, schedule: StudyScheduleRecord | undefined): Rq2StratumId | '' {
  if (!schedule) return '';
  const condition = String(sessionRow.school_condition || '');
  const localDate = String(sessionRow.local_date || '');
  if (condition === 'comparison') {
    const period = analysisPeriodForLocalDate(localDate, schedule);
    return period === 'period1' ? 'comparison_period1'
      : period === 'period2' ? 'comparison_period2'
      : period === 'period3' ? 'comparison_period3'
      : '';
  }
  const phase = phaseForLocalDate(localDate, schedule);
  return phase === 'unknown_virtual_other' ? 'intervention_phase1'
    : phase === 'anticipated_other' ? 'intervention_phase2'
    : phase === 'identified_real_other' ? 'intervention_phase3'
    : '';
}

export function buildRq2Candidates(
  rawSessions: Record<string, any>[],
  schedules: StudyScheduleRecord[],
  options: { lessonOnly?: boolean } = {},
): Rq2Candidate[] {
  const sessions = filterManualResearchExcludedSessions(rawSessions);
  const datasets = buildResearchExportDataSets(sessions);
  const sessionRows = new Map(datasets.sessions.map((row: any) => [String(row.session_id || ''), row]));
  const utteranceRowsBySession = new Map<string, Record<string, any>[]>();
  for (const row of datasets.utterances as Record<string, any>[]) {
    const sessionId = String(row.session_id || '');
    const list = utteranceRowsBySession.get(sessionId) || [];
    list.push(row);
    utteranceRowsBySession.set(sessionId, list);
  }
  for (const rows of utteranceRowsBySession.values()) rows.sort((a, b) => Number(a.turn_sequence || 0) - Number(b.turn_sequence || 0));
  const scheduleByClass = new Map(schedules.map((schedule) => [schedule.classId, schedule]));
  const out: Rq2Candidate[] = [];

  for (const session of sessions) {
    const sessionId = String(session.sessionId || '');
    const row = sessionRows.get(sessionId);
    if (!row || String(row.data_quality_flag || '') !== 'complete') continue;
    const localDate = String(row.local_date || localDateOf(session));
    const scope = researchDataScopeForRow({
      class_id: row.class_id || session.classId || '',
      local_date: localDate,
      formal_study_participant: row.formal_study_participant ?? (session.formalStudyParticipant ? 1 : 0),
      school_condition: row.school_condition || session.schoolCondition || '',
      study_start_date: row.study_start_date || session.studyStartDate || '',
    });
    if (scope !== 'main') continue;
    if (options.lessonOnly && String(row.lesson_context_inferred || '') !== 'in_lesson') continue;
    const classId = String(row.class_id || session.classId || '');
    const stratum = stratumFor(row, scheduleByClass.get(classId));
    if (!stratum) continue;

    const utterances = utteranceRowsBySession.get(sessionId) || [];
    for (let index = 0; index < utterances.length; index += 1) {
      const current = utterances[index];
      if (String(current.speaker || '') !== 'child') continue;
      const previous = index > 0 && String(utterances[index - 1].speaker || '') === 'ai' ? utterances[index - 1] : null;
      const next = index + 1 < utterances.length && String(utterances[index + 1].speaker || '') === 'ai' ? utterances[index + 1] : null;
      const childText = String(current.english_text_anonymized || '').trim();
      if (!childText) continue;
      const childUtteranceId = String(current.utterance_id || `turn-${current.turn_sequence || index + 1}`);
      out.push({
        sequenceId: `${sessionId}::${childUtteranceId}`,
        stratum,
        researchId: String(row.research_id || ''),
        classId,
        sessionId,
        localDate,
        lessonContext: String(row.lesson_context_inferred || ''),
        topic: String(row.topic || ''),
        personaId: String(row.persona_id || ''),
        childUtteranceId,
        childTurnSequence: Number(current.turn_sequence || index + 1),
        previousAiEnglish: previous ? String(previous.english_text_anonymized || '') : '',
        childEnglish: childText,
        nextAiEnglish: next ? String(next.english_text_anonymized || '') : '',
      });
    }
  }
  return out;
}

function score(seed: string, value: string): string {
  return crypto.createHash('sha256').update(`${seed}|${value}`).digest('hex');
}

function purposeForRank(rank: number, targetPerStratum: number): Rq2Purpose {
  const dev = Math.round(targetPerStratum * 0.4);
  const reliability = Math.round(targetPerStratum * 0.2);
  if (rank <= dev) return 'codebook_development';
  if (rank <= dev + reliability) return 'reliability';
  return 'main_other';
}

export function sampleRq2Candidates(
  candidates: Rq2Candidate[],
  seed: string,
  targetPerStratum = 50,
  maxPerParticipantPerStratum = 2,
): { items: Rq2SampledItem[]; counts: Record<Rq2StratumId, { candidates: number; participants: number; selected: number; shortfall: number }> } {
  const items: Rq2SampledItem[] = [];
  const counts = {} as Record<Rq2StratumId, { candidates: number; participants: number; selected: number; shortfall: number }>;

  for (const stratum of RQ2_STRATA) {
    const bucket = candidates.filter((item) => item.stratum === stratum);
    const byParticipant = new Map<string, Rq2Candidate[]>();
    for (const item of bucket) {
      if (!item.researchId) continue;
      const list = byParticipant.get(item.researchId) || [];
      list.push(item);
      byParticipant.set(item.researchId, list);
    }
    const participants = [...byParticipant.keys()].sort((a, b) => score(seed, `${stratum}|p|${a}`).localeCompare(score(seed, `${stratum}|p|${b}`)));
    for (const researchId of participants) {
      byParticipant.get(researchId)!.sort((a, b) => score(seed, `${stratum}|s|${a.sequenceId}`).localeCompare(score(seed, `${stratum}|s|${b.sequenceId}`)));
    }

    const selected: Rq2Candidate[] = [];
    for (let pass = 0; pass < maxPerParticipantPerStratum && selected.length < targetPerStratum; pass += 1) {
      for (const researchId of participants) {
        if (selected.length >= targetPerStratum) break;
        const candidate = byParticipant.get(researchId)?.[pass];
        if (candidate) selected.push(candidate);
      }
    }

    selected.forEach((item, index) => items.push({
      ...item,
      purpose: purposeForRank(index + 1, targetPerStratum),
      stratumRank: index + 1,
    }));
    counts[stratum] = {
      candidates: bucket.length,
      participants: participants.length,
      selected: selected.length,
      shortfall: Math.max(0, targetPerStratum - selected.length),
    };
  }
  return { items, counts };
}

export function summarizeRq2Candidates(candidates: Rq2Candidate[]) {
  return RQ2_STRATA.map((stratum) => {
    const rows = candidates.filter((item) => item.stratum === stratum);
    return {
      stratum,
      label: RQ2_STRATUM_LABELS[stratum],
      candidates: rows.length,
      participants: new Set(rows.map((item) => item.researchId).filter(Boolean)).size,
      inLesson: rows.filter((item) => item.lessonContext === 'in_lesson').length,
    };
  });
}
