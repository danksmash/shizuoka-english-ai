export const RESEARCH_ANALYSIS_ELIGIBILITY_VERSION = 'research-eligibility-2026-v2';

const DIALOGUE_ANALYSIS_QUALITY_FLAGS = new Set(['complete', 'missing_reflection']);
const REFLECTION_ANALYSIS_QUALITY_FLAGS = new Set(['complete']);

export function dialogueAnalysisEligible(dataQualityFlag: unknown): boolean {
  return DIALOGUE_ANALYSIS_QUALITY_FLAGS.has(String(dataQualityFlag || ''));
}

export function reflectionAnalysisEligible(dataQualityFlag: unknown): boolean {
  return REFLECTION_ANALYSIS_QUALITY_FLAGS.has(String(dataQualityFlag || ''));
}

export function qualityExclusionReason(dataQualityFlag: unknown, purpose: 'dialogue' | 'reflection'): string {
  const flag = String(dataQualityFlag || 'unknown');
  const eligible = purpose === 'dialogue'
    ? dialogueAnalysisEligible(flag)
    : reflectionAnalysisEligible(flag);
  return eligible ? '' : `data_quality:${flag}`;
}

export function effectivePersonaSelectionEligible(childTurnCount: unknown): boolean {
  return Number(childTurnCount || 0) >= 1;
}

export function effectivePersonaSelectionExclusionReason(childTurnCount: unknown): string {
  return effectivePersonaSelectionEligible(childTurnCount) ? '' : 'no_child_utterance';
}
