import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { AI_STUDENTS_MASTER_LIST, TARGET_20_AI_STUDENT_IDS } from '../src/data/curriculum';

const setup = fs.readFileSync('src/components/SetupScreen.tsx', 'utf8');
assert.ok(setup.includes('会話するAI留学生をえらぼう（全20名）'), 'setup heading must show 20 personas');
assert.ok(setup.includes('TARGET_20_AI_STUDENT_IDS'), 'setup must derive visible personas from the research target IDs');
assert.ok(setup.includes('setup-student-card-compact'), 'setup must use compact persona cards');
assert.equal(setup.includes('声を聞く'), false, 'compact left cards must not contain the old voice-preview control');
assert.equal(setup.includes('setup-student-avatar h-[72px]'), false, 'compact left cards must not show portraits');
assert.ok(
  setup.includes('student.flag') && setup.includes('student.country') && setup.includes('student.name') && setup.includes('student.age') && setup.includes('student.city'),
  'compact cards must expose flag/country/name/age/hometown',
);

assert.equal(TARGET_20_AI_STUDENT_IDS.length, 20, 'research target must contain exactly 20 personas');
for (const id of TARGET_20_AI_STUDENT_IDS) {
  assert.ok(AI_STUDENTS_MASTER_LIST.some((p) => p.id === id), `missing target persona ${id}`);
}

const avatarSource = fs.readFileSync('src/data/studentImages.ts', 'utf8');
assert.equal(avatarSource.includes('.b64'), false, 'Base64 avatar assets must not be used');
assert.equal(avatarSource.includes('atob('), false, 'Base64 decoding must not be used');
assert.equal(avatarSource.includes('STUDENT_AVATAR_SPRITE_MAP'), false, 'sprite avatar mapping must not be used');

const expectedPersonaFiles = [
  'emma_usa.webp',
  'oliver_uk.webp',
  'liam_australia.webp',
  'minji_korea.webp',
  'pavel_belarus.webp',
  'lukas_germany.webp',
  'aina_malaysia.webp',
  'dimas_indonesia.webp',
  'bence_hungary.webp',
  'yuting_taiwan.webp',
  'zofia_poland.webp',
  'matas_lithuania.webp',
  'ananya_india.webp',
  'xinyi_china.webp',
  'linh_vietnam.webp',
  'rahul_bangladesh.webp',
  'nadeesha_srilanka.webp',
  'suman_nepal.webp',
  'amara_nigeria.webp',
  'andrei_romania.webp',
] as const;

assert.equal(expectedPersonaFiles.length, 20);

for (const file of expectedPersonaFiles) {
  const path = `src/assets/personas/${file}`;
  assert.ok(fs.existsSync(path), `missing unified persona image: ${file}`);
  assert.ok(avatarSource.includes(`../assets/personas/${file}`), `studentImages.ts must import unified persona image: ${file}`);
}

const legacyTargetImports = [
  '../assets/images/emma_usa.jpg',
  '../assets/images/oliver_uk.jpg',
  '../assets/images/liam_aus.jpg',
  '../assets/images/bence_hun.jpg',
  '../assets/images/zofia_pol.jpg',
  '../assets/images/rahul_ban.jpg',
  '../assets/images/linh_vie.jpg',
];
for (const legacyImport of legacyTargetImports) {
  assert.equal(avatarSource.includes(legacyImport), false, `target-20 must not use legacy JPG import: ${legacyImport}`);
}

for (const id of TARGET_20_AI_STUDENT_IDS) {
  assert.ok(avatarSource.includes(`${id}:`), `missing avatar mapping for target persona ${id}`);
}

const hashes = new Set<string>();
let totalBytes = 0;
for (const file of expectedPersonaFiles) {
  const path = `src/assets/personas/${file}`;
  const data = fs.readFileSync(path);
  const metadata = await sharp(data).metadata();

  assert.equal(metadata.format, 'webp', `${file}: must be WebP`);
  assert.equal(metadata.width, 1120, `${file}: width must be 1120`);
  assert.equal(metadata.height, 1400, `${file}: height must be 1400`);
  assert.ok(data.length >= 20_000, `${file}: file is suspiciously small (${data.length} bytes)`);
  assert.ok(data.length <= 500_000, `${file}: file is unexpectedly large (${data.length} bytes)`);

  const hash = createHash('sha256').update(data).digest('hex');
  assert.equal(hashes.has(hash), false, `${file}: duplicate image bytes detected`);
  hashes.add(hash);
  totalBytes += data.length;
}

assert.equal(hashes.size, 20, 'all target-20 persona images must be unique');
assert.ok(totalBytes >= 1_000_000, `target-20 image set is suspiciously small (${totalBytes} bytes)`);
assert.ok(totalBytes <= 4_000_000, `target-20 image set is too large for classroom loading (${totalBytes} bytes)`);

console.log(
  `20-person unified image QA: PASS (20 unique 1120x1400 WebP; ${(totalBytes / 1024 / 1024).toFixed(2)} MiB; no Base64/sprite/legacy target JPG imports)`,
);
