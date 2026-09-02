import { AI_STUDENTS_MASTER_LIST, TARGET_20_AI_STUDENT_IDS } from '../src/data/curriculum';
import { AZURE_SPEECH_REGION, AZURE_VOICE_PROFILE_VERSION, AZURE_VOICE_PROFILES } from '../src/data/azureVoiceProfiles';

const fail = (message: string): never => { throw new Error(message); };

if (AZURE_VOICE_PROFILE_VERSION !== 'azure-voice-profile-v1') fail('Unexpected Azure voice profile version');
if (AZURE_SPEECH_REGION !== 'japaneast') fail(`Azure Speech region must remain japaneast; got ${AZURE_SPEECH_REGION}`);
if (TARGET_20_AI_STUDENT_IDS.length !== 20) fail(`Expected 20 target personas; got ${TARGET_20_AI_STUDENT_IDS.length}`);

const profiles = TARGET_20_AI_STUDENT_IDS.map((id) => AZURE_VOICE_PROFILES[id] || fail(`Missing Azure voice profile for ${id}`));
if (profiles.length !== 20) fail(`Expected 20 Azure profiles; got ${profiles.length}`);
if (new Set(profiles.map((p) => p.voiceName)).size !== 20) fail('Azure Voice Profile v1 must use 20 distinct selected voice names');

for (const profile of profiles) {
  if (profile.personaId !== TARGET_20_AI_STUDENT_IDS.find((id) => id === profile.personaId)) fail(`Unexpected personaId ${profile.personaId}`);
  const persona = AI_STUDENTS_MASTER_LIST.find((p) => p.id === profile.personaId) || fail(`Missing persona ${profile.personaId}`);
  if (profile.gender !== persona.gender) fail(`Gender mismatch for ${profile.personaId}: ${profile.gender} vs ${persona.gender}`);
  if (!/^en-|^de-DE$|^zh-CN$/.test(profile.voiceLocale)) fail(`Unexpected selected voice locale for ${profile.personaId}: ${profile.voiceLocale}`);
  if (!/^en-/.test(profile.synthesisLocale)) fail(`Synthesis locale must be English for ${profile.personaId}: ${profile.synthesisLocale}`);
  if (!/Neural$/i.test(profile.voiceName)) fail(`Only prebuilt Neural voices are allowed: ${profile.voiceName}`);
  if (/(MAI-Voice|Flash|Dragon|Turbo|HD)/i.test(profile.voiceName)) fail(`Disallowed Azure voice family in v1: ${profile.voiceName}`);
}

if (AZURE_VOICE_PROFILES.chloe_canada) fail('Legacy Chloe must not receive an Azure v1 research profile');
if (AZURE_VOICE_PROFILES.aung_myanmar) fail('Legacy Aung must not receive an Azure v1 research profile');

const expectedChoices: Record<string, 'A' | 'B'> = {
  emma_usa: 'A', oliver_uk: 'A', liam_australia: 'B', minji_korea: 'A', pavel_belarus: 'B',
  lukas_germany: 'A', aina_malaysia: 'A', dimas_indonesia: 'B', bence_hungary: 'A', yuting_taiwan: 'B',
  zofia_poland: 'A', matas_lithuania: 'B', ananya_india: 'B', xinyi_china: 'A', linh_vietnam: 'A',
  rahul_bangladesh: 'A', nadeesha_srilanka: 'B', suman_nepal: 'A', amara_nigeria: 'B', andrei_romania: 'B',
};
for (const profile of profiles) {
  if (profile.gate4Choice !== expectedChoices[profile.personaId]) {
    fail(`Gate 4 human choice changed for ${profile.personaId}: ${profile.gate4Choice}`);
  }
}

console.log(`Azure Voice Profile QA: PASS (${profiles.length} target personas, ${new Set(profiles.map((p) => p.voiceName)).size} unique voices, ${AZURE_VOICE_PROFILE_VERSION})`);
