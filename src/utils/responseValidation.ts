import { detectInappropriateContent, detectPromptInjection } from './security';

/**
 * AI Response Technical, Safety, and Classroom-Length Validator
 *
 * The conversation model remains generative, but spoken replies must stay short enough
 * for Grade 5/6 learners to process and answer. The guard deliberately preserves a
 * model-generated contextual follow-up question instead of dropping it and forcing the
 * server to append a generic question such as "How about you?".
 */
export interface ValidationResult {
  isValid: boolean;
  sanitizedReply: string;
  reason?: string;
}

const MAX_SENTENCES = 2;
const MAX_WORDS = 24;
const MAX_QUESTION_WORDS = 12;

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

  // Preserve the model's final contextual question whenever one exists. This is critical:
  // the previous implementation simply kept the first two sentences, which often removed
  // the third-sentence follow-up question. server.ts then appended its generic topic fallback
  // (notably "How about you?"), causing repetitive and semantically awkward dialogue.
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
    const terminal = /\?\s*$/.test(only) ? '?' : '.';
    return capWords(only, MAX_WORDS, terminal);
  }

  // Keep the question short and easy to answer; give the remaining budget to the statement.
  const question = capWords(selected[selected.length - 1], MAX_QUESTION_WORDS, '?');
  const questionWordCount = question.split(/\s+/).filter(Boolean).length;
  const statementBudget = Math.max(6, MAX_WORDS - questionWordCount);
  const statement = capWords(selected[0], statementBudget, '.');

  return `${statement} ${question}`.replace(/\s+/g, ' ').trim();
}

export function validateAiResponse(reply: string, personaName: string = 'AI Student'): string {
  const result = inspectAiResponse(reply, personaName);
  return result.sanitizedReply;
}

export function inspectAiResponse(rawReply: string, personaName: string = 'AI Student'): ValidationResult {
  if (!rawReply || typeof rawReply !== 'string' || !rawReply.trim()) {
    return {
      isValid: false,
      sanitizedReply: `Hello! I'm ${personaName}. What would you like to talk about?`,
      reason: 'EMPTY_RESPONSE',
    };
  }

  let cleaned = rawReply.trim();

  // 1. Clean technical artifacts if any (e.g. markdown code fences, JSON artifacts)
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  cleaned = cleaned.replace(/^\{[\s\S]*?"reply":\s*"/, '').replace(/"[\s\S]*?\}$/, '');
  cleaned = cleaned.trim();

  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // 2. Safety filter
  if (detectInappropriateContent(cleaned)) {
    return {
      isValid: false,
      sanitizedReply: `Let's practice friendly English! What do you like?`,
      reason: 'SAFETY_FILTER_TRIGGERED',
    };
  }

  // 3. Prompt leakage filter
  if (detectPromptInjection(cleaned)) {
    return {
      isValid: false,
      sanitizedReply: `I'm ${personaName}! Let's talk in English.`,
      reason: 'PROMPT_LEAK_FILTER_TRIGGERED',
    };
  }

  // 4. Classroom-length guard. Preserve a contextual model-generated question when present.
  const classroomReply = enforceClassroomLength(cleaned);

  return {
    isValid: true,
    sanitizedReply: classroomReply,
    reason: classroomReply !== cleaned ? 'CLASSROOM_LENGTH_LIMIT_APPLIED' : undefined,
  };
}
