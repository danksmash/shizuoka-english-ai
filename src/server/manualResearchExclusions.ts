export type ManualResearchExclusionReason = 'participant_identity_uncertain';

export interface ManualResearchExclusionRecord {
  sessionId: string;
  researchId: string;
  recordedAt: string;
  reason: ManualResearchExclusionReason;
  note: string;
}

export const MANUAL_RESEARCH_EXCLUSIONS: readonly ManualResearchExclusionRecord[] = [
  {
    sessionId: 'session_cf4973c1cf96495eb7057c32fd99cd32',
    researchId: 'R373562',
    recordedAt: '2026-09-17',
    reason: 'participant_identity_uncertain',
    note: '同一research_idで116.6秒重複するcomplete sessionが同時進行。学習者ID共有の可能性があり、どちらが本来の参加児童による対話か確定できないため研究分析から除外。rawデータは保持する。',
  },
  {
    sessionId: 'session_30153c7998f0401eb6bd10d062a05442',
    researchId: 'R373562',
    recordedAt: '2026-09-17',
    reason: 'participant_identity_uncertain',
    note: '同一research_idで116.6秒重複するcomplete sessionが同時進行。学習者ID共有の可能性があり、どちらが本来の参加児童による対話か確定できないため研究分析から除外。rawデータは保持する。',
  },
] as const;

const BY_SESSION_ID = new Map(MANUAL_RESEARCH_EXCLUSIONS.map((record) => [record.sessionId, record] as const));

export function manualResearchExclusionFor(sessionId: unknown): ManualResearchExclusionRecord | null {
  return BY_SESSION_ID.get(String(sessionId || '')) || null;
}

export function isManuallyExcludedResearchSession(sessionId: unknown): boolean {
  return BY_SESSION_ID.has(String(sessionId || ''));
}
