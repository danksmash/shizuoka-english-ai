import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  STUDY_PHASE_FILTER_IDS,
  filterReflectionsForStudyPhase,
  filterSessionsForStudyPhase,
  managementPageHtmlWithStudyPhase,
  normalizeStudyPhaseFilter,
  phaseAwareGetHandler,
} from '../src/server/researchPhaseRuntime';
import type { StudyScheduleRecord } from '../src/server/studySchedulePersistence';

const schedule = (classId: StudyScheduleRecord['classId'], shift = 0): StudyScheduleRecord => {
  const dates = shift === 0
    ? ['2026-09-17', '2026-10-01', '2026-10-08', '2026-10-15']
    : ['2026-09-18', '2026-10-02', '2026-10-09', '2026-10-16'];
  return {
    classId,
    revision: 1,
    appStartDate: dates[0],
    nationalityRevealDate: dates[1],
    videoViewDate: dates[2],
    exchangeDate: dates[3],
    updatedAt: '2026-09-11T00:00:00.000Z',
    updatedBy: 'qa',
    history: [],
  };
};

const schedules = [schedule('5-1'), schedule('5-2', 1)];
const sessions = [
  { sessionId: 'pre', classId: '5-1', localDate: '2026-09-16' },
  { sessionId: 'p1-start', classId: '5-1', localDate: '2026-09-17' },
  { sessionId: 'p1-last', classId: '5-1', localDate: '2026-09-30' },
  { sessionId: 'p2-start', classId: '5-1', localDate: '2026-10-01' },
  { sessionId: 'p2-last', classId: '5-1', localDate: '2026-10-07' },
  { sessionId: 'p3-start', classId: '5-1', localDate: '2026-10-08' },
  { sessionId: 'p3-last', classId: '5-1', localDate: '2026-10-14' },
  { sessionId: 'p4-start', classId: '5-1', localDate: '2026-10-15' },
  { sessionId: 'other-class-p1', classId: '5-2', localDate: '2026-09-18' },
  { sessionId: 'other-class-p2', classId: '5-2', localDate: '2026-10-02' },
  { sessionId: 'unconfigured', classId: '6-3', localDate: '2026-09-20' },
];

assert.deepEqual(STUDY_PHASE_FILTER_IDS, ['phase1', 'phase2', 'phase3', 'phase4']);
assert.equal(normalizeStudyPhaseFilter('phase1'), 'phase1');
assert.equal(normalizeStudyPhaseFilter('Phase4'), 'phase4');
assert.equal(normalizeStudyPhaseFilter('all'), '');
assert.equal(normalizeStudyPhaseFilter('unknown'), '');

assert.deepEqual(
  filterSessionsForStudyPhase(sessions, schedules, 'phase1').map((row) => row.sessionId),
  ['p1-start', 'p1-last', 'other-class-p1'],
);
assert.deepEqual(
  filterSessionsForStudyPhase(sessions, schedules, 'phase2').map((row) => row.sessionId),
  ['p2-start', 'p2-last', 'other-class-p2'],
);
assert.deepEqual(
  filterSessionsForStudyPhase(sessions, schedules, 'phase3').map((row) => row.sessionId),
  ['p3-start', 'p3-last'],
);
assert.deepEqual(
  filterSessionsForStudyPhase(sessions, schedules, 'phase4').map((row) => row.sessionId),
  ['p4-start'],
);
assert.equal(filterSessionsForStudyPhase(sessions, schedules, 'all').length, sessions.length);

const reflections = [
  { reflectionId: 'r1', classId: '5-1', localDate: '2026-09-17' },
  { reflectionId: 'r2', classId: '5-1', localDate: '2026-10-01' },
  { reflectionId: 'r3', classId: '5-1', localDate: '2026-10-08' },
  { reflectionId: 'r4', classId: '5-1', localDate: '2026-10-15' },
] as any;
assert.deepEqual(filterReflectionsForStudyPhase(reflections, schedules, 'phase1').map((row) => row.reflectionId), ['r1']);
assert.deepEqual(filterReflectionsForStudyPhase(reflections, schedules, 'phase2').map((row) => row.reflectionId), ['r2']);
assert.deepEqual(filterReflectionsForStudyPhase(reflections, schedules, 'phase3').map((row) => row.reflectionId), ['r3']);
assert.deepEqual(filterReflectionsForStudyPhase(reflections, schedules, 'phase4').map((row) => row.reflectionId), ['r4']);

const html = managementPageHtmlWithStudyPhase();
assert.ok(html.includes('研究Phase'));
assert.ok(html.includes('id="studyPhase"'));
assert.ok(html.includes('<option value="phase1">Phase 1</option>'));
assert.ok(html.includes('<option value="phase4">Phase 4</option>'));
assert.ok(!html.includes('Persona情報ラベル'));
assert.ok(!html.includes('id="labelCondition"'));
assert.ok(html.includes("'personaId','studyPhase','topic'"));
assert.ok(html.includes("f.studyPhases||['phase1','phase2','phase3','phase4']"));
assert.ok(html.includes('学年・学級・研究Phaseを反映'));

const entry = fs.readFileSync('server-entry.ts', 'utf8');
assert.ok(entry.includes('phaseAwareGetHandler'));
assert.ok(entry.includes('application.get = function researchPhaseAwareGet'));
assert.ok(phaseAwareGetHandler('/management'));
assert.ok(phaseAwareGetHandler('/api/management/research.dashboard'));
assert.ok(phaseAwareGetHandler('/api/management/research.csv'));
assert.ok(phaseAwareGetHandler('/api/management/research.bundle.zip'));
assert.equal(phaseAwareGetHandler('/api/health'), null);

console.log('Research Phase dashboard filter QA: PASS');
