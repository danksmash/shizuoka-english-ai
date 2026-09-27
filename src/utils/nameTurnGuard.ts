export interface NameTurnPreparation {
  isNameAnswerTurn: boolean;
  aiText: string;
  candidateTokens: string[];
}

export interface NameTurnGuardResult {
  reply: string;
  japaneseTranslation: string;
  replaced: boolean;
  reason?: 'NAME_REFERENCE' | 'NAME_ECHO';
}

const NAME_TOKEN_STOPWORDS = new Set([
  'a','an','and','are','call','i','im','is','me','my','of','the','to','your',
]);

export function aiAskedForLearnerName(text: string): boolean {
  const source = String(text || '');
  return /\bwhat(?:'|’)s your name\b|\bwhat is your name\b/i.test(source)
    || /(?:お名前は|名前は(?:何|なん)|名前を教えて)/.test(source);
}

function candidateTokensFromNameSegment(segment: string): string[] {
  return Array.from(new Set(
    String(segment || '')
      .normalize('NFKC')
      .toLowerCase()
      .match(/[a-z]+(?:'[a-z]+)?/g) || [],
  )).filter((token) => token.length >= 3 && !NAME_TOKEN_STOPWORDS.has(token));
}

export function prepareNameTurnForAi(previousAiText: string, studentText: string): NameTurnPreparation {
  const trimmed = String(studentText || '').trim();
  if (!trimmed || !aiAskedForLearnerName(previousAiText)) {
    return { isNameAnswerTurn: false, aiText: trimmed, candidateTokens: [] };
  }

  const explicit = trimmed.match(/^\s*(?:my name is|call me|i(?:'|’)m|i am)\s+([^.!?]+)([.!?]?)([\s\S]*)$/i);
  if (explicit) {
    const candidateSegment = explicit[1].trim();
    const remainder = String(explicit[3] || '').trim();
    return {
      isNameAnswerTurn: true,
      aiText: `My name is [name].${remainder ? ` ${remainder}` : ''}`,
      candidateTokens: candidateTokensFromNameSegment(candidateSegment),
    };
  }

  const firstClause = (trimmed.match(/^[^.!?]+/)?.[0] || trimmed).trim();
  return {
    isNameAnswerTurn: true,
    aiText: 'My name is [name].',
    candidateTokens: candidateTokensFromNameSegment(firstClause),
  };
}

function includesCandidateEcho(reply: string, candidateTokens: readonly string[]): boolean {
  const normalized = String(reply || '').normalize('NFKC').toLowerCase();
  return candidateTokens.some((token) => {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z])${escaped}(?=$|[^a-z])`, 'i').test(normalized);
  });
}

export function guardNameTurnAiReply(
  reply: string,
  japaneseTranslation: string,
  candidateTokens: readonly string[],
): NameTurnGuardResult {
  const english = String(reply || '').trim();
  const japanese = String(japaneseTranslation || '').trim();

  const referencesName = /\bname\b|\[name\]|\bwhat(?:'|’)s your name\b|\bwhat is your name\b|\bis your name\b|\bdid you say\b|\bhow do you spell\b/i.test(english)
    || /名前|お名前|変わった名前|珍しい名前/.test(japanese);
  const echoesCandidate = includesCandidateEcho(english, candidateTokens)
    || includesCandidateEcho(japanese, candidateTokens);

  if (!referencesName && !echoesCandidate) {
    return { reply: english, japaneseTranslation: japanese, replaced: false };
  }

  return {
    reply: 'Nice to meet you! What do you like?',
    japaneseTranslation: 'はじめまして！何が好きですか？',
    replaced: true,
    reason: referencesName ? 'NAME_REFERENCE' : 'NAME_ECHO',
  };
}
