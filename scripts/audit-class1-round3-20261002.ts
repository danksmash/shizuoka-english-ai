import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'shizuoka-eigo-ai';
const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || '(default)';
const COLLECTION = 'sessions';
const TARGET_DATE = '2026-10-02';

function token(): string {
  const env = String(process.env.GOOGLE_OAUTH_ACCESS_TOKEN || '').trim();
  if (env) return env;
  return execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
}
function fromValue(v:any):any {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue?.values || []).map(fromValue);
  if ('mapValue' in v) return fromFields(v.mapValue?.fields || {});
  return null;
}
function fromFields(fields:Record<string,any>):Record<string,any> {
  return Object.fromEntries(Object.entries(fields || {}).map(([k,v]) => [k, fromValue(v)]));
}
async function listSessions() {
  const out:any[] = []; let pageToken=''; const accessToken=token();
  const base=`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/${encodeURIComponent(DATABASE_ID)}/documents/${COLLECTION}`;
  do {
    const url=pageToken?`${base}?pageSize=1000&pageToken=${encodeURIComponent(pageToken)}`:`${base}?pageSize=1000`;
    const r=await fetch(url,{headers:{Authorization:`Bearer ${accessToken}`}});
    if(!r.ok) throw new Error(`FIRESTORE_LIST_${r.status}:${(await r.text()).slice(0,500)}`);
    const data:any=await r.json();
    for(const doc of data.documents||[]) out.push({...fromFields(doc.fields||{}),_name:doc.name||''});
    pageToken=typeof data.nextPageToken==='string'?data.nextPageToken:'';
  } while(pageToken);
  return out;
}
const STOP = new Set('a an the i you he she it we they me my your his her our their is am are was were be been being do does did can could will would should have has had to of in on at for from with and or but so yes no very really this that these those what where when who why how'.split(' '));
function words(text:unknown):string[]{return String(text||'').toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g)||[];}
function cleanOutput(text:unknown):string {
  let s=String(text||'').replace(/\s+/g,' ').trim();
  s=s.replace(/\b(my name is|call me)\s+[A-Za-z][A-Za-z'-]{1,20}\b/ig,'$1 [name omitted]');
  s=s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig,'[email omitted]');
  s=s.replace(/\b(?:\+?\d[\d -]{7,}\d)\b/g,'[number omitted]');
  return s.slice(0,220);
}
function anon(s:unknown):string {return crypto.createHash('sha256').update(String(s||'')).digest('hex').slice(0,8);}
function isoMs(v:any):number {const n=Date.parse(String(v||'')); return Number.isFinite(n)?n:NaN;}
function localDate(s:any):string {return String(s.localDate||s.local_date||'').slice(0,10);}
function classId(s:any):string{return String(s.classId||s.class_id||'').trim();}
function history(s:any):any[]{return Array.isArray(s.history)?s.history:[];}
function english(m:any):string{return String(m?.englishText||m?.text||'').trim();}
function sender(m:any):string{return String(m?.sender||m?.role||'').toLowerCase();}
function durationMinutes(s:any):number {
  const start=isoMs(s.startedAt||s.startTime||s.createdAt), end=isoMs(s.endedAt||s.endTime||s.updatedAt);
  if(Number.isFinite(start)&&Number.isFinite(end)&&end>start) return (end-start)/60000;
  const target=Number(s.targetDurationMinutes||s.durationMinutes||0); return target>0?target:0;
}
function median(xs:number[]):number {if(!xs.length)return 0; const a=[...xs].sort((x,y)=>x-y),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
function round(n:number,d=2){const p=10**d;return Math.round(n*p)/p;}
function isQuestion(t:string):boolean {const x=t.trim().toLowerCase();return /\?$/.test(x)||/^(what|where|when|who|why|how|do|does|did|can|could|will|would|are|is|am|have|has)\b/.test(x);}
function norm(t:string){return words(t).join(' ');}
function contentSet(t:string){return new Set(words(t).filter(w=>w.length>2&&!STOP.has(w)));}
function overlap(a:Set<string>,b:Set<string>){let n=0;for(const x of a)if(b.has(x))n++;return n;}
function sessionRow(s:any){
  const h=history(s); const child=h.filter(m=>['child','user','student'].includes(sender(m))); const ai=h.filter(m=>['ai','assistant'].includes(sender(m)));
  const childTexts=child.map(english).filter(Boolean); const aiTexts=ai.map(english).filter(Boolean);
  const wc=childTexts.reduce((n,t)=>n+words(t).length,0); const dur=durationMinutes(s); const uniq=new Set(childTexts.flatMap(words));
  const questions=childTexts.filter(isQuestion).length; const repairs=childTexts.filter(t=>/\b(pardon|sorry|again|repeat|what)\b/i.test(t)).length;
  const nameTurns=childTexts.filter(t=>/\b(my name is|call me|name)\b/i.test(t)).length;
  const repeats=Math.max(0,childTexts.length-new Set(childTexts.map(norm)).size);
  let uptake=0, uptakeOpp=0;
  for(let i=1;i<h.length;i++){
    if(!['child','user','student'].includes(sender(h[i])))continue;
    let j=i-1; while(j>=0&&!['ai','assistant'].includes(sender(h[j])))j--;
    if(j<0)continue; const aiSet=contentSet(english(h[j])); if(!aiSet.size)continue; uptakeOpp++;
    const chSet=contentSet(english(h[i])); if(overlap(aiSet,chSet)>0) uptake++;
  }
  return {
    date:localDate(s), class_id:classId(s), participant:anon(s.researchId||s.studentId), session:anon(s.sessionId||s._name),
    persona:String(s.aiStudentId||s.personaId||s.aiStudent?.id||''), topic:String(s.topic||s.dialogueTopic||''),
    duration_min:round(dur), child_turns:childTexts.length, ai_turns:aiTexts.length, child_words:wc,
    words_per_min:dur>0?round(wc/dur):0, turns_per_min:dur>0?round(childTexts.length/dur):0,
    unique_words:uniq.size, ttr:wc?round(uniq.size/wc,3):0, child_questions:questions, repair_turns:repairs, name_turns:nameTurns,
    exact_repeat_turns:repeats, uptake_turns:uptake, uptake_opportunities:uptakeOpp, uptake_rate:uptakeOpp?round(uptake/uptakeOpp,3):0,
    native_stats:s.stats||s.statistics||null,
    started_at:String(s.startedAt||''), ended_at:String(s.endedAt||''),
    child_texts:childTexts.map(cleanOutput)
  };
}
function aggregate(rows:any[]){
  const n=rows.length, participants=new Set(rows.map(r=>r.participant)); const sum=(k:string)=>rows.reduce((a,r)=>a+Number(r[k]||0),0);
  const wpm=rows.map(r=>r.words_per_min).filter((x:number)=>x>0), tpm=rows.map(r=>r.turns_per_min).filter((x:number)=>x>0);
  const allTexts=rows.flatMap(r=>r.child_texts); const allWords=allTexts.flatMap(words); const vocab=new Set(allWords);
  const exprs:Record<string,number>={};
  const patterns:Record<string,RegExp>={
    'i_like':/\bi like\b/i,'i_can':/\bi can\b/i,'i_am':/\b(i am|i'm)\b/i,'my_name_is':/\bmy name is\b/i,
    'do_you':/\bdo you\b/i,'can_you':/\bcan you\b/i,'what':/\bwhat\b/i,'where':/\bwhere\b/i,'how':/\bhow\b/i,
    'because':/\bbecause\b/i,'and':/\band\b/i,'but':/\bbut\b/i,'want_to':/\bwant to\b/i,'have_you':/\bhave you\b/i
  };
  for(const [k,re] of Object.entries(patterns)) exprs[k]=allTexts.filter(t=>re.test(t)).length;
  const persona:Record<string,number>={}, topic:Record<string,number>={}; for(const r of rows){persona[r.persona||'(blank)']=(persona[r.persona||'(blank)']||0)+1;topic[r.topic||'(blank)']=(topic[r.topic||'(blank)']||0)+1;}
  const freq=new Map<string,number>(); for(const w of allWords.filter(w=>!STOP.has(w)&&w.length>1))freq.set(w,(freq.get(w)||0)+1);
  const top_words=[...freq.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,25);
  return {sessions:n,participants:participants.size,total_child_turns:sum('child_turns'),total_child_words:sum('child_words'),mean_words_per_session:n?round(sum('child_words')/n):0,mean_turns_per_session:n?round(sum('child_turns')/n):0,mean_wpm:n?round(sum('words_per_min')/n):0,median_wpm:round(median(wpm)),mean_turns_per_min:n?round(sum('turns_per_min')/n):0,median_turns_per_min:round(median(tpm)),question_turns:sum('child_questions'),repair_turns:sum('repair_turns'),name_turns:sum('name_turns'),exact_repeat_turns:sum('exact_repeat_turns'),uptake_turns:sum('uptake_turns'),uptake_opportunities:sum('uptake_opportunities'),uptake_rate:sum('uptake_opportunities')?round(sum('uptake_turns')/sum('uptake_opportunities'),3):0,unique_word_types:vocab.size,expressions:exprs,persona_counts:persona,topic_counts:topic,top_content_words:top_words};
}
function examples(rows:any[]){
  const all=rows.flatMap(r=>r.child_texts.map((text:string,i:number)=>({p:r.participant,text,index:i,words:words(text).length,q:isQuestion(text)})));
  const long=[...all].filter(x=>x.words>=7).sort((a,b)=>b.words-a.words).slice(0,12);
  const qs=all.filter(x=>x.q).slice(0,20);
  const repairs=all.filter(x=>/\b(pardon|sorry|again|repeat|what)\b/i.test(x.text)).slice(0,12);
  return {long_utterances:long,student_questions:qs,repair_examples:repairs};
}

const sessions=await listSessions();
const dateCounts:Record<string,Record<string,number>>={};
for(const s of sessions){const c=classId(s),d=localDate(s);if(!['1','3'].includes(c)||!d)continue;(dateCounts[c]??={})[d]=((dateCounts[c]||{})[d]||0)+1;}
const allRows=sessions.filter(s=>['1','3'].includes(classId(s))).map(sessionRow);
const class1Dates=Object.entries(dateCounts['1']||{}).sort((a,b)=>a[0].localeCompare(b[0]));
const class3Dates=Object.entries(dateCounts['3']||{}).sort((a,b)=>a[0].localeCompare(b[0]));
const rounds:any={};
for(const c of ['1','3']){
  const dates=Object.keys(dateCounts[c]||{}).sort(); rounds[c]={};
  dates.forEach((d,idx)=>{const rows=allRows.filter(r=>r.class_id===c&&r.date===d);rounds[c][`round_${idx+1}_${d}`]={aggregate:aggregate(rows),per_session:rows};});
}
const targetRows=allRows.filter(r=>r.class_id==='1'&&r.date===TARGET_DATE);
const report={generated_at:new Date().toISOString(),mode:'READ_ONLY',writes_performed:0,project:PROJECT_ID,session_count_all:sessions.length,date_counts:{class1:class1Dates,class3:class3Dates},rounds,target_date:TARGET_DATE,target_class1:{aggregate:aggregate(targetRows),examples:examples(targetRows),per_session:targetRows}};
console.log('CLASS1_ROUND3_AUDIT_BEGIN');
console.log(JSON.stringify(report,null,2));
console.log('CLASS1_ROUND3_AUDIT_END');
