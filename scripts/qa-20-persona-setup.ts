import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AI_STUDENTS_MASTER_LIST, TARGET_20_AI_STUDENT_IDS } from '../src/data/curriculum';

const setup = fs.readFileSync('src/components/SetupScreen.tsx', 'utf8');
assert.ok(setup.includes('会話するAI留学生をえらぼう（全20名）'), 'setup heading must show 20 personas');
assert.ok(setup.includes('TARGET_20_AI_STUDENT_IDS'), 'setup must derive visible personas from the research target IDs');
assert.ok(setup.includes('setup-student-card-compact'), 'setup must use compact persona cards');
assert.equal(setup.includes('声を聞く'), false, 'compact left cards must not contain the old voice-preview control');
assert.equal(setup.includes('setup-student-avatar h-[72px]'), false, 'compact left cards must not show portraits');
assert.ok(setup.includes('student.flag') && setup.includes('student.country') && setup.includes('student.name') && setup.includes('student.age') && setup.includes('student.city'), 'compact cards must expose flag/country/name/age/hometown');
assert.equal(TARGET_20_AI_STUDENT_IDS.length, 20);
for (const id of TARGET_20_AI_STUDENT_IDS) assert.ok(AI_STUDENTS_MASTER_LIST.some((p) => p.id === id), `missing target persona ${id}`);
console.log('20-person setup selector QA: PASS');
