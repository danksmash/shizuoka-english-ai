export type ResearchLessonContext = 'in_lesson' | 'outside_lesson' | 'unknown';

export const RESEARCH_LESSON_CONTEXT_RULE_VERSION = 'lesson-context-2026-v2';
export const RESEARCH_LESSON_UNIQUE_PARTICIPANT_THRESHOLD = 15;
export const RESEARCH_LESSON_CLUSTER_WINDOW_MINUTES = 10;
export const RESEARCH_LESSON_DURATION_MINUTES = 45;

export type ResearchLessonContextDecision = {
  localDate: string;
  sameClassUniqueParticipants10Min: number;
  lessonClusterStartLocal: string;
  lessonContextRuleVersion: string;
  lessonContext: ResearchLessonContext;
};

type SessionItem = {
  sessionId: string;
  classId: string;
  researchId: string;
  startMs: number;
  localDate: string;
};

function timestampMs(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function tokyoParts(value: unknown): { date: string; time: string; valid: boolean } {
  const ms = timestampMs(value);
  if (!ms) return { date: '', time: '', valid: false };
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
    valid: true,
  };
}

function localDateTime(ms: number): string {
  const parts = tokyoParts(ms);
  return parts.valid ? `${parts.date} ${parts.time}` : '';
}

function uniqueParticipantsInForwardWindow(items: SessionItem[], startMs: number, windowMs: number): number {
  const participants = new Set<string>();
  const endMs = startMs + windowMs;
  for (const item of items) {
    if (item.startMs < startMs) continue;
    if (item.startMs > endMs) break;
    if (item.researchId) participants.add(item.researchId);
  }
  return participants.size;
}

export function buildResearchLessonContextDecisions(
  sessions: Record<string, any>[],
): Map<string, ResearchLessonContextDecision> {
  const items: SessionItem[] = sessions.map((session) => {
    const startMs = timestampMs(session.startedAt) || timestampMs(session.endedAt);
    const start = tokyoParts(startMs);
    return {
      sessionId: String(session.sessionId || ''),
      classId: String(session.classId || ''),
      researchId: String(session.researchId || '').trim().toUpperCase(),
      startMs,
      localDate: start.valid ? start.date : '',
    };
  });

  const result = new Map<string, ResearchLessonContextDecision>();
  for (const item of items) {
    result.set(item.sessionId, {
      localDate: item.localDate,
      sameClassUniqueParticipants10Min: 0,
      lessonClusterStartLocal: '',
      lessonContextRuleVersion: RESEARCH_LESSON_CONTEXT_RULE_VERSION,
      lessonContext: item.classId && item.startMs > 0 && item.localDate ? 'outside_lesson' : 'unknown',
    });
  }

  const byClassDate = new Map<string, SessionItem[]>();
  for (const item of items) {
    if (!item.classId || !item.localDate || item.startMs <= 0) continue;
    const key = `${item.classId}|${item.localDate}`;
    const rows = byClassDate.get(key) || [];
    rows.push(item);
    byClassDate.set(key, rows);
  }

  const clusterWindowMs = RESEARCH_LESSON_CLUSTER_WINDOW_MINUTES * 60_000;
  const lessonDurationMs = RESEARCH_LESSON_DURATION_MINUTES * 60_000;

  for (const rows of byClassDate.values()) {
    rows.sort((a, b) => a.startMs - b.startMs || a.sessionId.localeCompare(b.sessionId));

    let lessonClusterStartMs = 0;
    for (const item of rows) {
      const uniqueCount = uniqueParticipantsInForwardWindow(rows, item.startMs, clusterWindowMs);
      const decision = result.get(item.sessionId);
      if (decision) decision.sameClassUniqueParticipants10Min = uniqueCount;

      if (
        !lessonClusterStartMs
        && item.researchId
        && uniqueCount >= RESEARCH_LESSON_UNIQUE_PARTICIPANT_THRESHOLD
      ) {
        lessonClusterStartMs = item.startMs;
      }
    }

    if (!lessonClusterStartMs) continue;
    const lessonEndMs = lessonClusterStartMs + lessonDurationMs;
    const lessonClusterStartLocal = localDateTime(lessonClusterStartMs);

    for (const item of rows) {
      const decision = result.get(item.sessionId);
      if (!decision) continue;
      decision.lessonClusterStartLocal = lessonClusterStartLocal;
      decision.lessonContext = item.startMs >= lessonClusterStartMs && item.startMs <= lessonEndMs
        ? 'in_lesson'
        : 'outside_lesson';
    }
  }

  return result;
}
