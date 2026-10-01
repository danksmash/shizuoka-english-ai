import assert from 'node:assert/strict';
import {
  dialogueAnalysisEligible,
  effectivePersonaSelectionEligible,
  reflectionAnalysisEligible,
} from '../src/server/researchAnalysisEligibility';
import { buildRq1ChoiceRows, type Rq1AnalysisParticipant } from '../src/server/researchRq1Analysis';
import { buildRq2Candidates, RQ2_CANDIDATE_RULE_VERSION } from '../src/server/researchRq2Sampling';
import { buildRq3Candidates } from '../src/server/researchRq3Analysis';
import type { StudyScheduleRecord } from '../src/server/studySchedulePersistence';

assert.equal(dialogueAnalysisEligible('complete'), true);
assert.equal(dialogueAnalysisEligible('missing_reflection'), true);
assert.equal(dialogueAnalysisEligible('interrupted'), false);
assert.equal(dialogueAnalysisEligible('missing_core'), false);
assert.equal(reflectionAnalysisEligible('complete'), true);
assert.equal(reflectionAnalysisEligible('missing_reflection'), false);
assert.equal(effectivePersonaSelectionEligible(0), false);
assert.equal(effectivePersonaSelectionEligible(1), true);

const schedule: StudyScheduleRecord = {
  classId: '5-1',
  revision: 1,
  appStartDate: '2026-09-17',
  nationalityRevealDate: '2026-10-10',
  videoViewDate: '2026-10-20',
  exchangeDate: '2026-11-10',
  updatedAt: '2026-09-16T00:00:00Z',
  updatedBy: 'qa',
  history: [],
};

function dialogueSession(id: string, startedAt: string, options: { child?: boolean; reflection?: boolean; persona?: string } = {}) {
  const child = options.child !== false;
  const reflection = options.reflection !== false;
  const persona = options.persona || 'emma_usa';
  const startMs = Date.parse(startedAt);
  return {
    sessionId: id,
    researchId: 'R-QA-ELIGIBILITY',
    studentId: 'qa-student',
    classId: '5-1',
    aiStudentId: persona,
    topic: 'intro',
    targetDurationMinutes: 1,
    startedAt,
    endedAt: new Date(startMs + 60_000).toISOString(),
    history: [
      { id: `${id}-ai`, sender: 'ai', englishText: 'Hello!', japaneseText: 'こんにちは', timestamp: startMs },
      ...(child ? [{ id: `${id}-child`, sender: 'child', englishText: 'Hello.', japaneseText: '', timestamp: startMs + 10_000, wordCount: 1 }] : []),
    ],
    systemEvents: child ? [{ type: 'session_finish', value: 'timer', timestamp: startMs + 60_000 }] : [],
    reflection: child && reflection ? {
      scaleVersion: '4point-v1',
      understoodPartner: 3,
      conveyedIdeas: 3,
      noticedLanguageCulture: 3,
    } : null,
    formalStudyParticipant: true,
    studySiteId: 'site_a',
    schoolCondition: 'intervention',
    studyStartDate: '2026-09-17',
  };
}

const missingReflection = dialogueSession(
  's-missing-reflection',
  '2026-10-01T10:00:00+09:00',
  { reflection: false },
);
const rq2 = buildRq2Candidates([missingReflection], [schedule], { lessonOnly: false });
assert.equal(rq2.length, 1, 'missing_reflection must remain eligible for RQ2 dialogue analysis');
assert.equal(rq2[0].dataQualityFlag, 'missing_reflection');
assert.equal(rq2[0].candidateRuleVersion, RQ2_CANDIDATE_RULE_VERSION);

const rq3 = buildRq3Candidates([missingReflection], [schedule], [{
  session_id: 's-missing-reflection',
  site_id: 'site_a',
  participant_key: 'site_a:R-QA-ELIGIBILITY',
  school_condition: 'intervention',
  grade_level: 5,
  study_phase: 'phase1',
  analysis_period: 'period1',
  dialogue_analysis_included: 1,
  analysis_included: 0,
}]);
assert.equal(rq3.length, 1, 'RQ3 must use dialogue_analysis_included rather than legacy complete-only inclusion');

const participant: Rq1AnalysisParticipant = {
  researchId: 'R-QA-ELIGIBILITY',
  siteId: 'site_a',
  schoolCondition: 'intervention',
  classId: '5-1',
  gradeLevel: 5,
  targetCountry: 'Australia',
};
const zeroStart = dialogueSession(
  's-zero-start',
  '2026-10-01T10:10:00+09:00',
  { child: false, reflection: false, persona: 'liam_australia' },
);
const realDialogue = dialogueSession(
  's-real-dialogue',
  '2026-10-01T10:10:20+09:00',
  { child: true, reflection: true, persona: 'emma_usa' },
);
const choices = buildRq1ChoiceRows({
  rawSessions: [zeroStart, realDialogue],
  schedules: [schedule],
  analysisSessionRows: [
    { session_id: 's-zero-start', lesson_context_final: 'in_lesson', dialogue_analysis_included: 0, analysis_included: 0 },
    { session_id: 's-real-dialogue', lesson_context_final: 'in_lesson', dialogue_analysis_included: 1, analysis_included: 1 },
  ],
  participants: [participant],
});
const zeroChoice = choices.find((row) => row.session_id === 's-zero-start')!;
const realChoice = choices.find((row) => row.session_id === 's-real-dialogue')!;
assert.equal(zeroChoice.raw_selection_included, 1);
assert.equal(zeroChoice.effective_selection_included, 0);
assert.equal(zeroChoice.effective_selection_exclusion_reason, 'no_child_utterance');
assert.equal(zeroChoice.rapid_restart_flag, 1);
assert.equal(realChoice.effective_selection_included, 1);
assert.equal(realChoice.selection_order_valid, 1);

console.log('Research analysis eligibility v2 QA: PASS');
