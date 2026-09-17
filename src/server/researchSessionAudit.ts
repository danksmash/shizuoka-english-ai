import { getManualResearchExclusion } from './researchManualExclusions';

export type ResearchSessionQuality = 'complete' | 'missing_reflection' | 'interrupted' | 'missing_core';
export type ResearchSessionAuditStatus =
  | 'normal'
  | 'near_start_candidate'
  | 'intentional_restart_or_shadow_candidate'
  | 'restart_partner'
  | 'duplicate_keeper'
  | 'duplicate_start_shadow'
  | 'overlapping_complete_conflict'
  | 'manual_research_exclusion';

export interface ResearchSessionAuditRow {
  session_id: string;
  session_id_short: string;
  research_id: string;
  started_at: string;
  ended_at: string;
  actual_duration_seconds: number;
  persona_id: string;
  topic: string;
  target_duration_minutes: number;
  child_turn_count: number;
  data_quality_flag: ResearchSessionQuality;
  audit_status: ResearchSessionAuditStatus;
  audit_requires_review: 0 | 1;
  paired_session_ids: string[];
  analysis_include_primary: 0 | 1;
  analysis_include_strict: 0 | 1;
  analysis_exclusion_reason: string;
}

export interface ResearchSessionAuditPair {
  research_id: string;
  session_a: string;
  session_b: string;
  start_delta_seconds: number;
  overlap_seconds: number;
  pair_kind: 'exact_duplicate' | 'zero_child_near_valid' | 'overlapping_complete' | 'near_start';
}

export interface ResearchSessionAuditResult {
  rule_version: 'session-audit-v1';
  summary: {
    total_sessions: number;
    complete_sessions: number;
    primary_include_sessions: number;
    strict_include_sessions: number;
    near_start_pairs: number;
    zero_child_near_valid_pairs: number;
    exact_duplicate_shadow_sessions: number;
    overlapping_complete_pairs: number;
    manual_exclusion_sessions: number;
    requires_review_sessions: number;
  };
  rows: ResearchSessionAuditRow[];
  pairs: ResearchSessionAuditPair[];
}

type MutableAuditRow = ResearchSessionAuditRow & {
  _start_ms: number;
  _end_ms: number;
  _created_ms: number;
  _history_identity: string;
};

const STATUS_PRIORITY: Record<ResearchSessionAuditStatus, number> = {
  normal: 0,
  near_start_candidate: 10,
  restart_partner: 20,
  intentional_restart_or_shadow_candidate: 30,
  duplicate_keeper: 40,
  overlapping_complete_conflict: 80,
  duplicate_start_shadow: 100,
  manual_research_exclusion: 120,
};

function timestampMs(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function iso(value: unknown): string {
  const ms = timestampMs(value);
  return ms > 0 ? new Date(ms).toISOString() : '';
}

function sessionHistory(session: Record<string, any>): Record<string, any>[] {
  return Array.isArray(session.history)
    ? session.history.filter((message) => message && typeof message === 'object' && typeof message.englishText === 'string')
    : [];
}

function sessionQuality(session: Record<string, any>): ResearchSessionQuality {
  const sessionId = String(session.sessionId || '');
  const researchId = String(session.researchId || '');
  const history = sessionHistory(session);
  const childMessages = history.filter((message) => message.sender === 'child' && String(message.englishText || '').trim());
  const events = Array.isArray(session.systemEvents) ? session.systemEvents : [];
  const hasFinish = events.some((event: any) => event?.type === 'session_finish');
  const hasReflection = Boolean(session.reflection && typeof session.reflection === 'object');
  const schemaVersion = Number(session.schemaVersion || 0);
  const dialogueCompleted = hasFinish
    || (Boolean(session.endedAt) && hasReflection)
    || (Boolean(session.endedAt) && schemaVersion < 3 && childMessages.length > 0);
  if (!sessionId || !researchId || history.length === 0 || childMessages.length === 0) return 'missing_core';
  if (!dialogueCompleted) return 'interrupted';
  if (!hasReflection) return 'missing_reflection';
  return 'complete';
}

function historyIdentity(session: Record<string, any>): string {
  const history = sessionHistory(session);
  if (!history.length) return '';
  return JSON.stringify(history.map((message) => [
    String(message.id || ''),
    String(message.sender || ''),
    String(message.englishText || '').trim(),
    String(message.japaneseText || '').trim(),
    Number(message.timestamp || 0),
  ]));
}

function childTurnCount(session: Record<string, any>): number {
  return sessionHistory(session).filter((message) => message.sender === 'child' && String(message.englishText || '').trim()).length;
}

function setupMatches(a: MutableAuditRow, b: MutableAuditRow): boolean {
  return a.persona_id === b.persona_id
    && a.topic === b.topic
    && a.target_duration_minutes === b.target_duration_minutes;
}

function mark(row: MutableAuditRow, status: ResearchSessionAuditStatus, requiresReview = false): void {
  if (STATUS_PRIORITY[status] >= STATUS_PRIORITY[row.audit_status]) row.audit_status = status;
  if (requiresReview) row.audit_requires_review = 1;
  if (status === 'duplicate_start_shadow') {
    row.analysis_include_primary = 0;
    row.analysis_include_strict = 0;
    row.analysis_exclusion_reason = 'exact_duplicate_shadow';
  }
  if (requiresReview) {
    row.analysis_include_strict = 0;
    if (!row.analysis_exclusion_reason) row.analysis_exclusion_reason = 'requires_review';
  }
}

function link(a: MutableAuditRow, b: MutableAuditRow): void {
  if (!a.paired_session_ids.includes(b.session_id)) a.paired_session_ids.push(b.session_id);
  if (!b.paired_session_ids.includes(a.session_id)) b.paired_session_ids.push(a.session_id);
}

function qualityRank(value: ResearchSessionQuality): number {
  if (value === 'complete') return 4;
  if (value === 'missing_reflection') return 3;
  if (value === 'interrupted') return 2;
  return 1;
}

function chooseDuplicateKeeper(a: MutableAuditRow, b: MutableAuditRow): MutableAuditRow {
  const qualityDelta = qualityRank(a.data_quality_flag) - qualityRank(b.data_quality_flag);
  if (qualityDelta !== 0) return qualityDelta > 0 ? a : b;
  if (a.child_turn_count !== b.child_turn_count) return a.child_turn_count > b.child_turn_count ? a : b;
  if (a._created_ms !== b._created_ms) return a._created_ms <= b._created_ms ? a : b;
  return a.session_id.localeCompare(b.session_id) <= 0 ? a : b;
}

function createRow(session: Record<string, any>): MutableAuditRow {
  const sessionId = String(session.sessionId || '');
  const quality = sessionQuality(session);
  const startMs = timestampMs(session.startedAt) || timestampMs(session.endedAt);
  const endMs = timestampMs(session.endedAt) || startMs;
  const storedDuration = Number(session.actualDurationSeconds);
  const actualDurationSeconds = Number.isFinite(storedDuration)
    ? Math.max(0, storedDuration)
    : Math.max(0, Math.round((endMs - startMs) / 1000));
  const primary: 0 | 1 = quality === 'complete' ? 1 : 0;
  return {
    session_id: sessionId,
    session_id_short: sessionId ? sessionId.slice(-8) : '',
    research_id: String(session.researchId || ''),
    started_at: iso(session.startedAt || session.endedAt),
    ended_at: iso(session.endedAt || session.startedAt),
    actual_duration_seconds: actualDurationSeconds,
    persona_id: String(session.personaId || session.aiStudentId || ''),
    topic: String(session.topic || ''),
    target_duration_minutes: Number(session.targetDurationMinutes || 0),
    child_turn_count: childTurnCount(session),
    data_quality_flag: quality,
    audit_status: 'normal',
    audit_requires_review: 0,
    paired_session_ids: [],
    analysis_include_primary: primary,
    analysis_include_strict: primary,
    analysis_exclusion_reason: primary ? '' : quality,
    _start_ms: startMs,
    _end_ms: Math.max(startMs, endMs),
    _created_ms: timestampMs(session.createdAt) || startMs,
    _history_identity: historyIdentity(session),
  };
}

export function buildResearchSessionAudit(rawSessions: Record<string, any>[]): ResearchSessionAuditResult {
  const rows = rawSessions.map(createRow).filter((row) => row.session_id && row.research_id);
  const byResearchId = new Map<string, MutableAuditRow[]>();
  for (const row of rows) {
    const list = byResearchId.get(row.research_id) || [];
    list.push(row);
    byResearchId.set(row.research_id, list);
  }
  for (const list of byResearchId.values()) list.sort((a, b) => a._start_ms - b._start_ms || a.session_id.localeCompare(b.session_id));

  const pairs: ResearchSessionAuditPair[] = [];
  for (const [researchId, list] of byResearchId.entries()) {
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        const startDeltaSeconds = Math.round(Math.abs(b._start_ms - a._start_ms) / 1000 * 10) / 10;
        const overlapMs = Math.max(0, Math.min(a._end_ms, b._end_ms) - Math.max(a._start_ms, b._start_ms));
        const overlapSeconds = Math.round(overlapMs / 1000 * 10) / 10;
        const sameSetup = setupMatches(a, b);
        const exactDuplicate = Boolean(
          sameSetup
          && a._history_identity
          && a._history_identity === b._history_identity,
        );

        if (exactDuplicate) {
          const keeper = chooseDuplicateKeeper(a, b);
          const shadow = keeper === a ? b : a;
          link(a, b);
          mark(keeper, 'duplicate_keeper');
          mark(shadow, 'duplicate_start_shadow');
          pairs.push({
            research_id: researchId,
            session_a: a.session_id,
            session_b: b.session_id,
            start_delta_seconds: startDeltaSeconds,
            overlap_seconds: overlapSeconds,
            pair_kind: 'exact_duplicate',
          });
          continue;
        }

        const aValid = a.data_quality_flag === 'complete' || a.data_quality_flag === 'missing_reflection';
        const bValid = b.data_quality_flag === 'complete' || b.data_quality_flag === 'missing_reflection';
        const zeroChildNearValid = sameSetup && startDeltaSeconds <= 10 && (
          (a.data_quality_flag === 'missing_core' && a.child_turn_count === 0 && bValid)
          || (b.data_quality_flag === 'missing_core' && b.child_turn_count === 0 && aValid)
        );
        if (zeroChildNearValid) {
          const zero = a.data_quality_flag === 'missing_core' && a.child_turn_count === 0 ? a : b;
          const partner = zero === a ? b : a;
          link(a, b);
          mark(zero, 'intentional_restart_or_shadow_candidate');
          mark(partner, 'restart_partner');
          pairs.push({
            research_id: researchId,
            session_a: a.session_id,
            session_b: b.session_id,
            start_delta_seconds: startDeltaSeconds,
            overlap_seconds: overlapSeconds,
            pair_kind: 'zero_child_near_valid',
          });
          continue;
        }

        const overlappingComplete = a.data_quality_flag === 'complete'
          && b.data_quality_flag === 'complete'
          && overlapSeconds > 5;
        if (overlappingComplete) {
          link(a, b);
          mark(a, 'overlapping_complete_conflict', true);
          mark(b, 'overlapping_complete_conflict', true);
          pairs.push({
            research_id: researchId,
            session_a: a.session_id,
            session_b: b.session_id,
            start_delta_seconds: startDeltaSeconds,
            overlap_seconds: overlapSeconds,
            pair_kind: 'overlapping_complete',
          });
          continue;
        }

        if (sameSetup && startDeltaSeconds <= 5) {
          link(a, b);
          mark(a, 'near_start_candidate');
          mark(b, 'near_start_candidate');
          pairs.push({
            research_id: researchId,
            session_a: a.session_id,
            session_b: b.session_id,
            start_delta_seconds: startDeltaSeconds,
            overlap_seconds: overlapSeconds,
            pair_kind: 'near_start',
          });
        }
      }
    }
  }

  // Manual data-cleaning decisions override automatic candidate states, but never mutate raw Firestore data.
  for (const row of rows) {
    const exclusion = getManualResearchExclusion(row.session_id);
    if (!exclusion) continue;
    row.audit_status = 'manual_research_exclusion';
    row.audit_requires_review = 0;
    row.analysis_include_primary = 0;
    row.analysis_include_strict = 0;
    row.analysis_exclusion_reason = exclusion.reason;
  }

  const publicRows: ResearchSessionAuditRow[] = rows
    .sort((a, b) => b._start_ms - a._start_ms || b.session_id.localeCompare(a.session_id))
    .map(({ _start_ms, _end_ms, _created_ms, _history_identity, ...row }) => row);
  const pairCount = (kind: ResearchSessionAuditPair['pair_kind']) => pairs.filter((pair) => pair.pair_kind === kind).length;
  return {
    rule_version: 'session-audit-v1',
    summary: {
      total_sessions: publicRows.length,
      complete_sessions: publicRows.filter((row) => row.data_quality_flag === 'complete').length,
      primary_include_sessions: publicRows.filter((row) => row.analysis_include_primary === 1).length,
      strict_include_sessions: publicRows.filter((row) => row.analysis_include_strict === 1).length,
      near_start_pairs: pairCount('near_start'),
      zero_child_near_valid_pairs: pairCount('zero_child_near_valid'),
      exact_duplicate_shadow_sessions: publicRows.filter((row) => row.audit_status === 'duplicate_start_shadow').length,
      overlapping_complete_pairs: pairCount('overlapping_complete'),
      manual_exclusion_sessions: publicRows.filter((row) => row.audit_status === 'manual_research_exclusion').length,
      requires_review_sessions: publicRows.filter((row) => row.audit_requires_review === 1).length,
    },
    rows: publicRows,
    pairs: pairs.sort((a, b) => a.research_id.localeCompare(b.research_id) || a.session_a.localeCompare(b.session_a)),
  };
}
