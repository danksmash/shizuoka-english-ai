import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildResearchDataSets } from '../src/server/researchExport';
import { validateSessionSaveInput } from '../src/dataContract';
import { normalizeFormalResearchExportQuery } from '../src/server/researchDashboard';
import {
  buildStreamingPreparationFromSessions,
  buildStreamingRowsForPage,
  serializeStreamingCsvRow,
} from '../src/server/researchStreamingExportRuntime';

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
      englishText: turn % 2 === 0 ? 'Hello. How are you?' : 'I am fine.',
      japaneseText: turn % 2 === 0 ? 'こんにちは。元気ですか。' : '元気です。',
      timestamp: started + turn * 8_000,
      wordCount: turn % 2 === 0 ? 4 : 3,
    }));
  }
  return session;
}

const scaleStartedAt = Date.now();
const rssBefore = process.memoryUsage().rss;
const metadata = Array.from({ length: LARGE_SESSION_COUNT }, (_, index) => largeSession(index, false));
const preparation = buildStreamingPreparationFromSessions(metadata, [], '');
assert.equal(preparation.contextBySessionId.size, LARGE_SESSION_COUNT);
const exportQuery = normalizeFormalResearchExportQuery({ dataScope: 'main', schoolCondition: 'intervention' });
let utteranceRows = 0;
let serializedBytes = 0;
let peakRss = process.memoryUsage().rss;
for (let start = 0; start < LARGE_SESSION_COUNT; start += PAGE_SIZE) {
  const page = Array.from({ length: Math.min(PAGE_SIZE, LARGE_SESSION_COUNT - start) }, (_, offset) => largeSession(start + offset, true));
  const rows = buildStreamingRowsForPage(page, preparation, [], '', exportQuery, 'utterances');
  utteranceRows += rows.length;
  for (const row of rows) {
    serializedBytes += Buffer.byteLength(serializeStreamingCsvRow(row, [
      'research_id','site_id','school_condition','formal_study_participant','study_start_date','class_id','session_id','utterance_id','persona_id','topic',
      'turn_sequence','speaker_turn_number','speaker','local_timestamp','english_text_anonymized','japanese_translation',
      'is_question','question_type','is_reciprocal_question','is_repair','is_reason_expression',
    ]), 'utf8') + 1;
  }
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
}
const scaleElapsed = Date.now() - scaleStartedAt;
assert.equal(utteranceRows, LARGE_SESSION_COUNT * UTTERANCES_PER_SESSION);
assert.ok(serializedBytes > 1_000_000, '100k utterance CSV payload should exceed 1MB');
const rssIncreaseMiB = (peakRss - rssBefore) / 1024 / 1024;
assert.ok(rssIncreaseMiB < 384, `100k utterance streaming RSS increase too high: ${rssIncreaseMiB.toFixed(1)} MiB`);
assert.ok(scaleElapsed < 60_000, `100k utterance streaming transform too slow: ${scaleElapsed}ms`);
console.log(`10,000 sessions / 100,000 utterances streaming QA: PASS (${scaleElapsed}ms, +${rssIncreaseMiB.toFixed(1)} MiB RSS)`);
