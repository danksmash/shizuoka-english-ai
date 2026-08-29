import type { VisualVocabularyItem } from '../types';
import { detectVocabularyInText as detectGrade5VocabularyInText } from './vocabulary';
import { ELEMENTARY_GRADE_6_VOCABULARY } from './vocabulary6';

const normalizeVocabularyText = (value: string) => value
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[’‘]/g, "'")
  .replace(/\s+/g, ' ')
  .trim();

const exactKeywordPattern = (keyword: string) => {
  const normalizedKeyword = normalizeVocabularyText(keyword);
  const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, 'i');
};

export function detectGrade6VocabularyInText(text: string): VisualVocabularyItem[] {
  if (!text || typeof text !== 'string') return [];
  const normalizedText = normalizeVocabularyText(text);
  const matched = new Map<string, VisualVocabularyItem>();

  for (const item of ELEMENTARY_GRADE_6_VOCABULARY) {
    for (const keyword of item.keywords) {
      if (exactKeywordPattern(keyword).test(normalizedText)) {
        matched.set(item.id, item);
        break;
      }
    }
  }
  return Array.from(matched.values());
}

/**
 * Unified Grade 5-6 visual vocabulary detector.
 * Existing Grade 5 items are preserved; Grade 6 additions are merged by id.
 */
export function detectVocabularyInText(text: string): VisualVocabularyItem[] {
  const merged = new Map<string, VisualVocabularyItem>();
  for (const item of detectGrade5VocabularyInText(text)) merged.set(item.id, item);
  for (const item of detectGrade6VocabularyInText(text)) merged.set(item.id, item);
  return Array.from(merged.values());
}

export { ELEMENTARY_GRADE_6_VOCABULARY } from './vocabulary6';
