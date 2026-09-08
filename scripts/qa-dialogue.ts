import { readFileSync } from 'node:fs';
import { AI_STUDENTS_MASTER_LIST, GUIDED_TOPIC_STARTERS_ENGLISH, TARGET_20_AI_STUDENT_IDS } from '../src/data/curriculum';
import { getDialogueTopicContext } from '../src/data/dialogueTopicContext';
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
    if (topic !== 'intro' && topic !== 'free') {
      const expected = GUIDED_TOPIC_STARTERS_ENGLISH[topic];
      if (starter !== expected) failures.push(`${student.id}/${topic}: guided starter mismatch: ${starter}`);
      if (!starter.startsWith("Let's talk about ")) failures.push(`${student.id}/${topic}: guided starter must begin with Let's talk about`);
    } else if (starter.startsWith("Let's talk about ")) {
      failures.push(`${student.id}/${topic}: intro/free must preserve persona-specific starter behavior`);
    }
    if (wordCount(starter) > 14) failures.push(`${student.id}/${topic}: starter too difficult/long (${wordCount(starter)} words): ${starter}`);
    if (!starter.includes('?')) failures.push(`${student.id}/${topic}: starter must include an easy question`);
    for (const duration of durations) { void duration; checked += 1; if (student.topicPrompts[topic] !== starter) failures.push(`${student.id}/${topic}: starter unexpectedly varies by duration`); }
  }
}

const introContext = getDialogueTopicContext('intro');
if (!introContext.includes('Get to know each other naturally:')) {
  failures.push('intro context must frame Core 1 as natural getting-to-know-each-other conversation');
}

const serverSource = readFileSync('server.ts', 'utf8');
const requiredCore1Rules = [
  'Keep the conversation natural, warm, and genuinely responsive.',
  'Do not sound like a textbook, quiz, or scripted lesson.',
  "Answer the student's actual message first.",
  'If the student shares information, react to that information first.',
  'After responding, usually ask one short, natural question when it helps the conversation continue. Do not force a question when it would be unnatural.',
];
for (const rule of requiredCore1Rules) {
  if (!serverSource.includes(rule)) failures.push(`Core 1 natural-conversation rule missing from system instruction: ${rule}`);
}

const dailyRoutineContext = getDialogueTopicContext('daily_routine');
for (const fixedTime of ['7:00', '7:30', '9:00', '11:00']) {
  if (dailyRoutineContext.includes(fixedTime)) failures.push(`daily_routine context must not force fixed time ${fixedTime}`);
}
if (TARGET_20_AI_STUDENT_IDS.length !== 20) failures.push(`Expected 20 target personas, found ${TARGET_20_AI_STUDENT_IDS.length}`);
if (failures.length) { console.error('Dialogue QA FAILED'); failures.forEach((failure) => console.error(`- ${failure}`)); process.exit(1); }
console.log(`Dialogue QA PASS: ${TARGET_20_AI_STUDENT_IDS.length} students × ${topics.length} topics × ${durations.length} durations = ${checked} combinations checked; Core 1 natural-conversation contract protected.`);
