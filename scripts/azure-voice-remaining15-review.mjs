import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const key = process.env.AZURE_SPEECH_KEY || '';
const region = (process.env.AZURE_SPEECH_REGION || 'japaneast').trim().toLowerCase();
const out = process.env.AZURE_REMAINING15_OUTPUT || 'azure-remaining15-review';
if (!key) throw new Error('AZURE_SPEECH_KEY missing');
if (region !== 'japaneast') throw new Error(`Expected japaneast, got ${region}`);

const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
const text = "Hello! Nice to meet you. I like music and soccer. What do you like?";

const personas = [
  { id:'minji_korea', name:'Minji', current:'A', A:['en-US-EmmaMultilingualNeural','en-US'], B:['en-US-LolaMultilingualNeural','en-US'] },
  { id:'pavel_belarus', name:'Pavel', current:'B', A:['en-GB-RyanNeural','en-GB'], B:['en-GB-AlfieNeural','en-GB'] },
  { id:'lukas_germany', name:'Lukas', current:'A', A:['de-DE-FlorianMultilingualNeural','en-GB'], B:['en-GB-EthanNeural','en-GB'] },
  { id:'aina_malaysia', name:'Aina', current:'A', A:['en-US-JennyMultilingualNeural','en-US'], B:['en-US-NancyMultilingualNeural','en-US'] },
  { id:'dimas_indonesia', name:'Dimas', current:'B', A:['en-US-AdamMultilingualNeural','en-US'], B:['en-US-RyanMultilingualNeural','en-US'] },
  { id:'bence_hungary', name:'Bence', current:'A', A:['en-US-BrianMultilingualNeural','en-US'], B:['en-US-DavisMultilingualNeural','en-US'] },
  { id:'yuting_taiwan', name:'Yuting', current:'B', A:['en-US-AmandaMultilingualNeural','en-US'], B:['en-US-EvelynMultilingualNeural','en-US'] },
  { id:'zofia_poland', name:'Zofia', current:'A', A:['en-GB-AdaMultilingualNeural','en-GB'], B:['en-GB-AbbiNeural','en-GB'] },
  { id:'matas_lithuania', name:'Matas', current:'B', A:['en-GB-ElliotNeural','en-GB'], B:['en-GB-OliverNeural','en-GB'] },
  { id:'linh_vietnam', name:'Linh', current:'A', A:['en-US-PhoebeMultilingualNeural','en-US'], B:['en-US-SerenaMultilingualNeural','en-US'] },
  { id:'rahul_bangladesh', name:'Rahul', current:'A', A:['en-IN-AaravNeural','en-IN'], B:['en-IN-ArjunNeural','en-IN'] },
  { id:'nadeesha_srilanka', name:'Nadeesha', current:'B', A:['en-IN-KavyaNeural','en-IN'], B:['en-IN-AnanyaNeural','en-IN'] },
  { id:'suman_nepal', name:'Suman', current:'A', A:['en-IN-KunalNeural','en-IN'], B:['en-IN-RehaanNeural','en-IN'] },
  { id:'amara_nigeria', name:'Amara', current:'B', A:['en-NG-EzinneNeural','en-NG'], B:['en-GB-BellaNeural','en-GB'] },
  { id:'andrei_romania', name:'Andrei', current:'B', A:['en-GB-ThomasNeural','en-GB'], B:['en-US-DerekMultilingualNeural','en-US'] },
];

const esc = (s) => s.replace(/[<>&'\"]/g, (c) => ({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;' }[c]));
const ssml = (voice, locale) => `<speak version="1.0" xml:lang="${locale}"><voice name="${voice}">${esc(text)}</voice></speak>`;

await fs.rm(out, { recursive:true, force:true });
await fs.mkdir(path.join(out,'audio'), { recursive:true });
const rows=[];
for (const p of personas) {
  for (const label of ['A','B']) {
    const [voice, locale]=p[label];
    const response=await fetch(endpoint,{method:'POST',headers:{'Ocp-Apim-Subscription-Key':key,'Content-Type':'application/ssml+xml','X-Microsoft-OutputFormat':'audio-24khz-48kbitrate-mono-mp3','User-Agent':'shizuoka-english-ai-remaining15-review'},body:ssml(voice,locale),signal:AbortSignal.timeout(15000)});
    const bytes=Buffer.from(await response.arrayBuffer());
    if(!response.ok) throw new Error(`${p.id}-${label}: HTTP ${response.status}`);
    if(bytes.length<500) throw new Error(`${p.id}-${label}: audio too small`);
    const file=`audio/${p.id}-${label}.mp3`;
    await fs.writeFile(path.join(out,file),bytes);
    rows.push({personaId:p.id,name:p.name,label,current:p.current===label,voice,locale,file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
}
if(rows.length!==30) throw new Error(`Expected 30 clips, got ${rows.length}`);
if(new Set(rows.map(r=>r.sha256)).size!==30) throw new Error('Duplicate audio detected');
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify({text,rows},null,2));

const grouped=personas.map(p=>{
  const items=rows.filter(r=>r.personaId===p.id).map(r=>`<div class="candidate"><h3>${r.label}${r.current?'（現在）':''}</h3><div>${r.voice}</div><audio controls preload="metadata" src="${r.file}"></audio></div>`).join('');
  return `<section><h2>${p.name}</h2><div class="pair">${items}</div></section>`;
}).join('\n');
const html=`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Azure 残り15人 音声比較</title><style>body{font-family:system-ui,-apple-system,sans-serif;max-width:960px;margin:24px auto;padding:0 16px;line-height:1.5}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}.candidate{border:1px solid #ccc;padding:12px;border-radius:8px}audio{width:100%}@media(max-width:700px){.pair{grid-template-columns:1fr}}</style><h1>Azure 残り15人 音声比較</h1><p>全候補は同じ英文・Azure既定速度です。「現在」は現在採用中のVoiceです。自然さ・聞きやすさ・留学生らしさでA/Bを選んでください。</p><p><b>${text}</b></p>${grouped}</html>`;
await fs.writeFile(path.join(out,'index.html'),html);

for(const r of rows){try{await fs.access(path.join(out,r.file));}catch{throw new Error(`Missing referenced audio: ${r.file}`)}}
console.log(JSON.stringify({status:'PASS',personas:personas.length,clips:rows.length,uniqueHashes:new Set(rows.map(r=>r.sha256)).size},null,2));
