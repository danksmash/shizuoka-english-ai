import { AI_STUDENTS_LIST, AI_STUDENTS_MASTER_LIST, NEW_AI_STUDENTS_13, TARGET_20_AI_STUDENT_IDS } from '../src/data/curriculum';
import { AI_STUDENT_IDS } from '../src/dataContract';
import { GOOGLE_TTS_VOICES, PERSONA_DICTIONARY_VERSION, PERSONA_PROFILE_DICTIONARY } from '../src/data/personaResearch';
import { STARTER_PROMPTS_JAPANESE } from '../src/utils/translation';

const fail = (message: string): never => { throw new Error(message); };
const unique = (items: readonly string[]) => new Set(items).size === items.length;

if (AI_STUDENTS_LIST.length !== 9) fail(`Existing visible list must stay 9 during stage 1; got ${AI_STUDENTS_LIST.length}`);
if (NEW_AI_STUDENTS_13.length !== 13) fail(`Expected 13 new personas; got ${NEW_AI_STUDENTS_13.length}`);
if (AI_STUDENTS_MASTER_LIST.length !== 22) fail(`Expected 22 master personas including 2 legacy hidden personas; got ${AI_STUDENTS_MASTER_LIST.length}`);
if (TARGET_20_AI_STUDENT_IDS.length !== 20 || !unique(TARGET_20_AI_STUDENT_IDS)) fail('Target 20 IDs must be unique and length 20');
if (!unique(AI_STUDENTS_MASTER_LIST.map((p) => p.id))) fail('Master persona IDs must be unique');
if (!unique(AI_STUDENTS_MASTER_LIST.map((p) => p.country))) fail('Master persona countries must be unique');
if (!TARGET_20_AI_STUDENT_IDS.every((id) => AI_STUDENTS_MASTER_LIST.some((p) => p.id === id))) fail('Every target persona must exist in master');
if (TARGET_20_AI_STUDENT_IDS.includes('chloe_canada') || TARGET_20_AI_STUDENT_IDS.includes('aung_myanmar')) fail('Canada/Myanmar must remain legacy-only, not target 20');
if (AI_STUDENT_IDS.length !== 22 || !unique(AI_STUDENT_IDS)) fail('Data contract must accept all 22 master IDs');
if (PERSONA_DICTIONARY_VERSION !== 'persona-profile-v2') fail('Persona dictionary must be v2');

const target = TARGET_20_AI_STUDENT_IDS.map((id) => AI_STUDENTS_MASTER_LIST.find((p) => p.id === id)!).filter(Boolean);
const femaleCount = target.filter((p) => p.gender === 'female').length;
const maleCount = target.filter((p) => p.gender === 'male').length;
if (femaleCount !== 10 || maleCount !== 10) fail(`Target gender balance must be 10/10; got ${femaleCount}/${maleCount}`);
const ageCounts = new Map<number, number>();
for (const p of target) ageCounts.set(p.age, (ageCounts.get(p.age) || 0) + 1);
if (ageCounts.get(20) !== 7 || ageCounts.get(21) !== 7 || ageCounts.get(22) !== 6) fail(`Target age balance changed: ${JSON.stringify([...ageCounts])}`);

const topics = ['intro','favorites','shizuoka_culture','talents','free'] as const;
for (const p of AI_STUDENTS_MASTER_LIST) {
  if (!GOOGLE_TTS_VOICES[p.id]) fail(`Missing Google TTS voice for ${p.id}`);
  const ja = STARTER_PROMPTS_JAPANESE[p.id];
  if (!ja) fail(`Missing Japanese starters for ${p.id}`);
  for (const topic of topics) {
    if (!p.topicPrompts[topic]?.trim()) fail(`Missing English starter ${p.id}/${topic}`);
    if (!ja[topic]?.trim()) fail(`Missing Japanese starter ${p.id}/${topic}`);
  }
  const entries = PERSONA_PROFILE_DICTIONARY.filter((entry) => entry.personaId === p.id);
  for (const field of ['likes','major','city','landmark'] as const) {
    if (!entries.some((entry) => entry.profileField === field)) fail(`Missing ${field} dictionary entry for ${p.id}`);
  }
}

const preserved: Record<string, string[]> = {
  emma_usa: ['Surfing', 'Burgers', 'Video Games', 'Strawberries'],
  oliver_uk: ['Football', 'Afternoon Tea', 'Mount Fuji', 'Shizuoka Green Tea'],
  liam_australia: ['Swimming', 'Koalas', 'Suruga Bay', 'BBQ'],
  bence_hungary: ['Puzzles', 'Math', 'Goulash Soup', 'Green Tea'],
  zofia_poland: ['Piano', 'Drawing', 'Pierogi', 'Sushi'],
  linh_vietnam: ['Pho', 'Badminton', 'Lotus Flowers', 'Shizuoka Mikan'],
  rahul_bangladesh: ['Cricket', 'Tea Gardens', 'Curry', 'Cycling'],
};
for (const [id, expected] of Object.entries(preserved)) {
  const p = AI_STUDENTS_MASTER_LIST.find((item) => item.id === id) || fail(`Missing preserved persona ${id}`);
  const actual = p.likes.map((like) => like.split(' ')[0]);
  if (expected.some((term) => !p.likes.some((like) => like.startsWith(term)))) fail(`Preserved persona changed unexpectedly: ${id} -> ${actual.join(', ')}`);
}

console.log(`Persona master QA: PASS (${target.length} target countries, ${AI_STUDENTS_MASTER_LIST.length} backward-compatible master personas, dictionary ${PERSONA_DICTIONARY_VERSION})`);
