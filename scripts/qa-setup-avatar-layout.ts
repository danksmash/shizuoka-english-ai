import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('src/index.css', 'utf8');
assert.ok(css.includes('--setup-student-avatar-size: clamp(60px, 4.45vw, 76px)'));
assert.ok(css.includes('grid-template-columns: var(--setup-student-avatar-size) minmax(0, 1fr)'));
assert.ok(css.includes('min-width: var(--setup-student-avatar-size) !important'));
assert.ok(css.includes('max-width: var(--setup-student-avatar-size) !important'));
assert.ok(css.includes('> div:first-child > img'));
console.log('Setup avatar overlap guard: PASS');
