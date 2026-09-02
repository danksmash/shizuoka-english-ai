import fs from 'node:fs/promises';
import { synthesizeAzureTts } from '../src/server/azureTts';
import { TARGET_20_AI_STUDENT_IDS } from '../src/data/curriculum';

const chatBaseUrl = (process.env.GATE5_CHAT_URL || 'https://shizuoka-english-ai-1075707511474.asia-northeast1.run.app').replace(/\/$/, '');
const outputDir = process.env.GATE5_OUTPUT_DIR || 'gate5-artifacts';
const levels = [10, 20, 30, 35] as const;
const timeoutMs = 50_000;

type FlowResult = {
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
  let chatResponse: Response;
  try {
    chatResponse = await fetch(`${chatBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Hello! Nice to meet you.',
        history: [],
        topic: 'intro',
        aiStudentId: personaId,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const now = performance.now();
    return { personaId, chatStatus: 0, ttsStatus: 'skipped', chatMs: now - chatStart, ttsMs: null, combinedMs: now - totalStart, provider: null, voice: null, ok: false, error: `chat_fetch:${error instanceof Error ? error.message : String(error)}` };
  }
  const chatMs = performance.now() - chatStart;
  const chatBody = await chatResponse.text();
  if (!chatResponse.ok) {
    return { personaId, chatStatus: chatResponse.status, ttsStatus: 'skipped', chatMs, ttsMs: null, combinedMs: performance.now() - totalStart, provider: null, voice: null, ok: false, error: `chat_http_${chatResponse.status}:${chatBody.slice(0, 160)}` };
  }

  let reply = '';
  try {
    const parsed = JSON.parse(chatBody) as {
      success?: boolean;
      isFallback?: boolean;
      data?: { reply?: string };
      _diagnostics?: { route?: string; model?: string };
    };
    const route = parsed._diagnostics?.route || '';
    if (parsed.success !== true || parsed.isFallback !== false || route !== 'anthropic-resilient') {
      throw new Error(`route=${route},success=${String(parsed.success)},fallback=${String(parsed.isFallback)}`);
    }
    reply = String(parsed.data?.reply || '').trim();
    if (!reply) throw new Error('empty reply');
  } catch (error) {
    return { personaId, chatStatus: chatResponse.status, ttsStatus: 'skipped', chatMs, ttsMs: null, combinedMs: performance.now() - totalStart, provider: null, voice: null, ok: false, error: `chat_invalid:${error instanceof Error ? error.message : String(error)}` };
  }

  const ttsStart = performance.now();
  try {
    const tts = await synthesizeAzureTts(reply.slice(0, 280), personaId, 0.95, 20_000);
    const ttsMs = performance.now() - ttsStart;
    return {
      personaId,
      chatStatus: chatResponse.status,
      ttsStatus: 'ok',
      chatMs,
      ttsMs,
      combinedMs: performance.now() - totalStart,
      provider: tts.provider,
      voice: tts.voiceName,
      ok: tts.audio.length > 500 && tts.provider === 'azure-speech',
      error: tts.audio.length > 500 && tts.provider === 'azure-speech' ? '' : `tts_invalid:${tts.audio.length}:${tts.provider}`,
    };
  } catch (error) {
    const ttsMs = performance.now() - ttsStart;
    return { personaId, chatStatus: chatResponse.status, ttsStatus: 'error', chatMs, ttsMs, combinedMs: performance.now() - totalStart, provider: null, voice: null, ok: false, error: `tts_error:${error instanceof Error ? error.message : String(error)}` };
  }
}

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

const all: FlowResult[] = [];
const levelSummaries: Record<string, unknown>[] = [];
let offset = 0;
for (const concurrency of levels) {
  const started = performance.now();
  const results = await Promise.all(Array.from({ length: concurrency }, (_, i) => runFlow(offset + i)));
  offset += concurrency;
  all.push(...results);
  const chat = results.map((r) => r.chatMs);
  const tts = results.map((r) => r.ttsMs).filter((v): v is number => typeof v === 'number');
  const combined = results.map((r) => r.combinedMs);
  const summary = {
    concurrency,
    attempted: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    http429: results.filter((r) => r.chatStatus === 429 || r.error.includes('HTTP_429') || r.error.includes('HTTP 429')).length,
    chatP50Ms: percentile(chat, 0.5),
    chatP95Ms: percentile(chat, 0.95),
    ttsP50Ms: percentile(tts, 0.5),
    ttsP95Ms: percentile(tts, 0.95),
    combinedP50Ms: percentile(combined, 0.5),
    combinedP95Ms: percentile(combined, 0.95),
    wallMs: Math.round((performance.now() - started) * 10) / 10,
  };
  levelSummaries.push(summary);
  console.log(JSON.stringify(summary));
}

const report = {
  gate: 5,
  topology: 'production Cloud Run /api/chat (Claude) -> exact PR2 Azure provider executed from GitHub Actions runner',
  productionTtsPrimaryChanged: false,
  firestoreSessionWriteCalls: 0,
  attemptedFlows: all.length,
  succeededFlows: all.filter((r) => r.ok).length,
  failedFlows: all.filter((r) => !r.ok).length,
  http429Total: all.filter((r) => r.chatStatus === 429 || r.error.includes('HTTP_429') || r.error.includes('HTTP 429')).length,
  providers: [...new Set(all.map((r) => r.provider).filter(Boolean))],
  voicesObserved: new Set(all.map((r) => r.voice).filter(Boolean)).size,
  levels: levelSummaries,
};

await fs.writeFile(`${outputDir}/gate5-summary.json`, JSON.stringify(report, null, 2));
await fs.writeFile(`${outputDir}/gate5-flows.json`, JSON.stringify(all, null, 2));

if (all.length !== levels.reduce((a, b) => a + b, 0)) throw new Error(`Gate 5 attempted flow count mismatch: ${all.length}`);
if (report.failedFlows !== 0) {
  const first = all.find((r) => !r.ok);
  throw new Error(`Gate 5 FAIL: ${report.failedFlows} flows failed; first=${JSON.stringify(first)}`);
}
if (report.http429Total !== 0) throw new Error(`Gate 5 FAIL: HTTP 429 count=${report.http429Total}`);
if (JSON.stringify(report.providers) !== JSON.stringify(['azure-speech'])) throw new Error(`Gate 5 FAIL: provider set=${JSON.stringify(report.providers)}`);
if (levelSummaries.some((row) => Number(row.combinedP95Ms || 0) > 30_000)) throw new Error('Gate 5 FAIL: combined p95 exceeded 30 seconds');

console.log('Gate 5: PASS');
console.log(JSON.stringify(report, null, 2));
