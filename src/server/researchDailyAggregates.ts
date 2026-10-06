import crypto from 'node:crypto';
import { deleteDocumentField, patchDocumentField } from './firestore';

export const RESEARCH_DAILY_AGGREGATE_COLLECTION = 'research_daily_aggregates';

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
    await writer.remove(RESEARCH_DAILY_AGGREGATE_COLLECTION, priorDate, `contributions.${key}`);
  }
  await writer.patch(RESEARCH_DAILY_AGGREGATE_COLLECTION, contribution.localDate, `contributions.${key}`, contribution);
}

export type ResearchDailyAggregateDocument = {
  localDate: string;
  contributions: Record<string, ResearchDailyContribution>;
};

export function buildResearchDailyAggregateDocuments(
  sessions: Record<string, any>[],
): ResearchDailyAggregateDocument[] {
  const byDate = new Map<string, Record<string, ResearchDailyContribution>>();
  for (const session of sessions) {
    const contribution = buildResearchDailyContribution(session);
    const key = researchDailyContributionKey(session.sessionId);
    const contributions = byDate.get(contribution.localDate) || {};
    contributions[key] = contribution;
    byDate.set(contribution.localDate, contributions);
  }
  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([localDate, contributions]) => ({ localDate, contributions }));
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stable(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function auditResearchDailyAggregateDocuments(
  expected: ResearchDailyAggregateDocument[],
  actual: Record<string, any>[],
) {
  const expectedByDate = new Map(expected.map((row) => [row.localDate, row.contributions]));
  const actualByDate = new Map(actual.map((row) => {
    const resourceId = typeof row._name === 'string' ? row._name.split('/').at(-1) || '' : '';
    return [text(row.localDate, 10) || text(resourceId, 10), row.contributions || {}];
  }));
  const dates = [...new Set([...expectedByDate.keys(), ...actualByDate.keys()])].filter(Boolean).sort();
  const differences: Array<{
    localDate: string;
    kind: 'unexpected_date' | 'missing_date' | 'contribution_mismatch';
  }> = [];
  for (const localDate of dates) {
    const wanted = expectedByDate.get(localDate);
    const found = actualByDate.get(localDate);
    if (!wanted) differences.push({ localDate, kind: 'unexpected_date' });
    else if (!found) differences.push({ localDate, kind: 'missing_date' });
    else if (stable(wanted) !== stable(found)) differences.push({ localDate, kind: 'contribution_mismatch' });
  }
  const expectedContributions = expected.reduce((sum, row) => sum + Object.keys(row.contributions).length, 0);
  const actualContributions = actual.reduce((sum, row) => sum + Object.keys(row.contributions || {}).length, 0);
  return {
    matches: differences.length === 0,
    expectedDays: expected.length,
    actualDays: actualByDate.size,
    expectedContributions,
    actualContributions,
    differences,
  };
}
