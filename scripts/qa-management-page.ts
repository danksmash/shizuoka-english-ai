import assert from 'node:assert/strict';
import fs from 'node:fs';
const page=fs.readFileSync('src/server/managementPage.ts','utf8');const server=fs.readFileSync('server.ts','utf8');
assert.ok(page.includes('研究データ管理'));assert.ok(page.includes('research.bundle.zip'));assert.ok(!page.includes('教師用管理'));assert.ok(!page.includes('学習者ID管理'));
assert.ok(server.includes("requireManagementRole(['researcher'])"));assert.ok(!server.includes("requireManagementRole(['teacher'])"));assert.ok(!server.includes("'/api/management/student-codes'"));assert.ok(!server.includes("'/api/management/sessions'"));
console.log('Research-only management QA: PASS');
