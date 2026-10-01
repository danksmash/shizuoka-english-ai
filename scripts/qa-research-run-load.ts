import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildResearchDataSets } from '../src/server/researchExport';
import { validateSessionSaveInput } from '../src/dataContract';
import {
  RESEARCH_EXPORT_HEADERS,
  buildResearchExportDataSets,
  filterResearchExportDataSets,
  normalizeFormalResearchExportQuery,
} from '../src/server/researchDashboard';
import { augmentSessionRowsWithPhase, PHASE_SESSION_EXPORT_HEADERS } from '../src/server/researchPhaseAnalyticsRuntime';
import {
  buildStreamingPreparationFromSessions,
  buildStreamingRowsForPage,
  serializeStreamingCsvRow,
} from '../src/server/researchStreamingExportRuntime';
import { buildFastStreamingSessionRowsForPage } from '../src/server/researchStreamingSessionBuilder';

const server = fs.readFileSync('server.ts', 'utf8');
assert.ok(server.includes("student-fail:${ip}"));
assert.ok(!server.includes("student:${ip}`,15"));
assert.ok(server.includes("'claude-sonnet-5'"));
assert.ok(server.includes("output_config: { effort: 'medium' }"));
assert.ok(server.includes("cache_control: { type: 'ephemeral' }"));

const base = Date.now();
const sessions: any[] = [];
for (let i = 0; i < 300; i += 1) {
  const started = base + (i % 100) * 100;
  const body = {
    sessionId: `load_session_${String(i).padStart(4, '0')}`,
    learningCode: 'A7M4',
    aiStudentId: 'emma_usa',
    topic: 'favorites',
    targetDurationMinutes: 2,
    startedAt: started,
    endedAt: started + 90_000,
    history: [
      { id: `a${i}`, sender: 'ai', englishText: 'I like surfing. What do you like?', timestamp: started },
      { id: `c${i}`, sender: 'child', englishText: 'I like strawberries.', timestamp: started + 10_000 },
    ],
    reflection: { conveyedIdeas: 3, understoodPartner: 3, noticedLanguageCulture: 3 },
    personaLabelCondition: 'shown',
    studentSelectedSpeechRate: 1,
    effectiveTtsSpeechRate: 1,
    systemEvents: [{ type: 'session_start', timestamp: started }, { type: 'session_finish', timestamp: started + 89_000 }],
  };
  const v = validateSessionSaveInput(body);
  assert.equal(v.ok, true);
  sessions.push({ ...body, researchId: `R-${i % 100}`, classId: '5-1', schemaVersion: 4, personaId: 'emma_usa' });
}
const t = Date.now();
const data = buildResearchDataSets(sessions);
const elapsed = Date.now() - t;
assert.equal(data.sessions.length, 300);
assert.ok(data.expressions.some((r) => r.dictionary_source === 'persona'));
assert.ok(data.sessions.every((r) => r.persona_id === 'emma_usa'));
assert.ok(elapsed < 10_000, `300-session research build too slow: ${elapsed}ms`);
console.log(`100 users x 3 sessions synthetic load QA: PASS (${elapsed}ms)`);

const LARGE_SESSION_COUNT = 10_000;
const UTTERANCES_PER_SESSION = 10;
const PAGE_SIZE = 200;
const largeBase = Date.parse('2026-10-01T00:00:00.000Z');

function largeSession(index: number, includeHistory: boolean) {
  const lesson = Math.floor(index / 30);
  const seat = index % 30;
  const started = largeBase + lesson * 60 * 60_000 + seat * 500;
  const classId = `5-${(lesson % 3) + 1}`;
  const session: any = {
    sessionId: `scale_session_${String(index).padStart(5, '0')}`,
    studentId: `student_${index % 100}`,
    researchId: `R-SCALE-${String(index % 100).padStart(3, '0')}`,
    classId,
    aiStudentId: 'emma_usa',
    personaId: 'emma_usa',
    topic: 'favorites',
    targetDurationMinutes: 2,
    actualDurationSeconds: 110,
    startedAt: new Date(started).toISOString(),
    endedAt: new Date(started + 110_000).toISOString(),
    schemaVersion: 4,
    formalStudyParticipant: true,
    studySiteId: 'site_a',
    schoolCondition: 'intervention',
    studyGradeLevel: 5,
    studyStartDate: '2026-09-17',
    personaLabelCondition: 'shown',
    countryLabelVisible: true,
    accentLabelVisible: true,
    flagVisible: true,
    ttsTelemetryVersion: 'cors-visible-v1',
    systemEvents: [{ type: 'session_start', timestamp: started }, { type: 'session_finish', value: 'timer', timestamp: started + 109_000 }],
    reflection: { scaleVersion: '4point-v1', conveyedIdeas: 3, understoodPartner: 3, noticedLanguageCulture: 3 },
  };
  if (includeHistory) {
    session.history = Array.from({ length: UTTERANCES_PER_SESSION }, (_, turn) => ({
      id: `m_${index}_${turn}`,
      sender: turn % 2 === 0 ? 'ai' : 'child',
      englishText: turn % 2 === 0 ? 'I like soccer. What do you like?' : 'I like soccer.',
      japaneseText: turn % 2 === 0 ? '私はサッカーが好きです。あなたは？' : '私はサッカーが好きです。',
      timestamp: started + turn * 8_000,
      wordCount: turn % 2 === 0 ? 7 : 3,
    }));
  }
  return session;
}

function normalizedRows(rows: Record<string, any>[], headers: readonly string[]) {
  return rows.map((row) => Object.fromEntries(headers.map((header) => [header, row[header] ?? ''])))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

const exportQuery = normalizeFormalResearchExportQuery({ dataScope: 'main', schoolCondition: 'intervention' });

// Equivalence audit: the streaming path must preserve the existing CSV contract.
const paritySessions = Array.from({ length: 30 }, (_, index) => largeSession(index, true));
const parityMetadata = Array.from({ length: 30 }, (_, index) => largeSession(index, false));
const parityPreparation = buildStreamingPreparationFromSessions(parityMetadata, [], '');
const legacy = filterResearchExportDataSets(buildResearchExportDataSets(paritySessions), exportQuery);
const streamedSessions = augmentSessionRowsWithPhase(
  buildFastStreamingSessionRowsForPage(paritySessions, parityPreparation, [], '', exportQuery),
  [],
);
const streamedUtterances = buildStreamingRowsForPage(paritySessions, parityPreparation, [], '', exportQuery, 'utterances');
const streamedExpressions = buildStreamingRowsForPage(paritySessions, parityPreparation, [], '', exportQuery, 'expressions');
assert.deepEqual(
  normalizedRows(streamedSessions, PHASE_SESSION_EXPORT_HEADERS),
  normalizedRows(augmentSessionRowsWithPhase(legacy.sessions, []), PHASE_SESSION_EXPORT_HEADERS),
  'streaming sessions.csv must preserve the legacy CSV contract',
);
assert.deepEqual(
  normalizedRows(streamedUtterances, RESEARCH_EXPORT_HEADERS.utterances),
  normalizedRows(legacy.utterances, RESEARCH_EXPORT_HEADERS.utterances),
  'streaming utterances.csv must preserve the legacy CSV contract',
);
assert.deepEqual(
  normalizedRows(streamedExpressions, RESEARCH_EXPORT_HEADERS.expressions),
  normalizedRows(legacy.expressions, RESEARCH_EXPORT_HEADERS.expressions),
  'streaming expressions.csv must preserve the legacy CSV contract',
);
console.log('Streaming export legacy-contract parity QA: PASS');

const scaleStartedAt = Date.now();
const rssBefore = process.memoryUsage().rss;
const metadata = Array.from({ length: LARGE_SESSION_COUNT }, (_, index) => largeSession(index, false));
const preparation = buildStreamingPreparationFromSessions(metadata, [], '');
const preparationElapsed = Date.now() - scaleStartedAt;
assert.equal(preparation.contextBySessionId.size, LARGE_SESSION_COUNT);
let peakRss = process.memoryUsage().rss;

let sessionRows = 0;
const sessionsStartedAt = Date.now();
for (let start = 0; start < LARGE_SESSION_COUNT; start += PAGE_SIZE) {
  const page = Array.from({ length: Math.min(PAGE_SIZE, LARGE_SESSION_COUNT - start) }, (_, offset) => largeSession(start + offset, true));
  const rows = buildFastStreamingSessionRowsForPage(page, preparation, [], '', exportQuery);
  sessionRows += rows.length;
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
}
const sessionsElapsed = Date.now() - sessionsStartedAt;
assert.equal(sessionRows, LARGE_SESSION_COUNT);
assert.ok(sessionsElapsed < 20_000, `10k session streaming transform too slow: ${sessionsElapsed}ms`);

let utteranceRows = 0;
let serializedBytes = 0;
const utterancesStartedAt = Date.now();
for (let start = 0; start < LARGE_SESSION_COUNT; start += PAGE_SIZE) {
  const page = Array.from({ length: Math.min(PAGE_SIZE, LARGE_SESSION_COUNT - start) }, (_, offset) => largeSession(start + offset, true));
  const rows = buildStreamingRowsForPage(page, preparation, [], '', exportQuery, 'utterances');
  utteranceRows += rows.length;
  for (const row of rows) {
    serializedBytes += Buffer.byteLength(serializeStreamingCsvRow(row, RESEARCH_EXPORT_HEADERS.utterances), 'utf8') + 1;
  }
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
}
const utterancesElapsed = Date.now() - utterancesStartedAt;
assert.equal(utteranceRows, LARGE_SESSION_COUNT * UTTERANCES_PER_SESSION);
assert.ok(serializedBytes > 1_000_000, '100k utterance CSV payload should exceed 1MB');
assert.ok(utterancesElapsed < 20_000, `100k utterance streaming transform too slow: ${utterancesElapsed}ms`);

let expressionRows = 0;
const expressionsStartedAt = Date.now();
for (let start = 0; start < LARGE_SESSION_COUNT; start += PAGE_SIZE) {
  const page = Array.from({ length: Math.min(PAGE_SIZE, LARGE_SESSION_COUNT - start) }, (_, offset) => largeSession(start + offset, true));
  const rows = buildStreamingRowsForPage(page, preparation, [], '', exportQuery, 'expressions');
  expressionRows += rows.length;
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
}
const expressionsElapsed = Date.now() - expressionsStartedAt;
assert.ok(expressionRows >= LARGE_SESSION_COUNT, `expected expression rows, got ${expressionRows}`);
assert.ok(expressionsElapsed < 30_000, `100k utterance expression transform too slow: ${expressionsElapsed}ms`);

const scaleElapsed = Date.now() - scaleStartedAt;
const rssIncreaseMiB = (peakRss - rssBefore) / 1024 / 1024;
assert.ok(rssIncreaseMiB < 384, `100k utterance streaming RSS increase too high: ${rssIncreaseMiB.toFixed(1)} MiB`);
assert.ok(scaleElapsed < 55_000, `combined 100k export transforms too slow: ${scaleElapsed}ms`);
console.log(`10,000 sessions / 100,000 utterances full streaming QA: PASS (prep ${preparationElapsed}ms, sessions ${sessionsElapsed}ms, utterances ${utterancesElapsed}ms, expressions ${expressionsElapsed}ms, total ${scaleElapsed}ms, +${rssIncreaseMiB.toFixed(1)} MiB RSS, expressions ${expressionRows})`);
