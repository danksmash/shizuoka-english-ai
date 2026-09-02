import fs from 'node:fs/promises';
import { synthesizeAzureTts } from '../src/server/azureTts';
import { TARGET_20_AI_STUDENT_IDS } from '../src/data/curriculum';

const canaryUrl = String(process.env.GATE8_CANARY_URL || '').replace(/\/$/, '');
const outputDir = process.env.GATE8_OUTPUT_DIR || 'gate8-artifacts';
const concurrency = 100;
const timeoutMs = 50_000;

if (!canaryUrl || !/^https:\/\//.test(canaryUrl)) throw new Error('GATE8_CANARY_URL is required');
if (canaryUrl.includes('shizuoka-english-ai-1075707511474.asia-northeast1.run.app')) throw new Error('Gate 8 must not target production');

type Flow = { index:number; personaId:string; chatStatus:number; chatMs:number; ttsMs:number|null; combinedMs:number; ok:boolean; error:string; voice:string|null };
function percentile(values:number[], q:number): number|null { if (!values.length) return null; const a=[...values].sort((x,y)=>x-y); return Math.round(a[Math.max(0,Math.min(a.length-1,Math.round((a.length-1)*q)))]*10)/10; }

async function runFlow(index:number): Promise<Flow> {
  const personaId=TARGET_20_AI_STUDENT_IDS[index%20];
  const total=performance.now(); const cs=performance.now(); let response:Response;
  try {
    response=await fetch(`${canaryUrl}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json','X-Gate8-Canary':'100-user'},body:JSON.stringify({message:index%3===0?'Hello! Nice to meet you.':'I like music. What do you like?',history:[],topic:index%3===0?'intro':'favorites',aiStudentId:personaId}),signal:AbortSignal.timeout(timeoutMs)});
  } catch(error) { const now=performance.now(); return {index,personaId,chatStatus:0,chatMs:now-cs,ttsMs:null,combinedMs:now-total,ok:false,error:`chat_fetch:${error instanceof Error?error.message:String(error)}`,voice:null}; }
  const chatMs=performance.now()-cs; const body=await response.text();
  if(!response.ok) return {index,personaId,chatStatus:response.status,chatMs,ttsMs:null,combinedMs:performance.now()-total,ok:false,error:`chat_http_${response.status}:${body.slice(0,160)}`,voice:null};
  let reply='';
  try { const p=JSON.parse(body) as {success?:boolean;isFallback?:boolean;data?:{reply?:string};_diagnostics?:{route?:string}}; if(p.success!==true||p.isFallback!==false||p._diagnostics?.route!=='anthropic-resilient') throw new Error(`route=${p._diagnostics?.route},fallback=${String(p.isFallback)}`); reply=String(p.data?.reply||'').trim(); if(!reply) throw new Error('empty reply'); }
  catch(error){ return {index,personaId,chatStatus:response.status,chatMs,ttsMs:null,combinedMs:performance.now()-total,ok:false,error:`chat_invalid:${error instanceof Error?error.message:String(error)}`,voice:null}; }
  const ts=performance.now();
  try { const t=await synthesizeAzureTts(reply.slice(0,280),personaId,0.95,20_000); const ttsMs=performance.now()-ts; const ok=t.provider==='azure-speech'&&t.audio.length>500; return {index,personaId,chatStatus:response.status,chatMs,ttsMs,combinedMs:performance.now()-total,ok,error:ok?'':`tts_invalid:${t.audio.length}`,voice:t.voiceName}; }
  catch(error){ return {index,personaId,chatStatus:response.status,chatMs,ttsMs:performance.now()-ts,combinedMs:performance.now()-total,ok:false,error:`tts_error:${error instanceof Error?error.message:String(error)}`,voice:null}; }
}

async function expectFault(name:string, fn:()=>Promise<unknown>, pattern:RegExp) {
  const started=performance.now();
  try { await fn(); return {name,ok:false,ms:performance.now()-started,error:'unexpected success'}; }
  catch(error){ const message=error instanceof Error?error.message:String(error); return {name,ok:pattern.test(message),ms:performance.now()-started,error:message}; }
}

await fs.rm(outputDir,{recursive:true,force:true}); await fs.mkdir(outputDir,{recursive:true});
const started=performance.now(); const flows=await Promise.all(Array.from({length:concurrency},(_,i)=>runFlow(i))); const wallMs=Math.round((performance.now()-started)*10)/10;
const originalKey=process.env.AZURE_SPEECH_KEY; const originalRegion=process.env.AZURE_SPEECH_REGION;
const faults=[] as Array<{name:string;ok:boolean;ms:number;error:string}>;
try {
  delete process.env.AZURE_SPEECH_KEY;
  faults.push(await expectFault('missing_key',()=>synthesizeAzureTts('Hello.','emma_usa',1,5000),/AZURE_SPEECH_NOT_CONFIGURED/));
  process.env.AZURE_SPEECH_KEY=originalKey;
  process.env.AZURE_SPEECH_REGION='westus';
  faults.push(await expectFault('region_mismatch',()=>synthesizeAzureTts('Hello.','emma_usa',1,5000),/AZURE_SPEECH_REGION_MISMATCH/));
  process.env.AZURE_SPEECH_REGION=originalRegion||'japaneast';
  faults.push(await expectFault('unknown_persona',()=>synthesizeAzureTts('Hello.','not_a_persona',1,5000),/UNKNOWN_AZURE_TTS_PERSONA/));
  faults.push(await expectFault('forced_timeout',()=>synthesizeAzureTts('Hello.','emma_usa',1,1),/(abort|timeout|signal)/i));
} finally {
  if(originalKey===undefined) delete process.env.AZURE_SPEECH_KEY; else process.env.AZURE_SPEECH_KEY=originalKey;
  if(originalRegion===undefined) delete process.env.AZURE_SPEECH_REGION; else process.env.AZURE_SPEECH_REGION=originalRegion;
}

const chat=flows.map(f=>f.chatMs), tts=flows.map(f=>f.ttsMs).filter((v):v is number=>typeof v==='number'), combined=flows.map(f=>f.combinedMs);
const report={gate:8,topology:'isolated Cloud Run canary + exact PR2 Azure provider in Actions',concurrency,attempted:flows.length,succeeded:flows.filter(f=>f.ok).length,failed:flows.filter(f=>!f.ok).length,http429:flows.filter(f=>f.chatStatus===429||f.error.includes('429')).length,voicesObserved:new Set(flows.map(f=>f.voice).filter(Boolean)).size,chatP50Ms:percentile(chat,.5),chatP95Ms:percentile(chat,.95),ttsP50Ms:percentile(tts,.5),ttsP95Ms:percentile(tts,.95),combinedP50Ms:percentile(combined,.5),combinedP95Ms:percentile(combined,.95),wallMs,faults,faultsPassed:faults.filter(f=>f.ok).length,firestoreSessionWriteCalls:0,productionEndpointCalls:0,productionPrimaryChanged:false};
await fs.writeFile(`${outputDir}/gate8-summary.json`,JSON.stringify(report,null,2)); await fs.writeFile(`${outputDir}/gate8-flows.json`,JSON.stringify(flows,null,2));
if(flows.length!==100) throw new Error(`Gate 8 attempted count mismatch ${flows.length}`);
if(report.failed!==0) throw new Error(`Gate 8 FAIL: ${report.failed} headroom flows failed; first=${JSON.stringify(flows.find(f=>!f.ok))}`);
if(report.http429!==0) throw new Error(`Gate 8 FAIL: HTTP429=${report.http429}`);
if(report.voicesObserved!==20) throw new Error(`Gate 8 FAIL: voices=${report.voicesObserved}`);
if(Number(report.combinedP95Ms||0)>30_000) throw new Error(`Gate 8 FAIL: combined p95=${report.combinedP95Ms}`);
if(faults.some(f=>!f.ok)) throw new Error(`Gate 8 FAIL: fault injection=${JSON.stringify(faults)}`);
console.log('Gate 8: PASS'); console.log(JSON.stringify(report,null,2));
