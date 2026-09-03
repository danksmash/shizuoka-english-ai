import assert from 'node:assert/strict';

const apiUrl = (process.env.API_URL || process.argv[2] || '').replace(/\/$/, '');
assert.ok(apiUrl, 'API_URL is required');

async function chat(aiStudentId, topic, message) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history: [], topic, aiStudentId }),
        signal: AbortSignal.timeout(50_000),
      });
      const body = await response.json();
      assert.equal(response.ok, true, `${aiStudentId}: HTTP ${response.status}`);
      assert.equal(body.success, true, `${aiStudentId}: chat did not succeed`);
      assert.equal(body?._diagnostics?.route, 'anthropic-resilient', `${aiStudentId}: unexpected route`);
      assert.equal(body?._diagnostics?.model, 'claude-sonnet-5', `${aiStudentId}: unexpected model`);
      const reply = String(body?.data?.reply || '').trim();
      assert.ok(reply, `${aiStudentId}: empty reply`);
      console.log(`${aiStudentId}: ${reply}`);
      return reply;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
  throw lastError;
}

const emma = (await chat('emma_usa', 'intro', 'How long have you been in Japan?')).toLowerCase();
assert.match(emma, /\bmonth\b/, 'Emma must say she has been in Japan about one month');

const oliverSushi = (await chat('oliver_uk', 'favorites', 'Do you know sushi?')).toLowerCase();
assert.match(oliverSushi, /\bsushi\b/, 'Oliver should respond naturally about sushi');
assert.doesNotMatch(oliverSushi, /what is sushi|i (?:do not|don't) know sushi|no[,!. ]+i (?:do not|don't) know/, 'Oliver must not pretend sushi is unfamiliar');

const oliverFuji = (await chat('oliver_uk', 'shizuoka_culture', 'Do you know Mt. Fuji?')).toLowerCase();
assert.match(oliverFuji, /fuji/, 'Oliver should recognize Mt. Fuji, which is already a persona fact');
assert.doesNotMatch(oliverFuji, /what is (?:mt\.? |mount )?fuji|i (?:do not|don't) know (?:mt\.? |mount )?fuji/, 'Oliver must not pretend Mt. Fuji is unfamiliar');

const minji = (await chat('minji_korea', 'shizuoka_culture', 'I like Hamamatsu gyoza.')).toLowerCase();
assert.ok(minji.includes('?'), 'Minji should invite the child to continue about a local item');
assert.doesNotMatch(minji, /hamamatsu gyoza (?:is|are|has|have|comes|means)/, 'Minji should not lead with an encyclopedia-style explanation');

const yuting = (await chat('yuting_taiwan', 'free', 'I went to our school sports day.')).toLowerCase();
assert.doesNotMatch(yuting, /i (?:also )?went there|i was there|i (?:also )?went to your (?:school|sports day)/, 'Yu-Ting must not invent attending the child school event');

const rahul = (await chat('rahul_bangladesh', 'favorites', 'Do you like tea?')).toLowerCase();
assert.match(rahul, /\btea\b/, 'Rahul should naturally use his established tea-related persona facts');
assert.doesNotMatch(rahul, /i (?:do not|don't) like tea/, 'Rahul must not contradict his established tea-related persona facts');

console.log('PRODUCTION PERSONA ARRIVAL CLAUDE SMOKE PASS');
