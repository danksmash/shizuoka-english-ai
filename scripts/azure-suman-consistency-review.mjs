import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const key = process.env.AZURE_SPEECH_KEY || '';
const region = (process.env.AZURE_SPEECH_REGION || 'japaneast').trim().toLowerCase();
const out = process.env.AZURE_SUMAN_REVIEW_OUTPUT || 'suman-review-artifacts';
if (!key) throw new Error('AZURE_SPEECH_KEY missing');
if (region !== 'japaneast') throw new Error(`Expected japaneast, got ${region}`);

const base = `https://${region}.tts.speech.microsoft.com`;
const voicesUrl = `${base}/cognitiveservices/voices/list`;
const synthUrl = `${base}/cognitiveservices/v1`;
const sentences = [
  'Hello! Nice to meet you.',
  'I like music and soccer.',
  'What do you like?'
];
const fullText = sentences.join(' ');
const usedByOtherPersonas = new Set([
  'en-US-AvaMultilingualNeural','en-GB-OllieMultilingualNeural','en-AU-KenNeural','en-US-EmmaMultilingualNeural',
  'en-GB-AlfieNeural','de-DE-FlorianMultilingualNeural','en-US-JennyMultilingualNeural','en-US-RyanMultilingualNeural',
  'en-US-BrianMultilingualNeural','en-US-EvelynMultilingualNeural','en-GB-AdaMultilingualNeural','en-GB-OliverNeural',
  'en-IN-AashiNeural','zh-CN-XiaoyuMultilingualNeural','en-US-PhoebeMultilingualNeural','en-IN-AaravNeural',
  'en-IN-AnanyaNeural','en-GB-BellaNeural','en-US-DerekMultilingualNeural'
]);

const esc = (s) => String(s).replace(/[<>&'\"]/g, (c) => ({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;' }[c]));
function allowed(v) {
  const name = String(v.ShortName || '');
  const locale = String(v.Locale || '');
  const gender = String(v.Gender || '').toLowerCase();
  const status = String(v.Status || '');
  return locale === 'en-IN' && gender === 'male' && /Neural/i.test(name) && !/(HD|Turbo|Dragon|MAI-Voice|Flash)/i.test(name)
    && (!status || /GA|GenerallyAvailable|general/i.test(status));
}

const listResp = await fetch(voicesUrl, { headers: { 'Ocp-Apim-Subscription-Key': key }, signal: AbortSignal.timeout(15000) });
if (!listResp.ok) throw new Error(`voices/list HTTP ${listResp.status}`);
const voices = await listResp.json();
const available = voices.filter(allowed).map(v => String(v.ShortName)).filter(n => !usedByOtherPersonas.has(n));
const preferred = ['en-IN-KunalNeural','en-IN-RehaanNeural'];
const names = [...preferred, ...available.filter(n => !preferred.includes(n))].filter((n,i,a) => a.indexOf(n) === i).slice(0,4);
if (names.length < 3) throw new Error(`Need at least 3 unused male en-IN candidates, got ${names.length}: ${names.join(', ')}`);

await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(path.join(out, 'audio'), { recursive: true });
const rows = [];
async function synth(voice, id, text) {
  const ssml = `<speak version="1.0" xml:lang="en-IN"><voice name="${esc(voice)}">${esc(text)}</voice></speak>`;
  const r = await fetch(synthUrl, { method:'POST', headers:{'Ocp-Apim-Subscription-Key':key,'Content-Type':'application/ssml+xml','X-Microsoft-OutputFormat':'audio-24khz-48kbitrate-mono-mp3','User-Agent':'shizuoka-english-ai-suman-review'}, body:ssml, signal:AbortSignal.timeout(15000) });
  const bytes = Buffer.from(await r.arrayBuffer());
  if (!r.ok || bytes.length < 500) throw new Error(`${id}: HTTP ${r.status}, ${bytes.length} bytes`);
  const file = `audio/${id}.mp3`;
  await fs.writeFile(path.join(out,file), bytes);
  rows.push({ voice, id, text, file, bytes: bytes.length, sha256:createHash('sha256').update(bytes).digest('hex') });
}
for (const voice of names) {
  const slug = voice.replace(/^en-IN-/,'').replace(/Neural$/,'');
  await synth(voice, `${slug}-full`, fullText);
  for (let i=0;i<sentences.length;i++) await synth(voice, `${slug}-s${i+1}`, sentences[i]);
}
if (new Set(rows.map(r=>r.sha256)).size !== rows.length) throw new Error('Duplicate audio detected');
await fs.writeFile(path.join(out,'manifest.json'), JSON.stringify({ names, sentences, rows }, null, 2));
const blocks = names.map(voice => {
  const slug = voice.replace(/^en-IN-/,'').replace(/Neural$/,'');
  const rs = rows.filter(r=>r.voice===voice);
  return `<section><h2>${voice}</h2>${rs.map(r=>`<div><b>${r.id.endsWith('-full')?'全文':r.id.slice(-2).toUpperCase()}</b><br><audio controls src="${r.file}"></audio></div>`).join('')}</section>`;
}).join('\n');
const html = `<!doctype html><meta charset="utf-8"><title>Suman voice consistency review</title><style>body{font-family:sans-serif;max-width:900px;margin:24px auto;line-height:1.5}section{border:1px solid #ccc;padding:14px;margin:16px 0;border-radius:8px}div{margin:8px 0}</style><h1>Suman 音声一貫性レビュー</h1><p>各Voiceについて、全文と各文単独を比較します。全文の途中で声質が変わらず、各文単独とも同じ人物に聞こえるVoiceを選んでください。</p>${blocks}`;
await fs.writeFile(path.join(out,'index.html'), html);
console.log(JSON.stringify({status:'PASS', voices:names, clips:rows.length}, null, 2));
