import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/utils/contextualAsr.ts';
let source = readFileSync(path, 'utf8');
const before = "    .join('');\n}\n\nfunction levenshtein";
const after = "    .join('')\n    .replace(/(.)\\1+/g, '$1');\n}\n\nfunction levenshtein";
if (!source.includes(before)) throw new Error('Expected phoneticKey join pattern was not found');
source = source.replace(before, after);
writeFileSync(path, source);
console.log('Applied generic cross-token repeated-phoneme normalization.');
