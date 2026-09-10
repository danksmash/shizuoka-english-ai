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
const reflectionApi = read('src/reflection/reflectionApi.ts');
const teacherApi = read('src/reflection/reflectionTeacherApi.ts');
const serverEntry = read('server-entry.ts');
const app = read('src/App.tsx');
const dataContract = read('src/dataContract.ts');
const viteConfig = read('vite.config.ts');
const packageJson = read('package.json');

// Routing and isolation from the AI dialogue application.
requireText(main, "endsWith('/reflection')", 'pupil route');
requireText(main, "endsWith('/reflection/teacher')", 'teacher route');
requireText(main, 'ReflectionTeacherApp', 'teacher route');
requireText(main, "./reflection/reflection-b.css", 'B-design styles');
requireText(serverEntry, "this.use('/api/reflection'", 'server route mount');
forbidText(app, 'lesson_reflections', 'existing AI App');
forbidText(app, 'ReflectionApp', 'existing AI App');
forbidText(dataContract, 'lesson_reflections', 'existing AI data contract');

// Approved pupil B visual specification.
requireText(reflection, 'My English Growth <span>— わたしの英語の学び</span>', 'approved brand title');
requireText(reflection, '<CalendarDays />{dateLabel}', 'header date');
requireText(reflection, '<UserRound />ID: {learningId}', 'header learner id');
for (const label of ['振り返り','私の成長','みんなの振り返り']) requireText(reflection, label, 'top navigation');
requireText(reflection, 'meg-entry-grid', 'fixed B two-column layout');
requireOrder(reflection, ['meg-entry-left','meg-entry-previous','meg-entry-hints','meg-submit-panel','meg-entry-right','meg-entry-goal','meg-entry-ratings','meg-entry-reflection'], 'B-layout source');
requireText(reflection, '前回のふりかえり', 'previous reflection');
requireText(reflection, '今日のめあて', 'goal field');
requireText(reflection, 'ふりかえりポイント', 'reflection points section');
requireText(reflection, '今日のふりかえり', 'free reflection field');
requireText(reflection, 'めあてに向かって取り組めた', 'item 1 wording');
requireText(reflection, '相手の話を聞いて分かろうとしたり，自分の気持ちを伝えようとしたりした', 'item 2 wording');
requireText(reflection, 'aria-label="1はできなかった、4はよくできた"', 'four-point scale meaning');
requireText(reflection, '[1, 2, 3, 4].map', 'four rating choices');
forbidText(reflection, '[1, 2, 3, 4, 5].map', 'five-point rating choices');
requireText(reflection, 'meg-scale-one', 'low scale anchor');
requireText(reflection, 'meg-scale-four', 'high scale anchor');
forbidText(reflection, 'meg-scale-five', 'obsolete five-point high anchor');
requireText(reflection, 'meg-rating-dot', 'circular rating control');
requireText(reflection, '<Send />', 'submit icon');
for (const hint of ['できたこと','わかったこと','つたえられたこと','聞けたこと','学び方を工夫した','考えていたこと','くふうしたこと','気づいたこと','次にがんばりたいこと']) requireText(reflection, hint, 'approved reflection hint');
requireText(reflection, '全部を書く必要はありません。', 'optional hints guidance');
requireText(reflection, '小さなふりかえりが、大きな成長につながります。', 'approved footer message');
requireText(reflection, 'Better English. A Brighter You!', 'approved footer motto');
forbidText(reflection, '5件法のふりかえり', 'superseded research-facing heading');
forbidText(reflection, 'Chromebook想定', 'implementation-only viewport badge');
forbidText(reflection, 'スクロールなし', 'implementation-only viewport badge');

// Visual/typography guards.
requireText(css, 'grid-template-columns:minmax(410px,.61fr) minmax(0,1fr)', 'reference column ratio');
requireText(css, 'background:linear-gradient(180deg,#e8f7ff 0 58px,#fff 58px)', 'blue section header band');
requireText(css, 'background:linear-gradient(180deg,#e9fae8 0 58px,#fff 58px)', 'green goal header band');
requireText(css, 'font-size:clamp(16.5px,1.08vw,18.5px)', 'approved pupil writing size');
requireText(css, 'font-size:clamp(21px,1.38vw,24px)', 'approved section heading size');
requireText(css, 'font-size:clamp(15px,1vw,17px)', 'approved rating statement size');
requireText(css, 'border-radius:50%', 'round rating control');
requireText(css, '.meg-hint-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))', 'three-column hint chips');
requireText(css, '.meg-rating-scale-labels{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))', 'four-column scale anchors');
requireText(css, '.meg-rating-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))', 'four equal rating columns');
forbidText(css, '.meg-rating-row{display:grid;grid-template-columns:repeat(5,minmax(0,1fr))', 'obsolete five-column rating grid');
requireText(css, '.meg-rating-scale-labels .meg-scale-one,.meg-rating-scale-labels .meg-scale-four', 'scale alignment selectors');
requireText(css, '.meg-entry-left,.meg-entry-right{display:grid', 'paired equal-height columns');
requireText(css, 'grid-template-rows:minmax(0,1.3fr) auto auto', 'left vertical balance');
requireText(css, 'grid-template-rows:auto auto minmax(0,1fr)', 'three-line goal with reflection absorbing remaining height');
requireText(css, '.meg-app:has(.meg-entry-grid){height:100dvh;min-height:0;overflow:hidden}', 'desktop viewport containment');
requireText(css, '@media (max-height:700px)', 'short Chromebook viewport compaction');
requireText(css, '.meg-entry-previous .meg-previous-summary{font-size:16px!important;line-height:1.55!important;overflow:hidden!important}', 'short-height previous no-scroll auto-fit base');
requireText(css, '.meg-entry-goal textarea{font-size:16px', 'short-height goal text floor');
requireText(css, '.meg-main-reflection textarea{font-size:16px', 'short-height reflection text floor');
requireText(css, '.meg-section-title h2,.meg-entry-hints .meg-hints-head h2{font-size:21px}', 'short-height section heading floor');
requireText(css, '.meg-entry-ratings .meg-rating-block h3{font-size:14.5px}', 'short-height rating text floor');
requireText(css, '@media (max-width:1099px)', 'narrow-screen scrolling fallback');

// Canonical four-point data and autosave behavior.
for (const field of ['goalRating','communicationRating','reflectionText']) requireText(reflection, field, 'canonical pupil data');
forbidText(reflection, 'selfRegulationRating', 'obsolete second rating field');
forbidText(reflection, 'ratingSchemaVersion', 'obsolete rating schema version');
forbidText(reflection, 'achievements', 'obsolete six-part fields');
requireText(reflection, 'my-english-growth-draft-goal150-reflection600-', 'new local-draft namespace');
requireText(reflection, 'const GOAL_MAX_CHARS = 150', 'goal 150-character limit');
requireText(reflection, 'const REFLECTION_MAX_CHARS = 600', 'reflection 600-character limit');
requireText(reflection, 'rows={3}', 'three visible goal rows');
requireText(reflection, 'maxLength={GOAL_MAX_CHARS}', 'goal browser max length');
requireText(reflection, 'maxLength={REFLECTION_MAX_CHARS}', 'reflection browser max length');
requireText(reflection, 'AutoFitPreviousReflection', 'previous reflection auto-fit');
requireText(reflection, 'data-auto-fit="true"', 'previous reflection auto-fit marker');
forbidText(reflection, 'previousSummary', 'truncated previous reflection');
forbidText(reflection, 'slice(0, 1000)', 'obsolete goal client limit');
forbidText(reflection, 'slice(0, 12000)', 'obsolete reflection client limit');
requireText(reflection, 'Number(candidate) <= 4', 'local draft four-point validation');
requireText(reflection, "timeZone: 'Asia/Tokyo'", 'Tokyo day boundary');
requireText(reflection, 'local.savedAt > serverUpdatedAt', 'local/server draft freshness comparison');
requireText(reflection, 'window.clearTimeout(timerRef.current)', 'submit/autosave timer cancellation');
requireText(reflection, '}, 1000);', 'one-second draft autosave debounce');
requireText(reflection, 'saveReflectionGoal', 'goal-specific autosave');
requireText(reflection, 'onBlur={() => void flushGoalAutosave()}', 'goal blur autosave flush');
requireText(reflection, "window.addEventListener('pagehide', flushBeforeLeave)", 'goal page-leave autosave flush');
requireText(reflectionApi, 'keepalive: options?.keepalive === true', 'keepalive autosave request');
requireText(reflectionApi, 'communicationRating: number | null', 'API communication rating');
forbidText(reflectionApi, 'selfRegulationRating', 'obsolete API second rating');
forbidText(reflectionApi, 'RatingSchemaVersion', 'obsolete API rating versioning');
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
requireText(routes, 'communicationRating: record.communicationRating', 'public communication rating');
requireText(routes, 'communicationRating: req.body?.communicationRating', 'save communication rating');
forbidText(routes, 'selfRegulationRating', 'obsolete route rating field');
forbidText(routes, 'ratingSchemaVersion', 'obsolete route schema version');
forbidText(routes, 'researchId: record.researchId', 'pupil API response');
requireText(routes, 'resolveStudentByCode(registered.learningId)', 'current student linkage validation');
requireText(routes, 'REFLECTION_DEVICE_REBIND_REQUIRED', 'stale device rejection');
requireText(routes, 'TOO_MANY_FAILED_CODE_ATTEMPTS', 'learning-code brute-force protection');
requireText(routes, 'REFLECTION_CLASS_NOT_ASSIGNED', 'class-assignment registration guard');
requireText(reflection, '学級が設定されていません', 'class-assignment pupil guidance');

// Persistence: one clean four-point schema. Device linkage remains separate.
requireText(persistence, "const REFLECTION_COLLECTION = 'lesson_reflections'", 'separate reflection collection');
requireText(persistence, "const DEVICE_COLLECTION = 'reflection_devices'", 'separate device collection');
for (const field of ['todayGoal','goalRating','communicationRating','reflectionText']) requireText(persistence, `${field}:`, 'canonical reflection persistence');
requireText(persistence, 'parsed >= 1 && parsed <= 4', 'server four-point validation');
requireText(persistence, 'const GOAL_MAX_CHARS = 150', 'server goal limit');
requireText(persistence, 'const REFLECTION_MAX_CHARS = 600', 'server reflection limit');
requireText(persistence, 'cleanText(row.todayGoal, GOAL_MAX_CHARS)', 'stored goal normalization');
requireText(persistence, 'cleanText(row.reflectionText, REFLECTION_MAX_CHARS)', 'stored reflection normalization');
forbidText(persistence, 'selfRegulationRating', 'obsolete persistence rating');
forbidText(persistence, 'ratingSchemaVersion', 'obsolete persistence versioning');
for (const legacy of ['achievements','languageUsed','difficultyStrategy','languageCultureAwareness','nextGoal']) forbidText(persistence, `${legacy}:`, 'obsolete six-part persistence');
requireText(persistence, "input.status === 'submitted' || existing?.status === 'submitted'", 'monotonic submitted status');
requireText(persistence, 'queryCollectionByEqualities', 'exact class/date peer query');
requireText(firestore, 'export async function queryCollectionByEqualities', 'multi-field Firestore query');
requireText(firestore, 'compositeFilter', 'AND equality query');

// Teacher UI and export consistency.
requireText(teacher, '提出済み', 'teacher submitted status');
requireText(teacher, '未入力', 'teacher missing visibility');
requireText(teacher, 'ふりかえりポイント', 'teacher B-design table');
requireText(teacher, 'めあてへの取組', 'teacher item 1 summary');
requireText(teacher, '聞く・伝える', 'teacher item 2 summary');
requireText(teacher, 'communicationRating', 'teacher communication rating');
requireText(teacher, '/4', 'teacher four-point denominator');
forbidText(teacher, 'selfRegulationRating', 'obsolete teacher second rating');
forbidText(teacher, 'ratingSchemaVersion', 'obsolete teacher rating versioning');
requireText(teacher, 'データ区分', 'teacher data-scope filter');
requireText(teacher, 'Pilot B', 'teacher Pilot B filter');
requireText(teacher, '学年', 'teacher grade filter');
requireText(teacher, 'classNumber', 'teacher class-number filter');
requireText(teacherApi, 'communicationRating: number | null', 'teacher API communication rating');
forbidText(teacherApi, 'selfRegulationRating', 'obsolete teacher API rating');
forbidText(teacherApi, 'RatingSchemaVersion', 'obsolete teacher API versioning');
requireText(teacherApi, 'dataScope, grade, classNumber', 'teacher API filter linkage');
requireText(teacherModel, 'reflectionDataScopeForClassId', 'teacher cohort classification');
requireText(teacherModel, "'goal_rating'", 'CSV goal rating');
requireText(teacherModel, "'communication_rating'", 'CSV communication rating');
requireText(teacherModel, "'rating_scale_min'", 'CSV scale minimum');
requireText(teacherModel, "'rating_scale_max'", 'CSV scale maximum');
requireText(teacherModel, "'rating_item_1'", 'CSV rating item 1 label');
requireText(teacherModel, "'rating_item_2'", 'CSV rating item 2 label');
requireText(teacherModel, "'reflection_text'", 'CSV free reflection');
forbidText(teacherModel, "'self_regulation_rating'", 'obsolete CSV rating column');
forbidText(teacherModel, "'rating_schema_version'", 'obsolete CSV version column');
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

console.log('[qa:reflection] PASS: canonical four-point Reflection UI/data schema, anchored 1/4 scale labels, nine hints, autosave integrity, privacy, and deployment guards verified.');
