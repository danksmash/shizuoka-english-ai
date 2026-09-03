import assert from 'node:assert/strict';
import { resolveTtsRuntimeMetadata } from '../src/server/ttsRuntimeMetadata';

const minjiAzure = resolveTtsRuntimeMetadata('minji_korea', 'azure-speech');
assert.deepEqual(minjiAzure, {
  provider: 'azure-speech',
  voiceName: 'en-US-AshleyNeural',
  languageCode: 'en-US',
});

const zofiaAzure = resolveTtsRuntimeMetadata('zofia_poland', 'azure-speech');
assert.deepEqual(zofiaAzure, {
  provider: 'azure-speech',
  voiceName: 'en-GB-LibbyNeural',
  languageCode: 'en-GB',
});

const emmaGoogle = resolveTtsRuntimeMetadata('emma_usa', 'google-chirp3-hd');
assert.deepEqual(emmaGoogle, {
  provider: 'google-chirp3-hd',
  voiceName: 'en-US-Chirp3-HD-Aoede',
  languageCode: 'en-US',
});

const deviceFallback = resolveTtsRuntimeMetadata('liam_australia', 'device-fallback');
assert.deepEqual(deviceFallback, {
  provider: 'device-fallback',
  voiceName: 'device',
  languageCode: 'not_observed',
});

const notObserved = resolveTtsRuntimeMetadata('emma_usa', '');
assert.deepEqual(notObserved, {
  provider: 'not_observed',
  voiceName: 'not_observed',
  languageCode: 'not_observed',
});

console.log('PASS qa-tts-runtime-metadata: Azure, Google Chirp, device fallback, and not-observed metadata are provider-consistent.');
