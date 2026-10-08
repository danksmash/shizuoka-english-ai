import { readFileSync } from 'node:fs';
import { auditDurationCsv } from './audit-research-duration-csv-core';

const path = process.argv[2];
if (!path || process.argv.length !== 3) {
  console.error('Usage: npm run audit:research-duration -- /path/to/sessions.csv');
  process.exitCode = 2;
} else {
  try {
    const result = auditDurationCsv(readFileSync(path, 'utf8'));
    console.log(JSON.stringify(result,null,2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
