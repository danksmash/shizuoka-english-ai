import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildStableSpeechSnapshot,
  collapseProgressiveSpeechUnits,
} from '../src/utils/stableSpeechRecognition';

const repeated = buildStableSpeechSnapshot([
  { isFinal: true, alternatives: [{ transcript: 'natto', confidence: 0.88 }] },
  { isFinal: true, alternatives: [{ transcript: 'natto', confidence: 0.86 }] },
]);
assert.equal(repeated.bestText, 'Natto natto.', 'two finalized identical speech segments must both be preserved');

const progressive = collapseProgressiveSpeechUnits([
  { isFinal: false, alternatives: [{ transcript: 'My' }] },
  { isFinal: false, alternatives: [{ transcript: 'My name' }] },
  { isFinal: false, alternatives: [{ transcript: 'My name is' }] },
  { isFinal: true, alternatives: [{ transcript: 'My name is Ken' }] },
]);
assert.equal(progressive.length, 1, 'progressive hypotheses for one speech segment must collapse');
assert.equal(progressive[0].alternatives[0].transcript, 'My name is Ken');

const finalPlusInterim = buildStableSpeechSnapshot([
  { isFinal: true, alternatives: [{ transcript: 'I like', confidence: 0.9 }] },
  { isFinal: false, alternatives: [{ transcript: 'natto', confidence: 0.5 }] },
]);
assert.equal(finalPlusInterim.finalText, 'I like', 'live finalized prefix must not show terminal punctuation before interim speech');
assert.equal(finalPlusInterim.interimText.toLowerCase(), 'natto');
assert.equal(finalPlusInterim.bestText, 'I like natto.');

const withAlternatives = buildStableSpeechSnapshot([
  { isFinal: true, alternatives: [{ transcript: 'I like', confidence: 0.91 }] },
  {
    isFinal: true,
    alternatives: [
      { transcript: 'Naruto', confidence: 0.52 },
      { transcript: 'natto', confidence: 0.48 },
      { transcript: 'NATO', confidence: 0.31 },
    ],
  },
]);
assert.equal(withAlternatives.bestText, 'I like Naruto.');
assert.ok(withAlternatives.alternatives.some((item) => item.text === 'I like natto.'));
assert.ok(withAlternatives.alternatives.some((item) => item.text === 'I like NATO.'));

const appSource = readFileSync('src/App.tsx', 'utf8');
assert.ok(appSource.includes('createStableSpeechRecognitionSession'), 'App must use the stable recognition session');
assert.ok(appSource.includes('requestStop()'), 'stop/send must wait for recognizer finalization');
assert.equal(appSource.includes('setTimeout(resolve, 180)'), false, 'fixed 180ms microphone blind window must be removed');
assert.ok(appSource.includes('speechFinalTranscript'), 'App must retain finalized speech separately');
assert.ok(appSource.includes('speechInterimTranscript'), 'App must retain interim speech separately');

const inputSource = readFileSync('src/components/SpeechInputBar.tsx', 'utf8');
assert.ok(inputSource.includes('finalTranscript'), 'speech UI must receive finalized speech separately');
assert.ok(inputSource.includes('interimTranscript'), 'speech UI must receive interim speech separately');

console.log('STABLE SPEECH RECOGNITION QA PASS');
