import assert from 'node:assert/strict';
import vm from 'node:vm';
import { managementPageHtml } from '../src/server/managementPage';

const html = managementPageHtml();
const match = html.match(/<script>([\s\S]*?)<\/script>/);
if (!match) throw new Error('management script missing');

const elements = new Map<string, any>();
const datasetButtons: any[] = [];
function makeElement(id: string): any {
  const classes = new Set<string>();
  return {
    id, value:'', checked:false, disabled:false, innerHTML:'', textContent:'', style:{}, options:[{value:'all'}], dataset:{}, onclick:null, onchange:null,
    className:'', classList:{ add:(...xs:string[]) => xs.forEach((x) => classes.add(x)), remove:(...xs:string[]) => xs.forEach((x) => classes.delete(x)), contains:(x:string) => classes.has(x) },
    scrollIntoView:() => {}, addEventListener:() => {}, appendChild:() => {}, remove:() => {},
    click(){ if (typeof this.onclick === 'function') return this.onclick(); },
    change(){ if (typeof this.onchange === 'function') return this.onchange(); },
  };
}
function element(id: string) { if (!elements.has(id)) elements.set(id, makeElement(id)); return elements.get(id); }
for (const id of ['grade','classId','personaId','labelCondition','topic']) element(id).value = 'all';
for (const dataset of ['sessions','utterances','expressions','personas','codebook']) {
  const button = makeElement(`dynamic-${dataset}`); button.dataset.exportDataset = dataset; datasetButtons.push(button);
}
const downloaded: any[] = [];
const fetchCalls: string[] = [];
const documentStub: any = {
  getElementById:(id:string) => element(id),
  querySelectorAll:(selector:string) => selector === '[data-export-dataset]' ? datasetButtons : [],
  createElement:(tag:string) => { const item = makeElement(`created-${tag}`); item.click = () => downloaded.push({href:item.href,download:item.download}); return item; },
  body:{appendChild:() => {}},
};
const location: any = { href:'', reload:() => {} };
const sample = {
  success:true,
  metrics:{participantCount:128,totalSessions:384,childUtteranceCount:9842,meanChildWordsPerMinute:18.4,completeRate:98.7,latestAt:'2026-09-03 14:32:00'},
  researchIndicators:{
    announcementConfiguredParticipants:70,beforeAnnouncementSessions:140,afterAnnouncementSessions:180,
    assignedCountryPersonaEligibleSessions:170,assignedCountryPersonaMatchedSessions:68,assignedCountryPersonaSharePercent:40,
    individualUseCount:92,individualUseDays:54,individualUseTotalSeconds:11040,groupLikeUseCount:292,
  },
  filters:{classes:['1','2','3'],grades:['5','6'],personas:['emma_usa','rahul_bangladesh'],labelConditions:['shown','hidden'],topics:['favorites','shizuoka_culture']},
  charts:{
    daily:[
      {date:'2026-09-01',sessions:45,mean_child_words:12.5,mean_child_words_per_minute:17.2,reflection_conveyed:3.1,reflection_understood:3.2,reflection_culture:3.0},
      {date:'2026-09-02',sessions:52,mean_child_words:14.2,mean_child_words_per_minute:19.1,reflection_conveyed:3.4,reflection_understood:3.5,reflection_culture:3.3},
    ],
    personas:[{label:'Emma',value:45},{label:'Rahul',value:30}],aggregation:'daily',
  },
  dataQuality:[{label:'complete',value:379},{label:'missing_reflection',value:5}],
  systemQuality:[{label:'AI応答失敗',value:2},{label:'マイクエラー',value:1},{label:'TTSフォールバック',value:3}],
  topExpressions:[{expression:'I like',count:342,source:'curriculum'},{expression:'surfing',count:187,source:'persona'}],
  recentSessions:[{local_started_at:'2026-09-03 14:31:00',research_id:'R0123',persona_name:'Emma',persona_id:'emma_usa',topic:'好きなもの',target_duration_minutes:3,data_quality_flag:'complete'}],
  exportFiles:[
    {dataset:'sessions',fileName:'sessions.csv',contains:'session data',analysisUse:'longitudinal',rowCount:384},
    {dataset:'utterances',fileName:'utterances.csv',contains:'utterances',analysisUse:'interaction',rowCount:12000},
    {dataset:'expressions',fileName:'expressions.csv',contains:'expressions',analysisUse:'content',rowCount:3000},
    {dataset:'personas',fileName:'personas.csv',contains:'personas',analysisUse:'conditions',rowCount:20},
    {dataset:'codebook',fileName:'codebook.csv',contains:'variables',analysisUse:'reproducibility',rowCount:180},
  ],
};
const urlApi: any = { createObjectURL:() => 'blob:test', revokeObjectURL:() => {} };
const context: any = {
  console, document:documentStub, window:{}, location, alert:() => {}, URL:urlApi, URLSearchParams, Set, Map, Math, Number, String, Array, Object, Date, Blob,
  fetch:async(url:string) => { fetchCalls.push(url); return {ok:true,status:200,json:async() => url.includes('/api/health') ? {appVersion:'1.0.7',build:'test'} : sample,blob:async() => new Blob(['test']),headers:{get:() => null}}; },
  setTimeout:() => 0, clearTimeout:() => {},
};
vm.createContext(context);
vm.runInContext(match[1], context, { filename:'research-dashboard.js' });

context.renderDashboard(sample);
assert.equal(element('mParticipants').textContent, 128);
assert.equal(element('mSessions').textContent, 384);
assert.equal(element('mWordsPerMinute').textContent, '18.4');
assert.equal(element('mCompleteRate').textContent, '98.7%');
assert.equal(element('iBefore').textContent, 140);
assert.equal(element('iAfter').textContent, 180);
assert.equal(element('iCountryShare').textContent, '40%');
assert.ok(element('iCountryDetail').textContent.includes('68'));
assert.equal(element('iIndividual').textContent, 92);
assert.ok(element('iIndividualDetail').textContent.includes('54'));
for (const id of ['chartDaily','chartPersona']) assert.ok(element(id).innerHTML.includes('bar-chart-html'), `${id} must render readable HTML bars`);
for (const id of ['chartWords','chartReflection']) assert.ok(element(id).innerHTML.includes('<svg'), `${id} must render inline SVG`);
assert.ok(element('qualityRows').innerHTML.includes('研究データ品質'));
assert.ok(element('qualityRows').innerHTML.includes('システム品質'));
assert.ok(element('qualityRows').innerHTML.includes('TTSフォールバック'));
assert.ok(element('topExpressions').innerHTML.includes('surfing'));
assert.ok(element('recentRows').innerHTML.includes('R0123'));
assert.ok(element('exportCards').innerHTML.includes('sessions.csv') && element('exportCards').innerHTML.includes('codebook.csv'));

element('start').value='2026-09-01';
element('end').value='2026-09-03';
element('grade').value='5';
element('classId').value='1';
element('personaId').value='emma_usa';
element('labelCondition').value='shown';
element('topic').value='favorites';
element('completeOnly').checked=true;
const params = context.filterParams();
assert.equal(params.get('start'),'2026-09-01');
assert.equal(params.get('end'),'2026-09-03');
assert.equal(params.get('grade'),'5');
assert.equal(params.get('classId'),'1');
assert.equal(params.get('personaId'),'emma_usa');
assert.equal(params.get('labelCondition'),'shown');
assert.equal(params.get('topic'),'favorites');
assert.equal(params.get('completeOnly'),'1');
assert.equal(params.get('circle'), null, 'World Englishes circle must not remain a formal research filter');
const dashboardUrl = context.queryUrl('/api/management/research.dashboard');
assert.ok(dashboardUrl.includes('personaId=emma_usa') && dashboardUrl.includes('completeOnly=1'));
context.renderDashboard(sample, params.toString());
assert.ok(context.appliedQueryUrl('/api/management/research.csv','sessions').includes('personaId=emma_usa'));

await context.downloadDataset('sessions');
assert.ok(fetchCalls.some((url) => url.startsWith('/api/management/research.csv?') && url.includes('dataset=sessions') && url.includes('classId=1')));
assert.equal(location.href,'');
assert.ok(downloaded.some((item) => item.download === 'sessions.csv'));
await element('bundleBtn').onclick();
assert.ok(fetchCalls.some((url) => url.startsWith('/api/management/research.bundle.zip') && url.includes('personaId=emma_usa')));
assert.ok(downloaded.some((item) => item.download === 'research-bundle.zip'));

const savedFetch = context.fetch;
context.fetch = async() => ({ok:false,status:503,json:async() => ({error:'RESEARCH_EXPORT_UNAVAILABLE'})});
await context.downloadDataset('sessions');
assert.ok(element('exportStatus').textContent.includes('RESEARCH_EXPORT_UNAVAILABLE'));
assert.ok(element('exportStatus').className.includes('error'));
context.fetch = savedFetch;

context.resetFilters();
assert.equal(element('start').value,'');
assert.equal(element('end').value,'');
assert.equal(element('classId').value,'all');
assert.equal(element('completeOnly').checked,false);

const pageSource = html;
assert.equal(pageSource.includes('Inner / Outer / Expanding'), false);
assert.equal(pageSource.includes('id="circle"'), false);
assert.ok(pageSource.includes('告知前／告知後セッション'));
assert.ok(pageSource.includes('担当国Persona選択率'));
assert.ok(pageSource.includes('個別利用らしいセッション'));
assert.ok(pageSource.includes('主研究データとAI/TTSのシステム品質は分離'));
for (const id of ['filterBtn','resetBtn','refreshBtn','bundleBtn','logoutBtn']) assert.ok(pageSource.includes(`id="${id}"`), `button missing ${id}`);
assert.ok(pageSource.includes("$('filterBtn').onclick=loadDashboard"));
assert.ok(pageSource.includes("$('refreshBtn').onclick=loadDashboard"));
assert.ok(pageSource.includes('onchange=scheduleDashboardReload'));
assert.ok(pageSource.includes('appliedQueryUrl'));
assert.ok(pageSource.includes('flex-wrap:wrap'));
assert.ok(pageSource.includes('.charts{display:grid;grid-template-columns:repeat(2'));
assert.ok(pageSource.includes('.svg-label{font-size:15px'));
assert.ok(pageSource.includes('.bar-label-html{font-size:16px'));
assert.ok(pageSource.includes('.chart svg{min-width:460px'));
assert.ok(pageSource.includes('1分あたり平均発話語数'));
assert.ok(pageSource.includes('５年') && pageSource.includes('６年') && pageSource.includes('１組') && pageSource.includes('２組') && pageSource.includes('３組'));
assert.equal(pageSource.includes('博士'), false);
assert.ok(pageSource.includes('#chartPersona{height:820px;overflow-y:visible}'));
assert.ok(pageSource.includes('const labelYs=rows.map(function(){return []})'));

const twentyPersonas = Array.from({length:20},(_,i) => ({label:`Persona ${i+1}`,value:20-i}));
const twentyPersonaHtml = context.barSvg(twentyPersonas,'value',20);
assert.equal((twentyPersonaHtml.match(/bar-row-html/g) || []).length,20);
const collisionSvg = context.lineSvg([{date:'2026-08-30',a:4.5,b:4.5,c:4.5}],[{key:'a',label:'A'},{key:'b',label:'B'},{key:'c',label:'C'}]);
const ys = Array.from(collisionSvg.matchAll(/<text x="[^"]+" y="([^"]+)" text-anchor="middle" class="svg-value"/g)).map((item:any) => Number(item[1]));
assert.equal(ys.length,3);
assert.ok(Math.min(...ys.map((y:number,i:number) => Math.min(...ys.filter((_:number,j:number) => j !== i).map((z:number) => Math.abs(y-z))))) >= 22);
const styledSvg = context.lineSvg([{date:'2026-08-30',a:4.5,b:4.5,c:3.5}],[{key:'a',label:'伝える'},{key:'b',label:'分かる'},{key:'c',label:'気づき'}]);
assert.equal(styledSvg.includes('stroke-dasharray='),false);
assert.equal(styledSvg.includes('<rect '),false);
assert.ok(styledSvg.includes('style=\"fill:#111827\"'));
for (const color of ['#2774ee','#20a567','#f59e0b']) assert.ok(styledSvg.includes(`stroke=\"${color}\"`));
for (const id of ['start','end','grade','classId','personaId','labelCondition','topic','completeOnly']) assert.equal(typeof element(id).onchange,'function',`${id} must auto-refresh`);

console.log('Research dashboard graph/button/filter linkage QA: PASS');
