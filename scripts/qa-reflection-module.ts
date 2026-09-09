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
const serverEntry = read('server-entry.ts');
const app = read('src/App.tsx');
const dataContract = read('src/dataContract.ts');

requireText(main, "endsWith('/reflection')", 'main route');
requireText(main, 'ReflectionApp', 'main route');
requireText(reflection, "Today's Goal", 'reflection UI');
requireText(reflection, "Today's Reflection", 'reflection UI');
requireText(reflection, 'めあてに向かって学ぶことができましたか？', 'rating 1');
requireText(reflection, '考えたり工夫したりして学ぶことができましたか？', 'rating 2');
requireText(reflection, 'できたこと', 'hint');
requireText(reflection, 'よかった学び方', 'hint');
requireText(reflection, '授業中に考えていたこと', 'hint');
requireText(reflection, '気づいたこと', 'hint');
requireText(reflection, '友達のよかったところ', 'hint');
requireText(reflection, '疑問に思ったこと', 'hint');
requireText(reflection, '次に頑張りたいこと', 'hint');
requireText(css, 'min-height:210px', 'large reflection textarea');
forbidText(reflection, '静岡大学', 'reflection UI');
forbidText(reflection, '留学生', 'reflection UI');
forbidText(reflection, 'Unit', 'reflection UI');

requireText(routes, "router.post('/register'", 'reflection register API');
requireText(routes, "router.post('/bootstrap'", 'reflection bootstrap API');
requireText(routes, "router.post('/save'", 'reflection save API');
requireText(routes, "router.post('/history'", 'reflection history API');
requireText(routes, "router.post('/class'", 'reflection class API');
requireText(persistence, "const REFLECTION_COLLECTION = 'lesson_reflections'", 'separate reflection collection');
requireText(persistence, "const DEVICE_COLLECTION = 'reflection_devices'", 'separate device collection');
requireText(serverEntry, "this.use('/api/reflection'", 'server route mount');

// Protect the existing AI dialogue data contract and App from accidental reflection coupling.
forbidText(app, 'lesson_reflections', 'existing App');
forbidText(app, 'ReflectionApp', 'existing App');
forbidText(dataContract, 'lesson_reflections', 'existing AI data contract');

console.log('[qa:reflection] PASS');
