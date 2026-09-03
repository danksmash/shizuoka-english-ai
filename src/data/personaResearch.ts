import { AI_STUDENTS_MASTER_LIST } from './curriculum';
import type { AIStudentId, WorldEnglishesCircle } from '../types';

export const PERSONA_DICTIONARY_VERSION = 'persona-profile-v2';

export const GOOGLE_TTS_VOICES: Record<AIStudentId, { languageCode: string; name: string }> = {
  emma_usa: { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Aoede' },
  oliver_uk: { languageCode: 'en-GB', name: 'en-GB-Chirp3-HD-Orus' },
  liam_australia: { languageCode: 'en-AU', name: 'en-AU-Chirp3-HD-Puck' },
  bence_hungary: { languageCode: 'en-GB', name: 'en-GB-Chirp3-HD-Iapetus' },
  zofia_poland: { languageCode: 'en-GB', name: 'en-GB-Chirp3-HD-Leda' },
  rahul_bangladesh: { languageCode: 'en-IN', name: 'en-IN-Chirp3-HD-Orus' },
  linh_vietnam: { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Leda' },
  minji_korea: { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Kore' },
  pavel_belarus: { languageCode: 'en-GB', name: 'en-GB-Chirp3-HD-Orus' },
  lukas_germany: { languageCode: 'en-GB', name: 'en-GB-Chirp3-HD-Iapetus' },
  aina_malaysia: { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Aoede' },
  dimas_indonesia: { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Puck' },
  yuting_taiwan: { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Leda' },
  matas_lithuania: { languageCode: 'en-GB', name: 'en-GB-Chirp3-HD-Puck' },
  ananya_india: { languageCode: 'en-IN', name: 'en-IN-Chirp3-HD-Aoede' },
  xinyi_china: { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Gacrux' },
  nadeesha_srilanka: { languageCode: 'en-IN', name: 'en-IN-Chirp3-HD-Gacrux' },
  suman_nepal: { languageCode: 'en-IN', name: 'en-IN-Chirp3-HD-Puck' },
  amara_nigeria: { languageCode: 'en-GB', name: 'en-GB-Chirp3-HD-Pulcherrima' },
  andrei_romania: { languageCode: 'en-GB', name: 'en-GB-Chirp3-HD-Schedar' },
};

const MAJOR_ENGLISH: Record<AIStudentId, { expression: string; keywords: string[] }> = {
  emma_usa: { expression: 'media and communication', keywords: ['media', 'communication', 'media communication'] },
  oliver_uk: { expression: 'environmental science and Japanese culture', keywords: ['environmental science', 'japanese culture'] },
  liam_australia: { expression: 'marine biology and conservation', keywords: ['marine biology', 'marine conservation', 'ocean conservation'] },
  bence_hungary: { expression: 'information engineering and robotics', keywords: ['information engineering', 'robotics', 'programming'] },
  zofia_poland: { expression: 'architecture design and art history', keywords: ['architecture', 'architecture design', 'art history'] },
  rahul_bangladesh: { expression: 'agriculture and tea science', keywords: ['agriculture', 'tea science', 'tea research'] },
  linh_vietnam: { expression: 'language culture and tourism', keywords: ['language culture', 'tourism', 'international culture'] },
  minji_korea: { expression: 'education and child development', keywords: ['education', 'child development'] },
  pavel_belarus: { expression: 'mathematics and data science', keywords: ['mathematics', 'math', 'data science'] },
  lukas_germany: { expression: 'mechanical engineering', keywords: ['mechanical engineering', 'engineering'] },
  aina_malaysia: { expression: 'environmental design', keywords: ['environmental design', 'design'] },
  dimas_indonesia: { expression: 'tourism and cultural heritage', keywords: ['tourism', 'cultural heritage'] },
  yuting_taiwan: { expression: 'visual communication design', keywords: ['visual communication design', 'communication design', 'design'] },
  matas_lithuania: { expression: 'sports science and health', keywords: ['sports science', 'health'] },
  ananya_india: { expression: 'computer science', keywords: ['computer science', 'computing'] },
  xinyi_china: { expression: 'economics and international business', keywords: ['economics', 'international business', 'business'] },
  nadeesha_srilanka: { expression: 'environmental science and biodiversity', keywords: ['environmental science', 'biodiversity'] },
  suman_nepal: { expression: 'geography and disaster prevention', keywords: ['geography', 'disaster prevention'] },
  amara_nigeria: { expression: 'international relations', keywords: ['international relations'] },
  andrei_romania: { expression: 'architecture and urban design', keywords: ['architecture', 'urban design'] },
};

export type PersonaProfileField = 'likes' | 'major' | 'city' | 'landmark';
export type PersonaDictionaryEntry = {
  id: string;
  personaId: AIStudentId;
  profileField: PersonaProfileField;
  category: 'interest' | 'major' | 'place';
  expression: string;
  japanese: string;
  keywords: string[];
};

function asciiLabel(value: string): string {
  return value.split('(')[0].replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();
}
function japaneseLabel(value: string): string {
  const match = value.match(/\(([^)]+)\)/);
  return match?.[1]?.trim() || '';
}
function keywordVariants(value: string): string[] {
  const phrase = value.toLowerCase().trim();
  const variants = new Set<string>([phrase]);
  if (phrase.endsWith('ies')) variants.add(`${phrase.slice(0, -3)}y`);
  else if (phrase.endsWith('s') && phrase.length > 4) variants.add(phrase.slice(0, -1));
  if (phrase.endsWith('ing') && phrase.length > 5) variants.add(phrase.slice(0, -3));
  return [...variants].filter(Boolean);
}

export const PERSONA_PROFILE_DICTIONARY: PersonaDictionaryEntry[] = AI_STUDENTS_MASTER_LIST.flatMap((persona) => {
  const likes: PersonaDictionaryEntry[] = persona.likes.map((like, index) => {
    const expression = asciiLabel(like);
    return {
      id: `persona-${persona.id}-like-${index + 1}`,
      personaId: persona.id,
      profileField: 'likes',
      category: 'interest',
      expression,
      japanese: japaneseLabel(like),
      keywords: keywordVariants(expression),
    };
  });
  const major = MAJOR_ENGLISH[persona.id];
  const entries: PersonaDictionaryEntry[] = likes.concat({
    id: `persona-${persona.id}-major`,
    personaId: persona.id,
    profileField: 'major',
    category: 'major',
    expression: major.expression,
    japanese: persona.major,
    keywords: major.keywords,
  });
  const cityExpression = asciiLabel(persona.city);
  if (cityExpression) entries.push({
    id: `persona-${persona.id}-city`, personaId: persona.id, profileField: 'city', category: 'place',
    expression: cityExpression, japanese: japaneseLabel(persona.city), keywords: keywordVariants(cityExpression),
  });
  const landmarkExpression = asciiLabel(persona.heritageLandmark || '');
  if (landmarkExpression) entries.push({
    id: `persona-${persona.id}-landmark`, personaId: persona.id, profileField: 'landmark', category: 'place',
    expression: landmarkExpression, japanese: japaneseLabel(persona.heritageLandmark || ''), keywords: keywordVariants(landmarkExpression),
  });
  return entries;
});

function normalize(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
}
function containsKeyword(text: string, keyword: string): boolean {
  const escaped = normalize(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, 'i').test(text);
}

export function detectPersonaProfileExpressions(text: string, personaId: string): PersonaDictionaryEntry[] {
  const normalized = normalize(String(text || ''));
  if (!normalized) return [];
  return PERSONA_PROFILE_DICTIONARY.filter((entry) => entry.personaId === personaId && entry.keywords.some((keyword) => containsKeyword(normalized, keyword)));
}

export function getPersonaResearchMetadata(personaId: string) {
  const persona = AI_STUDENTS_MASTER_LIST.find((item) => item.id === personaId) || AI_STUDENTS_MASTER_LIST[0];
  const cloudVoice = GOOGLE_TTS_VOICES[persona.id];
  return {
    personaId: persona.id,
    country: persona.country,
    gender: persona.gender,
    accentName: persona.accentName,
    worldEnglishesCircle: persona.worldEnglishesCircle as WorldEnglishesCircle,
    voiceLanguageCode: cloudVoice.languageCode,
    voiceName: cloudVoice.name,
    voiceGender: persona.voiceGender,
    voicePitch: persona.voicePitch,
    defaultVoiceRate: persona.voiceRate,
    personaDictionaryVersion: PERSONA_DICTIONARY_VERSION,
  };
}
