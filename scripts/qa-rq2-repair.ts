import assert from 'node:assert/strict';
import { buildRepairCandidateAudit, canonicalRepairAttributes, detectRepairCandidate } from '../src/server/researchRepair';

const fortnite = detectRepairCandidate({
  sequenceId: 'fortnite',
  previousAiEnglish: 'Okay, have fun playing tonight!',
  childEnglish: 'No no. I play fortnite.',
  nextAiEnglish: 'Oh, Fortnite! That is a popular game.',
});
assert.equal(fortnite.candidate, true);
assert.ok(fortnite.candidateTypes.includes('third_position'));
assert.equal(fortnite.suggestedFunction, 'REP');
assert.equal(fortnite.suggestedRepairSubtype, 'third_position');

const ordinaryNo = detectRepairCandidate({
  sequenceId: 'ordinary-no',
  previousAiEnglish: 'Do you like soccer?',
  childEnglish: 'No. I like baseball.',
  nextAiEnglish: 'Baseball is fun!',
});
assert.equal(ordinaryNo.candidateTypes.includes('third_position'), false);

const trouble = detectRepairCandidate({
  sequenceId: 'trouble',
  previousAiEnglish: "Sorry, I don't understand. Can you say that again?",
  childEnglish: 'I play soccer.',
  nextAiEnglish: 'Oh, soccer!',
});
assert.ok(trouble.candidateTypes.includes('response_to_trouble'));
assert.equal(trouble.suggestedRepairSubtype, 'response_to_trouble');

const comp = detectRepairCandidate({ previousAiEnglish: 'I like hiking.', childEnglish: 'Pardon?', nextAiEnglish: 'Hiking means walking in nature.' });
assert.ok(comp.candidateTypes.includes('comprehension_request'));
assert.equal(comp.suggestedFunction, 'COMP');

assert.deepEqual(canonicalRepairAttributes('REP', {
  repairSubtype: 'third_position', repairOutcome: 'resolved', technologyInvolvement: 'unclear',
}, true), {
  repairSubtype: 'third_position', repairOutcome: 'resolved', technologyInvolvement: 'unclear', invalid: [],
});
assert.throws(() => canonicalRepairAttributes('REP', { repairSubtype: 'third_position' }, true), /RQ2_INVALID_REPAIR_ATTRIBUTE/);
assert.deepEqual(canonicalRepairAttributes('RES', {}, true), { repairSubtype: '', repairOutcome: '', technologyInvolvement: '', invalid: [] });

const audit = buildRepairCandidateAudit([fortnite, ordinaryNo, trouble, comp]);
assert.equal(audit.totalSequences, 4);
assert.equal(audit.thirdPositionCandidates, 1);
assert.equal(audit.responseToTroubleCandidates, 1);
assert.equal(audit.comprehensionRequestCandidates, 1);
console.log('RQ2 repair coding QA: PASS');
