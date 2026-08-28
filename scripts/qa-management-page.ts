import vm from 'node:vm';
import assert from 'node:assert/strict';
import { managementPageHtml } from '../src/server/managementPage';
import { readFile } from 'node:fs/promises';

const html = managementPageHtml();
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) throw new Error('Management page script not found');
if (/onclick=/.test(html)) throw new Error('Inline onclick handlers are not allowed');
for (const marker of ['teacherDashboard','studentList','studentSummary','sessionDetail','codeManagement','researchDashboard','researchList']) {
  if (!html.includes(`id="${marker}"`)) throw new Error(`Management screen missing: ${marker}`);
}
assert.ok(html.includes('/api/management/research.csv'));
assert.ok(html.includes('/api/management/student-codes'));
assert.ok(html.includes("action:'reissue'"));
assert.ok(html.includes("action:'set-active'"));
assert.ok(html.includes('class_id'));

const authSource = await readFile('src/server/auth.ts', 'utf8');
assert.ok(authSource.includes("path === '/api/management/research.csv'"));
assert.ok(authSource.includes('RESEARCHER_ANONYMIZED_DATA_ONLY'));
const serverSource = await readFile('server.ts', 'utf8');
assert.ok(serverSource.includes("requireManagementRole(['teacher'])"));
assert.ok(serverSource.includes('getTeacherSessionsForManagement'));
assert.ok(serverSource.includes('classId:student.classId'));
const reflectionSource = await readFile('src/components/ReflectionScreen.tsx', 'utf8');
for (const marker of ['自分の考えを伝える','相手の話を聞いて分かる','新しい言葉や文化に気づいた','わたしの学習履歴','もう一度練習する','対話時間 (TIME)','ターン数 (TURNS)','発話語数 (WORDS)','出会った語彙 (VOCAB)']) assert.ok(reflectionSource.includes(marker), `Reflection UI marker missing: ${marker}`);
const appSource = await readFile('src/App.tsx', 'utf8');
assert.ok(appSource.includes("onBack={()=>setPhase('reflection')}"));
assert.ok(!appSource.includes("setIsSavingReflection(false); setPhase('feedback');"));

class FakeClassList { toggle(_name: string, _force?: boolean) { return true; } }
class FakeElement {
  value = ''; textContent = ''; innerHTML = ''; className = ''; disabled = false;
  style: Record<string, string> = {}; classList = new FakeClassList(); dataset: Record<string,string> = {};
  listeners = new Map<string, (...args: any[]) => any>(); attrs = new Map<string,string>();
  addEventListener(type: string, listener: (...args: any[]) => any) { this.listeners.set(type, listener); }
  setAttribute(name: string, value: string) { this.attrs.set(name, value); }
}
const ids = [
  'login','panel','u','p','msg','who','csvBtn','loginBtn','logoutBtn','refreshBtn','modeLabel',
  'teacherDashboardBtn','studentListBtn','codeBtn','researchDashboardBtn','researchListBtn',
  'teacherDashboard','studentList','studentSummary','sessionDetail','codeManagement','researchDashboard','researchList',
  'teacherStudents','teacherSessions','teacherAvgSessions','teacherLine','studentRows','studentSearch','codeRows',
  'dashToListBtn','listBackBtn','summaryBackBtn','detailBackBtn','issueCodeBtn','newCode','newClass','codeMessage',
  'studentSummaryTitle','sumSessions','sumDuration','sumTurns','sumWords','r1avg','r2avg','r3avg','summaryRows','detailHead','detailReflection','detailLog',
  'researchStudents','researchSessions','researchPeriod','researchMissing','researchRows','researchLine','researchSearch','teacherClass','researchClass',
];
const elements = Object.fromEntries(ids.map(id => [id, new FakeElement()])) as Record<string, FakeElement>;
elements.u.value = 'qa-user'; elements.p.value = 'qa-password'; elements.researchClass.value = 'all'; elements.teacherClass.value = 'all';
let meCalls = 0; let sessionsCalls = 0; let researchCsvCalls = 0;
const response = (status: number, body: string, contentType: string) => ({
  ok: status >= 200 && status < 300, status,
  headers: { get: (name: string) => name.toLowerCase() === 'content-type' ? contentType : '' },
  json: async () => JSON.parse(body), text: async () => body,
  blob: async () => new Blob([body]),
});
const fetch = async (path: string) => {
  if (path === '/api/management/login') return response(200, JSON.stringify({success:true,role:'researcher'}), 'application/json');
  if (path === '/api/management/me') {
    meCalls += 1;
    return meCalls === 1
      ? response(401, JSON.stringify({error:'NOT_AUTHENTICATED'}), 'application/json')
      : response(200, JSON.stringify({success:true,user:{username:'qa-user',role:'researcher'}}), 'application/json');
  }
  if (path === '/api/management/sessions') { sessionsCalls += 1; return response(403, JSON.stringify({error:'RESEARCHER_ANONYMIZED_DATA_ONLY'}), 'application/json'); }
  if (path === '/api/management/research.csv') {
    researchCsvCalls += 1;
    return response(200, 'research_id,class_id,session_id,local_date,total_turns,total_child_words,actual_duration_seconds,reflection_conveyed_ideas,reflection_understood_partner,reflection_noticed_language_culture\nR0001,5-1,S1,2026-09-01,4,22,60,5,3,5', 'text/csv');
  }
  throw new Error(`Unexpected fetch: ${path}`);
};
const context = vm.createContext({
  document: { getElementById: (id: string) => elements[id] ?? null, createElement: () => new FakeElement(), querySelectorAll: () => [] },
  fetch, URL: { createObjectURL: () => 'blob:qa', revokeObjectURL: () => undefined },
  location: { reload: () => undefined }, alert: () => undefined, confirm: () => true, prompt: () => '', console, setTimeout, clearTimeout, Blob,
});
vm.runInContext(scriptMatch[1], context, { filename: 'management-page-inline.js' });
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(elements.login.style.display, 'grid');
assert.equal(elements.panel.style.display, 'none');
const click = elements.loginBtn.listeners.get('click');
if (!click) throw new Error('Login listener missing');
await click(); await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(elements.login.style.display, 'none');
assert.equal(elements.panel.style.display, 'block');
assert.equal(elements.who.textContent, 'qa-user (researcher)');
assert.equal(elements.researchDashboardBtn.style.display, 'inline-block');
assert.equal(elements.teacherDashboardBtn.style.display, 'none');
assert.equal(sessionsCalls, 0, 'Researcher UI must never call raw teacher sessions endpoint');
assert.ok(researchCsvCalls >= 1, 'Researcher UI must load anonymized research CSV');
assert.equal(elements.researchStudents.textContent, '1人');
console.log('Management role/data isolation + final UI contract QA: PASS');
