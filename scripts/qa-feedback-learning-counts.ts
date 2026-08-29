import assert from 'node:assert/strict';
import fs from 'node:fs';

const feedback = fs.readFileSync('src/components/FeedbackScreen.tsx', 'utf8');

assert.ok(
  feedback.includes("const childLearningItems = (feedback?.childLearningItems || []).slice(0, 1);"),
  'child learning expressions must be capped at one displayed item',
);
assert.ok(
  feedback.includes("const aiLearningItems = (feedback?.aiLearningItems || []).slice(0, 2);"),
  'AI exchange-student expressions must be capped at two displayed items',
);
assert.ok(
  feedback.includes('{childLearningItems.length}件') && feedback.includes('items={childLearningItems}'),
  'child learning badge and list must use the capped collection',
);
assert.ok(
  feedback.includes('{aiLearningItems.length}件') && feedback.includes('items={aiLearningItems}'),
  'AI learning badge and list must use the capped collection',
);
assert.equal(
  feedback.includes('{feedback?.childLearningItems?.length || 0}件'),
  false,
  'child learning badge must not expose an uncapped count',
);
assert.equal(
  feedback.includes('{feedback?.aiLearningItems?.length || 0}件'),
  false,
  'AI learning badge must not expose an uncapped count',
);

console.log('Feedback learning item count QA: PASS');
