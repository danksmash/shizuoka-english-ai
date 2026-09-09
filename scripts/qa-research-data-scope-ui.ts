import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('src/server/managementPage.ts','utf8');
const dashboard = fs.readFileSync('src/server/researchDashboard.ts','utf8');
const server = fs.readFileSync('server.ts','utf8');

assert.ok(page.includes('データ区分'));
assert.ok(page.includes('value=\"main\" selected>本研究'));
assert.ok(page.includes('value=\"pilot_b\">Pilot B'));
assert.ok(page.includes('value=\"test\">テスト'));
assert.ok(page.includes('value=\"reserve\">予備'));
const grade = page.match(/<select id=\\?\"grade\\?\">([\s\S]*?)<\/select>/)?.[1] || '';
const klass = page.match(/<select id=\\?\"classId\\?\">([\s\S]*?)<\/select>/)?.[1] || '';
assert.ok(grade.includes('５年') && grade.includes('６年'));
assert.equal(grade.includes('Pilot B'), false);
assert.equal(grade.includes('テスト'), false);
assert.equal(grade.includes('予備'), false);
assert.ok(klass.includes('１組') && klass.includes('２組') && klass.includes('３組'));
assert.equal(klass.includes('Pilot B'), false);
assert.equal(klass.includes('テスト'), false);
assert.equal(klass.includes('予備'), false);
assert.ok(page.includes("p.set('dataScope','main')"));
assert.ok(page.includes('Pilot Bはデータ区分で「Pilot B」を明示選択'));
assert.ok(dashboard.includes("PILOT_B_OFFICIAL_DATES = new Set(['2026-09-09'])"));
assert.ok(dashboard.includes("return { ...query, dataScope: (!scope || scope === 'all') ? 'main' : scope }"));
assert.ok(server.includes('normalizeFormalResearchExportQuery(req.query)'));

console.log('Research data-scope UI/export contract QA: PASS');
