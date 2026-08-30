import { chromium } from 'playwright-core';

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1366,height:900}});
await page.goto('file:///tmp/research-dashboard.html');
const sample={
  success:true,
  metrics:{participantCount:128,totalSessions:384,childUtteranceCount:9842,completeRate:98.7,latestAt:'2026-09-03 14:32:00'},
  filters:{classes:['5-1','6-2'],grades:['5','6'],personas:['emma_usa','rahul_bangladesh'],circles:['Inner','Outer'],labelConditions:['shown','hidden'],topics:['favorites','shizuoka_culture']},
  charts:{
    daily:[
      {date:'2026-09-01',sessions:45,mean_child_words:12.5,reflection_conveyed:3.1,reflection_understood:3.2,reflection_culture:3},
      {date:'2026-09-02',sessions:52,mean_child_words:14.2,reflection_conveyed:null,reflection_understood:3.5,reflection_culture:3.3},
    ],
    personas:[{label:'Emma (emma_usa)',value:45}],circles:[{label:'Inner',value:45}],aggregation:'daily',
  },
  dataQuality:[{label:'complete',value:379},{label:'missing_reflection',value:5}],
  systemQuality:[{label:'AI応答失敗',value:2},{label:'マイクエラー',value:1},{label:'TTSフォールバック',value:3}],
  topExpressions:[{expression:'surfing',count:187,source:'persona'}],
  recentSessions:[{local_started_at:'2026-09-03 14:31:00',research_id:'R0123',persona_name:'Emma',persona_id:'emma_usa',topic:'好きなもの',target_duration_minutes:3,data_quality_flag:'complete'}],
  exportFiles:[
    {dataset:'sessions',fileName:'sessions.csv',contains:'session data',analysisUse:'longitudinal',rowCount:384},
    {dataset:'utterances',fileName:'utterances.csv',contains:'utterances',analysisUse:'interaction',rowCount:12000},
    {dataset:'expressions',fileName:'expressions.csv',contains:'expressions',analysisUse:'vocabulary',rowCount:3000},
    {dataset:'personas',fileName:'personas.csv',contains:'personas',analysisUse:'conditions',rowCount:9},
    {dataset:'codebook',fileName:'codebook.csv',contains:'variables',analysisUse:'reproducibility',rowCount:180},
  ],
};

await page.evaluate((data)=>{
  document.getElementById('login').style.display='none';
  document.getElementById('panel').style.display='block';
  window.renderDashboard(data,'');
},sample);

const sizes=[[1920,1000],[1440,1000],[1366,900],[1024,900],[768,1000],[390,844]];
for(const [width,height] of sizes){
  await page.setViewportSize({width,height});
  await page.waitForTimeout(50);
  const audit=await page.evaluate(()=>{
    const vw=document.documentElement.clientWidth;
    const visibleButtons=[...document.querySelectorAll('button')].filter((b)=>{
      const st=getComputedStyle(b),r=b.getBoundingClientRect();
      return st.display!=='none'&&st.visibility!=='hidden'&&r.width>0&&r.height>0;
    });
    return {
      overflow:document.documentElement.scrollWidth-vw,
      outside:visibleButtons.filter((b)=>{const r=b.getBoundingClientRect();return r.left<-1||r.right>vw+1}).map((b)=>b.textContent?.trim()),
    };
  });
  if(audit.overflow>2||audit.outside.length)throw new Error(`layout overflow at ${width}px: ${JSON.stringify(audit)}`);
}

await page.evaluate((data)=>{
  window.__urls=[];
  window.fetch=async(url)=>{
    window.__urls.push(String(url));
    const next=structuredClone(data);
    if(String(url).includes('personaId=emma_usa'))next.metrics.totalSessions=45;
    return {ok:true,json:async()=>next};
  };
  const p=document.getElementById('personaId');
  p.value='emma_usa';
  p.dispatchEvent(new Event('change',{bubbles:true}));
},sample);
await page.waitForTimeout(350);
const instant=await page.evaluate(()=>({
  sessions:document.getElementById('mSessions').textContent,
  urls:window.__urls,
  exportUrl:window.appliedQueryUrl('/api/management/research.csv','sessions'),
  doctor:document.body.innerText.includes('博士'),
}));
if(instant.sessions!=='45')throw new Error('persona dropdown did not refresh immediately');
if(!instant.urls.some((u)=>u.includes('personaId=emma_usa')))throw new Error('auto refresh did not send persona filter');
if(!instant.exportUrl.includes('personaId=emma_usa'))throw new Error('export filter snapshot is not synchronized with displayed dashboard');
if(instant.doctor)throw new Error('forbidden researcher UI wording is visible');

await page.evaluate(()=>{
  const e=document.getElementById('start');
  e.value='2026-09-01';
  e.dispatchEvent(new Event('change',{bubbles:true}));
});
await page.waitForTimeout(350);
const dateAudit=await page.evaluate(()=>({urls:window.__urls,exportUrl:window.appliedQueryUrl('/api/management/research.csv','sessions')}));
if(!dateAudit.urls.some((u)=>u.includes('start=2026-09-01')))throw new Error('date change did not refresh immediately');
if(!dateAudit.exportUrl.includes('start=2026-09-01'))throw new Error('date filter is not synchronized with export');

await browser.close();
console.log('Real browser researcher dashboard responsive/instant-filter QA: PASS');
