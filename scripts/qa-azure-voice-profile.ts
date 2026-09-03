import { AI_STUDENTS_MASTER_LIST, TARGET_20_AI_STUDENT_IDS } from '../src/data/curriculum';
import { AZURE_SPEECH_REGION, AZURE_VOICE_PROFILE_VERSION, AZURE_VOICE_PROFILES } from '../src/data/azureVoiceProfiles';

const fail = (message: string): never => { throw new Error(message); };

if (AZURE_VOICE_PROFILE_VERSION !== 'azure-voice-profile-v2') fail('Unexpected Azure voice profile version');
if (AZURE_SPEECH_REGION !== 'japaneast') fail(`Azure Speech region must remain japaneast; got ${AZURE_SPEECH_REGION}`);
if (TARGET_20_AI_STUDENT_IDS.length !== 20) fail(`Expected 20 target personas; got ${TARGET_20_AI_STUDENT_IDS.length}`);

const profiles = TARGET_20_AI_STUDENT_IDS.map((id) => AZURE_VOICE_PROFILES[id] || fail(`Missing Azure voice profile for ${id}`));
if (profiles.length !== 20) fail(`Expected 20 Azure profiles; got ${profiles.length}`);
if (new Set(profiles.map((p) => p.voiceName)).size !== 20) fail('Azure Voice Profile v2 must use 20 distinct selected voice names');

for (const profile of profiles) {
  if (profile.personaId !== TARGET_20_AI_STUDENT_IDS.find((id) => id === profile.personaId)) fail(`Unexpected personaId ${profile.personaId}`);
  const persona = AI_STUDENTS_MASTER_LIST.find((p) => p.id === profile.personaId) || fail(`Missing persona ${profile.personaId}`);
  if (profile.gender !== persona.gender) fail(`Gender mismatch for ${profile.personaId}: ${profile.gender} vs ${persona.gender}`);
  if (!/^en-|^de-DE$|^zh-CN$/.test(profile.voiceLocale)) fail(`Unexpected selected voice locale for ${profile.personaId}: ${profile.voiceLocale}`);
  if (!/^en-/.test(profile.synthesisLocale)) fail(`Synthesis locale must be English for ${profile.personaId}: ${profile.synthesisLocale}`);
  if (!/Neural$/i.test(profile.voiceName)) fail(`Only prebuilt Neural voices are allowed: ${profile.voiceName}`);
  if (/(MAI-Voice|Flash|Dragon|Turbo|HD)/i.test(profile.voiceName)) fail(`Disallowed Azure voice family in v2: ${profile.voiceName}`);
  if (profile.sentenceBoundaryMs !== undefined && profile.sentenceBoundaryMs !== 250) fail(`Unexpected sentence pause for ${profile.personaId}`);
}

if (AZURE_VOICE_PROFILES.chloe_canada) fail('Legacy Chloe must not receive an Azure v2 research profile');
if (AZURE_VOICE_PROFILES.aung_myanmar) fail('Legacy Aung must not receive an Azure v2 research profile');

const expected: Record<string, { voice: string; choice: 'A' | 'B' | 'refined'; pause?: number }> = {
  emma_usa: { voice: 'en-US-AvaMultilingualNeural', choice: 'A' },
  oliver_uk: { voice: 'en-GB-OllieMultilingualNeural', choice: 'A' },
  liam_australia: { voice: 'en-AU-KenNeural', choice: 'B', pause: 250 },
  minji_korea: { voice: 'en-US-EmmaMultilingualNeural', choice: 'A' },
  pavel_belarus: { voice: 'en-GB-AlfieNeural', choice: 'B' },
  lukas_germany: { voice: 'de-DE-FlorianMultilingualNeural', choice: 'A' },
  aina_malaysia: { voice: 'en-US-JennyMultilingualNeural', choice: 'A' },
  dimas_indonesia: { voice: 'en-US-RyanMultilingualNeural', choice: 'B' },
  bence_hungary: { voice: 'en-US-BrianMultilingualNeural', choice: 'A' },
  yuting_taiwan: { voice: 'en-US-AmandaMultilingualNeural', choice: 'A' },
  zofia_poland: { voice: 'en-GB-AdaMultilingualNeural', choice: 'A' },
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
  const e = expected[profile.personaId] || fail(`Missing expected v2 profile for ${profile.personaId}`);
  if (profile.voiceName !== e.voice) fail(`Voice mismatch for ${profile.personaId}: ${profile.voiceName}`);
  if (profile.gate4Choice !== e.choice) fail(`Human choice mismatch for ${profile.personaId}: ${profile.gate4Choice}`);
  if (profile.sentenceBoundaryMs !== e.pause) fail(`Sentence pause mismatch for ${profile.personaId}`);
}

console.log(`Azure Voice Profile QA: PASS (${profiles.length} target personas, ${new Set(profiles.map((p) => p.voiceName)).size} unique voices, ${AZURE_VOICE_PROFILE_VERSION})`);
