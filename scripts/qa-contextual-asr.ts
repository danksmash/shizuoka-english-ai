import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONTEXTUAL_ASR_LEXICON, getContextualAsrBiasPhrases, interpretContextualAsr } from '../src/utils/contextualAsr';
import { applySpeechRecognitionBiasPhrases } from '../src/utils/speech';
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

for (const required of ['karaage','ramen','curry rice','hamburger steak','omurice','Tenryu River','Lake Sanaru']) {
  assert.ok(CONTEXTUAL_ASR_LEXICON.some((entry) => entry.term === required), 'Pilot B ASR lexicon missing: ' + required);
}

const karaage = interpretContextualAsr({ text: 'I like kara gee.', previousAiText: foodContext, topic: 'favorites' });
assert.equal(karaage.text, 'I like karaage.');
assert.equal(karaage.applied, true);
const karaoke = interpretContextualAsr({ text: 'I like karaoke.', previousAiText: foodContext, topic: 'favorites' });
assert.equal(karaoke.text, 'I like karaoke.');
assert.equal(karaoke.applied, false, 'valid karaoke must never be silently rewritten to karaage');
const curryRice = interpretContextualAsr({ text: 'I like curry rise.', previousAiText: foodContext, topic: 'favorites' });
assert.equal(curryRice.text, 'I like curry rice.');
const hamburgerSteak = interpretContextualAsr({ text: 'I like hamburger stake.', previousAiText: foodContext, topic: 'favorites' });
assert.equal(hamburgerSteak.text, 'I like hamburger steak.');
const tenryu = interpretContextualAsr({ text: 'I like Tenryu liver.', previousAiText: 'What river do you like in Shizuoka?', topic: 'shizuoka_culture' });
assert.equal(tenryu.text, 'I like Tenryu River.');
const sanaru = interpretContextualAsr({ text: 'I like Lake Sonaru.', previousAiText: 'What lake do you like?', topic: 'shizuoka_culture' });
assert.equal(sanaru.text, 'I like Lake Sanaru.');

const foodBias = getContextualAsrBiasPhrases({ previousAiText: foodContext, topic: 'favorites' });
assert.ok(foodBias.some((item) => item.phrase === 'karaage' && item.boost >= 4));
const placeBias = getContextualAsrBiasPhrases({ previousAiText: 'What river or lake do you like?', topic: 'shizuoka_culture' });
for (const term of ['Lake Hamana','Tenryu River','Lake Sanaru']) assert.ok(placeBias.some((item) => item.phrase === term), 'place bias missing: ' + term);
const sportBias = getContextualAsrBiasPhrases({ previousAiText: 'What sport do you like?', topic: 'favorites' });
assert.equal(sportBias.length, 0, 'unrelated contexts must not receive food/place bias');

class MockPhrase { constructor(public phrase: string, public boost: number) {} }
const mockRecognition: any = { phrases: [] };
assert.equal(applySpeechRecognitionBiasPhrases(mockRecognition, [{ phrase: 'karaage', boost: 4.5 }], { SpeechRecognitionPhrase: MockPhrase }), true);
assert.equal(mockRecognition.phrases[0].phrase, 'karaage');
assert.equal(mockRecognition.phrases[0].boost, 4.5);
assert.equal(applySpeechRecognitionBiasPhrases({}, [{ phrase: 'karaage', boost: 4.5 }], {}), false, 'unsupported browsers must safely no-op');

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
assert.ok(appSource.includes('getContextualAsrBiasPhrases'), 'microphone path must prepare contextual recognition hints');
assert.ok(appSource.includes("recordResearchEvent('asr_bias_status'"), 'ASR bias availability must be logged without transcript text');
assert.ok(appSource.includes("recordResearchEvent('asr_contextual_correction'"), 'contextual corrections must be counted without raw transcript logging');
const sendStart = appSource.indexOf('const handleSendMessage');
const sendEnd = appSource.indexOf('const mapSpeechError');
assert.ok(sendStart >= 0 && sendEnd > sendStart);
assert.equal(appSource.slice(sendStart, sendEnd).includes('interpretSpokenText('), false, 'manual text path must not be contextually corrected');

const asrSource = readFileSync('src/utils/contextualAsr.ts', 'utf8');
const speechSource = readFileSync('src/utils/speech.ts', 'utf8');
assert.ok(speechSource.includes('SpeechRecognitionPhrase'), 'experimental contextual-bias progressive enhancement must be present');
assert.ok(speechSource.includes("!('phrases' in recognition)"), 'unsupported browser guard must be present');
assert.equal(/know to[\s\S]{0,80}natto|natto[\s\S]{0,80}know to/i.test(asrSource), false, 'fixed know-to/natto replacement mapping is forbidden');

const infoGapContext = getDialogueTopicContext('favorites');
assert.ok(infoGapContext.includes('respond as this exchange-student persona rather than as an encyclopedia'), 'strategy must ground knowledge in the persona');
assert.ok(infoGapContext.includes('Even if the underlying AI model knows facts about the item'), 'strategy must prevent world-knowledge preemption');
assert.ok(infoGapContext.includes('invite the child to explain it'), 'strategy must preserve an information gap');
assert.ok(infoGapContext.includes('not obviously internationally familiar'), 'strategy must preserve common-item familiarity');
assert.ok(infoGapContext.includes('Never pretend ignorance mechanically'), 'strategy must avoid mechanical ignorance');
assert.ok(infoGapContext.includes('never force the same question'), 'strategy must avoid scripted What-is behavior');

console.log('CONTEXTUAL ASR & INFORMATION-GAP QA PASS');
