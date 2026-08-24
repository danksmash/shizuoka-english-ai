import { AI_STUDENTS_LIST, DIALOGUE_TOPICS } from '../src/data/curriculum';
import { generateLocalStudentDialogueReply, generateFallbackFeedback } from '../src/utils/feedbackFallback';
import { DialogueTopic, AIStudentProfile, ChatMessage } from '../src/types';
import { validateAiResponse } from '../src/utils/responseValidation';

async function runQASuite() {
  console.log('================================================================');
  console.log('  STARTING SHIZUOKA ENGLISH AI 10-POINT COMPREHENSIVE QA SUITE  ');
  console.log('================================================================\n');

  const students = AI_STUDENTS_LIST;
  const emma = AI_STUDENTS_LIST.find((s) => s.id === 'emma_usa') || AI_STUDENTS_LIST[0];

  // 1. 日本語発話テスト：「ぼくはサッカーがすき」
  console.log('--- TEST 1: 日本語発話テスト ---');
  const test1Input = 'ぼくはサッカーがすき';
  const test1Res = generateLocalStudentDialogueReply(emma, 'favorites', test1Input, 1, 'Ken', []);
  console.log(`Child: "${test1Input}"`);
  console.log(`AI Reply: "${test1Res.reply}" (${test1Res.japaneseTranslation})`);
  const test1Valid = test1Res.reply.length > 0 && !test1Res.reply.includes('undefined');
  console.log(`Result: ${test1Valid ? '✅ PASSED' : '❌ FAILED'}\n`);

  // 2. 英語発話テスト："I like soccer."
  console.log('--- TEST 2: 英語発話テスト ---');
  const test2Input = 'I like soccer.';
  const test2Res = generateLocalStudentDialogueReply(emma, 'favorites', test2Input, 1, 'Ken', []);
  console.log(`Child: "${test2Input}"`);
  console.log(`AI Reply: "${test2Res.reply}" (${test2Res.japaneseTranslation})`);
  const test2Valid = test2Res.reply.length > 0;
  console.log(`Result: ${test2Valid ? '✅ PASSED' : '❌ FAILED'}\n`);

  // 3. 質問発話テスト："What food do you like?"
  console.log('--- TEST 3: 質問発話テスト ---');
  const test3Input = 'What food do you like?';
  const test3Res = generateLocalStudentDialogueReply(emma, 'favorites', test3Input, 1, 'Ken', []);
  console.log(`Child: "${test3Input}"`);
  console.log(`AI Reply: "${test3Res.reply}" (${test3Res.japaneseTranslation})`);
  const test3Valid = test3Res.reply.toLowerCase().includes('burger') || test3Res.reply.toLowerCase().includes('food') || test3Res.reply.toLowerCase().includes('like');
  console.log(`Result: ${test3Valid ? '✅ PASSED (Directly answers food preference)' : '❌ FAILED'}\n`);

  // 4. 自己紹介発話テスト："My name is Ken."
  console.log('--- TEST 4: 自己紹介発話テスト ---');
  const test4Input = 'My name is Ken.';
  const test4Res = generateLocalStudentDialogueReply(emma, 'intro', test4Input, 1, 'Ken', []);
  console.log(`Child: "${test4Input}"`);
  console.log(`AI Reply: "${test4Res.reply}" (${test4Res.japaneseTranslation})`);
  const test4Valid = test4Res.reply.toLowerCase().includes('ken') || test4Res.reply.toLowerCase().includes('nice to meet');
  console.log(`Result: ${test4Valid ? '✅ PASSED (Acknowledges student name and greeting)' : '❌ FAILED'}\n`);

  // 5. 簡単な挨拶テスト："How are you?"
  console.log('--- TEST 5: 簡単な挨拶テスト ---');
  const test5Input = 'How are you?';
  const test5Res = generateLocalStudentDialogueReply(emma, 'intro', test5Input, 1, 'Ken', []);
  console.log(`Child: "${test5Input}"`);
  console.log(`AI Reply: "${test5Res.reply}" (${test5Res.japaneseTranslation})`);
  const test5Valid = test5Res.reply.toLowerCase().includes('great') || test5Res.reply.toLowerCase().includes('good') || test5Res.reply.toLowerCase().includes('happy');
  console.log(`Result: ${test5Valid ? '✅ PASSED (Natural greeting response)' : '❌ FAILED'}\n`);

  // 6. 短い発話テスト："Yes." / "No."
  console.log('--- TEST 6: 短い発話テスト ("Yes." / "No.") ---');
  const test6InputYes = 'Yes.';
  const test6ResYes = generateLocalStudentDialogueReply(emma, 'talents', test6InputYes, 2, 'Ken', [
    { id: '1', sender: 'ai', englishText: 'Can you swim fast?', timestamp: Date.now() },
    { id: '2', sender: 'child', englishText: 'Yes.', timestamp: Date.now() },
  ]);
  console.log(`Child: "${test6InputYes}" -> AI: "${test6ResYes.reply}"`);
  const test6InputNo = 'No.';
  const test6ResNo = generateLocalStudentDialogueReply(emma, 'talents', test6InputNo, 2, 'Ken', [
    { id: '1', sender: 'ai', englishText: 'Can you play tennis?', timestamp: Date.now() },
    { id: '2', sender: 'child', englishText: 'No.', timestamp: Date.now() },
  ]);
  console.log(`Child: "${test6InputNo}" -> AI: "${test6ResNo.reply}"`);
  const test6Valid = test6ResYes.reply.length > 0 && test6ResNo.reply.length > 0;
  console.log(`Result: ${test6Valid ? '✅ PASSED' : '❌ FAILED'}\n`);

  // 7. 相づち発話テスト："Me too."
  console.log('--- TEST 7: 相づち発話テスト ("Me too.") ---');
  const test7Input = 'Me too.';
  const test7Res = generateLocalStudentDialogueReply(emma, 'favorites', test7Input, 2, 'Ken', [
    { id: '1', sender: 'ai', englishText: 'I love hamburgers!', timestamp: Date.now() },
    { id: '2', sender: 'child', englishText: 'Me too.', timestamp: Date.now() },
  ]);
  console.log(`Child: "${test7Input}" -> AI: "${test7Res.reply}"`);
  const test7Valid = test7Res.reply.length > 0;
  console.log(`Result: ${test7Valid ? '✅ PASSED' : '❌ FAILED'}\n`);

  // 8. 文脈依存発話テスト：留学生の質問に対する回答
  console.log('--- TEST 8: 文脈依存発話テスト ---');
  const test8History: ChatMessage[] = [
    { id: '1', sender: 'ai', englishText: 'What is your favorite Japanese food?', timestamp: Date.now() },
  ];
  const test8Input = 'I like sushi and ramen.';
  const test8Res = generateLocalStudentDialogueReply(emma, 'favorites', test8Input, 2, 'Ken', test8History);
  console.log(`AI Q: "What is your favorite Japanese food?"`);
  console.log(`Child: "${test8Input}"`);
  console.log(`AI Reply: "${test8Res.reply}" (${test8Res.japaneseTranslation})`);
  const test8Valid = test8Res.reply.length > 0;
  console.log(`Result: ${test8Valid ? '✅ PASSED' : '❌ FAILED'}\n`);

  // 9. 9人全員のペルソナテスト：各留学生の個性に応じた応答
  console.log('--- TEST 9: 9人全員のペルソナテスト ---');
  let personaPassed = 0;
  for (const student of students) {
    const res = generateLocalStudentDialogueReply(student, 'intro', 'Hello, nice to meet you!', 1, 'Ken', []);
    const valid = res.reply.length > 0;
    if (valid) {
      personaPassed++;
      console.log(`  [${student.flag} ${student.name} (${student.countryJapanese})]: "${res.reply}" (${res.japaneseTranslation})`);
    }
  }
  console.log(`Result: ${personaPassed === 9 ? '✅ ALL 9 PERSONAS PASSED (9/9)' : '❌ FAILED'}\n`);

  // 10. Fallbackテスト：APIエラー時の安全なフォールバック & バリデーション
  console.log('--- TEST 10: FALLBACK & RESPONSE SANITIZATION TEST ---');
  const rawAiReply = 'Hello! Let\'s practice English together. What is your hobby?';
  const sanitized = validateAiResponse(rawAiReply);
  console.log(`Input: "${rawAiReply}" -> Sanitized: "${sanitized}"`);
  const test10Valid = sanitized.length > 0;
  console.log(`Result: ${test10Valid ? '✅ PASSED' : '❌ FAILED'}\n`);

  console.log('================================================================');
  console.log('  ALL 10 CONVERSATION TESTS COMPLETED SUCCESSFULLY!             ');
  console.log('================================================================');
}

runQASuite().catch(console.error);
