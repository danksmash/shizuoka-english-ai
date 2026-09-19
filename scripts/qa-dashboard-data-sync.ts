import assert from 'node:assert/strict';
import vm from 'node:vm';
import { managementPageHtml } from '../src/server/managementPage';
import { buildResearchDashboardData } from '../src/server/researchDashboard';

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
for (const dataset of ['sessions','utterances','expressions','personas','codebook','lesson_reflections']) {
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
const sessionStore = new Map<string,string>();
const sessionStorageStub: any = {
  get length(){ return sessionStore.size; },
  key(index:number){ return Array.from(sessionStore.keys())[index] ?? null; },
  getItem(key:string){ return sessionStore.has(key) ? sessionStore.get(key)! : null; },
  setItem(key:string,value:string){ sessionStore.set(key,String(value)); },
  removeItem(key:string){ sessionStore.delete(key); },
  clear(){ sessionStore.clear(); },
};
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
      {date:'2026-09-01',sessions:45,mean_child_words:12.5,mean_child_words_per_minute:17.2,reflection_understood:3.2,reflection_understood_n:45,reflection_conveyed:3.2,reflection_conveyed_n:45,reflection_culture:3.2,reflection_culture_n:44},
      {date:'2026-09-02',sessions:52,mean_child_words:14.2,mean_child_words_per_minute:19.1,reflection_understood:3.5,reflection_understood_n:52,reflection_conveyed:3.4,reflection_conveyed_n:51,reflection_culture:3.3,reflection_culture_n:50},
    ],
    cumulativeDaily:[
      {date:'2026-09-01',sessions:45,mean_child_words_per_minute:17.2,mean_child_words_per_minute_n:45,reflection_understood:3.2,reflection_understood_n:45,reflection_conveyed:3.2,reflection_conveyed_n:45,reflection_culture:3.2,reflection_culture_n:44},
      {date:'2026-09-02',sessions:97,mean_child_words_per_minute:18.3,mean_child_words_per_minute_n:97,reflection_understood:3.36,reflection_understood_n:97,reflection_conveyed:3.3,reflection_conveyed_n:96,reflection_culture:3.25,reflection_culture_n:94},
    ],
    personas:[{label:'Emma',value:45},{label:'Rahul',value:30}],aggregation:'daily',
  },
  lessonReflectionRowCount:3,
  lessonReflectionRows:[
    {local_date:'2026-09-01',status:'submitted',goal_rating:'3',communication_rating:'4'},
    {local_date:'2026-09-01',status:'submitted',goal_rating:'4',communication_rating:'3'},
    {local_date:'2026-09-02',status:'submitted',goal_rating:'4',communication_rating:'4'},
  ],
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
const lessonCsv = '\uFEFF"research_id","class_id","data_scope","grade_level","class_number","local_date","status","today_goal","goal_rating","communication_rating"\n"R0001","5-1","test","5","1","2026-09-01","submitted","goal","3","4"\n"R0002","5-1","test","5","1","2026-09-01","submitted","goal","4","3"\n"R0003","5-1","test","5","1","2026-09-02","submitted","goal","4","4"\n';
const urlApi: any = { createObjectURL:() => 'blob:test', revokeObjectURL:() => {} };
const context: any = {
  console, document:documentStub, window:{}, location, sessionStorage:sessionStorageStub, alert:() => {}, URL:urlApi, URLSearchParams, Set, Map, Math, Number, String, Array, Object, Date, Blob,
  fetch:async(url:string) => {
    fetchCalls.push(url);
    const isLessonCsv = url.includes('/api/management/research.csv') && url.includes('dataset=lesson_reflections');
    return {
      ok:true,status:200,
      json:async() => url.includes('/api/health') ? {appVersion:'1.0.7',build:'test'} : sample,
      text:async() => isLessonCsv ? lessonCsv : '',
      blob:async() => new Blob(['test']),
      headers:{get:() => null},
    };
  },
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
assert.equal(element('chartWordsTitle').textContent,'1分あたり平均発話語数（累積総セッション平均・日別）');
assert.equal(element('chartReflectionTitle').textContent,'AI対話ふりかえり平均（累積総セッション平均・4件法）');
assert.ok(element('chartReflection').innerHTML.includes('相手の話を聞いて分かる'));
assert.ok(element('chartReflection').innerHTML.includes('自分の考えを伝える'));
assert.ok(element('chartReflection').innerHTML.includes('新しい言葉や文化に気づいた'));
assert.ok(element('chartReflection').innerHTML.includes('当日までの有効回答の累積平均'));
assert.ok(element('chartWords').innerHTML.includes('当日までの有効セッション累積平均'));
assert.ok(element('chartWords').innerHTML.includes('n=97'));
assert.equal(element('chartWords').innerHTML.includes('class=\"svg-value\"'),false,'cumulative words chart must not print dense point labels');
assert.ok(element('chartReflection').innerHTML.includes('class="reflection-axis-label">1</text>') && element('chartReflection').innerHTML.includes('class="reflection-axis-label">4</text>'));
assert.ok(element('chartReflection').innerHTML.includes('#2774ee') && element('chartReflection').innerHTML.includes('#20a567') && element('chartReflection').innerHTML.includes('#f59e0b'));
assert.ok(element('chartReflection').innerHTML.includes('<circle') && element('chartReflection').innerHTML.includes('<rect') && element('chartReflection').innerHTML.includes('<polygon'));
assert.equal(element('chartReflection').innerHTML.includes('class="svg-value"'),false,'reflection chart must not print a value label at every point');
assert.ok(element('qualityRows').innerHTML.includes('研究データ品質'));
assert.ok(element('qualityRows').innerHTML.includes('システム品質'));
assert.ok(element('qualityRows').innerHTML.includes('TTSフォールバック'));
assert.ok(element('topExpressions').innerHTML.includes('surfing'));
assert.ok(element('recentRows').innerHTML.includes('R0123'));
assert.ok(element('exportCards').innerHTML.includes('sessions.csv') && element('exportCards').innerHTML.includes('codebook.csv'));
assert.ok(element('exportCards').innerHTML.includes('lesson_reflections.csv'));

const parsedLesson = context.parseCsvRows(lessonCsv);
assert.equal(parsedLesson.length,3);
assert.equal(parsedLesson[0].research_id,'R0001');
const ratingSeries = context.buildLessonReflectionSeries(parsedLesson,'daily');
assert.deepEqual(JSON.parse(JSON.stringify(ratingSeries)),[
  {date:'2026-09-01',goal_rating:3.5,communication_rating:3.5,goal_n:2,communication_n:2},
  {date:'2026-09-02',goal_rating:4,communication_rating:4,goal_n:1,communication_n:1},
]);
const ratingSvg = context.ratingLineSvg(ratingSeries);
assert.ok(ratingSvg.includes('>1</text>') && ratingSvg.includes('>4</text>'),'4-point y-axis must be explicit');
assert.equal((ratingSvg.match(/class=\"svg-value\"/g)||[]).length,0,'rating chart must avoid dense numeric point labels');

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

const lessonParams = new URLSearchParams(params.toString());
lessonParams.set('dataScope','test');
const lessonRowsFromApi = await context.loadLessonReflectionRows(lessonParams);
assert.equal(lessonRowsFromApi.length,3);
const lessonFetch = fetchCalls.find((url) => url.includes('dataset=lesson_reflections') && url.includes('dataScope=test'));
assert.ok(lessonFetch);
assert.equal(lessonFetch!.includes('personaId='),false,'lesson reflection chart must ignore Persona filter');
assert.equal(lessonFetch!.includes('topic='),false,'lesson reflection chart must ignore topic filter');
assert.equal(lessonFetch!.includes('completeOnly='),false,'lesson reflection chart must ignore session-complete filter');

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
assert.equal(element('dataScope').value,'main');
assert.equal(element('classId').value,'all');
assert.equal(element('completeOnly').checked,false);
element('grade').value='all';
element('dataScope').value='pilot_b';
element('classId').value='all';
const pilotParams = context.filterParams();
assert.equal(pilotParams.get('grade'), null, 'Pilot B must not be encoded as a grade');
assert.equal(pilotParams.get('classId'), null, 'Pilot B must not be encoded as a class');
assert.equal(pilotParams.get('dataScope'),'pilot_b');
assert.ok(context.queryUrl('/api/management/research.dashboard').includes('dataScope=pilot_b'));

const pageSource = html;
assert.equal(pageSource.includes('Inner / Outer / Expanding'), false);
assert.equal(pageSource.includes('id="circle"'), false);
assert.ok(pageSource.includes('告知前／告知後セッション'));
assert.ok(pageSource.includes('担当国Persona選択率'));
assert.ok(pageSource.includes('個別利用らしいセッション'));
assert.ok(pageSource.includes('主研究データとAI/TTSのシステム品質は分離'));
assert.ok(pageSource.includes('AI対話ふりかえりグラフは'));
assert.ok(pageSource.includes('lesson_reflections.csv として別に保持'));
assert.ok(pageSource.includes('AI対話ふりかえり平均（累積総セッション平均・4件法）'));
assert.ok(pageSource.includes('1分あたり平均発話語数（累積総セッション平均・日別）'));
assert.ok(pageSource.includes("research-dashboard-session-v2:"));
assert.ok(pageSource.includes('.reflection-axis-label{font-size:18px'));
assert.equal(pageSource.includes('振り返り平均値（1/3/5）'),false,'obsolete 1/3/5 chart title must not return');
for (const id of ['filterBtn','resetBtn','refreshBtn','bundleBtn','logoutBtn']) assert.ok(pageSource.includes(`id="${id}"`), `button missing ${id}`);
assert.ok(pageSource.includes("$('filterBtn').onclick=loadDashboard"));
assert.ok(pageSource.includes("$('refreshBtn').onclick=loadDashboard"));
assert.ok(pageSource.includes('onchange=markDashboardFiltersPending'));
assert.equal(pageSource.includes('onchange=scheduleDashboardReload'),false,'filter changes must not auto-aggregate');
assert.ok(pageSource.includes('appliedQueryUrl'));
assert.ok(pageSource.includes('flex-wrap:wrap'));
assert.ok(pageSource.includes('.charts{display:grid;grid-template-columns:repeat(2'));
assert.ok(pageSource.includes('.svg-label{font-size:15px'));
assert.ok(pageSource.includes('.bar-label-html{font-size:16px'));
assert.ok(pageSource.includes('.chart svg{min-width:460px'));
assert.ok(pageSource.includes('.table-wrap{overflow-x:hidden;overflow-y:visible'), 'recent sessions wrapper must not scroll horizontally');
assert.ok(pageSource.includes('.recent{width:100%;table-layout:fixed'), 'recent sessions table must fit the card width');
assert.ok(pageSource.includes('.recent th:nth-child(4),.recent td:nth-child(4){width:26%}'), 'topic column must have an explicit responsive share');
assert.equal(pageSource.includes('.table-wrap{overflow:auto'), false, 'legacy horizontal scroll wrapper must not return');
assert.ok(pageSource.includes('1分あたり平均発話語数'));
assert.ok(pageSource.includes('５年') && pageSource.includes('６年') && pageSource.includes('１組') && pageSource.includes('２組') && pageSource.includes('３組'));
const scopeSelectHtml = pageSource.match(/<select id=\"dataScope\">([\s\S]*?)<\/select>/)?.[1] || '';
const gradeSelectHtml = pageSource.match(/<select id=\"grade\">([\s\S]*?)<\/select>/)?.[1] || '';
const classSelectHtml = pageSource.match(/<select id=\"classId\">([\s\S]*?)<\/select>/)?.[1] || '';
assert.ok(scopeSelectHtml.includes('<option value=\"pilot_b\">Pilot B</option>'), 'Pilot B must appear in the data-scope filter');
assert.ok(scopeSelectHtml.includes('<option value=\"main\" selected>本研究</option>'), 'main study must be the default data scope');
assert.equal(gradeSelectHtml.includes('テスト'), false, 'test must not appear in the grade filter');
assert.equal(gradeSelectHtml.includes('予備'), false, 'reserve must not appear in the grade filter');
assert.equal(classSelectHtml.includes('Pilot B'), false, 'Pilot B must not appear in the class filter');
assert.equal(classSelectHtml.includes('テスト'), false, 'test must not appear in the class filter');
assert.equal(classSelectHtml.includes('予備'), false, 'reserve must not appear in the class filter');
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
for (const id of ['start','end','dataScope','grade','classId','personaId','labelCondition','topic','completeOnly']) assert.equal(typeof element(id).onchange,'function',`${id} must mark filters pending`);

const dashboardFetchCount = () => fetchCalls.filter((url) => url.includes('/api/management/research.dashboard')).length;
const beforeChangeFetches = dashboardFetchCount();
element('grade').value='5';
element('grade').change();
assert.equal(dashboardFetchCount(),beforeChangeFetches,'changing a filter must not fetch dashboard data automatically');
assert.ok(element('dashboardStatus').textContent.includes('「絞り込む」を押すまで再集計しません'));

context.currentResearcherUsername='researcher';
context.saveDashboardSessionCache('researcher','dataScope=main',sample,123456789);
const cached = context.readDashboardSessionCache('RESEARCHER');
assert.equal(cached.query,'dataScope=main');
assert.equal(cached.data.metrics.totalSessions,384);
const beforeRestoreFetches = dashboardFetchCount();
const originalFetch = context.fetch;
context.fetch = async(url:string) => {
  fetchCalls.push(url);
  if (url === '/api/management/me') return {ok:true,status:200,json:async() => ({success:true,user:{username:'researcher',role:'researcher'}})};
  if (url.includes('/api/management/research.dashboard')) return {ok:true,status:200,json:async() => sample};
  return originalFetch(url);
};
await context.restoreManagementSession();
assert.equal(dashboardFetchCount(),beforeRestoreFetches,'returning with a valid login and cache must not aggregate again');
assert.equal(element('mSessions').textContent,384);
assert.ok(element('dashboardStatus').textContent.includes('前回集計結果を再表示しています'));
assert.equal(element('dataScope').value,'main');

const beforeRefreshFetches = dashboardFetchCount();
await element('refreshBtn').onclick();
assert.equal(dashboardFetchCount(),beforeRefreshFetches+1,'refresh button must explicitly reaggregate dashboard data');
context.clearDashboardSessionCache('researcher');
assert.equal(context.readDashboardSessionCache('researcher'),null);


const words = (count:number) => Array.from({length:count},() => 'hello').join(' ');
const researchSession = (id:string,date:string,wordCount:number,durationSeconds:number,reflection:any,withChild=true) => {
  const startedAt = Date.parse(date+'T01:00:00.000Z');
  const history:any[] = [{id:id+'-a',sender:'ai',englishText:'Hello. How are you?',japaneseText:'こんにちは。',timestamp:startedAt}];
  if(withChild) history.push({id:id+'-c',sender:'child',englishText:words(wordCount),japaneseText:'',timestamp:startedAt+10000});
  return {
    schemaVersion:4,researchSchemaVersion:'research-2026-v4',researchId:'R-'+id,studentId:'S-'+id,classId:'5-1',sessionId:id,
    aiStudentId:'emma_usa',personaId:'emma_usa',topic:'favorites',targetDurationMinutes:2,actualDurationSeconds:durationSeconds,
    startedAt:new Date(startedAt).toISOString(),endedAt:new Date(startedAt+durationSeconds*1000).toISOString(),
    history,reflection,systemEvents:[{type:'session_finish',timestamp:startedAt+durationSeconds*1000-1000}],
  };
};
const cumulativeDashboard:any = buildResearchDashboardData([
  researchSession('cum-1','2026-09-17',10,60,{scaleVersion:'4point-v1',understoodPartner:2,conveyedIdeas:3,noticedLanguageCulture:4}),
  researchSession('cum-2','2026-09-17',20,60,{scaleVersion:'4point-v1',understoodPartner:4,conveyedIdeas:3,noticedLanguageCulture:2}),
  researchSession('cum-3','2026-09-18',60,120,{scaleVersion:'4point-v1',understoodPartner:4,conveyedIdeas:4,noticedLanguageCulture:4}),
  researchSession('cum-4','2026-09-19',0,60,null,false),
],{dataScope:'main'});
assert.equal(cumulativeDashboard.metrics.meanChildWordsPerMinute,20,'top WPM metric must average valid session WPM equally, not weight by session duration');
assert.deepEqual(cumulativeDashboard.charts.cumulativeDaily.map((row:any)=>({
  date:row.date,wpm:row.mean_child_words_per_minute,wpmN:row.mean_child_words_per_minute_n,sessions:row.sessions,
  understood:row.reflection_understood,understoodN:row.reflection_understood_n,
})),[
  {date:'2026-09-17',wpm:15,wpmN:2,sessions:2,understood:3,understoodN:2},
  {date:'2026-09-18',wpm:20,wpmN:3,sessions:3,understood:3.33,understoodN:3},
  {date:'2026-09-19',wpm:20,wpmN:3,sessions:4,understood:3.33,understoodN:3},
],'daily trend points must be cumulative over individual valid sessions/answers, never an average of daily averages');

console.log('Research dashboard graph/button/filter linkage QA: PASS');
