export const RESEARCH_ANALYSIS_ELIGIBILITY_VERSION = 'research-eligibility-2026-v3';

const DIALOGUE_ANALYSIS_QUALITY_FLAGS = new Set(['complete', 'missing_reflection']);
const REFLECTION_ANALYSIS_QUALITY_FLAGS = new Set(['complete']);

function numericChildTurnCount(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

export function dialogueAnalysisEligible(dataQualityFlag: unknown, childTurnCount?: unknown): boolean {
  const turns = numericChildTurnCount(childTurnCount);
  if (turns !== null) return turns >= 1;
  return DIALOGUE_ANALYSIS_QUALITY_FLAGS.has(String(dataQualityFlag || ''));
}

export function reflectionAnalysisEligible(dataQualityFlag: unknown): boolean {
  return REFLECTION_ANALYSIS_QUALITY_FLAGS.has(String(dataQualityFlag || ''));
}

export function qualityExclusionReason(
  dataQualityFlag: unknown,
  purpose: 'dialogue' | 'reflection',
  childTurnCount?: unknown,
): string {
  const flag = String(dataQualityFlag || 'unknown');
  const eligible = purpose === 'dialogue'
    ? dialogueAnalysisEligible(flag, childTurnCount)
    : reflectionAnalysisEligible(flag);
  if (eligible) return '';
  if (purpose === 'dialogue' && numericChildTurnCount(childTurnCount) !== null) return 'no_child_utterance';
  return `data_quality:${flag}`;
}

export function effectivePersonaSelectionEligible(childTurnCount: unknown): boolean {
  return Number(childTurnCount || 0) >= 1;
}

export function effectivePersonaSelectionExclusionReason(childTurnCount: unknown): string {
  return effectivePersonaSelectionEligible(childTurnCount) ? '' : 'no_child_utterance';
}
