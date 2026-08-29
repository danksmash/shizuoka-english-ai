import assert from 'node:assert/strict';
import fs from 'node:fs';

const tuning = fs.readFileSync('src/setup-avatar-adjust.css', 'utf8');

assert.ok(
  tuning.includes('.setup-main {\n    align-items: stretch !important;'),
  'desktop setup grid must stretch both columns to the same row height',
);
assert.ok(
  tuning.includes('.setup-controls {\n    align-self: stretch;\n    height: 100% !important;\n    display: grid !important;'),
  'right setup column must fill the rendered height established by the left column',
);
assert.ok(
  tuning.includes('minmax(max-content, 2.05fr)') &&
    tuning.includes('minmax(max-content, 1.35fr)') &&
    tuning.includes('minmax(max-content, 0.72fr)') &&
    tuning.includes('minmax(clamp(44px, 3.25vw, 54px), 0.38fr)'),
  'right setup blocks must distribute available height in stable visual proportions',
);
assert.ok(
  tuning.includes('.setup-profile,\n  .setup-topic,\n  .setup-duration,\n  .setup-start {\n    height: 100% !important;'),
  'each right-column block must fill its assigned proportional track',
);
assert.ok(
  tuning.includes('.setup-topic,\n  .setup-duration {\n    display: flex !important;\n    flex-direction: column;\n    justify-content: center;'),
  'topic and duration content must remain visually centered when their tracks grow',
);
assert.equal(
  tuning.includes('calc(100vh'),
  false,
  'column synchronization must follow rendered content height rather than hard-coded viewport math',
);

console.log('Setup column height synchronization QA: PASS');
