import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getAzureTtsCacheKey, getAzureTtsStaticFilePath } from '../src/server/azureTts';

const server = fs.readFileSync('server.ts', 'utf8');
const speech = fs.readFileSync('src/utils/speech.ts', 'utf8');
const azureTts = fs.readFileSync('src/server/azureTts.ts', 'utf8');
const dataContract = fs.readFileSync('src/dataContract.ts', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const persistence = fs.readFileSync('src/server/persistence.ts', 'utf8');
const workflow = fs.readFileSync('.github/workflows/cloud-run-deploy.yml', 'utf8');
const fixedGenerator = fs.readFileSync('scripts/generate-fixed-azure-tts.ts', 'utf8');

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
if (!persistence.includes("ttsTelemetryVersion: 'cors-visible-v1'")) throw new Error('TTS telemetry provenance version missing');

if (!azureTts.includes('Math.max(0.75, Math.min(1.25, rate))')) throw new Error('Azure 0.75-1.25 rate clamp missing');
if (!azureTts.includes('const AZURE_LEADING_SILENCE_MS = 200')) throw new Error('Azure 200ms leading silence constant missing');
if (!azureTts.includes('xmlns:mstts=\"http://www.w3.org/2001/mstts\"')) throw new Error('Azure mstts namespace missing');
if (!azureTts.includes('type=\"Leading-exact\" value=\"${AZURE_LEADING_SILENCE_MS}ms\"')) throw new Error('Azure Leading-exact silence control missing');
if (!azureTts.includes('<prosody rate=\"${rate.toFixed(2)}\">')) throw new Error('Azure SSML prosody rate control missing');
if (!azureTts.includes('effectiveRate: rate')) throw new Error('Azure effective rate provenance missing');
if (!azureTts.includes("const AZURE_OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3'")) throw new Error('Azure output format changed unexpectedly');

for (const marker of [
  "export type AzureTtsCacheStatus = 'STATIC' | 'HIT' | 'MISS'",
  'AZURE_TTS_MEMORY_CACHE_TTL_MS = 60 * 60_000',
  'AZURE_TTS_MEMORY_CACHE_MAX_ENTRIES = 300',
  'AZURE_TTS_MEMORY_CACHE_MAX_BYTES = 32 * 1024 * 1024',
  'const azureTtsPending = new Map',
  'readStaticAzureTts',
]) if (!azureTts.includes(marker)) throw new Error('Azure cost-safe cache marker missing: ' + marker);

if (!fixedGenerator.includes('DIALOGUE_TOPIC_IDS')) throw new Error('fixed TTS generator must include every dialogue topic');
if (!fixedGenerator.includes('AI_STUDENT_IDS')) throw new Error('fixed TTS generator must include all research personas');
if (!fixedGenerator.includes('getStudentFarewellMessage')) throw new Error('fixed TTS generator must include current farewell messages');
if (!fixedGenerator.includes('getAzureTtsStaticFilePath')) throw new Error('fixed TTS generator must use the runtime cache-key path');
if (!workflow.includes('Pre-generate fixed Azure TTS assets')) throw new Error('production workflow missing fixed Azure TTS generation');
if (!workflow.includes('--min-instances 0')) throw new Error('Cloud Run must scale to zero when idle');
if (workflow.includes('--min-instances 1')) throw new Error('Cloud Run min-instances=1 cost regression');

const baseKey = getAzureTtsCacheKey('Hello.', 'emma_usa', 1.0);
assert.equal(baseKey, getAzureTtsCacheKey('Hello.', 'emma_usa', 1.0), 'same Azure request must have a stable cache key');
assert.notEqual(baseKey, getAzureTtsCacheKey('Hello.', 'emma_usa', 0.75), 'speaking rate must be part of the Azure cache key');
assert.notEqual(baseKey, getAzureTtsCacheKey('Hello.', 'oliver_uk', 1.0), 'persona voice must be part of the Azure cache key');
assert.match(getAzureTtsStaticFilePath('Hello.', 'emma_usa', 1.0), /runtime-static-tts/);

console.log('Azure primary + Voice Profile v3 + cost-safe cache/static audio + min=0 QA: PASS');
