import assert from 'node:assert/strict';
import fs from 'node:fs';

const setup = fs.readFileSync('src/components/SetupScreen.tsx', 'utf8');
const css = fs.readFileSync('src/setup-screen-v2.css', 'utf8');

assert.ok(setup.includes('setup-v2-main'), 'setup must expose the v2 main grid');
assert.ok(setup.includes('setup-v2-student-section'), 'setup must expose the v2 student section');
assert.ok(setup.includes('setup-v2-controls'), 'setup must expose the v2 controls column');

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
assert.equal(css.includes('height: 100% !important'), false, 'v2 height synchronization must not use forced legacy 100% rules');
assert.equal(css.includes('zoom:'), false, 'v2 layout must not use CSS zoom');
assert.equal(css.includes('!important'), false, 'v2 layout must not rely on important overrides');

console.log('Setup v2 column height synchronization QA: PASS');
