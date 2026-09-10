import { readFileSync } from 'node:fs';
import { buildAlignedReply } from '../src/utils/responseValidation';
import { generateFallbackFeedback } from '../src/utils/feedbackFallback';
import { getAIStudentById } from '../src/data/curriculum';

const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };

const ageReply = buildAlignedReply({ replySegments: [
  { english: 'I am 20 years old.', japanese: '私は20歳です。' },
  { english: 'I am a student at Shizuoka University.', japanese: '静岡大学の学生です。' },
  { english: 'What subject do you like?', japanese: 'どの教科が好きですか？' },
]}, 'Emma');
assert(ageReply.english === 'I am 20 years old. I am a student at Shizuoka University.', 'A final question must not displace an earlier meaningful statement');
assert(ageReply.japanese === '私は20歳です。静岡大学の学生です。', 'Japanese must select exactly the same balanced segments as English');

const routineReply = buildAlignedReply({ replySegments: [
  { english: 'Oh, nice!', japanese: 'そうなんだ！' },
  { english: 'I get up at seven.', japanese: '私は7時に起きます。' },
  { english: 'What time do you go to bed?', japanese: 'あなたは何時に寝ますか？' },
]}, 'Emma');
assert(routineReply.english === 'I get up at seven. What time do you go to bed?', 'A brief reaction must never replace the direct answer');
assert(routineReply.japanese === '私は7時に起きます。あなたは何時に寝ますか？', 'Daily-routine answer and translation must stay aligned');

const yesNoReply = buildAlignedReply({ replySegments: [
  { english: 'Yes, I do.', japanese: 'はい、します。' },
  { english: 'I sometimes cook.', japanese: 'ときどき料理をします。' },
  { english: 'How about you?', japanese: 'あなたはどうですか？' },
]}, 'Emma');
assert(yesNoReply.english === 'Yes, I do. I sometimes cook.', 'Meaningful self-disclosure must not be displaced just to preserve a final question');

const sharedInformation = buildAlignedReply({ replySegments: [
  { english: 'Nice!', japanese: 'いいね！' },
  { english: 'Do you play soccer?', japanese: 'サッカーをしますか？' },
]}, 'Emma');
assert(sharedInformation.segmentCount === 2, 'Natural reaction plus question should be preserved when the floor is not being yielded');

const twoPriorQuestionTurns = [
  { sender: 'ai', englishText: "Hi! What's your name?" },
  { sender: 'child', englishText: 'My name is Haru.' },
  { sender: 'ai', englishText: 'Nice to meet you. What do you like?' },
  { sender: 'child', englishText: 'I like soccer.' },
  { sender: 'ai', englishText: 'Soccer is fun. Do you play soccer?' },
  { sender: 'child', englishText: 'Yes. I play with my friends.' },
];

const yieldedFloorReply = buildAlignedReply({ replySegments: [
  { english: 'Nice!', japanese: 'いいね！' },
  { english: 'I play soccer with my friends too.', japanese: '私も友達とサッカーをします。' },
  { english: 'Who do you play with?', japanese: 'だれとしますか？' },
]}, 'Emma', { recentHistory: twoPriorQuestionTurns });
assert(yieldedFloorReply.english === 'I play soccer with my friends too.', 'After two AI question turns, prefer a non-question turn that gives the child interactional floor');
assert(!yieldedFloorReply.english.includes('?'), 'Floor-yielding reply must not preserve an optional question');
assert(yieldedFloorReply.japanese === '私も友達とサッカーをします。', 'Floor-yielding English/Japanese segments must stay aligned');

const genuineQuestionOnly = buildAlignedReply({ replySegments: [
  { english: 'What is that?', japanese: 'それは何ですか？' },
]}, 'Emma', { recentHistory: twoPriorQuestionTurns });
assert(genuineQuestionOnly.english === 'What is that?', 'A genuine clarification/information-gap question may survive when Claude supplied no non-question alternative');

const emma = getAIStudentById('emma_usa');
const fallback = generateFallbackFeedback(emma, 'あなた', 1, 4, 60, 1, [], []);
assert(Boolean(fallback.studentMessage), 'Fallback student message is required');
assert(!fallback.studentMessage.includes('Emma') && !fallback.studentMessage.includes('エマ'), 'Fallback student message must not describe Emma in the third person');
const serverSource = readFileSync('server.ts', 'utf8');
assert(serverSource.includes('"replySegments"'), 'Server must request aligned reply segments');
assert(serverSource.includes('getDialogueTopicContext(topic)'), 'Server must provide the same formal topic context path for all six topics');
assert(serverSource.includes('buildAlignedReply(parsed, persona.name, { recentHistory })'), 'Server must pass recent history into aligned turn-taking selection');
assert(!serverSource.includes('function ensureQuestion('), 'Server must not force a question mechanically');
console.log('DIALOGUE ALIGNMENT QA PASS');
