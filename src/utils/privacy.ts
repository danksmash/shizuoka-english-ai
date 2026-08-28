import { ChatMessage } from '../types';
import { maskHighRiskPII } from './security';

export function maskTextForExternalUse(text: string): string {
  return maskHighRiskPII(String(text || '')).maskedText;
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
