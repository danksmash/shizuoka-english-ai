/**
 * Duration eligibility is distinct from dialogue / Persona-selection eligibility.
 * Preserve raw research sessions, and avoid turning 3600-second capped wall time
 * into an exceptionally low WPM / turns-per-minute measurement.
 *
 * The review thresholds are conservative QA gates, not definitions of an
 * "invalid" RQ1/RQ2/RQ3 session. Never mutate raw Firestore records here.
 */
export type ResearchDurationQuality = 'valid' | 'needs_review' | 'invalid';
export const RESEARCH_DURATION_QA_VERSION = 'duration-qa-2026-10-09-v1';

export function assessResearchDuration(row: Record<string, unknown>): {
  quality: ResearchDurationQuality;
  reason: string;
  seconds: number | null;
} {
  const rawSeconds = row.actual_duration_seconds ?? row.actualDurationSeconds;
  const seconds = Number(rawSeconds);
  const targetMinutes = Number(row.target_duration_minutes ?? row.targetDurationMinutes);
  const explicit = String(row.duration_quality ?? row.durationQuality ?? '').trim();
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return { quality: 'invalid', reason: 'duration_missing_or_non_positive', seconds: null };
  }
  // The historical source clamps >= 60 minutes to exactly 3600 seconds.
  // This must take precedence even if a newer metadata flag is inconsistent.
  if (seconds >= 3600) {
    return { quality: 'invalid', reason: 'wall_clock_3600_cap', seconds: null };
  }
  if (explicit === 'invalid' || explicit === 'needs_review') {
    return { quality: explicit, reason: 'explicit_duration_quality', seconds: null };
  }
  if (explicit === 'valid') {
    return { quality: 'valid', reason: 'measured_active_time', seconds };
  }
  // Legacy sessions have no active-time telemetry. A 1–5 min session with a
  // far longer wall duration needs review; do not guess the real duration.
  if (seconds >= 600 || ([1, 2, 3, 5].includes(targetMinutes) && seconds > targetMinutes * 60 + 180)) {
    return { quality: 'needs_review', reason: 'legacy_elapsed_time_outlier', seconds: null };
  }
  return { quality: 'valid', reason: 'legacy_plausible_duration', seconds };
}

export function rateEligibleDurationSeconds(row: Record<string, unknown>): number | null {
  return assessResearchDuration(row).seconds;
}
