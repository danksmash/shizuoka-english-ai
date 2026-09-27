export interface DialogueSafetyHistoryMessage {
  sender?: unknown;
  englishText?: unknown;
}

export interface DialogueSafetySegment {
  english: string;
  japanese: string;
}

export interface DialogueSafetyResult {
  segments: DialogueSafetySegment[];
  nameEvaluationRemoved: boolean;
  repeatedQuestionRemoved: boolean;
}

type QuestionIntent =
  | 'name'
  | 'age'
  | 'likes'
  | 'food'
  | 'sports'
  | 'ability'
  | 'place'
  | 'daily'
  | 'school'
  | 'other';

const NAME_QUESTION_RE = /\bwhat(?:'|’)s your name\b|\bwhat is your name\b|\btell me your name\b|\bmay i know your name\b/i;
const NAME_INTRO_RE = /\b(?:my name is|call me)\b/i;
const EXPLICIT_REPEAT_REQUEST_RE = /^\s*(?:pardon|sorry|what|again|please repeat|say that again)\s*[?!.]*\s*$/i;

const NAME_EVALUATION_RE = new RegExp(
  String.raw`(?:\b(?:nice|beautiful|cool|funny|strange|weird|unusual|interesting|great|lovely|cute|good|bad|unique|awesome|amazing|wonderful)\s+(?:a\s+)?name\b|\b(?:your|that|this)\s+name\s+(?:is|sounds)\s+(?:very\s+|really\s+)?(?:nice|beautiful|cool|funny|strange|weird|unusual|interesting|great|lovely|cute|good|bad|unique|awesome|amazing|wonderful)\b|\bi\s+(?:really\s+)?like\s+your\s+name\b)`,
  'i',
);

const JAPANESE_NAME_EVALUATION_RE = /(?:名前|お名前).{0,12}(?:素敵|すてき|いい|良い|面白い|おもしろい|変|珍しい|ユニーク|かわいい|可愛い|かっこいい|クール|すごい)|(?:素敵|すてき|いい|良い|面白い|おもしろい|変|珍しい|ユニーク|かわいい|可愛い|かっこいい|クール|すごい).{0,12}(?:名前|お名前)/;

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function latestChildText(history: readonly DialogueSafetyHistoryMessage[]): string {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index]?.sender === 'child') return cleanText(history[index]?.englishText);
  }
  return '';
}

function previousAiText(history: readonly DialogueSafetyHistoryMessage[]): string {
  let foundLatestChild = false;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];
    if (message?.sender === 'child') {
      foundLatestChild = true;
      continue;
    }
    if (foundLatestChild && message?.sender === 'ai') return cleanText(message?.englishText);
  }
  return '';
}

function isNameContext(history: readonly DialogueSafetyHistoryMessage[]): boolean {
  const child = latestChildText(history);
  if (NAME_INTRO_RE.test(child)) return true;
  return NAME_QUESTION_RE.test(previousAiText(history));
}

function isNameEvaluationSegment(segment: DialogueSafetySegment): boolean {
  return NAME_EVALUATION_RE.test(segment.english) || JAPANESE_NAME_EVALUATION_RE.test(segment.japanese);
}

function extractQuestion(text: string): string {
  const units = text.match(/[^.!?]*\?/g) || [];
  return cleanText(units[units.length - 1] || '');
}

function normalizeQuestion(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\bwhat's\b/g, 'what is')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function questionWords(text: string): Set<string> {
  const stop = new Set(['a', 'an', 'the', 'is', 'are', 'am', 'do', 'does', 'did', 'you', 'your', 'i', 'me', 'my', 'what', 'which', 'how', 'can', 'could', 'please']);
  return new Set(normalizeQuestion(text).split(' ').filter((word) => word.length > 1 && !stop.has(word)));
}

function lexicalSimilarity(a: string, b: string): number {
  const left = questionWords(a);
  const right = questionWords(b);
  if (left.size === 0 || right.size === 0) return normalizeQuestion(a) === normalizeQuestion(b) ? 1 : 0;
  let overlap = 0;
  for (const word of left) if (right.has(word)) overlap += 1;
  return overlap / Math.max(left.size, right.size);
}

function classifyQuestionIntent(question: string): QuestionIntent {
  const q = normalizeQuestion(question);
  if (/\b(?:what is your name|tell me your name|name)\b/.test(q)) return 'name';
  if (/\bhow old\b|\bwhat age\b|\bare you (?:nine|ten|eleven|twelve|13|12|11|10|9)\b/.test(q)) return 'age';
  if (/\bwhat food\b|\bfood do you like\b|\bfavorite food\b/.test(q)) return 'food';
  if (/\bwhat sport\b|\bsports? do you like\b|\bplay (?:soccer|football|baseball|basketball|tennis|sports?)\b/.test(q)) return 'sports';
  if (/\bwhat do you like\b|\bdo you like\b|\bfavorite\b/.test(q)) return 'likes';
  if (/\bcan you\b|\bwhat can you do\b|\bgood at\b/.test(q)) return 'ability';
  if (/\bwhere do you live\b|\bwhere are you from\b|\bwhat place\b/.test(q)) return 'place';
  if (/\bwhat do you do in the (?:morning|afternoon|evening)\b|\bwhat time do you\b|\bget up\b|\bgo to bed\b/.test(q)) return 'daily';
  if (/\bschool\b|\bsubject\b|\bgrade\b/.test(q)) return 'school';
  return 'other';
}

function recentAiQuestions(history: readonly DialogueSafetyHistoryMessage[]): string[] {
  const result: string[] = [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];
    if (message?.sender !== 'ai') continue;
    const question = extractQuestion(cleanText(message?.englishText));
    if (question) result.push(question);
    if (result.length >= 2) break;
  }
  return result;
}

function shouldSuppressQuestion(
  question: string,
  history: readonly DialogueSafetyHistoryMessage[],
): boolean {
  const latestChild = latestChildText(history);
  if (EXPLICIT_REPEAT_REQUEST_RE.test(latestChild)) return false;

  const previousQuestions = recentAiQuestions(history);
  const lastQuestion = previousQuestions[0];
  if (!lastQuestion) return false;

  const normalizedCandidate = normalizeQuestion(question);
  const normalizedLast = normalizeQuestion(lastQuestion);
  if (normalizedCandidate && normalizedCandidate === normalizedLast) return true;
  if (lexicalSimilarity(question, lastQuestion) >= 0.8) return true;

  const candidateIntent = classifyQuestionIntent(question);
  if (candidateIntent === 'other' || previousQuestions.length < 2) return false;
  return previousQuestions.slice(0, 2).every((item) => classifyQuestionIntent(item) === candidateIntent);
}

function fallbackTopicShift(history: readonly DialogueSafetyHistoryMessage[]): DialogueSafetySegment {
  const previousIntent = classifyQuestionIntent(recentAiQuestions(history)[0] || '');
  if (previousIntent === 'food' || previousIntent === 'likes') {
    return {
      english: "Let's talk about something else. Do you play sports?",
      japanese: 'ほかのことを話そう。スポーツはしますか？',
    };
  }
  return {
    english: "Let's talk about something else. What food do you like?",
    japanese: 'ほかのことを話そう。どんな食べ物が好きですか？',
  };
}

export function applyDialogueSafetyToSegments(
  inputSegments: readonly DialogueSafetySegment[],
  history: readonly DialogueSafetyHistoryMessage[] = [],
): DialogueSafetyResult {
  const nameContext = isNameContext(history);
  let nameEvaluationRemoved = false;
  let repeatedQuestionRemoved = false;

  const segments: DialogueSafetySegment[] = [];
  for (const segment of inputSegments) {
    if (nameContext && isNameEvaluationSegment(segment)) {
      nameEvaluationRemoved = true;
      continue;
    }

    const question = extractQuestion(segment.english);
    if (question && shouldSuppressQuestion(question, history)) {
      repeatedQuestionRemoved = true;
      const statementOnly = segment.english.replace(/[^.!?]*\?\s*$/, '').trim();
      if (statementOnly) {
        segments.push({ english: statementOnly, japanese: segment.japanese });
      }
      continue;
    }

    segments.push(segment);
  }

  if (segments.length === 0) {
    if (repeatedQuestionRemoved) segments.push(fallbackTopicShift(history));
    else if (nameEvaluationRemoved) segments.push({ english: 'Nice to meet you!', japanese: 'はじめまして！' });
  }

  return { segments, nameEvaluationRemoved, repeatedQuestionRemoved };
}
