import { listCollection, listCollectionFields, setDocumentsBatch } from './firestore';
import { getStudentRecordsForManagement, managementSessionsWithAssignments } from './persistence';
import { buildResearchDashboardData, type ResearchFilterQuery } from './researchDashboard';
import {
  RESEARCH_DAILY_AGGREGATE_COLLECTION,
  RESEARCH_DASHBOARD_SESSION_FIELDS,
  auditResearchDailyAggregateDocuments,
  buildResearchDailyAggregateDocuments,
  researchDailyAggregateCapacity,
  researchDailyAggregateDocumentsToDashboardSessions,
} from './researchDailyAggregates';

const SESSION_COLLECTION = 'sessions';
const SOURCE_FIELDS = RESEARCH_DASHBOARD_SESSION_FIELDS;

async function sourceSessions() {
  const [sessions, students] = await Promise.all([
    listCollectionFields(SESSION_COLLECTION, SOURCE_FIELDS, 1000),
    getStudentRecordsForManagement(),
  ]);
  const normalized = sessions.map((session) => ({
    ...session,
    sessionId: session.sessionId || (typeof session._name === 'string' ? session._name.split('/').at(-1) || '' : ''),
  }));
  // Match the live Research Dashboard exactly: study participation/site/
  // condition/start-date come from the current student master, while assigned
  // partner metadata remains the immutable session snapshot.
  return managementSessionsWithAssignments(normalized, students);
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

function dashboardParityCases(sessions: Record<string, any>[]) {
  const cases: Array<{ label: string; query: ResearchFilterQuery }> = [
    { label:'main_intervention', query:{ dataScope:'main', schoolCondition:'intervention' } },
    { label:'main_comparison', query:{ dataScope:'main', schoolCondition:'comparison' } },
    { label:'pilot_b', query:{ dataScope:'pilot_b', schoolCondition:'all' } },
    { label:'test', query:{ dataScope:'test', schoolCondition:'all' } },
    { label:'reserve', query:{ dataScope:'reserve', schoolCondition:'all' } },
    { label:'complete_only', query:{ dataScope:'all', schoolCondition:'all', completeOnly:'1' } },
  ];
  const sample = sessions.find((session) => session?.classId && (session?.personaId || session?.aiStudentId) && session?.topic);
  if (sample) {
    cases.push({
      label:'representative_filters',
      query:{
        dataScope:'all',
        schoolCondition:'all',
        classId:String(sample.classId || ''),
        grade:String(sample.gradeLevel || ''),
        personaId:String(sample.personaId || sample.aiStudentId || ''),
        labelCondition:String(sample.personaLabelCondition || 'shown'),
        topic:String(sample.topic || ''),
        start:String(sample.localDate || ''),
        end:String(sample.localDate || ''),
      },
    });
  }
  return cases;
}

function auditDashboardParity(source: Record<string, any>[], aggregateDocuments: Record<string, any>[]) {
  const aggregateSessions = researchDailyAggregateDocumentsToDashboardSessions(aggregateDocuments);
  const differences: Array<{ label: string }> = [];
  const cases = dashboardParityCases(source);
  for (const item of cases) {
    const expected = buildResearchDashboardData(source, item.query);
    const actual = buildResearchDashboardData(aggregateSessions, item.query);
    if (stable(expected) !== stable(actual)) differences.push({ label:item.label });
  }
  return {
    matches: differences.length === 0,
    cases: cases.map((item) => item.label),
    aggregateSessions: aggregateSessions.length,
    differences,
  };
}

export async function auditResearchDailyAggregateBackfill() {
  const [sessions, actual] = await Promise.all([
    sourceSessions(),
    listCollection(RESEARCH_DAILY_AGGREGATE_COLLECTION, 1000),
  ]);
  const expected = buildResearchDailyAggregateDocuments(sessions);
  const documentParity = auditResearchDailyAggregateDocuments(expected, actual);
  const dashboardParity = auditDashboardParity(sessions, actual);
  const expectedCapacity = researchDailyAggregateCapacity(expected);
  const actualCapacity = researchDailyAggregateCapacity(actual);
  const matches = documentParity.matches && dashboardParity.matches;
  return {
    sourceSessions: sessions.length,
    ...documentParity,
    matches,
    dashboardParity,
    expectedCapacity,
    actualCapacity,
    cutoverReady: matches && !expectedCapacity.nearDocumentLimit,
  };
}

export async function backfillResearchDailyAggregates() {
  const sessions = await sourceSessions();
  const expected = buildResearchDailyAggregateDocuments(sessions);
  for (const row of expected) {
    if (Buffer.byteLength(JSON.stringify(row), 'utf8') > 900_000) {
      throw new Error(`RESEARCH_DAILY_AGGREGATE_DOCUMENT_TOO_LARGE:${row.localDate}`);
    }
  }
  for (let index = 0; index < expected.length; index += 5) {
    await setDocumentsBatch(
      RESEARCH_DAILY_AGGREGATE_COLLECTION,
      expected.slice(index, index + 5).map((row) => ({ id: row.localDate, data: row })),
    );
  }
  return auditResearchDailyAggregateBackfill();
}
