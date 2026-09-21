import assert from 'node:assert/strict';
import { STUDY1_FORMAL_PARTICIPANT_HASHES } from '../src/server/study1FormalParticipantHashes';
import {
  isLegacyFormalStudy1ParticipantHash,
  normalizeStudyParticipantMetadata,
} from '../src/server/studyParticipantMetadata';
import { isStudyClassId, type StudyScheduleRecord } from '../src/server/studySchedulePersistence';
import {
  buildResearchDashboardData,
  buildResearchExportDataSets,
  filterResearchExportDataSets,
  researchDataScopeForRow,
} from '../src/server/researchDashboard';
import {
  QUESTIONNAIRE_INSTRUMENT_VERSION,
  QUESTIONNAIRE_ITEMS,
  calculateQuestionnaireScores,
  buildQuestionnaireExportRows,
  type QuestionnaireItemScores,
  type QuestionnaireRecord,
  type QuestionnaireWave,
} from '../src/server/questionnaireResearch';
import { buildQuestionnaireDescriptiveStatistics } from '../src/server/questionnaireDescriptive';
import { buildQuestionnaireTimingAudit } from '../src/server/questionnaireTimingAudit';
import { buildPhaseComparisonFromExportSessions } from '../src/server/researchPhaseAnalyticsRuntime';
import { managementPageHtmlWithStudyPhase } from '../src/server/researchPhaseRuntime';
import { researcherRouteAllowed } from '../src/server/auth';

const firstLegacyHash = [...STUDY1_FORMAL_PARTICIPANT_HASHES][0];
assert.ok(firstLegacyHash);
assert.equal(isLegacyFormalStudy1ParticipantHash(firstLegacyHash, '5-1', 1), true);
assert.equal(isLegacyFormalStudy1ParticipantHash(firstLegacyHash, '5-C1', 1), false);

const explicitComparison = normalizeStudyParticipantMetadata({
  formalStudyParticipant: true,
  studySiteId: 'site_b',
  schoolCondition: 'comparison',
  studyGradeLevel: 5,
  studyStartDate: '2026-10-01',
  classId: '5-C1',
});
assert.deepEqual(explicitComparison, {
  formalStudyParticipant: true,
  studySiteId: 'site_b',
  schoolCondition: 'comparison',
  gradeLevel: 5,
  studyStartDate: '2026-10-01',
});
assert.equal(isStudyClassId('5-C1'), true);
assert.equal(isStudyClassId('6-C9'), true);
assert.equal(isStudyClassId('5-C0'), false);
assert.equal(isStudyClassId('7-C1'), false);

assert.equal(researchDataScopeForRow({
  class_id: '5-C1', local_date: '2026-09-30', formal_study_participant: 1,
  school_condition: 'comparison', study_start_date: '2026-10-01',
}), 'test');
assert.equal(researchDataScopeForRow({
  class_id: '5-C1', local_date: '2026-10-01', formal_study_participant: 1,
  school_condition: 'comparison', study_start_date: '2026-10-01',
}), 'main');

const started = (date: string) => Date.parse(`${date}T01:00:00.000Z`);
function rawSession(
  sessionId: string,
  researchId: string,
  classId: string,
  date: string,
  condition?: 'intervention' | 'comparison',
) {
  const start = started(date);
  return {
    schemaVersion: 4,
    researchSchemaVersion: 'research-2026-v1',
    researchId,
    studentId: `S-${researchId}`,
    classId,
    sessionId,
    aiStudentId: 'emma_usa',
    personaId: 'emma_usa',
    personaCountry: 'United States',
    topic: 'favorites',
    targetDurationMinutes: 2,
    actualDurationSeconds: 120,
    startedAt: new Date(start).toISOString(),
    endedAt: new Date(start + 120000).toISOString(),
    appVersion: 'qa',
    build: 'qa',
    ...(condition ? {
      formalStudyParticipant: true,
      studySiteId: condition === 'comparison' ? 'site_b' : 'site_a',
      schoolCondition: condition,
      studyGradeLevel: 5,
      studyStartDate: condition === 'comparison' ? '2026-10-01' : '2026-09-17',
    } : {}),
    history: [
      { id: `${sessionId}-a`, sender: 'ai', englishText: 'What do you like?', japaneseText: '何が好きですか。', timestamp: start },
      { id: `${sessionId}-c`, sender: 'child', englishText: 'I like soccer.', japaneseText: 'サッカーが好きです。', timestamp: start + 30000 },
    ],
    reflection: { scaleVersion: '4point-v1', conveyedIdeas: 3, understoodPartner: 3, noticedLanguageCulture: 3 },
    systemEvents: [{ type: 'session_start', timestamp: start }, { type: 'session_finish', timestamp: start + 119000 }],
  };
}

const rawSessions = [
  rawSession('I-1', 'R-I-1', '5-1', '2026-10-01'),
  rawSession('C-1', 'R-C-1', '5-C1', '2026-10-01', 'comparison'),
];
const exportData = buildResearchExportDataSets(rawSessions as any);
const interventionRow = exportData.sessions.find((row) => row.session_id === 'I-1')!;
const comparisonRow = exportData.sessions.find((row) => row.session_id === 'C-1')!;
assert.equal(interventionRow.school_condition, 'intervention', 'legacy intervention sessions must default to intervention');
assert.equal(interventionRow.site_id, 'site_a');
assert.equal(comparisonRow.school_condition, 'comparison');
assert.equal(comparisonRow.site_id, 'site_b');
assert.equal(comparisonRow.formal_study_participant, 1);
assert.equal(researchDataScopeForRow(comparisonRow), 'main');

const interventionOnly = filterResearchExportDataSets(exportData, { dataScope: 'main', schoolCondition: 'intervention' });
assert.deepEqual(interventionOnly.sessions.map((row) => row.session_id), ['I-1']);
const comparisonOnly = filterResearchExportDataSets(exportData, { dataScope: 'main', schoolCondition: 'comparison' });
assert.deepEqual(comparisonOnly.sessions.map((row) => row.session_id), ['C-1']);
const both = filterResearchExportDataSets(exportData, { dataScope: 'main', schoolCondition: 'all' });
assert.equal(both.sessions.length, 2);

const dashboardIntervention = buildResearchDashboardData(rawSessions as any, { dataScope: 'main' });
assert.equal(dashboardIntervention.metrics.totalSessions, 1, 'main dashboard default must remain intervention only');
const dashboardComparison = buildResearchDashboardData(rawSessions as any, { dataScope: 'main', schoolCondition: 'comparison' });
assert.equal(dashboardComparison.metrics.totalSessions, 1);
assert.deepEqual(dashboardComparison.filters.schoolConditions, ['intervention', 'comparison']);

function itemScores(base: number): QuestionnaireItemScores {
  return Object.fromEntries(QUESTIONNAIRE_ITEMS.map((item, index) => [
    item.id,
    Math.max(1, Math.min(6, base + (index % 2))),
  ])) as QuestionnaireItemScores;
}
function qRecord(
  researchId: string,
  classId: string,
  condition: 'intervention' | 'comparison',
  wave: QuestionnaireWave,
  base: number,
): QuestionnaireRecord {
  const items = itemScores(base);
  const scores = calculateQuestionnaireScores(items);
  const date = wave === 'pre_app' ? '2026-10-01' : wave === 'mid_pre_reveal' ? '2026-10-15' : '2026-10-29';
  return {
    responseId: `q-${researchId}-${wave}`,
    researchId,
    classId,
    gradeLevel: 5,
    dataScope: 'main',
    siteId: condition === 'comparison' ? 'site_b' : 'site_a',
    schoolCondition: condition,
    surveyWave: wave,
    surveyDate: date,
    submittedAt: `${date}T00:00:00.000Z`,
    instrumentVersion: QUESTIONNAIRE_INSTRUMENT_VERSION,
    items,
    ...scores,
    dataQualityFlag: 'complete',
    importedAt: '2026-10-01T00:00:00.000Z',
  };
}
const questionnaires: QuestionnaireRecord[] = [];
for (let i = 0; i < 3; i += 1) {
  for (const wave of ['pre_app', 'mid_pre_reveal', 'post_pre_exchange'] as QuestionnaireWave[]) {
    questionnaires.push(qRecord(`I-${i}`, '5-1', 'intervention', wave, wave === 'post_pre_exchange' ? 5 : 4));
    questionnaires.push(qRecord(`C-${i}`, '5-C1', 'comparison', wave, wave === 'post_pre_exchange' ? 4 : 4));
  }
}
const descriptive = buildQuestionnaireDescriptiveStatistics(questionnaires);
assert.ok(descriptive.rows.some((row) => row.groupId === 'intervention:all' && row.groupLabel === '実践校 全体'));
assert.ok(descriptive.rows.some((row) => row.groupId === 'comparison:all' && row.groupLabel === '比較校 全体'));
assert.ok(descriptive.rows.some((row) => row.groupId === 'all' && row.groupLabel === '両校 全体'));

const qComparisonExport = buildQuestionnaireExportRows(questionnaires, { dataScope: 'main', schoolCondition: 'comparison' });
assert.equal(qComparisonExport.length, 9);
assert.ok(qComparisonExport.every((row) => row.site_id === 'site_b' && row.school_condition === 'comparison'));
assert.ok(qComparisonExport.every((row) => row.formal_study_participant === 1));

const comparisonSchedule: StudyScheduleRecord = {
  classId: '5-C1',
  revision: 1,
  appStartDate: '2026-10-01',
  nationalityRevealDate: '2026-10-15',
  videoViewDate: '',
  exchangeDate: '2026-10-29',
  updatedAt: '',
  updatedBy: '',
  history: [],
};
const timing = buildQuestionnaireTimingAudit(
  questionnaires.filter((row) => row.schoolCondition === 'comparison'),
  [comparisonSchedule],
);
assert.equal(timing.issueCount, 0, 'comparison timing must not require video or real exchange treatment');

const comparisonPhase = buildPhaseComparisonFromExportSessions(exportData.sessions, [comparisonSchedule], {
  dataScope: 'main',
  schoolCondition: 'comparison',
});
assert.equal(comparisonPhase.applicable, false);
assert.ok(comparisonPhase.reason.includes('比較校'));

const interventionSchedule: StudyScheduleRecord = {
  ...comparisonSchedule,
  classId: '5-1',
  videoViewDate: '2026-10-22',
};
const bothPhase = buildPhaseComparisonFromExportSessions(exportData.sessions, [interventionSchedule, comparisonSchedule], {
  dataScope: 'main',
  schoolCondition: 'all',
});
assert.equal(bothPhase.applicable, true);
assert.equal(bothPhase.phases.reduce((sum, phase) => sum + phase.sessions, 0), 1, 'phase analysis must exclude comparison sessions');

const html = managementPageHtmlWithStudyPhase();
assert.ok(html.includes('id="schoolCondition"'));
assert.ok(html.includes('<option value="intervention" selected>実践校</option>'));
assert.ok(html.includes('<option value="comparison">比較校</option>'));
assert.ok(html.includes('<option value="all">両校</option>'));
assert.ok(html.includes("p.set('schoolCondition',scv)"));
assert.equal(researcherRouteAllowed({ path: '/study-participants' } as any), true);
assert.equal(researcherRouteAllowed({ path: '/api/management/study-participants/metadata' } as any), true);

console.log('Comparison school study metadata QA: PASS');
