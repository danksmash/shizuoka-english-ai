import type { DialogueTopic } from '../types';

export type ContextualAsrCategory = 'food' | 'place' | 'culture' | 'person';
export type ContextualAsrConfidence = 'none' | 'medium' | 'high';
export type ContextualAsrStage = 'stage1' | 'stage2' | 'stage3';

type LexiconEntry = {
  term: string;
  category: Exclude<ContextualAsrCategory, 'person'>;
  boost?: number;
  japaneseHints?: readonly string[];
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
  stage?: ContextualAsrStage;
  needsConfirmation?: boolean;
}

export interface ContextualAsrAiConfirmationInput extends ContextualAsrInput {
  studentJapaneseTranslation?: string;
  aiReply?: string;
}

// Correct-language candidates only. This is deliberately NOT a table of
// misrecognition -> correction pairs. Generic phonetic scoring and conversation
// context decide whether a candidate may be used.
export const CONTEXTUAL_ASR_LEXICON: readonly LexiconEntry[] = [
  { term: 'natto', category: 'food', japaneseHints: ['納豆', 'なっとう'] },
  { term: 'karaage', category: 'food', boost: 4.5, japaneseHints: ['唐揚げ', 'からあげ', 'から揚げ'] },
  { term: 'ramen', category: 'food', boost: 3.5, japaneseHints: ['ラーメン'] },
  { term: 'curry rice', category: 'food', boost: 3.5, japaneseHints: ['カレーライス', 'カレー'] },
  { term: 'hamburger steak', category: 'food', boost: 3.0, japaneseHints: ['ハンバーグ'] },
  { term: 'omurice', category: 'food', boost: 3.5, japaneseHints: ['オムライス'] },
  { term: 'onigiri', category: 'food', japaneseHints: ['おにぎり'] },
  { term: 'takoyaki', category: 'food', japaneseHints: ['たこ焼き', 'たこやき'] },
  { term: 'okonomiyaki', category: 'food', japaneseHints: ['お好み焼き', 'おこのみやき'] },
  { term: 'udon', category: 'food', japaneseHints: ['うどん'] },
  { term: 'soba', category: 'food', japaneseHints: ['そば', '蕎麦'] },
  { term: 'tempura', category: 'food', japaneseHints: ['天ぷら', 'てんぷら'] },
  { term: 'gyoza', category: 'food', japaneseHints: ['餃子', 'ぎょうざ'] },
  { term: 'unagi', category: 'food', japaneseHints: ['うなぎ', '鰻'] },
  { term: 'yakisoba', category: 'food', japaneseHints: ['焼きそば', 'やきそば'] },
  { term: 'tonkatsu', category: 'food', japaneseHints: ['とんかつ'] },
  { term: 'miso soup', category: 'food', japaneseHints: ['みそ汁', '味噌汁'] },
  { term: 'green tea', category: 'food', japaneseHints: ['緑茶', 'お茶'] },
  { term: 'ocha', category: 'food', japaneseHints: ['お茶'] },
  { term: 'sushi', category: 'food', japaneseHints: ['寿司', 'すし'] },
  { term: 'mikan', category: 'food', japaneseHints: ['みかん'] },
  { term: 'sakura shrimp', category: 'food', japaneseHints: ['桜えび', '桜エビ', 'さくらえび'] },
  { term: 'black hanpen', category: 'food', japaneseHints: ['黒はんぺん'] },
  { term: 'Hamamatsu', category: 'place', boost: 4.0, japaneseHints: ['浜松'] },
  { term: 'Shizuoka', category: 'place', boost: 4.0, japaneseHints: ['静岡'] },
  { term: 'Fujinomiya', category: 'place', japaneseHints: ['富士宮'] },
  { term: 'Yaizu', category: 'place', japaneseHints: ['焼津'] },
  { term: 'Kakegawa', category: 'place', japaneseHints: ['掛川'] },
  { term: 'Iwata', category: 'place', japaneseHints: ['磐田'] },
  { term: 'Mt. Fuji', category: 'place', boost: 4.0, japaneseHints: ['富士山'] },
  { term: 'Lake Hamana', category: 'place', boost: 4.0, japaneseHints: ['浜名湖'] },
  { term: 'Tenryu River', category: 'place', boost: 4.0, japaneseHints: ['天竜川', '天龍川'] },
  { term: 'Lake Sanaru', category: 'place', boost: 4.0, japaneseHints: ['佐鳴湖'] },
  { term: 'Suruga Bay', category: 'place', boost: 3.5, japaneseHints: ['駿河湾'] },
  { term: 'Sunpu', category: 'place', japaneseHints: ['駿府'] },
  { term: 'matsuri', category: 'culture', japaneseHints: ['祭り', 'まつり'] },
  { term: 'origami', category: 'culture', japaneseHints: ['折り紙', 'おりがみ'] },
  { term: 'kendama', category: 'culture', japaneseHints: ['けん玉', '剣玉'] },
  { term: 'shodo', category: 'culture', japaneseHints: ['書道'] },
  { term: 'anime', category: 'culture', japaneseHints: ['アニメ'] },
  { term: 'manga', category: 'culture', japaneseHints: ['漫画', 'マンガ'] },
] as const;

// These are valid English words/phrases that must not be rewritten from audio
// recognition alone. They may be reconsidered only at Stage 3 when the AI's
// already-generated interpretation independently supports the same candidate.
const PROTECTED_PHRASES = new Set([
  'nato',
  'tomato',
  'potato',
  'not to',
  'know too',
  'no two',
  'karaoke',
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

type CategoryInference = {
  categories: Exclude<ContextualAsrCategory, 'person'>[];
  person: boolean;
  broad: boolean;
};

function inferCategories(previousAiText: string, topic: DialogueTopic): CategoryInference {
  const previous = normalize(previousAiText);
  if (!previous) return { categories: [], person: false, broad: false };
  if (/\b(name|who|person|friend)\b/.test(previous)) return { categories: [], person: true, broad: false };

  const food = /\b(food|eat|eating|drink|breakfast|lunch|dinner|snack|dish|meal|fruit)\b/.test(previous);
  const place = /\b(where|place|city|town|lake|river|mountain|mount|park|station|sea|beach|live|from|visit|visited|go to|went to)\b/.test(previous);
  const culture = /\b(culture|festival|tradition|custom|japanese|japan)\b/.test(previous);

  const explicit: Exclude<ContextualAsrCategory, 'person'>[] = [];
  if (food) explicit.push('food');
  if (place) explicit.push('place');
  if (culture) explicit.push('culture');
  if (explicit.length > 0 && !/\bshizuoka\b/.test(previous)) {
    return { categories: Array.from(new Set(explicit)), person: false, broad: false };
  }

  const broadPrompt = /\b(what do you like|tell me about|what do you like about)\b/.test(previous);
  const shizuokaBroad = topic === 'shizuoka_culture' || /\bshizuoka\b/.test(previous);
  if (shizuokaBroad && (broadPrompt || explicit.length > 0)) {
    return { categories: ['food', 'place', 'culture'], person: false, broad: true };
  }
  if (broadPrompt && (topic === 'favorites' || topic === 'free')) {
    return { categories: ['food', 'place', 'culture'], person: false, broad: true };
  }
  return { categories: explicit, person: false, broad: false };
}

export interface ContextualAsrBiasPhrase {
  phrase: string;
  boost: number;
}

export function getContextualAsrBiasPhrases(input: Pick<ContextualAsrInput, 'previousAiText' | 'topic'>): ContextualAsrBiasPhrase[] {
  const inference = inferCategories(input.previousAiText || '', input.topic);
  if (inference.person || inference.categories.length === 0) return [];
  const categories = new Set(inference.categories);
  return CONTEXTUAL_ASR_LEXICON
    .filter((entry) => categories.has(entry.category))
    .map((entry) => ({
      phrase: entry.term,
      boost: Math.max(0, Math.min(10, inference.broad ? Math.min(entry.boost ?? 2.5, 2.5) : (entry.boost ?? 2.5))),
    }));
}

type Slot = { prefix: string; value: string; suffix: string; category: Exclude<ContextualAsrCategory, 'person'> };

function prepareSegments(text: string): string[] {
  const prepared = String(text || '')
    .trim()
    .replace(/\s+(?=(?:do|does|did|can|could|are|is|have|has|would|will)\s+you\b)/gi, '. ');
  return (prepared.match(/[^.!?]+[.!?]?/g) || [prepared]).map((segment) => segment.trim()).filter(Boolean);
}

function extractSlot(segment: string, category: Exclude<ContextualAsrCategory, 'person'>): Slot | null {
  const placeFrames = [
    /^(\s*(?:(?:yes|yeah|no)[,.]?\s+)?(?:i live in|i am from|i'm from|i went to|i go to|i want to go to|i visited|i like|do you like|have you been to)\s+)([^.!?]+)([.!?]*)\s*$/i,
  ];
  const foodFrames = [
    /^(\s*(?:(?:yes|yeah|no)[,.]?\s+)?(?:i like|i love|my favorite food is|my favourite food is|my favorite is|my favourite is|i eat|i want to eat|do you like|have you eaten)\s+)([^.!?]+)([.!?]*)\s*$/i,
    /^(\s*(?:just\s+)?i\s+eat\s+)([^.!?]+)([.!?]*)\s*$/i,
  ];
  const cultureFrames = [
    /^(\s*(?:(?:yes|yeah|no)[,.]?\s+)?(?:i like|i love|do you like|this is)\s+)([^.!?]+)([.!?]*)\s*$/i,
  ];
  const frames = category === 'place' ? placeFrames : category === 'food' ? foodFrames : cultureFrames;
  for (const frame of frames) {
    const match = segment.match(frame);
    if (match) return { prefix: match[1], value: match[2].trim(), suffix: match[3] || '', category };
  }
  return null;
}

type RankedCandidate = { entry: LexiconEntry; similarity: number; margin: number };

function rankSlot(slot: Slot, category: Exclude<ContextualAsrCategory, 'person'>, forcedTerm?: string): RankedCandidate | null {
  const candidates = CONTEXTUAL_ASR_LEXICON.filter((entry) => entry.category === category && (!forcedTerm || entry.term === forcedTerm));
  const ranked = candidates
    .map((entry) => ({ entry, similarity: similarity(slot.value, entry.term) }))
    .sort((a, b) => b.similarity - a.similarity);
  const best = ranked[0];
  if (!best) return null;
  const second = forcedTerm ? undefined : ranked[1];
  return { entry: best.entry, similarity: best.similarity, margin: best.similarity - (second?.similarity ?? 0) };
}

function rebuildSegments(segments: string[], replacements: Map<number, Slot & { term: string }>): string {
  return segments.map((segment, index) => {
    const replacement = replacements.get(index);
    if (!replacement) return segment;
    return `${replacement.prefix}${replacement.term}${replacement.suffix}`.trim();
  }).join(' ').replace(/\s+/g, ' ').trim();
}

function evaluateText(
  text: string,
  categories: readonly Exclude<ContextualAsrCategory, 'person'>[],
  options: { allowProtected: boolean; forcedTerm?: string } = { allowProtected: false },
): ContextualAsrResult {
  const original = String(text || '').trim();
  const segments = prepareSegments(original);
  const replacements = new Map<number, Slot & { term: string }>();
  let strongestPending: { category: Exclude<ContextualAsrCategory, 'person'>; candidate: string; similarity: number } | null = null;
  let strongestApplied: { category: Exclude<ContextualAsrCategory, 'person'>; candidate: string; similarity: number } | null = null;

  segments.forEach((segment, index) => {
    for (const category of categories) {
      const slot = extractSlot(segment, category);
      if (!slot) continue;
      const slotNormalized = normalize(slot.value);
      if (!slotNormalized || slotNormalized.length > 40 || slotNormalized.split(' ').length > 6) continue;

      const exact = CONTEXTUAL_ASR_LEXICON.find((entry) => entry.category === category && normalize(entry.term) === slotNormalized);
      if (exact) {
        if (slot.value !== exact.term) {
          replacements.set(index, { ...slot, term: exact.term });
          strongestApplied = { category, candidate: exact.term, similarity: 1 };
        }
        break;
      }

      const ranked = rankSlot(slot, category, options.forcedTerm);
      if (!ranked) continue;
      const protectedPhrase = PROTECTED_PHRASES.has(slotNormalized);
      const highConfidence = ranked.similarity >= 0.72 && ranked.similarity + 0.15 >= 0.87 && ranked.margin >= 0.08;
      const forcedConfidence = Boolean(options.forcedTerm) && ranked.similarity >= 0.78;

      if (protectedPhrase && !options.allowProtected) {
        if (ranked.similarity >= 0.88 && ranked.margin >= 0.08) {
          if (!strongestPending || ranked.similarity > strongestPending.similarity) {
            strongestPending = { category, candidate: ranked.entry.term, similarity: ranked.similarity };
          }
        }
        continue;
      }

      if (highConfidence || forcedConfidence) {
        replacements.set(index, { ...slot, term: ranked.entry.term });
        if (!strongestApplied || ranked.similarity > strongestApplied.similarity) {
          strongestApplied = { category, candidate: ranked.entry.term, similarity: ranked.similarity };
        }
        break;
      }

      if (ranked.similarity >= 0.62 && (!strongestPending || ranked.similarity > strongestPending.similarity)) {
        strongestPending = { category, candidate: ranked.entry.term, similarity: ranked.similarity };
      }
    }
  });

  if (replacements.size > 0 && strongestApplied) {
    return {
      text: rebuildSegments(segments, replacements),
      applied: true,
      confidence: 'high',
      category: strongestApplied.category,
      candidate: strongestApplied.candidate,
      similarity: Math.round(strongestApplied.similarity * 1000) / 1000,
      stage: options.allowProtected ? 'stage3' : 'stage2',
    };
  }
  if (strongestPending) {
    return {
      text: original,
      applied: false,
      confidence: 'medium',
      category: strongestPending.category,
      candidate: strongestPending.candidate,
      similarity: Math.round(strongestPending.similarity * 1000) / 1000,
      needsConfirmation: true,
    };
  }
  return { text: original, applied: false, confidence: 'none' };
}

export function interpretContextualAsr(input: ContextualAsrInput): ContextualAsrResult {
  const original = String(input.text || '').trim();
  if (!original || input.enabled === false) return { text: original, applied: false, confidence: 'none' };

  const inference = inferCategories(input.previousAiText || '', input.topic);
  if (inference.person) return { text: original, applied: false, confidence: 'none', category: 'person' };
  if (inference.categories.length === 0) return { text: original, applied: false, confidence: 'none' };
  return evaluateText(original, inference.categories);
}

function containsCanonicalTerm(text: string, term: string): boolean {
  const haystack = normalize(text);
  const needle = normalize(term);
  if (!haystack || !needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, 'i').test(haystack);
}

function japaneseSupports(entry: LexiconEntry, translation: string): boolean {
  if (!translation || !entry.japaneseHints?.length) return false;
  return entry.japaneseHints.some((hint) => translation.includes(hint));
}

export function confirmContextualAsrWithAi(input: ContextualAsrAiConfirmationInput): ContextualAsrResult {
  const stage2 = interpretContextualAsr(input);
  if (stage2.applied || !stage2.candidate || !stage2.category || stage2.category === 'person') return stage2;
  if (stage2.confidence !== 'medium' || !stage2.needsConfirmation) return stage2;

  const entry = CONTEXTUAL_ASR_LEXICON.find((item) => item.term === stage2.candidate && item.category === stage2.category);
  if (!entry) return stage2;
  const replySupport = containsCanonicalTerm(input.aiReply || '', entry.term);
  const translationSupport = japaneseSupports(entry, input.studentJapaneseTranslation || '');

  // Stage 3 is deliberately conservative: a protected/ambiguous ASR form is
  // changed only when two independent outputs from the already-generated AI
  // turn agree on the same local term. No extra Claude instruction is needed.
  if (!replySupport || !translationSupport) return stage2;

  const inference = inferCategories(input.previousAiText || '', input.topic);
  const categories = inference.categories.length ? inference.categories : [entry.category];
  const forced = evaluateText(input.text, categories, { allowProtected: true, forcedTerm: entry.term });
  if (!forced.applied) return stage2;
  return { ...forced, stage: 'stage3', confidence: 'high' };
}

export function reconcileContextualAsrDisplay(input: ContextualAsrAiConfirmationInput): string {
  return confirmContextualAsrWithAi(input).text;
}
