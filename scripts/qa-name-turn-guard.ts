import assert from 'node:assert/strict';
import { aiAskedForLearnerName, guardNameTurnAiReply, prepareNameTurnForAi } from '../src/utils/nameTurnGuard';

assert.equal(aiAskedForLearnerName("What's your name?"), true);
assert.equal(aiAskedForLearnerName('What is your name?'), true);
assert.equal(aiAskedForLearnerName('What do you like?'), false);

const garbled = prepareNameTurnForAi("What's your name?", 'My name is to sushi.');
assert.equal(garbled.isNameAnswerTurn, true);
assert.equal(garbled.aiText, 'My name is [name].');
assert.deepEqual(garbled.candidateTokens, ['sushi']);

const richAnswer = prepareNameTurnForAi("What's your name?", 'My name is Haru. I like soccer.');
assert.equal(richAnswer.isNameAnswerTurn, true);
assert.equal(richAnswer.aiText, 'My name is [name]. I like soccer.');
assert.deepEqual(richAnswer.candidateTokens, ['haru']);

const bareAnswer = prepareNameTurnForAi('What is your name?', 'Tsuyoshi');
assert.equal(bareAnswer.aiText, 'My name is [name].');
assert.deepEqual(bareAnswer.candidateTokens, ['tsuyoshi']);

const ordinary = prepareNameTurnForAi('What do you like?', 'I like sushi.');
assert.equal(ordinary.isNameAnswerTurn, false);
assert.equal(ordinary.aiText, 'I like sushi.');

const safe = guardNameTurnAiReply('Nice to meet you! What do you like?', 'はじめまして！何が好きですか？', ['sushi']);
assert.equal(safe.replaced, false);

for (const [english, japanese, tokens] of [
  ['That is a funny name.', 'おもしろい名前ですね。', ['sushi']],
  ['Is your name To Sushi?', 'あなたの名前はTo Sushiですか？', ['sushi']],
  ['Nice to meet you, Haru!', 'はるさん、はじめまして！', ['haru']],
  ['Nice to meet you, Sushi!', 'はじめまして！', ['sushi']],
] as const) {
  const guarded = guardNameTurnAiReply(english, japanese, tokens);
  assert.equal(guarded.replaced, true, english);
  assert.equal(guarded.reply, 'Nice to meet you! What do you like?');
  assert.equal(guarded.japaneseTranslation, 'はじめまして！何が好きですか？');
}

console.log('NAME TURN GUARD QA PASS');
