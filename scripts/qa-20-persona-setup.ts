import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import sharp from 'sharp';
import { AI_STUDENTS_MASTER_LIST, TARGET_20_AI_STUDENT_IDS } from '../src/data/curriculum';

const setup = fs.readFileSync('src/components/SetupScreen.tsx', 'utf8');
const setupCss = fs.readFileSync('src/setup-screen-v2.css', 'utf8');
const main = fs.readFileSync('src/main.tsx', 'utf8');

assert.ok(setup.includes('会話するAI留学生をえらぼう（全20名）'), 'setup heading must show 20 personas');
assert.ok(setup.includes('TARGET_20_AI_STUDENT_IDS'), 'setup must derive visible personas from research target IDs');
assert.equal(TARGET_20_AI_STUDENT_IDS.length, 20);
for (const id of TARGET_20_AI_STUDENT_IDS) assert.ok(AI_STUDENTS_MASTER_LIST.some((p) => p.id === id), `missing target persona ${id}`);

assert.ok(setup.includes('setup-v2-student-grid'), 'setup must use isolated v2 student grid');
assert.ok(setup.includes('setup-v2-persona-card'), 'setup must use isolated v2 persona cards');
assert.equal(setup.includes('setup-student-card-compact'), false, 'old compact text-only cards must not remain');
assert.ok((setup.match(/<StudentAvatar/g) || []).length >= 2, 'StudentAvatar must be used in both persona cards and selected profile');
assert.ok(setup.includes('student.countryJapanese'), 'left persona cards must show Japanese country names');
assert.ok(setup.includes('student.japaneseName'), 'left persona cards must show Japanese persona names when labels are shown');
assert.ok(setup.includes('aspect-ratio: 4 / 5'), 'placeholder guard');
assert.ok(setupCss.includes('grid-template-columns: repeat(5, minmax(0, 1fr))'), 'desktop persona grid must be 5 columns');
assert.ok(setupCss.includes('grid-template-rows: repeat(4, minmax(0, 1fr))'), 'desktop persona grid must be 4 rows');
assert.ok(setupCss.includes('aspect-ratio: 4 / 5'), 'persona and selected profile portraits must preserve 4:5 ratio');
assert.equal(setupCss.includes('zoom:'), false, 'setup v2 must not depend on CSS zoom');
assert.ok(main.includes("import './setup-screen-v2.css';"), 'setup v2 stylesheet must be loaded');
assert.ok(setup.includes('profileCountryLabel(selectedStudent)'), 'profile must use the non-duplicating country label helper');
assert.ok(setup.includes('`${student.countryJapanese} (${student.country})`'), 'profile country label must be Japanese country plus one English country label');
assert.equal(setup.includes('countryLabel(selectedStudent)'), false, 'old nested country label rendering must not remain');
assert.ok(setup.includes("useState<1 | 2 | 3 | 5>(1)"), 'duration state must remain 1/2/3/5 only');
assert.ok(setup.includes('([1, 2, 3, 5] as const)'), 'duration controls must remain 1/2/3/5');
assert.ok(setup.includes('normalizeLearningCode') && setup.includes('isValidLearningCode') && setup.includes('onValidateLearningCode'), 'learning ID validation logic must remain present');
assert.ok(setup.includes("labelCondition = 'shown'") && setup.includes('const showLabels ='), 'labelCondition research behavior must remain');

const avatarSource = fs.readFileSync('src/data/studentImages.ts', 'utf8');
assert.equal(avatarSource.includes('.b64'), false, 'Base64 avatar assets must not be used');
assert.equal(avatarSource.includes('atob('), false, 'Base64 decoding must not be used');
assert.equal(avatarSource.includes('STUDENT_AVATAR_SPRITE_MAP'), false, 'sprite avatar mapping must not be used');

const targetFiles = [
  'emma_usa.webp', 'oliver_uk.webp', 'liam_australia.webp', 'minji_korea.webp',
  'pavel_belarus.webp', 'lukas_germany.webp', 'aina_malaysia.webp', 'dimas_indonesia.webp',
  'bence_hungary.webp', 'yuting_taiwan.webp', 'zofia_poland.webp', 'matas_lithuania.webp',
  'ananya_india.webp', 'xinyi_china.webp', 'linh_vietnam.webp', 'rahul_bangladesh.webp',
  'nadeesha_srilanka.webp', 'suman_nepal.webp', 'amara_nigeria.webp', 'andrei_romania.webp',
];
const oldTargetImports = [
  '../assets/images/emma_usa.jpg', '../assets/images/oliver_uk.jpg', '../assets/images/liam_aus.jpg',
  '../assets/images/bence_hun.jpg', '../assets/images/zofia_pol.jpg', '../assets/images/rahul_ban.jpg', '../assets/images/linh_vie.jpg',
];
for (const oldPath of oldTargetImports) assert.equal(avatarSource.includes(oldPath), false, `target persona must not use old JPG: ${oldPath}`);

const legacyTargetJpgs = [
  'emma_usa.jpg', 'oliver_uk.jpg', 'liam_aus.jpg', 'bence_hun.jpg',
  'zofia_pol.jpg', 'rahul_ban.jpg', 'linh_vie.jpg',
];
for (const file of legacyTargetJpgs) {
  assert.equal(fs.existsSync(`src/assets/images/${file}`), false, `legacy target JPG must be removed from src/assets/images: ${file}`);
  assert.equal(fs.existsSync(`public/images/${file}`), false, `legacy target JPG must be removed from public/images: ${file}`);
}
for (const file of ['chloe_can.jpg', 'aung_mya.jpg']) {
  assert.ok(fs.existsSync(`src/assets/images/${file}`), `legacy compatibility image must remain in src/assets/images: ${file}`);
  assert.ok(avatarSource.includes(`../assets/images/${file}`), `studentImages.ts must retain legacy compatibility import: ${file}`);
  assert.equal(fs.existsSync(`public/images/${file}`), false, `unused public compatibility duplicate must be removed: ${file}`);
}
assert.equal(fs.existsSync('public/images/shizuoka_exchange_banner.jpg'), false, 'unused public banner must be removed');

const hashes = new Set<string>();
let totalBytes = 0;
for (const file of targetFiles) {
  const p = `src/assets/personas/${file}`;
  assert.ok(fs.existsSync(p), `missing unified persona image: ${file}`);
  assert.ok(avatarSource.includes(`../assets/personas/${file}`), `studentImages.ts must import ${file}`);
  const stat = fs.statSync(p);
  assert.ok(stat.size >= 20_000, `${file} is suspiciously small: ${stat.size} bytes`);
  const meta = await sharp(p).metadata();
  assert.equal(meta.format, 'webp', `${file} must be WebP`);
  assert.equal(meta.width, 1120, `${file} width must be 1120`);
  assert.equal(meta.height, 1400, `${file} height must be 1400`);
  const hash = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  assert.equal(hashes.has(hash), false, `duplicate target image detected: ${file}`);
  hashes.add(hash);
  totalBytes += stat.size;
}
assert.equal(hashes.size, 20, 'all 20 target persona images must be unique');
assert.ok(totalBytes >= 1_000_000 && totalBytes <= 5_000_000, `unexpected total persona size: ${totalBytes}`);
for (const id of TARGET_20_AI_STUDENT_IDS) assert.ok(avatarSource.includes(`${id}:`), `missing avatar mapping for target persona ${id}`);
console.log(`20-person setup v2 + unified WebP QA: PASS (${totalBytes} bytes, 5x4 portraits, no Base64/sprite reconstruction)`);
