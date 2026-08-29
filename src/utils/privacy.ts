import { ChatMessage } from '../types';
import { maskHighRiskPII } from './security';

export function maskTextForExternalUse(text: string): string {
  return maskHighRiskPII(String(text || '')).maskedText;
}

/**
 * Research exports need a stricter layer than the conversational safety mask.
 * Preserve the linguistic frame for re-analysis while removing common direct/
 * quasi-identifiers that children may naturally say during self-introduction.
 */
export function maskTextForResearchExport(text: string): string {
  let masked = maskTextForExternalUse(text);

  // Explicit learner/person names. Stop before likely continuation words so the
  // surrounding communicative structure remains available for later coding.
  const nameBoundary = '(?=\\s+(?:and|but|from|i|my|how|what|where|when|who|why|can|do|like|am|is|are)\\b|[,.!?]|$)';
  masked = masked.replace(new RegExp(`\\b(my name is|call me)\\s+.{1,60}?${nameBoundary}`, 'gi'), '$1 [name omitted]');
  masked = masked.replace(new RegExp(`\\b(his name is|her name is|their name is)\\s+.{1,60}?${nameBoundary}`, 'gi'), '$1 [name omitted]');
  masked = masked.replace(/(私の名前は|ぼくの名前は|僕の名前は|わたしの名前は)\s*[^。！？,.]{1,40}?(です|だよ|。|$)/g, '$1 [name omitted] $2');

  // Exact age is not needed because grade/class are retained as research variables.
  masked = masked.replace(/\b(i am|i'm)\s+(?:9|10|11|12|13)\s*(?:years? old)?\b/gi, '$1 [age omitted]');
  masked = masked.replace(/(?:私は|わたしは|僕は|ぼくは)\s*(?:9|10|11|12|13|９|１０|１１|１２|１３)\s*歳/g, '私は [age omitted]');

  // School names can directly identify the study site.
  masked = masked.replace(/\b(?:I\s+(?:go|study)\s+(?:to|at)\s+)?[A-Za-z][A-Za-z .&'’-]{1,60}\s+(?:Elementary|Primary|Junior High|Middle|High)\s+School\b/gi, '[school name omitted]');
  masked = masked.replace(/[ぁ-んァ-ヶ一-龯々A-Za-z0-9・ー\s]{1,50}(?:小学校|中学校|高等学校|高校)/g, '[school name omitted]');

  // Learning codes must never enter researcher data even if spoken aloud.
  masked = masked.replace(/\b(?:my\s+)?(?:learning\s+)?code\s+(?:is\s+)?[A-Z0-9]{4}\b/gi, 'my code is [code omitted]');
  masked = masked.replace(/(?:学習者?コード|学習コード|コード)\s*(?:は|:|：)?\s*[A-Z0-9]{4}/gi, 'コードは [code omitted]');

  // Exact birthdays are unnecessary for the planned analyses; retain the sentence frame.
  masked = masked.replace(/\b(my birthday is|my birthday's)\s+[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?\b/gi, '$1 [date omitted]');
  masked = masked.replace(/(?:誕生日|たんじょうび)\s*(?:は|:|：)?\s*\d{1,2}\s*月\s*\d{1,2}\s*日/g, '誕生日は [date omitted]');

  return masked;
}

export function maskMessagesForExternalUse(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    ...message,
    englishText: maskTextForExternalUse(message.englishText),
    japaneseText: message.japaneseText ? maskTextForExternalUse(message.japaneseText) : message.japaneseText,
    culturalNote: message.culturalNote ? maskTextForExternalUse(message.culturalNote) : message.culturalNote,
  }));
}

export function safePlainTextForClipboard(text: string): string {
  return maskTextForExternalUse(text).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}
