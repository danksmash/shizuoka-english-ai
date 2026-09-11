import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CONTEXTUAL_ASR_LEXICON,
  confirmContextualAsrWithAi,
  getContextualAsrBiasPhrases,
  interpretContextualAsr,
} from '../src/utils/contextualAsr';
import { applySpeechRecognitionBiasPhrases } from '../src/utils/speech';
import { getDialogueTopicContext } from '../src/data/dialogueTopicContext';

const foodContext = 'What food do you like?';
const natto = interpretContextualAsr({ text: 'I like know to.', previousAiText: foodContext, topic: 'favorites' });
assert.equal(natto.text, 'I like natto.');
assert.equal(natto.applied, true);
assert.equal(natto.confidence, 'high');
assert.equal(natto.category, 'food');
assert.equal(natto.stage, 'stage2');

const nattoVariant = interpretContextualAsr({ text: 'I like not toe.', previousAiText: foodContext, topic: 'favorites' });
assert.equal(nattoVariant.text, 'I like natto.');
assert.equal(nattoVariant.applied, true);

for (const protectedText of ['I like tomato.', 'I like potato.', 'I like NATO.', 'I like not to.']) {
  const result = interpretContextualAsr({ text: protectedText, previousAiText: foodContext, topic: 'favorites' });
  assert.equal(result.text, protectedText, 'protected phrase must not be rewritten before AI confirmation: ' + protectedText);
  assert.equal(result.applied, false, 'protected phrase must not be corrected at Stage 2: ' + protectedText);
}
const natoPending = interpretContextualAsr({ text: 'I like NATO.', previousAiText: foodContext, topic: 'favorites' });
assert.equal(natoPending.candidate, 'natto');
assert.equal(natoPending.confidence, 'medium');
assert.equal(natoPending.needsConfirmation, true);

for (const required of [
  'natto','karaage','ramen','curry rice','hamburger steak','omurice','sushi','ocha',
  'Hamamatsu','Kakegawa','Tenryu River','Lake Sanaru','Suruga Bay','Sunpu',
]) {
  assert.ok(CONTEXTUAL_ASR_LEXICON.some((entry) => entry.term === required), 'hybrid ASR lexicon missing: ' + required);
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

// Stage 1 bias must remain conservative. Broad prompts should not feed the
// recognizer dozens of unrelated local terms. Stage 2/3 may still use the
// broader lexicon after recognition.
const broadFavoritesBias = getContextualAsrBiasPhrases({
  previousAiText: "Let's talk about our favorite things. What do you like?",
  topic: 'favorites',
});
assert.equal(broadFavoritesBias.length, 0, 'broad favorites prompt must not inject food/place/culture bias');

const shizuokaBias = getContextualAsrBiasPhrases({
  previousAiText: "Let's talk about Shizuoka and culture. What do you like about Shizuoka?",
  topic: 'shizuoka_culture',
});
assert.ok(shizuokaBias.some((item) => item.phrase === 'matsuri'), 'explicit culture prompt should keep culture bias');
assert.equal(shizuokaBias.some((item) => item.phrase === 'unagi'), false, 'Shizuoka culture prompt must not inject food bias');
assert.equal(shizuokaBias.some((item) => item.phrase === 'Lake Hamana'), false, 'Shizuoka culture prompt must not inject place bias');

const explicitFoodBias = getContextualAsrBiasPhrases({ previousAiText: 'What food do you like?', topic: 'favorites' });
assert.ok(explicitFoodBias.some((item) => item.phrase === 'natto'));
assert.equal(explicitFoodBias.some((item) => item.phrase === 'Hamamatsu'), false);
const explicitPlaceBias = getContextualAsrBiasPhrases({ previousAiText: 'What lake do you like?', topic: 'shizuoka_culture' });
assert.ok(explicitPlaceBias.some((item) => item.phrase === 'Lake Hamana'));
assert.equal(explicitPlaceBias.some((item) => item.phrase === 'natto'), false);

const sportBias = getContextualAsrBiasPhrases({ previousAiText: 'What sport do you like?', topic: 'favorites' });
assert.equal(sportBias.length, 0, 'unrelated explicit sport context must not receive local-term bias');

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

const canonicalPlace = interpretContextualAsr({ text: 'I live in kakegawa.', previousAiText: 'Where do you live?', topic: 'intro' });
assert.equal(canonicalPlace.text, 'I live in Kakegawa.');
assert.equal(canonicalPlace.applied, true, 'correctly recognized local names must use canonical English spelling');

const matsuri = interpretContextualAsr({ text: 'I like Matt Surrey.', previousAiText: 'What Japanese culture do you like?', topic: 'shizuoka_culture' });
assert.equal(matsuri.text, 'I like matsuri.');
assert.equal(matsuri.applied, true);

const person = interpretContextualAsr({ text: 'My name is Haruto.', previousAiText: 'What is your name?', topic: 'intro' });
assert.equal(person.text, 'My name is Haruto.');
assert.equal(person.applied, false, 'learner/person names must not be auto-corrected');

const disabled = interpretContextualAsr({ text: 'I like know to.', previousAiText: foodContext, topic: 'favorites', enabled: false });
assert.equal(disabled.text, 'I like know to.');
assert.equal(disabled.applied, false);

const stage3Natto = confirmContextualAsrWithAi({
  text: 'I like NATO.',
  previousAiText: foodContext,
  topic: 'favorites',
  studentJapaneseTranslation: '私は納豆が好きです。',
  aiReply: 'Oh, natto? I want to try it.',
});
assert.equal(stage3Natto.text, 'I like natto.');
assert.equal(stage3Natto.applied, true);
assert.equal(stage3Natto.stage, 'stage3');

const stage3Compound = confirmContextualAsrWithAi({
  text: 'I like NATO do you like NATO',
  previousAiText: "Let's talk about our favorite things. What do you like?",
  topic: 'favorites',
  studentJapaneseTranslation: '私は納豆が好きです。あなたは納豆が好きですか。',
  aiReply: 'Yes, I like natto. I eat it with rice.',
});
assert.ok(stage3Compound.text.includes('I like natto.'), stage3Compound.text);
assert.ok(stage3Compound.text.toLowerCase().includes('do you like natto'), stage3Compound.text);

const stage3NoEvidence = confirmContextualAsrWithAi({
  text: 'I like NATO.',
  previousAiText: foodContext,
  topic: 'favorites',
  studentJapaneseTranslation: '私はNATOについて話しています。',
  aiReply: 'NATO is an organization.',
});
assert.equal(stage3NoEvidence.text, 'I like NATO.');
assert.equal(stage3NoEvidence.applied, false);

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
assert.equal(appSource.slice(sendStart, sendEnd).includes('interpretSpokenText('), false, 'manual text path must not run Stage 2 contextual correction');

const displaySource = readFileSync('src/components/DialogueView.tsx', 'utf8');
assert.ok(displaySource.includes('reconcileContextualAsrDisplay'), 'dialogue display must support conservative Stage 3 reconciliation');
assert.ok(displaySource.includes('studentJapaneseTranslation: msg.japaneseText'), 'Stage 3 display must use the existing AI interpretation instead of adding a new AI prompt');
assert.ok(displaySource.includes('aiReply: nextAiText'), 'Stage 3 display must require the already-generated AI reply as independent evidence');

const asrSource = readFileSync('src/utils/contextualAsr.ts', 'utf8');
const speechSource = readFileSync('src/utils/speech.ts', 'utf8');
assert.ok(speechSource.includes('SpeechRecognitionPhrase'), 'experimental contextual-bias progressive enhancement must be present');
assert.ok(speechSource.includes("!('phrases' in recognition)"), 'unsupported browser guard must be present');
assert.ok(asrSource.includes('broad prompts such as "What do you like?"'), 'Stage 1 broad-bias rollback guard must remain documented');
assert.equal(/know to[\s\S]{0,80}natto|natto[\s\S]{0,80}know to/i.test(asrSource), false, 'fixed know-to/natto replacement mapping is forbidden');
assert.ok(asrSource.includes('replySupport || !translationSupport') || asrSource.includes('!replySupport || !translationSupport'), 'Stage 3 must require independent AI evidence');

const infoGapContext = getDialogueTopicContext('favorites');
assert.ok(infoGapContext.includes('respond as this exchange-student persona rather than as an encyclopedia'), 'strategy must ground knowledge in the persona');
assert.ok(infoGapContext.includes('Even if the underlying AI model knows facts about the item'), 'strategy must prevent world-knowledge preemption');
assert.ok(infoGapContext.includes('invite the child to explain it'), 'strategy must preserve an information gap');
assert.ok(infoGapContext.includes('not obviously internationally familiar'), 'strategy must preserve common-item familiarity');
assert.ok(infoGapContext.includes('Never pretend ignorance mechanically'), 'strategy must avoid mechanical ignorance');
assert.ok(infoGapContext.includes('never force the same question'), 'strategy must avoid scripted What-is behavior');

console.log('HYBRID CONTEXTUAL ASR & INFORMATION-GAP QA PASS');
