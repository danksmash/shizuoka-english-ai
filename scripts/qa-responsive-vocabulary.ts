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

// Every formal dialogue theme must have three distinct, theme-specific goals.
const topicEntries = Object.entries(TOPIC_LEARNING_GOALS);
assert.equal(topicEntries.length, 6, 'all six dialogue themes must have goals');
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
const setupCss = fs.readFileSync('src/setup-screen-v2.css', 'utf8');
const main = fs.readFileSync('src/main.tsx', 'utf8');
const feedback = fs.readFileSync('src/components/FeedbackScreen.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const goalComponent = fs.readFileSync('src/components/TodayGoals.tsx', 'utf8');
const vocabDock = fs.readFileSync('src/components/VisualVocabularyDock.tsx', 'utf8');

// Setup v2 owns its layout in a separate namespace so obsolete setup CSS cannot reshape it.
for (const marker of ['setup-v2-screen', 'setup-v2-shell', 'setup-v2-main', 'setup-v2-student-section', 'setup-v2-student-grid', 'setup-v2-controls']) {
  assert.ok(setup.includes(marker), `SetupScreen must expose ${marker}`);
}
for (const marker of ['setup-v2-persona-card', 'setup-v2-card-country', 'setup-v2-card-portrait', 'setup-v2-card-avatar', 'setup-v2-card-copy']) {
  assert.ok(setup.includes(marker), `Setup v2 persona cards must expose ${marker}`);
}
assert.equal(setup.includes('setup-student-card-compact'), false, 'obsolete compact text-only selector must not remain');
assert.ok(main.includes("import './setup-screen-v2.css';"), 'isolated setup v2 CSS must load after legacy styles');
assert.ok(setupCss.includes('grid-template-rows: auto minmax(0, 1fr) auto'), 'setup shell must allocate remaining height to main');
assert.ok(setupCss.includes('grid-template-columns: minmax(0, 1.32fr) minmax(0, 1fr)'), 'desktop setup must preserve reference left/right ratio');
assert.ok(setupCss.includes('grid-template-columns: repeat(5, minmax(0, 1fr))'), 'desktop persona grid must use five columns');
assert.ok(setupCss.includes('grid-template-rows: repeat(4, minmax(0, 1fr))'), 'desktop persona grid must use four rows');
assert.ok(setupCss.includes('grid-template-rows: minmax(0, 1fr) auto auto auto'), 'right column profile must absorb remaining height above fixed controls');
assert.ok(setupCss.includes('@media (max-width: 1023px)'), 'narrow-screen single-column fallback must exist');
assert.ok(setupCss.includes('grid-template-columns: repeat(4, minmax(0, 1fr))'), 'tablet fallback must reduce persona columns safely');
assert.ok(setupCss.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'), 'small-screen fallback must reduce persona columns safely');
assert.equal(setupCss.includes('zoom:'), false, 'setup v2 must not use CSS zoom');
assert.equal(setupCss.includes('!important'), false, 'setup v2 must not create an important-rule override war');
assert.ok(setupCss.includes('overflow-wrap: anywhere'), 'long country/name/city labels must wrap safely');
assert.ok(setupCss.includes('aspect-ratio: 4 / 5'), 'persona portraits must preserve the approved 4:5 image ratio');
assert.ok(setup.includes('labelCondition') && setup.includes('showLabels'), 'research label visibility condition must remain');

assert.ok(app.includes("import { TodayGoals } from './components/TodayGoals'"), 'dialogue must render the theme-goal component');
assert.ok(app.includes('<TodayGoals topic={profile.selectedTopic} />'), 'selected dialogue theme must drive today goals');
assert.ok(app.includes("from './data/vocabulary56'"), 'dialogue vocabulary must use the unified Grade 5-6 detector');
assert.ok(goalComponent.includes('getTopicLearningGoals'), 'goal component must read theme-specific goals');
assert.ok(vocabDock.includes('5・6年生の学習内容'), 'vocabulary dock must describe Grade 5-6 coverage');

assert.ok(feedback.includes('自分が使ったことば・表現'), 'AI-selected child learning section must exist');
assert.ok(feedback.includes('AI留学生から出会ったことば・表現'), 'AI-selected exchange-student learning section must exist');
assert.ok(feedback.includes('根拠となる実際の発話'), 'each displayed learning item must show utterance evidence');
assert.ok(feedback.includes('なぜ大切？'), 'learning items must explain their educational value');
assert.equal(feedback.includes('重要キーフレーズ (Key Expressions)'), false, 'redundant Key Expressions display must stay removed');

const server = fs.readFileSync('server.ts', 'utf8');
assert.ok(server.includes('childLearningItems'), 'feedback API must request child learning items');
assert.ok(server.includes('aiLearningItems'), 'feedback API must request AI learning items');
assert.ok(server.includes('groundFeedbackExpressions'), 'AI-selected items must be grounded against actual utterances');
assert.ok(server.includes('groundKeyPhrases'), 'key phrases must be grounded against actual utterances');
assert.ok(server.includes('最大3件'), 'feedback prompt must cap each learning list');

console.log('Responsive setup v2 + Grade 5-6 goals/vocabulary QA: PASS');
