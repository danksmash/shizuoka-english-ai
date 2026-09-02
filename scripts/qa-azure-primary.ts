import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const speech = fs.readFileSync('src/utils/speech.ts', 'utf8');
const azureTts = fs.readFileSync('src/server/azureTts.ts', 'utf8');

const must = [
  "import { azureTtsConfigured, synthesizeAzureTts } from './src/server/azureTts';",
  "ttsProvider: 'azure-speech'",
  "ttsFallback: 'google-chirp3-hd'",
  "const azure = await synthesizeAzureTts(text, aiStudentId, speakingRate, 3_500);",
  'X-TTS-Fallback-From',
];
for (const x of must) {
  if (!server.includes(x)) throw new Error(`missing ${x}`);
}

if (server.includes("ttsProvider: 'google-chirp3-hd'")) {
  throw new Error('health still reports Google primary');
}
if (!speech.includes("provider: 'azure-speech' | 'google-chirp3-hd' | 'device-fallback'")) {
  throw new Error('client provider union missing Azure');
}
if (!speech.includes("response.headers.get('X-TTS-Provider') === 'azure-speech'")) {
  throw new Error('client provider provenance missing');
}

// Gate 4 A/B evaluation used Azure default speed with no prosody rate.
// This assertion is intentionally part of PR CI so the accepted human-audition
// synthesis condition cannot silently regress in a later provider change.
// Prevent the regression that converted 0.90 into rate="90%".
if (!azureTts.includes('AZURE_GOLDEN_EFFECTIVE_RATE = 1.0')) {
  throw new Error('Gate 4 Golden Speed constant missing');
}
if (!azureTts.includes('void requestedRate;')) {
  throw new Error('Azure must explicitly ignore legacy/browser requestedRate');
}
if (azureTts.includes('ratePercent')) {
  throw new Error('Azure percentage rate conversion must not return');
}
if (/prosody\s+rate=/i.test(azureTts)) {
  throw new Error('Azure Golden Speed must not emit a prosody rate attribute');
}
if (!azureTts.includes('effectiveRate: AZURE_GOLDEN_EFFECTIVE_RATE')) {
  throw new Error('Azure effective-rate provenance must report Golden Speed');
}

console.log('Azure primary + Gate 4 Golden Speed QA passed');
