import crypto from 'node:crypto';
import { deleteDocumentField, patchDocumentField } from './firestore';

const COLLECTION = 'research_daily_aggregates';

export type ResearchDailyContribution = {
  researchId: string;
  classId: string;
  localDate: string;
  personaId: string;
  personaCountry: string;
  assignedPartnerCountry: string;
  actualDurationSeconds: number;
  totalTurns: number;
  totalChildWords: number;
  reflectionUnderstood: number | null;
  reflectionConveyed: number | null;
  reflectionCulture: number | null;
  updatedAt: string;
};

function text(value: unknown, max = 160): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function nonNegative(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function reflectionValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null;
}

export function researchDailyContributionKey(sessionId: unknown): string {
  const value = text(sessionId, 240);
  if (!value) throw new Error('RESEARCH_DAILY_AGGREGATE_SESSION_ID_MISSING');
  return `s_${crypto.createHash('sha256').update(value).digest('hex').slice(0, 32)}`;
}

export function buildResearchDailyContribution(session: Record<string, any>): ResearchDailyContribution {
  const localDate = text(session.localDate, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) throw new Error('RESEARCH_DAILY_AGGREGATE_LOCAL_DATE_INVALID');
  const reflection = session.reflection && typeof session.reflection === 'object' ? session.reflection : {};
  return {
    researchId: text(session.researchId, 120),
    classId: text(session.classId, 40),
    localDate,
    personaId: text(session.personaId, 120),
    personaCountry: text(session.personaCountry, 120),
    assignedPartnerCountry: text(session.assignedPartnerCountry, 120),
    actualDurationSeconds: nonNegative(session.actualDurationSeconds),
    totalTurns: nonNegative(session.totalTurns),
    totalChildWords: nonNegative(session.totalChildWords),
    reflectionUnderstood: reflectionValue(reflection.understoodPartner),
    reflectionConveyed: reflectionValue(reflection.conveyedIdeas),
    reflectionCulture: reflectionValue(reflection.noticedLanguageCulture),
    updatedAt: text(session.updatedAt, 40) || new Date().toISOString(),
  };
}

export async function syncResearchDailyAggregateContribution(
  previous: Record<string, any> | null,
  current: Record<string, any>,
  writer: {
    patch: typeof patchDocumentField;
    remove: typeof deleteDocumentField;
  } = { patch: patchDocumentField, remove: deleteDocumentField },
): Promise<void> {
  const contribution = buildResearchDailyContribution(current);
  const key = researchDailyContributionKey(current.sessionId);
  const priorDate = previous ? text(previous.localDate, 10) : '';
  if (priorDate && priorDate !== contribution.localDate) {
    await writer.remove(COLLECTION, priorDate, `contributions.${key}`);
  }
  await writer.patch(COLLECTION, contribution.localDate, `contributions.${key}`, contribution);
}
