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

function assertNoChildNameUseOrEvaluation(reply, candidateNames, label) {
  for (const candidate of candidateNames) {
    assert.doesNotMatch(reply, new RegExp(`\\b${candidate.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'i'), `${label}: AI must not use the child's name in its reply`);
  }
  assert.doesNotMatch(
    reply,
    /\b(?:nice|funny|strange|weird|unusual|interesting|beautiful|cool|great|good|lovely|cute)\s+name\b|\bname\s+(?:is|sounds|seems)\s+(?:nice|funny|strange|weird|unusual|interesting|beautiful|cool|great|good|lovely|cute)\b/i,
    `${label}: AI must not evaluate or comment on the child's name`,
  );
  assert.doesNotMatch(reply, /\b(?:boy|girl|mister|miss|mr\.?|ms\.?)\b/i, `${label}: AI must not infer or use a gendered form of address for the child`);
}

for (let i = 1; i <= 2; i += 1) {
  const nameOnly = await introChat('My name is Haru.');
  assertNoChildNameUseOrEvaluation(nameOnly, ['haru'], `Case A${i}`);
  assert.doesNotMatch(nameOnly, /what(?:'s| is) your name/, `Case A${i}: AI must not repeat the opening name question`);
  assert.match(nameOnly, /nice to meet|hello|hi|what do you like|how old|where|from/, `Case A${i}: AI should acknowledge the introduction naturally without using the name`);
}

for (let i = 1; i <= 2; i += 1) {
  const nameAndSoccer = await introChat('My name is Haru. I like soccer.');
  assertNoChildNameUseOrEvaluation(nameAndSoccer, ['haru'], `Case B${i}`);
  assert.doesNotMatch(nameAndSoccer, /what(?:'s| is) your name/, `Case B${i}: AI must not repeat the opening name question`);
  assert.match(nameAndSoccer, /soccer|football|sport|play|team|player/, `Case B${i}: AI should respond to the soccer information instead of following a fixed script`);
}

const asrLikeName = await introChat('My name is to sushi.');
assertNoChildNameUseOrEvaluation(asrLikeName, ['to sushi'], 'Case C');
assert.doesNotMatch(asrLikeName, /what(?:'s| is) your name|real name|correct name|say your name again|repeat your name/, 'Case C: AI must not challenge or re-request a possibly mis-transcribed name');

const ageQuestion = await introChat("I'm eleven. How old are you?");
assert.match(ageQuestion, /\b20\b|\btwenty\b/, 'Case D: Emma must answer her age directly before moving on');

const localInfo = await introChat('I live in Hamamatsu. I like Hamamatsu gyoza.');
assert.match(localInfo, /hamamatsu|gyoza/, 'Case E: AI should respond to the child local information');
assert.doesNotMatch(localInfo, /what(?:'s| is) your name|how old are you/, 'Case E: AI must not ignore local information and jump to a fixed self-introduction question');
assert.doesNotMatch(localInfo, /hamamatsu gyoza (?:is|are|has|have|comes|means)/, 'Case E: AI should not lead with an encyclopedia-style explanation of the child local item');

const floorYieldHistory = [
  { id: 'ai-start', sender: 'ai', englishText: starter, timestamp: 1 },
  { id: 'child-1', sender: 'child', englishText: 'My name is Haru.', timestamp: 2 },
  { id: 'ai-2', sender: 'ai', englishText: 'Nice to meet you. What do you like?', timestamp: 3 },
  { id: 'child-2', sender: 'child', englishText: 'I like soccer.', timestamp: 4 },
  { id: 'ai-3', sender: 'ai', englishText: 'Soccer is fun. Do you play soccer?', timestamp: 5 },
  { id: 'child-latest', sender: 'child', englishText: 'Yes. I play with my friends.', timestamp: 6 },
];
const floorYield = await introChat('Yes. I play with my friends.', floorYieldHistory);
assert.doesNotMatch(floorYield, /\?/, 'Case F: after two consecutive AI question turns, the next ordinary response should yield the conversational floor');

const firstMismatchHistory = [
  { id: 'ai-start', sender: 'ai', englishText: starter, timestamp: 1 },
  { id: 'child-1', sender: 'child', englishText: 'My name is Yoichi.', timestamp: 2 },
  { id: 'ai-2', sender: 'ai', englishText: 'Nice to meet you. How old are you?', timestamp: 3 },
  { id: 'child-latest', sender: 'child', englishText: 'My name is Watari.', timestamp: 4 },
];
const firstMismatch = await introChat('My name is Watari.', firstMismatchHistory);
assertNoChildNameUseOrEvaluation(firstMismatch, ['yoichi', 'watari'], 'Case G');
assert.doesNotMatch(firstMismatch, /how old are you/, 'Case G: after a mismatched answer, AI must not repeat the same question verbatim; one simpler rephrase is allowed');

const repeatedMismatchHistory = [
  { id: 'ai-start', sender: 'ai', englishText: starter, timestamp: 1 },
  { id: 'child-1', sender: 'child', englishText: 'My name is Yoichi.', timestamp: 2 },
  { id: 'ai-2', sender: 'ai', englishText: 'Nice to meet you. How old are you?', timestamp: 3 },
  { id: 'child-2', sender: 'child', englishText: 'My name is Watari.', timestamp: 4 },
  { id: 'ai-3', sender: 'ai', englishText: 'Are you ten or eleven?', timestamp: 5 },
  { id: 'child-latest', sender: 'child', englishText: 'I like soccer.', timestamp: 6 },
];
const repeatedMismatch = await introChat('I like soccer.', repeatedMismatchHistory);
assertNoChildNameUseOrEvaluation(repeatedMismatch, ['yoichi', 'watari'], 'Case H');
assert.doesNotMatch(repeatedMismatch, /how old|your age|what age|ten or eleven|eleven or twelve/, 'Case H: after one simpler rephrase still fails, AI must stop pressing the age question');
assert.match(repeatedMismatch, /soccer|football|sport|play|team|player/, 'Case H: AI should respond to what the child actually said and move with that topic');

console.log('PRODUCTION CORE 1 NATURAL INTRO + CHILD INTERACTION GUIDANCE QA PASS');
