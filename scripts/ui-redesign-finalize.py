from pathlib import Path

p = Path('src/App.tsx')
s = p.read_text()
old = "    setIsSavingReflection(false);\n  };\n\n  const handleOpenHistory"
new = "    setIsSavingReflection(false);\n    setPhase('feedback');\n  };\n\n  const handleOpenHistory"
if old not in s:
    raise SystemExit('reflection submit marker not found')
s = s.replace(old, new, 1)
old = " onOpenHistory={learningDataEnabled && learningCode ? handleOpenHistory : undefined} onRestart={handleRestart}/>"
new = " onOpenHistory={learningDataEnabled && learningCode ? handleOpenHistory : undefined}/>"
if old not in s:
    raise SystemExit('reflection props marker not found')
s = s.replace(old, new, 1)
old = "onBack={()=>setPhase('reflection')}"
new = "onBack={()=>setPhase('feedback')}"
if old not in s:
    raise SystemExit('history back marker not found')
s = s.replace(old, new, 1)
p.write_text(s)

qa = Path('scripts/qa-management-page.ts')
qa.write_text(r'''import vm from 'node:vm';
import assert from 'node:assert/strict';
import { managementPageHtml } from '../src/server/managementPage';
import { readFile } from 'node:fs/promises';

const html = managementPageHtml();
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) throw new Error('Management page script not found');
new vm.Script(scriptMatch[1], { filename: 'management-page-inline.js' });
if (/onclick=/.test(html)) throw new Error('Inline onclick handlers are not allowed');
for (const marker of ['teacherDashboard','studentList','studentSummary','sessionDetail','codeManagement','researchDashboard','researchList','researchSummary','researchSession','researchQuality']) assert.ok(html.includes(`id="${marker}"`), `Management screen missing: ${marker}`);
for (const marker of ['teacherClass','teacherStart','teacherEnd','teacherMetric','teacherWeekly','teacherMonthly','teacherChart','listClass','listStart','listEnd','studentSearch','showUnused','summaryStart','summaryEnd','sumTurnsChart','sumWordsChart','newCode','newClass','reissueModal','reissueConfirm','researchStart','researchEnd','researchMetric','researchWeekly','researchMonthly','researchChart','researchClass','researchGrade','researchCompleteOnly','researchSearch','r4TurnChart','r4WordChart','r4ReflectionChart','r5Head','r5Reflection','r6Start','r6End','r6Class','r6Research','qNormal','qMissing','qDuplicate','qReview']) assert.ok(html.includes(`id="${marker}"`), `Functional UI control missing: ${marker}`);
assert.ok(html.includes('/api/management/research.csv'));
assert.ok(html.includes('/api/management/student-codes'));
assert.ok(html.includes('/api/management/sessions'));
assert.ok(html.includes("action:'reissue'"));
assert.ok(html.includes("action:'set-active'"));
assert.ok(html.includes('research-open'));
assert.ok(html.includes('r5-open'));
assert.ok(html.includes('downloadRows'));
assert.ok(html.includes('renderQuality'));
const loadResearchMatch = scriptMatch[1].match(/async function loadResearch\(\)\{([\s\S]*?)\}\nfunction setRoleUi/);
assert.ok(loadResearchMatch, 'loadResearch function not found');
assert.ok(loadResearchMatch![1].includes('/api/management/research.csv'));
assert.ok(!loadResearchMatch![1].includes('/api/management/sessions'), 'Researcher UI must not call raw teacher sessions endpoint');
const authSource = await readFile('src/server/auth.ts', 'utf8');
assert.ok(authSource.includes("path === '/api/management/research.csv'"));
assert.ok(authSource.includes('RESEARCHER_ANONYMIZED_DATA_ONLY'));
const serverSource = await readFile('server.ts', 'utf8');
assert.ok(serverSource.includes("requireManagementRole(['teacher'])"));
assert.ok(serverSource.includes('getTeacherSessionsForManagement'));
assert.ok(serverSource.includes("requireManagementRole(['researcher'])"));
const reflectionSource = await readFile('src/components/ReflectionScreen.tsx', 'utf8');
for (const marker of ['自分の考えを伝える','相手の話を聞いて分かる','新しい言葉や文化に気づいた','わたしの学習履歴','対話時間 (TIME)','ターン数 (TURNS)','発話語数 (WORDS)','出会った語彙 (VOCAB)']) assert.ok(reflectionSource.includes(marker), `Reflection UI marker missing: ${marker}`);
assert.ok(!reflectionSource.includes('もう一度練習する'), 'Retry button must not be on reflection screen');
const feedbackSource = await readFile('src/components/FeedbackScreen.tsx', 'utf8');
for (const marker of ['からのメッセージ','よくできたところ (Good Points)','今回学んだ単語 (Vocab Collection)','次へのステップアップ (Next Step Advice)','重要キーフレーズ (Key Expressions)','対話の文字起こしと日本語訳','日本語訳','もう一度練習する']) assert.ok(feedbackSource.includes(marker), `Feedback UI marker missing: ${marker}`);
assert.ok(!feedbackSource.includes('Metrics Row'), 'Feedback report must not render duplicated metric cards');
const appSource = await readFile('src/App.tsx', 'utf8');
assert.ok(appSource.includes("setIsSavingReflection(false);\n    setPhase('feedback');"), 'Reflection must advance to AI feedback report');
assert.ok(appSource.includes("onBack={()=>setPhase('feedback')}"), 'History must return to AI feedback report');
assert.ok(!appSource.includes('onOpenHistory={learningDataEnabled && learningCode ? handleOpenHistory : undefined} onRestart={handleRestart}/>}'), 'Reflection must not receive retry action');
console.log('Learner + teacher + researcher functional UI contract QA: PASS');
''')
