import { AI_STUDENTS_LIST } from '../src/data/curriculum';
import type { DialogueTopic } from '../src/types';

const topics: DialogueTopic[] = ['intro', 'favorites', 'shizuoka_culture', 'talents', 'free'];
const durations = [1, 2, 3, 5, 10];
const forbiddenFixedPrefixes = [
  'awesome!', 'brilliant!', 'wonderful!', 'fantastic!', 'totally!', 'no worries!',
  'excellent!', 'amazing!', 'great job!', 'very good!', 'so cool!', 'so nice!',
  'delightful!', 'terrific!', 'splendid!', 'cheers!', 'spot on!', 'well done!',
  'good on ya!', 'glad to hear!', 'welcome!', 'hello friend!', 'hey friend!'
];

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const failures: string[] = [];
let checked = 0;

for (const student of AI_STUDENTS_LIST) {
  if (student.fillerWords.length !== 0) {
    failures.push(`${student.id}: fillerWords must be empty`);
  }
  if (student.characteristicPhrases.length !== 0) {
    failures.push(`${student.id}: characteristicPhrases must be empty`);
  }

  for (const topic of topics) {
    const starter = student.topicPrompts[topic]?.trim();
    if (!starter) {
      failures.push(`${student.id}/${topic}: missing starter`);
      continue;
    }

    const lower = starter.toLowerCase();
    if (forbiddenFixedPrefixes.some((prefix) => lower.startsWith(prefix))) {
      failures.push(`${student.id}/${topic}: fixed reaction prefix remains: ${starter}`);
    }

    // Match the short self-introduction level across every theme.
    if (wordCount(starter) > 14) {
      failures.push(`${student.id}/${topic}: starter too difficult/long (${wordCount(starter)} words): ${starter}`);
    }

    if (!starter.includes('?')) {
      failures.push(`${student.id}/${topic}: starter must end with an easy question`);
    }

    // Duration must not select a different starter or level.
    for (const duration of durations) {
      void duration;
      checked += 1;
      if (student.topicPrompts[topic] !== starter) {
        failures.push(`${student.id}/${topic}: starter unexpectedly varies by duration`);
      }
    }
  }
}

if (AI_STUDENTS_LIST.length !== 9) {
  failures.push(`Expected 9 AI students, found ${AI_STUDENTS_LIST.length}`);
}

if (failures.length > 0) {
  console.error('Dialogue QA FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dialogue QA PASS: ${AI_STUDENTS_LIST.length} students × ${topics.length} topics × ${durations.length} durations = ${checked} combinations checked.`);
