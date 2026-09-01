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

const avatarSource = fs.readFileSync('src/data/studentImages.ts', 'utf8');
assert.equal(avatarSource.includes('.b64'), false, 'Base64 avatar assets must not be used');
assert.equal(avatarSource.includes('atob('), false, 'Base64 decoding must not be used');
assert.equal(avatarSource.includes('STUDENT_AVATAR_SPRITE_MAP'), false, 'sprite avatar mapping must not be used');

const newPersonaFiles = [
  'minji_korea.webp', 'pavel_belarus.webp', 'lukas_germany.webp', 'aina_malaysia.webp',
  'dimas_indonesia.webp', 'yuting_taiwan.webp', 'matas_lithuania.webp', 'ananya_india.webp',
  'xinyi_china.webp', 'nadeesha_srilanka.webp', 'suman_nepal.webp', 'amara_nigeria.webp',
  'andrei_romania.webp',
];
for (const file of newPersonaFiles) {
  assert.ok(fs.existsSync(`src/assets/personas/${file}`), `missing normal persona image: ${file}`);
  assert.ok(avatarSource.includes(file), `studentImages.ts must import ${file}`);
}

for (const id of TARGET_20_AI_STUDENT_IDS) {
  assert.ok(avatarSource.includes(`${id}:`), `missing avatar mapping for target persona ${id}`);
}

console.log('20-person setup + normal image QA: PASS (20 targets, no Base64/sprite reconstruction)');
