import { readFileSync } from 'node:fs';
import { buildAlignedReply } from '../src/utils/responseValidation';
import { generateFallbackFeedback } from '../src/utils/feedbackFallback';
import { getAIStudentById } from '../src/data/curriculum';

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const ageReply = buildAlignedReply({
  replySegments: [
    { english: 'I am 20 years old.', japanese: '私は20歳です。' },
    { english: 'I am a student at Shizuoka University.', japanese: '静岡大学の学生です。' },
    { english: 'What subject do you like?', japanese: 'どの教科が好きですか？' },
  ],
}, 'Emma');

assert(
  ageReply.english === 'I am 20 years old. What subject do you like?',
  'Direct answer must survive classroom-length selection'
);
assert(
  ageReply.japanese === '私は20歳です。どの教科が好きですか？',
  'Japanese must select exactly the same segments as English'
);
assert(!ageReply.japanese.includes('静岡大学'), 'Dropped English must not remain in Japanese');

const sharedInformation = buildAlignedReply({
  replySegments: [
    { english: 'Nice!', japanese: 'いいね！' },
    { english: 'Do you play soccer?', japanese: 'サッカーをしますか？' },
  ],
}, 'Emma');
assert(sharedInformation.segmentCount === 2, 'Natural reaction plus question should be preserved');

const emma = getAIStudentById('emma_usa');
const fallback = generateFallbackFeedback(emma, 'あなた', 1, 4, 60, 1, [], []);
assert(Boolean(fallback.studentMessage), 'Fallback student message is required');
assert(
  !fallback.studentMessage.includes('Emma') && !fallback.studentMessage.includes('エマ'),
  'Fallback student message must not describe Emma in the third person'
);

const serverSource = readFileSync('server.ts', 'utf8');
assert(serverSource.includes('"replySegments"'), 'Server must request aligned reply segments');
assert(!serverSource.includes('function ensureQuestion('), 'Server must not force a question mechanically');

console.log('DIALOGUE ALIGNMENT QA PASS');
