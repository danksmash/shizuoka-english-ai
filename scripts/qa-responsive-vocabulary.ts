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

// Setup screen must preserve card/content proportions instead of stretching to fill height.
assert.ok(css.includes('grid-template-rows: auto auto auto'), 'setup shell must use natural-height rows');
assert.ok(css.includes('margin-block: auto'), 'spare vertical space must balance the whole setup composition');
assert.ok(css.includes('grid-template-rows: repeat(3, auto)'), 'student rows must keep natural card height');
assert.ok(css.includes('flex: 0 0 auto !important'), 'student grid must not stretch into spare height');
assert.ok(css.includes('display: flex !important;') && css.includes('flex-direction: column'), 'right setup controls must use natural vertical flow');
assert.ok(css.includes('min-height: clamp(168px, 12.2vw, 198px)'), 'student card height must be width-driven and capped');
assert.ok(css.includes('--setup-student-avatar-size: clamp(60px, 4.45vw, 76px)'), 'student avatar must have one canonical responsive size');
assert.ok(css.includes('grid-template-columns: var(--setup-student-avatar-size) minmax(0, 1fr)'), 'avatar grid column must use the canonical avatar size');
assert.ok(css.includes('width: var(--setup-student-avatar-size) !important'), 'avatar wrapper width must equal its grid column');
assert.ok(css.includes('min-width: var(--setup-student-avatar-size) !important'), 'avatar wrapper must never overflow a narrower grid column');
assert.ok(css.includes('> div:first-child > img') && css.includes('width: 100% !important') && css.includes('height: 100% !important'), 'avatar image must stay inside the synchronized wrapper');
assert.ok(css.includes('grid-template-columns: minmax(0, 1fr) clamp(126px, 10.4vw, 168px)'), 'selected-student portrait must scale proportionally');
assert.ok(css.includes('@media (max-width: 1023px), (orientation: portrait)'), 'phone/tablet portrait fallback must exist');
assert.equal(css.includes('grid-template-rows: auto minmax(0, 1fr) auto'), false, 'setup shell must not allocate all remaining viewport height');
assert.equal(css.includes('grid-template-rows: minmax(0, 1.45fr)'), false, 'right controls must not stretch into fixed fractional viewport rows');
assert.equal(css.includes('height: 100%;\n    display: grid !important'), false, 'right controls must not force full-height stretching');
assert.equal(css.includes('min(4.7vw, 7.2vh)'), false, 'setup card scaling must not shrink/grow from viewport height');
assert.equal(css.includes('#root > .bg-gradient-to-b > main'), false, 'obsolete brittle setup selector must be removed');
assert.equal(setup.includes('setup-start mt-auto'), false, 'start button must not create an artificial vertical spacer');

assert.ok(feedback.includes('自分が使ったことば・表現'), 'AI-selected child learning section must exist');
assert.ok(feedback.includes('AI留学生から出会ったことば・表現'), 'AI-selected exchange-student learning section must exist');
assert.ok(feedback.includes('根拠となる実際の発話'), 'each displayed learning item must show utterance evidence');
assert.ok(feedback.includes('なぜ大切？'), 'learning items must explain their educational value');
assert.ok(feedback.includes('なぜ重要？'), 'key phrases must explain why they are reusable');

const server = fs.readFileSync('server.ts', 'utf8');
assert.ok(server.includes('childLearningItems'), 'feedback API must request child learning items');
assert.ok(server.includes('aiLearningItems'), 'feedback API must request AI learning items');
assert.ok(server.includes('groundFeedbackExpressions'), 'AI-selected items must be grounded against actual utterances');
assert.ok(server.includes('groundKeyPhrases'), 'key phrases must be grounded against actual utterances');
assert.ok(server.includes('最大3件'), 'feedback prompt must cap each learning list');

console.log('Responsive + vocabulary evidence QA: PASS');
