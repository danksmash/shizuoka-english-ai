import assert from 'node:assert/strict';
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
assert.equal(/know to[\s\S]{0,80}natto|natto[\s\S]{0,80}know to/i.test(asrSource), false, 'fixed know-to/natto replacement mapping is forbidden');

const infoGapContext = getDialogueTopicContext('favorites');
assert.ok(infoGapContext.includes('respond as this exchange-student persona rather than as an encyclopedia'), 'strategy must ground knowledge in the persona');
assert.ok(infoGapContext.includes('Even if the underlying AI model knows facts about the item'), 'strategy must prevent world-knowledge preemption');
assert.ok(infoGapContext.includes('invite the child to explain it'), 'strategy must preserve an information gap');
assert.ok(infoGapContext.includes('not obviously internationally familiar'), 'strategy must preserve common-item familiarity');
assert.ok(infoGapContext.includes('Never pretend ignorance mechanically'), 'strategy must avoid mechanical ignorance');
assert.ok(infoGapContext.includes('never force the same question'), 'strategy must avoid scripted What-is behavior');

console.log('CONTEXTUAL ASR & INFORMATION-GAP QA PASS');
