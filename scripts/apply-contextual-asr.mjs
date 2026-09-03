import { readFileSync, writeFileSync } from 'node:fs';

function mustReplace(text, search, replacement, label) {
  const first = text.indexOf(search);
  if (first < 0) throw new Error(`Missing expected source for ${label}`);
  if (text.indexOf(search, first + search.length) >= 0) throw new Error(`Expected one match for ${label}`);
  return text.slice(0, first) + replacement + text.slice(first + search.length);
}

let app = readFileSync('src/App.tsx', 'utf8');
app = mustReplace(
  app,
  "import { detectVocabularyInText } from './data/vocabulary56';\n",
  "import { detectVocabularyInText } from './data/vocabulary56';\nimport { interpretContextualAsr } from './utils/contextualAsr';\n",
  'contextual ASR import',
);
app = mustReplace(
  app,
  "const LABELS_VISIBLE = PERSONA_LABEL_CONDITION === 'shown';\n",
  "const LABELS_VISIBLE = PERSONA_LABEL_CONDITION === 'shown';\nconst CONTEXTUAL_ASR_ENABLED = import.meta.env.VITE_CONTEXTUAL_ASR_ENABLED !== 'false';\n",
  'contextual ASR feature flag',
);
app = mustReplace(
  app,
  "  const handleSendMessage = async (text: string) => {\n",
  `  const interpretSpokenText = useCallback((text: string) => {\n    const previousAiText = [...messagesRef.current].reverse().find((message) => message.sender === 'ai')?.englishText || '';\n    return interpretContextualAsr({\n      text,\n      previousAiText,\n      topic: profileRef.current.selectedTopic,\n      enabled: CONTEXTUAL_ASR_ENABLED,\n    }).text;\n  }, []);\n\n  const handleSendMessage = async (text: string) => {\n`,
  'speech-only interpretation helper',
);
app = mustReplace(
  app,
  "      if (spokenText) { await handleSendMessage(spokenText); liveTranscriptRef.current=''; setSpeechTranscript(''); }\n",
  "      if (spokenText) { const interpretedText=interpretSpokenText(spokenText); await handleSendMessage(interpretedText); liveTranscriptRef.current=''; setSpeechTranscript(''); }\n",
  'microphone send interpretation',
);
app = mustReplace(
  app,
  "    const pendingText=(liveTranscriptRef.current || speechTranscript || '').trim();\n",
  "    const pendingRawText=(liveTranscriptRef.current || speechTranscript || '').trim();\n    const pendingText=pendingRawText ? interpretSpokenText(pendingRawText) : '';\n",
  'timeout pending speech interpretation',
);
writeFileSync('src/App.tsx', app);

const contextualAsr = `import type { DialogueTopic } from '../types';

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
    .replace(/\\s+/g, ' ')
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
      .replace(/(.)\\1+/g, '$1'))
    .join('');
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
  if (/\\b(food|eat|eating|drink|breakfast|lunch|dinner|snack|dish|meal)\\b/.test(previous)) return 'food';
  if (/\\b(where|place|city|town|live|from|visit|visited|go to|went to)\\b/.test(previous)) return 'place';
  if (/\\b(culture|festival|tradition|custom|japanese|japan|shizuoka)\\b/.test(previous)) return 'culture';
  if (/\\b(name|who|person|friend)\\b/.test(previous)) return 'person';
  if (topic === 'shizuoka_culture' && /\\b(what do you like|tell me about)\\b/.test(previous)) return 'culture';
  return null;
}

type Slot = { prefix: string; value: string; suffix: string };

function extractSlot(text: string, category: ContextualAsrCategory): Slot | null {
  const frames: RegExp[] = category === 'place'
    ? [/^(\\s*(?:(?:yes|yeah|no)[,.]?\\s+)?(?:i live in|i am from|i'm from|i went to|i go to|i want to go to|i visited|i like)\\s+)([^.!?]+)([.!?]*)\\s*$/i]
    : category === 'person'
      ? [/^(\\s*(?:my name is|call me|my friend is)\\s+)([^.!?]+)([.!?]*)\\s*$/i]
      : [/^(\\s*(?:(?:yes|yeah|no)[,.]?\\s+)?(?:i like|i love|my favorite food is|my favourite food is|i eat|i want to eat)\\s+)([^.!?]+)([.!?]*)\\s*$/i];
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
`;
writeFileSync('src/utils/contextualAsr.ts', contextualAsr);

const topicContext = `import type { DialogueTopic } from '../types';

const TOPIC_CONTEXTS: Record<DialogueTopic, string> = {
  intro: 'Get to know each other naturally: names, ages, home countries or places, and simple personal information.',
  favorites: 'Talk naturally about things each person likes, such as food, sports, animals, subjects, music, and hobbies.',
  shizuoka_culture: 'Share simple things about Shizuoka, Japan, the persona home country, food, places, and culture.',
  talents: 'Talk naturally about things each person can do or is good at.',
  daily_routine: 'Talk naturally about everyday routines and time: getting up, breakfast, university or school, helping at home, free time, dinner, bedtime, and weekends.',
  free: 'Follow the child naturally across familiar everyday topics while keeping the English easy.',
};

export const INFORMATION_GAP_STRATEGY_ENABLED =
  typeof process === 'undefined' || process.env.CONTEXTUAL_DIALOGUE_STRATEGY_ENABLED !== 'false';

const INFORMATION_GAP_STRATEGY =
  'When the child newly introduces a local food, place, cultural item, or other specific thing that has not been explained in the conversation, give the child room to explain it. React briefly and prefer one easy, natural follow-up about what it is, what it is like, or how the child enjoys it. Do not pretend not to know common things, do not ask What is ...? mechanically, and if it is already explained or clearly familiar to the persona, respond naturally instead.';

export function getDialogueTopicContext(topic: DialogueTopic): string {
  const base = TOPIC_CONTEXTS[topic];
  return INFORMATION_GAP_STRATEGY_ENABLED ? base + ' ' + INFORMATION_GAP_STRATEGY : base;
}
`;
writeFileSync('src/data/dialogueTopicContext.ts', topicContext);

const qa = `import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { interpretContextualAsr } from '../src/utils/contextualAsr';
import { getDialogueTopicContext } from '../src/data/dialogueTopicContext';

const foodContext = 'What food do you like?';
const natto = interpretContextualAsr({ text: 'I like know to.', previousAiText: foodContext, topic: 'favorites' });
assert.equal(natto.text, 'I like natto.');
assert.equal(natto.applied, true);
assert.equal(natto.confidence, 'high');
assert.equal(natto.category, 'food');

const nattoVariant = interpretContextualAsr({ text: 'I like not toe.', previousAiText: foodContext, topic: 'favorites' });
assert.equal(nattoVariant.text, 'I like natto.');
assert.equal(nattoVariant.applied, true);

for (const protectedText of ['I like tomato.', 'I like potato.', 'I like NATO.', 'I like not to.']) {
  const result = interpretContextualAsr({ text: protectedText, previousAiText: foodContext, topic: 'favorites' });
  assert.equal(result.text, protectedText, 'false correction: ' + protectedText);
  assert.equal(result.applied, false, 'protected phrase must not be corrected: ' + protectedText);
}

const exactFood = interpretContextualAsr({ text: 'I like sushi.', previousAiText: foodContext, topic: 'favorites' });
assert.equal(exactFood.text, 'I like sushi.');
assert.equal(exactFood.applied, false);

const wrongContext = interpretContextualAsr({ text: 'I like know to.', previousAiText: 'What sport do you like?', topic: 'favorites' });
assert.equal(wrongContext.text, 'I like know to.');
assert.equal(wrongContext.applied, false);

const noContext = interpretContextualAsr({ text: 'I like know to.', previousAiText: '', topic: 'favorites' });
assert.equal(noContext.text, 'I like know to.');
assert.equal(noContext.applied, false);

const hamamatsu = interpretContextualAsr({ text: 'I live in hammer matsu.', previousAiText: 'Where do you live?', topic: 'intro' });
assert.equal(hamamatsu.text, 'I live in Hamamatsu.');
assert.equal(hamamatsu.applied, true);

const matsuri = interpretContextualAsr({ text: 'I like Matt Surrey.', previousAiText: 'What Japanese culture do you like?', topic: 'shizuoka_culture' });
assert.equal(matsuri.text, 'I like matsuri.');
assert.equal(matsuri.applied, true);

const person = interpretContextualAsr({ text: 'My name is Haruto.', previousAiText: 'What is your name?', topic: 'intro' });
assert.equal(person.text, 'My name is Haruto.');
assert.equal(person.applied, false, 'learner/person names must not be auto-corrected');

const disabled = interpretContextualAsr({ text: 'I like know to.', previousAiText: foodContext, topic: 'favorites', enabled: false });
assert.equal(disabled.text, 'I like know to.');
assert.equal(disabled.applied, false);

const appSource = readFileSync('src/App.tsx', 'utf8');
assert.ok(appSource.includes("VITE_CONTEXTUAL_ASR_ENABLED !== 'false'"), 'client rollback feature flag is required');
assert.ok(appSource.includes('interpretSpokenText(spokenText)'), 'microphone send must use contextual interpretation');
assert.ok(appSource.includes('interpretSpokenText(pendingRawText)'), 'timeout pending speech must use the same contextual interpretation');
const sendStart = appSource.indexOf('const handleSendMessage');
const sendEnd = appSource.indexOf('const mapSpeechError');
assert.ok(sendStart >= 0 && sendEnd > sendStart);
assert.equal(appSource.slice(sendStart, sendEnd).includes('interpretSpokenText('), false, 'manual text path must not be contextually corrected');

const asrSource = readFileSync('src/utils/contextualAsr.ts', 'utf8');
assert.equal(/know to[\\s\\S]{0,80}natto|natto[\\s\\S]{0,80}know to/i.test(asrSource), false, 'fixed know-to/natto replacement mapping is forbidden');

const infoGapContext = getDialogueTopicContext('favorites');
assert.ok(infoGapContext.includes('give the child room to explain it'), 'information-gap strategy must be present');
assert.ok(infoGapContext.includes('Do not pretend not to know common things'), 'strategy must avoid mechanical ignorance');
assert.ok(infoGapContext.includes('do not ask What is ...? mechanically'), 'strategy must avoid scripted What-is behavior');

console.log('CONTEXTUAL ASR & INFORMATION-GAP QA PASS');
`;
writeFileSync('scripts/qa-contextual-asr.ts', qa);

const packagePath = 'package.json';
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
pkg.scripts['qa:contextual-asr'] = 'tsx scripts/qa-contextual-asr.ts';
if (!pkg.scripts.qa.includes('npm run qa:contextual-asr')) {
  pkg.scripts.qa = pkg.scripts.qa.replace('npm run qa:speech &&', 'npm run qa:speech && npm run qa:contextual-asr &&');
}
writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');

console.log('Applied contextual ASR and information-gap patch.');
