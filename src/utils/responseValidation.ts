import { detectInappropriateContent, detectPromptInjection } from './security';

/**
 * Common Level Response Validator for both AI (Anthropic) and Fallback routes
 * Enforces strict elementary Grade 5/6 sentence count and structural rules:
 * - Easy: Max 1 sentence (or 1 short filler + 1 short sentence)
 * - Normal: Max 1-2 simple sentences (Default)
 * - Hard: Max 2-3 sentences (Allows simple 'and' / 'because')
 */
export function validateResponseByLevel(
  reply: string,
  level: 'easy' | 'normal' | 'hard' = 'normal'
): string {
  if (!reply) return 'That is nice! What sport do you like?';

  // Check for harmful content or prompt leakage in output
  if (detectInappropriateContent(reply) || detectPromptInjection(reply)) {
    return 'That sounds great! What food do you like?';
  }

  // Split into sentences using punctuation boundaries
  const rawSentences = reply
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (rawSentences.length === 0) {
    return reply;
  }

  if (level === 'easy') {
    // Easy: Max 1 sentence (or 1 short reaction like "Oh!" + 1 short sentence)
    if (rawSentences.length > 1) {
      const firstIsShortFiller =
        rawSentences[0].split(' ').length <= 2 &&
        /^(?:oh|wow|nice|great|hello|hi|yes|no|cool)[!,.]?$/i.test(
          rawSentences[0].replace(/[!,.]/g, '')
        );
      if (firstIsShortFiller && rawSentences.length >= 2) {
        return `${rawSentences[0]} ${rawSentences[1]}`;
      }
      return rawSentences[0];
    }
    return rawSentences[0];
  }

  if (level === 'hard') {
    // Hard: Max 3 sentences
    if (rawSentences.length > 3) {
      return rawSentences.slice(0, 3).join(' ');
    }
    return rawSentences.join(' ');
  }

  // Normal (Default): Max 2 sentences
  if (rawSentences.length > 2) {
    return rawSentences.slice(0, 2).join(' ');
  }

  return rawSentences.join(' ');
}
