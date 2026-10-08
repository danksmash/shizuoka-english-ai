import crypto from 'node:crypto';
import { deleteDocumentField, patchDocumentField } from './firestore';

export const RESEARCH_DAILY_AGGREGATE_COLLECTION = 'research_daily_aggregates';

/**
 * Single source of truth for the projected fields needed by both the live
 * Research Dashboard read path and the rebuildable aggregate shadow index.
 * studentId is projected only so the canonical read can join current study
 * metadata; it is deliberately not copied into aggregate contributions.
 */
export const RESEARCH_DASHBOARD_SESSION_FIELDS = [
  'sessionId','studentId','researchId','classId','aiStudentId','personaId','personaCountry','topic','targetDurationMinutes',
  'actualDurationSeconds','activeDialogueSeconds','wallDurationSeconds','durationQuality','sessionStatus','startedAt','endedAt','localDate','schemaVersion','totalTurns','totalChildWords','reflection',
  'aiTurnCount','dialogueUtteranceCount','dialogueTurnMetricSource',
  'personaLabelCondition','assignedPartnerId','assignedPartnerCountry','assignmentAnnouncedAt','ttsFallbackCount','micErrorCount',
  'aiRequestFailureCount','gradeLevel','schoolCondition','studySiteId','studyStartDate','formalStudyParticipant','updatedAt',
];

export type ResearchDailyContribution = {
  researchId: string;
  classId: string;
  localDate: string;
  studySiteId: string;
  schoolCondition: string;
  formalStudyParticipant: boolean;
  studyStartDate: string;
  gradeLevel: number | null;
  personaId: string;
  personaCountry: string;
  topic: string;
  targetDurationMinutes: number;
  startedAt: string;
  endedAt: string;
  personaLabelCondition: string;
  assignedPartnerCountry: string;
  assignmentAnnouncedAt: string;
  actualDurationSeconds: number;
  totalTurns: number;
  totalChildWords: number;
  aiTurnCount: number | null;
  dialogueUtteranceCount: number | null;
  dialogueTurnMetricSource: string;
  micErrorCount: number;
  ttsFallbackCount: number;
  aiRequestFailureCount: number;
  reflectionScaleVersion: string;
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

function optionalNonNegative(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function gradeLevel(value: unknown): number | null {
  const parsed = Number(value);
  return parsed === 5 || parsed === 6 ? parsed : null;
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
    studySiteId: text(session.studySiteId, 80),
    schoolCondition: text(session.schoolCondition, 40),
    formalStudyParticipant: session.formalStudyParticipant === true,
    studyStartDate: text(session.studyStartDate, 10),
    gradeLevel: gradeLevel(session.gradeLevel),
    personaId: text(session.personaId || session.aiStudentId, 120),
    personaCountry: text(session.personaCountry, 120),
    topic: text(session.topic, 80),
    targetDurationMinutes: nonNegative(session.targetDurationMinutes),
    startedAt: text(session.startedAt, 40),
    endedAt: text(session.endedAt, 40),
    personaLabelCondition: text(session.personaLabelCondition, 40) || 'shown',
    assignedPartnerCountry: text(session.assignedPartnerCountry, 120),
    assignmentAnnouncedAt: text(session.assignmentAnnouncedAt, 40),
    actualDurationSeconds: nonNegative(session.actualDurationSeconds),
    activeDialogueSeconds: optionalNonNegative(session.activeDialogueSeconds),
    wallDurationSeconds: optionalNonNegative(session.wallDurationSeconds),
    durationQuality: text(session.durationQuality, 40),
    sessionStatus: text(session.sessionStatus, 40),
    totalTurns: nonNegative(session.totalTurns),
    totalChildWords: nonNegative(session.totalChildWords),
    aiTurnCount: optionalNonNegative(session.aiTurnCount),
    dialogueUtteranceCount: optionalNonNegative(session.dialogueUtteranceCount),
    dialogueTurnMetricSource: text(session.dialogueTurnMetricSource, 80),
    micErrorCount: nonNegative(session.micErrorCount),
    ttsFallbackCount: nonNegative(session.ttsFallbackCount),
    aiRequestFailureCount: nonNegative(session.aiRequestFailureCount),
    reflectionScaleVersion: text(reflection.scaleVersion, 40),
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
  // Keep the date as a first-class field so bounded dashboard reads can use a
  // Firestore range query even for aggregate documents created after backfill.
  await writer.patch(RESEARCH_DAILY_AGGREGATE_COLLECTION, contribution.localDate, 'localDate', contribution.localDate);
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

function reflectionFromContribution(contribution: Record<string, any>) {
  const understood = reflectionValue(contribution.reflectionUnderstood);
  const conveyed = reflectionValue(contribution.reflectionConveyed);
  const culture = reflectionValue(contribution.reflectionCulture);
  const scaleVersion = text(contribution.reflectionScaleVersion, 40);
  if (!scaleVersion && understood === null && conveyed === null && culture === null) return null;
  return {
    scaleVersion,
    understoodPartner: understood,
    conveyedIdeas: conveyed,
    noticedLanguageCulture: culture,
  };
}

/**
 * Reconstruct only the summary-level session shape consumed by
 * buildResearchDashboardSessionRows(). Raw utterances, systemEvents and
 * studentId never enter the aggregate path.
 */
export function researchDailyAggregateDocumentsToDashboardSessions(
  documents: Record<string, any>[],
): Record<string, any>[] {
  const sessions: Record<string, any>[] = [];
  for (const document of documents) {
    const resourceId = typeof document._name === 'string' ? document._name.split('/').at(-1) || '' : '';
    const documentDate = text(document.localDate, 10) || text(resourceId, 10);
    const contributions = document.contributions && typeof document.contributions === 'object'
      ? document.contributions as Record<string, Record<string, any>>
      : {};
    for (const [key, contribution] of Object.entries(contributions)) {
      sessions.push({
        sessionId: key,
        researchId: text(contribution.researchId, 120),
        classId: text(contribution.classId, 40),
        localDate: text(contribution.localDate, 10) || documentDate,
        studySiteId: text(contribution.studySiteId, 80),
        schoolCondition: text(contribution.schoolCondition, 40),
        formalStudyParticipant: contribution.formalStudyParticipant === true,
        studyStartDate: text(contribution.studyStartDate, 10),
        gradeLevel: gradeLevel(contribution.gradeLevel) ?? '',
        personaId: text(contribution.personaId, 120),
        personaCountry: text(contribution.personaCountry, 120),
        topic: text(contribution.topic, 80),
        targetDurationMinutes: nonNegative(contribution.targetDurationMinutes),
        startedAt: text(contribution.startedAt, 40),
        endedAt: text(contribution.endedAt, 40),
        personaLabelCondition: text(contribution.personaLabelCondition, 40) || 'shown',
        assignedPartnerCountry: text(contribution.assignedPartnerCountry, 120),
        assignmentAnnouncedAt: text(contribution.assignmentAnnouncedAt, 40),
        actualDurationSeconds: nonNegative(contribution.actualDurationSeconds),
        activeDialogueSeconds: optionalNonNegative(contribution.activeDialogueSeconds),
        wallDurationSeconds: optionalNonNegative(contribution.wallDurationSeconds),
        durationQuality: text(contribution.durationQuality, 40),
        sessionStatus: text(contribution.sessionStatus, 40),
        totalTurns: nonNegative(contribution.totalTurns),
        totalChildWords: nonNegative(contribution.totalChildWords),
        aiTurnCount: optionalNonNegative(contribution.aiTurnCount),
        dialogueUtteranceCount: optionalNonNegative(contribution.dialogueUtteranceCount),
        dialogueTurnMetricSource: text(contribution.dialogueTurnMetricSource, 80),
        micErrorCount: nonNegative(contribution.micErrorCount),
        ttsFallbackCount: nonNegative(contribution.ttsFallbackCount),
        aiRequestFailureCount: nonNegative(contribution.aiRequestFailureCount),
        reflection: reflectionFromContribution(contribution),
        updatedAt: text(contribution.updatedAt, 40),
      });
    }
  }
  return sessions;
}

export function researchDailyAggregateCapacity(documents: Record<string, any>[]) {
  let maxDocumentBytes = 0;
  let maxContributionsPerDay = 0;
  let largestDate = '';
  for (const document of documents) {
    const resourceId = typeof document._name === 'string' ? document._name.split('/').at(-1) || '' : '';
    const localDate = text(document.localDate, 10) || text(resourceId, 10);
    const contributions = document.contributions && typeof document.contributions === 'object'
      ? document.contributions as Record<string, unknown>
      : {};
    const bytes = Buffer.byteLength(JSON.stringify({ localDate, contributions }), 'utf8');
    const count = Object.keys(contributions).length;
    if (bytes > maxDocumentBytes) {
      maxDocumentBytes = bytes;
      largestDate = localDate;
    }
    maxContributionsPerDay = Math.max(maxContributionsPerDay, count);
  }
  const warningThresholdBytes = 700_000;
  return {
    maxDocumentBytes,
    maxContributionsPerDay,
    largestDate,
    warningThresholdBytes,
    firestoreDocumentLimitBytes: 1_048_576,
    nearDocumentLimit: maxDocumentBytes >= warningThresholdBytes,
  };
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
