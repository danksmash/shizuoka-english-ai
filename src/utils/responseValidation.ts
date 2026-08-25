import { detectInappropriateContent, detectPromptInjection } from './security';

export interface ValidationResult {
  isValid: boolean;
  sanitizedReply: string;
  reason?: string;
}

// One shared Grade 5/6 level for every topic, student, and conversation duration.
// This deliberately matches the short, easy feel of the self-introduction topic.
const MAX_SENTENCES = 2;
const MAX_WORDS = 14;
const MAX_QUESTION_WORDS = 7;

const LEADING_REACTION_PATTERN = new RegExp(
  '^\\s*(?:' +
    [
      'awesome', 'brilliant', 'wonderful', 'fantastic', 'totally', 'super cool', 'super',
      'no worries', 'excellent', 'amazing', 'great', 'great job', 'very good', 'very nice',
      'so cool', 'so nice', 'delightful', 'terrific', 'lovely', 'lovely to meet you',
      'sounds great', 'spot on', 'right then', 'splendid', 'cheers', 'got it', 'well done',
      'good on ya', 'glad to hear', 'welcome', 'indeed', 'peaceful', 'happy to meet you',
      'hello friend', 'hey friend'
    ].map((value) => value.replace(/ /g, '\\s+')).join('|') +
  ')\\s*[!,.:-]*\\s*',
  'i'
);

function removeLeadingReaction(text: string): string {
  let cleaned = text.trim();
  // Remove at most two stacked generic reactions, e.g. “Awesome! Great!”.
  for (let i = 0; i < 2; i += 1) {
    const next = cleaned.replace(LEADING_REACTION_PATTERN, '').trim();
    if (next === cleaned || !next) break;
    cleaned = next;
  }
  return cleaned;
}

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

  // Deterministic final guard: persona catchphrases/generic praise may never lead normal replies.
  const withoutReaction = removeLeadingReaction(cleaned);
  if (withoutReaction) cleaned = withoutReaction;

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
