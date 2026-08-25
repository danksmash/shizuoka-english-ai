import { detectInappropriateContent, detectPromptInjection } from './security';

/**
 * AI Response Technical, Safety, and Classroom-Length Validator
 *
 * The conversation model remains generative, but spoken replies must stay short enough
 * for Grade 5/6 learners to process and answer. We therefore apply a deterministic
 * final guard after safety checks: at most two short sentences and 24 words.
 */
export interface ValidationResult {
  isValid: boolean;
  sanitizedReply: string;
  reason?: string;
}

const MAX_SENTENCES = 2;
const MAX_WORDS = 24;

function enforceClassroomLength(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return normalized;

  // Keep at most two sentence-like units. This deliberately preserves punctuation.
  const sentenceMatches = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [normalized];
  let shortened = sentenceMatches.slice(0, MAX_SENTENCES).join(' ').trim();

  // Secondary word cap protects against two unusually long sentences.
  const words = shortened.split(/\s+/).filter(Boolean);
  if (words.length > MAX_WORDS) {
    shortened = words.slice(0, MAX_WORDS).join(' ');
    shortened = shortened.replace(/[,;:\-–—]+$/g, '').trim();
    if (!/[.!?]$/.test(shortened)) shortened += '.';
  }

  return shortened;
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

  // 4. Classroom-length guard. Never let a verbose model response reach speech/UI unchanged.
  const classroomReply = enforceClassroomLength(cleaned);

  return {
    isValid: true,
    sanitizedReply: classroomReply,
    reason: classroomReply !== cleaned ? 'CLASSROOM_LENGTH_LIMIT_APPLIED' : undefined,
  };
}
