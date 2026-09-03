/**
 * Types for AI Exchange Student English Dialogue App
 * Grade 5 Elementary School - Shizuoka University Global Exchange
 */

export type CharacterMood = 'greeting' | 'speaking' | 'listening' | 'thinking' | 'encouraging' | 'happy';

export type CountryCode =
  | 'UK'
  | 'USA'
  | 'Australia'
  | 'Canada'
  | 'Hungary'
  | 'Poland'
  | 'Bangladesh'
  | 'Vietnam'
  | 'Myanmar'
  | 'South Korea'
  | 'Belarus'
  | 'Germany'
  | 'Malaysia'
  | 'Indonesia'
  | 'Taiwan'
  | 'Lithuania'
  | 'India'
  | 'China'
  | 'Sri Lanka'
  | 'Nepal'
  | 'Nigeria'
  | 'Romania';

export interface CulturalExpression {
  phrase: string;
  meaning: string;
  note: string;
}

export type AIStudentId =
  | 'emma_usa'
  | 'oliver_uk'
  | 'liam_australia'
  | 'chloe_canada'
  | 'bence_hungary'
  | 'zofia_poland'
  | 'rahul_bangladesh'
  | 'linh_vietnam'
  | 'aung_myanmar'
  | 'minji_korea'
  | 'pavel_belarus'
  | 'lukas_germany'
  | 'aina_malaysia'
  | 'dimas_indonesia'
  | 'yuting_taiwan'
  | 'matas_lithuania'
  | 'ananya_india'
  | 'xinyi_china'
  | 'nadeesha_srilanka'
  | 'suman_nepal'
  | 'amara_nigeria'
  | 'andrei_romania';

export type DialogueDurationMinutes = 1 | 2 | 3 | 5;
export type WorldEnglishesCircle = 'Inner' | 'Outer' | 'Expanding';
export type PersonaLabelCondition = 'shown' | 'hidden';

export interface AIStudentProfile {
  id: AIStudentId;
  name: string;
  japaneseName: string;
  gender: 'male' | 'female';
  age: number;
  country: string;
  countryJapanese: string;
  countryNative: string;
  countryCode: CountryCode;
  flag: string;
  city: string;
  role: string;
  major: string;
  avatarImage: string;
  heritageLandmark?: string;
  accentName: string;
  worldEnglishesCircle: WorldEnglishesCircle;
  voiceLang: string;
  voiceGender: 'male' | 'female';
  voicePitch: number;
  voiceRate: number;
  fillerWords: string[];
  characteristicPhrases: CulturalExpression[];
  likes: string[];
  japaneseBio: string;
  characterMessage: string;
  starterPromptDefault: string;
  starterPromptDefaultJapanese?: string;
  topicPrompts: Record<DialogueTopic, string>;
  topicPromptsJapanese?: Record<DialogueTopic, string>;
}

export type VocabCategory =
  | 'food'
  | 'sport'
  | 'subject'
  | 'animal'
  | 'action'
  | 'place'
  | 'culture'
  | 'greeting'
  | 'daily'
  | 'expression';

export interface VisualVocabularyItem {
  id: string;
  word: string;
  reading?: string;
  japanese: string;
  category: VocabCategory;
  emoji: string;
  imageUrl?: string;
  exampleSentence: string;
  mitsumuraUnit?: string;
  keywords: string[]; // words or phrases in speech that trigger this item
}

export interface ChatMessage {
  id: string;
  sender: 'ai' | 'child';
  englishText: string;
  japaneseText?: string;
  timestamp: number;
  wordCount?: number;
  audioDuration?: number;
  detectedVocab?: VisualVocabularyItem[];
  culturalNote?: string;
}

export interface ConversationTurn {
  turnNumber: number;
  aiMessage: ChatMessage;
  childMessage: ChatMessage;
}

export interface FeedbackExpressionItem {
  english: string;
  japanese: string;
  reason: string;
  evidenceText: string;
  speaker: 'child' | 'ai';
  messageId?: string;
  culturalNote?: string;
}

export interface FeedbackData {
  goodPoints: [string, string, string];
  improvementAdvice: {
    title: string;
    detail: string;
    examplePhrase?: string;
  };
  overallComment: string;
  studentMessage: string;
  childLearningItems: FeedbackExpressionItem[];
  aiLearningItems: FeedbackExpressionItem[];
  keyPhrases: FeedbackExpressionItem[];
  encounteredVocab: VisualVocabularyItem[];
  aiStudent: AIStudentProfile;
  stats: {
    totalTurns: number;
    totalChildWords: number;
    durationSeconds: number;
    targetDurationMinutes: number;
  };
}

export type DialogueTopic = 'intro' | 'favorites' | 'shizuoka_culture' | 'talents' | 'daily_routine' | 'free';

export interface TopicOption {
  id: DialogueTopic;
  title: string;
  subTitle: string;
  description: string;
  iconName: string;
  examplePhrases: string[];
}

export interface StudentProfile {
  name: string;
  grade: string;
  selectedDurationMinutes: DialogueDurationMinutes;
  selectedTopic: DialogueTopic;
  selectedAiStudentId: AIStudentId;
}

