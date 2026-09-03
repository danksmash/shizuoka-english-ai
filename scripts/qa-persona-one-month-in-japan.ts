import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AI_STUDENTS_LIST, GUIDED_TOPIC_STARTERS_ENGLISH, TARGET_20_AI_STUDENT_IDS } from '../src/data/curriculum';
import { getDialogueTopicContext } from '../src/data/dialogueTopicContext';
import { GOOGLE_TTS_VOICES } from '../src/data/personaResearch';

const expectedPersonaCore = {
  emma_usa: { age: 20, country: 'United States', major: 'メディア・コミュニケーション' },
  oliver_uk: { age: 21, country: 'United Kingdom', major: '環境科学・日本文化' },
  liam_australia: { age: 22, country: 'Australia', major: '海洋生物学・海洋保全' },
  bence_hungary: { age: 21, country: 'Hungary', major: '情報工学・ロボティクス' },
  zofia_poland: { age: 20, country: 'Poland', major: '建築デザイン・美術史' },
  rahul_bangladesh: { age: 22, country: 'Bangladesh', major: '農学・茶葉栽培科学' },
  linh_vietnam: { age: 20, country: 'Vietnam', major: '国際言語文化学・観光' },
  minji_korea: { age: 21, country: 'South Korea', major: '教育学・児童発達' },
  pavel_belarus: { age: 22, country: 'Belarus', major: '数理・データ科学' },
  lukas_germany: { age: 21, country: 'Germany', major: '機械工学' },
  aina_malaysia: { age: 20, country: 'Malaysia', major: '環境デザイン' },
  dimas_indonesia: { age: 22, country: 'Indonesia', major: '観光・文化遺産学' },
  yuting_taiwan: { age: 21, country: 'Taiwan', major: 'ビジュアル・コミュニケーションデザイン' },
  matas_lithuania: { age: 20, country: 'Lithuania', major: 'スポーツ科学・健康' },
  ananya_india: { age: 22, country: 'India', major: 'コンピュータ科学' },
  xinyi_china: { age: 21, country: 'China', major: '経済・国際ビジネス' },
  nadeesha_srilanka: { age: 20, country: 'Sri Lanka', major: '環境科学・生物多様性' },
  suman_nepal: { age: 21, country: 'Nepal', major: '地理学・防災' },
  amara_nigeria: { age: 22, country: 'Nigeria', major: '国際関係学' },
  andrei_romania: { age: 20, country: 'Romania', major: '建築・都市デザイン' },
} as const;

assert.equal(AI_STUDENTS_LIST.length, 20, 'exactly 20 active personas are required');
assert.deepEqual(
  [...AI_STUDENTS_LIST.map((persona) => persona.id)].sort(),
  [...TARGET_20_AI_STUDENT_IDS].sort(),
  'the active 20-persona ID set must not change',
);

for (const persona of AI_STUDENTS_LIST) {
  const expected = expectedPersonaCore[persona.id];
  assert.ok(expected, `missing baseline for ${persona.id}`);
  assert.equal(persona.age, expected.age, `age changed for ${persona.id}`);
  assert.equal(persona.country, expected.country, `country changed for ${persona.id}`);
  assert.equal(persona.major, expected.major, `major changed for ${persona.id}`);
  assert.ok(GOOGLE_TTS_VOICES[persona.id], `Google TTS mapping missing for ${persona.id}`);
}

assert.deepEqual(GUIDED_TOPIC_STARTERS_ENGLISH, {
  favorites: "Let's talk about our favorite things. What do you like?",
  shizuoka_culture: "Let's talk about Shizuoka and culture. What do you like about Shizuoka?",
  talents: "Let's talk about things we can do. What can you do?",
  daily_routine: "Let's talk about our daily lives. What do you do in the morning?",
}, 'guided topic starters changed unexpectedly');

const serverSource = readFileSync('server.ts', 'utf8');
const arrivalMarkers = [
  'You came to Japan about one month ago.',
  'You are still new to life in Japan and Shizuoka.',
  'You may already know famous things about Japan from before coming here',
  'Do not invent personal experiences in Japan that are not established in your persona facts or earlier conversation.',
  'Do not pretend ignorance about widely known things or about anything already established in your persona or earlier conversation.',
];
for (const marker of arrivalMarkers) {
  assert.ok(serverSource.includes(marker), `missing common arrival-context rule: ${marker}`);
}
assert.equal(
  serverSource.split('You came to Japan about one month ago.').length - 1,
  1,
  'arrival context must be defined once and shared by all personas',
);

const topicContexts = ['intro', 'favorites', 'shizuoka_culture', 'talents', 'daily_routine', 'free'] as const;
for (const topic of topicContexts) {
  const context = getDialogueTopicContext(topic);
  assert.ok(context.includes('respond as this exchange-student persona rather than as an encyclopedia'), `${topic}: persona-grounded information gap missing`);
  assert.ok(context.includes('not obviously internationally familiar'), `${topic}: common-item familiarity safeguard missing`);
  assert.ok(context.includes('invite the child to explain it'), `${topic}: child explanation opportunity missing`);
  assert.ok(context.includes('Never pretend ignorance mechanically'), `${topic}: mechanical ignorance safeguard missing`);
  assert.ok(context.includes('never force the same question'), `${topic}: scripted question safeguard missing`);
}

const curriculumSource = readFileSync('src/data/curriculum.ts', 'utf8');
assert.equal(curriculumSource.includes('You came to Japan about one month ago.'), false, 'arrival background must not be duplicated into individual persona data');
assert.equal(curriculumSource.includes('来日1か月'), false, 'arrival background must not be added to pupil-facing persona data');

const setupSource = readFileSync('src/components/SetupScreen.tsx', 'utf8');
assert.equal(setupSource.includes('来日1か月'), false, 'pupil UI must not display the one-month setting');
assert.equal(setupSource.includes('one month'), false, 'pupil UI must not display the one-month setting');

const imageSource = readFileSync('src/data/studentImages.ts', 'utf8');
for (const personaId of TARGET_20_AI_STUDENT_IDS) {
  assert.ok(imageSource.includes(`${personaId}.webp`), `persona image mapping changed or missing: ${personaId}`);
}

const researchSource = readFileSync('src/server/researchDashboard.ts', 'utf8');
assert.ok(researchSource.includes("'persona_id','name','country','gender','city','major','likes','heritage_landmark','profile_text_ja'"), 'persona CSV schema changed unexpectedly');
assert.equal(/arrival_(?:date|month|context)|months?_in_japan|one_month_in_japan/i.test(researchSource), false, 'fixed one-month condition must not silently change research CSV schema');

console.log('ONE-MONTH-IN-JAPAN PERSONA QA PASS');
