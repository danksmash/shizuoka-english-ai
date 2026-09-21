import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  RQ2_STRATA,
  sampleRq2Candidates,
  type Rq2Candidate,
} from '../src/server/researchRq2Sampling';
import { buildRq2Analysis, buildRq2ReliabilitySummary } from '../src/server/researchRq2Analysis';
import { DEFAULT_RQ2_CODEBOOK, RQ2_CODEBOOK_SCHEMA_VERSION, rq2CanonicalizeCodes } from '../src/server/researchRq2Codebook';
import {
  assertRq2RunActive,
  assertRq2SamplingConfirmation,
  rq2FormalSamplingReady,
  rq2SamplingShortfalls,
  summarizeRq2RunProgress,
} from '../src/server/researchRq2RunGuard';

const candidates: Rq2Candidate[] = [];
for (const stratum of RQ2_STRATA) {
  for (let participant = 1; participant <= 25; participant += 1) {
    for (let sequence = 1; sequence <= 3; sequence += 1) {
      candidates.push({
        sequenceId: `${stratum}-P${participant}-S${sequence}`,
        stratum,
        researchId: `R${stratum.slice(-1)}${String(participant).padStart(2,'0')}`,
        classId: '5-1',
        sessionId: `session-${stratum}-${participant}`,
        localDate: '2026-09-21',
        lessonContext: 'in_lesson',
        topic: 'free',
        personaId: 'emma_usa',
        childUtteranceId: `u-${sequence}`,
        childTurnSequence: sequence,
        previousAiEnglish: 'What do you like?',
        childEnglish: 'I like soccer.',
        nextAiEnglish: 'Nice!',
      });
    }
  }
}
const first = sampleRq2Candidates(candidates, 'RQ2-2026-v1', 50, 2);
const second = sampleRq2Candidates(candidates, 'RQ2-2026-v1', 50, 2);
assert.equal(first.items.length, 300);
assert.deepEqual(first.items.map((x) => x.sequenceId), second.items.map((x) => x.sequenceId));
assert.equal(new Set(first.items.map((x) => x.sequenceId)).size, 300);
for (const stratum of RQ2_STRATA) {
  const rows = first.items.filter((x) => x.stratum === stratum);
  assert.equal(rows.length, 50);
  const perStudent = new Map<string, number>();
  for (const row of rows) perStudent.set(row.researchId, (perStudent.get(row.researchId) || 0) + 1);
  assert.ok([...perStudent.values()].every((count) => count <= 2));
  assert.equal(rows.filter((x) => x.purpose === 'codebook_development').length, 20);
  assert.equal(rows.filter((x) => x.purpose === 'reliability').length, 10);
  assert.equal(rows.filter((x) => x.purpose === 'main_other').length, 20);
}
assert.equal(first.items.filter((x) => x.purpose === 'codebook_development').length, 120);
assert.equal(first.items.filter((x) => x.purpose === 'reliability').length, 60);
assert.equal(first.items.filter((x) => x.purpose === 'main_other').length, 120);

assert.equal(rq2FormalSamplingReady(first.counts), true);
assert.deepEqual(rq2SamplingShortfalls(first.counts), []);
assert.doesNotThrow(() => assertRq2SamplingConfirmation({
  runType:'trial',
  acknowledged:true,
  counts:first.counts,
}));
assert.doesNotThrow(() => assertRq2SamplingConfirmation({
  runType:'formal',
  acknowledged:true,
  confirmText:'正式抽出',
  counts:first.counts,
}));
assert.throws(() => assertRq2SamplingConfirmation({
  runType:'formal',
  acknowledged:true,
  confirmText:'',
  counts:first.counts,
}), /RQ2_FORMAL_CONFIRM_TEXT_REQUIRED/);
const incompleteCounts = { ...first.counts, intervention_phase1: { ...first.counts.intervention_phase1, selected: 49, shortfall: 1 } };
assert.equal(rq2FormalSamplingReady(incompleteCounts), false);
assert.throws(() => assertRq2SamplingConfirmation({
  runType:'formal',
  acknowledged:true,
  confirmText:'正式抽出',
  counts:incompleteCounts,
}), /RQ2_FORMAL_SAMPLE_INCOMPLETE/);
assert.doesNotThrow(() => assertRq2RunActive({ status:'sampled' }));
assert.throws(() => assertRq2RunActive({ status:'invalidated' }), /RQ2_RUN_INVALIDATED/);
assert.deepEqual(summarizeRq2RunProgress([
  { aiStatus:'coded', humanStatus:'pending' },
  { aiStatus:'pending', humanStatus:'modified' },
], [{ coderKey:'A' }]), {
  aiCoded:1,
  humanConfirmed:1,
  reliabilityRecords:1,
  hasDownstreamWork:true,
});

const referenceCodes = DEFAULT_RQ2_CODEBOOK.referenceBasis.map((row) => row.code);
assert.deepEqual(referenceCodes, ['B0','B1','B2a','B2b','B3','B4']);
assert.equal(RQ2_CODEBOOK_SCHEMA_VERSION, 4);
assert.equal(DEFAULT_RQ2_CODEBOOK.developmentStatus, 'literature_draft');
assert.deepEqual(DEFAULT_RQ2_CODEBOOK.interactionFunction.map((row) => row.code), ['ACK','RES','Q','TOP','COMP','REP']);
assert.equal(DEFAULT_RQ2_CODEBOOK.interactionFunction.find((row) => row.code === 'ACK')?.label, '反応・傾聴表示');
assert.ok(DEFAULT_RQ2_CODEBOOK.referenceBasis.find((row) => row.code === 'B3')?.boundaryRule.includes('直前ターンが存在する'));
assert.ok(DEFAULT_RQ2_CODEBOOK.references.some((row) => row.id === 'LAM2018'));
assert.ok(DEFAULT_RQ2_CODEBOOK.references.some((row) => row.id === 'YAMAGUCHIYOSHIZAWA2023'));
assert.deepEqual(DEFAULT_RQ2_CODEBOOK.recipientLocus.map((row) => row.code), ['現在のAI','将来の実在留学生','AIと実在他者を橋渡し','判定不能']);
assert.deepEqual(rq2CanonicalizeCodes(DEFAULT_RQ2_CODEBOOK, 'function', ['A-SD']).valid, ['RES']);
assert.deepEqual(rq2CanonicalizeCodes(DEFAULT_RQ2_CODEBOOK, 'function', ['T']).valid, ['TOP']);
assert.deepEqual(rq2CanonicalizeCodes(DEFAULT_RQ2_CODEBOOK, 'function', ['U']).valid, ['COMP']);
assert.deepEqual(rq2CanonicalizeCodes(DEFAULT_RQ2_CODEBOOK, 'function', ['R']).valid, ['REP']);
assert.deepEqual(rq2CanonicalizeCodes(DEFAULT_RQ2_CODEBOOK, 'function', ['E']).valid, []);

const reliability = buildRq2ReliabilitySummary([
  { runId:'r', sequenceId:'s1', coderKey:'A', referenceCodes:['B3'], functionCodes:['Q'], recipientLocus:['現在のAI'] },
  { runId:'r', sequenceId:'s1', coderKey:'B', referenceCodes:['B3'], functionCodes:['Q'], recipientLocus:['現在のAI'] },
  { runId:'r', sequenceId:'s2', coderKey:'A', referenceCodes:['B0'], functionCodes:['RES'], recipientLocus:['現在のAI'] },
  { runId:'r', sequenceId:'s2', coderKey:'B', referenceCodes:['B0'], functionCodes:['RES'], recipientLocus:['現在のAI'] },
]);
assert.equal(reliability.commonItems, 2);
assert.equal(reliability.reference.agreement, 100);
assert.equal(reliability.reference.kappa, 1);
assert.equal(reliability.function.agreement, 100);
assert.equal(reliability.function.kappa, 1);

const analysis = buildRq2Analysis([
  { stratum:'intervention_phase1', aiStatus:'coded', aiReferenceCodes:['B3'], aiFunctionCodes:['Q'], aiRecipientLocus:[], aiNeedsReview:false, humanStatus:'pending' },
  { stratum:'intervention_phase1', aiStatus:'coded', aiReferenceCodes:['B2a'], aiFunctionCodes:['RES'], aiRecipientLocus:['現在のAI'], aiNeedsReview:false, humanStatus:'modified', humanReferenceCodes:['B1'], humanFunctionCodes:['Q'], humanRecipientLocus:[] },
]);
const interventionPhase1 = analysis.strata.find((row) => row.stratum === 'intervention_phase1')!;
assert.equal(interventionPhase1.aiCandidateReferenceCodes.B3, 1);
assert.equal(interventionPhase1.aiCandidateReferenceCodes.B2a, 1);
assert.equal(interventionPhase1.finalReferenceCodes.B1, 1);
assert.equal(interventionPhase1.finalReferenceCodes.B3, undefined);
assert.equal(interventionPhase1.humanConfirmed, 1);
assert.equal(interventionPhase1.finalPending, 1);

const entry = fs.readFileSync('server-entry.ts','utf8');
const auth = fs.readFileSync('src/server/auth.ts','utf8');
const page = fs.readFileSync('public/research-rq2.html','utf8');
const management = fs.readFileSync('src/server/managementPage.ts','utf8');
const routes = fs.readFileSync('src/server/researchRq2Routes.ts','utf8');
const persistence = fs.readFileSync('src/server/researchRq2Persistence.ts','utf8');
assert.ok(entry.includes('createResearchRq2Router'));
assert.ok(auth.includes("path.startsWith('/research-rq2')"));
assert.ok(page.includes('比較校 対応期間1') || page.includes('比較校は同じ相対経過時点'));
assert.ok(page.includes('次の20系列をAI候補コード化'));
assert.ok(page.includes('一致度用60'));
assert.ok(page.includes('正式集計は人間確認済みコードのみ'));
assert.ok(page.includes('参照基盤・主コード'));
assert.ok(page.includes('文献根拠型コードブック v1'));
assert.ok(page.includes('開発用120系列'));
assert.ok(page.includes('一致度用60系列'));
assert.ok(page.includes('ACK / RES / Q / TOP / COMP / REP'));
assert.ok(page.includes('対話機能・主コード'));
assert.ok(page.includes('reliability.csv'));
assert.ok(page.includes('AI候補（未確定）'));
assert.ok(page.includes('抽出を無効にして再抽出'));
assert.ok(page.includes('正式抽出'));
assert.ok(page.includes('試験抽出'));
assert.ok(page.includes('抽出をリセット'));
assert.ok(routes.includes('/research-rq2/sample-preview'));
assert.ok(routes.includes('/research-rq2/reset'));
assert.ok(routes.includes('/research-rq2/reliability.csv'));
assert.ok(routes.includes('humanReferencePrimary'));
assert.ok(routes.includes('humanFunctionPrimary'));
assert.ok(routes.includes('humanCodebookVersion'));
assert.ok(routes.includes('codebook_version'));
assert.ok(routes.includes('RQ2_ACTIVE_FORMAL_RUN_EXISTS'));
assert.ok(routes.includes('assertRq2RunActive(run)'));
assert.ok(persistence.includes("status: 'invalidated'"));
assert.ok(persistence.includes('runType: args.runType'));
assert.ok(persistence.includes("promptVersion: 'rq2-coding-prompt-v4'"));
const codebookDoc = fs.readFileSync('docs/research/rq2-codebook-literature-v1.md','utf8');
assert.ok(codebookDoc.includes('演繹的手続き'));
assert.ok(codebookDoc.includes('Lam (2018)'));
assert.ok(codebookDoc.includes('B3の重要な限定'));
assert.ok(codebookDoc.includes('ACK | 反応・傾聴表示'));
assert.ok(management.includes('/research-rq2.html'));
assert.ok(management.includes('/research-rq3.html'));
console.log('RQ2 code analysis QA: PASS');
