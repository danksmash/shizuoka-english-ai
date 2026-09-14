import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildStableSpeechSnapshot,
  collapseProgressiveSpeechUnits,
  createStableSpeechRecognitionSession,
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

const stableSource = readFileSync('src/utils/stableSpeechRecognition.ts', 'utf8');
assert.ok(stableSource.includes('nextRecognition.continuous = true'), 'continuous recognition behavior must remain unchanged');
assert.ok(stableSource.includes('nextRecognition.interimResults = true'), 'interim recognition behavior must remain unchanged');
assert.ok(stableSource.includes('nextRecognition.maxAlternatives = maxAlternatives'), 'acoustic alternatives behavior must remain unchanged');
assert.ok(stableSource.includes("nextRecognition.lang = 'en-US'"), 'recognition language must remain unchanged');
assert.ok(stableSource.includes('if (stopFinished) return Promise.resolve(latestSnapshot);'), 'already-finished recognition must stop idempotently');
assert.ok(stableSource.includes("error === 'phrases-not-supported'"), 'unsupported phrase bias must have a targeted fallback');
assert.ok(stableSource.includes('contextualBiasDisabled = true'), 'phrase fallback must disable only browser-level contextual bias for the session');

class FakeSpeechRecognitionPhrase {
  phrase: string;
  boost: number;

  constructor(phrase: string, boost: number) {
    this.phrase = phrase;
    this.boost = boost;
  }
}

class FakeSpeechRecognition {
  static lastInstance: FakeSpeechRecognition | null = null;
  static instances: FakeSpeechRecognition[] = [];

  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  lang = '';
  phrases: FakeSpeechRecognitionPhrase[] = [];
  onstart: (() => void) | null = null;
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;

  constructor() {
    FakeSpeechRecognition.lastInstance = this;
    FakeSpeechRecognition.instances.push(this);
  }

  start() {
    this.onstart?.();
  }

  stop() {
    this.onend?.();
  }

  abort() {}
}

const originalWindow = (globalThis as any).window;
(globalThis as any).window = {
  SpeechRecognition: FakeSpeechRecognition,
  SpeechRecognitionPhrase: FakeSpeechRecognitionPhrase,
  setTimeout,
  clearTimeout,
};

try {
  let failedError = '';
  let failedEndReason = '';
  const failedSession = createStableSpeechRecognitionSession({
    onUpdate: () => undefined,
    onError: (error) => { failedError = error; },
    onEnd: (_snapshot, reason) => { failedEndReason = reason; },
  });
  assert.ok(failedSession, 'mock browser must create a speech recognition session');
  assert.equal(failedSession.start(), true, 'mock recognition must start normally before the injected failure');
  FakeSpeechRecognition.lastInstance?.onerror?.({ error: 'network' });
  assert.equal(failedError, 'network', 'fatal recognition error must reach the app callback');
  assert.equal(failedEndReason, 'failed', 'fatal recognition error must mark the session failed');

  const failedStopResult = await Promise.race([
    failedSession.requestStop().then((snapshot) => ({ kind: 'resolved' as const, snapshot })),
    new Promise<{ kind: 'timeout' }>((resolve) => setTimeout(() => resolve({ kind: 'timeout' }), 50)),
  ]);
  assert.equal(failedStopResult.kind, 'resolved', 'requestStop after a fatal recognition error must never remain pending');
  if (failedStopResult.kind === 'resolved') {
    assert.equal(failedStopResult.snapshot.bestText, '', 'failed empty recognition must resolve with its latest empty snapshot');
  }

  let normalUpdate = '';
  let normalEndReason = '';
  const normalSession = createStableSpeechRecognitionSession({
    onUpdate: (snapshot) => { normalUpdate = snapshot.bestText; },
    onError: (error) => { throw new Error(`unexpected normal-path recognition error: ${error}`); },
    onEnd: (_snapshot, reason) => { normalEndReason = reason; },
  });
  assert.ok(normalSession, 'second mock session must be independently creatable after failure');
  assert.equal(normalSession.start(), true, 'normal recognition path must still start');
  const normalRecognizer = FakeSpeechRecognition.lastInstance;
  assert.ok(normalRecognizer, 'normal recognizer instance must exist');
  assert.equal(normalRecognizer.continuous, true, 'normal path must preserve continuous=true');
  assert.equal(normalRecognizer.interimResults, true, 'normal path must preserve interimResults=true');
  assert.equal(normalRecognizer.maxAlternatives, 3, 'normal path must preserve three alternatives');
  assert.equal(normalRecognizer.lang, 'en-US', 'normal path must preserve en-US recognition');

  const resultItem: any = [{ transcript: 'I like natto', confidence: 0.9 }];
  resultItem.isFinal = true;
  normalRecognizer.onresult?.({ results: [resultItem] });
  assert.equal(normalUpdate, 'I like natto.', 'normal transcript construction must remain unchanged');
  const normalSnapshot = await normalSession.requestStop();
  assert.equal(normalSnapshot.bestText, 'I like natto.', 'normal stop must preserve the recognized transcript');
  assert.equal(normalEndReason, 'stopped', 'normal stop reason must remain stopped');

  FakeSpeechRecognition.instances = [];
  FakeSpeechRecognition.lastInstance = null;
  let fallbackError = '';
  let fallbackUpdate = '';
  const biasStatuses: boolean[] = [];
  const fallbackSession = createStableSpeechRecognitionSession({
    biasPhrases: [{ phrase: 'Hamamatsu', boost: 5 }],
    onUpdate: (snapshot) => { fallbackUpdate = snapshot.bestText; },
    onError: (error) => { fallbackError = error; },
    onBiasStatus: (applied) => { biasStatuses.push(applied); },
  });
  assert.ok(fallbackSession, 'phrase-fallback session must be creatable');
  assert.equal(fallbackSession.start(), true, 'phrase-fallback session must start with bias first');

  const biasedRecognizer = FakeSpeechRecognition.lastInstance;
  assert.ok(biasedRecognizer, 'biased recognizer must exist');
  assert.equal(biasedRecognizer.phrases.length, 1, 'supported-looking browser should receive phrase bias initially');
  biasedRecognizer.onerror?.({ error: 'phrases-not-supported' });
  biasedRecognizer.onend?.();

  await new Promise((resolve) => setTimeout(resolve, 5));
  const fallbackRecognizer = FakeSpeechRecognition.lastInstance;
  assert.ok(fallbackRecognizer, 'recognizer must be recreated after phrases-not-supported');
  assert.notEqual(fallbackRecognizer, biasedRecognizer, 'fallback must use a fresh recognizer instance');
  assert.equal(fallbackError, '', 'phrases-not-supported must not be surfaced as a fatal app error when fallback is possible');
  assert.equal(fallbackRecognizer.phrases.length, 0, 'fallback recognizer must omit browser-level phrase bias');
  assert.equal(fallbackRecognizer.continuous, true, 'fallback must preserve continuous=true');
  assert.equal(fallbackRecognizer.interimResults, true, 'fallback must preserve interimResults=true');
  assert.equal(fallbackRecognizer.maxAlternatives, 3, 'fallback must preserve acoustic alternatives');
  assert.equal(fallbackRecognizer.lang, 'en-US', 'fallback must preserve recognition language');
  assert.ok(biasStatuses.includes(true), 'first attempt must report phrase bias applied');
  assert.ok(biasStatuses.includes(false), 'fallback must report phrase bias disabled');

  const fallbackResult: any = [{ transcript: 'I live in Hamamatsu', confidence: 0.87 }];
  fallbackResult.isFinal = true;
  fallbackRecognizer.onresult?.({ results: [fallbackResult] });
  assert.equal(fallbackUpdate, 'I live in Hamamatsu.', 'fallback recognizer must still produce the normal transcript');
  const fallbackSnapshot = await fallbackSession.requestStop();
  assert.equal(fallbackSnapshot.bestText, 'I live in Hamamatsu.', 'fallback stop must preserve recognized speech');
} finally {
  if (typeof originalWindow === 'undefined') delete (globalThis as any).window;
  else (globalThis as any).window = originalWindow;
}

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
