import crypto from 'node:crypto';
import { AIStudentId, DialogueDurationMinutes, ReflectionAnswers, calculateCanonicalStats, maskHistoryForStorage } from '../dataContract';
import type { ChatMessage, DialogueTopic, VisualVocabularyItem } from '../types';
import { getDocument, listCollection, queryCollection, setDocument } from './firestore';

const STUDENT_COLLECTION = 'students';
const SESSION_COLLECTION = 'sessions';

function pepper(): string {
  return process.env.LEARNING_CODE_PEPPER || '';
}

export function persistenceConfigured(): boolean {
  return Boolean(pepper());
}

export function learningCodeKey(code: string): string {
  if (!pepper()) throw new Error('LEARNING_CODE_PEPPER_NOT_CONFIGURED');
  return crypto.createHmac('sha256', pepper()).update(code.trim().toUpperCase()).digest('hex');
}

export async function resolveStudentByCode(code: string): Promise<{ studentId: string; researchId: string; active: boolean } | null> {
  const doc = await getDocument(STUDENT_COLLECTION, learningCodeKey(code));
  if (!doc || doc.active === false) return null;
  const studentId = typeof doc.studentId === 'string' ? doc.studentId : '';
  const researchId = typeof doc.researchId === 'string' ? doc.researchId : '';
  if (!studentId || !researchId) return null;
  return { studentId, researchId, active: true };
}

export async function createStudentCode(code: string, studentId?: string, researchId?: string): Promise<{ studentId: string; researchId: string }> {
  const normalized = code.trim().toUpperCase();
  const sid = studentId || crypto.randomUUID();
  const rid = researchId || `R${crypto.randomInt(100000, 999999)}`;
  await setDocument(STUDENT_COLLECTION, learningCodeKey(normalized), {
    studentId: sid,
    researchId: rid,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return { studentId: sid, researchId: rid };
}

export interface SaveCanonicalSessionArgs {
  sessionId: string;
  studentId: string;
  researchId: string;
  aiStudentId: AIStudentId;
  topic: DialogueTopic;
  targetDurationMinutes: DialogueDurationMinutes;
  startedAt: number;
  endedAt: number;
  history: ChatMessage[];
  encounteredVocab: VisualVocabularyItem[];
  reflection?: ReflectionAnswers;
}

export async function saveCanonicalSession(args: SaveCanonicalSessionArgs) {
  const safeHistory = maskHistoryForStorage(args.history);
  const stats = calculateCanonicalStats(
    safeHistory,
    args.startedAt,
    args.endedAt,
    args.targetDurationMinutes,
    args.encounteredVocab
  );
  const existing = await getDocument(SESSION_COLLECTION, args.sessionId);
  if (existing && existing.studentId && existing.studentId !== args.studentId) {
    throw new Error('SESSION_ID_CONFLICT');
  }
  const studentSessions = await queryCollection(SESSION_COLLECTION, 'studentId', args.studentId, 1000);
  const lifetimeSessionNumber = existing?.lifetimeSessionNumber || studentSessions.length + 1;
  const localDate = new Date(args.endedAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
  const dailySessionNumber = existing?.dailySessionNumber || studentSessions.filter((session) => session.localDate === localDate).length + 1;

  const document = {
    schemaVersion: 1,
    sessionId: args.sessionId,
    studentId: args.studentId,
    researchId: args.researchId,
    aiStudentId: args.aiStudentId,
    topic: args.topic,
    targetDurationMinutes: args.targetDurationMinutes,
    actualDurationSeconds: stats.actualDurationSeconds,
    startedAt: new Date(args.startedAt).toISOString(),
    endedAt: new Date(args.endedAt).toISOString(),
    localDate,
    lifetimeSessionNumber,
    dailySessionNumber,
    totalTurns: stats.totalTurns,
    totalChildWords: stats.totalChildWords,
    uniqueVocabularyCount: stats.uniqueVocabularyCount,
    history: safeHistory,
    encounteredVocab: args.encounteredVocab.slice(0, 200).map((item) => ({ id: item.id, word: item.word, japanese: item.japanese, category: item.category })),
    reflection: args.reflection || null,
    updatedAt: new Date().toISOString(),
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
  await setDocument(SESSION_COLLECTION, args.sessionId, document);
  return document;
}

export async function getStudentHistory(studentId: string): Promise<Record<string, unknown>[]> {
  const rows = await queryCollection(SESSION_COLLECTION, 'studentId', studentId, 500);
  return rows
    .sort((a, b) => String(a.endedAt || '').localeCompare(String(b.endedAt || '')))
    .map((session) => ({
      sessionId: session.sessionId,
      aiStudentId: session.aiStudentId,
      topic: session.topic,
      targetDurationMinutes: session.targetDurationMinutes,
      actualDurationSeconds: session.actualDurationSeconds,
      endedAt: session.endedAt,
      lifetimeSessionNumber: session.lifetimeSessionNumber,
      totalTurns: session.totalTurns,
      totalChildWords: session.totalChildWords,
      uniqueVocabularyCount: session.uniqueVocabularyCount,
      reflection: session.reflection || null,
    }));
}

export async function getAllSessionsForManagement(): Promise<Record<string, any>[]> {
  return listCollection(SESSION_COLLECTION, 1000);
}

export function anonymizeSessionForResearch(session: Record<string, any>): Record<string, unknown> {
  return {
    research_id: session.researchId || '',
    session_id: session.sessionId || '',
    lifetime_session_number: session.lifetimeSessionNumber || 0,
    daily_session_number: session.dailySessionNumber || 0,
    local_date: session.localDate || '',
    ai_student_id: session.aiStudentId || '',
    topic: session.topic || '',
    target_duration_minutes: session.targetDurationMinutes || 0,
    actual_duration_seconds: session.actualDurationSeconds || 0,
    total_turns: session.totalTurns || 0,
    total_child_words: session.totalChildWords || 0,
    unique_vocabulary_count: session.uniqueVocabularyCount || 0,
    reflection_conveyed_ideas: session.reflection?.conveyedIdeas ?? '',
    reflection_understood_partner: session.reflection?.understoodPartner ?? '',
    reflection_continued_conversation: session.reflection?.continuedConversation ?? '',
    reflection_noticed_language_culture: session.reflection?.noticedLanguageCulture ?? '',
    child_utterances: Array.isArray(session.history)
      ? session.history.filter((message: any) => message?.sender === 'child').map((message: any) => String(message.englishText || '')).join(' | ')
      : '',
  };
}
