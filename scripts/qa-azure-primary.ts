import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const speech = fs.readFileSync('src/utils/speech.ts', 'utf8');
const dataContract = fs.readFileSync('src/dataContract.ts', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');

for (const required of [
  "ttsProvider: 'azure-speech'",
  "ttsFallback: 'google-chirp3-hd'",
  "synthesizeAzureTts(text, aiStudentId, speakingRate, 3_500)",
  'Access-Control-Expose-Headers',
  'X-TTS-Provider',
  'X-TTS-Fallback-From',
  'X-TTS-Fallback-Reason',
  'X-TTS-Effective-Rate',
  'X-TTS-Latency-Ms',
]) if (!server.includes(required)) throw new Error('server TTS observability missing: ' + required);

if (!speech.includes("'device-fallback' | 'not_observed'")) throw new Error('client not_observed provider state missing');
if (!speech.includes("rawProvider === 'google-chirp3-hd'")) throw new Error('client must explicitly recognize Chirp');
if (!speech.includes(": 'not_observed'")) throw new Error('unreadable provider header must become not_observed');
if (speech.includes("response.headers.get('X-TTS-Provider') === 'azure-speech' ? 'azure-speech' : 'google-chirp3-hd'")) throw new Error('silent Azure-to-Chirp misclassification regression');

for (const eventType of ['tts_fallback_from','tts_fallback_reason','tts_latency_ms','tts_cache']) if (!dataContract.includes(eventType)) throw new Error('research event missing: ' + eventType);
for (const marker of ['telemetry?.fallbackFrom','telemetry?.fallbackReason','telemetry?.latencyMs']) if (!app.includes(marker)) throw new Error('App TTS telemetry persistence missing: ' + marker);
console.log('Azure primary + CORS provider observability QA: PASS');
