import assert from 'node:assert/strict';
import fs from 'node:fs';

const setup = fs.readFileSync('src/components/SetupScreen.tsx', 'utf8');
const css = fs.readFileSync('src/setup-screen-v2.css', 'utf8');
const polish = fs.readFileSync('src/setup-screen-v2-polish.css', 'utf8');
const main = fs.readFileSync('src/main.tsx', 'utf8');

assert.ok(setup.includes('setup-v2-main'), 'setup must expose the v2 main grid');
assert.ok(setup.includes('setup-v2-student-section'), 'setup must expose the v2 student section');
assert.ok(setup.includes('setup-v2-controls'), 'setup must expose the v2 controls column');
assert.ok(setup.includes('<h1>AI留学生えいご対話プラクティス</h1>'), 'setup title must use the approved wording');
assert.equal(setup.includes('AI留学生 1対1 えいご対話プラクティス'), false, 'old 1-to-1 wording must be removed from the setup title');

assert.ok(
  css.includes('grid-template-rows: auto minmax(0, 1fr) auto'),
  'setup shell must give the remaining viewport height to main between header and footer',
);
assert.ok(
  css.includes('grid-template-columns: minmax(0, 1.32fr) minmax(0, 1fr)') && css.includes('align-items: stretch'),
  'desktop main grid must share one stretched row across the left and right columns',
);
assert.ok(
  css.includes('grid-template-rows: auto minmax(0, 1fr)') && css.includes('grid-template-rows: repeat(4, minmax(0, 1fr))'),
  'left section must reserve one heading row and distribute the remaining height across four equal persona rows',
);
assert.ok(
  css.includes('grid-template-rows: minmax(0, 1fr) auto auto auto'),
  'right column must let the profile absorb remaining height above topic, duration, and start controls',
);

assert.ok(
  polish.includes('font-size: clamp(17px, 1.18vw, 21px);'),
  'steps 1-3 headings must share the approved larger desktop size',
);
assert.ok(
  polish.includes('width: clamp(32px, 2.15vw, 38px);') && polish.includes('font-size: clamp(16px, 1.08vw, 19px);'),
  'steps 1-3 number circles must scale with the larger headings',
);
assert.ok(
  polish.includes('grid-template-columns: minmax(0, 1fr) minmax(220px, 38%);'),
  'selected profile must allocate more width to the portrait without forcing a fixed card height',
);
assert.ok(
  polish.includes('width: min(100%, clamp(220px, 18vw, 300px));'),
  'selected persona portrait must be enlarged to absorb profile whitespace',
);
assert.equal(/\.setup-v2-profile\s*\{[^}]*\bheight\s*:/s.test(polish), false, 'profile balance must not be implemented with a fixed profile height');

assert.ok(polish.includes('font-size: clamp(15px, 1.12vw, 20px);'), 'profile country text must be larger');
assert.ok(polish.includes('font-size: clamp(24px, 1.85vw, 34px);'), 'profile English name must be larger');
assert.ok(polish.includes('font-size: clamp(14px, 1.04vw, 18px);'), 'profile Japanese name must be larger');
assert.ok(polish.includes('font-size: clamp(14px, 1.02vw, 18px);'), 'profile age/city text must be larger');
assert.ok(polish.includes('font-size: clamp(10.5px, 0.8vw, 13.5px);'), 'profile bio text must be larger');
assert.ok(polish.includes('font-size: clamp(10.5px, 0.76vw, 13px);'), 'profile fact text must be larger');

assert.ok(
  css.includes('.setup-v2-topic-grid button > span {\n  font-size: clamp(10px, 0.76vw, 13px);'),
  'Japanese topic title size must remain unchanged',
);
assert.equal(polish.includes('.setup-v2-topic-grid button > span'), false, 'polish must not override Japanese topic title size');
assert.ok(
  polish.includes('font-size: clamp(9.5px, 0.68vw, 12px);'),
  'English topic subtitle must be enlarged',
);
assert.ok(main.includes("import './setup-screen-v2-polish.css';"), 'approved polish stylesheet must load after the base v2 stylesheet');

for (const source of [css, polish]) {
  assert.equal(source.includes('height: 100% !important'), false, 'setup styles must not use forced legacy 100% rules');
  assert.equal(source.includes('zoom:'), false, 'setup styles must not use CSS zoom');
  assert.equal(source.includes('!important'), false, 'setup styles must not rely on important overrides');
}

console.log('Setup v2 approved sample 3 balance + typography QA: PASS');
