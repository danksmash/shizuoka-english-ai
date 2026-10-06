import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  RQ1_ANALYSIS_SPEC,
  RQ1_CHOICE_HEADERS,
  buildRq1ChoiceRows,
  buildRq1PeriodSummaryRows,
  buildRq1TransitionRows,
  type Rq1AnalysisParticipant,
} from '../src/server/researchRq1Analysis';
import {
  RQ1_COMPARISON_ALLOCATION_ALGORITHM_VERSION,
  RQ1_COMPARISON_ALLOCATION_METHOD,
  buildRq1AllocationInputHash,
  buildRq1ComparisonAllocationPlan,
  type Rq1AllocationParticipant,
} from '../src/server/researchRq1Allocation';
import type { StudyScheduleRecord } from '../src/server/studySchedulePersistence';

const schedule: StudyScheduleRecord = {
  classId: '5-1',
  revision: 1,
  appStartDate: '2026-09-17',
  nationalityRevealDate: '2026-09-20',
  announcedVisitorCountries: ['United States','United Kingdom'],
  announcedVisitorCountryCounts: { 'United States': 1, 'United Kingdom': 1 },
  videoViewDate: '2026-09-23',
  assignmentRevealDate: '2026-09-23',
  exchangeDate: '2026-09-30',
  updatedAt: '2026-09-16T00:00:00Z',
  updatedBy: 'qa',
  history: [],
};

const participant: Rq1AnalysisParticipant = {
  researchId: 'R-QA001',
  siteId: 'site_a',
  schoolCondition: 'intervention',
  classId: '5-1',
  gradeLevel: 5,
  targetCountry: 'United Kingdom',
  visitorCountries: ['United States','United Kingdom'],
  visitorSetSource: 'intervention_class_schedule',
};

function session(
  id: string,
  date: string,
  aiStudentId: 'emma_usa' | 'oliver_uk' | 'rahul_bangladesh',
  child = true,
) {
  const startedAt = `${date}T09:00:00+09:00`;
  const endedAt = `${date}T09:01:00+09:00`;
  return {
    sessionId: id,
    studentId: 'student-qa',
    researchId: participant.researchId,
    classId: '5-1',
    aiStudentId,
    topic: 'intro',
    targetDurationMinutes: 1,
    startedAt,
    endedAt,
    history: [
      { id: `${id}-a`, sender: 'ai', englishText: 'Hello!', japaneseText: 'こんにちは', timestamp: Date.parse(startedAt) },
      ...(child ? [{ id: `${id}-c`, sender: 'child', englishText: 'Hello.', japaneseText: '', timestamp: Date.parse(startedAt) + 10_000, wordCount: 1 }] : []),
    ],
    systemEvents: child ? [{ type: 'session_finish', value: 'timer', timestamp: Date.parse(endedAt) }] : [],
    reflection: child ? { scaleVersion: '4point-v1', understoodPartner: 3, conveyedIdeas: 3, noticedLanguageCulture: 3 } : null,
    formalStudyParticipant: true,
    studySiteId: 'site_a',
    schoolCondition: 'intervention',
    studyStartDate: '2026-09-17',
  };
}

const rawSessions = [
  session('s-p1-a', '2026-09-18', 'rahul_bangladesh'),
  session('s-p1-short', '2026-09-19', 'emma_usa', false),
  session('s-p2-a', '2026-09-21', 'emma_usa'),
  session('s-p3-a', '2026-09-24', 'oliver_uk'),
  session('s-p3-b', '2026-09-25', 'oliver_uk'),
];

const analysisSessionRows = rawSessions.map((row, index) => ({
  session_id: row.sessionId,
  lesson_context_final: 'in_lesson',
  analysis_included: index === 1 ? 0 : 1,
  dialogue_analysis_included: index === 1 ? 0 : 1,
}));

const choices = buildRq1ChoiceRows({
  rawSessions,
  schedules: [schedule],
  analysisSessionRows,
  participants: [participant],
});
assert.equal(choices.length, 5);
for (const field of [
  'visitor_country_set','visitor_match','assigned_target_country',
  'assignment_known_to_learner','assigned_target_reference_match','assigned_target_exposed_match',
  'raw_selection_included','effective_selection_included','child_turn_count',
]) assert.ok(RQ1_CHOICE_HEADERS.includes(field as any));

const p1First = choices.find((row) => row.session_id === 's-p1-a')!;
assert.equal(p1First.persona_country, 'Bangladesh');
assert.equal(p1First.visitor_country_set, 'United Kingdom|United States');
assert.equal(p1First.visitor_match, 0);
assert.equal(p1First.assigned_target_country, 'United Kingdom');
assert.equal(p1First.assigned_target_reference_match, 0);
assert.equal(p1First.assignment_known_to_learner, 0);
assert.equal(p1First.assigned_target_exposed_match, '');
assert.equal(p1First.target_match, 0);
assert.equal(p1First.analysis_period, 'period1');
assert.equal(p1First.study_phase, 'phase1');

const short = choices.find((row) => row.session_id === 's-p1-short')!;
assert.equal(short.raw_selection_included, 1);
assert.equal(short.effective_selection_included, 0);
assert.equal(short.selection_included, 0);
assert.equal(short.selection_exclusion_reason, 'no_child_utterance');

const p2 = choices.find((row) => row.session_id === 's-p2-a')!;
assert.equal(p2.visitor_match, 1);
assert.equal(p2.assigned_target_reference_match, 0);
assert.equal(p2.assignment_known_to_learner, 0);
assert.equal(p2.assigned_target_exposed_match, '');
assert.equal(p2.analysis_period, 'period2');
assert.equal(p2.study_phase, 'phase2');

const p3 = choices.find((row) => row.session_id === 's-p3-a')!;
assert.equal(p3.visitor_match, 1);
assert.equal(p3.assigned_target_reference_match, 1);
assert.equal(p3.assignment_known_to_learner, 1);
assert.equal(p3.assigned_target_exposed_match, 1);
assert.equal(p3.analysis_period, 'period3');
assert.equal(p3.study_phase, 'phase3');

const summaries = buildRq1PeriodSummaryRows(choices, [participant]);
assert.equal(summaries.length, 3);
const sum1 = summaries.find((row) => row.analysis_period === 'period1')!;
assert.equal(sum1.visitor_choice_denominator, 1);
assert.equal(sum1.visitor_choice_numerator, 0);
assert.equal(sum1.assigned_choice_numerator, 0);

const sum2 = summaries.find((row) => row.analysis_period === 'period2')!;
assert.equal(sum2.visitor_choice_numerator, 1);
assert.equal(sum2.assigned_choice_numerator, 0);

const sum3 = summaries.find((row) => row.analysis_period === 'period3')!;
assert.equal(sum3.visitor_choice_numerator, 2);
assert.equal(sum3.assigned_choice_numerator, 2);
assert.equal(sum3.visitor_continuation_denominator, 1);
assert.equal(sum3.visitor_continuation_numerator, 1);
assert.equal(sum3.assigned_continuation_denominator, 1);
assert.equal(sum3.assigned_continuation_numerator, 1);
assert.equal(sum3.distinct_persona_count, 1);
assert.equal(sum3.distinct_country_count, 1);
assert.equal(sum3.selection_entropy_bits, 0);

const transitions = buildRq1TransitionRows(choices, [participant]);
assert.equal(transitions.length, 1);
const transition = transitions[0];
assert.equal(transition.visitor_baseline_eligible, 1);
assert.equal(transition.visitor_period2_observed, 1);
assert.equal(transition.visitor_transition_by_period2, 1);
assert.equal(transition.visitor_first_transition_session_id, 's-p2-a');
assert.equal(transition.assigned_baseline_eligible, 1);
assert.equal(transition.assigned_period3_observed, 1);
assert.equal(transition.assigned_transition_by_period3, 1);
assert.equal(transition.assigned_first_transition_session_id, 's-p3-a');

assert.ok(RQ1_ANALYSIS_SPEC.visitorCountryRule.intervention.includes('raw session'));
assert.ok(RQ1_ANALYSIS_SPEC.assignedCountryRule.intervention.includes('period2'));
assert.ok(RQ1_ANALYSIS_SPEC.choiceUnit.includes('child_turn_count>=1'));
assert.ok(RQ1_ANALYSIS_SPEC.inclusion.rawSensitivity.includes('全開始選択'));
assert.ok(RQ1_ANALYSIS_SPEC.personaConfounding.includes('個別補正しない'));
assert.ok(RQ1_ANALYSIS_SPEC.continuation.visitor.includes('来校国籍群'));
assert.ok(RQ1_ANALYSIS_SPEC.continuation.assigned.includes('担当国'));
assert.equal(RQ1_ANALYSIS_SPEC.primaryModels.rq1a.dependent, 'visitor_match');
assert.equal(RQ1_ANALYSIS_SPEC.primaryModels.rq1b.dependent, 'assigned_target_reference_match');

const allocationParticipants: Rq1AllocationParticipant[] = [
  { researchId: 'R-I5A', siteId: 'site_a', schoolCondition: 'intervention', classId: '5-1', gradeLevel: 5, assignedPartnerCountry: 'United States' },
  { researchId: 'R-I6A', siteId: 'site_a', schoolCondition: 'intervention', classId: '6-1', gradeLevel: 6, assignedPartnerCountry: 'United States' },
  { researchId: 'R-I6B', siteId: 'site_a', schoolCondition: 'intervention', classId: '6-2', gradeLevel: 6, assignedPartnerCountry: 'United States' },
  { researchId: 'R-I6C', siteId: 'site_a', schoolCondition: 'intervention', classId: '6-3', gradeLevel: 6, assignedPartnerCountry: 'United Kingdom' },
  { researchId: 'R-C6A', siteId: 'site_b', schoolCondition: 'comparison', classId: '6-C1', gradeLevel: 6, assignedPartnerCountry: '' },
  { researchId: 'R-C6B', siteId: 'site_b', schoolCondition: 'comparison', classId: '6-C1', gradeLevel: 6, assignedPartnerCountry: '' },
  { researchId: 'R-C6C', siteId: 'site_b', schoolCondition: 'comparison', classId: '6-C1', gradeLevel: 6, assignedPartnerCountry: '' },
  { researchId: 'R-C6D', siteId: 'site_b', schoolCondition: 'comparison', classId: '6-C1', gradeLevel: 6, assignedPartnerCountry: '' },
];
const seed = 'RQ1-QA-SEED-001';
const allocation1 = buildRq1ComparisonAllocationPlan(allocationParticipants, seed);
const allocation2 = buildRq1ComparisonAllocationPlan(allocationParticipants, seed);
assert.equal(allocation1.method, RQ1_COMPARISON_ALLOCATION_METHOD);
assert.equal(allocation1.algorithmVersion, RQ1_COMPARISON_ALLOCATION_ALGORITHM_VERSION);
assert.deepEqual(allocation1, allocation2);
assert.equal(allocation1.assignments.length, 4);
assert.ok(allocation1.assignments.every((row) => row.gradeLevel === 6));
const grade6 = allocation1.gradeSummaries.find((row) => row.gradeLevel === 6)!;
assert.equal(grade6.interventionN, 3);
assert.equal(grade6.comparisonN, 4);
assert.deepEqual(grade6.interventionCountryCounts, { 'United Kingdom': 1, 'United States': 2 });
assert.deepEqual(grade6.comparisonTargetCounts, { 'United Kingdom': 1, 'United States': 3 });
assert.equal(Object.values(grade6.comparisonTargetCounts).reduce((a, b) => a + b, 0), 4);
assert.ok(buildRq1AllocationInputHash(allocationParticipants));
const changedInput = allocationParticipants.map((row) => row.researchId === 'R-I6C' ? { ...row, assignedPartnerCountry: 'United States' } : row);
assert.notEqual(buildRq1AllocationInputHash(allocationParticipants), buildRq1AllocationInputHash(changedInput));
assert.throws(() => buildRq1ComparisonAllocationPlan([
  allocationParticipants[0],
  ...allocationParticipants.filter((row) => row.schoolCondition === 'comparison'),
], seed), /RQ1_MATCHING_INTERVENTION_GRADE_REQUIRED/);

const entry = fs.readFileSync('server-entry.ts', 'utf8');
const auth = fs.readFileSync('src/server/auth.ts', 'utf8');
const rq1Routes = fs.readFileSync('src/server/researchRq1Routes.ts', 'utf8');
const rq1Targets = fs.readFileSync('src/server/researchRq1Targets.ts', 'utf8');
const rq1Allocation = fs.readFileSync('src/server/researchRq1Allocation.ts', 'utf8');
const rq1Page = fs.readFileSync('public/research-rq1.html', 'utf8');
const rq2Alignment = fs.readFileSync('src/server/researchRq2FormalAlignmentRoutes.ts', 'utf8');

assert.ok(entry.indexOf('createResearchRq2FormalAlignmentRouter') < entry.indexOf('createResearchRq2Router'));
assert.ok(entry.includes('createResearchRq1Router'));
assert.ok(entry.includes('withResearchRq1DashboardLink'));
assert.ok(auth.includes("path.startsWith('/research-rq1')"));
assert.ok(rq1Routes.includes('/research-rq1/persona_choices.csv'));
assert.ok(rq1Routes.includes('/research-rq1/persona_period_summary.csv'));
assert.ok(rq1Routes.includes('/research-rq1/persona_transition.csv'));
assert.ok(rq1Routes.includes('/research-rq1/analysis-spec'));
assert.ok(rq1Routes.includes('/research-rq1/target-table.csv'));
assert.ok(rq1Routes.includes('visitorCountries'));
assert.ok(rq1Routes.includes('comparison_seeded_profile'));
assert.ok(!rq1Routes.includes('assertRq1FormalTargetStatus(targetStatus)'));

assert.ok(rq1Targets.includes("status: 'frozen'"));
assert.ok(rq1Targets.includes('snapshotHash'));
assert.ok(rq1Targets.includes('allocationInputHash'));
assert.ok(rq1Targets.includes('allocationSeed'));
assert.ok(rq1Targets.includes("source: 'comparison_distribution_randomized'"));
assert.ok(rq1Targets.includes('RQ1_COMPARISON_TARGET_AUTO_ALLOCATION_REQUIRED'));
assert.ok(rq1Targets.includes('RQ1_INTERVENTION_TARGET_MUST_MATCH_ASSIGNMENT'));
assert.ok(rq1Allocation.includes('grade_stratified_distribution_matched_random'));
assert.ok(rq1Allocation.includes('RQ1_MATCHING_INTERVENTION_GRADE_REQUIRED'));

assert.ok(rq1Page.includes('Phase 1→2：20 Personaから来校国籍群へ'));
assert.ok(rq1Page.includes('Phase 2→3：来校国籍群から担当国へ'));
assert.ok(rq1Page.includes('比較校には国籍情報・担当国を提示しません'));
assert.ok(rq1Page.includes('persona_choices.csv'));
assert.ok(rq1Page.includes('persona_period_summary.csv'));
assert.ok(rq1Page.includes('persona_transition.csv'));

assert.ok(rq2Alignment.includes("candidateSource: 'dialogue_analysis_included_final'"));
assert.ok(rq2Alignment.includes("Number(row.dialogue_analysis_included || 0) === 1"));
assert.ok(rq2Alignment.includes('RQ2_FORMAL_FINAL_INCLUSION_REQUIRED'));
assert.ok(rq2Alignment.includes("id: 'final_analysis_inclusion'"));
assert.ok(rq2Alignment.includes('buildAnalysisSessionRows'));

console.log('RQ1/RQ2 proposal alignment QA: PASS');
