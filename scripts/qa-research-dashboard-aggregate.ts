import assert from 'node:assert/strict';
import { buildResearchDashboardData } from '../src/server/researchDashboard';
import {
  RESEARCH_DASHBOARD_AGGREGATE_VERSION,
  buildResearchDashboardAggregateDocuments,
  buildResearchDashboardDataFromAggregateSessions,
  flattenResearchDashboardAggregateSessions,
} from '../src/server/researchDashboardAggregate';

function message(sender: 'child' | 'ai', englishText: string, timestamp: string) {
  return { sender, englishText, japaneseText: '', timestamp };
}

function session(overrides: Record<string, any>) {
  return {
    schemaVersion: 3,
    researchSchemaVersion: 'research-2026-v7',
    appVersion: 'qa',
    build: 'qa',
    studentId: `student-${overrides.sessionId}`,
    researchId: `R-${String(overrides.sessionId).toUpperCase().replace(/[^A-Z0-9]/g, '').padEnd(12, 'Q').slice(0, 12)}`,
    classId: '5-1',
    aiStudentId: 'emma_usa',
    personaId: 'emma_usa',
    personaCountry: 'United States',
    personaGender: 'female',
    topic: 'favorites',
    targetDurationMinutes: 2,
    actualDurationSeconds: 60,
    formalStudyParticipant: true,
    studySiteId: 'site_a',
    schoolCondition: 'intervention',
    studyGradeLevel: 5,
    gradeLevel: 5,
    studyStartDate: '2026-09-17',
    personaLabelCondition: 'shown',
    countryLabelVisible: true,
    accentLabelVisible: true,
    flagVisible: true,
    assignedPartnerCountry: 'United States',
    assignedPartnerId: 'partner-1',
    assignmentAnnouncedAt: '2026-09-17T00:00:00.000Z',
    reflection: {
      scaleVersion: '4point-v1',
      understoodPartner: 4,
      conveyedIdeas: 3,
      noticedLanguageCulture: 2,
    },
    systemEvents: [{ type: 'session_finish', value: 'timer', timestamp: overrides.endedAt }],
    history: [
      message('ai', 'What do you like?', overrides.startedAt),
      message('child', 'I like soccer because it is fun.', overrides.startedAt),
      message('ai', 'Nice. I like music.', overrides.endedAt),
      message('child', 'How about you?', overrides.endedAt),
    ],
    updatedAt: overrides.endedAt,
    createdAt: overrides.startedAt,
    ...overrides,
  };
}

const raw = [
  session({
    sessionId: 'main-1',
    startedAt: '2026-09-17T01:00:00.000Z',
    endedAt: '2026-09-17T01:01:00.000Z',
    localDate: '2026-09-17',
    systemEvents: [
      { type: 'session_finish', value: 'timer', timestamp: '2026-09-17T01:01:00.000Z' },
      { type: 'mic_error', value: 'qa', timestamp: '2026-09-17T01:00:30.000Z' },
      { type: 'ai_request_failure', value: 'qa', timestamp: '2026-09-17T01:00:20.000Z' },
      { type: 'tts_provider', value: 'device-fallback', timestamp: '2026-09-17T01:00:10.000Z' },
    ],
  }),
  session({
    sessionId: 'main-2',
    researchId: 'R-MAINSECONDQQ',
    startedAt: '2026-09-17T01:03:00.000Z',
    endedAt: '2026-09-17T01:04:30.000Z',
    localDate: '2026-09-17',
    actualDurationSeconds: 90,
    reflection: null,
  }),
  session({
    sessionId: 'pilot-1',
    researchId: 'R-PILOTONEQQQ',
    classId: '6-PB',
    gradeLevel: 6,
    studyGradeLevel: 6,
    formalStudyParticipant: false,
    studySiteId: '',
    schoolCondition: '',
    studyStartDate: '',
    startedAt: '2026-09-09T01:00:00.000Z',
    endedAt: '2026-09-09T01:01:00.000Z',
    localDate: '2026-09-09',
  }),
  session({
    sessionId: 'test-1',
    researchId: 'R-TESTONEQQQQQ',
    formalStudyParticipant: false,
    studySiteId: '',
    schoolCondition: '',
    studyStartDate: '',
    startedAt: '2026-09-16T01:00:00.000Z',
    endedAt: '2026-09-16T01:01:00.000Z',
    localDate: '2026-09-16',
  }),
];

const documents = buildResearchDashboardAggregateDocuments(raw, 'qa-generation');
assert.equal(documents.length, 3, 'date × class should produce compact aggregate documents');
assert.ok(documents.every((item) => item.data.schemaVersion === RESEARCH_DASHBOARD_AGGREGATE_VERSION));
assert.equal(documents.reduce((sum, item) => sum + item.data.sessionCount, 0), 4);
assert.equal(documents.find((item) => item.data.localDate === '2026-09-17')?.data.sessionCount, 2);

const aggregateSessions = flattenResearchDashboardAggregateSessions(documents.map((item) => item.data));
assert.equal(aggregateSessions.length, 4);
for (const row of aggregateSessions) {
  assert.equal(Object.prototype.hasOwnProperty.call(row, 'history'), false, 'aggregate rows must not copy raw dialogue history');
  assert.equal(Object.prototype.hasOwnProperty.call(row, 'systemEvents'), false, 'aggregate rows must not copy raw system event arrays');
}

for (const query of [
  { dataScope: 'main' },
  { dataScope: 'pilot_b' },
  { dataScope: 'test' },
  { dataScope: 'main', classId: '5-1' },
  { dataScope: 'main', topic: 'favorites', completeOnly: '1' },
]) {
  const legacy = buildResearchDashboardData(raw, query);
  const aggregate = buildResearchDashboardDataFromAggregateSessions(aggregateSessions, query);
  assert.deepEqual(aggregate.metrics, legacy.metrics, `metrics must match legacy path: ${JSON.stringify(query)}`);
  assert.deepEqual(aggregate.researchIndicators, legacy.researchIndicators, `research indicators must match: ${JSON.stringify(query)}`);
  assert.deepEqual(aggregate.charts, legacy.charts, `charts must match legacy path: ${JSON.stringify(query)}`);
  assert.deepEqual(aggregate.dataQuality, legacy.dataQuality, `quality must match legacy path: ${JSON.stringify(query)}`);
  assert.deepEqual(aggregate.systemQuality, legacy.systemQuality, `system quality must match legacy path: ${JSON.stringify(query)}`);
  assert.deepEqual(aggregate.topExpressions, legacy.topExpressions, `top expressions must match legacy path: ${JSON.stringify(query)}`);
  assert.deepEqual(aggregate.recentSessions, legacy.recentSessions, `recent sessions must match legacy path: ${JSON.stringify(query)}`);
  assert.deepEqual(aggregate.filters, legacy.filters, `filters must match legacy path: ${JSON.stringify(query)}`);
  assert.deepEqual(
    aggregate.exportFiles.map((row: any) => ({ dataset: row.dataset, rowCount: row.rowCount })),
    legacy.exportFiles.map((row: any) => ({ dataset: row.dataset, rowCount: row.rowCount })),
    `dashboard export counts must match legacy path: ${JSON.stringify(query)}`,
  );
}

console.log('Research dashboard aggregate parity QA: PASS');
