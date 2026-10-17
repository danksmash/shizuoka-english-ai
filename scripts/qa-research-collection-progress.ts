import assert from 'node:assert/strict';
import fs from 'node:fs';
import { summarizeInLessonResearchCollection } from '../src/server/researchLessonCollectionProgress';
import type { StudyScheduleRecord } from '../src/server/studySchedulePersistence';

const schedule = {
  classId: '5-3',
  appStartDate: '2026-10-01',
  nationalityRevealDate: '2026-10-05',
  announcedVisitorCountries: ['Germany'],
  announcedVisitorCountryCounts: { Germany: 1 },
  videoViewDate: '2026-10-09',
  assignmentRevealDate: '2026-10-09',
  exchangeDate: '2026-10-16',
  history: [],
} as unknown as StudyScheduleRecord;
const sample = (session_id: string, research_id: string, local_date: string, extras: Record<string, any> = {}) =>
  ({ session_id, research_id, local_date, class_id: '5-3', school_condition: 'intervention', ...extras });
const rows = [
  sample('s1','X','2026-10-02'),
  sample('s2','X','2026-10-06'),
  sample('s3','Y','2026-10-10'),
  sample('s4','Y','2026-10-16'),
  sample('s5','Y','2026-10-12'), // excluded by existing final lesson set
  sample('s6','C','2026-10-10',{ class_id: '5-C1',school_condition: 'comparison' }),
  sample('s7','X','2026-10-07',{ data_quality_flag: 'missing_core' }),
  sample('s8','X','2026-09-20'),
];
const eligible = new Set(['s1','s2','s3','s4','s6','s7','s8']);
const output = summarizeInLessonResearchCollection(rows,[schedule],eligible);
assert.equal(output.lessonSessions,7);
assert.equal(output.classes.length,2);
const target = output.classes.find((item) => item.classId === '5-3');
assert.ok(target);
assert.equal(target.sessions,6);
assert.equal(target.participants,2);
assert.deepEqual(['phase1','phase2','phase3','phase4','unclassified'].map((key) =>
  target.stages[key as keyof typeof target.stages].sessions), [1,2,1,1,1]);
assert.equal(target.stages.phase2.participants,1, 'a missing_core flag does not independently exclude sessions');
const comparison = output.classes.find((item) => item.schoolCondition === 'comparison');
assert.ok(comparison);
assert.equal(comparison.stages.notApplicable.sessions,1);
assert.equal(comparison.stages.phase3.sessions,0);
assert.equal(summarizeInLessonResearchCollection(rows,[schedule],new Set()).lessonSessions,0);

const dashboardPage = fs.readFileSync('src/server/managementPage.ts','utf8');
const runtime = fs.readFileSync('src/server/researchDashboardResilientRuntime.ts','utf8');
assert.ok(dashboardPage.includes('const SHOW_EXPRESSION_PANEL=false;'), 'expression card disabled by reversible flag');
assert.ok(dashboardPage.includes('id="expressionPanel" hidden'), 'hidden default even before script runs');
assert.ok(dashboardPage.includes('if(!SHOW_EXPRESSION_PANEL)return;'), 'expression request function early exits');
assert.ok(dashboardPage.includes('if(SHOW_EXPRESSION_PANEL)$(\'loadExpressionsBtn\').onclick=loadExpressions'), 'no expression click binding');
assert.ok(dashboardPage.includes('renderCollectionProgress(d.collectionProgress)'), 'collection panel reuses existing payload');
assert.ok(runtime.includes('summarizeInLessonResearchCollection(filteredPreparedPhaseSessions, schedules, lessonSessionIds)'), 'reuse final lesson set, never read additional sessions');
assert.ok(!dashboardPage.includes('fetch(\'/api/management/research.expressions-summary\''), 'avoid eager expression fetch');
console.log('Lightweight collection panel QA: PASS');
