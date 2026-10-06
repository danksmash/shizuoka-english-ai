import { listCollection, listCollectionFields, setDocumentsBatch } from './firestore';
import {
  RESEARCH_DAILY_AGGREGATE_COLLECTION,
  auditResearchDailyAggregateDocuments,
  buildResearchDailyAggregateDocuments,
} from './researchDailyAggregates';

const SESSION_COLLECTION = 'sessions';
const SOURCE_FIELDS = [
  'sessionId', 'researchId', 'classId', 'localDate', 'personaId', 'personaCountry',
  'assignedPartnerCountry', 'actualDurationSeconds', 'totalTurns', 'totalChildWords',
  'reflection', 'updatedAt',
];

async function sourceSessions() {
  const sessions = await listCollectionFields(SESSION_COLLECTION, SOURCE_FIELDS, 1000);
  return sessions.map((session) => ({
    ...session,
    sessionId: session.sessionId || (typeof session._name === 'string' ? session._name.split('/').at(-1) || '' : ''),
  }));
}

export async function auditResearchDailyAggregateBackfill() {
  const [sessions, actual] = await Promise.all([
    sourceSessions(),
    listCollection(RESEARCH_DAILY_AGGREGATE_COLLECTION, 1000),
  ]);
  const expected = buildResearchDailyAggregateDocuments(sessions);
  return {
    sourceSessions: sessions.length,
    ...auditResearchDailyAggregateDocuments(expected, actual),
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
