import vm from 'node:vm';
import assert from 'node:assert/strict';
import { managementPageHtml } from '../src/server/managementPage';
import { readFile } from 'node:fs/promises';

const html = managementPageHtml();
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) throw new Error('Management page script not found');
new vm.Script(scriptMatch[1], { filename: 'management-page-inline.js' });
if (/onclick=/.test(html)) throw new Error('Inline onclick handlers are not allowed');

for (const marker of [
  'teacherDashboard','studentList','studentSummary','sessionDetail','codeManagement',
  'researchDashboard','researchList','researchLongitudinal','researchSession','researchQuality',
]) {
  assert.ok(html.includes(`id="${marker}"`), `Management screen missing: ${marker}`);
}
for (const marker of [
  'teacherStart','teacherEnd','teacherWeek','teacherMonth','teacherMetric','teacherClasses','teacherChart',
  'studentListClass','studentListStart','studentListEnd','studentSearch','showUnimplemented',
  'summaryStart','summaryEnd','summaryTurnsChart','summaryWordsChart','summaryRows',
  'detailHead','detailReflection','detailLog','issueCodeBtn','codeModal',
  'researchStart','researchEnd','researchWeek','researchMonth','researchMetric','researchClasses','researchChart',
  'researchListStart','researchListEnd','researchListClass','researchListCount','researchComplete','researchSearch',
  'researchLongitudinal','researchLongStart','researchLongEnd','researchLongTurns','researchLongWords','researchLongReflection','researchLongRows',
  'researchSessionHead','researchSessionReflection','researchMaskedLog','researchSessionCsv',
  'researchQuality','exportPane','qualityPane','createFilteredCsv','qualityRows','exportHistoryRows',
]) assert.ok(html.includes(`id="${marker}"`), `Functional control missing: ${marker}`);

assert.ok(html.includes('/api/management/sessions'));
assert.ok(html.includes('/api/management/student-codes'));
assert.ok(html.includes('/api/management/research.csv'));
assert.ok(html.includes("action:'reissue'"));
assert.ok(html.includes("action:'set-active'"));
assert.ok(html.includes('research-session-link'));
assert.ok(html.includes('research-link'));
assert.ok(html.includes('［匿名化済み：発話本文は非表示］'));
assert.ok(html.includes('学習者用コード・氏名・学校名は出力されません'));

const authSource = await readFile('src/server/auth.ts', 'utf8');
assert.ok(authSource.includes("path === '/api/management/research.csv'"));
assert.ok(authSource.includes('RESEARCHER_ANONYMIZED_DATA_ONLY'));
const serverSource = await readFile('server.ts', 'utf8');
assert.ok(serverSource.includes("app.get('/api/management/sessions',requireManagementRole(['teacher'])"));
assert.ok(serverSource.includes("app.get('/api/management/research.csv',requireManagementRole(['researcher'])"));
assert.ok(serverSource.includes('getTeacherSessionsForManagement'));

const reflectionSource = await readFile('src/components/ReflectionScreen.tsx', 'utf8');
for (const marker of [
  '自分の考えを伝える','相手の話を聞いて分かる','新しい言葉や文化に気づいた',
  'わたしの学習履歴','対話時間 (TIME)','ターン数 (TURNS)','発話語数 (WORDS)','出会った語彙 (VOCAB)',
  '次の対話レポートが表示されます',
]) assert.ok(reflectionSource.includes(marker), `Reflection UI marker missing: ${marker}`);
assert.ok(!reflectionSource.includes('もう一度練習する'), 'Restart must not appear on reflection screen');
assert.ok(!reflectionSource.includes('RotateCcw'), 'Restart icon must not remain on reflection screen');

const appSource = await readFile('src/App.tsx', 'utf8');
assert.ok(appSource.includes("setPhase('feedback')"), 'Reflection completion must transition to feedback');
assert.ok(appSource.includes("onBack={()=>setPhase('feedback')}"), 'History must return to feedback report');
const reflectionRender = appSource.match(/phase==='reflection'[\s\S]*?<ReflectionScreen[\s\S]*?\/>/m)?.[0] || '';
assert.ok(reflectionRender.length > 0, 'Reflection render missing');
assert.ok(!reflectionRender.includes('onRestart='), 'Reflection screen must not receive restart action');

const feedbackSource = await readFile('src/components/FeedbackScreen.tsx', 'utf8');
for (const marker of [
  '留学生からのメッセージ','よくできたところ (Good Points)','今回学んだ単語',
  '次へのステップアップ (Next Step Advice)','重要キーフレーズ (Key Expressions)',
  '対話の文字起こしと日本語訳 (Dialogue Transcript & Japanese Translation)',
  '日本語訳','onRestart','もう一度練習する','StudentAvatar',
]) assert.ok(feedbackSource.includes(marker), `Feedback UI marker missing: ${marker}`);
assert.ok(!feedbackSource.includes('Metrics Row (Bento Grid)'), 'Feedback must not duplicate reflection metrics');
assert.ok(!feedbackSource.includes('対話時間 (Time)'), 'Feedback must not duplicate TIME metric card');
assert.ok(!feedbackSource.includes('ターン数 (Turns)'), 'Feedback must not duplicate TURNS metric card');
assert.ok(!feedbackSource.includes('発話語数 (Words)'), 'Feedback must not duplicate WORDS metric card');
assert.ok(!feedbackSource.includes('出会った語彙 (Vocab)'), 'Feedback must not duplicate VOCAB metric card');

const historySource = await readFile('src/components/LearningHistoryScreen.tsx', 'utf8');
for (const marker of ['1か月','3か月','6か月','全期間','表示項目','わたしの推移','これまでの対話一覧','ほかの人との比較やランキングは表示しません']) {
  assert.ok(historySource.includes(marker), `History UI marker missing: ${marker}`);
}

console.log('Functional learner/teacher/researcher UI contract QA: PASS');
