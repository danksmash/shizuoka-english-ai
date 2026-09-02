import fs from 'node:fs/promises';
import path from 'node:path';

const outputDir = process.env.AZURE_GATE4_OUTPUT_DIR || 'azure-gate4-artifacts';
const htmlPath = path.join(outputDir, 'evaluation.html');

let html = await fs.readFile(htmlPath, 'utf8');
html = html
  .replaceAll(' as HTMLInputElement', '')
  .replaceAll(' as HTMLTextAreaElement', '');

if (/\sas\sHTML(?:Input|TextArea)Element/.test(html)) {
  throw new Error('TypeScript-only cast remains in evaluation.html');
}

const script = html.match(/<script>([\s\S]*?)<\/script>/i)?.[1];
if (!script) throw new Error('evaluation.html does not contain an inline script');

// Compile only. DOM APIs are not executed here; this catches browser-JS syntax errors.
new Function(script);

for (const required of ['結果CSVを作成', '5文を連続再生', 'value="RETRY"', 'audio/']) {
  if (!html.includes(required)) throw new Error(`evaluation.html is missing required marker: ${required}`);
}

await fs.writeFile(htmlPath, html);
console.log('Gate 4 evaluation HTML finalization: PASS (browser JavaScript syntax + required controls)');
