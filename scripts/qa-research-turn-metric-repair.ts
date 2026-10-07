import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  auditResearchTurnMetricRows,
  deriveDialogueTurnMetricsFromStoredHistory,
} from '../src/server/researchTurnMetricRepair';

const legacy = {
  sessionId:'legacy-session',
  aiStudentId:'emma_usa',
  totalTurns:3,
  history:[
    { sender:'ai', englishText:'Hello!' },
    { sender:'child', englishText:'Hello.' },
    { sender:'ai', englishText:'What do you like?' },
    { sender:'child', englishText:'I like soccer.' },
    { sender:'ai', englishText:'Me too. How about school?' },
    { sender:'child', englishText:'I like English.' },
    { sender:'ai', englishText:'Great!' },
  ],
};

assert.deepEqual(
  deriveDialogueTurnMetricsFromStoredHistory(legacy),
  { childTurns:3, aiTurns:4, dialogueTurns:7 },
  'legacy turn repair must count exact stored child + AI utterances',
);

const audit = auditResearchTurnMetricRows([
  legacy,
  {
    ...legacy,
    sessionId:'exact-session',
    aiTurnCount:4,
    dialogueUtteranceCount:7,
  },
  {
    sessionId:'history-missing',
    aiStudentId:'oliver_uk',
    totalTurns:3,
  },
  {
    sessionId:'child-mismatch',
    aiStudentId:'liam_australia',
    totalTurns:4,
    history:legacy.history,
  },
  {
    sessionId:'not-research',
    aiStudentId:'not-a-persona',
    totalTurns:3,
    history:legacy.history,
  },
]);

assert.equal(audit.researchSessions, 4);
assert.equal(audit.exactExisting, 1);
assert.equal(audit.repairableFromHistory, 1);
assert.equal(audit.unavailableHistoryMissing, 1);
assert.equal(audit.unavailableChildMismatch, 1);
assert.equal(audit.wouldPatch, 3);

const runner = fs.readFileSync('scripts/run-research-daily-aggregate-backfill.ts', 'utf8');
assert.ok(
  runner.indexOf('repairResearchTurnMetricsFromStoredHistory()')
    < runner.indexOf('backfillResearchDailyAggregates()'),
  'historical exact turn repair must run before aggregate rebuild',
);
assert.ok(
  runner.includes('result.turnSeriesParity?.matches'),
  'one-shot production gate must require class turn/min series parity',
);

const persistence = fs.readFileSync('src/server/persistence.ts', 'utf8');
assert.ok(
  persistence.includes("dialogueTurnMetricSource: 'canonical_history_v1'"),
  'new canonical sessions must label exact history-derived turn metrics',
);

console.log('Research historical dialogue-turn repair QA: PASS');
