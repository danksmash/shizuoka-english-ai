import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AI_STUDENTS_LIST, AI_STUDENTS_MASTER_LIST, TARGET_20_AI_STUDENT_IDS } from '../src/data/curriculum';
import { AI_STUDENT_IDS } from '../src/dataContract';
import { GOOGLE_TTS_VOICES, PERSONA_DICTIONARY_VERSION, PERSONA_PROFILE_DICTIONARY } from '../src/data/personaResearch';
import { STARTER_PROMPTS_JAPANESE } from '../src/utils/translation';

const ids = TARGET_20_AI_STUDENT_IDS;
const unique = (items: readonly string[]) => new Set(items).size === items.length;
const sorted = (items: readonly string[]) => [...items].sort();

assert.equal(AI_STUDENTS_LIST.length, 20, 'primary persona list must contain exactly 20 personas');
assert.equal(AI_STUDENTS_MASTER_LIST.length, 20, 'master persona list must contain exactly 20 personas');
assert.equal(ids.length, 20, 'target persona ID list must contain exactly 20 IDs');
assert.equal(AI_STUDENT_IDS.length, 20, 'runtime data contract must accept exactly 20 persona IDs');
assert.ok(unique(AI_STUDENTS_LIST.map((p) => p.id)), 'primary persona IDs must be unique');
assert.ok(unique(AI_STUDENTS_LIST.map((p) => p.country)), 'primary persona countries must be unique');
assert.ok(unique(ids), 'target persona IDs must be unique');
assert.deepEqual(sorted(AI_STUDENTS_LIST.map((p) => p.id)), sorted(ids), 'primary and target persona sets must match');
assert.deepEqual(sorted(AI_STUDENTS_MASTER_LIST.map((p) => p.id)), sorted(ids), 'master and target persona sets must match');
assert.deepEqual(sorted(AI_STUDENT_IDS), sorted(ids), 'data contract and target persona sets must match');
assert.equal(PERSONA_DICTIONARY_VERSION, 'persona-profile-v2');

const femaleCount = AI_STUDENTS_LIST.filter((p) => p.gender === 'female').length;
const maleCount = AI_STUDENTS_LIST.filter((p) => p.gender === 'male').length;
assert.equal(femaleCount, 10); assert.equal(maleCount, 10);
const ageCounts = new Map<number, number>();
for (const p of AI_STUDENTS_LIST) ageCounts.set(p.age, (ageCounts.get(p.age) || 0) + 1);
assert.equal(ageCounts.get(20), 7); assert.equal(ageCounts.get(21), 7); assert.equal(ageCounts.get(22), 6);

const topics = ['intro','favorites','shizuoka_culture','talents','daily_routine','free'] as const;
for (const p of AI_STUDENTS_LIST) {
  assert.ok(GOOGLE_TTS_VOICES[p.id], `Missing Google TTS voice for ${p.id}`);
  const ja = STARTER_PROMPTS_JAPANESE[p.id];
  assert.ok(ja, `Missing Japanese starters for ${p.id}`);
  for (const topic of topics) {
    assert.ok(p.topicPrompts[topic]?.trim(), `Missing English starter ${p.id}/${topic}`);
    assert.ok(ja[topic]?.trim(), `Missing Japanese starter ${p.id}/${topic}`);
  }
  const entries = PERSONA_PROFILE_DICTIONARY.filter((entry) => entry.personaId === p.id);
  for (const field of ['likes','major','city','landmark'] as const) assert.ok(entries.some((entry) => entry.profileField === field), `Missing ${field} dictionary entry for ${p.id}`);
}
assert.equal(Object.keys(GOOGLE_TTS_VOICES).length, 20, 'Google TTS map must contain exactly 20 persona keys');
assert.equal(Object.keys(STARTER_PROMPTS_JAPANESE).length, 20, 'starter translation map must contain exactly 20 persona keys');

const forbidden = ['chloe' + '_canada','aung' + '_myanmar','chloe' + '_can','aung' + '_mya','NEW_AI_' + 'STUDENTS_13'];
for (const path of ['src/data/curriculum.ts','src/types.ts','src/dataContract.ts','src/data/studentImages.ts','src/data/personaResearch.ts','src/utils/translation.ts','src/data/azureVoiceProfiles.ts']) {
  const source = fs.readFileSync(path, 'utf8');
  for (const token of forbidden) assert.equal(source.includes(token), false, `retired persona/alias token remains in ${path}: ${token}`);
}

console.log('Persona master QA: PASS (strict 20-person single active set)');
