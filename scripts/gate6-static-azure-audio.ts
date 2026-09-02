import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { AI_STUDENTS_MASTER_LIST, TARGET_20_AI_STUDENT_IDS } from '../src/data/curriculum';
import { AZURE_SPEECH_REGION, AZURE_VOICE_PROFILE_VERSION, getAzureVoiceProfile } from '../src/data/azureVoiceProfiles';
import { synthesizeAzureTts } from '../src/server/azureTts';

const outputDir = process.env.GATE6_OUTPUT_DIR || 'gate6-artifacts';
const concurrency = Math.max(1, Math.min(8, Number(process.env.GATE6_CONCURRENCY || 6)));
const timeoutMs = Math.max(3000, Number(process.env.GATE6_TIMEOUT_MS || 15000));
const topicOrder = ['intro', 'favorites', 'shizuoka_culture', 'talents', 'free'] as const;

type ClipTask = {
  personaId: string;
  personaName: string;
  slot: string;
  text: string;
  speakingRate: number;
};

type ClipRecord = ClipTask & {
  relativePath: string;
  voiceName: string;
  synthesisLocale: string;
  provider: string;
  region: string;
  textSha256: string;
  audioSha256: string;
  bytes: number;
};

function sha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

async function runPool<T>(items: T[], worker: (item: T, index: number) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  });
  await Promise.all(workers);
}

if (!process.env.AZURE_SPEECH_KEY?.trim()) throw new Error('AZURE_SPEECH_KEY is not configured');
const region = (process.env.AZURE_SPEECH_REGION || AZURE_SPEECH_REGION).trim().toLowerCase();
if (region !== AZURE_SPEECH_REGION) throw new Error(`Gate 6 requires ${AZURE_SPEECH_REGION}; got ${region}`);

const targetProfiles = TARGET_20_AI_STUDENT_IDS.map((id) => {
  const persona = AI_STUDENTS_MASTER_LIST.find((item) => item.id === id);
  if (!persona) throw new Error(`Missing persona ${id}`);
  const voice = getAzureVoiceProfile(id);
  if (!voice) throw new Error(`Missing Azure Voice Profile v1 entry for ${id}`);
  return { persona, voice };
});
if (targetProfiles.length !== 20) throw new Error(`Expected 20 personas, got ${targetProfiles.length}`);

const tasks: ClipTask[] = [];
for (const { persona } of targetProfiles) {
  const slots: Array<{ slot: string; text: string }> = [
    { slot: 'character-message', text: persona.characterMessage },
    ...topicOrder.map((topic) => ({ slot: `topic-${topic}`, text: persona.topicPrompts[topic] })),
  ];
  if (slots.length !== 6) throw new Error(`Expected 6 fixed clips for ${persona.id}`);
  for (const entry of slots) {
    const text = String(entry.text || '').trim();
    if (!text) throw new Error(`Empty fixed text ${persona.id}/${entry.slot}`);
    tasks.push({
      personaId: persona.id,
      personaName: persona.name,
      slot: entry.slot,
      text,
      speakingRate: persona.voiceRate,
    });
  }
}
if (tasks.length !== 120) throw new Error(`Expected 120 fixed clips, got ${tasks.length}`);

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });
const staticRoot = path.join(outputDir, 'static', 'audio', AZURE_VOICE_PROFILE_VERSION);
const records: ClipRecord[] = [];
const failures: string[] = [];

await runPool(tasks, async (task) => {
  try {
    const result = await synthesizeAzureTts(task.text, task.personaId, task.speakingRate, timeoutMs);
    const profile = getAzureVoiceProfile(task.personaId)!;
    if (result.provider !== 'azure-speech') throw new Error(`Unexpected provider ${result.provider}`);
    if (result.region !== AZURE_SPEECH_REGION) throw new Error(`Unexpected region ${result.region}`);
    if (result.voiceName !== profile.voiceName) throw new Error(`Voice mismatch ${result.voiceName} != ${profile.voiceName}`);
    const rel = path.join('static', 'audio', AZURE_VOICE_PROFILE_VERSION, task.personaId, `${task.slot}.mp3`).replaceAll('\\', '/');
    const full = path.join(outputDir, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, result.audio);
    records.push({
      ...task,
      relativePath: rel,
      voiceName: result.voiceName,
      synthesisLocale: profile.synthesisLocale,
      provider: result.provider,
      region: result.region,
      textSha256: sha256(task.text),
      audioSha256: sha256(result.audio),
      bytes: result.audio.length,
    });
  } catch (error) {
    failures.push(`${task.personaId}/${task.slot}: ${error instanceof Error ? error.message : String(error)}`);
  }
});
if (failures.length) throw new Error(`Gate 6 synthesis failures (${failures.length}):\n${failures.slice(0, 20).join('\n')}`);

records.sort((a, b) => a.personaId.localeCompare(b.personaId) || a.slot.localeCompare(b.slot));
if (records.length !== 120) throw new Error(`Missing records: expected 120, got ${records.length}`);
if (new Set(records.map((r) => r.relativePath)).size !== 120) throw new Error('Duplicate static paths detected');
if (records.some((r) => r.bytes < 500)) throw new Error('One or more MP3 files are too small');

const audioHashGroups = new Map<string, string[]>();
for (const record of records) {
  const list = audioHashGroups.get(record.audioSha256) || [];
  list.push(record.relativePath);
  audioHashGroups.set(record.audioSha256, list);
}
const duplicateAudio = [...audioHashGroups.entries()]
  .filter(([, files]) => files.length > 1)
  .map(([sha256, files]) => ({ sha256, files }));
if (duplicateAudio.length) {
  throw new Error(`Duplicate audio SHA groups detected: ${JSON.stringify(duplicateAudio.slice(0, 5))}`);
}

for (const record of records) {
  const bytes = await fs.readFile(path.join(outputDir, record.relativePath));
  if (sha256(bytes) !== record.audioSha256) throw new Error(`Post-write SHA mismatch: ${record.relativePath}`);
}

const byPersona = Object.fromEntries(TARGET_20_AI_STUDENT_IDS.map((id) => [id, records.filter((r) => r.personaId === id).length]));
if (Object.values(byPersona).some((count) => count !== 6)) throw new Error(`Per-persona clip count mismatch: ${JSON.stringify(byPersona)}`);

const manifest = {
  gate: 6,
  status: 'PASS',
  generatedAt: new Date().toISOString(),
  sourceCommit: process.env.GITHUB_SHA || 'unknown',
  voiceProfileVersion: AZURE_VOICE_PROFILE_VERSION,
  region: AZURE_SPEECH_REGION,
  personaCount: 20,
  clipsPerPersona: 6,
  clipCount: 120,
  missingClipCount: 0,
  duplicateAudioShaGroups: duplicateAudio,
  productionPrimaryChanged: false,
  firestoreWriteCalls: 0,
  staticRoot: `static/audio/${AZURE_VOICE_PROFILE_VERSION}`,
  slots: ['character-message', ...topicOrder.map((topic) => `topic-${topic}`)],
  records,
};

await fs.writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
await fs.writeFile(path.join(outputDir, 'sha256sums.txt'), records.map((r) => `${r.audioSha256}  ${r.relativePath}`).join('\n') + '\n');
await fs.writeFile(path.join(outputDir, 'README.txt'), [
  'Azure Speech Gate 6 static audio package',
  '',
  `Voice profile: ${AZURE_VOICE_PROFILE_VERSION}`,
  `Region: ${AZURE_SPEECH_REGION}`,
  '20 personas x 6 fixed utterances = 120 MP3 files.',
  'Slots: characterMessage + five topic starter prompts.',
  'All files are generated through the exact PR2 Azure provider.',
  'QA: no missing files, deterministic static paths, post-write SHA verification, no duplicate audio SHA groups.',
  'This package does not change the production primary TTS provider and performs no Firestore writes.',
].join('\n'));

console.log(JSON.stringify({
  gate: 6,
  status: 'PASS',
  personaCount: 20,
  clipCount: records.length,
  missingClipCount: 0,
  duplicateAudioShaGroups: duplicateAudio.length,
  minBytes: Math.min(...records.map((r) => r.bytes)),
  maxBytes: Math.max(...records.map((r) => r.bytes)),
  productionPrimaryChanged: false,
  firestoreWriteCalls: 0,
}, null, 2));
