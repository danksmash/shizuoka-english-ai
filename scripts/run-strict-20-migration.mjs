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

text = text.replace(
  "  s = removePersonaBlock(s, 'chloe_canada', 'remove retired Canada starter translations');\n  s = removePersonaBlock(s, 'aung_myanmar', 'remove retired Myanmar starter translations');",
  "  for (const id of ['chloe_canada', 'aung_myanmar']) {\n    s = replaceRegexOnce(s, new RegExp(`\\n  ${id}: \\{[\\s\\S]*?\\n  \\},`), '', `remove retired starter translation ${id}`);\n  }",
);
assert.equal(text.includes("removePersonaBlock(s, 'chloe_canada'"), false, 'translation patch failed');

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
