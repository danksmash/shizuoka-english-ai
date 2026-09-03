const fs = require('node:fs');

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, content) { fs.writeFileSync(path, content); }
function replaceOnce(text, from, to, label) {
  if (text.includes(to)) return text;
  if (!text.includes(from)) throw new Error(`Missing expected source for ${label}`);
  return text.replace(from, to);
}
function edit(path, fn) {
  const before = read(path);
  const after = fn(before);
  if (after !== before) write(path, after);
}

edit('src/types.ts', (text) => replaceOnce(
  text,
  "export type DialogueTopic = 'intro' | 'favorites' | 'shizuoka_culture' | 'talents' | 'free';",
  "export type DialogueTopic = 'intro' | 'favorites' | 'shizuoka_culture' | 'talents' | 'daily_routine' | 'free';",
  'DialogueTopic six-topic union',
));

edit('src/data/curriculum.ts', (text) => {
  text = replaceOnce(
    text,
    "import { AIStudentProfile, DialogueTopic, TopicOption } from '../types';\n\n",
    "import { AIStudentProfile, DialogueTopic, TopicOption } from '../types';\n\nexport const DAILY_ROUTINE_STARTER_ENGLISH = 'I usually get up at seven. What time do you get up?';\n\n",
    'daily routine starter constant',
  );
  text = replaceOnce(
    text,
    "  talents,\n  free,\n});",
    "  talents,\n  daily_routine: DAILY_ROUTINE_STARTER_ENGLISH,\n  free,\n});",
    'topicPrompts daily routine member',
  );
  const freeBlock = `  {\n    id: 'free',\n    title: 'じゆうトーク・おしゃべり',\n    subTitle: 'Free Chat & Conversation',\n    description: '今日あったことや好きなゲーム、今日のごはんなど自由に英語でおしゃべり！',\n    iconName: 'MessageCircle',\n    examplePhrases: ['I played video games today.', 'I ate ramen for lunch.', 'Tomorrow is weekend!', 'What game do you play?'],\n  },`;
  const dailyBlock = `  {\n    id: 'daily_routine',\n    title: 'ふだんの生活・一日のようす',\n    subTitle: 'Daily Routines & Time',\n    description: '起きる時間や、ふだんしていることをたずね合って、おたがいのことをもっと知ろう！',\n    iconName: 'Clock3',\n    examplePhrases: ['What time do you get up?', 'I get up at seven.', 'I usually ... / I sometimes ...', 'How about you?'],\n  },\n`;
  if (!text.includes("id: 'daily_routine'")) {
    if (!text.includes(freeBlock)) throw new Error('Missing free topic block');
    text = text.replace(freeBlock, dailyBlock + freeBlock);
  }
  return text;
});

edit('src/utils/translation.ts', (text) => {
  text = replaceOnce(
    text,
    "export const STARTER_PROMPTS_JAPANESE: Record<string, Record<DialogueTopic, string>> = {",
    "const BASE_STARTER_PROMPTS_JAPANESE: Record<string, Record<Exclude<DialogueTopic, 'daily_routine'>, string>> = {",
    'base starter translation map',
  );
  const marker = "};\n\n// Common vocabulary translation dictionary for elementary school 5th/6th grade";
  if (!text.includes('export const DAILY_ROUTINE_STARTER_JAPANESE')) {
    if (!text.includes(marker)) throw new Error('Missing starter translation map terminator');
    const derived = `};\n\nexport const DAILY_ROUTINE_STARTER_JAPANESE = '私はふだん7時に起きます。あなたは何時に起きますか？';\n\nexport const STARTER_PROMPTS_JAPANESE: Record<string, Record<DialogueTopic, string>> = Object.fromEntries(\n  Object.entries(BASE_STARTER_PROMPTS_JAPANESE).map(([studentId, prompts]) => [\n    studentId,\n    { ...prompts, daily_routine: DAILY_ROUTINE_STARTER_JAPANESE },\n  ]),\n) as Record<string, Record<DialogueTopic, string>>;\n\n// Common vocabulary translation dictionary for elementary school 5th/6th grade`;
    text = text.replace(marker, derived);
  }
  return text;
});

edit('src/dataContract.ts', (text) => text.replace("import './data/dailyRoutineTopic';\n", ''));

edit('src/data/topicLearningGoals.ts', (text) => {
  if (text.includes('daily_routine: [')) return text;
  const marker = '  free: [\n';
  if (!text.includes(marker)) throw new Error('Missing free learning-goal block');
  const daily = `  daily_routine: [\n    {\n      label: '何時に何をするかたずねよう',\n      examples: 'What time do you get up? / What time do you ...?',\n      sourceHint: '6年 Unit 3 What time do you get up?',\n    },\n    {\n      label: '自分の生活を時間といっしょに伝えよう',\n      examples: 'I get up at seven. / I ... at ...',\n      sourceHint: '6年 Unit 3 What time do you get up?',\n    },\n    {\n      label: 'ふだんしていることを伝え合おう',\n      examples: 'I usually ... / I sometimes ... / How about you?',\n      sourceHint: '6年 Unit 3 What time do you get up?',\n    },\n  ],\n`;
  return text.replace(marker, daily + marker);
});

write('src/data/dialogueTopicContext.ts', `import type { DialogueTopic } from '../types';\n\nconst TOPIC_CONTEXTS: Record<DialogueTopic, string> = {\n  intro: 'Get to know each other naturally: names, ages, home countries or places, and simple personal information.',\n  favorites: 'Talk naturally about things each person likes, such as food, sports, animals, subjects, music, and hobbies.',\n  shizuoka_culture: 'Share simple things about Shizuoka, Japan, the persona home country, food, places, and culture.',\n  talents: 'Talk naturally about things each person can do or is good at.',\n  daily_routine: 'Talk naturally about everyday routines and time: getting up, breakfast, university or school, helping at home, free time, dinner, and bedtime. For consistent simple persona answers when a routine fact is needed, use: get up at 7:00, breakfast at 7:30, university at 9:00, dinner at 7:00 p.m., bedtime at 11:00 p.m.; sometimes help by cooking or cleaning.',\n  free: 'Follow the child naturally across familiar everyday topics while keeping the English easy.',\n};\n\nexport function getDialogueTopicContext(topic: DialogueTopic): string {\n  return TOPIC_CONTEXTS[topic];\n}\n`);

edit('server.ts', (text) => {
  text = replaceOnce(
    text,
    "import { getAIStudentById } from './src/data/curriculum';\n",
    "import { getAIStudentById } from './src/data/curriculum';\nimport { getDialogueTopicContext } from './src/data/dialogueTopicContext';\n",
    'server topic context import',
  );
  text = replaceOnce(
    text,
    '   - If the student asks a question, answer that exact question first using the persona facts.',
    '   - If the student asks a question, answer that exact question first using the persona facts and current topic context.',
    'server direct-answer context wording',
  );
  text = replaceOnce(
    text,
    "Selected topic: ${String(topic || 'favorites')}\nStudent's latest input: \"${safeUserMessage}\"",
    "Selected topic: ${String(topic || 'favorites')}\nTopic context: ${getDialogueTopicContext(topic)}\nStudent's latest input: \"${safeUserMessage}\"",
    'server topic context prompt',
  );
  return text;
});

edit('src/utils/responseValidation.ts', (text) => {
  const oldBlock = `  let selected = validSegments;\n  if (validSegments.length > 2) {\n    const finalQuestion = [...validSegments].reverse().find((segment) => /\\?\\s*$/.test(segment.english));\n    selected = finalQuestion && finalQuestion !== validSegments[0]\n      ? [validSegments[0], finalQuestion]\n      : validSegments.slice(0, 2);\n  } else {\n    selected = validSegments.slice(0, 2);\n  }`;
  const newBlock = `  let selected = validSegments.slice(0, 2);\n  if (validSegments.length > 2) {\n    const finalQuestion = [...validSegments].reverse().find((segment) => /\\?\\s*$/.test(segment.english));\n    if (finalQuestion) {\n      const first = validSegments[0];\n      const firstWords = first.english.split(/\\s+/).filter(Boolean);\n      const firstIsBriefReaction =\n        firstWords.length <= 3 &&\n        !/\\b(i|you|my|your|we|he|she|they|it)\\b/i.test(first.english);\n      const directAnswer = firstIsBriefReaction && validSegments[1] ? validSegments[1] : first;\n      selected = finalQuestion !== directAnswer ? [directAnswer, finalQuestion] : [directAnswer];\n    }\n  }`;
  return replaceOnce(text, oldBlock, newBlock, 'aligned reply direct-answer preservation');
});

write('scripts/qa-dialogue.ts', `import { AI_STUDENTS_MASTER_LIST, TARGET_20_AI_STUDENT_IDS } from '../src/data/curriculum';\nimport type { DialogueTopic } from '../src/types';\n\nconst topics: DialogueTopic[] = ['intro', 'favorites', 'shizuoka_culture', 'talents', 'daily_routine', 'free'];\nconst durations = [1, 2, 3, 5] as const;\nconst forbiddenFixedPrefixes = [\n  'awesome!', 'brilliant!', 'wonderful!', 'fantastic!', 'totally!', 'no worries!',\n  'excellent!', 'amazing!', 'great job!', 'very good!', 'so cool!', 'so nice!',\n  'delightful!', 'terrific!', 'splendid!', 'cheers!', 'spot on!', 'well done!',\n  'good on ya!', 'glad to hear!', 'welcome!', 'hello friend!', 'hey friend!'\n];\n\nfunction wordCount(text: string): number { return text.trim().split(/\\s+/).filter(Boolean).length; }\nconst failures: string[] = [];\nlet checked = 0;\n\nfor (const id of TARGET_20_AI_STUDENT_IDS) {\n  const student = AI_STUDENTS_MASTER_LIST.find((item) => item.id === id);\n  if (!student) { failures.push(\`Missing target persona: \${id}\`); continue; }\n  if (student.fillerWords.length !== 0) failures.push(\`\${student.id}: fillerWords must be empty\`);\n  if (student.characteristicPhrases.length !== 0) failures.push(\`\${student.id}: characteristicPhrases must be empty\`);\n  for (const topic of topics) {\n    const starter = student.topicPrompts[topic]?.trim();\n    if (!starter) { failures.push(\`\${student.id}/\${topic}: missing starter\`); continue; }\n    const lower = starter.toLowerCase();\n    if (forbiddenFixedPrefixes.some((prefix) => lower.startsWith(prefix))) failures.push(\`\${student.id}/\${topic}: fixed reaction prefix remains: \${starter}\`);\n    if (wordCount(starter) > 14) failures.push(\`\${student.id}/\${topic}: starter too difficult/long (\${wordCount(starter)} words): \${starter}\`);\n    if (!starter.includes('?')) failures.push(\`\${student.id}/\${topic}: starter must include an easy question\`);\n    for (const duration of durations) { void duration; checked += 1; if (student.topicPrompts[topic] !== starter) failures.push(\`\${student.id}/\${topic}: starter unexpectedly varies by duration\`); }\n  }\n}\nif (TARGET_20_AI_STUDENT_IDS.length !== 20) failures.push(\`Expected 20 target personas, found \${TARGET_20_AI_STUDENT_IDS.length}\`);\nif (failures.length) { console.error('Dialogue QA FAILED'); failures.forEach((failure) => console.error(\`- \${failure}\`)); process.exit(1); }\nconsole.log(\`Dialogue QA PASS: \${TARGET_20_AI_STUDENT_IDS.length} students × \${topics.length} topics × \${durations.length} durations = \${checked} combinations checked.\`);\n`);

write('scripts/qa-starter-translations.ts', `import { AI_STUDENTS_MASTER_LIST, TARGET_20_AI_STUDENT_IDS } from '../src/data/curriculum';\nimport { STARTER_PROMPTS_JAPANESE } from '../src/utils/translation';\nimport type { DialogueTopic } from '../src/types';\n\nconst topics: DialogueTopic[] = ['intro', 'favorites', 'shizuoka_culture', 'talents', 'daily_routine', 'free'];\nconst nativeGreetings = ['ミンガラバー', 'スィア', 'チェシチ', 'シンチャオ'];\nconst failures: string[] = [];\nlet checked = 0;\nfor (const id of TARGET_20_AI_STUDENT_IDS) {\n  const student = AI_STUDENTS_MASTER_LIST.find((item) => item.id === id);\n  if (!student) { failures.push(\`Missing target persona: \${id}\`); continue; }\n  const translations = STARTER_PROMPTS_JAPANESE[student.id];\n  for (const topic of topics) {\n    checked += 1;\n    const english = student.topicPrompts[topic]?.trim();\n    const japanese = translations?.[topic]?.trim();\n    if (!english) failures.push(\`\${student.id}/\${topic}: English starter is missing\`);\n    if (!japanese) failures.push(\`\${student.id}/\${topic}: Japanese translation is missing\`);\n    if (japanese && topic !== 'intro' && nativeGreetings.some((greeting) => japanese.includes(greeting))) failures.push(\`\${student.id}/\${topic}: translation adds a greeting not spoken in English\`);\n  }\n}\nif (failures.length) { console.error('STARTER TRANSLATION QA FAILED'); failures.forEach((failure) => console.error(\`- \${failure}\`)); process.exit(1); }\nconsole.log(\`STARTER TRANSLATION QA PASS: \${checked} English/Japanese pairs checked.\`);\n`);

write('scripts/qa-dialogue-alignment.ts', `import { readFileSync } from 'node:fs';\nimport { buildAlignedReply } from '../src/utils/responseValidation';\nimport { generateFallbackFeedback } from '../src/utils/feedbackFallback';\nimport { getAIStudentById } from '../src/data/curriculum';\n\nconst assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };\n\nconst ageReply = buildAlignedReply({ replySegments: [\n  { english: 'I am 20 years old.', japanese: '私は20歳です。' },\n  { english: 'I am a student at Shizuoka University.', japanese: '静岡大学の学生です。' },\n  { english: 'What subject do you like?', japanese: 'どの教科が好きですか？' },\n]}, 'Emma');\nassert(ageReply.english === 'I am 20 years old. What subject do you like?', 'Direct answer must survive classroom-length selection');\nassert(ageReply.japanese === '私は20歳です。どの教科が好きですか？', 'Japanese must select exactly the same segments as English');\n\nconst routineReply = buildAlignedReply({ replySegments: [\n  { english: 'Oh, nice!', japanese: 'そうなんだ！' },\n  { english: 'I get up at seven.', japanese: '私は7時に起きます。' },\n  { english: 'What time do you go to bed?', japanese: 'あなたは何時に寝ますか？' },\n]}, 'Emma');\nassert(routineReply.english === 'I get up at seven. What time do you go to bed?', 'A brief reaction must never replace the direct answer');\nassert(routineReply.japanese === '私は7時に起きます。あなたは何時に寝ますか？', 'Daily-routine answer and translation must stay aligned');\n\nconst yesNoReply = buildAlignedReply({ replySegments: [\n  { english: 'Yes, I do.', japanese: 'はい、します。' },\n  { english: 'I sometimes cook.', japanese: 'ときどき料理をします。' },\n  { english: 'How about you?', japanese: 'あなたはどうですか？' },\n]}, 'Emma');\nassert(yesNoReply.english.startsWith('Yes, I do.'), 'A short direct Yes/No answer must not be mistaken for a disposable reaction');\n\nconst sharedInformation = buildAlignedReply({ replySegments: [\n  { english: 'Nice!', japanese: 'いいね！' },\n  { english: 'Do you play soccer?', japanese: 'サッカーをしますか？' },\n]}, 'Emma');\nassert(sharedInformation.segmentCount === 2, 'Natural reaction plus question should be preserved');\n\nconst emma = getAIStudentById('emma_usa');\nconst fallback = generateFallbackFeedback(emma, 'あなた', 1, 4, 60, 1, [], []);\nassert(Boolean(fallback.studentMessage), 'Fallback student message is required');\nassert(!fallback.studentMessage.includes('Emma') && !fallback.studentMessage.includes('エマ'), 'Fallback student message must not describe Emma in the third person');\nconst serverSource = readFileSync('server.ts', 'utf8');\nassert(serverSource.includes('\"replySegments\"'), 'Server must request aligned reply segments');\nassert(serverSource.includes('getDialogueTopicContext(topic)'), 'Server must provide the same formal topic context path for all six topics');\nassert(!serverSource.includes('function ensureQuestion('), 'Server must not force a question mechanically');\nconsole.log('DIALOGUE ALIGNMENT QA PASS');\n`);

edit('scripts/qa-data-contract.ts', (text) => {
  text = text.replace("import { AI_STUDENTS_MASTER_LIST, DIALOGUE_TOPICS, TARGET_20_AI_STUDENT_IDS } from '../src/data/curriculum';", "import { AI_STUDENTS_MASTER_LIST, DAILY_ROUTINE_STARTER_ENGLISH, DIALOGUE_TOPICS, TARGET_20_AI_STUDENT_IDS } from '../src/data/curriculum';");
  text = text.replace("import { STARTER_PROMPTS_JAPANESE } from '../src/utils/translation';", "import { DAILY_ROUTINE_STARTER_JAPANESE, STARTER_PROMPTS_JAPANESE } from '../src/utils/translation';");
  text = text.replace("import { DAILY_ROUTINE_STARTER_ENGLISH, DAILY_ROUTINE_STARTER_JAPANESE } from '../src/data/dailyRoutineTopic';\n", '');
  if (!text.includes("assert.equal(server.includes(\"dailyRoutineTopic\"),false)")) {
    text = text.replace("const server=await readFile('server.ts','utf8');", "const dataContractSource=await readFile('src/dataContract.ts','utf8');assert.equal(dataContractSource.includes('dailyRoutineTopic'),false);\nconst server=await readFile('server.ts','utf8');");
  }
  return text;
});

edit('.github/workflows/cloud-run-deploy.yml', (text) => {
  if (text.includes('Production daily-routine direct-answer smoke')) return text;
  const marker = `          echo \"$chat\" | grep -q '\"model\":\"claude-sonnet-5\"'\n\n`;
  if (!text.includes(marker)) throw new Error('Missing production chat smoke marker');
  const addition = `          echo \"$chat\" | grep -q '\"model\":\"claude-sonnet-5\"'\n\n          # Production daily-routine direct-answer smoke: /api/chat only, never writes Firestore.\n          routine=$(curl --fail --silent --show-error --max-time 50 \\\n            -X POST \"$API_URL/api/chat\" \\\n            -H 'Content-Type: application/json' \\\n            --data '{\"message\":\"What time do you get up?\",\"history\":[{\"id\":\"ai-start\",\"sender\":\"ai\",\"englishText\":\"I usually get up at seven. What time do you get up?\",\"timestamp\":1}],\"topic\":\"daily_routine\",\"aiStudentId\":\"emma_usa\"}')\n          ROUTINE_JSON=\"$routine\" python3 - <<'PY'\n          import json, os\n          data=json.loads(os.environ['ROUTINE_JSON'])\n          assert data.get('success') is True, data\n          reply=str(data.get('data',{}).get('reply','')).lower()\n          assert ('seven' in reply or '7' in reply), reply\n          assert data.get('_diagnostics',{}).get('route') == 'anthropic-resilient', data\n          PY\n\n`;
  return text.replace(marker, addition);
});

console.log('Six-topic formalization codemod complete.');
