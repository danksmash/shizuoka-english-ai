import { AIStudentId, ChatMessage, DialogueDurationMinutes, DialogueTopic, PersonaLabelCondition, VisualVocabularyItem } from './types';
import { maskTextForResearchExport } from './utils/privacy';

export const AI_STUDENT_IDS = [
  'emma_usa','oliver_uk','liam_australia','chloe_canada','bence_hungary','zofia_poland','rahul_bangladesh','linh_vietnam','aung_myanmar',
] as const satisfies readonly AIStudentId[];

export const DIALOGUE_TOPIC_IDS = ['intro','favorites','shizuoka_culture','talents','free'] as const satisfies readonly DialogueTopic[];
export const DIALOGUE_DURATIONS_MINUTES = [1, 2, 3, 5] as const satisfies readonly DialogueDurationMinutes[];

export interface StudentIdentity { learningCode: string; }

export interface ReflectionAnswers {
  conveyedIdeas: 1 | 3 | 5;
  understoodPartner: 1 | 3 | 5;
  noticedLanguageCulture: 1 | 3 | 5;
}

export const RESEARCH_SYSTEM_EVENT_TYPES = [
  'session_start','session_finish','reflection_submit','mic_start','mic_stop_send','mic_error',
  'text_input_open','text_message_send','help_open','help_phrase_select','ai_replay','vocab_bank_open',
  'vocab_audio_play','speech_rate_change','ai_response_latency_ms','ai_request_failure',
  'ai_model','ai_input_tokens','ai_output_tokens','ai_cache_read_tokens','ai_cache_creation_tokens','tts_provider','tts_effective_rate',
] as const;
export type ResearchSystemEventType = typeof RESEARCH_SYSTEM_EVENT_TYPES[number];
export interface ResearchSystemEvent {
  type: ResearchSystemEventType;
  timestamp: number;
  value?: string;
}

export interface SessionSaveInput {
  sessionId: string;
  learningCode: string;
  aiStudentId: AIStudentId;
  topic: DialogueTopic;
  targetDurationMinutes: DialogueDurationMinutes;
  startedAt: number;
  endedAt: number;
  history: ChatMessage[];
  encounteredVocab?: VisualVocabularyItem[];
  reflection?: ReflectionAnswers;
  systemEvents?: ResearchSystemEvent[];
  personaLabelCondition?: PersonaLabelCondition;
  countryLabelVisible?: boolean;
  accentLabelVisible?: boolean;
  flagVisible?: boolean;
  studentSelectedSpeechRate?: number;
  effectiveTtsSpeechRate?: number;
}

export interface CanonicalSessionStats {
  totalTurns: number;
  totalChildWords: number;
  actualDurationSeconds: number;
  targetDurationMinutes: DialogueDurationMinutes;
  uniqueVocabularyCount: number;
  childUniqueWordTypes: number;
  meanChildWordsPerTurn: number;
  maxChildWordsPerTurn: number;
  childQuestionCount: number;
  childReciprocalQuestionCount: number;
  childRepairCount: number;
  childReasonExpressionCount: number;
}

export const isAIStudentId = (value: unknown): value is AIStudentId => typeof value === 'string' && (AI_STUDENT_IDS as readonly string[]).includes(value);
export const isDialogueTopic = (value: unknown): value is DialogueTopic => typeof value === 'string' && (DIALOGUE_TOPIC_IDS as readonly string[]).includes(value);
export const isDialogueDuration = (value: unknown): value is DialogueDurationMinutes => typeof value === 'number' && (DIALOGUE_DURATIONS_MINUTES as readonly number[]).includes(value);

export function normalizeLearningCode(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) : '';
}

export function isValidLearningCode(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const cleaned = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z0-9]{4}$/.test(cleaned);
}

export function countEnglishWords(text: string): number { return (text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || []).length; }
function englishWordTypes(text: string): string[] { return (text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || []); }

export function canonicalizeHistory(history: unknown): ChatMessage[] {
  if (!Array.isArray(history)) return [];
  return history.slice(-200).filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object')).map((item, index) => {
    const sender = item.sender === 'ai' ? 'ai' : item.sender === 'child' ? 'child' : null;
    const englishText = typeof item.englishText === 'string' ? item.englishText.trim().slice(0, 300) : '';
    if (!sender || !englishText) return null;
    const japaneseText = typeof item.japaneseText === 'string' ? item.japaneseText.trim().slice(0, 500) : '';
    const timestamp = Number.isFinite(Number(item.timestamp)) ? Number(item.timestamp) : Date.now() + index;
    return {
      id: typeof item.id === 'string' && item.id.trim() ? item.id.trim().slice(0, 120) : `msg-${timestamp}-${index}`,
      sender, englishText, japaneseText, timestamp,
      wordCount: sender === 'child' ? countEnglishWords(englishText) : undefined,
    } as ChatMessage;
  }).filter((item) => item !== null) as ChatMessage[];
}

export function analyzeChildCommunication(history: ChatMessage[]) {
  const childMessages = history.filter((message) => message.sender === 'child' && message.englishText.trim());
  const wordCounts = childMessages.map((message) => countEnglishWords(message.englishText));
  const totalChildWords = wordCounts.reduce((sum, count) => sum + count, 0);
  const wordTypes = new Set(childMessages.flatMap((message) => englishWordTypes(message.englishText)));
  let childQuestionCount = 0;
  let childReciprocalQuestionCount = 0;
  let childRepairCount = 0;
  let childReasonExpressionCount = 0;
  const questionStart = /^(what|where|when|who|why|how|which|do|does|did|can|could|are|is|am|have|has|would|will)\b/i;
  const reciprocal = /\b(how about you|what about you|and you)\b/i;
  const repair = /\b(pardon|sorry|one more time|say that again|please repeat|repeat please|i don't understand|i do not understand)\b/i;
  const reason = /\bbecause\b/i;
  for (const message of childMessages) {
    const text = message.englishText.trim();
    if (/\?$/.test(text) || questionStart.test(text) || reciprocal.test(text)) childQuestionCount += 1;
    if (reciprocal.test(text)) childReciprocalQuestionCount += 1;
    if (repair.test(text) || /^(what\??|sorry\??)$/i.test(text)) childRepairCount += 1;
    if (reason.test(text)) childReasonExpressionCount += 1;
  }
  return {
    totalTurns: childMessages.length,
    totalChildWords,
    childUniqueWordTypes: wordTypes.size,
    meanChildWordsPerTurn: childMessages.length ? Math.round((totalChildWords / childMessages.length) * 100) / 100 : 0,
    maxChildWordsPerTurn: wordCounts.length ? Math.max(...wordCounts) : 0,
    childQuestionCount,
    childReciprocalQuestionCount,
    childRepairCount,
    childReasonExpressionCount,
  };
}

export function calculateCanonicalStats(history: ChatMessage[], startedAt: number, endedAt: number, targetDurationMinutes: DialogueDurationMinutes, encounteredVocab: unknown): CanonicalSessionStats {
  const communication = analyzeChildCommunication(history);
  const safeStart = Number.isFinite(startedAt) ? startedAt : endedAt;
  const safeEnd = Number.isFinite(endedAt) ? endedAt : safeStart;
  const actualDurationSeconds = Math.max(0, Math.min(3600, Math.round((safeEnd - safeStart) / 1000)));
  const vocabIds = new Set(Array.isArray(encounteredVocab) ? encounteredVocab.map((item) => (item && typeof item === 'object' && 'id' in item ? String(item.id) : '')).filter(Boolean) : []);
  return { ...communication, actualDurationSeconds, targetDurationMinutes, uniqueVocabularyCount: vocabIds.size };
}

export function maskHistoryForStorage(history: ChatMessage[]): ChatMessage[] {
  return history.map((message) => ({
    ...message,
    englishText: maskTextForResearchExport(message.englishText),
    japaneseText: message.japaneseText ? maskTextForResearchExport(message.japaneseText) : message.japaneseText,
    culturalNote: message.culturalNote ? maskTextForResearchExport(message.culturalNote) : message.culturalNote,
  }));
}

export function parseReflectionAnswers(value: unknown): ReflectionAnswers | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const source = value as Record<string, unknown>;
  const rating = (key: string): 1 | 3 | 5 | null => {
    const number = Number(source[key]);
    return number === 1 || number === 3 || number === 5 ? number : null;
  };
  const conveyedIdeas = rating('conveyedIdeas');
  const understoodPartner = rating('understoodPartner');
  const noticedLanguageCulture = rating('noticedLanguageCulture');
  if (conveyedIdeas === null || understoodPartner === null || noticedLanguageCulture === null) return undefined;
  return { conveyedIdeas, understoodPartner, noticedLanguageCulture };
}

export function parseResearchSystemEvents(value: unknown): ResearchSystemEvent[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(RESEARCH_SYSTEM_EVENT_TYPES);
  return value.slice(-500).flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const source = raw as Record<string, unknown>;
    const type = typeof source.type === 'string' && allowed.has(source.type) ? source.type as ResearchSystemEventType : null;
    const timestamp = Number(source.timestamp);
    if (!type || !Number.isFinite(timestamp) || timestamp <= 0) return [];
    const valueText = typeof source.value === 'string' ? source.value.trim().slice(0, 80) : '';
    return [{ type, timestamp, ...(valueText ? { value: valueText } : {}) }];
  });
}

export function validateSessionSaveInput(body: unknown): { ok: true; value: SessionSaveInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'INVALID_BODY' };
  const source = body as Record<string, unknown>;
  if (!isValidLearningCode(source.learningCode)) return { ok: false, error: 'INVALID_LEARNING_CODE' };
  const learningCode = normalizeLearningCode(source.learningCode);
  if (!isAIStudentId(source.aiStudentId)) return { ok: false, error: 'INVALID_AI_STUDENT_ID' };
  if (!isDialogueTopic(source.topic)) return { ok: false, error: 'INVALID_TOPIC' };
  if (!isDialogueDuration(source.targetDurationMinutes)) return { ok: false, error: 'INVALID_DURATION' };
  const sessionId = typeof source.sessionId === 'string' ? source.sessionId.trim().slice(0, 120) : '';
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(sessionId)) return { ok: false, error: 'INVALID_SESSION_ID' };
  const startedAt = Number(source.startedAt); const endedAt = Number(source.endedAt);
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt < startedAt) return { ok: false, error: 'INVALID_TIME_RANGE' };
  const history = canonicalizeHistory(source.history);
  return { ok: true, value: {
    sessionId, learningCode, aiStudentId: source.aiStudentId, topic: source.topic, targetDurationMinutes: source.targetDurationMinutes,
    startedAt, endedAt, history,
    encounteredVocab: Array.isArray(source.encounteredVocab) ? (source.encounteredVocab as VisualVocabularyItem[]).slice(0, 200) : [],
    reflection: parseReflectionAnswers(source.reflection),
    systemEvents: parseResearchSystemEvents(source.systemEvents),
    personaLabelCondition: source.personaLabelCondition === 'hidden' ? 'hidden' : 'shown',
    countryLabelVisible: source.countryLabelVisible !== false,
    accentLabelVisible: source.accentLabelVisible !== false,
    flagVisible: source.flagVisible !== false,
    studentSelectedSpeechRate: Math.max(0.75, Math.min(1.25, Number(source.studentSelectedSpeechRate || 1))),
    effectiveTtsSpeechRate: Math.max(0.75, Math.min(1.25, Number(source.effectiveTtsSpeechRate || source.studentSelectedSpeechRate || 1))),
  }};
}
