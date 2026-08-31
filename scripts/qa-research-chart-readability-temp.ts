import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { managementPageHtml } from '../src/server/managementPage';

const sample:any={success:true,metrics:{participantCount:1,totalSessions:28,meanChildWordsPerMinute:24.5,completeRate:82.1,latestAt:'2026-08-30 22:41:28'},filters:{personas:['emma_usa','aung_myanmar','bence_hungary','liam_australia','linh_vietnam','oliver_uk','rahul_bangladesh','zofia_poland','chloe_canada']},charts:{aggregation:'daily',daily:[{date:'2026-08-28',sessions:8,mean_child_words_per_minute:27.7,reflection_conveyed:3,reflection_understood:3,reflection_culture:3},{date:'2026-08-29',sessions:15,mean_child_words_per_minute:22.4,reflection_conveyed:3.7,reflection_understood:3.7,reflection_culture:2.6},{date:'2026-08-30',sessions:5,mean_child_words_per_minute:21.8,reflection_conveyed:4.5,reflection_understood:4.5,reflection_culture:3.5}],personas:[{label:'Emma Johnson',value:13},{label:'Aung Min',value:2},{label:'Bence Kovács',value:2},{label:'Liam Walker',value:2},{label:'Linh Nguyen',value:2},{label:'Oliver Wright',value:2},{label:'Rahul Hasan',value:2},{label:'Zofia Nowak',value:2},{label:'Chloe Tremblay',value:1}]},dataQuality:[],systemQuality:[],topExpressions:[],recentSessions:[],exportFiles:[]};

let html=managementPageHtml();
const extra=`<script>document.getElementById('login').style.display='none';document.getElementById('panel').style.display='block';renderDashboard(${JSON.stringify(sample)});requestAnimationFrame(function(){const heights=function(sel){return Array.from(document.querySelectorAll(sel)).map(function(e){return e.getBoundingClientRect().height})};const cards=Array.from(document.querySelectorAll('.chart-card')).map(function(e){const r=e.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width)}});const result={viewport:window.innerWidth,overflow:document.documentElement.scrollWidth-window.innerWidth,minBarLabel:Math.min.apply(null,heights('.bar-label-html')),minBarValue:Math.min.apply(null,heights('.bar-value-html')),minSvgLabel:Math.min.apply(null,heights('.svg-label')),minSvgValue:Math.min.apply(null,heights('.svg-value')),personaVisible:document.body.textContent.includes('Emma Johnson'),dateVisible:document.body.textContent.includes('2026-08-28'),cards:cards};document.body.insertAdjacentHTML('beforeend','<pre id="qa-result">'+JSON.stringify(result)+'</pre>')});</script>`;
html=html.replace('</body>',extra+'</body>');
const file='/tmp/research-chart-readability.html';
writeFileSync(file,html);

const candidates=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'];
const chrome=candidates.find(existsSync);
if(!chrome) throw new Error('Chrome/Chromium not found on runner');
for(const width of [1920,1440,1366,1024,768,390]){
  const out=execFileSync(chrome,['--headless','--no-sandbox','--disable-gpu','--allow-file-access-from-files','--virtual-time-budget=1200',`--window-size=${width},1200`,'--dump-dom',`file://${file}`],{encoding:'utf8',stdio:['ignore','pipe','ignore']});
  const match=out.match(/<pre id="qa-result">(\{.*?\})<\/pre>/);
  if(!match) throw new Error(`No visual QA result at ${width}px`);
  const data=JSON.parse(match[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&'));
  if(data.overflow>2) throw new Error(`Page overflow at ${width}px: ${data.overflow}`);
  if(!data.personaVisible||!data.dateVisible) throw new Error(`Graph labels missing at ${width}px`);
  if(data.minBarLabel<14||data.minBarValue<14) throw new Error(`Bar labels too small at ${width}px: ${JSON.stringify(data)}`);
  if(data.minSvgLabel<14||data.minSvgValue<14) throw new Error(`Line labels too small at ${width}px: ${JSON.stringify(data)}`);
  if(width>=768&&data.cards.length>=3&&data.cards[0].y!==data.cards[1].y) throw new Error(`Charts are not two-column at ${width}px`);
  if(width<=390&&data.cards.length>=2&&data.cards[0].y===data.cards[1].y) throw new Error('Mobile charts must be one column');
  console.log(`Research chart visual QA ${width}px: PASS (bar ${data.minBarLabel}px / line ${data.minSvgLabel}px)`);
}
