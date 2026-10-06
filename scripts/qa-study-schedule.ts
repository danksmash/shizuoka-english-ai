import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  analysisPeriodForLocalDate,
  identifiedOtherStartDate,
  phaseForLocalDate,
  validateStudyScheduleOrder,
  normalizeStudyDate,
  STUDY_CLASS_IDS,
  isStudyClassId,
} from '../src/server/studySchedulePersistence';

assert.deepEqual(STUDY_CLASS_IDS, ['5-1','5-2','5-3','6-1','6-2']);
assert.equal(isStudyClassId('5-C1'), true);
assert.equal(isStudyClassId('6-C9'), true);
assert.equal(isStudyClassId('5-C0'), false);
assert.equal(normalizeStudyDate('2026-09-17'), '2026-09-17');
assert.equal(normalizeStudyDate(''), '');
assert.throws(() => normalizeStudyDate('2026-02-30'), /INVALID_STUDY_DATE/);

assert.throws(() => validateStudyScheduleOrder({
  appStartDate:'2026-09-17',
  nationalityRevealDate:'2026-09-16',
  videoViewDate:'',
  assignmentRevealDate:'',
  exchangeDate:'',
}), /INVALID_STUDY_DATE_ORDER/);

validateStudyScheduleOrder({
  appStartDate:'2026-09-17',
  nationalityRevealDate:'2026-10-01',
  videoViewDate:'2026-10-08',
  assignmentRevealDate:'2026-10-08',
  exchangeDate:'2026-10-15',
});

const schedule={
  appStartDate:'2026-09-17',
  nationalityRevealDate:'2026-10-01',
  announcedVisitorCountries:['United States','United Kingdom'],
  videoViewDate:'2026-10-08',
  assignmentRevealDate:'2026-10-08',
  exchangeDate:'2026-10-15',
};

assert.equal(identifiedOtherStartDate(schedule),'2026-10-08');
assert.equal(phaseForLocalDate('2026-09-16',schedule),'pre_start');
assert.equal(phaseForLocalDate('2026-09-17',schedule),'unknown_virtual_other');
assert.equal(phaseForLocalDate('2026-10-01',schedule),'anticipated_other');
assert.equal(phaseForLocalDate('2026-10-08',schedule),'identified_real_other');
assert.equal(phaseForLocalDate('2026-10-15',schedule),'exchange_or_after');
assert.equal(phaseForLocalDate('2026-09-17',{...schedule,appStartDate:''}),'unconfigured');

assert.equal(analysisPeriodForLocalDate('2026-09-17',schedule),'period1');
assert.equal(analysisPeriodForLocalDate('2026-10-01',schedule),'period2');
assert.equal(analysisPeriodForLocalDate('2026-10-08',schedule),'period3');
assert.equal(analysisPeriodForLocalDate('2026-10-15',schedule),'');

// Phase 2 must remain analyzable before future Phase 3 / exchange dates are known.
const phase2Only={
  appStartDate:'2026-09-17',
  nationalityRevealDate:'2026-10-06',
  announcedVisitorCountries:['Germany','Hungary','Lithuania','Poland'],
  videoViewDate:'',
  assignmentRevealDate:'',
  exchangeDate:'',
};
assert.equal(phaseForLocalDate('2026-10-06',phase2Only),'anticipated_other');
assert.equal(analysisPeriodForLocalDate('2026-10-06',phase2Only),'period2');

// With a visitor-country set configured, video alone must not start Phase 3.
const videoOnly={...phase2Only,videoViewDate:'2026-10-12'};
assert.equal(phaseForLocalDate('2026-10-12',videoOnly),'anticipated_other');
assert.equal(analysisPeriodForLocalDate('2026-10-12',videoOnly),'period2');

// Phase 3 starts only after both video and assigned-partner disclosure, at the later date.
const staggered={...phase2Only,videoViewDate:'2026-10-12',assignmentRevealDate:'2026-10-14',exchangeDate:'2026-10-20'};
assert.equal(identifiedOtherStartDate(staggered),'2026-10-14');
assert.equal(phaseForLocalDate('2026-10-13',staggered),'anticipated_other');
assert.equal(phaseForLocalDate('2026-10-14',staggered),'identified_real_other');
assert.equal(analysisPeriodForLocalDate('2026-10-14',staggered),'period3');

// Legacy schedules without visitor-set metadata keep video-day compatibility.
const legacy={...schedule,announcedVisitorCountries:[],assignmentRevealDate:''};
assert.equal(phaseForLocalDate('2026-10-08',legacy),'identified_real_other');

const entry=fs.readFileSync('server-entry.ts','utf8');
const auth=fs.readFileSync('src/server/auth.ts','utf8');
const routes=fs.readFileSync('src/server/studyScheduleRoutes.ts','utf8');
const page=fs.readFileSync('public/study-schedule.html','utf8');
const persistence=fs.readFileSync('src/server/studySchedulePersistence.ts','utf8');
const studentPersistence=fs.readFileSync('src/server/persistence.ts','utf8');

assert.ok(entry.includes("app.use('/api/management', createStudyScheduleRouter())"));
assert.ok(entry.includes("if (path === '*') ensureExtensionRoutesMounted(this)"));
assert.ok(auth.includes("path.startsWith('/study-schedules')"));
assert.ok(routes.includes("router.post('/study-schedules/query'"));
assert.ok(routes.includes("router.put('/study-schedules'"));
assert.ok(routes.includes("router.put('/study-schedules/assignments'"));
assert.ok(routes.includes('getStudentRecordsForManagement'));
assert.ok(routes.includes('updateStudentResearchAssignments'));
assert.ok(routes.includes('ASSIGNMENT_REVEAL_DATE_REQUIRED'));
assert.ok(!routes.includes('NATIONALITY_REVEAL_DATE_REQUIRED'));
assert.ok(routes.includes('assignmentAnnouncementSync'));
assert.ok(routes.includes('assignmentAnnouncementIso(saved)'));
assert.ok(routes.includes('schedule.assignmentRevealDate'));
assert.ok(routes.includes('announcedVisitorCountries'));
assert.ok(routes.includes('visitor_country_persona_match'));
assert.ok(routes.includes('assignedCountryConfiguredParticipants'));
assert.ok(routes.includes('assignedCountryComparableSessions'));
assert.ok(routes.includes('canonicalAssignedCountry'));
assert.ok(routes.includes("'announced_visitor_countries'"));
assert.ok(routes.includes("'assigned_partner_country', 'assigned_partner_id', 'assignment_announced_at'"));
assert.ok(routes.includes("router.post('/study-schedules/audit'"));
assert.ok(routes.includes("router.post('/study-schedules/linkage.csv'"));
assert.ok(routes.includes("dialogueToReflection: ['research_id', 'local_date']"));
assert.ok(routes.includes("scheduleToDialogue: ['class_id', 'local_date']"));
assert.ok(routes.includes("scheduleToReflection: ['class_id', 'local_date']"));
assert.ok(routes.includes('...schedules.map((schedule) => schedule.classId)'), 'configured comparison schedule must remain visible before formal participant activation');
assert.ok(routes.includes("formal_study_participant: student?.formalStudyParticipant === true ? 1 : 0"), 'linkage audit must not infer formal participation from comparison class name');
assert.ok(!routes.includes("formal_study_participant: student?.formalStudyParticipant === true || comparison ? 1 : 0"));

assert.ok(persistence.includes("STUDY_SCHEDULE_COLLECTION = 'study_schedules'"));
assert.ok(persistence.includes("STUDY_CLASS_IDS = ['5-1', '5-2', '5-3', '6-1', '6-2']"));
assert.ok(persistence.includes("process.env.STUDY_COMPARISON_CLASS_IDS || '6-C1'"));
assert.ok(persistence.includes('...configuredComparisonClassIds()'));
assert.ok(!persistence.includes("'6-3'] as const"));
assert.ok(persistence.includes('announcedVisitorCountries'));
assert.ok(persistence.includes('announcedVisitorCountryCounts'));
assert.ok(persistence.includes('assignmentRevealDate'));
assert.ok(persistence.includes('identifiedOtherStartDate'));
assert.ok(persistence.includes('expectedRevision !== current.revision'));
assert.ok(persistence.includes('history: [...current.history, snapshot].slice(-100)'));

assert.ok(studentPersistence.includes('export async function updateStudentResearchAssignments'));
assert.ok(studentPersistence.includes('researchAssignmentHistory'));
assert.ok(studentPersistence.includes('RESEARCH_ASSIGNMENT_CONFLICT'));
assert.ok(studentPersistence.includes('expectedAssignedPartnerCountry'));
assert.ok(studentPersistence.includes('export async function updateStudentStudyMetadata'));
assert.ok(studentPersistence.includes('schoolCondition'));
assert.ok(entry.includes('createStudyParticipantRouter'));
assert.ok(auth.includes("path.startsWith('/study-participants')"));

assert.ok(page.includes("let classes=['5-1','5-2','5-3','6-1','6-2'];"));
assert.ok(!page.includes("'6-3'"));
assert.ok(page.includes('実践校と比較校'));
assert.ok(page.includes('アプリ使用開始日'));
assert.ok(page.includes('Mid基準日'));
assert.ok(page.includes('本人動画日 / C2分析基準日'));
assert.ok(page.includes('C2（動画提示なし）'));
assert.ok(page.includes('担当相手告知日'));
assert.ok(page.includes('Phase 2　来校予定留学生の国籍'));
assert.ok(page.includes('Phase 3　担当留学生設定'));
assert.ok(page.includes('visitorClass'));
assert.ok(page.includes('visitorSaveBtn'));
assert.ok(page.includes('announcedVisitorCountries'));
assert.ok(page.includes('assignmentRevealDate'));
assert.ok(routes.includes("'analysis_period'"));
assert.ok(page.includes('Post基準日'));
assert.ok(page.includes('比較校はPhase 1～4に割り当てません'));
assert.ok(page.includes('research_id + local_date'));
assert.ok(page.includes('class_id + local_date'));
assert.ok(page.includes('assignmentClass'));
assert.ok(page.includes('bulkCountry'));
assert.ok(page.includes('assignmentCsv'));
assert.ok(page.includes('assigned_partner_country'));
assert.ok(page.includes('確認内容を一括保存'));
assert.ok(page.includes("timeZone:'Asia/Tokyo'"));
assert.ok(!page.includes('}}{.audit-grid'));
assert.ok(page.includes('/api/management/study-schedules/assignments'));
assert.ok(!page.includes('student_id'));

console.log('Study 1 class schedule QA: PASS');
