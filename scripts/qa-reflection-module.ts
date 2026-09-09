import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');
const fail = (message: string): never => { throw new Error(`[qa:reflection] ${message}`); };
const requireText = (source: string, needle: string, label: string) => { if (!source.includes(needle)) fail(`${label} missing: ${needle}`); };
const forbidText = (source: string, needle: string, label: string) => { if (source.includes(needle)) fail(`${label} must not contain: ${needle}`); };

const main = read('src/main.tsx');
const reflection = read('src/reflection/ReflectionApp.tsx');
const css = read('src/reflection/reflection.css');
const routes = read('src/server/reflectionRoutes.ts');
const persistence = read('src/server/reflectionPersistence.ts');
const teacher = read('src/reflection/ReflectionTeacherApp.tsx');
const teacherModel = read('src/server/reflectionTeacherModel.ts');
const serverEntry = read('server-entry.ts');
const app = read('src/App.tsx');
const dataContract = read('src/dataContract.ts');
const viteConfig = read('vite.config.ts');
const packageJson = read('package.json');

requireText(main, "endsWith('/reflection')", 'pupil route');
requireText(main, "endsWith('/reflection/teacher')", 'teacher route');
requireText(main, 'ReflectionTeacherApp', 'teacher route');
requireText(reflection, "Today's Goal", 'reflection UI');
requireText(reflection, "Today's Reflection", 'reflection UI');
for (const label of ['できたこと','使ったことば','授業中に考えていたこと','困ったこと・工夫','言葉や文化について気づいたこと','次に頑張りたいこと']) requireText(reflection, label, 'six-part reflection UI');
for (const field of ['achievements','languageUsed','thinking','difficultyStrategy','languageCultureAwareness','nextGoal']) {
  requireText(routes, field, 'reflection API');
  requireText(persistence, field, 'reflection persistence');
}
requireText(reflection, '6項目 合計', 'own-writing character count');
requireText(css, 'min-height:145px', 'large writing fields');
requireText(reflection, '前回の「次に頑張りたいこと」', 'next-lesson bridge');
forbidText(reflection, 'めあてに向かって学ぶことができましたか？', 'obsolete five-point item');
forbidText(reflection, '考えたり工夫したりして学ぶことができましたか？', 'obsolete five-point item');
forbidText(reflection, '静岡大学', 'reflection UI');
forbidText(reflection, '留学生', 'reflection UI');
forbidText(reflection, 'Unit', 'reflection UI');

requireText(routes, "router.post('/register'", 'reflection register API');
requireText(routes, "router.post('/bootstrap'", 'reflection bootstrap API');
requireText(routes, "router.post('/save'", 'reflection save API');
requireText(routes, "router.post('/history'", 'reflection history API');
requireText(routes, "router.post('/class'", 'reflection class API');
requireText(routes, "router.post('/teacher/login'", 'teacher login API');
requireText(routes, "router.post('/teacher/dashboard'", 'teacher dashboard API');
requireText(routes, "router.post('/teacher/student'", 'teacher student API');
requireText(routes, "router.post('/teacher/export.csv'", 'teacher CSV API');
requireText(routes, "requireManagementRole(['teacher'])", 'teacher authorization');
requireText(routes, 'function publicReflection', 'student response redaction');
forbidText(routes, 'researchId: record.researchId', 'student API response');
requireText(persistence, "const REFLECTION_COLLECTION = 'lesson_reflections'", 'separate reflection collection');
requireText(persistence, "const DEVICE_COLLECTION = 'reflection_devices'", 'separate device collection');
requireText(persistence, 'reflectionText: string;', 'legacy reflection-text compatibility');
requireText(persistence, 'goalRating: number | null;', 'legacy goal-rating compatibility');
requireText(persistence, 'selfRegulationRating: number | null;', 'legacy self-regulation compatibility');
requireText(persistence, 'normalizeStoredRecord', 'legacy normalization');
requireText(teacher, '提出済み', 'teacher status');
requireText(teacher, '未入力', 'teacher missing visibility');
requireText(teacher, 'CSV', 'teacher CSV button');
requireText(teacherModel, 'legacy_reflection_text', 'CSV backward compatibility');
requireText(serverEntry, "this.use('/api/reflection'", 'server route mount');

// Nested routes must load JS/CSS correctly on both GitHub Pages and Cloud Run.
requireText(viteConfig, "process.env.VITE_DEPLOY_TARGET === 'pages'", 'deployment-specific Vite base');
requireText(viteConfig, "'/shizuoka-english-ai/'", 'GitHub Pages base');
requireText(viteConfig, " : '/'", 'Cloud Run root base');
requireText(packageJson, 'VITE_DEPLOY_TARGET=pages vite build', 'Pages build target');
requireText(packageJson, 'dist/reflection/teacher', 'teacher static route');
requireText(packageJson, '"build": "vite build && npm run build:server"', 'Cloud Run build isolation');
forbidText(packageJson, '"build": "npm run build:pages', 'Cloud Run must not reuse Pages asset base');

// Protect the existing AI dialogue data contract and App from accidental reflection coupling.
forbidText(app, 'lesson_reflections', 'existing App');
forbidText(app, 'ReflectionApp', 'existing App');
forbidText(dataContract, 'lesson_reflections', 'existing AI data contract');

console.log('[qa:reflection] PASS');
