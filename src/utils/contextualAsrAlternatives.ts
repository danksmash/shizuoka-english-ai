import type { DialogueTopic } from '../types';
import {
  CONTEXTUAL_ASR_LEXICON,
  interpretContextualAsr,
  type ContextualAsrResult,
} from './contextualAsr';
import type { SpeechRecognitionAlternativeText } from './stableSpeechRecognition';

export interface ContextualAsrAlternativesInput {
  text: string;
  alternatives?: readonly SpeechRecognitionAlternativeText[];
  previousAiText?: string;
  topic: DialogueTopic;
  enabled?: boolean;
}

function normalize(value: string): string {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsCanonicalTerm(text: string, term: string): boolean {
  const haystack = normalize(text);
  const needle = normalize(term);
  if (!haystack || !needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, 'i').test(haystack);
}

/**
 * Stage 2 acoustic promotion.
 *
 * The existing contextual ASR remains the semantic/phonetic gate. An acoustic
 * alternative can promote only the same pending canonical candidate already
 * identified by that gate. We never use a fixed "Naruto -> natto" mapping.
 */
export function interpretContextualAsrWithAlternatives(
  input: ContextualAsrAlternativesInput,
): ContextualAsrResult {
  const base = interpretContextualAsr({
    text: input.text,
    previousAiText: input.previousAiText,
    topic: input.topic,
    enabled: input.enabled,
  });

  if (
    base.applied ||
    base.confidence !== 'medium' ||
    !base.needsConfirmation ||
    !base.candidate ||
    !base.category ||
    base.category === 'person' ||
    input.enabled === false
  ) {
    return base;
  }

  const entry = CONTEXTUAL_ASR_LEXICON.find(
    (item) => item.term === base.candidate && item.category === base.category,
  );
  if (!entry) return base;

  const matching = (input.alternatives || [])
    .filter((alternative) => containsCanonicalTerm(alternative.text, entry.term))
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return a.rank - b.rank;
    });
  if (!matching.length) return base;

  const best = matching[0];
  const hasComparableConfidence = best.confidence > 0 && best.primaryConfidence > 0;
  const acousticSupport = hasComparableConfidence
    ? best.confidence + 0.12 >= best.primaryConfidence
    : best.rank === 2 && (base.similarity || 0) >= 0.72;

  if (!acousticSupport) return base;

  const alternativeResult = interpretContextualAsr({
    text: best.text,
    previousAiText: input.previousAiText,
    topic: input.topic,
    enabled: input.enabled,
  });

  return {
    ...base,
    text: alternativeResult.text || best.text,
    applied: true,
    confidence: 'high',
    stage: 'stage2',
    needsConfirmation: false,
  };
}
