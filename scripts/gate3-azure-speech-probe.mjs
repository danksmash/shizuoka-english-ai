import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const key = process.env.AZURE_SPEECH_KEY || '';
const region = (process.env.AZURE_SPEECH_REGION || 'japaneast').trim().toLowerCase();
const outputDir = process.env.AZURE_GATE3_OUTPUT_DIR || 'azure-gate3-artifacts';
const timeoutMs = Number(process.env.AZURE_GATE3_TIMEOUT_MS || 15000);
const levels = (process.env.AZURE_GATE3_TPS_LEVELS || '5,10,20,30,35')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value > 0 && value <= 50);

if (!key) {
  console.error('AZURE_SPEECH_KEY is not configured. Add it as a GitHub Actions secret before running Gate 3.');
  process.exit(2);
}
if (region !== 'japaneast') {
  console.error(`Gate 3 requires Japan East (japaneast), but AZURE_SPEECH_REGION=${region}.`);
  process.exit(2);
}

const base = `https://${region}.tts.speech.microsoft.com`;
const voicesUrl = `${base}/cognitiveservices/voices/list`;
const synthUrl = `${base}/cognitiveservices/v1`;

function escapeXml(text) {
  return text.replace(/[<>&'\"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char]);
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Math.round(sorted[index] * 10) / 10;
}

async function requestVoices() {
  const started = performance.now();
  const response = await fetch(voicesUrl, {
    headers: { 'Ocp-Apim-Subscription-Key': key },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const elapsedMs = performance.now() - started;
  const text = await response.text();
  if (!response.ok) throw new Error(`voices/list failed: HTTP ${response.status} ${text.slice(0, 300)}`);
  const voices = JSON.parse(text);
  return { voices, elapsedMs };
}

function selectProbeVoice(voices) {
  const preferred = ['en-US-JennyNeural', 'en-US-AriaNeural', 'en-US-GuyNeural'];
  for (const name of preferred) {
    const voice = voices.find((item) => item?.ShortName === name);
    if (voice) return voice;
  }
  return voices.find((item) => String(item?.Locale || '').startsWith('en-') && /Neural/i.test(String(item?.VoiceType || '')))
    || voices.find((item) => String(item?.Locale || '').startsWith('en-'))
    || voices[0];
}

async function synthesize({ voiceName, locale, text, requestTimeoutMs = timeoutMs }) {
  const ssml = `<speak version="1.0" xml:lang="${escapeXml(locale)}"><voice name="${escapeXml(voiceName)}">${escapeXml(text)}</voice></speak>`;
  const started = performance.now();
  const response = await fetch(synthUrl, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'shizuoka-english-ai-gate3-probe',
    },
    body: ssml,
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  const elapsedMs = performance.now() - started;
  const bytes = new Uint8Array(await response.arrayBuffer());
  return {
    status: response.status,
    ok: response.ok,
    elapsedMs,
    bytes,
    contentType: response.headers.get('content-type') || '',
    requestId: response.headers.get('x-requestid') || response.headers.get('x-microsoft-requestid') || '',
  };
}

async function pacedBurst({ tps, voiceName, locale }) {
  const results = [];
  const started = performance.now();
  await Promise.all(Array.from({ length: tps }, (_, index) => new Promise((resolve) => {
    const delay = Math.floor((index * 1000) / tps);
    setTimeout(async () => {
      try {
        const result = await synthesize({
          voiceName,
          locale,
          text: `Gate three capacity check ${tps} transactions per second, sample ${index + 1}.`,
        });
        results.push({ status: result.status, elapsedMs: result.elapsedMs, bytes: result.bytes.length });
      } catch (error) {
        results.push({ status: 0, elapsedMs: null, bytes: 0, error: error instanceof Error ? error.name : 'unknown' });
      } finally {
        resolve();
      }
    }, delay);
  }))));
  const wallMs = performance.now() - started;
  const statusCounts = {};
  for (const row of results) statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
  const successfulLatencies = results.filter((row) => row.status >= 200 && row.status < 300 && Number.isFinite(row.elapsedMs)).map((row) => row.elapsedMs);
  return {
    targetTps: tps,
    requests: results.length,
    successes: results.filter((row) => row.status >= 200 && row.status < 300).length,
    http429: results.filter((row) => row.status === 429).length,
    failures: results.filter((row) => !(row.status >= 200 && row.status < 300)).length,
    statusCounts,
    wallMs: Math.round(wallMs * 10) / 10,
    p50LatencyMs: percentile(successfulLatencies, 50),
    p95LatencyMs: percentile(successfulLatencies, 95),
  };
}

await fs.mkdir(outputDir, { recursive: true });

const voicesResult = await requestVoices();
if (!Array.isArray(voicesResult.voices) || voicesResult.voices.length === 0) {
  throw new Error('voices/list returned no voices.');
}
const probeVoice = selectProbeVoice(voicesResult.voices);
if (!probeVoice?.ShortName) throw new Error('Could not select an English probe voice.');

const voiceName = String(probeVoice.ShortName);
const locale = String(probeVoice.Locale || 'en-US');
const single = await synthesize({ voiceName, locale, text: 'Hello. This is the Azure Speech Gate three test for elementary English learning.' });
if (!single.ok) throw new Error(`MP3 synthesis failed: HTTP ${single.status}`);
if (!/audio\/(mpeg|mp3)/i.test(single.contentType)) throw new Error(`Unexpected content type: ${single.contentType}`);
if (single.bytes.length <= 500) throw new Error(`MP3 is unexpectedly small: ${single.bytes.length} bytes`);
await fs.writeFile(path.join(outputDir, 'azure-gate3-probe.mp3'), single.bytes);

const latencySamples = [];
for (let index = 0; index < 5; index += 1) {
  const result = await synthesize({ voiceName, locale, text: `Latency sample ${index + 1}. Nice to meet you.` });
  if (!result.ok) throw new Error(`Latency sample ${index + 1} failed: HTTP ${result.status}`);
  latencySamples.push(result.elapsedMs);
}

let timeoutProbe = { exercised: false, outcome: 'not-run' };
try {
  const result = await synthesize({ voiceName, locale, text: 'Timeout handling probe.', requestTimeoutMs: 1 });
  timeoutProbe = { exercised: true, outcome: `response-${result.status}` };
} catch (error) {
  timeoutProbe = { exercised: true, outcome: error instanceof Error ? error.name : 'abort-or-timeout' };
}

const capacity = [];
for (const tps of levels) {
  capacity.push(await pacedBurst({ tps, voiceName, locale }));
  await new Promise((resolve) => setTimeout(resolve, 1200));
}

const report = {
  generatedAt: new Date().toISOString(),
  gate: 3,
  region,
  endpoint: base,
  secretConfigured: true,
  voicesList: {
    success: true,
    count: voicesResult.voices.length,
    latencyMs: Math.round(voicesResult.elapsedMs * 10) / 10,
  },
  probeVoice: {
    shortName: voiceName,
    locale,
    gender: probeVoice.Gender || '',
    voiceType: probeVoice.VoiceType || '',
  },
  mp3: {
    success: true,
    bytes: single.bytes.length,
    contentType: single.contentType,
    latencyMs: Math.round(single.elapsedMs * 10) / 10,
    requestIdPresent: Boolean(single.requestId),
  },
  sequentialLatency: {
    samples: latencySamples.length,
    p50Ms: percentile(latencySamples, 50),
    p95Ms: percentile(latencySamples, 95),
    minMs: Math.round(Math.min(...latencySamples) * 10) / 10,
    maxMs: Math.round(Math.max(...latencySamples) * 10) / 10,
  },
  timeoutProbe,
  capacity,
  acceptance: {
    basicConnectivity: true,
    fiveTpsNoFailure: capacity.find((row) => row.targetTps === 5)?.failures === 0,
    tenTpsNoFailure: capacity.find((row) => row.targetTps === 10)?.failures === 0,
    observed429: capacity.reduce((sum, row) => sum + row.http429, 0),
    note: '20/30/35 TPS are observational measurements for Gate 3. Voice-specific backend capacity can produce HTTP 429 even when the S0 quota is 30 TPS.',
  },
};

const markdown = [
  '# Azure Speech Gate 3 Report',
  '',
  `- Generated: ${report.generatedAt}`,
  `- Region: ${report.region}`,
  `- voices/list: PASS (${report.voicesList.count} voices, ${report.voicesList.latencyMs} ms)`,
  `- Probe voice: ${voiceName} (${locale})`,
  `- MP3: PASS (${report.mp3.bytes} bytes, ${report.mp3.latencyMs} ms)`,
  `- Sequential latency: P50 ${report.sequentialLatency.p50Ms} ms / P95 ${report.sequentialLatency.p95Ms} ms`,
  `- Timeout path: ${report.timeoutProbe.outcome}`,
  '',
  '## Capacity probe',
  '',
  '| Target TPS | Success | HTTP 429 | Other failures | P50 ms | P95 ms |',
  '|---:|---:|---:|---:|---:|---:|',
  ...capacity.map((row) => `| ${row.targetTps} | ${row.successes}/${row.requests} | ${row.http429} | ${row.failures - row.http429} | ${row.p50LatencyMs ?? ''} | ${row.p95LatencyMs ?? ''} |`),
  '',
  '> 35 TPS is intentionally observational. A 429 there is not itself a failure. Any failure at 5 TPS is a Gate 3 blocker.',
  '',
].join('\n');

await fs.writeFile(path.join(outputDir, 'gate3-report.json'), JSON.stringify(report, null, 2));
await fs.writeFile(path.join(outputDir, 'gate3-report.md'), markdown);

console.log(markdown);
if (!report.acceptance.fiveTpsNoFailure) {
  console.error('Gate 3 blocker: the selected voice could not sustain the 5 TPS baseline without failure.');
  process.exit(1);
}
