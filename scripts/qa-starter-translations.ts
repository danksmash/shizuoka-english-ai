import { AI_STUDENTS_MASTER_LIST, TARGET_20_AI_STUDENT_IDS } from '../src/data/curriculum';
import { STARTER_PROMPTS_JAPANESE } from '../src/utils/translation';
import type { DialogueTopic } from '../src/types';

const topics: DialogueTopic[] = ['intro', 'favorites', 'shizuoka_culture', 'talents', 'daily_routine', 'free'];
const nativeGreetings = ['ミンガラバー', 'スィア', 'チェシチ', 'シンチャオ'];
const failures: string[] = [];
let checked = 0;
for (const id of TARGET_20_AI_STUDENT_IDS) {
  const student = AI_STUDENTS_MASTER_LIST.find((item) => item.id === id);
  if (!student) { failures.push(`Missing target persona: ${id}`); continue; }
  const translations = STARTER_PROMPTS_JAPANESE[student.id];
  for (const topic of topics) {
    checked += 1;
    const english = student.topicPrompts[topic]?.trim();
    const japanese = translations?.[topic]?.trim();
    if (!english) failures.push(`${student.id}/${topic}: English starter is missing`);
    if (!japanese) failures.push(`${student.id}/${topic}: Japanese translation is missing`);
    if (japanese && topic !== 'intro' && nativeGreetings.some((greeting) => japanese.includes(greeting))) failures.push(`${student.id}/${topic}: translation adds a greeting not spoken in English`);
  }
}
if (failures.length) { console.error('STARTER TRANSLATION QA FAILED'); failures.forEach((failure) => console.error(`- ${failure}`)); process.exit(1); }
console.log(`STARTER TRANSLATION QA PASS: ${checked} English/Japanese pairs checked.`);
