import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { AZURE_SPEECH_REGION, AZURE_VOICE_PROFILE_VERSION, AZURE_VOICE_PROFILES } from '../src/data/azureVoiceProfiles';
import { TARGET_20_AI_STUDENT_IDS } from '../src/data/curriculum';

const key = process.env.AZURE_SPEECH_KEY?.trim() || '';
const out = process.env.AZURE_V2_FINAL_OUTPUT || 'azure-v2-final-artifacts';
if (!key) throw new Error('AZURE_SPEECH_KEY missing');
if (AZURE_VOICE_PROFILE_VERSION !== 'azure-voice-profile-v2') throw new Error('Expected Voice Profile v2');

const texts = [
  "Hello! Nice to meet you. I'm happy to talk with you today.",
  "I like music and soccer. What do you like?",
  "I live in a busy city, but I also like nature.",
  "What is your favorite place in Shizuoka?",
  "Could you say that again, please? I want to understand you.",
  "That's interesting! We have something in common. What else do you enjoy?",
];

const esc = (s: string) => s.replace(/[<>&'\"]/g, (c) => ({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;' }[c] || c));
function ssml(profile: any, text: string) {
  const ns = profile.sentenceBoundaryMs ? ' xmlns:mstts="http://www.w3.org/2001/mstts"' : '';
  const silence = profile.sentenceBoundaryMs ? `<mstts:silence type="Sentenceboundary-exact" value="${profile.sentenceBoundaryMs}ms"/>` : '';
  return `<speak version="1.0"${ns} xml:lang="${esc(profile.synthesisLocale)}"><voice name="${esc(profile.voiceName)}">${silence}${esc(text)}</voice></speak>`;
}

await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(path.join(out, 'audio'), { recursive: true });
const endpoint = `https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
const rows: any[] = [];
for (const personaId of TARGET_20_AI_STUDENT_IDS) {
  const profile = AZURE_VOICE_PROFILES[personaId];
  if (!profile) throw new Error(`Missing profile ${personaId}`);
  for (let i = 0; i < texts.length; i += 1) {
    const text = texts[i];
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'shizuoka-english-ai-v2-final-gate',
      },
      body: ssml(profile, text),
      signal: AbortSignal.timeout(15_000),
    });
    const audio = Buffer.from(await response.arrayBuffer());
    if (!response.ok) throw new Error(`${personaId}/${i + 1}: HTTP ${response.status}`);
    if (audio.length < 500) throw new Error(`${personaId}/${i + 1}: audio too small`);
    const rel = `audio/${personaId}-${String(i + 1).padStart(2, '0')}.mp3`;
    await fs.writeFile(path.join(out, rel), audio);
    rows.push({
      voiceProfileVersion: AZURE_VOICE_PROFILE_VERSION,
      personaId,
      voiceName: profile.voiceName,
      synthesisLocale: profile.synthesisLocale,
      sentenceBoundaryMs: profile.sentenceBoundaryMs ?? null,
      clip: i + 1,
      text,
      words: text.trim().split(/\s+/).length,
      file: rel,
      bytes: audio.length,
      sha256: createHash('sha256').update(audio).digest('hex'),
    });
  }
}
if (rows.length !== 120) throw new Error(`Expected 120 clips, got ${rows.length}`);
if (new Set(rows.map((r) => r.sha256)).size !== 120) throw new Error('Duplicate audio SHA detected');
if (new Set(rows.map((r) => r.voiceName)).size !== 20) throw new Error('Expected 20 distinct voices');
await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify({ version: AZURE_VOICE_PROFILE_VERSION, region: AZURE_SPEECH_REGION, generatedAt: new Date().toISOString(), texts, rows }, null, 2));
await fs.writeFile(path.join(out, 'sha256.txt'), rows.map((r) => `${r.sha256}  ${r.file}`).join('\n') + '\n');
console.log(JSON.stringify({ status: 'PASS', clips: rows.length, voices: 20, uniqueHashes: 120 }, null, 2));
