import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const reflection = await readFile('src/components/ReflectionScreen.tsx', 'utf8');
const history = await readFile('src/components/LearningHistoryScreen.tsx', 'utf8');

const understood = reflection.indexOf("label: '相手の話を聞いて分かる'");
const conveyed = reflection.indexOf("label: '自分の考えを伝える'");
const culture = reflection.indexOf("label: '新しい言葉や文化に気づいた'");
assert.ok(understood >= 0 && conveyed > understood && culture > conveyed, 'AI reflection item order must be understood → conveyed → culture');

for (const [value, label] of [[4, 'よくできた'], [3, 'できた'], [2, '少しできた'], [1, '次はがんばる']] as const) {
  assert.ok(reflection.includes(`{ value: ${value}, label: '${label}'`), `missing 4-point choice ${value} ${label}`);
}
assert.ok(reflection.includes('grid-cols-4'), 'AI reflection choices must render in four columns');
assert.ok(reflection.includes("scaleVersion: '4point-v1'"), 'new AI reflection submissions must identify the four-point scale');
assert.equal(reflection.includes("{ value: 5, label: 'できた'"), false, 'legacy 5/3/1 choice UI must not return');

assert.ok(history.includes("scaleVersion?: 'legacy-135' | '4point-v1'"), 'learning history must receive reflection scale provenance');
assert.ok(history.includes("row.reflection?.scaleVersion === '4point-v1'"), 'learning history averages must exclude legacy 1/3/5 reflections');
assert.ok(history.includes('value >= 1 && value <= 4'), 'learning history averages must stay on the 1–4 scale');
const historyUnderstood = history.indexOf("['understoodPartner', '相手の話を聞いて分かる']");
const historyConveyed = history.indexOf("['conveyedIdeas', '自分の考えを伝える']");
const historyCulture = history.indexOf("['noticedLanguageCulture', '新しい言葉や文化に気づいた']");
assert.ok(historyUnderstood >= 0 && historyConveyed > historyUnderstood && historyCulture > historyConveyed, 'learning-history reflection order must match the child reflection screen');
assert.ok(history.includes('4件法ふりかえり平均'));

console.log('AI reflection four-point UI QA: PASS');
