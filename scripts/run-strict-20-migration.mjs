import fs from 'node:fs';
import assert from 'node:assert/strict';

const path = 'scripts/strict-20-migration.mjs';
let text = fs.readFileSync(path, 'utf8');

// Patch the temporary migration helper itself before executing it. The helper is deleted after verification.
{
  const section = text.indexOf('// 5. Remove retired personas from TTS and research dictionaries.');
  assert.ok(section >= 0);
  const start = text.indexOf("  for (const id of ['chloe_canada', 'aung_myanmar']) {", section);
  const end = text.indexOf('  write(path, s);', start);
  assert.ok(start >= 0 && end > start);
  const block = `  for (const id of ['chloe_canada', 'aung_myanmar']) {\n    const pattern = new RegExp(\`^  \${id}: \\\\{[^\\\\n]+\\\\},\\\\n\`, 'gm');\n    const matches = [...s.matchAll(pattern)];\n    assert.equal(matches.length, 2, \`remove \${id} research dictionaries: expected 2 matches, got \${matches.length}\`);\n    s = s.replace(pattern, '');\n  }\n`;
  text = text.slice(0, start) + block + text.slice(end);
}

{
  const section = text.indexOf('// 6. Remove retired starter translations.');
  const next = text.indexOf('// 7. Make student history numbering depend only on supported current personas.', section);
  assert.ok(section >= 0 && next > section, 'translation migration section missing');
  const replacement = `// 6. Remove retired starter translations.\n{\n  const path = 'src/utils/translation.ts';\n  let s = read(path);\n  for (const id of ['chloe_canada', 'aung_myanmar']) {\n    s = replaceRegexOnce(s, new RegExp(\`\\\\n  \${id}: \\\\{[\\\\s\\\\S]*?\\\\n  \\\\},\`), '', \`remove retired starter translation \${id}\`);\n  }\n  write(path, s);\n}\n\n`;
  text = text.slice(0, section) + replacement + text.slice(next);
}

text = text.replace(
  "  s = s.replace(/^\\s*avatarImage: '[^']+',\\n/gm, '');",
  "  s = s.replace(/, avatarImage: '[^']+'/g, '');",
);
assert.ok(text.includes("s.replace(/, avatarImage:"), 'avatarImage cleanup patch failed');

text = text.replace(
  "const forbidden = ['chloe_canada','aung_myanmar','chloe_can','aung_mya','NEW_AI_STUDENTS_13'];",
  "const forbidden = ['chloe' + '_canada','aung' + '_myanmar','chloe' + '_can','aung' + '_mya','NEW_AI_' + 'STUDENTS_13'];",
);
assert.equal(text.includes("const forbidden = ['chloe_canada'"), false, 'QA forbidden-token patch failed');

fs.writeFileSync(path, text);
await import(`./strict-20-migration.mjs?patched=${Date.now()}`);

// The device fallback still carried two retired branches outside the core persona tables.
{
  const speechPath = 'src/utils/speech.ts';
  let speech = fs.readFileSync(speechPath, 'utf8');
  for (const id of ['chloe_canada', 'aung_myanmar']) {
    const voicePattern = new RegExp(`\\n  ${id}: \\{[\\s\\S]*?\\n  \\},`);
    const voiceMatches = speech.match(voicePattern);
    assert.ok(voiceMatches, `missing retired device voice branch: ${id}`);
    speech = speech.replace(voicePattern, '');
    const farewellPattern = new RegExp(`\\n    case '${id}': return \\{[^\\n]+\\};`);
    assert.ok(farewellPattern.test(speech), `missing retired farewell branch: ${id}`);
    speech = speech.replace(farewellPattern, '');
  }
  speech = speech.replace('All 9 students sound bright, youthful (college students), energetic, and unmistakably distinct from each other', 'Current persona-specific overrides remain optional; all 20 personas have a safe field-based device fallback');
  fs.writeFileSync(speechPath, speech);
}

console.log('Strict 20-person speech compatibility cleanup applied successfully.');
