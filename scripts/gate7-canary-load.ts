import fs from 'node:fs/promises';
import { synthesizeAzureTts } from '../src/server/azureTts';
import { TARGET_20_AI_STUDENT_IDS } from '../src/data/curriculum';

const chatBaseUrl = String(process.env.GATE7_CANARY_URL || '').replace(/\/$/, '');
const outputDir = process.env.GATE7_OUTPUT_DIR || 'gate7-artifacts';
const concurrency = 70;
const timeoutMs = 50_000;

if (!chatBaseUrl || !/^https:\/\//.test(chatBaseUrl)) throw new Error('GATE7_CANARY_URL is required');
if (chatBaseUrl.includes('shizuoka-english-ai-1075707511474.asia-northeast1.run.app')) {
  throw new Error('Gate 7 must not target the production Cloud Run service');
}

type FlowResult = {
  index: number;
  personaId: string;
  chatStatus: number;
  ttsStatus: 'ok' | 'error' | 'skipped';
  chatMs: number;
  ttsMs: number | null;
  combinedMs: number;
  provider: string | null;
  voice: string | null;
  ok: boolean;
  error: string;
};

function percentile(values: number[], q: number): number | null {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(ordered.length - 1, Math.round((ordered.length - 1) * q)));
  return Math.round(ordered[index] * 10) / 10;
}

async function runFlow(index: number): Promise<FlowResult> {
  const personaId = TARGET_20_AI_STUDENT_IDS[index % TARGET_20_AI_STUDENT_IDS.length];
  const totalStart = performance.now();
  const chatStart = performance.now();
  let response: Response;
  try {
    response = await fetch(`${chatBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Gate7-Canary': '70-user' },
      body: JSON.stringify({
        message: index % 2 === 0 ? 'Hello! Nice to meet you.' : 'I like soccer. What do you like?',
        history: [],
        topic: index % 2 === 0 ? 'intro' : 'favorites',
        aiStudentId: personaId,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const now = performance.now();
    return { index, personaId, chatStatus: 0, ttsStatus: 'skipped', chatMs: now - chatStart, ttsMs: null, combinedMs: now - totalStart, provider: null, voice: null, ok: false, error: `chat_fetch:${error instanceof Error ? error.message : String(error)}` };
  }
  const chatMs = performance.now() - chatStart;
  const body = await response.text();
  if (!response.ok) {
    return { index, personaId, chatStatus: response.status, ttsStatus: 'skipped', chatMs, ttsMs: null, combinedMs: performance.now() - totalStart, provider: null, voice: null, ok: false, error: `chat_http_${response.status}:${body.slice(0, 180)}` };
  }

  let reply = '';
  try {
    const parsed = JSON.parse(body) as {
      success?: boolean;
      isFallback?: boolean;
      data?: { reply?: string };
      _diagnostics?: { route?: string; model?: string };
    };
    if (parsed.success !== true || parsed.isFallback !== false || parsed._diagnostics?.route !== 'anthropic-resilient') {
      throw new Error(`route=${parsed._diagnostics?.route},fallback=${String(parsed.isFallback)},success=${String(parsed.success)}`);
    }
    reply = String(parsed.data?.reply || '').trim();
    if (!reply) throw new Error('empty reply');
  } catch (error) {
    return { index, personaId, chatStatus: response.status, ttsStatus: 'skipped', chatMs, ttsMs: null, combinedMs: performance.now() - totalStart, provider: null, voice: null, ok: false, error: `chat_invalid:${error instanceof Error ? error.message : String(error)}` };
  }

  const ttsStart = performance.now();
  try {
    const tts = await synthesizeAzureTts(reply.slice(0, 280), personaId, 0.95, 20_000);
    const ttsMs = performance.now() - ttsStart;
    const ok = tts.provider === 'azure-speech' && tts.audio.length > 500;
    return { index, personaId, chatStatus: response.status, ttsStatus: 'ok', chatMs, ttsMs, combinedMs: performance.now() - totalStart, provider: tts.provider, voice: tts.voiceName, ok, error: ok ? '' : `tts_invalid:${tts.provider}:${tts.audio.length}` };
  } catch (error) {
    const ttsMs = performance.now() - ttsStart;
    return { index, personaId, chatStatus: response.status, ttsStatus: 'error', chatMs, ttsMs, combinedMs: performance.now() - totalStart, provider: null, voice: null, ok: false, error: `tts_error:${error instanceof Error ? error.message : String(error)}` };
  }
}

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });
const started = performance.now();
const results = await Promise.all(Array.from({ length: concurrency }, (_, index) => runFlow(index)));
const wallMs = Math.round((performance.now() - started) * 10) / 10;
const chat = results.map((r) => r.chatMs);
const tts = results.map((r) => r.ttsMs).filter((v): v is number => typeof v === 'number');
const combined = results.map((r) => r.combinedMs);
const report = {
  gate: 7,
  topology: 'isolated Cloud Run canary /api/chat (Claude) + exact PR2 Azure provider in GitHub Actions; no production endpoint, no session writes',
  canaryUrl: chatBaseUrl,
  concurrency,
  attempted: results.length,
  succeeded: results.filter((r) => r.ok).length,
  failed: results.filter((r) => !r.ok).length,
  http429: results.filter((r) => r.chatStatus === 429 || r.error.includes('429')).length,
  chatP50Ms: percentile(chat, 0.5),
  chatP95Ms: percentile(chat, 0.95),
  ttsP50Ms: percentile(tts, 0.5),
  ttsP95Ms: percentile(tts, 0.95),
  combinedP50Ms: percentile(combined, 0.5),
  combinedP95Ms: percentile(combined, 0.95),
  wallMs,
  voicesObserved: new Set(results.map((r) => r.voice).filter(Boolean)).size,
  providers: [...new Set(results.map((r) => r.provider).filter(Boolean))],
  firestoreSessionWriteCalls: 0,
  productionEndpointCalls: 0,
  productionPrimaryChanged: false,
};
await fs.writeFile(`${outputDir}/gate7-summary.json`, JSON.stringify(report, null, 2));
await fs.writeFile(`${outputDir}/gate7-flows.json`, JSON.stringify(results, null, 2));

if (results.length !== 70) throw new Error(`Gate 7 attempted count mismatch: ${results.length}`);
if (report.failed !== 0) throw new Error(`Gate 7 FAIL: ${report.failed} flows failed; first=${JSON.stringify(results.find((r) => !r.ok))}`);
if (report.http429 !== 0) throw new Error(`Gate 7 FAIL: HTTP 429 count=${report.http429}`);
if (JSON.stringify(report.providers) !== JSON.stringify(['azure-speech'])) throw new Error(`Gate 7 FAIL: provider set=${JSON.stringify(report.providers)}`);
if (report.voicesObserved !== 20) throw new Error(`Gate 7 FAIL: expected all 20 voices, got ${report.voicesObserved}`);
if (Number(report.combinedP95Ms || 0) > 30_000) throw new Error(`Gate 7 FAIL: combined p95 ${report.combinedP95Ms}ms`);

console.log('Gate 7: PASS');
console.log(JSON.stringify(report, null, 2));
