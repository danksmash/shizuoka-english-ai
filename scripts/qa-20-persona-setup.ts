import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import sharp from 'sharp';
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
const avatarComponent = fs.readFileSync('src/components/StudentAvatar.tsx', 'utf8');
assert.ok(avatarSource.includes('personas20_final_01.b64.txt') && avatarSource.includes('personas20_final_06.b64.txt'), 'verified six-part 20-person WebP source must be used');
assert.ok(avatarSource.includes('decodeBase64Part') && avatarSource.includes('new Blob'), 'sprite chunks must be decoded before binary reconstruction');
assert.ok(avatarSource.includes('STUDENT_AVATAR_SPRITE_MAP'), '20-person portrait sprite map is required');
assert.ok(avatarSource.includes('tileWidth: 80') && avatarSource.includes('tileHeight: 100'), '400x400 sprite must use 80x100 portrait cells');
assert.ok(avatarComponent.includes('STUDENT_AVATAR_SPRITE_MAP'), 'StudentAvatar must render the portrait sprite');
assert.ok(avatarComponent.includes('<svg') && avatarComponent.includes('viewBox='), 'sprite portraits must be cropped with an SVG viewBox');

const targetPlacements = new Set<string>();
for (const id of TARGET_20_AI_STUDENT_IDS) {
  const match = avatarSource.match(new RegExp(`\\b${id}: sprite\\((\\d+), (\\d+)\\)`));
  assert.ok(match, `missing approved portrait mapping for ${id}`);
  targetPlacements.add(`${match[1]},${match[2]}`);
}
assert.equal(targetPlacements.size, 20, 'all 20 target personas must have unique portrait cells');

const spriteBytes = Buffer.concat([1, 2, 3, 4, 5, 6].map((part) => {
  const encoded = fs.readFileSync(`src/assets/images/personas20_final_0${part}.b64.txt`, 'utf8').trim();
  return Buffer.from(encoded, 'base64');
}));
assert.equal(spriteBytes.length, 34_279, 'approved portrait sprite byte length must remain stable');
assert.equal(spriteBytes.subarray(0, 4).toString('ascii'), 'RIFF', 'portrait sprite must be a WebP RIFF file');
assert.equal(spriteBytes.subarray(8, 12).toString('ascii'), 'WEBP', 'portrait sprite must be WebP');
assert.equal(
  createHash('sha256').update(spriteBytes).digest('hex'),
  '4908b156eac50a2285042b6f52fff21f8486535db1bc50d090a264deefcc7a57',
  'portrait sprite checksum must match the approved 20-person sheet',
);
const spriteMetadata = await sharp(spriteBytes).metadata();
assert.equal(spriteMetadata.width, 400, 'portrait sprite width must be 400px');
assert.equal(spriteMetadata.height, 400, 'portrait sprite height must be 400px');
assert.equal(spriteMetadata.format, 'webp', 'portrait sprite metadata must report WebP');

console.log('20-person setup selector + portrait QA: PASS (20/20 unique portraits, verified 400x400 WebP)');
