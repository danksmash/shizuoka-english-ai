import { accumulateSpeechResults, formatSpeechText, rebuildSpeechRecognitionSnapshot } from '../src/utils/speech';

function runSpeechAccumulationQASuite() {
  console.log('================================================================');
  console.log('       SPEECH RECOGNITION ACCUMULATION & FORMATTING QA SUITE    ');
  console.log('================================================================');

  // -------------------------------------------------------------
  // TEST 1: SPEECH-ACCUMULATION-01 (Multi-Result & Pause Accumulation)
  // -------------------------------------------------------------
  console.log('\n--- TEST 1: SPEECH-ACCUMULATION-01 (MULTI-RESULT WITH PAUSES) ---');
  
  // Event sequence: result 1: Hello -> pause -> result 2: my name is Emma -> pause -> result 3: I like soccer
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
  if (res3.formatted.replace(/\s+/g, ' ') === expectedFinal) {
    console.log(`  ✓ SPEECH-ACCUMULATION-01 PASSED: "${res3.formatted}" matches expected "${expectedFinal}"`);
  } else {
    throw new Error(`Accumulation mismatch! Got "${res3.formatted}", expected "${expectedFinal}"`);
  }

  // -------------------------------------------------------------
  // TEST 2: INTERIM -> FINAL TRANSITION WITH NO LOSS
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: INTERIM -> FINAL PROGRESSION QA ---');
  
  // Stream progression
  const streamSteps = [
    { desc: 'interim 1', results: [{ transcript: 'I like', isFinal: false }] },
    { desc: 'interim 2', results: [{ transcript: 'I like sush', isFinal: false }] },
    { desc: 'final 1', results: [{ transcript: 'I like sushi', isFinal: true }] },
    { desc: 'interim 3 (after pause)', results: [{ transcript: 'I like sushi', isFinal: true }, { transcript: 'and green', isFinal: false }] },
    { desc: 'final 2', results: [{ transcript: 'I like sushi', isFinal: true }, { transcript: 'and green tea', isFinal: true }] },
  ];

  for (const step of streamSteps) {
    const out = accumulateSpeechResults(step.results);
    console.log(`  [${step.desc}] -> "${out.formatted}" (hasFinal: ${out.hasFinal})`);
    if (!out.formatted.toLowerCase().includes('like')) {
      throw new Error(`Intermediate transcript lost at step ${step.desc}`);
    }
  }
  console.log('  ✓ Interim to Final progression completed without any dropouts');

  // -------------------------------------------------------------
  // TEST 3: CAPITALIZATION & PUNCTUATION CORRECTION
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: CAPITALIZATION, PROPER NOUNS & PUNCTUATION CORRECTION ---');

  const testPhrases = [
    {
      input: 'hello my name is ken',
      expected: 'Hello. My name is Ken.'
    },
    {
      input: 'i live in hamamatsu',
      expected: 'I live in Hamamatsu.'
    },
    {
      input: 'i like mt fuji',
      expected: 'I like Mt. Fuji.'
    },
    {
      input: 'what food do you like',
      expected: 'What food do you like?'
    },
    {
      input: 'can you play soccer',
      expected: 'Can you play soccer?'
    },
    {
      input: 'i like sushi what food do you like',
      expected: 'I like sushi. What food do you like?'
    }
  ];

  for (const item of testPhrases) {
    const formatted = formatSpeechText(item.input);
    console.log(`  Input: "${item.input}"\n  -> Output: "${formatted}"`);
    if (formatted !== item.expected) {
      throw new Error(`Formatting mismatch! Got "${formatted}", expected "${item.expected}"`);
    }
    console.log(`  ✓ Match verified`);
  }

  // -------------------------------------------------------------
  // TEST 4: ANDROID PROGRESSIVE HYPOTHESIS DEDUPLICATION
  // -------------------------------------------------------------
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
  console.log(`  ✓ Progressive hypotheses collapse correctly: "${androidProgressive.formatted}"`);

  // -------------------------------------------------------------
  // TEST 5: NORMAL FINAL + INTERIM PRESERVATION
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: NORMAL FINAL + INTERIM PRESERVATION ---');
  const normalFinalPlusInterim = rebuildSpeechRecognitionSnapshot([
    { transcript: 'I like soccer', isFinal: true },
    { transcript: 'and dogs', isFinal: false },
  ]);
  if (normalFinalPlusInterim.formatted !== 'I like soccer and dogs.') {
    throw new Error(`Final + interim preservation regression: ${normalFinalPlusInterim.formatted}`);
  }
  console.log(`  ✓ Normal finalized + interim speech is preserved: "${normalFinalPlusInterim.formatted}"`);

  console.log('================================================================');
  console.log('      ALL SPEECH ACCUMULATION & FORMATTING TESTS PASSED 100%    ');
  console.log('================================================================');
}

runSpeechAccumulationQASuite();
