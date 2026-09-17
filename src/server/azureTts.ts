import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AZURE_SPEECH_REGION, getAzureVoiceProfile } from '../data/azureVoiceProfiles';

export type AzureTtsCacheStatus = 'STATIC' | 'HIT' | 'MISS';

export type AzureTtsResult = {
  audio: Buffer;
  provider: 'azure-speech';
  voiceName: string;
  region: string;
  effectiveRate: number;
  cache: AzureTtsCacheStatus;
};

const AZURE_LEADING_SILENCE_MS = 200;
const AZURE_OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';
export const AZURE_TTS_STATIC_VERSION = 'voice-profile-v3-cost-v1';
const AZURE_TTS_MEMORY_CACHE_TTL_MS = 60 * 60_000;
const AZURE_TTS_MEMORY_CACHE_MAX_ENTRIES = 300;
const AZURE_TTS_MEMORY_CACHE_MAX_BYTES = 32 * 1024 * 1024;

type AzureTtsCacheEntry = {
  result: AzureTtsResult;
  expiresAt: number;
  size: number;
};

const azureTtsMemoryCache = new Map<string, AzureTtsCacheEntry>();
const azureTtsPending = new Map<string, Promise<AzureTtsResult>>();
let azureTtsMemoryCacheBytes = 0;

function escapeXml(value: string): string {
  return value.replace(/[<>&'\"]/g, (char) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  }[char] || char));
}

function normalizeRate(rate: number): number {
  if (!Number.isFinite(rate)) return 1.0;
  return Math.max(0.75, Math.min(1.25, rate));
}

function resolveAzureTtsKeyMaterial(text: string, aiStudentId: string, requestedRate: number) {
  const profile = getAzureVoiceProfile(aiStudentId);
  if (!profile) throw new Error('UNKNOWN_AZURE_TTS_PERSONA');
  const rate = normalizeRate(requestedRate);
  return {
    version: AZURE_TTS_STATIC_VERSION,
    aiStudentId,
    voiceName: profile.voiceName,
    synthesisLocale: profile.synthesisLocale,
    sentenceBoundaryMs: profile.sentenceBoundaryMs || 0,
    leadingSilenceMs: AZURE_LEADING_SILENCE_MS,
    outputFormat: AZURE_OUTPUT_FORMAT,
    rate: rate.toFixed(2),
    text: text.trim(),
  };
}

export function getAzureTtsCacheKey(text: string, aiStudentId: string, requestedRate: number): string {
  return crypto.createHash('sha256').update(JSON.stringify(resolveAzureTtsKeyMaterial(text, aiStudentId, requestedRate))).digest('hex');
}

export function getAzureTtsStaticFilePath(text: string, aiStudentId: string, requestedRate = 1.0): string {
  return path.join(
    process.cwd(),
    'runtime-static-tts',
    AZURE_TTS_STATIC_VERSION,
    `${getAzureTtsCacheKey(text, aiStudentId, requestedRate)}.mp3`,
  );
}

function removeMemoryCacheEntry(key: string) {
  const existing = azureTtsMemoryCache.get(key);
  if (!existing) return;
  azureTtsMemoryCache.delete(key);
  azureTtsMemoryCacheBytes = Math.max(0, azureTtsMemoryCacheBytes - existing.size);
}

function trimMemoryCache() {
  while (
    azureTtsMemoryCache.size > AZURE_TTS_MEMORY_CACHE_MAX_ENTRIES ||
    azureTtsMemoryCacheBytes > AZURE_TTS_MEMORY_CACHE_MAX_BYTES
  ) {
    const oldestKey = azureTtsMemoryCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    removeMemoryCacheEntry(oldestKey);
  }
}

function getMemoryCachedAzureTts(key: string): AzureTtsResult | null {
  const entry = azureTtsMemoryCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    removeMemoryCacheEntry(key);
    return null;
  }
  // Refresh LRU order without changing the cached audio bytes.
  azureTtsMemoryCache.delete(key);
  azureTtsMemoryCache.set(key, entry);
  return {
    ...entry.result,
    cache: entry.result.cache === 'STATIC' ? 'STATIC' : 'HIT',
  };
}

function setMemoryCachedAzureTts(key: string, result: AzureTtsResult) {
  removeMemoryCacheEntry(key);
  const entry: AzureTtsCacheEntry = {
    result,
    expiresAt: Date.now() + AZURE_TTS_MEMORY_CACHE_TTL_MS,
    size: result.audio.byteLength,
  };
  azureTtsMemoryCache.set(key, entry);
  azureTtsMemoryCacheBytes += entry.size;
  trimMemoryCache();
}

async function readStaticAzureTts(
  text: string,
  aiStudentId: string,
  requestedRate: number,
): Promise<AzureTtsResult | null> {
  const rate = normalizeRate(requestedRate);
  if (Math.abs(rate - 1.0) > 0.0001) return null;
  const profile = getAzureVoiceProfile(aiStudentId);
  if (!profile) throw new Error('UNKNOWN_AZURE_TTS_PERSONA');
  const region = (process.env.AZURE_SPEECH_REGION || AZURE_SPEECH_REGION).trim().toLowerCase();
  if (region !== AZURE_SPEECH_REGION) {
    throw new Error(`AZURE_SPEECH_REGION_MISMATCH:${region}`);
  }
  try {
    const audio = await fs.readFile(getAzureTtsStaticFilePath(text, aiStudentId, rate));
    if (audio.byteLength < 500) return null;
    return {
      audio,
      provider: 'azure-speech',
      voiceName: profile.voiceName,
      region,
      effectiveRate: rate,
      cache: 'STATIC',
    };
  } catch (error: any) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

export function azureTtsConfigured(): boolean {
  return Boolean(process.env.AZURE_SPEECH_KEY?.trim());
}

async function synthesizeAzureTtsFresh(
  text: string,
  aiStudentId: string,
  requestedRate: number,
  timeoutMs: number,
): Promise<AzureTtsResult> {
  const apiKey = process.env.AZURE_SPEECH_KEY?.trim();
  if (!apiKey) throw new Error('AZURE_SPEECH_NOT_CONFIGURED');

  const profile = getAzureVoiceProfile(aiStudentId);
  if (!profile) throw new Error('UNKNOWN_AZURE_TTS_PERSONA');

  const region = (process.env.AZURE_SPEECH_REGION || AZURE_SPEECH_REGION).trim().toLowerCase();
  if (region !== AZURE_SPEECH_REGION) {
    throw new Error(`AZURE_SPEECH_REGION_MISMATCH:${region}`);
  }

  const rate = normalizeRate(requestedRate);
  const msttsNamespace = ' xmlns:mstts="http://www.w3.org/2001/mstts"';
  const leadingSilence = `<mstts:silence type="Leading-exact" value="${AZURE_LEADING_SILENCE_MS}ms"/>`;
  const sentenceBoundary = profile.sentenceBoundaryMs
    ? `<mstts:silence type="Sentenceboundary-exact" value="${profile.sentenceBoundaryMs}ms"/>`
    : '';
  const ssml = [
    `<speak version="1.0"${msttsNamespace} xml:lang="${escapeXml(profile.synthesisLocale)}">`,
    `<voice name="${escapeXml(profile.voiceName)}">${leadingSilence}${sentenceBoundary}<prosody rate="${rate.toFixed(2)}">${escapeXml(text)}</prosody></voice>`,
    '</speak>',
  ].join('');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': AZURE_OUTPUT_FORMAT,
        'User-Agent': 'shizuoka-english-ai',
      },
      body: ssml,
      signal: controller.signal,
    });

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!response.ok) {
      throw new Error(`AZURE_TTS_HTTP_${response.status}`);
    }
    const contentType = response.headers.get('content-type') || '';
    if (!/audio\/(mpeg|mp3)/i.test(contentType)) {
      throw new Error(`AZURE_TTS_UNEXPECTED_CONTENT_TYPE:${contentType}`);
    }
    if (bytes.length < 500) {
      throw new Error(`AZURE_TTS_AUDIO_TOO_SMALL:${bytes.length}`);
    }

    return {
      audio: Buffer.from(bytes),
      provider: 'azure-speech',
      voiceName: profile.voiceName,
      region,
      effectiveRate: rate,
      cache: 'MISS',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Azure Speech synthesis provider.
 *
 * Cost-safe behavior is intentionally limited to transport-level reuse:
 * 1. pre-generated fixed 1.00x starter/farewell audio when present,
 * 2. bounded in-memory LRU reuse for identical dynamic requests,
 * 3. in-flight request coalescing for simultaneous identical requests.
 *
 * The text, persona voice profile, SSML, speaking-rate behavior, fallback order,
 * and child-facing dialogue logic remain unchanged.
 */
export async function synthesizeAzureTts(
  text: string,
  aiStudentId: string,
  requestedRate: number,
  timeoutMs = 8_000
): Promise<AzureTtsResult> {
  const key = getAzureTtsCacheKey(text, aiStudentId, requestedRate);

  const memoryHit = getMemoryCachedAzureTts(key);
  if (memoryHit) return memoryHit;

  const staticHit = await readStaticAzureTts(text, aiStudentId, requestedRate);
  if (staticHit) {
    setMemoryCachedAzureTts(key, staticHit);
    return staticHit;
  }

  const pending = azureTtsPending.get(key);
  if (pending) {
    const result = await pending;
    return { ...result, cache: result.cache === 'STATIC' ? 'STATIC' : 'HIT' };
  }

  const task = synthesizeAzureTtsFresh(text, aiStudentId, requestedRate, timeoutMs)
    .then((result) => {
      setMemoryCachedAzureTts(key, result);
      return result;
    })
    .finally(() => azureTtsPending.delete(key));

  azureTtsPending.set(key, task);
  return task;
}
