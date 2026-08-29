import vm from 'node:vm';
import assert from 'node:assert/strict';
import { managementPageHtml } from '../src/server/managementPage';
import { readFile } from 'node:fs/promises';

const html = managementPageHtml();
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) throw new Error('Management page script not found');
new vm.Script(scriptMatch[1], { filename: 'management-page-inline.js' });
if (/onclick=/.test(html)) throw new Error('Inline onclick handlers are not allowed');

for (const marker of ['teacherDashboard','studentList','studentSummary','sessionDetail','codeManagement','researchDashboard','researchList','researchSummary','researchSession','researchQuality']) {
  assert.ok(html.includes(`id="${marker}"`), `Management screen missing: ${marker}`);
}
for (const marker of ['teacherClass','teacherStart','teacherEnd','teacherMetric','teacherWeekly','teacherMonthly','teacherChart','listClass','listStart','listEnd','studentSearch','showUnused','summaryStart','summaryEnd','sumDurationChart','sumWordsChart','newCode','newClass','reissueModal','reissueConfirm','researchStart','researchEnd','researchDashboardClass','researchMetric','researchWeekly','researchMonthly','researchChart','researchClass','researchGrade','researchCompleteOnly','researchSearch','r4TurnChart','r4WordChart','r4ReflectionChart','r5Head','r5Reflection','r6Start','r6End','r6Class','r6Research','qNormal','qMissing','qDuplicate','qReview']) {
  assert.ok(html.includes(`id="${marker}"`), `Functional UI control missing: ${marker}`);
}

// Teacher = classroom operation / learner support.
for (const marker of ['授業・学級状況','児童別学習状況','児童の成長','対話記録','teacherUsedStudents','teacherImplementationRate','teacherNotUsed','teacherSupportSummary','teacherReflectionSummary','teacherUsageSummary','支援を優先して確認','振り返り3観点（学級平均）']) {
  assert.ok(html.includes(marker), `Teacher-support feature missing: ${marker}`);
}
assert.ok(html.includes("teacherSupportHtml"));
assert.ok(html.includes("teacherReflectionHtml"));
assert.ok(html.includes("used.size/recs.length"), 'Teacher implementation-rate calculation missing');
assert.ok(html.includes("dashToListBtn"), 'Teacher dashboard-to-list flow missing');

// Research = anonymized longitudinal analysis / data quality.
for (const marker of ['研究データ概要','匿名化ケース一覧','個人内縦断データ','匿名化セッションデータ','Export・データ品質','researchCompleteCases','researchMissingRate','researchMedianWords','researchSdWords','researchDescriptiveStats','researchStageSummary','r4DeltaWords','r4DeltaTurns','r4DeltaReflection','記述統計','通算実施回数別']) {
  assert.ok(html.includes(marker), `Research-analysis feature missing: ${marker}`);
}
for (const fn of ['median(','stdDev(','researchStatsHtml','stageSummaryHtml','deltaText']) {
  assert.ok(html.includes(fn), `Research statistic/longitudinal logic missing: ${fn}`);
}
assert.ok(html.includes('<option value="reflection">振り返り平均</option>'), 'Research reflection metric missing');

// Shared filters and class scopes must remain functional.
for (const cls of ['5-1','5-2','5-3','6-1','6-2','6-3','テスト','予備']) assert.ok(html.includes(cls), `Class option missing: ${cls}`);
for (const marker of ['grade5','grade6','canonClass','classMatches','scopeClasses','fillResearchScopeSelect','topicText','UNASSIGNED_CLASS','rowClass','学級未設定']) assert.ok(html.includes(marker), `Linked dashboard logic missing: ${marker}`);
assert.ok(!html.includes('id="teacherClassPicks"'), 'T2 redundant display-class selector must not return');
assert.ok(!html.includes('id="researchClassPicks"'), 'R2 must use a single class/grade dropdown');

// Researcher must only use anonymized CSV route; raw teacher session route stays teacher-only.
assert.ok(html.includes('/api/management/research.csv'));
assert.ok(html.includes('/api/management/student-codes'));
assert.ok(html.includes('/api/management/sessions'));
const loadResearchMatch = scriptMatch[1].match(/async function loadResearch\(\)\{([\s\S]*?)\}\nfunction setRoleUi/);
assert.ok(loadResearchMatch, 'loadResearch function not found');
assert.ok(loadResearchMatch![1].includes('/api/management/research.csv'));
assert.ok(!loadResearchMatch![1].includes('/api/management/sessions'), 'Researcher UI must not call raw teacher sessions endpoint');
assert.ok(html.includes('研究者画面では児童の生の発話本文を表示しません'));

const authSource = await readFile('src/server/auth.ts', 'utf8');
assert.ok(authSource.includes("path === '/api/management/research.csv'"));
assert.ok(authSource.includes('RESEARCHER_ANONYMIZED_DATA_ONLY'));
const serverSource = await readFile('server.ts', 'utf8');
assert.ok(serverSource.includes("requireManagementRole(['teacher'])"));
assert.ok(serverSource.includes('getTeacherSessionsForManagement'));
assert.ok(serverSource.includes("requireManagementRole(['researcher'])"));
assert.ok(serverSource.includes('isPredominantlyJapanese'), 'Japanese feedback guard missing');
assert.ok(serverSource.includes('studentMessageは必ず日本語で書いてください'), 'Japanese feedback prompt requirement missing');

// Existing learner contracts must not regress.
const reflectionSource = await readFile('src/components/ReflectionScreen.tsx', 'utf8');
for (const marker of ['自分の考えを伝える','相手の話を聞いて分かる','新しい言葉や文化に気づいた','対話時間 (TIME)','ターン数 (TURNS)','発話語数 (WORDS)','出会った語彙 (VOCAB)']) assert.ok(reflectionSource.includes(marker), `Reflection UI marker missing: ${marker}`);
assert.ok(!reflectionSource.includes('もう一度練習する'));
assert.ok(!reflectionSource.includes('わたしの学習履歴'));
const feedbackSource = await readFile('src/components/FeedbackScreen.tsx', 'utf8');
for (const marker of ['からのメッセージ','よくできたところ (Good Points)','自分が使ったことば','AI留学生から出会ったことば','根拠となる実際の発話','次へのステップアップ (Next Step Advice)','重要キーフレーズ (Key Expressions)','対話の文字起こしと日本語訳','日本語訳','もう一度練習する']) assert.ok(feedbackSource.includes(marker), `Feedback UI marker missing: ${marker}`);
assert.ok(!feedbackSource.includes('handleCopyReport'));
assert.ok(!feedbackSource.includes('window.print()'));
const appSource = await readFile('src/App.tsx', 'utf8');
assert.ok(!appSource.includes('setTimeout(executeTransition,4500)'));
assert.ok(appSource.includes("setIsSavingReflection(false);\n    setPhase('feedback');"));
const historySource = await readFile('src/components/LearningHistoryScreen.tsx', 'utf8');
for (const marker of ['累計対話時間','よく話したテーマ','よく話したAI留学生','テーマ・時間・発話量','actualDurationSeconds']) assert.ok(historySource.includes(marker), `Learning history detail missing: ${marker}`);
const setupSource = await readFile('src/components/SetupScreen.tsx', 'utf8');
assert.ok(!setupSource.includes('お名前:'), 'Non-functional name field must be removed');
for (const marker of ['setup-screen','setup-shell','setup-main','setup-student-grid','setup-controls','items-stretch','flex-1 auto-rows-fr','setup-start flex min-h-12 w-full']) assert.ok(setupSource.includes(marker), `Responsive Setup marker missing: ${marker}`);
assert.ok(!setupSource.includes('setup-start mt-auto'), 'Start button must not create an artificial vertical spacer');

console.log('Role-differentiated learner + teacher + researcher UI contract QA: PASS');
