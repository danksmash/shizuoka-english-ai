import { detectInappropriateContent, detectPromptInjection } from './security';

export interface ValidationResult {
  isValid: boolean;
  sanitizedReply: string;
  reason?: string;
}

// Grade 5/6 classroom target: short, natural, easy-to-process spoken English.
const MAX_SENTENCES = 2;
const MAX_WORDS = 18;
const MAX_QUESTION_WORDS = 9;

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
  const statementBudget = Math.max(6, MAX_WORDS - questionWordCount);
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
    reason: classroomReply !== cleaned ? 'CLASSROOM_LENGTH_LIMIT_APPLIED' : undefined,
  };
}
