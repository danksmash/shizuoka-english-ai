import { AI_STUDENTS_LIST } from '../src/data/curriculum';
import { STARTER_PROMPTS_JAPANESE } from '../src/utils/translation';
import type { DialogueTopic } from '../src/types';

const topics: DialogueTopic[] = ['intro', 'favorites', 'shizuoka_culture', 'talents', 'free'];
const nativeGreetings = ['ミンガラバー', 'スィア', 'チェシチ', 'シンチャオ'];
const failures: string[] = [];
let checked = 0;

for (const student of AI_STUDENTS_LIST) {
  const translations = STARTER_PROMPTS_JAPANESE[student.id];
  for (const topic of topics) {
    checked += 1;
    const english = student.topicPrompts[topic]?.trim();
    const japanese = translations?.[topic]?.trim();

    if (!english) failures.push(`${student.id}/${topic}: English starter is missing`);
    if (!japanese) failures.push(`${student.id}/${topic}: Japanese translation is missing`);
    if (japanese && nativeGreetings.some((greeting) => japanese.includes(greeting))) {
      failures.push(`${student.id}/${topic}: translation adds a greeting not spoken in English`);
    }
  }
}

const aungIntro = STARTER_PROMPTS_JAPANESE.aung_myanmar?.intro;
if (aungIntro !== 'こんにちは！ミャンマーから来たアウンです。あなたのお名前は何ですか？') {
  failures.push('aung_myanmar/intro: Hello translation must begin with こんにちは and match the spoken starter');
}

if (failures.length > 0) {
  console.error('STARTER TRANSLATION QA FAILED');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`STARTER TRANSLATION QA PASS: ${checked} English/Japanese pairs checked.`);
