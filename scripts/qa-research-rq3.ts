import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildInteractionCodeRows,
  buildRq3Distribution,
  referenceModelCode,
} from '../src/server/researchRq3Analysis';

assert.equal(referenceModelCode('B2a'), 'B2');
assert.equal(referenceModelCode('B2b'), 'B2');
assert.equal(referenceModelCode('B3'), 'B3');

const items = [
  {
    runId: 'rq3-test',
    sequenceId: 's1',
    schoolCondition: 'intervention',
    analysisPeriod: 'period1',
    researchId: 'R1',
    participantKey: 'site:R1',
    siteId: 'site',
    classId: '5-1',
    gradeLevel: 5,
    sessionId: 'session-1',
    localDate: '2026-09-17',
    studyPhase: 'phase1',
    topic: 'free',
    personaId: 'emma_usa',
    childUtteranceId: 'u1',
    childTurnSequence: 2,
    previousAiEnglish: 'What do you like?',
    childEnglish: 'I like soccer.',
    nextAiEnglish: 'Nice.',
    humanStatus: 'confirmed',
    humanReferencePrimary: 'B2a',
    humanReferenceAuxCodes: [],
    humanFunctionPrimary: 'RES',
    humanFunctionAuxCodes: [],
    humanCoder: 'A',
    humanCodedAt: '2026-09-21T00:00:00.000Z',
  },
  {
    runId: 'rq3-test',
    sequenceId: 's2',
    schoolCondition: 'intervention',
    analysisPeriod: 'period2',
    researchId: 'R1',
    participantKey: 'site:R1',
    siteId: 'site',
    classId: '5-1',
    gradeLevel: 5,
    sessionId: 'session-2',
    localDate: '2026-09-25',
    studyPhase: 'phase2',
    topic: 'free',
    personaId: 'emma_usa',
    childUtteranceId: 'u2',
    childTurnSequence: 2,
    previousAiEnglish: 'I am from the USA.',
    childEnglish: 'Do you like baseball?',
    nextAiEnglish: 'Yes.',
    humanStatus: 'modified',
    humanReferencePrimary: 'B2b',
    humanReferenceAuxCodes: ['B3'],
    humanFunctionPrimary: 'Q',
    humanFunctionAuxCodes: ['TOP'],
    humanCoder: 'A',
    humanCodedAt: '2026-09-21T00:00:00.000Z',
  },
  {
    runId: 'rq3-test',
    sequenceId: 's3',
    schoolCondition: 'comparison',
    analysisPeriod: 'period1',
    researchId: 'R2',
    participantKey: 'site2:R2',
    siteId: 'site2',
    classId: '5-C1',
    gradeLevel: 5,
    sessionId: 'session-3',
    localDate: '2026-09-17',
    studyPhase: '',
    topic: 'free',
    personaId: 'emma_usa',
    childUtteranceId: 'u3',
    childTurnSequence: 2,
    previousAiEnglish: 'What do you like?',
    childEnglish: 'Soccer.',
    nextAiEnglish: 'Nice.',
    humanStatus: 'pending',
  },
];

const distribution = buildRq3Distribution(items);
assert.equal(distribution.confirmedN, 2);
assert.equal(distribution.pendingN, 1);
const interventionP1 = distribution.strata.find((row) => row.schoolCondition === 'intervention' && row.analysisPeriod === 'period1')!;
const interventionP2 = distribution.strata.find((row) => row.schoolCondition === 'intervention' && row.analysisPeriod === 'period2')!;
assert.equal(interventionP1.referenceRaw.counts.B2a, 1);
assert.equal(interventionP1.referenceModel.counts.B2, 1);
assert.equal(interventionP2.referenceRaw.counts.B2b, 1);
assert.equal(interventionP2.referenceModel.counts.B2, 1);
assert.equal(interventionP2.functions.counts.Q, 1);

const rows = buildInteractionCodeRows(items, { runId: 'rq3-test', codebookVersion: 'rq2-v4' });
assert.equal(rows.length, 3);
assert.equal(rows[0].reference_primary_raw, 'B2a');
assert.equal(rows[0].reference_primary_model, 'B2');
assert.equal(rows[1].reference_primary_raw, 'B2b');
assert.equal(rows[1].reference_primary_model, 'B2');
assert.equal(rows[1].reference_aux_labels, 'B3');
assert.equal(rows[1].function_aux_labels, 'TOP');
assert.equal(rows[1].human_codebook_version, 'rq2-v4');
assert.equal(rows[2].analysis_ready, 0);
assert.equal(rows[2].reference_primary_raw, '');

const entry = fs.readFileSync('server-entry.ts', 'utf8');
const auth = fs.readFileSync('src/server/auth.ts', 'utf8');
const page = fs.readFileSync('public/research-rq3.html', 'utf8');
const routes = fs.readFileSync('src/server/researchRq3Routes.ts', 'utf8');
const analysisSessions = fs.readFileSync('src/server/researchAnalysisSessions.ts', 'utf8');
const rq2Ai = fs.readFileSync('src/server/researchRq2Ai.ts', 'utf8');

assert.ok(entry.includes('createResearchRq3Router'));
assert.ok(auth.includes("path.startsWith('/research-rq3')"));
assert.ok(page.includes('RQ3 類型分布分析'));
assert.ok(page.includes('analysis_sessions.csv'));
assert.ok(page.includes('interaction_codes.csv'));
assert.ok(page.includes('RQ2・RQ3分析用ZIP'));
assert.ok(page.includes('前後文脈'));
assert.ok(routes.includes('/research-rq3/create-run'));
assert.ok(routes.includes('RQ3_CODEBOOK_SCHEMA_OUTDATED'));
assert.ok(routes.includes('schemaVersion || 0) < 4');
assert.ok(routes.includes('row.codebookVersion'));
assert.ok(routes.includes('/research-rq3/ai-code'));
assert.ok(routes.includes('/research-rq3/human-code'));
assert.ok(routes.includes('/research-rq3/analysis.bundle.zip'));
assert.ok(routes.includes('rq2_reliability.csv'));
assert.ok(analysisSessions.includes('analysis_included_default'));
assert.ok(analysisSessions.includes('analysis_decision_source'));
assert.ok(analysisSessions.includes('hardExclusionReason'));
assert.ok(rq2Ai.includes("promptVersion = 'rq2-coding-prompt-v4'"));
assert.ok(rq2Ai.includes('referencePriorityRule'));
assert.ok(rq2Ai.includes('functionBoundaryRule'));
assert.equal(rq2Ai.includes('stratum: String(item.stratum'), false, 'AI coding must not receive study stratum/Phase');

console.log('RQ3 typology analysis QA: PASS');
