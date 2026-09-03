import type { AIStudentId } from '../types';

export const AZURE_VOICE_PROFILE_VERSION = 'azure-voice-profile-v2' as const;
export const AZURE_SPEECH_REGION = 'japaneast' as const;

export type AzureVoiceProfile = {
  personaId: AIStudentId;
  voiceName: string;
  voiceLocale: string;
  synthesisLocale: string;
  gender: 'female' | 'male';
  gate4Choice: 'A' | 'B' | 'refined';
  selectionClass: 'exact-english-locale' | 'native-multilingual' | 'regional-english-proxy' | 'general-english-fallback';
  sentenceBoundaryMs?: number;
};

/**
 * Human-reviewed Azure Voice Profile v2 for the 20 research personas.
 *
 * Research wording: these are distinct synthetic English voice profiles that
 * reflect regional English varieties / International English. They are not
 * claims of authentic national accents.
 *
 * v2 preserves Azure default speaking rate for all personas. Liam uses a
 * 250 ms sentence-boundary pause selected in human listening review. Suman
 * uses ArjunIndicNeural after a dedicated sentence-to-sentence consistency
 * review. Legacy-only personas remain outside the research profile.
 */
export const AZURE_VOICE_PROFILES: Partial<Record<AIStudentId, AzureVoiceProfile>> = {
  emma_usa: { personaId: 'emma_usa', voiceName: 'en-US-AvaMultilingualNeural', voiceLocale: 'en-US', synthesisLocale: 'en-US', gender: 'female', gate4Choice: 'A', selectionClass: 'exact-english-locale' },
  oliver_uk: { personaId: 'oliver_uk', voiceName: 'en-GB-OllieMultilingualNeural', voiceLocale: 'en-GB', synthesisLocale: 'en-GB', gender: 'male', gate4Choice: 'A', selectionClass: 'exact-english-locale' },
  liam_australia: { personaId: 'liam_australia', voiceName: 'en-AU-KenNeural', voiceLocale: 'en-AU', synthesisLocale: 'en-AU', gender: 'male', gate4Choice: 'B', selectionClass: 'exact-english-locale', sentenceBoundaryMs: 250 },
  minji_korea: { personaId: 'minji_korea', voiceName: 'en-US-EmmaMultilingualNeural', voiceLocale: 'en-US', synthesisLocale: 'en-US', gender: 'female', gate4Choice: 'A', selectionClass: 'exact-english-locale' },
  pavel_belarus: { personaId: 'pavel_belarus', voiceName: 'en-GB-AlfieNeural', voiceLocale: 'en-GB', synthesisLocale: 'en-GB', gender: 'male', gate4Choice: 'B', selectionClass: 'exact-english-locale' },
  lukas_germany: { personaId: 'lukas_germany', voiceName: 'de-DE-FlorianMultilingualNeural', voiceLocale: 'de-DE', synthesisLocale: 'en-GB', gender: 'male', gate4Choice: 'A', selectionClass: 'native-multilingual' },
  aina_malaysia: { personaId: 'aina_malaysia', voiceName: 'en-US-JennyMultilingualNeural', voiceLocale: 'en-US', synthesisLocale: 'en-US', gender: 'female', gate4Choice: 'A', selectionClass: 'exact-english-locale' },
  dimas_indonesia: { personaId: 'dimas_indonesia', voiceName: 'en-US-RyanMultilingualNeural', voiceLocale: 'en-US', synthesisLocale: 'en-US', gender: 'male', gate4Choice: 'B', selectionClass: 'exact-english-locale' },
  bence_hungary: { personaId: 'bence_hungary', voiceName: 'en-US-BrianMultilingualNeural', voiceLocale: 'en-US', synthesisLocale: 'en-US', gender: 'male', gate4Choice: 'A', selectionClass: 'exact-english-locale' },
  yuting_taiwan: { personaId: 'yuting_taiwan', voiceName: 'en-US-AmandaMultilingualNeural', voiceLocale: 'en-US', synthesisLocale: 'en-US', gender: 'female', gate4Choice: 'A', selectionClass: 'exact-english-locale' },
  zofia_poland: { personaId: 'zofia_poland', voiceName: 'en-GB-AdaMultilingualNeural', voiceLocale: 'en-GB', synthesisLocale: 'en-GB', gender: 'female', gate4Choice: 'A', selectionClass: 'exact-english-locale' },
  matas_lithuania: { personaId: 'matas_lithuania', voiceName: 'en-GB-OliverNeural', voiceLocale: 'en-GB', synthesisLocale: 'en-GB', gender: 'male', gate4Choice: 'B', selectionClass: 'exact-english-locale' },
  ananya_india: { personaId: 'ananya_india', voiceName: 'en-IN-AashiNeural', voiceLocale: 'en-IN', synthesisLocale: 'en-IN', gender: 'female', gate4Choice: 'B', selectionClass: 'exact-english-locale' },
  xinyi_china: { personaId: 'xinyi_china', voiceName: 'zh-CN-XiaoyuMultilingualNeural', voiceLocale: 'zh-CN', synthesisLocale: 'en-US', gender: 'female', gate4Choice: 'A', selectionClass: 'native-multilingual' },
  linh_vietnam: { personaId: 'linh_vietnam', voiceName: 'en-US-PhoebeMultilingualNeural', voiceLocale: 'en-US', synthesisLocale: 'en-US', gender: 'female', gate4Choice: 'A', selectionClass: 'exact-english-locale' },
  rahul_bangladesh: { personaId: 'rahul_bangladesh', voiceName: 'en-IN-ArjunNeural', voiceLocale: 'en-IN', synthesisLocale: 'en-IN', gender: 'male', gate4Choice: 'B', selectionClass: 'exact-english-locale' },
  nadeesha_srilanka: { personaId: 'nadeesha_srilanka', voiceName: 'en-IN-AnanyaNeural', voiceLocale: 'en-IN', synthesisLocale: 'en-IN', gender: 'female', gate4Choice: 'B', selectionClass: 'exact-english-locale' },
  suman_nepal: { personaId: 'suman_nepal', voiceName: 'en-IN-ArjunIndicNeural', voiceLocale: 'en-IN', synthesisLocale: 'en-IN', gender: 'male', gate4Choice: 'refined', selectionClass: 'regional-english-proxy' },
  amara_nigeria: { personaId: 'amara_nigeria', voiceName: 'en-NG-EzinneNeural', voiceLocale: 'en-NG', synthesisLocale: 'en-NG', gender: 'female', gate4Choice: 'A', selectionClass: 'exact-english-locale' },
  andrei_romania: { personaId: 'andrei_romania', voiceName: 'en-GB-ThomasNeural', voiceLocale: 'en-GB', synthesisLocale: 'en-GB', gender: 'male', gate4Choice: 'A', selectionClass: 'regional-english-proxy' },
};

function getPreviewOverride(personaId: AIStudentId): string | null {
  if (typeof process === 'undefined' || !process.env || process.env.AZURE_VOICE_PREVIEW_MODE !== '1') return null;
  if (personaId === 'minji_korea') return process.env.AZURE_MINJI_PREVIEW_VOICE || null;
  if (personaId === 'zofia_poland') return process.env.AZURE_ZOFIA_PREVIEW_VOICE || null;
  return null;
}

export function getAzureVoiceProfile(personaId: string): AzureVoiceProfile | null {
  const base = AZURE_VOICE_PROFILES[personaId as AIStudentId] || null;
  if (!base) return null;
  const previewVoiceName = getPreviewOverride(base.personaId);
  return previewVoiceName ? { ...base, voiceName: previewVoiceName } : base;
}
