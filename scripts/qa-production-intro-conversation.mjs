import assert from 'node:assert/strict';

const apiUrl = (process.env.API_URL || process.argv[2] || '').replace(/\/$/, '');
assert.ok(apiUrl, 'API_URL is required');

const starter = "Hi! I'm Emma from California. What's your name?";

async function introChat(message) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const history = [
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

const nameOnly = await introChat('My name is Haru.');
assert.doesNotMatch(nameOnly, /what(?:'s| is) your name/, 'Case A: AI must not repeat the opening name question');
assert.match(nameOnly, /haru|nice to meet|hello|hi/, 'Case A: AI should acknowledge the child introduction naturally');

const nameAndSoccer = await introChat('My name is Haru. I like soccer.');
assert.doesNotMatch(nameAndSoccer, /what(?:'s| is) your name/, 'Case B: AI must not repeat the opening name question');
assert.match(nameAndSoccer, /soccer|football|sport|play|team|player/, 'Case B: AI should respond to the soccer information instead of following a fixed script');

const ageQuestion = await introChat("I'm eleven. How old are you?");
assert.match(ageQuestion, /\b20\b|\btwenty\b/, 'Case C: Emma must answer her age directly before moving on');

const localInfo = await introChat('I live in Hamamatsu. I like Hamamatsu gyoza.');
assert.match(localInfo, /hamamatsu|gyoza/, 'Case D: AI should respond to the child local information');
assert.doesNotMatch(localInfo, /what(?:'s| is) your name|how old are you/, 'Case D: AI must not ignore local information and jump to a fixed self-introduction question');
assert.doesNotMatch(localInfo, /hamamatsu gyoza (?:is|are|has|have|comes|means)/, 'Case D: AI should not lead with an encyclopedia-style explanation of the child local item');

console.log('PRODUCTION CORE 1 NATURAL INTRO CONVERSATION QA PASS');
