import assert from 'node:assert/strict';
import fs from 'node:fs';
import { detectVocabularyInText } from '../src/data/vocabulary';

const ids = (text: string) => new Set(detectVocabularyInText(text).map((item) => item.id));

// Partial substrings must never create false vocabulary records.
assert.equal(ids('People are very kind.').has('vocab-pe'), false, 'people must not trigger P.E.');
assert.equal(ids('This is a good start.').has('vocab-art'), false, 'start must not trigger art');
assert.equal(ids('I am from Canada.').has('vocab-can-do'), false, 'Canada must not trigger can');
assert.equal(ids('I eat breakfast at seven.').has('vocab-running'), false, 'breakfast must not trigger fast');

// P.E. must be grounded in an actual registered utterance form.
for (const sentence of [
  'I like P.E.',
  'My favorite subject is PE.',
  'I like physical education.',
  'We have gym class today.',
]) {
  assert.equal(ids(sentence).has('vocab-pe'), true, `${sentence} should trigger P.E.`);
}
assert.equal(ids('I go to the gymnasium.').has('vocab-pe'), false, 'gymnasium must not trigger P.E.');

// Other exact-token vocabulary should continue to work.
assert.equal(ids('I like art.').has('vocab-art'), true);
assert.equal(ids('I can swim.').has('vocab-can-do'), true);
assert.equal(ids('I can swim.').has('vocab-swimming'), true);
assert.equal(ids('Breakfast is delicious.').has('vocab-breakfast'), true);

const setup = fs.readFileSync('src/components/SetupScreen.tsx', 'utf8');
const css = fs.readFileSync('src/index.css', 'utf8');
const feedback = fs.readFileSync('src/components/FeedbackScreen.tsx', 'utf8');

for (const marker of ['setup-screen', 'setup-shell', 'setup-main', 'setup-student-grid', 'setup-controls']) {
  assert.ok(setup.includes(marker), `SetupScreen must expose ${marker}`);
}
assert.ok(css.includes('grid-template-rows: auto minmax(0, 1fr) auto'), 'desktop setup shell must allocate remaining viewport height');
assert.ok(css.includes('@media (max-width: 1023px), (orientation: portrait)'), 'phone/tablet portrait fallback must exist');
assert.equal(css.includes('#root > .bg-gradient-to-b > main'), false, 'obsolete brittle setup selector must be removed');

assert.ok(feedback.includes('自分が使ったことば・表現'), 'AI-selected child learning section must exist');
assert.ok(feedback.includes('AI留学生から出会ったことば・表現'), 'AI-selected exchange-student learning section must exist');
assert.ok(feedback.includes('根拠となる実際の発話'), 'each displayed learning item must show utterance evidence');
assert.ok(feedback.includes('なぜ大切？'), 'learning items must explain their educational value');
assert.ok(feedback.includes('なぜ重要？'), 'key phrases must explain why they are reusable');

console.log('Responsive + vocabulary evidence QA: PASS');

const server = fs.readFileSync('server.ts', 'utf8');
assert.ok(server.includes('childLearningItems'), 'feedback API must request child learning items');
assert.ok(server.includes('aiLearningItems'), 'feedback API must request AI learning items');
assert.ok(server.includes('groundFeedbackExpressions'), 'AI-selected items must be grounded against actual utterances');
assert.ok(server.includes('groundKeyPhrases'), 'key phrases must be grounded against actual utterances');
assert.ok(server.includes('最大3件'), 'feedback prompt must cap each learning list');
assert.equal(setup.includes('setup-start mt-auto'), false, 'start button must not create an artificial vertical spacer');
assert.ok(css.includes('grid-template-rows: minmax(0, 1.45fr)'), 'right setup column must proportionally share available height');
assert.ok(css.includes('clamp(52px, min(4.7vw, 7.2vh), 76px)'), 'student avatar must scale with viewport while preserving proportions');
assert.equal(css.includes('min-height: min(760px'), false, 'setup layout must not use old fixed desktop height contract');
