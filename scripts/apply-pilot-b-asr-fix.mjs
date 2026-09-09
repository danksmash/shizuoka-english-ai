import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, content) { fs.writeFileSync(path, content); }
function replaceOnce(path, from, to) {
  const source = read(path);
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one match, found ${count}: ${from.slice(0, 120)}`);
  write(path, source.replace(from, to));
}

replaceOnce(
  'src/utils/contextualAsr.ts',
  "type LexiconEntry = {\n  term: string;\n  category: Exclude<ContextualAsrCategory, 'person'>;\n};",
  "type LexiconEntry = {\n  term: string;\n  category: Exclude<ContextualAsrCategory, 'person'>;\n  boost?: number;\n};"
);

replaceOnce(
  'src/utils/contextualAsr.ts',
  "  { term: 'natto', category: 'food' },\n",
  "  { term: 'natto', category: 'food' },\n  { term: 'karaage', category: 'food', boost: 4.5 },\n  { term: 'ramen', category: 'food', boost: 3.5 },\n  { term: 'curry rice', category: 'food', boost: 3.5 },\n  { term: 'hamburger steak', category: 'food', boost: 3.0 },\n  { term: 'omurice', category: 'food', boost: 3.5 },\n"
);
replaceOnce(
  'src/utils/contextualAsr.ts',
  "  { term: 'Hamamatsu', category: 'place' },\n",
  "  { term: 'Hamamatsu', category: 'place', boost: 4.0 },\n"
);
replaceOnce(
  'src/utils/contextualAsr.ts',
  "  { term: 'Shizuoka', category: 'place' },\n",
  "  { term: 'Shizuoka', category: 'place', boost: 4.0 },\n"
);
replaceOnce(
  'src/utils/contextualAsr.ts',
  "  { term: 'Mt. Fuji', category: 'place' },\n  { term: 'Lake Hamana', category: 'place' },\n",
  "  { term: 'Mt. Fuji', category: 'place', boost: 4.0 },\n  { term: 'Lake Hamana', category: 'place', boost: 4.0 },\n  { term: 'Tenryu River', category: 'place', boost: 4.0 },\n  { term: 'Lake Sanaru', category: 'place', boost: 4.0 },\n"
);
replaceOnce(
  'src/utils/contextualAsr.ts',
  "  'no two',\n]);",
  "  'no two',\n  'karaoke',\n]);"
);
replaceOnce(
  'src/utils/contextualAsr.ts',
  "  if (/\\b(where|place|city|town|live|from|visit|visited|go to|went to)\\b/.test(previous)) return 'place';",
  "  if (/\\b(where|place|city|town|lake|river|mountain|mount|park|station|sea|beach|live|from|visit|visited|go to|went to)\\b/.test(previous)) return 'place';"
);
replaceOnce(
  'src/utils/contextualAsr.ts',
  "type Slot = { prefix: string; value: string; suffix: string };",
  `export interface ContextualAsrBiasPhrase {\n  phrase: string;\n  boost: number;\n}\n\nexport function getContextualAsrBiasPhrases(input: Pick<ContextualAsrInput, 'previousAiText' | 'topic'>): ContextualAsrBiasPhrase[] {\n  const category = inferCategory(input.previousAiText || '', input.topic);\n  if (!category || category === 'person') return [];\n  return CONTEXTUAL_ASR_LEXICON\n    .filter((entry) => entry.category === category)\n    .map((entry) => ({ phrase: entry.term, boost: Math.max(0, Math.min(10, entry.boost ?? 2.5)) }));\n}\n\ntype Slot = { prefix: string; value: string; suffix: string };`
);

replaceOnce(
  'src/utils/speech.ts',
  "export function createSpeechRecognitionInstance(\n  onResult: (text: string, isFinal: boolean) => void,\n  onError: (error: string) => void,\n  onEnd: () => void\n) {",
  `export interface SpeechRecognitionBiasPhrase {\n  phrase: string;\n  boost: number;\n}\n\nexport function applySpeechRecognitionBiasPhrases(\n  recognition: any,\n  phrases: readonly SpeechRecognitionBiasPhrase[],\n  scope: any = typeof window !== 'undefined' ? window : undefined,\n): boolean {\n  if (!recognition || !scope || !phrases.length) return false;\n  const PhraseCtor = scope.SpeechRecognitionPhrase;\n  if (typeof PhraseCtor !== 'function' || !('phrases' in recognition)) return false;\n  try {\n    recognition.phrases = phrases.map((item) =>\n      new PhraseCtor(item.phrase, Math.max(0, Math.min(10, Number(item.boost) || 0))),\n    );\n    return true;\n  } catch (error) {\n    console.warn('Speech recognition contextual bias unavailable:', error);\n    return false;\n  }\n}\n\nexport function createSpeechRecognitionInstance(\n  onResult: (text: string, isFinal: boolean) => void,\n  onError: (error: string) => void,\n  onEnd: () => void,\n  biasPhrases: readonly SpeechRecognitionBiasPhrase[] = [],\n  onBiasStatus?: (applied: boolean, phraseCount: number) => void\n) {`
);
replaceOnce(
  'src/utils/speech.ts',
  "    recognition.lang = 'en-US'; // Broadest accuracy for elementary English speech\n\n    const isAndroidDevice",
  "    recognition.lang = 'en-US'; // Broadest accuracy for elementary English speech\n    const biasApplied = applySpeechRecognitionBiasPhrases(recognition, biasPhrases);\n    onBiasStatus?.(biasApplied, biasPhrases.length);\n\n    const isAndroidDevice"
);

replaceOnce(
  'src/App.tsx',
  "import { interpretContextualAsr } from './utils/contextualAsr';",
  "import { getContextualAsrBiasPhrases, interpretContextualAsr } from './utils/contextualAsr';"
);
replaceOnce(
  'src/App.tsx',
  `  const interpretSpokenText = useCallback((text: string) => {\n    const previousAiText = [...messagesRef.current].reverse().find((message) => message.sender === 'ai')?.englishText || '';\n    return interpretContextualAsr({\n      text,\n      previousAiText,\n      topic: profileRef.current.selectedTopic,\n      enabled: CONTEXTUAL_ASR_ENABLED,\n    }).text;\n  }, []);`,
  `  const interpretSpokenText = useCallback((text: string) => {\n    const previousAiText = [...messagesRef.current].reverse().find((message) => message.sender === 'ai')?.englishText || '';\n    const result = interpretContextualAsr({\n      text,\n      previousAiText,\n      topic: profileRef.current.selectedTopic,\n      enabled: CONTEXTUAL_ASR_ENABLED,\n    });\n    if (result.applied && result.candidate) {\n      recordResearchEvent('asr_contextual_correction', \`${result.category || 'unknown'}:${result.candidate}\`);\n    }\n    return result.text;\n  }, [recordResearchEvent]);`
);
replaceOnce(
  'src/App.tsx',
  "    recordResearchEvent('mic_start');\n    liveTranscriptRef.current=''; setSpeechTranscript(''); setIsRecording(true); setIsListening(true);\n    await new Promise((resolve) => setTimeout(resolve, 180));\n    const recognition = createSpeechRecognitionInstance(\n",
  "    recordResearchEvent('mic_start');\n    liveTranscriptRef.current=''; setSpeechTranscript(''); setIsRecording(true); setIsListening(true);\n    await new Promise((resolve) => setTimeout(resolve, 180));\n    const previousAiText = [...messagesRef.current].reverse().find((message) => message.sender === 'ai')?.englishText || '';\n    const asrBiasPhrases = getContextualAsrBiasPhrases({ previousAiText, topic: profileRef.current.selectedTopic });\n    const recognition = createSpeechRecognitionInstance(\n"
);
replaceOnce(
  'src/App.tsx',
  "      (err) => { recordResearchEvent('mic_error', String(err).slice(0, 40)); console.warn('Speech Rec Error:', err); setMicHintMessage(mapSpeechError(err)); setIsRecording(false); setIsListening(false); setTimeout(() => setMicHintMessage(''), 6000); },\n      () => { setIsRecording(false); setIsListening(false); }\n    );",
  "      (err) => { recordResearchEvent('mic_error', String(err).slice(0, 40)); console.warn('Speech Rec Error:', err); setMicHintMessage(mapSpeechError(err)); setIsRecording(false); setIsListening(false); setTimeout(() => setMicHintMessage(''), 6000); },\n      () => { setIsRecording(false); setIsListening(false); },\n      asrBiasPhrases,\n      (applied, phraseCount) => { if (phraseCount > 0) recordResearchEvent('asr_bias_status', `${applied ? 'applied' : 'unavailable'}:${phraseCount}`); }\n    );"
);

replaceOnce(
  'src/dataContract.ts',
  "  'tts_fallback_from','tts_fallback_reason','tts_latency_ms','tts_cache',\n] as const;",
  "  'tts_fallback_from','tts_fallback_reason','tts_latency_ms','tts_cache',\n  'asr_bias_status','asr_contextual_correction',\n] as const;"
);

replaceOnce(
  'scripts/qa-contextual-asr.ts',
  "import { interpretContextualAsr } from '../src/utils/contextualAsr';",
  "import { CONTEXTUAL_ASR_LEXICON, getContextualAsrBiasPhrases, interpretContextualAsr } from '../src/utils/contextualAsr';\nimport { applySpeechRecognitionBiasPhrases } from '../src/utils/speech';"
);
replaceOnce(
  'scripts/qa-contextual-asr.ts',
  "const exactFood = interpretContextualAsr({ text: 'I like sushi.', previousAiText: foodContext, topic: 'favorites' });",
  `for (const required of ['karaage','ramen','curry rice','hamburger steak','omurice','Tenryu River','Lake Sanaru']) {\n  assert.ok(CONTEXTUAL_ASR_LEXICON.some((entry) => entry.term === required), 'Pilot B ASR lexicon missing: ' + required);\n}\n\nconst karaage = interpretContextualAsr({ text: 'I like kara gee.', previousAiText: foodContext, topic: 'favorites' });\nassert.equal(karaage.text, 'I like karaage.');\nassert.equal(karaage.applied, true);\nconst karaoke = interpretContextualAsr({ text: 'I like karaoke.', previousAiText: foodContext, topic: 'favorites' });\nassert.equal(karaoke.text, 'I like karaoke.');\nassert.equal(karaoke.applied, false, 'valid karaoke must never be silently rewritten to karaage');\nconst curryRice = interpretContextualAsr({ text: 'I like curry rise.', previousAiText: foodContext, topic: 'favorites' });\nassert.equal(curryRice.text, 'I like curry rice.');\nconst hamburgerSteak = interpretContextualAsr({ text: 'I like hamburger stake.', previousAiText: foodContext, topic: 'favorites' });\nassert.equal(hamburgerSteak.text, 'I like hamburger steak.');\nconst tenryu = interpretContextualAsr({ text: 'I like Tenryu liver.', previousAiText: 'What river do you like in Shizuoka?', topic: 'shizuoka_culture' });\nassert.equal(tenryu.text, 'I like Tenryu River.');\nconst sanaru = interpretContextualAsr({ text: 'I like Lake Sonaru.', previousAiText: 'What lake do you like?', topic: 'shizuoka_culture' });\nassert.equal(sanaru.text, 'I like Lake Sanaru.');\n\nconst foodBias = getContextualAsrBiasPhrases({ previousAiText: foodContext, topic: 'favorites' });\nassert.ok(foodBias.some((item) => item.phrase === 'karaage' && item.boost >= 4));\nconst placeBias = getContextualAsrBiasPhrases({ previousAiText: 'What river or lake do you like?', topic: 'shizuoka_culture' });\nfor (const term of ['Lake Hamana','Tenryu River','Lake Sanaru']) assert.ok(placeBias.some((item) => item.phrase === term), 'place bias missing: ' + term);\nconst sportBias = getContextualAsrBiasPhrases({ previousAiText: 'What sport do you like?', topic: 'favorites' });\nassert.equal(sportBias.length, 0, 'unrelated contexts must not receive food/place bias');\n\nclass MockPhrase { constructor(public phrase: string, public boost: number) {} }\nconst mockRecognition: any = { phrases: [] };\nassert.equal(applySpeechRecognitionBiasPhrases(mockRecognition, [{ phrase: 'karaage', boost: 4.5 }], { SpeechRecognitionPhrase: MockPhrase }), true);\nassert.equal(mockRecognition.phrases[0].phrase, 'karaage');\nassert.equal(mockRecognition.phrases[0].boost, 4.5);\nassert.equal(applySpeechRecognitionBiasPhrases({}, [{ phrase: 'karaage', boost: 4.5 }], {}), false, 'unsupported browsers must safely no-op');\n\nconst exactFood = interpretContextualAsr({ text: 'I like sushi.', previousAiText: foodContext, topic: 'favorites' });`
);
replaceOnce(
  'scripts/qa-contextual-asr.ts',
  "assert.ok(appSource.includes('interpretSpokenText(pendingRawText)'), 'timeout pending speech must use the same contextual interpretation');",
  "assert.ok(appSource.includes('interpretSpokenText(pendingRawText)'), 'timeout pending speech must use the same contextual interpretation');\nassert.ok(appSource.includes('getContextualAsrBiasPhrases'), 'microphone path must prepare contextual recognition hints');\nassert.ok(appSource.includes(\"recordResearchEvent('asr_bias_status'\"), 'ASR bias availability must be logged without transcript text');\nassert.ok(appSource.includes(\"recordResearchEvent('asr_contextual_correction'\"), 'contextual corrections must be counted without raw transcript logging');"
);
replaceOnce(
  'scripts/qa-contextual-asr.ts',
  "const asrSource = readFileSync('src/utils/contextualAsr.ts', 'utf8');",
  "const asrSource = readFileSync('src/utils/contextualAsr.ts', 'utf8');\nconst speechSource = readFileSync('src/utils/speech.ts', 'utf8');\nassert.ok(speechSource.includes('SpeechRecognitionPhrase'), 'experimental contextual-bias progressive enhancement must be present');\nassert.ok(speechSource.includes(\"!('phrases' in recognition)\"), 'unsupported browser guard must be present');"
);

console.log('Pilot B ASR patch applied.');
