import fs from 'node:fs';
import assert from 'node:assert/strict';
import { getAppVersionMetadata, injectManagementVersionIntoBundle, isVersionedCommit } from './app-version';

const metadata = getAppVersionMetadata(new Date('2026-08-30T00:00:00+09:00'));
assert.match(metadata.version, /^1\.0\.\d+$/);
assert.equal(metadata.build, '2026-08-30');
assert.ok(metadata.history.length >= 4);
assert.equal(metadata.history[0].version, metadata.version);

// One logical change must increment Version once. A two-parent merge is never another change.
assert.equal(isVersionedCommit('fix: 教師・研究者画面のナビとVersion表示を整理', ['base', 'feature']), false);
assert.equal(isVersionedCommit('fix: 教師・研究者画面のナビとVersion表示を整理', ['base']), true);
assert.equal(isVersionedCommit('test: verify version history', ['base']), false);
assert.equal(metadata.history.filter((entry) => entry.changes === '教師・研究者画面のナビとVersion表示を整理').length, 1);

const viteConfig = fs.readFileSync('vite.config.ts', 'utf8');
const setupSource = fs.readFileSync('src/components/SetupScreen.tsx', 'utf8');
const versionSource = fs.readFileSync('scripts/app-version.ts', 'utf8');
const packageSource = fs.readFileSync('package.json', 'utf8');

// Learner UI must remain identical to the pre-version layout: no Version/Build injection or runtime DOM mutation.
assert.ok(setupSource.includes('className="setup-footer'));
assert.ok(!setupSource.includes('Version '));
assert.ok(!setupSource.includes('Build '));
assert.ok(!viteConfig.includes('learner-version-footer'));
assert.ok(!viteConfig.includes('.setup-footer::after'));
assert.ok(!viteConfig.includes('app-version-style'));
assert.ok(!viteConfig.includes('getAppVersionMetadata'));
assert.ok(!viteConfig.includes('MutationObserver'));
assert.ok(!versionSource.includes('MutationObserver'));
assert.ok(!packageSource.includes('app-version-postbuild'));

// Teacher/researcher Version/Build and version-history UI remain enabled.
const managementSource = fs.readFileSync('src/server/managementPage.ts', 'utf8');
const decorated = injectManagementVersionIntoBundle(managementSource, metadata);
assert.ok(decorated.includes('id="versionInfoBtn"'));
assert.ok(decorated.includes('>バージョン情報</button>'));
assert.ok(decorated.includes('id="versionInfo"'));
assert.ok(decorated.includes('id="versionBackBtn"'));
assert.ok(decorated.includes(`AI留学生えいご対話 Version ${metadata.version}　Build ${metadata.build}`));
assert.ok(decorated.includes('<th>Version</th><th>Build</th><th>主な変更内容</th>'));

// Version/Build footer appears exactly once, immediately below the login card, never on teacher/research dashboards.
assert.equal((decorated.match(/class="version-footer"/g) || []).length, 1);
assert.equal((decorated.match(/id="managementVersionFooter"/g) || []).length, 1);
const loginCard = decorated.indexOf('class="card login-card"');
const versionFooter = decorated.indexOf('id="managementVersionFooter"');
const panel = decorated.indexOf('<div id="panel"');
assert.ok(loginCard >= 0 && versionFooter > loginCard && panel > versionFooter);
const teacherStart = decorated.indexOf('<section id="teacherDashboard"');
const researchStart = decorated.indexOf('<section id="researchDashboard"');
const versionScreenStart = decorated.indexOf('<section id="versionInfo"');
assert.ok(teacherStart >= 0 && researchStart > teacherStart && versionScreenStart > researchStart);
assert.ok(!decorated.slice(teacherStart, researchStart).includes('version-footer'));
assert.ok(!decorated.slice(researchStart, versionScreenStart).includes('version-footer'));

// Header navigation separates page navigation from utility actions and highlights the current top-level page.
assert.ok(decorated.includes('class="nav-shell"'));
assert.ok(decorated.includes('class="nav-pages"'));
assert.ok(decorated.includes('class="nav-actions"'));
assert.ok(decorated.includes('class="secondary nav-page"'));
assert.ok(decorated.includes('class="secondary nav-action refresh-action"'));
assert.ok(decorated.includes('class="secondary nav-action logout-action"'));
assert.ok(decorated.includes('.nav-page.active'));
assert.ok(decorated.includes("versionInfo:'versionInfoBtn'"));
assert.equal((decorated.match(/id="lastUpdated"/g) || []).length, 1);
assert.equal((decorated.match(/id="versionInfoBtn"/g) || []).length, 1);

console.log(`Version UI QA PASS: ${metadata.version} / ${metadata.build} / ${metadata.history.length} history rows; merge commits do not bump Version; learner UI has no Version/Build display; management login has one footer and grouped navigation`);
