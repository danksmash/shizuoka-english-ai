import assert from 'node:assert/strict';
import { interpretContextualAsrWithAlternatives } from '../src/utils/contextualAsrAlternatives';

const explicitFood = interpretContextualAsrWithAlternatives({
  text: 'I like NATO.',
  alternatives: [
    { text: 'I like natto.', confidence: 0.47, primaryConfidence: 0.51, rank: 2 },
  ],
  previousAiText: 'What food do you like?',
  topic: 'favorites',
});
assert.equal(explicitFood.text, 'I like natto.');
assert.equal(explicitFood.applied, true);
assert.equal(explicitFood.confidence, 'high');

const broadFavorites = interpretContextualAsrWithAlternatives({
  text: 'I like Naruto.',
  alternatives: [
    { text: 'I like natto.', confidence: 0.49, primaryConfidence: 0.53, rank: 2 },
  ],
  previousAiText: "Let's talk about our favorite things. What do you like?",
  topic: 'favorites',
});
assert.equal(broadFavorites.text, 'I like natto.');
assert.equal(broadFavorites.applied, true);

const noAlternative = interpretContextualAsrWithAlternatives({
  text: 'I like Naruto.',
  alternatives: [],
  previousAiText: "Let's talk about our favorite things. What do you like?",
  topic: 'favorites',
});
assert.equal(noAlternative.text, 'I like Naruto.');
assert.equal(noAlternative.applied, false);

const weakAlternative = interpretContextualAsrWithAlternatives({
  text: 'I like Naruto.',
  alternatives: [
    { text: 'I like natto.', confidence: 0.12, primaryConfidence: 0.74, rank: 2 },
  ],
  previousAiText: "Let's talk about our favorite things. What do you like?",
  topic: 'favorites',
});
assert.equal(weakAlternative.text, 'I like Naruto.');
assert.equal(weakAlternative.applied, false);

const realTomato = interpretContextualAsrWithAlternatives({
  text: 'I like tomato.',
  alternatives: [
    { text: 'I like natto.', confidence: 0.31, primaryConfidence: 0.82, rank: 2 },
  ],
  previousAiText: 'What food do you like?',
  topic: 'favorites',
});
assert.equal(realTomato.text, 'I like tomato.');
assert.equal(realTomato.applied, false);

const personName = interpretContextualAsrWithAlternatives({
  text: 'My name is Naruto.',
  alternatives: [
    { text: 'My name is natto.', confidence: 0.49, primaryConfidence: 0.51, rank: 2 },
  ],
  previousAiText: 'What is your name?',
  topic: 'intro',
});
assert.equal(personName.text, 'My name is Naruto.');
assert.equal(personName.applied, false);

console.log('CONTEXTUAL ASR ALTERNATIVES QA PASS');
