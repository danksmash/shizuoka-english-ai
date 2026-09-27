import assert from 'node:assert/strict';

const apiUrl = (process.env.API_URL || process.argv[2] || '').replace(/\/$/, '');
assert.ok(apiUrl, 'API_URL is required');

const starter = "Hi! I'm Emma from California. What's your name?";

async function introChat(message, customHistory = null) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const history = customHistory || [
        { id: 'ai-start', sender: 'ai', englishText: starter, timestamp: 1 },
        { id: 'child-latest', sender: 'child', englishText: message, timestamp: 2 },
      ];
      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history, topic: 'intro', aiStudentId: 'emma_usa' }),
        signal: AbortSignal.timeout(50_000),
      });
      const body = await response.json();
      assert.equal(response.ok, true, `intro QA: HTTP ${response.status}`);
      assert.equal(body.success, true, 'intro QA: chat did not succeed');
      assert.equal(body?._diagnostics?.route, 'anthropic-resilient', 'intro QA: unexpected route');
      assert.equal(body?._diagnostics?.model, 'claude-sonnet-5', 'intro QA: unexpected model');
      const reply = String(body?.data?.reply || '').trim();
      assert.ok(reply, 'intro QA: empty reply');
      console.log(`Core1 input: ${message}\nCore1 reply: ${reply}`);
      return reply.toLowerCase();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
  throw lastError;
}

function assertNoNameHandling(reply, candidateNames, label) {
  for (const candidate of candidateNames) {
    assert.doesNotMatch(reply, new RegExp(`\\b${candidate}\\b`, 'i'), `${label}: AI must not repeat a learner name candidate`);
  }
  assert.doesNotMatch(
    reply,
    /\b(?:nice|funny|strange|weird|unusual|interesting|beautiful|cool|great|good)\s+name\b|so many names|what(?:'s| is) your (?:real|correct) name|what(?:'s| is) your name|is your name|did you say|how do you spell[^?]*name|repeat[^?]*name/i,
    `${label}: AI must not evaluate, confirm, challenge, spell, or re-ask a learner name`,
  );
}

const nameOnly = await introChat('My name is Haru.');
assertNoNameHandling(nameOnly, ['haru'], 'Case A');
assert.match(nameOnly, /nice to meet|hello|hi|what do you like|how old/, 'Case A: AI should acknowledge the introduction naturally and move on');

const nameAndSoccer = await introChat('My name is Haru. I like soccer.');
assertNoNameHandling(nameAndSoccer, ['haru'], 'Case B');
assert.match(nameAndSoccer, /soccer|football|sport|play|team|player/, 'Case B: AI should respond to the soccer information instead of following a fixed script');

const ageQuestion = await introChat("I'm eleven. How old are you?");
assert.match(ageQuestion, /\b20\b|\btwenty\b/, 'Case C: Emma must answer her age directly before moving on');

const localInfo = await introChat('I live in Hamamatsu. I like Hamamatsu gyoza.');
assert.match(localInfo, /hamamatsu|gyoza/, 'Case D: AI should respond to the child local information');
assert.doesNotMatch(localInfo, /what(?:'s| is) your name|how old are you/, 'Case D: AI must not ignore local information and jump to a fixed self-introduction question');
assert.doesNotMatch(localInfo, /hamamatsu gyoza (?:is|are|has|have|comes|means)/, 'Case D: AI should not lead with an encyclopedia-style explanation of the child local item');

const floorYieldHistory = [
  { id: 'ai-start', sender: 'ai', englishText: starter, timestamp: 1 },
  { id: 'child-1', sender: 'child', englishText: 'My name is Haru.', timestamp: 2 },
  { id: 'ai-2', sender: 'ai', englishText: 'Nice to meet you. What do you like?', timestamp: 3 },
  { id: 'child-2', sender: 'child', englishText: 'I like soccer.', timestamp: 4 },
  { id: 'ai-3', sender: 'ai', englishText: 'Soccer is fun. Do you play soccer?', timestamp: 5 },
  { id: 'child-latest', sender: 'child', englishText: 'Yes. I play with my friends.', timestamp: 6 },
];
const floorYield = await introChat('Yes. I play with my friends.', floorYieldHistory);
assert.doesNotMatch(floorYield, /\?/, 'Case E: after two consecutive AI question turns, the next ordinary response should yield the conversational floor');

const misunderstoodAgeHistory = [
  { id: 'ai-start', sender: 'ai', englishText: starter, timestamp: 1 },
  { id: 'child-1', sender: 'child', englishText: 'My name is Yoichi.', timestamp: 2 },
  { id: 'ai-2', sender: 'ai', englishText: 'Nice to meet you! How old are you?', timestamp: 3 },
  { id: 'child-latest', sender: 'child', englishText: 'My name is Watari.', timestamp: 4 },
];
const misunderstoodAge = await introChat('My name is Watari.', misunderstoodAgeHistory);
assertNoNameHandling(misunderstoodAge, ['yoichi', 'watari'], 'Case F');

const repeatedMisunderstandingHistory = [
  { id: 'ai-start', sender: 'ai', englishText: starter, timestamp: 1 },
  { id: 'child-1', sender: 'child', englishText: 'My name is Yoichi.', timestamp: 2 },
  { id: 'ai-2', sender: 'ai', englishText: 'Nice to meet you! How old are you?', timestamp: 3 },
  { id: 'child-2', sender: 'child', englishText: 'My name is Watari.', timestamp: 4 },
  { id: 'ai-3', sender: 'ai', englishText: 'How old are you?', timestamp: 5 },
  { id: 'child-latest', sender: 'child', englishText: 'My name is Yoshi.', timestamp: 6 },
];
const repeatedMisunderstanding = await introChat('My name is Yoshi.', repeatedMisunderstandingHistory);
assertNoNameHandling(repeatedMisunderstanding, ['yoichi', 'watari', 'yoshi'], 'Case G');
assert.doesNotMatch(repeatedMisunderstanding, /how old|your age|what age|ten or eleven|eleven or twelve/, 'Case G: after repeated non-understanding, AI must stop pressing the same age question and move to another easy topic');

console.log('PRODUCTION CORE 1 NATURAL INTRO + CHILD-SAFE DIALOGUE QA PASS');
