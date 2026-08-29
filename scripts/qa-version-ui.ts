import fs from 'node:fs';
import assert from 'node:assert/strict';
import { getAppVersionMetadata, injectManagementVersionIntoBundle } from './app-version';

const metadata = getAppVersionMetadata(new Date('2026-08-30T00:00:00+09:00'));
assert.match(metadata.version, /^1\.0\.\d+$/);
assert.equal(metadata.build, '2026-08-30');
assert.ok(metadata.history.length >= 4);
assert.equal(metadata.history[0].version, metadata.version);

const viteConfig = fs.readFileSync('vite.config.ts', 'utf8');
const setupSource = fs.readFileSync('src/components/SetupScreen.tsx', 'utf8');
const versionSource = fs.readFileSync('scripts/app-version.ts', 'utf8');
const packageSource = fs.readFileSync('package.json', 'utf8');

assert.ok(viteConfig.includes("name: 'learner-version-footer'"));
assert.ok(viteConfig.includes('transformIndexHtml'));
assert.ok(viteConfig.includes('.setup-footer::after'));
assert.ok(viteConfig.includes('id="app-version-style"'));
assert.ok(viteConfig.includes('getAppVersionMetadata'));
assert.ok(setupSource.includes('className="setup-footer'));
assert.ok(!viteConfig.includes('MutationObserver'));
assert.ok(!versionSource.includes('MutationObserver'));
assert.ok(!packageSource.includes('app-version-postbuild'));

const managementSource = fs.readFileSync('src/server/managementPage.ts', 'utf8');
const decorated = injectManagementVersionIntoBundle(managementSource, metadata);
assert.ok(decorated.includes('id="versionInfoBtn"'));
assert.ok(decorated.includes('>バージョン情報</button>'));
assert.ok(decorated.includes('id="versionInfo"'));
assert.ok(decorated.includes('id="versionBackBtn"'));
assert.ok(decorated.includes(`AI留学生えいご対話 Version ${metadata.version}　Build ${metadata.build}`));
assert.equal((decorated.match(/class="version-footer"/g) || []).length, 2);
assert.ok(decorated.indexOf('class="version-footer"') > decorated.indexOf('id="teacherDashboard"'));
assert.ok(decorated.lastIndexOf('class="version-footer"') > decorated.indexOf('id="researchDashboard"'));
assert.ok(decorated.includes('<th>Version</th><th>Build</th><th>主な変更内容</th>'));

console.log(`Version UI QA PASS: ${metadata.version} / ${metadata.build} / ${metadata.history.length} history rows; learner footer uses static build-time CSS`);
