export type ManualResearchExclusionReason = 'participant_identity_uncertain_id_shared';

export interface ManualResearchExclusion {
  sessionId: string;
  researchId: string;
  decidedAt: string;
  reason: ManualResearchExclusionReason;
  note: string;
}

/**
 * Research data-cleaning decisions. Raw Firestore session documents remain untouched.
 * Keep this registry anonymous: never add learning codes, studentId values, names, or attendance numbers.
 */
export const MANUAL_RESEARCH_EXCLUSIONS: readonly ManualResearchExclusion[] = [
  {
    sessionId: 'session_cf4973c1cf96495eb7057c32fd99cd32',
    researchId: 'R373562',
    decidedAt: '2026-09-17',
    reason: 'participant_identity_uncertain_id_shared',
    note: 'Two complete sessions overlapped for almost the full two-minute window under the same research_id. Teacher follow-up indicated the learner ID may have been shared. Participant identity cannot be guaranteed, so this session is excluded from research analysis while raw data is retained.',
  },
  {
    sessionId: 'session_30153c7998f0401eb6bd10d062a05442',
    researchId: 'R373562',
    decidedAt: '2026-09-17',
    reason: 'participant_identity_uncertain_id_shared',
    note: 'Two complete sessions overlapped for almost the full two-minute window under the same research_id. Teacher follow-up indicated the learner ID may have been shared. Participant identity cannot be guaranteed, so this session is excluded from research analysis while raw data is retained.',
  },
] as const;

const MANUAL_EXCLUSION_BY_SESSION = new Map(MANUAL_RESEARCH_EXCLUSIONS.map((row) => [row.sessionId, row]));

export function getManualResearchExclusion(sessionId: unknown): ManualResearchExclusion | null {
  const id = typeof sessionId === 'string' ? sessionId : '';
  return id ? MANUAL_EXCLUSION_BY_SESSION.get(id) || null : null;
}

export function isManualResearchExcludedSessionId(sessionId: unknown): boolean {
  return Boolean(getManualResearchExclusion(sessionId));
}

export function filterManualResearchExcludedSessions<T extends Record<string, any>>(sessions: T[]): T[] {
  return sessions.filter((session) => !isManualResearchExcludedSessionId(session.sessionId || session.session_id));
}
