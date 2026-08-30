import assert from 'node:assert/strict';
import vm from 'node:vm';
import { managementPageHtml } from '../src/server/managementPage';

const html=managementPageHtml();
const match=html.match(/<script>([\s\S]*?)<\/script>/);
if(!match)throw new Error('management script missing');

const elements=new Map<string,any>();
const datasetButtons:any[]=[];
function makeElement(id:string):any{
  const classes=new Set<string>();
  return {id,value:'',checked:false,disabled:false,innerHTML:'',textContent:'',style:{},options:[{value:'all'}],dataset:{},onclick:null,onchange:null,
    className:'',classList:{add:(...xs:string[])=>xs.forEach(x=>classes.add(x)),remove:(...xs:string[])=>xs.forEach(x=>classes.delete(x)),contains:(x:string)=>classes.has(x)},
    scrollIntoView:()=>{},addEventListener:()=>{},appendChild:()=>{},remove:()=>{},click(){if(typeof this.onclick==='function')return this.onclick();},change(){if(typeof this.onchange==='function')return this.onchange();}};
}
function element(id:string){if(!elements.has(id))elements.set(id,makeElement(id));return elements.get(id)}
for(const id of ['grade','classId','personaId','circle','labelCondition','topic'])element(id).value='all';
for(const dataset of ['sessions','utterances','expressions','personas','codebook']){
  const b=makeElement('dynamic-'+dataset);b.dataset.exportDataset=dataset;datasetButtons.push(b);
}
const documentStub:any={
  getElementById:(id:string)=>element(id),
  querySelectorAll:(selector:string)=>selector==='[data-export-dataset]'?datasetButtons:[],
  createElement:(tag:string)=>makeElement('created-'+tag),
  body:{appendChild:()=>{}},
};
const location:any={href:'',reload:()=>{}};
const sample={
  success:true,
  metrics:{participantCount:128,totalSessions:384,childUtteranceCount:9842,meanChildWordsPerMinute:18.4,completeRate:98.7,latestAt:'2026-09-03 14:32:00'},
  filters:{classes:['5-1','6-2'],grades:['5','6'],personas:['emma_usa','rahul_bangladesh'],circles:['Inner','Outer'],labelConditions:['shown','hidden'],topics:['favorites','shizuoka_culture']},
  charts:{
    daily:[{date:'2026-09-01',sessions:45,mean_child_words:12.5,mean_child_words_per_minute:17.2,reflection_conveyed:3.1,reflection_understood:3.2,reflection_culture:3.0},{date:'2026-09-02',sessions:52,mean_child_words:14.2,mean_child_words_per_minute:19.1,reflection_conveyed:3.4,reflection_understood:3.5,reflection_culture:3.3}],
    personas:[{label:'Emma (emma_usa)',value:45},{label:'Rahul (rahul_bangladesh)',value:30}],circles:[{label:'Inner',value:45},{label:'Outer',value:30}],aggregation:'daily'
  },
  dataQuality:[{label:'complete',value:379},{label:'missing_reflection',value:5}],
  systemQuality:[{label:'AI応答失敗',value:2},{label:'マイクエラー',value:1},{label:'TTSフォールバック',value:3}],
  topExpressions:[{expression:'I like',count:342,source:'curriculum'},{expression:'surfing',count:187,source:'persona'}],
  recentSessions:[{local_started_at:'2026-09-03 14:31:00',research_id:'R0123',persona_name:'Emma',persona_id:'emma_usa',topic:'好きなもの',target_duration_minutes:3,data_quality_flag:'complete'}],
  exportFiles:[
    {dataset:'sessions',fileName:'sessions.csv',contains:'session data',analysisUse:'longitudinal',rowCount:384},
    {dataset:'utterances',fileName:'utterances.csv',contains:'utterances',analysisUse:'interaction',rowCount:12000},
    {dataset:'expressions',fileName:'expressions.csv',contains:'expressions',analysisUse:'vocabulary',rowCount:3000},
    {dataset:'personas',fileName:'personas.csv',contains:'personas',analysisUse:'conditions',rowCount:9},
    {dataset:'codebook',fileName:'codebook.csv',contains:'variables',analysisUse:'reproducibility',rowCount:180},
  ],
};
const context:any={console,document:documentStub,window:{},location,alert:()=>{},URL,URLSearchParams,Set,Map,Math,Number,String,Array,Object,Date,
  fetch:async(url:string)=>({ok:true,json:async()=>url.includes('/api/health')?{appVersion:'1.0.7',build:'test'}:sample}),
  setTimeout:()=>0,clearTimeout:()=>{}};
vm.createContext(context);
vm.runInContext(match[1],context,{filename:'research-dashboard.js'});

context.renderDashboard(sample);
assert.equal(element('mParticipants').textContent,128);
assert.equal(element('mSessions').textContent,384);
assert.equal(element('mWordsPerMinute').textContent,'18.4');
assert.equal(element('mCompleteRate').textContent,'98.7%');
for(const id of ['chartDaily','chartPersona','chartWords','chartReflection'])assert.ok(element(id).innerHTML.includes('<svg'),id+' must render an inline SVG graph');
assert.ok(element('qualityRows').innerHTML.includes('完全ケース'));assert.ok(element('qualityRows').innerHTML.includes('システムイベント'));assert.ok(element('qualityRows').innerHTML.includes('TTSフォールバック'));
assert.ok(element('topExpressions').innerHTML.includes('surfing'));assert.ok(element('topExpressions').innerHTML.includes('プロフィール辞書'));assert.equal(element('topExpressions').innerHTML.includes('(persona)'),false);
assert.ok(element('recentRows').innerHTML.includes('R0123'));
assert.ok(element('exportCards').innerHTML.includes('sessions.csv')&&element('exportCards').innerHTML.includes('codebook.csv'));

element('start').value='2026-09-01';element('end').value='2026-09-03';element('grade').value='5';element('classId').value='1';element('personaId').value='emma_usa';element('circle').value='Inner';element('labelCondition').value='shown';element('topic').value='favorites';element('completeOnly').checked=true;
const params=context.filterParams();
assert.equal(params.get('start'),'2026-09-01');assert.equal(params.get('end'),'2026-09-03');assert.equal(params.get('grade'),'5');assert.equal(params.get('classId'),'1');
assert.equal(params.get('personaId'),'emma_usa');assert.equal(params.get('circle'),'Inner');assert.equal(params.get('labelCondition'),'shown');assert.equal(params.get('topic'),'favorites');assert.equal(params.get('completeOnly'),'1');
const dashboardUrl=context.queryUrl('/api/management/research.dashboard');
assert.ok(dashboardUrl.includes('personaId=emma_usa')&&dashboardUrl.includes('completeOnly=1'),'dashboard API must receive every active filter');
context.renderDashboard(sample,params.toString());
assert.ok(context.appliedQueryUrl('/api/management/research.csv','sessions').includes('personaId=emma_usa'),'applied dashboard filters must be snapshotted for exports');

context.downloadDataset('sessions');
assert.ok(location.href.startsWith('/api/management/research.csv?'));
assert.ok(location.href.includes('dataset=sessions')&&location.href.includes('classId=1'),'CSV download must use the same dashboard filters');

element('bundleBtn').onclick();
assert.ok(location.href.startsWith('/api/management/research.bundle.zip'));
assert.ok(location.href.includes('personaId=emma_usa'),'ZIP download must use the same dashboard filters');

context.resetFilters();
assert.equal(element('start').value,'');assert.equal(element('end').value,'');assert.equal(element('classId').value,'all');assert.equal(element('completeOnly').checked,false);

const pageSource=html;
assert.equal(pageSource.includes('data-nav='),false,'top navigation buttons must be removed');
for(const id of ['filterBtn','resetBtn','refreshBtn','bundleBtn','logoutBtn'])assert.ok(pageSource.includes('id="'+id+'"'),'button missing '+id);
assert.ok(pageSource.includes("$('filterBtn').onclick=loadDashboard"),'filter button must be linked to dashboard refresh');
assert.ok(pageSource.includes("$('refreshBtn').onclick=loadDashboard"),'refresh button must be linked to dashboard refresh');
assert.ok(pageSource.includes("$('bundleBtn').onclick"),'bundle button must be linked to download endpoint');
assert.ok(pageSource.includes('onchange=scheduleDashboardReload'),'all filter controls must auto-refresh the dashboard');
assert.ok(pageSource.includes('appliedQueryUrl'),'CSV and ZIP downloads must use the last successfully rendered filter snapshot');
assert.ok(pageSource.includes('flex-wrap:wrap'),'research header/actions must wrap instead of overflowing');assert.ok(pageSource.includes('.svg-label{font-size:12px'),'graph labels must be readable');assert.ok(pageSource.includes('1分あたり平均発話語数'));assert.equal(pageSource.includes('id="chartCircle"'),false);assert.ok(pageSource.includes('５年')&&pageSource.includes('６年')&&pageSource.includes('１組')&&pageSource.includes('２組')&&pageSource.includes('３組'));assert.ok(pageSource.includes('表示あり')&&pageSource.includes('表示なし'));for(const label of ['自己紹介・あいさつ','好きなもの・すきなこと','静岡のじまん＆世界の文化','できること・得意なこと','自由トーク・おしゃべり'])assert.ok(pageSource.includes(label),'theme missing '+label);
assert.equal(pageSource.includes('博士'),false,'researcher UI must not display 博士');
for(const id of ['start','end','grade','classId','personaId','circle','labelCondition','topic','completeOnly'])assert.equal(typeof element(id).onchange,'function',id+' must have immediate-change binding');

console.log('Research dashboard graph/button/filter linkage QA: PASS');
