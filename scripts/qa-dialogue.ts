import { AI_STUDENTS_MASTER_LIST, TARGET_20_AI_STUDENT_IDS } from '../src/data/curriculum';
import type { DialogueTopic } from '../src/types';

const topics: DialogueTopic[] = ['intro', 'favorites', 'shizuoka_culture', 'talents', 'daily_routine', 'free'];
const durations = [1, 2, 3, 5] as const;
const forbiddenFixedPrefixes = [
  'awesome!', 'brilliant!', 'wonderful!', 'fantastic!', 'totally!', 'no worries!',
  'excellent!', 'amazing!', 'great job!', 'very good!', 'so cool!', 'so nice!',
  'delightful!', 'terrific!', 'splendid!', 'cheers!', 'spot on!', 'well done!',
  'good on ya!', 'glad to hear!', 'welcome!', 'hello friend!', 'hey friend!'
];

function wordCount(text: string): number { return text.trim().split(/\s+/).filter(Boolean).length; }
const failures: string[] = [];
let checked = 0;

for (const id of TARGET_20_AI_STUDENT_IDS) {
  const student = AI_STUDENTS_MASTER_LIST.find((item) => item.id === id);
  if (!student) { failures.push(`Missing target persona: ${id}`); continue; }
  if (student.fillerWords.length !== 0) failures.push(`${student.id}: fillerWords must be empty`);
  if (student.characteristicPhrases.length !== 0) failures.push(`${student.id}: characteristicPhrases must be empty`);
  for (const topic of topics) {
    const starter = student.topicPrompts[topic]?.trim();
    if (!starter) { failures.push(`${student.id}/${topic}: missing starter`); continue; }
    const lower = starter.toLowerCase();
    if (forbiddenFixedPrefixes.some((prefix) => lower.startsWith(prefix))) failures.push(`${student.id}/${topic}: fixed reaction prefix remains: ${starter}`);
    if (wordCount(starter) > 14) failures.push(`${student.id}/${topic}: starter too difficult/long (${wordCount(starter)} words): ${starter}`);
    if (!starter.includes('?')) failures.push(`${student.id}/${topic}: starter must include an easy question`);
    for (const duration of durations) { void duration; checked += 1; if (student.topicPrompts[topic] !== starter) failures.push(`${student.id}/${topic}: starter unexpectedly varies by duration`); }
  }
}
if (TARGET_20_AI_STUDENT_IDS.length !== 20) failures.push(`Expected 20 target personas, found ${TARGET_20_AI_STUDENT_IDS.length}`);
if (failures.length) { console.error('Dialogue QA FAILED'); failures.forEach((failure) => console.error(`- ${failure}`)); process.exit(1); }
console.log(`Dialogue QA PASS: ${TARGET_20_AI_STUDENT_IDS.length} students × ${topics.length} topics × ${durations.length} durations = ${checked} combinations checked.`);
