import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);

function replaceOnce(content, search, replacement, label) {
  const index = content.indexOf(search);
  assert.notEqual(index, -1, `missing replacement target: ${label}`);
  assert.equal(content.indexOf(search, index + search.length), -1, `duplicate replacement target: ${label}`);
  return content.slice(0, index) + replacement + content.slice(index + search.length);
}

function replaceRegexOnce(content, regex, replacement, label) {
  const matches = [...content.matchAll(new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g'))];
  assert.equal(matches.length, 1, `${label}: expected 1 match, got ${matches.length}`);
  return content.replace(regex, replacement);
}

function removePersonaBlock(content, id, label) {
  return replaceRegexOnce(
    content,
    new RegExp(`\\n  \\{\\n    id: '${id}',[\\s\\S]*?\\n  \\},`),
    '',
    label,
  );
}

// 1. Collapse the historical 9 + 13 + 2 legacy model into one strict 20-persona model.
{
  const path = 'src/data/curriculum.ts';
  let s = read(path);
  s = removePersonaBlock(s, 'chloe_canada', 'remove retired Canada persona');
  s = removePersonaBlock(s, 'aung_myanmar', 'remove retired Myanmar persona');
  s = replaceOnce(
    s,
    "\n];\n\n\nexport const NEW_AI_STUDENTS_13: AIStudentProfile[] = [\n",
    '\n',
    'merge historical persona arrays',
  );
  s = replaceOnce(
    s,
    'export const AI_STUDENTS_MASTER_LIST: AIStudentProfile[] = [...AI_STUDENTS_LIST, ...NEW_AI_STUDENTS_13];',
    'export const AI_STUDENTS_MASTER_LIST: AIStudentProfile[] = AI_STUDENTS_LIST;',
    'make 20-person list the master list',
  );
  s = replaceRegexOnce(
    s,
    /export function getAIStudentById\(id: string\): AIStudentProfile \{[\s\S]*?\n\}/,
    `export function getAIStudentById(id: string): AIStudentProfile {\n  const exact = AI_STUDENTS_MASTER_LIST.find((student) => student.id === id);\n  if (!exact) throw new Error(\`UNKNOWN_AI_STUDENT_ID:\${id}\`);\n  return exact;\n}`,
    'remove prefix/default persona fallback',
  );
  s = s.replace(/^\s*avatarImage: '[^']+',\n/gm, '');
  write(path, s);
}

// 2. Runtime types accept only the current 20 personas/countries.
{
  const path = 'src/types.ts';
  let s = read(path);
  for (const line of ["  | 'Canada'\n", "  | 'Myanmar'\n", "  | 'chloe_canada'\n", "  | 'aung_myanmar'\n"]) {
    assert.ok(s.includes(line), `types.ts missing ${line.trim()}`);
    s = s.replace(line, '');
  }
  s = replaceOnce(s, '  avatarImage: string;', '  avatarImage?: string;', 'make removed inline avatar path optional');
  write(path, s);
}

// 3. Session/API contract accepts exactly 20 persona IDs.
{
  const path = 'src/dataContract.ts';
  let s = read(path);
  s = s.replace("'emma_usa','oliver_uk','liam_australia','chloe_canada','bence_hungary'", "'emma_usa','oliver_uk','liam_australia','bence_hungary'");
  s = s.replace("'linh_vietnam','aung_myanmar',\n", "'linh_vietnam',\n");
  write(path, s);
}

// 4. One canonical 20-image map; no retired images or old-ID aliases.
write('src/data/studentImages.ts', `import emmaImg from '../assets/personas/emma_usa.webp';\nimport oliverImg from '../assets/personas/oliver_uk.webp';\nimport liamImg from '../assets/personas/liam_australia.webp';\nimport minjiImg from '../assets/personas/minji_korea.webp';\nimport pavelImg from '../assets/personas/pavel_belarus.webp';\nimport lukasImg from '../assets/personas/lukas_germany.webp';\nimport ainaImg from '../assets/personas/aina_malaysia.webp';\nimport dimasImg from '../assets/personas/dimas_indonesia.webp';\nimport benceImg from '../assets/personas/bence_hungary.webp';\nimport yutingImg from '../assets/personas/yuting_taiwan.webp';\nimport zofiaImg from '../assets/personas/zofia_poland.webp';\nimport matasImg from '../assets/personas/matas_lithuania.webp';\nimport ananyaImg from '../assets/personas/ananya_india.webp';\nimport xinyiImg from '../assets/personas/xinyi_china.webp';\nimport linhImg from '../assets/personas/linh_vietnam.webp';\nimport rahulImg from '../assets/personas/rahul_bangladesh.webp';\nimport nadeeshaImg from '../assets/personas/nadeesha_srilanka.webp';\nimport sumanImg from '../assets/personas/suman_nepal.webp';\nimport amaraImg from '../assets/personas/amara_nigeria.webp';\nimport andreiImg from '../assets/personas/andrei_romania.webp';\n\nexport const STUDENT_AVATAR_MAP: Record<string, string> = {\n  emma_usa: emmaImg,\n  oliver_uk: oliverImg,\n  liam_australia: liamImg,\n  minji_korea: minjiImg,\n  pavel_belarus: pavelImg,\n  lukas_germany: lukasImg,\n  aina_malaysia: ainaImg,\n  dimas_indonesia: dimasImg,\n  bence_hungary: benceImg,\n  yuting_taiwan: yutingImg,\n  zofia_poland: zofiaImg,\n  matas_lithuania: matasImg,\n  ananya_india: ananyaImg,\n  xinyi_china: xinyiImg,\n  linh_vietnam: linhImg,\n  rahul_bangladesh: rahulImg,\n  nadeesha_srilanka: nadeeshaImg,\n  suman_nepal: sumanImg,\n  amara_nigeria: amaraImg,\n  andrei_romania: andreiImg,\n};\n`);
for (const path of ['src/assets/images/chloe_can.jpg', 'src/assets/images/aung_mya.jpg']) {
  assert.ok(fs.existsSync(path), `missing retired image expected for cleanup: ${path}`);
  fs.rmSync(path);
}

// 5. Remove retired personas from TTS and research dictionaries.
{
  const path = 'src/data/personaResearch.ts';
  let s = read(path);
  for (const id of ['chloe_canada', 'aung_myanmar']) {
    s = replaceRegexOnce(s, new RegExp(`^  ${id}: \\{[^\\n]+\\},\\n`, 'm'), '', `remove ${id} Google TTS`);
    s = replaceRegexOnce(s, new RegExp(`^  ${id}: \\{[^\\n]+\\},\\n`, 'm'), '', `remove ${id} major dictionary`);
  }
  write(path, s);
}

// 6. Remove retired starter translations.
{
  const path = 'src/utils/translation.ts';
  let s = read(path);
  s = removePersonaBlock(s, 'chloe_canada', 'remove retired Canada starter translations');
  s = removePersonaBlock(s, 'aung_myanmar', 'remove retired Myanmar starter translations');
  write(path, s);
}

// 7. Make student history numbering depend only on supported current personas.
{
  const path = 'src/server/persistence.ts';
  let s = read(path);
  s = replaceOnce(
    s,
    "import { ReflectionAnswers, ResearchSystemEvent, calculateCanonicalStats, maskHistoryForStorage } from '../dataContract';",
    "import { ReflectionAnswers, ResearchSystemEvent, calculateCanonicalStats, isAIStudentId, maskHistoryForStorage } from '../dataContract';",
    'import current persona validator',
  );
  s = replaceOnce(
    s,
    "  const studentSessions = existing ? [] : await queryCollection(SESSION_COLLECTION, 'studentId', args.studentId, 5000);",
    "  const studentSessions = existing ? [] : (await queryCollection(SESSION_COLLECTION, 'studentId', args.studentId, 5000)).filter((session) => isAIStudentId(session.aiStudentId));",
    'current-persona lifetime count',
  );
  s = replaceRegexOnce(
    s,
    /export async function getStudentHistory\(studentId: string\): Promise<Record<string, unknown>\[]> \{[\s\S]*?\n\}\n\nexport async function getAllSessionsForManagement/,
    `export async function getStudentHistory(studentId: string): Promise<Record<string, unknown>[]> {\n  const rows = (await queryCollection(SESSION_COLLECTION, 'studentId', studentId, 5000))\n    .filter(learnerTeacherVisibleSession)\n    .filter((session) => isAIStudentId(session.aiStudentId))\n    .sort((a, b) => String(a.endedAt || '').localeCompare(String(b.endedAt || '')));\n  return rows.map((session, index) => ({\n    sessionId: session.sessionId, aiStudentId: session.aiStudentId, topic: session.topic,\n    targetDurationMinutes: session.targetDurationMinutes, actualDurationSeconds: session.actualDurationSeconds,\n    endedAt: session.endedAt, lifetimeSessionNumber: index + 1, totalTurns: session.totalTurns,\n    totalChildWords: session.totalChildWords, uniqueVocabularyCount: session.uniqueVocabularyCount, reflection: session.reflection || null,\n  }));\n}\n\nexport async function getAllSessionsForManagement`,
    'canonical current-persona history numbering',
  );
  write(path, s);
}

// 8. Persona usage chart always contains all 20 personas, including zero-use personas.
{
  const path = 'src/server/researchDashboard.ts';
  let s = read(path);
  s = replaceOnce(
    s,
    "  const personaNames = new Map(data.personas.map((row) => [String(row.persona_id), String(row.name)]));\n  const personaUsage = counts('persona_id').map((item) => ({ ...item, label: personaNames.get(item.label) || item.label }));",
    "  const personaNames = new Map(data.personas.map((row) => [String(row.persona_id), String(row.name)]));\n  const personaUsageCounts = new Map(counts('persona_id').map((item) => [item.label, item.value]));\n  const personaUsage = RESEARCH_PERSONAS.map((persona) => ({ label: persona.name, value: personaUsageCounts.get(persona.id) || 0 }));",
    '20-row persona usage graph',
  );
  write(path, s);
}

// 9. Strict master QA: every active layer must be the same 20-person set.
write('scripts/qa-persona-master.ts', `import assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport { AI_STUDENTS_LIST, AI_STUDENTS_MASTER_LIST, TARGET_20_AI_STUDENT_IDS } from '../src/data/curriculum';\nimport { AI_STUDENT_IDS } from '../src/dataContract';\nimport { GOOGLE_TTS_VOICES, PERSONA_DICTIONARY_VERSION, PERSONA_PROFILE_DICTIONARY } from '../src/data/personaResearch';\nimport { STARTER_PROMPTS_JAPANESE } from '../src/utils/translation';\n\nconst ids = TARGET_20_AI_STUDENT_IDS;\nconst unique = (items: readonly string[]) => new Set(items).size === items.length;\nconst sorted = (items: readonly string[]) => [...items].sort();\n\nassert.equal(AI_STUDENTS_LIST.length, 20, 'primary persona list must contain exactly 20 personas');\nassert.equal(AI_STUDENTS_MASTER_LIST.length, 20, 'master persona list must contain exactly 20 personas');\nassert.equal(ids.length, 20, 'target persona ID list must contain exactly 20 IDs');\nassert.equal(AI_STUDENT_IDS.length, 20, 'runtime data contract must accept exactly 20 persona IDs');\nassert.ok(unique(AI_STUDENTS_LIST.map((p) => p.id)), 'primary persona IDs must be unique');\nassert.ok(unique(AI_STUDENTS_LIST.map((p) => p.country)), 'primary persona countries must be unique');\nassert.ok(unique(ids), 'target persona IDs must be unique');\nassert.deepEqual(sorted(AI_STUDENTS_LIST.map((p) => p.id)), sorted(ids), 'primary and target persona sets must match');\nassert.deepEqual(sorted(AI_STUDENTS_MASTER_LIST.map((p) => p.id)), sorted(ids), 'master and target persona sets must match');\nassert.deepEqual(sorted(AI_STUDENT_IDS), sorted(ids), 'data contract and target persona sets must match');\nassert.equal(PERSONA_DICTIONARY_VERSION, 'persona-profile-v2');\n\nconst femaleCount = AI_STUDENTS_LIST.filter((p) => p.gender === 'female').length;\nconst maleCount = AI_STUDENTS_LIST.filter((p) => p.gender === 'male').length;\nassert.equal(femaleCount, 10); assert.equal(maleCount, 10);\nconst ageCounts = new Map<number, number>();\nfor (const p of AI_STUDENTS_LIST) ageCounts.set(p.age, (ageCounts.get(p.age) || 0) + 1);\nassert.equal(ageCounts.get(20), 7); assert.equal(ageCounts.get(21), 7); assert.equal(ageCounts.get(22), 6);\n\nconst topics = ['intro','favorites','shizuoka_culture','talents','daily_routine','free'] as const;\nfor (const p of AI_STUDENTS_LIST) {\n  assert.ok(GOOGLE_TTS_VOICES[p.id], \`Missing Google TTS voice for \${p.id}\`);\n  const ja = STARTER_PROMPTS_JAPANESE[p.id];\n  assert.ok(ja, \`Missing Japanese starters for \${p.id}\`);\n  for (const topic of topics) {\n    assert.ok(p.topicPrompts[topic]?.trim(), \`Missing English starter \${p.id}/\${topic}\`);\n    assert.ok(ja[topic]?.trim(), \`Missing Japanese starter \${p.id}/\${topic}\`);\n  }\n  const entries = PERSONA_PROFILE_DICTIONARY.filter((entry) => entry.personaId === p.id);\n  for (const field of ['likes','major','city','landmark'] as const) assert.ok(entries.some((entry) => entry.profileField === field), \`Missing \${field} dictionary entry for \${p.id}\`);\n}\nassert.equal(Object.keys(GOOGLE_TTS_VOICES).length, 20, 'Google TTS map must contain exactly 20 persona keys');\nassert.equal(Object.keys(STARTER_PROMPTS_JAPANESE).length, 20, 'starter translation map must contain exactly 20 persona keys');\n\nconst forbidden = ['chloe_canada','aung_myanmar','chloe_can','aung_mya','NEW_AI_STUDENTS_13'];\nfor (const path of ['src/data/curriculum.ts','src/types.ts','src/dataContract.ts','src/data/studentImages.ts','src/data/personaResearch.ts','src/utils/translation.ts','src/data/azureVoiceProfiles.ts']) {\n  const source = fs.readFileSync(path, 'utf8');\n  for (const token of forbidden) assert.equal(source.includes(token), false, \`retired persona/alias token remains in \${path}: \${token}\`);\n}\n\nconsole.log('Persona master QA: PASS (strict 20-person single active set)');\n`);

// 10. Starter translation QA has no retired-persona exception.
write('scripts/qa-starter-translations.ts', `import { AI_STUDENTS_MASTER_LIST, TARGET_20_AI_STUDENT_IDS } from '../src/data/curriculum';\nimport { GUIDED_TOPIC_STARTERS_JAPANESE, STARTER_PROMPTS_JAPANESE } from '../src/utils/translation';\nimport type { DialogueTopic } from '../src/types';\n\nconst topics: DialogueTopic[] = ['intro', 'favorites', 'shizuoka_culture', 'talents', 'daily_routine', 'free'];\nconst nativeGreetings = ['ミンガラバー', 'スィア', 'チェシチ', 'シンチャオ'];\nconst failures: string[] = [];\nlet checked = 0;\n\nfor (const id of TARGET_20_AI_STUDENT_IDS) {\n  const student = AI_STUDENTS_MASTER_LIST.find((item) => item.id === id);\n  if (!student) { failures.push(\`Missing target persona: \${id}\`); continue; }\n  const translations = STARTER_PROMPTS_JAPANESE[student.id];\n  for (const topic of topics) {\n    checked += 1;\n    const english = student.topicPrompts[topic]?.trim();\n    const japanese = translations?.[topic]?.trim();\n    if (!english) failures.push(\`\${student.id}/\${topic}: English starter is missing\`);\n    if (!japanese) failures.push(\`\${student.id}/\${topic}: Japanese translation is missing\`);\n    if (japanese && topic !== 'intro' && topic !== 'free' && japanese !== GUIDED_TOPIC_STARTERS_JAPANESE[topic]) failures.push(\`\${student.id}/\${topic}: Japanese guided starter mismatch\`);\n    if (japanese && topic !== 'intro' && nativeGreetings.some((greeting) => japanese.includes(greeting))) failures.push(\`\${student.id}/\${topic}: translation adds a greeting not spoken in English\`);\n  }\n}\nif (failures.length) { console.error('STARTER TRANSLATION QA FAILED'); failures.forEach((failure) => console.error(\`- \${failure}\`)); process.exit(1); }\nconsole.log(\`STARTER TRANSLATION QA PASS: \${checked} target English/Japanese pairs checked; strict 20-person map.\`);\n`);

// 11. Remove retired-persona assertions from existing QA and assert clean deletion instead.
{
  const path = 'scripts/qa-azure-voice-profile.ts';
  let s = read(path);
  s = s.replace("\nif (AZURE_VOICE_PROFILES.chloe_canada) fail('Legacy Chloe must not receive an Azure v2 research profile');\nif (AZURE_VOICE_PROFILES.aung_myanmar) fail('Legacy Aung must not receive an Azure v2 research profile');\n", '\n');
  write(path, s);
}
{
  const path = 'scripts/qa-research-export-complete.ts';
  let s = read(path);
  s = s.replace(/\nconst legacy=buildResearchExportDataSets\([^\n]+\);assert\.equal\(legacy\.sessions\.some\(r=>r\.session_id==='legacy'\),false\);/, '');
  s = replaceOnce(
    s,
    "const dashboard=buildResearchDashboardData(raw as any,{});assert.equal(dashboard.researchIndicators.beforeAnnouncementSessions,1);",
    "const dashboard=buildResearchDashboardData(raw as any,{});assert.equal(dashboard.charts.personas.length,20);assert.equal(dashboard.researchIndicators.beforeAnnouncementSessions,1);",
    'research dashboard must expose 20 persona bars',
  );
  write(path, s);
}
{
  const path = 'scripts/qa-20-persona-setup.ts';
  let s = read(path);
  s = replaceRegexOnce(
    s,
    /for \(const file of \['chloe_can\.jpg', 'aung_mya\.jpg'\]\) \{[\s\S]*?\n\}/,
    `for (const file of ['chloe_can.jpg', 'aung_mya.jpg']) {\n  assert.equal(fs.existsSync(\`src/assets/images/\${file}\`), false, \`retired persona image must be removed: \${file}\`);\n}`,
    'retired image QA',
  );
  s = replaceOnce(
    s,
    "for (const id of TARGET_20_AI_STUDENT_IDS) assert.ok(avatarSource.includes(`${id}:`), `missing avatar mapping for target persona ${id}`);",
    "for (const id of TARGET_20_AI_STUDENT_IDS) assert.ok(avatarSource.includes(`${id}:`), `missing avatar mapping for target persona ${id}`);\nfor (const alias of ['liam_aus:','bence_hun:','zofia_pol:','linh_vie:','rahul_ban:','chloe_can:','aung_mya:']) assert.equal(avatarSource.includes(alias), false, `old avatar alias must be removed: ${alias}`);",
    'canonical avatar alias QA',
  );
  s = s.replace('target-20 history, English country labels, no Base64/sprite reconstruction', 'strict-20 history, English country labels, no legacy aliases/Base64/sprite reconstruction');
  write(path, s);
}

// 12. Retired image files are gone; current 20 image files remain untouched.
assert.equal(fs.existsSync('src/assets/images/chloe_can.jpg'), false);
assert.equal(fs.existsSync('src/assets/images/aung_mya.jpg'), false);

// 13. Final source-level invariants before running the repository QA suite.
const activeSourceFiles = [
  'src/data/curriculum.ts','src/types.ts','src/dataContract.ts','src/data/studentImages.ts','src/data/personaResearch.ts',
  'src/utils/translation.ts','src/data/azureVoiceProfiles.ts','src/server/persistence.ts','src/server/researchDashboard.ts',
  'scripts/qa-persona-master.ts','scripts/qa-starter-translations.ts','scripts/qa-azure-voice-profile.ts','scripts/qa-research-export-complete.ts','scripts/qa-20-persona-setup.ts',
];
for (const path of activeSourceFiles) {
  const source = read(path);
  for (const token of ['chloe_canada','aung_myanmar','NEW_AI_STUDENTS_13']) assert.equal(source.includes(token), false, `retired token remains in active source: ${path} -> ${token}`);
}

console.log('Strict 20-person migration applied successfully.');
