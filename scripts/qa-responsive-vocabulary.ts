import assert from 'node:assert/strict';
import fs from 'node:fs';
import { detectVocabularyInText } from '../src/data/vocabulary56';
import { TOPIC_LEARNING_GOALS } from '../src/data/topicLearningGoals';

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

// Grade 5 vocabulary remains available.
assert.equal(ids('I like art.').has('vocab-art'), true);
assert.equal(ids('I can swim.').has('vocab-can-do'), true);
assert.equal(ids('I can swim.').has('vocab-swimming'), true);
assert.equal(ids('Breakfast is delicious.').has('vocab-breakfast'), true);

// Grade 6 vocabulary must be available through the unified detector.
assert.equal(ids("I'm good at swimming.").has('vocab6-good-at'), true);
assert.equal(ids("I'm interested in animals.").has('vocab6-interested-in'), true);
assert.equal(ids('I usually get up at seven.').has('vocab6-usually'), true);
assert.equal(ids('I usually get up at seven.').has('vocab6-get-up'), true);
assert.equal(ids('I went to Kyoto and enjoyed the festival.').has('vocab6-went-to'), true);
assert.equal(ids('I went to Kyoto and enjoyed the festival.').has('vocab6-enjoyed'), true);
assert.equal(ids('I want to go to Australia.').has('vocab6-want-go'), true);
assert.equal(ids('I want to be a teacher.').has('vocab6-want-be'), true);
assert.equal(ids("What's your best memory?").has('vocab6-memory'), true);

// Every dialogue theme must have three distinct, theme-specific goals.
const topicEntries = Object.entries(TOPIC_LEARNING_GOALS);
assert.equal(topicEntries.length, 5, 'all five dialogue themes must have goals');
for (const [topic, goals] of topicEntries) {
  assert.equal(goals.length, 3, `${topic} must have exactly three pupil-friendly goals`);
  assert.equal(new Set(goals.map((goal) => goal.label)).size, 3, `${topic} goals must be distinct`);
  assert.ok(goals.every((goal) => goal.examples.trim().length > 0), `${topic} goals need target expressions`);
}
assert.notDeepEqual(
  TOPIC_LEARNING_GOALS.intro.map((goal) => goal.label),
  TOPIC_LEARNING_GOALS.shizuoka_culture.map((goal) => goal.label),
  'intro and culture goals must not be the same fixed list',
);

const setup = fs.readFileSync('src/components/SetupScreen.tsx', 'utf8');
const css = fs.readFileSync('src/index.css', 'utf8');
const avatarTuning = fs.readFileSync('src/setup-avatar-adjust.css', 'utf8');
const main = fs.readFileSync('src/main.tsx', 'utf8');
const feedback = fs.readFileSync('src/components/FeedbackScreen.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const goalComponent = fs.readFileSync('src/components/TodayGoals.tsx', 'utf8');
const vocabDock = fs.readFileSync('src/components/VisualVocabularyDock.tsx', 'utf8');

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
assert.ok(css.includes('--setup-student-avatar-size: clamp(60px, 4.45vw, 76px)'), 'base student avatar size must be defined once');
assert.ok(css.includes('grid-template-columns: var(--setup-student-avatar-size) minmax(0, 1fr)'), 'avatar grid column must use the canonical avatar size');
assert.ok(css.includes('width: var(--setup-student-avatar-size) !important'), 'avatar wrapper width must equal its grid column');
assert.ok(css.includes('min-width: var(--setup-student-avatar-size) !important'), 'avatar wrapper must never overflow a narrower grid column');
assert.ok(css.includes('> div:first-child > img') && css.includes('width: 100% !important') && css.includes('height: 100% !important'), 'avatar image must stay inside the synchronized wrapper');
assert.ok(main.includes("import './setup-avatar-adjust.css';"), 'final avatar visual tuning must load after index.css');
assert.ok(avatarTuning.includes('--setup-student-avatar-size: clamp(76px, 5.2vw, 92px)'), 'desktop portraits must stay readable');
assert.ok(avatarTuning.includes('--setup-student-avatar-size: clamp(68px, 5.8vw, 78px)'), 'small landscape laptops need safe portrait sizing');
assert.ok(avatarTuning.includes('gap: clamp(0.72rem, 0.78vw, 0.95rem)'), 'portrait needs a protected gap before text');
assert.ok(css.includes('grid-template-columns: minmax(0, 1fr) clamp(126px, 10.4vw, 168px)'), 'selected-student portrait must scale proportionally');
assert.ok(css.includes('@media (max-width: 1023px), (orientation: portrait)'), 'phone/tablet portrait fallback must exist');
assert.equal(css.includes('grid-template-rows: auto minmax(0, 1fr) auto'), false, 'setup shell must not allocate all remaining viewport height');
assert.equal(css.includes('grid-template-rows: minmax(0, 1.45fr)'), false, 'right controls must not stretch into fixed fractional viewport rows');
assert.equal(css.includes('height: 100%;\n    display: grid !important'), false, 'right controls must not force full-height stretching');
assert.equal(css.includes('min(4.7vw, 7.2vh)'), false, 'setup card scaling must not shrink/grow from viewport height');
assert.equal(css.includes('#root > .bg-gradient-to-b > main'), false, 'obsolete brittle setup selector must be removed');
assert.equal(setup.includes('setup-start mt-auto'), false, 'start button must not create an artificial vertical spacer');

assert.ok(app.includes("import { TodayGoals } from './components/TodayGoals'"), 'dialogue must render the theme-goal component');
assert.ok(app.includes('<TodayGoals topic={profile.selectedTopic} />'), 'selected dialogue theme must drive today goals');
assert.ok(app.includes("from './data/vocabulary56'"), 'dialogue vocabulary must use the unified Grade 5-6 detector');
assert.ok(goalComponent.includes('getTopicLearningGoals'), 'goal component must read theme-specific goals');
assert.ok(vocabDock.includes('5・6年生の学習内容'), 'vocabulary dock must describe Grade 5-6 coverage');

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

console.log('Responsive + Grade 5-6 goals/vocabulary QA: PASS');