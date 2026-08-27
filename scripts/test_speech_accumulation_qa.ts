import { accumulateSpeechResults, formatSpeechText, rebuildSpeechRecognitionSnapshot } from '../src/utils/speech';

function runSpeechAccumulationQASuite() {
  console.log('================================================================');
  console.log('       SPEECH RECOGNITION ACCUMULATION & FORMATTING QA SUITE    ');
  console.log('================================================================');

  console.log('\n--- TEST 1: SPEECH-ACCUMULATION-01 (MULTI-RESULT WITH PAUSES) ---');
  const event1Results = [{ transcript: 'Hello', isFinal: true }];
  const event2Results = [
    { transcript: 'Hello', isFinal: true },
    { transcript: 'my name is Emma', isFinal: true }
  ];
  const event3Results = [
    { transcript: 'Hello', isFinal: true },
    { transcript: 'my name is Emma', isFinal: true },
    { transcript: 'I like soccer', isFinal: true }
  ];

  const res1 = accumulateSpeechResults(event1Results);
  const res2 = accumulateSpeechResults(event2Results);
  const res3 = accumulateSpeechResults(event3Results);
  console.log(`  Step 1 (Hello): "${res1.formatted}"`);
  console.log(`  Step 2 (+ my name is Emma): "${res2.formatted}"`);
  console.log(`  Step 3 (+ I like soccer): "${res3.formatted}"`);
  const expectedFinal = 'Hello. My name is Emma. I like soccer.';
  if (res3.formatted.replace(/\s+/g, ' ') !== expectedFinal) {
    throw new Error(`Accumulation mismatch! Got "${res3.formatted}", expected "${expectedFinal}"`);
  }
  console.log('  ✓ Multi-result accumulation passed');

  console.log('\n--- TEST 2: INTERIM -> FINAL PROGRESSION QA ---');
  const streamSteps = [
    { desc: 'interim 1', results: [{ transcript: 'I like', isFinal: false }] },
    { desc: 'interim 2', results: [{ transcript: 'I like sush', isFinal: false }] },
    { desc: 'final 1', results: [{ transcript: 'I like sushi', isFinal: true }] },
    { desc: 'interim 3', results: [{ transcript: 'I like sushi', isFinal: true }, { transcript: 'and green', isFinal: false }] },
    { desc: 'final 2', results: [{ transcript: 'I like sushi', isFinal: true }, { transcript: 'and green tea', isFinal: true }] },
  ];
  for (const step of streamSteps) {
    const out = accumulateSpeechResults(step.results);
    if (!out.formatted.toLowerCase().includes('like')) throw new Error(`Intermediate transcript lost at ${step.desc}`);
  }
  console.log('  ✓ Interim to final progression passed');

  console.log('\n--- TEST 3: CAPITALIZATION, PROPER NOUNS & PUNCTUATION ---');
  const testPhrases = [
    { input: 'hello my name is ken', expected: 'Hello. My name is Ken.' },
    { input: 'i live in hamamatsu', expected: 'I live in Hamamatsu.' },
    { input: 'i like mt fuji', expected: 'I like Mt. Fuji.' },
    { input: 'what food do you like', expected: 'What food do you like?' },
    { input: 'can you play soccer', expected: 'Can you play soccer?' },
    { input: 'i like sushi what food do you like', expected: 'I like sushi. What food do you like?' }
  ];
  for (const item of testPhrases) {
    const formatted = formatSpeechText(item.input);
    if (formatted !== item.expected) throw new Error(`Formatting mismatch! Got "${formatted}", expected "${item.expected}"`);
  }
  console.log('  ✓ Formatting regression tests passed');

  console.log('\n--- TEST 4: ANDROID PROGRESSIVE HYPOTHESIS DEDUPLICATION ---');
  const androidProgressive = rebuildSpeechRecognitionSnapshot([
    { transcript: 'My', isFinal: false },
    { transcript: 'My name', isFinal: false },
    { transcript: 'My name is', isFinal: false },
    { transcript: 'My name is Ken', isFinal: true },
  ]);
  if (androidProgressive.formatted !== 'My name is Ken.') {
    throw new Error(`Android progressive duplication regression: ${androidProgressive.formatted}`);
  }
  console.log(`  ✓ Progressive Android hypotheses: "${androidProgressive.formatted}"`);

  console.log('\n--- TEST 5: NORMAL FINAL + INTERIM PRESERVATION ---');
  const normalFinalPlusInterim = rebuildSpeechRecognitionSnapshot([
    { transcript: 'I like soccer', isFinal: true },
    { transcript: 'and dogs', isFinal: false },
  ]);
  if (normalFinalPlusInterim.formatted !== 'I like soccer and dogs.') {
    throw new Error(`Final + interim regression: ${normalFinalPlusInterim.formatted}`);
  }
  console.log(`  ✓ Normal final + interim preserved: "${normalFinalPlusInterim.formatted}"`);

  console.log('================================================================');
  console.log('      ALL SPEECH ACCUMULATION & ANDROID REGRESSION TESTS PASS   ');
  console.log('================================================================');
}

runSpeechAccumulationQASuite();
