import { detectInappropriateContent, detectPromptInjection } from './security';


export interface AlignedReply {
  english: string;
  japanese: string;
  segmentCount: number;
}

interface RawReplySegment {
  english?: unknown;
  japanese?: unknown;
}

function cleanSegmentText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

/**
 * Keeps English and Japanese together as atomic sentence pairs.
 * It never shortens English independently from its translation.
 */
export function buildAlignedReply(parsed: any, personaName: string = 'AI Student'): AlignedReply {
  const rawSegments: RawReplySegment[] = Array.isArray(parsed?.replySegments)
    ? parsed.replySegments
    : [];

  const validSegments = rawSegments
    .map((segment) => ({
      english: cleanSegmentText(segment?.english),
      japanese: cleanSegmentText(segment?.japanese),
    }))
    .filter((segment) => segment.english && segment.japanese);

  let selected = validSegments;
  if (validSegments.length > 2) {
    const finalQuestion = [...validSegments].reverse().find((segment) => /\?\s*$/.test(segment.english));
    selected = finalQuestion && finalQuestion !== validSegments[0]
      ? [validSegments[0], finalQuestion]
      : validSegments.slice(0, 2);
  } else {
    selected = validSegments.slice(0, 2);
  }

  if (selected.length === 0) {
    const legacyEnglish = cleanSegmentText(parsed?.reply);
    const legacyJapanese = cleanSegmentText(parsed?.japaneseTranslation);
    if (legacyEnglish && legacyJapanese) {
      selected = [{ english: legacyEnglish, japanese: legacyJapanese }];
    }
  }

  const english = selected.map((segment) => segment.english).join(' ').trim();
  const japanese = selected.map((segment) => segment.japanese).join('').trim();

  if (!english || !japanese) {
    return {
      english: `Hello! I'm ${personaName}. What do you like?`,
      japanese: `こんにちは！${personaName}です。何が好きですか？`,
      segmentCount: 0,
    };
  }

  if (detectInappropriateContent(english) || detectPromptInjection(english)) {
    return {
      english: "Let's use friendly English. What do you like?",
      japanese: '楽しく英語で話そう。何が好きですか？',
      segmentCount: 0,
    };
  }

  return { english, japanese, segmentCount: selected.length };
}


export interface StudentTranslationResult {
  isValid: boolean;
  translation: string;
  reason?: 'EMPTY' | 'TOO_LITTLE_JAPANESE' | 'ENGLISH_REMAINS' | 'SOURCE_REPEATED';
}

/**
 * Rejects partial translations without making another AI request.
 * Proper Japanese translations pass through unchanged.
 */
export function inspectStudentJapaneseTranslation(
  value: unknown,
  sourceEnglish: string
): StudentTranslationResult {
  const translation = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (!translation) {
    return { isValid: false, translation: '', reason: 'EMPTY' };
  }

  const japaneseChars = translation.match(/[ぁ-んァ-ヶ一-龠々ー]/g) || [];
  if (japaneseChars.length < 4) {
    return { isValid: false, translation: '', reason: 'TOO_LITTLE_JAPANESE' };
  }

  const latinTokens = translation.match(/[A-Za-z]{2,}/g) || [];
  const latinLetters = (translation.match(/[A-Za-z]/g) || []).length;
  const letterTotal = latinLetters + japaneseChars.length;
  const latinRatio = letterTotal > 0 ? latinLetters / letterTotal : 1;

  const sourceWords = new Set(
    String(sourceEnglish || '')
      .toLowerCase()
      .match(/[a-z]{3,}/g) || []
  );
  const repeatedSourceWords = latinTokens.filter((token) => sourceWords.has(token.toLowerCase()));
  const longEnglishInParentheses = /[（(][^）)]*[A-Za-z][^）)]{8,}[）)]/.test(translation);

  if (repeatedSourceWords.length >= 2 || longEnglishInParentheses) {
    return { isValid: false, translation: '', reason: 'SOURCE_REPEATED' };
  }

  if (latinTokens.length > 1 || latinRatio > 0.15) {
    return { isValid: false, translation: '', reason: 'ENGLISH_REMAINS' };
  }

  return { isValid: true, translation };
}

export interface ValidationResult {
  isValid: boolean;
  sanitizedReply: string;
  reason?: string;
}

// One shared Grade 5/6 level for every topic, student, and conversation duration.
// This matches the short, easy feel of the self-introduction topic.
const MAX_SENTENCES = 2;
const MAX_WORDS = 14;
const MAX_QUESTION_WORDS = 7;

function normalizeSentenceUnit(unit: string): string {
  return unit.replace(/\s+/g, ' ').trim();
}

function capWords(text: string, maxWords: number, terminalPunctuation: '.' | '?'): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  let shortened = words.slice(0, maxWords).join(' ');
  shortened = shortened.replace(/[,;:\-–—.!?]+$/g, '').trim();
  return shortened ? `${shortened}${terminalPunctuation}` : text;
}

function enforceClassroomLength(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return normalized;

  const sentenceMatches = (normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [normalized])
    .map(normalizeSentenceUnit)
    .filter(Boolean);

  const lastQuestion = [...sentenceMatches].reverse().find((unit) => /\?\s*$/.test(unit));
  let selected: string[];

  if (lastQuestion) {
    const questionIndex = sentenceMatches.lastIndexOf(lastQuestion);
    const statementBeforeQuestion = sentenceMatches
      .slice(0, questionIndex)
      .reverse()
      .find((unit) => !/\?\s*$/.test(unit));
    selected = statementBeforeQuestion ? [statementBeforeQuestion, lastQuestion] : [lastQuestion];
  } else {
    selected = sentenceMatches.slice(0, MAX_SENTENCES);
  }

  if (selected.length === 0) return normalized;
  if (selected.length === 1) {
    const only = selected[0];
    return capWords(only, MAX_WORDS, /\?\s*$/.test(only) ? '?' : '.');
  }

  const question = capWords(selected[selected.length - 1], MAX_QUESTION_WORDS, '?');
  const questionWordCount = question.split(/\s+/).filter(Boolean).length;
  const statementBudget = Math.max(5, MAX_WORDS - questionWordCount);
  const statement = capWords(selected[0], statementBudget, '.');
  return `${statement} ${question}`.replace(/\s+/g, ' ').trim();
}

export function validateAiResponse(reply: string, personaName: string = 'AI Student'): string {
  return inspectAiResponse(reply, personaName).sanitizedReply;
}

export function inspectAiResponse(rawReply: string, personaName: string = 'AI Student'): ValidationResult {
  if (!rawReply || typeof rawReply !== 'string' || !rawReply.trim()) {
    return {
      isValid: false,
      sanitizedReply: `Hello! I'm ${personaName}. What do you like?`,
      reason: 'EMPTY_RESPONSE',
    };
  }

  let cleaned = rawReply.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  cleaned = cleaned.replace(/^\{[\s\S]*?"reply":\s*"/, '').replace(/"[\s\S]*?\}$/, '');
  cleaned = cleaned.trim();

  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // Do not remove natural reactions or fillers here. They are allowed when Claude
  // generates them naturally from the immediate conversational context.
  if (detectInappropriateContent(cleaned)) {
    return {
      isValid: false,
      sanitizedReply: `Let's use friendly English. What do you like?`,
      reason: 'SAFETY_FILTER_TRIGGERED',
    };
  }

  if (detectPromptInjection(cleaned)) {
    return {
      isValid: false,
      sanitizedReply: `I'm ${personaName}. Let's talk in English.`,
      reason: 'PROMPT_LEAK_FILTER_TRIGGERED',
    };
  }

  const classroomReply = enforceClassroomLength(cleaned);
  return {
    isValid: true,
    sanitizedReply: classroomReply,
    reason: classroomReply !== rawReply.trim() ? 'CLASSROOM_SIMPLIFICATION_APPLIED' : undefined,
  };
}
