import { AIStudentId, ChatMessage, DialogueDurationMinutes, DialogueTopic, VisualVocabularyItem } from './types';
import { maskMessagesForExternalUse } from './utils/privacy';

export const AI_STUDENT_IDS = [
  'emma_usa',
  'oliver_uk',
  'liam_australia',
  'chloe_canada',
  'bence_hungary',
  'zofia_poland',
  'rahul_bangladesh',
  'linh_vietnam',
  'aung_myanmar',
] as const satisfies readonly AIStudentId[];

export const DIALOGUE_TOPIC_IDS = [
  'intro',
  'favorites',
  'shizuoka_culture',
  'talents',
  'free',
] as const satisfies readonly DialogueTopic[];

export const DIALOGUE_DURATIONS_MINUTES = [1, 2, 3, 5] as const satisfies readonly DialogueDurationMinutes[];

export interface StudentIdentity {
  learningCode: string;
}

export interface ReflectionAnswers {
  conveyedIdeas: number;
  understoodPartner: number;
  continuedConversation: number;
  noticedLanguageCulture: number;
  freeComment?: string;
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
}

export interface CanonicalSessionStats {
  totalTurns: number;
  totalChildWords: number;
  actualDurationSeconds: number;
  targetDurationMinutes: DialogueDurationMinutes;
  uniqueVocabularyCount: number;
}

export const isAIStudentId = (value: unknown): value is AIStudentId =>
  typeof value === 'string' && (AI_STUDENT_IDS as readonly string[]).includes(value);

export const isDialogueTopic = (value: unknown): value is DialogueTopic =>
  typeof value === 'string' && (DIALOGUE_TOPIC_IDS as readonly string[]).includes(value);

export const isDialogueDuration = (value: unknown): value is DialogueDurationMinutes =>
  typeof value === 'number' && (DIALOGUE_DURATIONS_MINUTES as readonly number[]).includes(value);

export function normalizeLearningCode(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) : '';
}

export function isValidLearningCode(value: unknown): boolean {
  const normalized = normalizeLearningCode(value);
  return /^[A-Z0-9]{4,8}$/.test(normalized);
}

export function countEnglishWords(text: string): number {
  return (text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || []).length;
}

export function canonicalizeHistory(history: unknown): ChatMessage[] {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-200)
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item, index) => {
      const sender = item.sender === 'ai' ? 'ai' : item.sender === 'child' ? 'child' : null;
      const englishText = typeof item.englishText === 'string' ? item.englishText.trim().slice(0, 300) : '';
      if (!sender || !englishText) return null;
      const japaneseText = typeof item.japaneseText === 'string' ? item.japaneseText.trim().slice(0, 500) : '';
      const timestamp = Number.isFinite(Number(item.timestamp)) ? Number(item.timestamp) : Date.now() + index;
      const message: ChatMessage = {
        id: typeof item.id === 'string' && item.id.trim() ? item.id.trim().slice(0, 120) : `msg-${timestamp}-${index}`,
        sender,
        englishText,
        japaneseText,
        timestamp,
        wordCount: sender === 'child' ? countEnglishWords(englishText) : undefined,
      };
      return message;
    })
    .filter((item) => item !== null) as ChatMessage[];
}

export function calculateCanonicalStats(
  history: ChatMessage[],
  startedAt: number,
  endedAt: number,
  targetDurationMinutes: DialogueDurationMinutes,
  encounteredVocab: unknown
): CanonicalSessionStats {
  const childMessages = history.filter((message) => message.sender === 'child');
  const totalChildWords = childMessages.reduce((sum, message) => sum + countEnglishWords(message.englishText), 0);
  const safeStart = Number.isFinite(startedAt) ? startedAt : endedAt;
  const safeEnd = Number.isFinite(endedAt) ? endedAt : safeStart;
  const actualDurationSeconds = Math.max(0, Math.min(60 * 60, Math.round((safeEnd - safeStart) / 1000)));
  const vocabIds = new Set(
    Array.isArray(encounteredVocab)
      ? encounteredVocab.map((item) => (item && typeof item === 'object' && 'id' in item ? String(item.id) : '')).filter(Boolean)
      : []
  );
  return {
    totalTurns: childMessages.length,
    totalChildWords,
    actualDurationSeconds,
    targetDurationMinutes,
    uniqueVocabularyCount: vocabIds.size,
  };
}

export function maskHistoryForStorage(history: ChatMessage[]): ChatMessage[] {
  return maskMessagesForExternalUse(history);
}

export function parseReflectionAnswers(value: unknown): ReflectionAnswers | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const source = value as Record<string, unknown>;
  const rating = (key: string) => {
    const number = Number(source[key]);
    return Number.isInteger(number) && number >= 1 && number <= 5 ? number : null;
  };
  const conveyedIdeas = rating('conveyedIdeas');
  const understoodPartner = rating('understoodPartner');
  const continuedConversation = rating('continuedConversation');
  const noticedLanguageCulture = rating('noticedLanguageCulture');
  if ([conveyedIdeas, understoodPartner, continuedConversation, noticedLanguageCulture].some((v) => v === null)) return undefined;
  return { conveyedIdeas: conveyedIdeas!, understoodPartner: understoodPartner!, continuedConversation: continuedConversation!, noticedLanguageCulture: noticedLanguageCulture!, freeComment: typeof source.freeComment === 'string' ? source.freeComment.trim().slice(0, 500) : undefined };
}

export function validateSessionSaveInput(body: unknown):
  | { ok: true; value: SessionSaveInput }
  | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'INVALID_BODY' };
  const source = body as Record<string, unknown>;
  const learningCode = normalizeLearningCode(source.learningCode);
  if (!isValidLearningCode(learningCode)) return { ok: false, error: 'INVALID_LEARNING_CODE' };
  if (!isAIStudentId(source.aiStudentId)) return { ok: false, error: 'INVALID_AI_STUDENT_ID' };
  if (!isDialogueTopic(source.topic)) return { ok: false, error: 'INVALID_TOPIC' };
  if (!isDialogueDuration(source.targetDurationMinutes)) return { ok: false, error: 'INVALID_DURATION' };
  const sessionId = typeof source.sessionId === 'string' ? source.sessionId.trim().slice(0, 120) : '';
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(sessionId)) return { ok: false, error: 'INVALID_SESSION_ID' };
  const startedAt = Number(source.startedAt);
  const endedAt = Number(source.endedAt);
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt < startedAt) {
    return { ok: false, error: 'INVALID_TIME_RANGE' };
  }
  const history = canonicalizeHistory(source.history);
  return {
    ok: true,
    value: {
      sessionId,
      learningCode,
      aiStudentId: source.aiStudentId,
      topic: source.topic,
      targetDurationMinutes: source.targetDurationMinutes,
      startedAt,
      endedAt,
      history,
      encounteredVocab: Array.isArray(source.encounteredVocab) ? (source.encounteredVocab as VisualVocabularyItem[]).slice(0, 200) : [],
      reflection: parseReflectionAnswers(source.reflection),
    },
  };
}
