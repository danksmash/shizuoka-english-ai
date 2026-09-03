import { AI_STUDENTS_MASTER_LIST, TARGET_20_AI_STUDENT_IDS } from '../src/data/curriculum';
import { AZURE_SPEECH_REGION, AZURE_VOICE_PROFILE_VERSION, AZURE_VOICE_PROFILES } from '../src/data/azureVoiceProfiles';
import { synthesizeAzureTts } from '../src/server/azureTts';

const fail = (message: string): never => { throw new Error(message); };

if (AZURE_VOICE_PROFILE_VERSION !== 'azure-voice-profile-v3') fail('Unexpected Azure voice profile version');
if (AZURE_SPEECH_REGION !== 'japaneast') fail(`Azure Speech region must remain japaneast; got ${AZURE_SPEECH_REGION}`);
if (TARGET_20_AI_STUDENT_IDS.length !== 20) fail(`Expected 20 target personas; got ${TARGET_20_AI_STUDENT_IDS.length}`);

const profiles = TARGET_20_AI_STUDENT_IDS.map((id) => AZURE_VOICE_PROFILES[id] || fail(`Missing Azure voice profile for ${id}`));
if (profiles.length !== 20) fail(`Expected 20 Azure profiles; got ${profiles.length}`);
if (new Set(profiles.map((p) => p.voiceName)).size !== 20) fail('Azure Voice Profile v3 must use 20 distinct selected voice names');

for (const profile of profiles) {
  if (profile.personaId !== TARGET_20_AI_STUDENT_IDS.find((id) => id === profile.personaId)) fail(`Unexpected personaId ${profile.personaId}`);
  const persona = AI_STUDENTS_MASTER_LIST.find((p) => p.id === profile.personaId) || fail(`Missing persona ${profile.personaId}`);
  if (profile.gender !== persona.gender) fail(`Gender mismatch for ${profile.personaId}: ${profile.gender} vs ${persona.gender}`);
  if (!/^en-|^de-DE$|^zh-CN$/.test(profile.voiceLocale)) fail(`Unexpected selected voice locale for ${profile.personaId}: ${profile.voiceLocale}`);
  if (!/^en-/.test(profile.synthesisLocale)) fail(`Synthesis locale must be English for ${profile.personaId}: ${profile.synthesisLocale}`);
  if (!/Neural$/i.test(profile.voiceName)) fail(`Only prebuilt Neural voices are allowed: ${profile.voiceName}`);
  if (/(MAI-Voice|Flash|Dragon|Turbo|HD)/i.test(profile.voiceName)) fail(`Disallowed Azure voice family in v3: ${profile.voiceName}`);
  if (profile.sentenceBoundaryMs !== undefined && profile.sentenceBoundaryMs !== 250) fail(`Unexpected sentence pause for ${profile.personaId}`);
}

const expected: Record<string, { voice: string; choice: 'A' | 'B' | 'refined'; pause?: number; ageFitReview?: 'round1-A' | 'round3-B' }> = {
  emma_usa: { voice: 'en-US-AvaMultilingualNeural', choice: 'A' },
  oliver_uk: { voice: 'en-GB-OllieMultilingualNeural', choice: 'A' },
  liam_australia: { voice: 'en-AU-KenNeural', choice: 'B', pause: 250 },
  minji_korea: { voice: 'en-US-AshleyNeural', choice: 'A', ageFitReview: 'round3-B' },
  pavel_belarus: { voice: 'en-GB-AlfieNeural', choice: 'B' },
  lukas_germany: { voice: 'de-DE-FlorianMultilingualNeural', choice: 'A' },
  aina_malaysia: { voice: 'en-US-JennyMultilingualNeural', choice: 'A' },
  dimas_indonesia: { voice: 'en-US-RyanMultilingualNeural', choice: 'B' },
  bence_hungary: { voice: 'en-US-BrianMultilingualNeural', choice: 'A' },
  yuting_taiwan: { voice: 'en-US-AmandaMultilingualNeural', choice: 'A' },
  zofia_poland: { voice: 'en-GB-LibbyNeural', choice: 'A', ageFitReview: 'round1-A' },
  matas_lithuania: { voice: 'en-GB-OliverNeural', choice: 'B' },
  ananya_india: { voice: 'en-IN-AashiNeural', choice: 'B' },
  xinyi_china: { voice: 'zh-CN-XiaoyuMultilingualNeural', choice: 'A' },
  linh_vietnam: { voice: 'en-US-PhoebeMultilingualNeural', choice: 'A' },
  rahul_bangladesh: { voice: 'en-IN-ArjunNeural', choice: 'B' },
  nadeesha_srilanka: { voice: 'en-IN-AnanyaNeural', choice: 'B' },
  suman_nepal: { voice: 'en-IN-ArjunIndicNeural', choice: 'refined' },
  amara_nigeria: { voice: 'en-NG-EzinneNeural', choice: 'A' },
  andrei_romania: { voice: 'en-GB-ThomasNeural', choice: 'A' },
};

for (const profile of profiles) {
  const e = expected[profile.personaId] || fail(`Missing expected v3 profile for ${profile.personaId}`);
  if (profile.voiceName !== e.voice) fail(`Voice mismatch for ${profile.personaId}: ${profile.voiceName}`);
  if (profile.gate4Choice !== e.choice) fail(`Human choice mismatch for ${profile.personaId}: ${profile.gate4Choice}`);
  if (profile.sentenceBoundaryMs !== e.pause) fail(`Sentence pause mismatch for ${profile.personaId}`);
  if (profile.ageFitReview !== e.ageFitReview) fail(`Age-fit review mismatch for ${profile.personaId}`);
}

const originalFetch = globalThis.fetch;
const originalKey = process.env.AZURE_SPEECH_KEY;
const originalRegion = process.env.AZURE_SPEECH_REGION;
const requests: string[] = [];
try {
  process.env.AZURE_SPEECH_KEY = 'qa-only-placeholder';
  process.env.AZURE_SPEECH_REGION = 'japaneast';
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    requests.push(String(init?.body || ''));
    return new Response(new Uint8Array(800), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
  }) as typeof fetch;

  const slow = await synthesizeAzureTts('Hello.', 'emma_usa', 0.75);
  if (slow.effectiveRate !== 0.75) fail(`Azure slow rate must remain 0.75; got ${slow.effectiveRate}`);
  if (!requests.at(-1)?.includes('<prosody rate="0.75">Hello.</prosody>')) fail('Azure SSML must apply the 0.75x UI rate');

  const normal = await synthesizeAzureTts('Hello.', 'emma_usa', 1.0);
  if (normal.effectiveRate !== 1.0) fail(`Azure normal rate must remain 1.00; got ${normal.effectiveRate}`);
  if (!requests.at(-1)?.includes('<prosody rate="1.00">Hello.</prosody>')) fail('Azure SSML must preserve the 1.00x baseline rate');

  const fast = await synthesizeAzureTts('Hello. Nice to meet you.', 'liam_australia', 1.25);
  const fastSsml = requests.at(-1) || '';
  if (fast.effectiveRate !== 1.25) fail(`Azure fast rate must remain 1.25; got ${fast.effectiveRate}`);
  if (!fastSsml.includes('<prosody rate="1.25">Hello. Nice to meet you.</prosody>')) fail('Azure SSML must apply the 1.25x UI rate');
  if (!fastSsml.includes('xmlns:mstts="http://www.w3.org/2001/mstts"')) fail('Liam sentence-pause namespace must remain');
  if (!fastSsml.includes('<mstts:silence type="Sentenceboundary-exact" value="250ms"/>')) fail('Liam 250ms sentence-boundary pause must remain');

  const clampedSlow = await synthesizeAzureTts('Hello.', 'emma_usa', 0.5);
  const clampedFast = await synthesizeAzureTts('Hello.', 'emma_usa', 1.5);
  if (clampedSlow.effectiveRate !== 0.75 || clampedFast.effectiveRate !== 1.25) fail('Azure rate must remain clamped to the student UI range 0.75-1.25');
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.AZURE_SPEECH_KEY; else process.env.AZURE_SPEECH_KEY = originalKey;
  if (originalRegion === undefined) delete process.env.AZURE_SPEECH_REGION; else process.env.AZURE_SPEECH_REGION = originalRegion;
}

console.log(`Azure Voice Profile QA: PASS (${profiles.length} target personas, ${new Set(profiles.map((p) => p.voiceName)).size} unique voices, ${AZURE_VOICE_PROFILE_VERSION}, 0.75-1.25 speaking-rate control)`);
