import { detectInappropriateContent, detectPromptInjection } from './security';

/**
 * AI Response Technical and Safety Validator
 * 
 * DESIGN PRINCIPLE: VALIDATION !== GENERATION.
 * - This validator performs safety, PII protection, and technical anomaly checks.
 * - It DOES NOT rewrite or inject predetermined questions (e.g. "What sport do you like?").
 * - It DOES NOT enforce artificial sentence count or easy/normal/hard level truncation.
 * - If the AI response is clean and safe, it is passed through exactly as generated.
 */
export interface ValidationResult {
  isValid: boolean;
  sanitizedReply: string;
  reason?: string;
}

export function validateAiResponse(reply: string, personaName: string = 'AI Student'): string {
  const result = inspectAiResponse(reply, personaName);
  return result.sanitizedReply;
}

export function inspectAiResponse(rawReply: string, personaName: string = 'AI Student'): ValidationResult {
  if (!rawReply || typeof rawReply !== 'string' || !rawReply.trim()) {
    return {
      isValid: false,
      sanitizedReply: `Hello! I'm ${personaName}. What would you like to talk about today?`,
      reason: 'EMPTY_RESPONSE',
    };
  }

  let cleaned = rawReply.trim();

  // 1. Clean technical artifacts if any (e.g. markdown code fences, JSON artifacts)
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  cleaned = cleaned.replace(/^\{[\s\S]*?"reply":\s*"/, '').replace(/"[\s\S]*?\}$/, '');
  cleaned = cleaned.trim();

  // Strip excessive enclosing quotes if returned as a single quoted string
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // 2. Safety filter
  if (detectInappropriateContent(cleaned)) {
    return {
      isValid: false,
      sanitizedReply: `Let's practice friendly English together! What is your favorite thing?`,
      reason: 'SAFETY_FILTER_TRIGGERED',
    };
  }

  // 3. Prompt leakage filter
  if (detectPromptInjection(cleaned)) {
    return {
      isValid: false,
      sanitizedReply: `I am ${personaName}! Let's have fun talking in English.`,
      reason: 'PROMPT_LEAK_FILTER_TRIGGERED',
    };
  }

  return {
    isValid: true,
    sanitizedReply: cleaned,
  };
}
