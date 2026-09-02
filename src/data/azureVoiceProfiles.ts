import type { AIStudentId } from '../types';

export const AZURE_VOICE_PROFILE_VERSION = 'azure-voice-profile-v1' as const;
export const AZURE_SPEECH_REGION = 'japaneast' as const;

export type AzureVoiceProfile = {
  personaId: AIStudentId;
  voiceName: string;
  voiceLocale: string;
  synthesisLocale: string;
  gender: 'female' | 'male';
  gate4Choice: 'A' | 'B';
  selectionClass: 'exact-english-locale' | 'native-multilingual' | 'regional-english-proxy' | 'general-english-fallback';
};

/**
 * Human-selected Gate 4 voice profile for the 20 research personas.
 *
 * Research wording: these are distinct synthetic English voice profiles that
 * reflect regional English varieties / International English. They are not
 * claims of authentic national accents.
 *
 * Legacy-only personas (chloe_canada, aung_myanmar) intentionally do not have
 * Azure profiles in v1 because they are outside TARGET_20_AI_STUDENT_IDS.
 */
export const AZURE_VOICE_PROFILES: Partial<Record<AIStudentId, AzureVoiceProfile>> = {
  emma_usa: { personaId: 'emma_usa', voiceName: 'en-US-AvaMultilingualNeural', voiceLocale: 'en-US', synthesisLocale: 'en-US', gender: 'female', gate4Choice: 'A', selectionClass: 'exact-english-locale' },
  oliver_uk: { personaId: 'oliver_uk', voiceName: 'en-GB-OllieMultilingualNeural', voiceLocale: 'en-GB', synthesisLocale: 'en-GB', gender: 'male', gate4Choice: 'A', selectionClass: 'exact-english-locale' },
  liam_australia: { personaId: 'liam_australia', voiceName: 'en-AU-KenNeural', voiceLocale: 'en-AU', synthesisLocale: 'en-AU', gender: 'male', gate4Choice: 'B', selectionClass: 'exact-english-locale' },
  minji_korea: { personaId: 'minji_korea', voiceName: 'en-US-EmmaMultilingualNeural', voiceLocale: 'en-US', synthesisLocale: 'en-US', gender: 'female', gate4Choice: 'A', selectionClass: 'exact-english-locale' },
  pavel_belarus: { personaId: 'pavel_belarus', voiceName: 'en-GB-AlfieNeural', voiceLocale: 'en-GB', synthesisLocale: 'en-GB', gender: 'male', gate4Choice: 'B', selectionClass: 'exact-english-locale' },
  lukas_germany: { personaId: 'lukas_germany', voiceName: 'de-DE-FlorianMultilingualNeural', voiceLocale: 'de-DE', synthesisLocale: 'en-GB', gender: 'male', gate4Choice: 'A', selectionClass: 'native-multilingual' },
  aina_malaysia: { personaId: 'aina_malaysia', voiceName: 'en-US-JennyMultilingualNeural', voiceLocale: 'en-US', synthesisLocale: 'en-US', gender: 'female', gate4Choice: 'A', selectionClass: 'exact-english-locale' },
  dimas_indonesia: { personaId: 'dimas_indonesia', voiceName: 'en-US-RyanMultilingualNeural', voiceLocale: 'en-US', synthesisLocale: 'en-US', gender: 'male', gate4Choice: 'B', selectionClass: 'exact-english-locale' },
  bence_hungary: { personaId: 'bence_hungary', voiceName: 'en-US-BrianMultilingualNeural', voiceLocale: 'en-US', synthesisLocale: 'en-US', gender: 'male', gate4Choice: 'A', selectionClass: 'exact-english-locale' },
  yuting_taiwan: { personaId: 'yuting_taiwan', voiceName: 'en-US-EvelynMultilingualNeural', voiceLocale: 'en-US', synthesisLocale: 'en-US', gender: 'female', gate4Choice: 'B', selectionClass: 'exact-english-locale' },
  zofia_poland: { personaId: 'zofia_poland', voiceName: 'en-GB-AdaMultilingualNeural', voiceLocale: 'en-GB', synthesisLocale: 'en-GB', gender: 'female', gate4Choice: 'A', selectionClass: 'exact-english-locale' },
  matas_lithuania: { personaId: 'matas_lithuania', voiceName: 'en-GB-OliverNeural', voiceLocale: 'en-GB', synthesisLocale: 'en-GB', gender: 'male', gate4Choice: 'B', selectionClass: 'exact-english-locale' },
  ananya_india: { personaId: 'ananya_india', voiceName: 'en-IN-AashiNeural', voiceLocale: 'en-IN', synthesisLocale: 'en-IN', gender: 'female', gate4Choice: 'B', selectionClass: 'exact-english-locale' },
  xinyi_china: { personaId: 'xinyi_china', voiceName: 'zh-CN-XiaoyuMultilingualNeural', voiceLocale: 'zh-CN', synthesisLocale: 'en-US', gender: 'female', gate4Choice: 'A', selectionClass: 'native-multilingual' },
  linh_vietnam: { personaId: 'linh_vietnam', voiceName: 'en-US-PhoebeMultilingualNeural', voiceLocale: 'en-US', synthesisLocale: 'en-US', gender: 'female', gate4Choice: 'A', selectionClass: 'exact-english-locale' },
  rahul_bangladesh: { personaId: 'rahul_bangladesh', voiceName: 'en-IN-AaravNeural', voiceLocale: 'en-IN', synthesisLocale: 'en-IN', gender: 'male', gate4Choice: 'A', selectionClass: 'exact-english-locale' },
  nadeesha_srilanka: { personaId: 'nadeesha_srilanka', voiceName: 'en-IN-AnanyaNeural', voiceLocale: 'en-IN', synthesisLocale: 'en-IN', gender: 'female', gate4Choice: 'B', selectionClass: 'exact-english-locale' },
  suman_nepal: { personaId: 'suman_nepal', voiceName: 'en-IN-KunalNeural', voiceLocale: 'en-IN', synthesisLocale: 'en-IN', gender: 'male', gate4Choice: 'A', selectionClass: 'exact-english-locale' },
  amara_nigeria: { personaId: 'amara_nigeria', voiceName: 'en-GB-BellaNeural', voiceLocale: 'en-GB', synthesisLocale: 'en-GB', gender: 'female', gate4Choice: 'B', selectionClass: 'exact-english-locale' },
  andrei_romania: { personaId: 'andrei_romania', voiceName: 'en-US-DerekMultilingualNeural', voiceLocale: 'en-US', synthesisLocale: 'en-US', gender: 'male', gate4Choice: 'B', selectionClass: 'regional-english-proxy' },
};

export function getAzureVoiceProfile(personaId: string): AzureVoiceProfile | null {
  return AZURE_VOICE_PROFILES[personaId as AIStudentId] || null;
}
