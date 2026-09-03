import type { DialogueTopic } from '../types';

export type ContextualAsrCategory = 'food' | 'place' | 'culture' | 'person';
export type ContextualAsrConfidence = 'none' | 'medium' | 'high';

type LexiconEntry = {
  term: string;
  category: Exclude<ContextualAsrCategory, 'person'>;
};

export interface ContextualAsrInput {
  text: string;
  previousAiText?: string;
  topic: DialogueTopic;
  enabled?: boolean;
}

export interface ContextualAsrResult {
  text: string;
  applied: boolean;
  confidence: ContextualAsrConfidence;
  category?: ContextualAsrCategory;
  candidate?: string;
  similarity?: number;
}

// Correct-language candidates only. This is deliberately NOT a table of
// misrecognition -> correction pairs. The same generic scoring handles any ASR
// hypothesis that is phonetically close enough in a strong conversation context.
export const CONTEXTUAL_ASR_LEXICON: readonly LexiconEntry[] = [
  { term: 'natto', category: 'food' },
  { term: 'onigiri', category: 'food' },
  { term: 'takoyaki', category: 'food' },
  { term: 'okonomiyaki', category: 'food' },
  { term: 'udon', category: 'food' },
  { term: 'soba', category: 'food' },
  { term: 'tempura', category: 'food' },
  { term: 'gyoza', category: 'food' },
  { term: 'unagi', category: 'food' },
  { term: 'yakisoba', category: 'food' },
  { term: 'tonkatsu', category: 'food' },
  { term: 'miso soup', category: 'food' },
  { term: 'green tea', category: 'food' },
  { term: 'mikan', category: 'food' },
  { term: 'sakura shrimp', category: 'food' },
  { term: 'black hanpen', category: 'food' },
  { term: 'Hamamatsu', category: 'place' },
  { term: 'Shizuoka', category: 'place' },
  { term: 'Fujinomiya', category: 'place' },
  { term: 'Yaizu', category: 'place' },
  { term: 'Kakegawa', category: 'place' },
  { term: 'Iwata', category: 'place' },
  { term: 'Mt. Fuji', category: 'place' },
  { term: 'Lake Hamana', category: 'place' },
  { term: 'matsuri', category: 'culture' },
  { term: 'origami', category: 'culture' },
  { term: 'kendama', category: 'culture' },
  { term: 'shodo', category: 'culture' },
  { term: 'anime', category: 'culture' },
  { term: 'manga', category: 'culture' },
] as const;

// Known high-risk near-homophones that must never be silently rewritten. These
// are safeguards, not correction mappings.
const PROTECTED_PHRASES = new Set([
  'nato',
  'tomato',
  'potato',
  'not to',
  'know too',
  'no two',
]);

function normalize(value: string): string {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function phoneticKey(value: string): string {
  return normalize(value)
    .split(' ')
    .filter(Boolean)
    .map((word) => word
      .replace(/^kn/, 'n')
      .replace(/^wr/, 'r')
      .replace(/ph/g, 'f')
      .replace(/ck/g, 'k')
      .replace(/tch/g, 'ch')
      .replace(/ow/g, 'o')
      .replace(/ou/g, 'o')
      .replace(/oo/g, 'u')
      .replace(/(?:ee|ea)/g, 'i')
      .replace(/ey$/, 'i')
      .replace(/e$/, '')
      .replace(/(.)\1+/g, '$1'))
    .join('')
    .replace(/(.)\1+/g, '$1');
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[b.length];
}

function similarity(a: string, b: string): number {
  const left = phoneticKey(a);
  const right = phoneticKey(b);
  if (!left || !right) return 0;
  return 1 - levenshtein(left, right) / Math.max(left.length, right.length);
}

function inferCategory(previousAiText: string, topic: DialogueTopic): ContextualAsrCategory | null {
  const previous = normalize(previousAiText);
  if (!previous) return null;
  if (/\b(food|eat|eating|drink|breakfast|lunch|dinner|snack|dish|meal)\b/.test(previous)) return 'food';
  if (/\b(where|place|city|town|live|from|visit|visited|go to|went to)\b/.test(previous)) return 'place';
  if (/\b(culture|festival|tradition|custom|japanese|japan|shizuoka)\b/.test(previous)) return 'culture';
  if (/\b(name|who|person|friend)\b/.test(previous)) return 'person';
  if (topic === 'shizuoka_culture' && /\b(what do you like|tell me about)\b/.test(previous)) return 'culture';
  return null;
}

type Slot = { prefix: string; value: string; suffix: string };

function extractSlot(text: string, category: ContextualAsrCategory): Slot | null {
  const frames: RegExp[] = category === 'place'
    ? [/^(\s*(?:(?:yes|yeah|no)[,.]?\s+)?(?:i live in|i am from|i'm from|i went to|i go to|i want to go to|i visited|i like)\s+)([^.!?]+)([.!?]*)\s*$/i]
    : category === 'person'
      ? [/^(\s*(?:my name is|call me|my friend is)\s+)([^.!?]+)([.!?]*)\s*$/i]
      : [/^(\s*(?:(?:yes|yeah|no)[,.]?\s+)?(?:i like|i love|my favorite food is|my favourite food is|i eat|i want to eat)\s+)([^.!?]+)([.!?]*)\s*$/i];
  for (const frame of frames) {
    const match = text.match(frame);
    if (match) return { prefix: match[1], value: match[2].trim(), suffix: match[3] || '' };
  }
  return null;
}

export function interpretContextualAsr(input: ContextualAsrInput): ContextualAsrResult {
  const original = String(input.text || '').trim();
  if (!original || input.enabled === false) return { text: original, applied: false, confidence: 'none' };

  const category = inferCategory(input.previousAiText || '', input.topic);
  if (!category) return { text: original, applied: false, confidence: 'none' };

  // Arbitrary learner/person names are intentionally never auto-corrected. They
  // are higher-risk because a false correction can change the learner profile or PII.
  if (category === 'person') return { text: original, applied: false, confidence: 'none', category };

  const slot = extractSlot(original, category);
  if (!slot) return { text: original, applied: false, confidence: 'none', category };
  const slotNormalized = normalize(slot.value);
  if (!slotNormalized || slotNormalized.length > 28 || slotNormalized.split(' ').length > 3) {
    return { text: original, applied: false, confidence: 'none', category };
  }
  if (PROTECTED_PHRASES.has(slotNormalized)) {
    return { text: original, applied: false, confidence: 'none', category };
  }

  const candidates = CONTEXTUAL_ASR_LEXICON.filter((entry) => entry.category === category);
  if (candidates.some((entry) => normalize(entry.term) === slotNormalized)) {
    return { text: original, applied: false, confidence: 'none', category };
  }

  const ranked = candidates
    .map((entry) => ({ entry, similarity: similarity(slot.value, entry.term) }))
    .sort((a, b) => b.similarity - a.similarity);
  const best = ranked[0];
  const second = ranked[1];
  if (!best) return { text: original, applied: false, confidence: 'none', category };

  const margin = best.similarity - (second?.similarity ?? 0);
  const contextualScore = best.similarity + 0.15;
  const highConfidence = best.similarity >= 0.72 && contextualScore >= 0.87 && margin >= 0.08;
  if (!highConfidence) {
    return {
      text: original,
      applied: false,
      confidence: best.similarity >= 0.62 ? 'medium' : 'none',
      category,
      candidate: best.entry.term,
      similarity: Math.round(best.similarity * 1000) / 1000,
    };
  }

  return {
    text: (slot.prefix + best.entry.term + slot.suffix).trim(),
    applied: true,
    confidence: 'high',
    category,
    candidate: best.entry.term,
    similarity: Math.round(best.similarity * 1000) / 1000,
  };
}
