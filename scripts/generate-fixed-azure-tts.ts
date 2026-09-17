import fs from 'node:fs/promises';
import path from 'node:path';
import { AI_STUDENT_IDS, DIALOGUE_TOPIC_IDS } from '../src/dataContract';
import { getAIStudentById } from '../src/data/curriculum';
import { getStudentFarewellMessage } from '../src/utils/speech';
import {
  AZURE_TTS_STATIC_VERSION,
  getAzureTtsStaticFilePath,
  synthesizeAzureTts,
} from '../src/server/azureTts';

if (!process.env.AZURE_SPEECH_KEY?.trim()) {
  throw new Error('AZURE_SPEECH_KEY is required to pre-generate fixed Azure TTS assets');
}

const tasks: Array<{ aiStudentId: string; label: string; text: string }> = [];

for (const aiStudentId of AI_STUDENT_IDS) {
  const persona = getAIStudentById(aiStudentId);
  for (const topic of DIALOGUE_TOPIC_IDS) {
    const text = persona.topicPrompts[topic] || persona.starterPromptDefault;
    tasks.push({ aiStudentId, label: `starter:${topic}`, text });
  }
  tasks.push({
    aiStudentId,
    label: 'farewell',
    text: getStudentFarewellMessage(aiStudentId).english,
  });
}

let generated = 0;
let reused = 0;

async function ensureFixedAudio(task: { aiStudentId: string; label: string; text: string }) {
  const outputPath = getAzureTtsStaticFilePath(task.text, task.aiStudentId, 1.0);
  try {
    const existing = await fs.stat(outputPath);
    if (existing.size >= 500) {
      reused += 1;
      return;
    }
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw error;
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const result = await synthesizeAzureTts(task.text, task.aiStudentId, 1.0, 8_000);
  if (result.audio.byteLength < 500) {
    throw new Error(`Generated Azure audio too small: ${task.aiStudentId}/${task.label}`);
  }
  await fs.writeFile(outputPath, result.audio);
  generated += 1;
  console.log(`generated ${task.aiStudentId} ${task.label}`);
}

// Keep concurrency deliberately small to avoid stressing Azure during deploys.
const workerCount = 2;
let cursor = 0;
async function worker() {
  while (cursor < tasks.length) {
    const task = tasks[cursor++];
    await ensureFixedAudio(task);
  }
}

await Promise.all(Array.from({ length: workerCount }, () => worker()));

const staticDir = path.join(process.cwd(), 'runtime-static-tts', AZURE_TTS_STATIC_VERSION);
const files = await fs.readdir(staticDir);
if (files.length < AI_STUDENT_IDS.length) {
  throw new Error(`Fixed Azure TTS generation incomplete: only ${files.length} files found`);
}

console.log(JSON.stringify({
  version: AZURE_TTS_STATIC_VERSION,
  requested: tasks.length,
  uniqueFiles: files.length,
  generated,
  reused,
}));
