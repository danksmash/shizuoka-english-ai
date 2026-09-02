import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const key = process.env.AZURE_SPEECH_KEY || '';
const region = (process.env.AZURE_SPEECH_REGION || 'japaneast').trim().toLowerCase();
const out = process.env.AZURE_VOICE_REFINE_OUTPUT || 'voice-refine-artifacts';
if (!key) throw new Error('AZURE_SPEECH_KEY missing');
if (region !== 'japaneast') throw new Error(`Expected japaneast, got ${region}`);

const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
const text = "Hello! Nice to meet you. I like music and soccer. What do you like?";

const cases = [
  { id: 'emma-Ava-default', persona: 'Emma', voice: 'en-US-AvaMultilingualNeural', locale: 'en-US', mode: 'default' },
  { id: 'emma-Ava-plus5', persona: 'Emma', voice: 'en-US-AvaMultilingualNeural', locale: 'en-US', mode: 'rate', rate: '+5%' },
  { id: 'emma-Cora-default', persona: 'Emma', voice: 'en-US-CoraMultilingualNeural', locale: 'en-US', mode: 'default' },
  { id: 'emma-Cora-plus5', persona: 'Emma', voice: 'en-US-CoraMultilingualNeural', locale: 'en-US', mode: 'rate', rate: '+5%' },
  { id: 'oliver-Ollie-default', persona: 'Oliver', voice: 'en-GB-OllieMultilingualNeural', locale: 'en-GB', mode: 'default' },
  { id: 'oliver-Ollie-plus5', persona: 'Oliver', voice: 'en-GB-OllieMultilingualNeural', locale: 'en-GB', mode: 'rate', rate: '+5%' },
  { id: 'oliver-Noah-default', persona: 'Oliver', voice: 'en-GB-NoahNeural', locale: 'en-GB', mode: 'default' },
  { id: 'liam-Ken-default', persona: 'Liam', voice: 'en-AU-KenNeural', locale: 'en-AU', mode: 'default' },
  { id: 'liam-Ken-gap150', persona: 'Liam', voice: 'en-AU-KenNeural', locale: 'en-AU', mode: 'gap', gap: '150ms' },
  { id: 'liam-Ken-gap250', persona: 'Liam', voice: 'en-AU-KenNeural', locale: 'en-AU', mode: 'gap', gap: '250ms' },
  { id: 'ananya-reference', persona: 'Ananya', voice: 'en-IN-AashiNeural', locale: 'en-IN', mode: 'default' },
  { id: 'xinyi-reference', persona: 'Xinyi', voice: 'zh-CN-XiaoyuMultilingualNeural', locale: 'en-US', mode: 'default' },
];

const esc = (s) => s.replace(/[<>&'\"]/g, (c) => ({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;' }[c]));
function ssml(c) {
  const ns = c.mode === 'gap' ? ' xmlns:mstts="http://www.w3.org/2001/mstts"' : '';
  let body = esc(text);
  if (c.mode === 'rate') body = `<prosody rate="${c.rate}">${body}</prosody>`;
  if (c.mode === 'gap') body = `<mstts:silence type="Sentenceboundary-exact" value="${c.gap}"/>${body}`;
  return `<speak version="1.0"${ns} xml:lang="${c.locale}"><voice name="${c.voice}">${body}</voice></speak>`;
}

await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(path.join(out, 'audio'), { recursive: true });
const rows = [];
for (const c of cases) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'shizuoka-english-ai-voice-refine-review',
    },
    body: ssml(c),
    signal: AbortSignal.timeout(15000),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!response.ok) throw new Error(`${c.id}: HTTP ${response.status}`);
  if (bytes.length < 500) throw new Error(`${c.id}: audio too small`);
  const file = `audio/${c.id}.mp3`;
  await fs.writeFile(path.join(out, file), bytes);
  rows.push({ ...c, file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
if (new Set(rows.map((r) => r.sha256)).size !== rows.length) throw new Error('Duplicate audio detected');
await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify({ text, rows }, null, 2));

const grouped = ['Emma','Oliver','Liam','Ananya','Xinyi'].map((name) => {
  const items = rows.filter((r) => r.persona === name).map((r) => `<div style="margin:10px 0;padding:10px;border:1px solid #ccc"><b>${r.id}</b><br><small>${r.voice} / ${r.mode}${r.rate ? ` ${r.rate}` : ''}${r.gap ? ` ${r.gap}` : ''}</small><br><audio controls src="${r.file}"></audio></div>`).join('');
  return `<h2>${name}</h2>${items}`;
}).join('\n');
const html = `<!doctype html><meta charset="utf-8"><title>Azure voice refinement review</title><style>body{font-family:sans-serif;max-width:900px;margin:24px auto;line-height:1.5}</style><h1>Azure voice refinement review</h1><p>同じ英文で比較します。Ananya / Xinyi は良好基準です。</p><p>${text}</p>${grouped}`;
await fs.writeFile(path.join(out, 'index.html'), html);
console.log(JSON.stringify({ status: 'PASS', cases: rows.length, bytesMin: Math.min(...rows.map(r=>r.bytes)), bytesMax: Math.max(...rows.map(r=>r.bytes)) }, null, 2));
