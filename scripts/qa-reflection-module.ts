import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');
const fail = (message: string): never => { throw new Error(`[qa:reflection] ${message}`); };
const requireText = (source: string, needle: string, label: string) => { if (!source.includes(needle)) fail(`${label} missing: ${needle}`); };
const forbidText = (source: string, needle: string, label: string) => { if (source.includes(needle)) fail(`${label} must not contain: ${needle}`); };
const requireOrder = (source: string, needles: string[], label: string) => {
  let cursor = -1;
  for (const needle of needles) {
    const next = source.indexOf(needle, cursor + 1);
    if (next < 0 || next <= cursor) fail(`${label} order mismatch at: ${needle}`);
    cursor = next;
  }
};

const main = read('src/main.tsx');
const reflection = read('src/reflection/ReflectionApp.tsx');
const css = read('src/reflection/reflection-b.css');
const routes = read('src/server/reflectionRoutes.ts');
const persistence = read('src/server/reflectionPersistence.ts');
const firestore = read('src/server/firestore.ts');
const teacher = read('src/reflection/ReflectionTeacherApp.tsx');
const teacherModel = read('src/server/reflectionTeacherModel.ts');
const serverEntry = read('server-entry.ts');
const app = read('src/App.tsx');
const dataContract = read('src/dataContract.ts');
const viteConfig = read('vite.config.ts');
const packageJson = read('package.json');

// Routing and module isolation.
requireText(main, "endsWith('/reflection')", 'pupil route');
requireText(main, "endsWith('/reflection/teacher')", 'teacher route');
requireText(main, 'ReflectionTeacherApp', 'teacher route');
requireText(main, "./reflection/reflection-b.css", 'B-design styles');
requireText(serverEntry, "this.use('/api/reflection'", 'server route mount');
forbidText(app, 'lesson_reflections', 'existing AI App');
forbidText(app, 'ReflectionApp', 'existing AI App');
forbidText(dataContract, 'lesson_reflections', 'existing AI data contract');

// Canonical pupil B-design: previous reflection + hints + submit on left; goal + two fixed 5-point items + one large free reflection on right.
for (const label of ['振り返り','私の成長','みんなの振り返り']) requireText(reflection, label, 'top navigation');
requireText(reflection, 'meg-entry-grid', 'fixed B two-column layout');
requireText(reflection, 'meg-entry-left', 'left column');
requireText(reflection, 'meg-entry-right', 'right column');
requireOrder(reflection, ['meg-entry-left','meg-entry-previous','meg-entry-hints','meg-submit-panel','meg-entry-right','meg-entry-goal','meg-entry-ratings','meg-entry-reflection'], 'B-layout source');
requireText(reflection, '今日のめあて', 'goal field');
requireText(reflection, '5件法のふりかえり', 'five-point reflection section');
requireText(reflection, '今日のふりかえり', 'free reflection field');
requireText(reflection, '今日のめあてに向かって学ぶことができましたか？', 'goal rating');
requireText(reflection, '自分で考えたり、工夫したりしながら学ぶことができましたか？', 'self-regulation rating');
requireText(reflection, 'goalRating', 'goal rating state');
requireText(reflection, 'selfRegulationRating', 'self-regulation state');
requireText(reflection, 'reflectionText', 'single free reflection field');
requireText(reflection, 'meg-main-reflection', 'large reflection field');
requireText(reflection, '<Send />', 'submit icon');
requireText(reflection, "'送信する'", 'left-column submit action');
for (const hint of ['できたこと','よかった学び方','授業中に考えていたこと','気づいたこと','友達のよかったところ','疑問に思ったこと','次に頑張りたいこと']) requireText(reflection, hint, 'reflection hint');
requireText(reflection, '全部を書く必要はありません', 'optional hints guidance');
forbidText(reflection, 'meg-side-note', 'removed next-lesson side card');
forbidText(reflection, 'Chromebook想定', 'implementation-only viewport badge');
forbidText(reflection, 'スクロールなし', 'implementation-only viewport badge');

// Chromebook viewport guards: equal-height columns, compact no-page-scroll entry mode, and flexible writing space.
requireText(css, '.meg-entry-left,.meg-entry-right', 'paired equal-height columns');
requireText(css, 'height:100%', 'equal-height column rule');
requireText(css, 'grid-template-rows:minmax(0,1fr) auto auto', 'left column vertical distribution');
requireText(css, 'grid-template-rows:auto auto minmax(0,1fr)', 'right column vertical distribution');
requireText(css, '.meg-app:has(.meg-entry-grid){height:100dvh;min-height:0;overflow:hidden}', 'desktop entry viewport containment');
requireText(css, '.meg-main-reflection textarea', 'large reflection textarea styling');
requireText(css, 'flex:1', 'flexible writing-area growth');
requireText(css, '@media (max-height:680px)', 'short Chromebook viewport compaction');
requireText(css, '@media (max-width:1099px)', 'narrow-screen scrolling fallback');

// Autosave, draft isolation, and current B-data contract must remain intact.
requireText(reflection, 'draftKey = (token: string)', 'per-device local draft key');
requireText(reflection, "timeZone: 'Asia/Tokyo'", 'Tokyo day boundary');
requireText(reflection, 'local.savedAt > serverUpdatedAt', 'local/server draft freshness comparison');
requireText(reflection, 'onRecordSaved', 'parent bootstrap refresh');
requireText(reflection, 'window.clearTimeout(timerRef.current)', 'submit/autosave timer cancellation');
requireText(reflection, '}, 1000);', 'one-second draft autosave debounce');
requireText(reflection, 'saveReflectionGoal', 'goal-specific autosave');
requireText(reflection, 'onBlur={() => void flushGoalAutosave()}', 'goal blur autosave flush');
requireText(reflection, "window.addEventListener('pagehide', flushBeforeLeave)", 'goal page-leave autosave flush');
requireText(read('src/reflection/reflectionApi.ts'), 'keepalive: options?.keepalive === true', 'keepalive autosave request');
forbidText(reflection, 'めあてを保存', 'manual goal-save button');
requireText(reflection, 'もう一度読み込む', 'transient bootstrap retry');
requireText(reflection, 'REFLECTION_DEVICE_REBIND_REQUIRED', 'stale device rebind');
forbidText(reflection, 'Unit', 'reflection UI');
forbidText(reflection, '静岡大学', 'reflection UI');
forbidText(reflection, '留学生', 'reflection UI');

// APIs and security/linkage.
for (const route of ["router.post('/register'", "router.post('/bootstrap'", "router.post('/save'", "router.post('/history'", "router.post('/class'", "router.post('/teacher/login'", "router.post('/teacher/dashboard'", "router.post('/teacher/student'", "router.post('/teacher/export.csv'"]) requireText(routes, route, 'reflection route');
requireText(routes, "requireManagementRole(['teacher'])", 'teacher authorization');
requireText(routes, 'function publicReflection', 'pupil response redaction');
forbidText(routes, 'researchId: record.researchId', 'pupil API response');
requireText(routes, 'resolveStudentByCode(registered.learningId)', 'current student linkage validation');
requireText(routes, 'REFLECTION_DEVICE_REBIND_REQUIRED', 'stale device rejection');
requireText(routes, 'TOO_MANY_FAILED_CODE_ATTEMPTS', 'learning-code brute-force protection');
requireText(routes, 'REFLECTION_CLASS_NOT_ASSIGNED', 'class-assignment registration guard');
requireText(reflection, '学級が設定されていません', 'class-assignment pupil guidance');
forbidText(reflection, 'ReflectionTextarea', 'six-part textarea regression');
forbidText(reflection, 'meg-fields-stack', 'six-part textarea regression');

// Persistence: canonical current schema plus non-destructive compatibility with the temporary six-part deployment.
requireText(persistence, "const REFLECTION_COLLECTION = 'lesson_reflections'", 'separate reflection collection');
requireText(persistence, "const DEVICE_COLLECTION = 'reflection_devices'", 'separate device collection');
for (const field of ['todayGoal','goalRating','selfRegulationRating','reflectionText']) requireText(persistence, `${field}:`, 'canonical reflection persistence');
for (const legacy of ['achievements','languageUsed','thinking','difficultyStrategy','languageCultureAwareness','nextGoal']) requireText(persistence, `${legacy}:`, 'six-part backward compatibility');
requireText(persistence, "input.status === 'submitted' || existing?.status === 'submitted'", 'monotonic submitted status');
requireText(persistence, 'queryCollectionByEqualities', 'exact class/date peer query');
requireText(firestore, 'export async function queryCollectionByEqualities', 'multi-field Firestore query');
requireText(firestore, 'compositeFilter', 'AND equality query');

// Teacher UI and export consistency.
requireText(teacher, '提出済み', 'teacher submitted status');
requireText(teacher, '未入力', 'teacher missing visibility');
requireText(teacher, 'CSV', 'teacher CSV button');
requireText(teacher, '自己評価', 'teacher B-design table');
requireText(teacher, 'データ区分', 'teacher data-scope filter');
requireText(teacher, 'Pilot B', 'teacher Pilot B filter');
requireText(teacher, '学年', 'teacher grade filter');
requireText(teacher, 'classNumber', 'teacher class-number filter');
requireText(read('src/reflection/reflectionTeacherApi.ts'), 'dataScope, grade, classNumber', 'teacher API filter linkage');
requireText(teacherModel, 'reflectionDataScopeForClassId', 'teacher cohort classification');
requireText(teacherModel, "'goal_rating'", 'CSV goal rating');
requireText(teacherModel, "'self_regulation_rating'", 'CSV self-regulation rating');
requireText(teacherModel, "'reflection_text'", 'CSV free reflection');
requireText(teacherModel, "if (/^\\s*[=+\\-@]/.test(text))", 'CSV formula-injection guard');
forbidText(teacherModel, "'research_id'", 'teacher CSV internal research id');
forbidText(teacherModel, "'student_id'", 'teacher CSV internal student id');

// Nested routes must load JS/CSS correctly on both GitHub Pages and Cloud Run.
requireText(viteConfig, "process.env.VITE_DEPLOY_TARGET === 'pages'", 'deployment-specific Vite base');
requireText(viteConfig, "'/shizuoka-english-ai/'", 'GitHub Pages base');
requireText(viteConfig, " : '/'", 'Cloud Run root base');
requireText(packageJson, 'VITE_DEPLOY_TARGET=pages vite build', 'Pages build target');
requireText(packageJson, 'dist/reflection/teacher', 'teacher static route');
requireText(packageJson, '"build": "vite build && npm run build:server"', 'Cloud Run build isolation');
forbidText(packageJson, '"build": "npm run build:pages', 'Cloud Run must not reuse Pages asset base');

console.log('[qa:reflection] PASS: fixed B layout, Chromebook viewport, storage integrity, privacy, compatibility, and deployment guards verified.');
