import { AZURE_SPEECH_REGION, getAzureVoiceProfile } from '../data/azureVoiceProfiles';

export type AzureTtsResult = {
  audio: Buffer;
  provider: 'azure-speech';
  voiceName: string;
  region: string;
  effectiveRate: number;
};

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

export function azureTtsConfigured(): boolean {
  return Boolean(process.env.AZURE_SPEECH_KEY?.trim());
}

/**
 * Azure Speech synthesis provider prepared by PR 2.
 *
 * IMPORTANT: this function is intentionally not the production primary route.
 * `/api/tts` remains Google Chirp 3 HD until Gates 5-8 pass and PR 3 changes
 * the provider order explicitly.
 */
export async function synthesizeAzureTts(
  text: string,
  aiStudentId: string,
  requestedRate: number,
  timeoutMs = 8_000
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
  const ratePercent = `${Math.round(rate * 100)}%`;
  const ssml = [
    `<speak version="1.0" xml:lang="${escapeXml(profile.synthesisLocale)}">`,
    `<voice name="${escapeXml(profile.voiceName)}">`,
    `<prosody rate="${ratePercent}">${escapeXml(text)}</prosody>`,
    '</voice>',
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
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
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
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
