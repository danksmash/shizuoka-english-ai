import type {
  ResearchSessionAuditPair,
  ResearchSessionAuditResult,
  ResearchSessionAuditRow,
} from './researchSessionAudit';

export interface ResearchSessionAuditTranscriptRow {
  utterance_id: string;
  sender: string;
  english_text: string;
  japanese_text: string;
  timestamp: number;
}

export interface ResearchSessionAuditSystemEventRow {
  type: string;
  value: string;
  timestamp: number;
}

export interface ResearchSessionAuditDetailSession {
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
  total_child_words: number;
  data_quality_flag: string;
  audit_status: string;
  audit_requires_review: 0 | 1;
  analysis_include_primary: 0 | 1;
  analysis_include_strict: 0 | 1;
  analysis_exclusion_reason: string;
  transcript: ResearchSessionAuditTranscriptRow[];
  system_events: ResearchSessionAuditSystemEventRow[];
  reflection: {
    scale_version: string;
    conveyed_ideas: number | '';
    understood_partner: number | '';
    noticed_language_culture: number | '';
  } | null;
}

export interface ResearchSessionAuditPairDetail {
  pair_kind: ResearchSessionAuditPair['pair_kind'];
  research_id: string;
  start_delta_seconds: number;
  overlap_seconds: number;
  session_a: ResearchSessionAuditDetailSession;
  session_b: ResearchSessionAuditDetailSession;
}

export interface ResearchSessionAuditDetailsResult {
  rule_version: 'session-audit-detail-v1';
  pair_count: number;
  pairs: ResearchSessionAuditPairDetail[];
}

function numericTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function safeText(value: unknown, maxLength = 800): string {
  return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

function buildTranscript(session: Record<string, any>): ResearchSessionAuditTranscriptRow[] {
  if (!Array.isArray(session.history)) return [];
  return session.history
    .filter((message: any) => message && typeof message === 'object')
    .slice(0, 120)
    .map((message: any) => ({
      utterance_id: safeText(message.id, 120),
      sender: safeText(message.sender, 20),
      english_text: safeText(message.englishText),
      japanese_text: safeText(message.japaneseText),
      timestamp: numericTimestamp(message.timestamp),
    }));
}

function buildSystemEvents(session: Record<string, any>): ResearchSessionAuditSystemEventRow[] {
  if (!Array.isArray(session.systemEvents)) return [];
  return session.systemEvents
    .filter((event: any) => event && typeof event === 'object')
    .slice(0, 160)
    .map((event: any) => ({
      type: safeText(event.type, 80),
      value: safeText(event.value, 160),
      timestamp: numericTimestamp(event.timestamp),
    }));
}

function buildReflection(session: Record<string, any>): ResearchSessionAuditDetailSession['reflection'] {
  const reflection = session.reflection;
  if (!reflection || typeof reflection !== 'object') return null;
  const rating = (value: unknown): number | '' => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : '';
  };
  return {
    scale_version: safeText(reflection.scaleVersion, 80),
    conveyed_ideas: rating(reflection.conveyedIdeas),
    understood_partner: rating(reflection.understoodPartner),
    noticed_language_culture: rating(reflection.noticedLanguageCulture),
  };
}

function buildSessionDetail(
  row: ResearchSessionAuditRow,
  session: Record<string, any>,
): ResearchSessionAuditDetailSession {
  return {
    session_id: row.session_id,
    session_id_short: row.session_id_short,
    research_id: row.research_id,
    started_at: row.started_at,
    ended_at: row.ended_at,
    actual_duration_seconds: row.actual_duration_seconds,
    persona_id: row.persona_id,
    topic: row.topic,
    target_duration_minutes: row.target_duration_minutes,
    child_turn_count: row.child_turn_count,
    total_child_words: Math.max(0, Number(session.totalChildWords || 0)),
    data_quality_flag: row.data_quality_flag,
    audit_status: row.audit_status,
    audit_requires_review: row.audit_requires_review,
    analysis_include_primary: row.analysis_include_primary,
    analysis_include_strict: row.analysis_include_strict,
    analysis_exclusion_reason: row.analysis_exclusion_reason,
    transcript: buildTranscript(session),
    system_events: buildSystemEvents(session),
    reflection: buildReflection(session),
  };
}

function pairPriority(kind: ResearchSessionAuditPair['pair_kind']): number {
  if (kind === 'overlapping_complete') return 0;
  if (kind === 'exact_duplicate') return 1;
  if (kind === 'zero_child_near_valid') return 2;
  return 3;
}

export function buildResearchSessionAuditDetails(
  rawSessions: Record<string, any>[],
  audit: ResearchSessionAuditResult,
): ResearchSessionAuditDetailsResult {
  const rawById = new Map(
    rawSessions
      .map((session) => [String(session.sessionId || ''), session] as const)
      .filter(([sessionId]) => Boolean(sessionId)),
  );
  const rowById = new Map(audit.rows.map((row) => [row.session_id, row]));

  const pairs = audit.pairs.flatMap((pair): ResearchSessionAuditPairDetail[] => {
    const rowA = rowById.get(pair.session_a);
    const rowB = rowById.get(pair.session_b);
    const rawA = rawById.get(pair.session_a);
    const rawB = rawById.get(pair.session_b);
    if (!rowA || !rowB || !rawA || !rawB) return [];
    return [{
      pair_kind: pair.pair_kind,
      research_id: pair.research_id,
      start_delta_seconds: pair.start_delta_seconds,
      overlap_seconds: pair.overlap_seconds,
      session_a: buildSessionDetail(rowA, rawA),
      session_b: buildSessionDetail(rowB, rawB),
    }];
  });

  pairs.sort((a, b) => {
    const priority = pairPriority(a.pair_kind) - pairPriority(b.pair_kind);
    if (priority !== 0) return priority;
    const aLatest = Math.max(Date.parse(a.session_a.started_at) || 0, Date.parse(a.session_b.started_at) || 0);
    const bLatest = Math.max(Date.parse(b.session_a.started_at) || 0, Date.parse(b.session_b.started_at) || 0);
    return bLatest - aLatest;
  });

  return {
    rule_version: 'session-audit-detail-v1',
    pair_count: pairs.length,
    pairs,
  };
}
