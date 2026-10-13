/**
 * Existing Study 1 participants may have legacy R + six-digit research IDs.
 * Newly issued IDs use R- plus 8–20 unambiguous letters/digits.
 * Format validation does not grant access: callers must also verify that the ID
 * belongs to an existing eligible participant in Firestore.
 */
const SUPPORTED_RESEARCH_ID_FORMAT = /^(?:R[0-9]{6}|R-[A-Z2-9]{8,20})$/;

export function isSupportedResearchIdFormat(researchId: unknown): boolean {
  return typeof researchId === 'string' && SUPPORTED_RESEARCH_ID_FORMAT.test(researchId);
}
