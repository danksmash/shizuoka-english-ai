import { getAzureVoiceProfile } from '../data/azureVoiceProfiles';
import { getPersonaResearchMetadata } from '../data/personaResearch';

export type ObservedTtsProvider = 'azure-speech' | 'google-chirp3-hd' | 'device-fallback' | 'not_observed';

export type TtsRuntimeMetadata = {
  provider: ObservedTtsProvider;
  voiceName: string;
  languageCode: string;
};

export function resolveTtsRuntimeMetadata(aiStudentId: string, observedProvider: string): TtsRuntimeMetadata {
  if (observedProvider === 'azure-speech') {
    const profile = getAzureVoiceProfile(aiStudentId);
    return {
      provider: 'azure-speech',
      voiceName: profile?.voiceName || 'not_observed',
      languageCode: profile?.synthesisLocale || 'not_observed',
    };
  }

  if (observedProvider === 'google-chirp3-hd') {
    const personaMeta = getPersonaResearchMetadata(aiStudentId);
    return {
      provider: 'google-chirp3-hd',
      voiceName: personaMeta.voiceName,
      languageCode: personaMeta.voiceLanguageCode,
    };
  }

  if (observedProvider === 'device-fallback') {
    return {
      provider: 'device-fallback',
      voiceName: 'device',
      languageCode: 'not_observed',
    };
  }

  return {
    provider: 'not_observed',
    voiceName: 'not_observed',
    languageCode: 'not_observed',
  };
}
