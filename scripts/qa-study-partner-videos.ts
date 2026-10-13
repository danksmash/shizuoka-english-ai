import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const server = fs.readFileSync('server-entry.ts', 'utf8');
const auth = fs.readFileSync('src/server/auth.ts', 'utf8');
const routes = fs.readFileSync('src/server/studyPartnerVideoRoutes.ts', 'utf8');
const studyPage = fs.readFileSync('public/study-schedule.html', 'utf8');
const videosPage = fs.readFileSync('public/study-partner-videos.html', 'utf8');

assert.ok(server.includes("createStudyPartnerVideoRouter"));
assert.ok(server.includes("app.use('/api/management', createStudyPartnerVideoRouter())"));
assert.ok(auth.includes("path.startsWith('/study-partner-videos')"));
assert.ok(routes.includes("requireManagementRole(['researcher'])"));
assert.ok(routes.includes("createDocumentIfAbsent(VIDEO_VERSIONS"));
assert.ok(routes.includes("createDocumentIfAbsent(VISITOR_EVENTS"));
assert.ok(routes.includes('PARTNER_VIDEO_REVISION_CONFLICT'));
assert.ok(routes.includes('VIDEO_VIEW_DATE_REQUIRED'));
assert.ok(routes.includes('announcedToChildrenDate'));
assert.ok(routes.includes('visitorSnapshots') || routes.includes('visitors: ids.map'));
assert.ok(!routes.includes('saveStudySchedule('), 'video records must not change historical schedule');
assert.ok(!routes.includes('updateStudentResearchAssignments('), 'video records must not silently assign students');
assert.ok(!routes.includes('setDocument('), 'evidence records must be append-only');
assert.ok(studyPage.includes('/study-partner-videos.html'));
assert.ok(videosPage.includes('/api/management/study-partner-videos/record'));
assert.ok(videosPage.includes('/api/management/study-partner-videos/visitor-event'));
assert.ok(videosPage.includes('englishTranscript'));
assert.ok(videosPage.includes('japaneseSummary'));
assert.ok(videosPage.includes('video_view'));
assert.ok(videosPage.includes('scheduleHistory'));
assert.ok(videosPage.includes('state.versions'));
assert.ok(!videosPage.includes('innerHTML=state.'), 'untrusted Firestore content must not be rendered as HTML');

const script = videosPage.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'management UI script required');
new vm.Script(script, { filename: 'study-partner-videos-ui.js' });
console.log('Study partner video registry QA: PASS');
