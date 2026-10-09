import { RESEARCH_CLASS_COLORS } from '../src/server/researchClassChartPalette';
import { RESEARCH_DATE_TICK_BROWSER_SCRIPT } from '../src/server/researchChartDateTicks';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runInNewContext } from 'node:vm';
import { withResearchDashboardChartUnification } from '../src/server/researchDashboardChartUnificationRuntime';
import { withResearchWordsByClassRuntime } from '../src/server/researchWordsByClassRuntime';
import { withResearchDailyClassStack } from '../src/server/researchDailyClassStackRuntime';
import { managementPageHtml } from '../src/server/managementPage';

let sentBody = '';
const res: any = {
  send(body: unknown) {
    sentBody = String(body ?? '');
    return body;
  },
};
const handler = withResearchDashboardChartUnification(
  '/management',
  ((_req: any, response: any) => response.send('<html><body><div id="chartDaily"></div><div id="chartTurns"></div></body></html>')) as any,
);
handler({} as any, res, (() => undefined) as any);

assert.match(sentBody, /researchDashboardChartUnificationStyle/);
assert.match(sentBody, /typeof lastDashboard!=='undefined'/);
// The unified chart may be injected before the separate turns container is added.
let earlyHtml='';
withResearchDashboardChartUnification('/management',((_req:any,res:any)=>res.send('<html><body><div id="chartDaily"></div></body></html>')) as any)(
  {} as any,{send(body:unknown){earlyHtml=String(body);return body}} as any,(()=>undefined) as any,
);
assert.match(earlyHtml,/id="researchDashboardChartUnification"/,'chart script must not be lost when chartTurns arrives later');
assert.match(sentBody, /researchDashboardChartUnification/);
assert.match(sentBody, /research-chart-left-stack/);
assert.match(sentBody, /grid-template-rows:minmax\(0,1fr\) minmax\(0,1fr\)/);
assert.match(sentBody, /W=460,H=245,LEFT=56,RIGHT=15,BOTTOM=43,LINE_WIDTH=1\.6/);
assert.match(sentBody, /unified-line-axis/);
assert.match(sentBody, /font-size:10px/);
assert.match(sentBody, /unified-line-legend/);
assert.match(sentBody, /unified-line-footnote\{[^}]*font-size:11px/);
assert.doesNotMatch(sentBody, /class=\\"unified-line-note\\"/);
assert.match(sentBody, /unified-line-chart\{display:flex;flex-direction:column/);
assert.match(sentBody, /ensureSeparateCards/);
assert.match(sentBody, /research-turns-card/);
assert.match(sentBody, /daily-class-stack-card/);
assert.match(sentBody, /cumulativeWordsByClass/);
assert.match(sentBody, /lessonCumulativeReflection/);
assert.match(sentBody, /reflectionSvg/);
assert.match(sentBody, /observed===false/);
// Cumulative values can be carried forward for API consumers, but unobserved dates must not create line vertices.
assert.match(sentBody, /if\(valid\(p\.value\)&&p\.observed!==false\)points\.push/);
assert.match(sentBody, /function observed\(row,item\)/);
assert.match(sentBody, /授業内のみ｜累積平均（セッション単位）｜授業外利用は除外/);
assert.match(sentBody, /turns\.innerHTML=classSeriesSvg\(charts\.cumulativeTurnsByClass/);
assert.match(sentBody, /words\.innerHTML=classSeriesSvg\(charts\.cumulativeWordsByClass/);
assert.match(sentBody, /function classColor\(classId,condition\)/);
assert.match(sentBody, /"5-1":"#3B82F6"/);
assert.match(sentBody, /"5-2":"#10B981"/);
assert.match(sentBody, /"5-3":"#A855F7"/);
assert.match(sentBody, /"6-C1":"#F59E0B"/);
assert.match(sentBody, /"6-C2":"#EC4899"/);
assert.match(sentBody, /school_condition==='comparison'\|\|\/\^\[1-9\]-C\[1-9\]\$\/i/);
assert.match(sentBody, /label:'新しい言葉や文化に気づいた',color:'#f59e0b'/);
assert.match(sentBody, /if\(id==='5-3'\)return 'triangle'/);
assert.match(sentBody, /if\(id==='6-C2'\)return 'cross'/);
assert.match(sentBody, /function classShape\(classId\)/);
assert.match(sentBody, /stroke-width="'\+LINE_WIDTH\+'"/);
assert.doesNotMatch(sentBody, /patchTurnsLineWidth/);

const serverEntry = fs.readFileSync(new URL('../server-entry.ts', import.meta.url), 'utf8');
assert.match(serverEntry, /withResearchDashboardChartUnification/);
assert.ok(
  serverEntry.indexOf('withResearchWordsByClassRuntime(path')
    < serverEntry.indexOf('withResearchDashboardChartUnification(path'),
  'chart unification runtime must wrap after words-by-class runtime',
);

assert.doesNotMatch(serverEntry,/withResearchReflectionChartPolish/,
  'postprocessing must never reset marker separation or change canonical reflection strokes');


// Render the actual injected browser script, not only its text, so missing-day
// cumulative averages cannot silently split a trend again.
const injectedScript = sentBody.match(/<script id="researchDashboardChartUnification">([\s\S]*?)<\/script>/)?.[1];
assert.ok(injectedScript, 'unified chart browser script should be injected');
const reflectionElement = { innerHTML: '' };
const wordElement = { innerHTML: '' };
const turnElement = { innerHTML: '' };
const browser: any = {
  window: {},
  document: {
    getElementById(id: string) {
      if (id === 'chartReflection') return reflectionElement;
      if (id === 'chartWords') return wordElement;
      if (id === 'chartTurns') return turnElement;
      return null;
    },
  },
  renderDashboard() {},
};
runInNewContext(injectedScript, browser);
const cachedWords={innerHTML:''},cachedTurns={innerHTML:''};
const cachedBrowser:any={
  window:{},
  lastDashboard:{charts:{
    cumulativeWordsByClass:[{class_id:'5-2',label:'5年2組',school_condition:'intervention',points:[
      {date:'2026-10-01',value:10,n:1,observed:true},{date:'2026-10-03',value:12,n:2,observed:true},
    ]}],
    cumulativeTurnsByClass:[{class_id:'5-2',label:'5年2組',school_condition:'intervention',points:[
      {date:'2026-10-01',value:3,n:1,observed:true},{date:'2026-10-03',value:4,n:2,observed:true},
    ]}],
  }},
  document:{getElementById(id:string){if(id==='chartWords')return cachedWords;if(id==='chartTurns')return cachedTurns;return null}},
  renderDashboard(){},
};
runInNewContext(injectedScript,cachedBrowser);
assert.match(cachedWords.innerHTML,/stroke="#10B981"/,'existing cached word chart must redraw as soon as unified script loads');
assert.match(cachedTurns.innerHTML,/stroke="#10B981"/,'existing cached turn chart must redraw without another API request');


function reflectionTestRow(date: string, observed: boolean, a: number, b: number, c: number) {
  return {
    date,
    reflection_understood: a,
    reflection_understood_n: observed ? 2 : 0,
    reflection_understood_observed: observed,
    reflection_conveyed: b,
    reflection_conveyed_n: observed ? 2 : 0,
    reflection_conveyed_observed: observed,
    reflection_culture: c,
    reflection_culture_n: observed ? 2 : 0,
    reflection_culture_observed: observed,
  };
}
const gapRows = [
  reflectionTestRow('2026-09-17', true, 2.6, 2.8, 2.4),
  reflectionTestRow('2026-09-18', false, 2.6, 2.8, 2.4),
  reflectionTestRow('2026-09-19', true, 2.8, 2.9, 2.5),
  reflectionTestRow('2026-09-20', false, 2.8, 2.9, 2.5),
  reflectionTestRow('2026-09-21', true, 2.9, 3.0, 2.7),
];
browser.window.renderDashboard({ charts: { lessonCumulativeReflection: gapRows } });
const gapSvg = reflectionElement.innerHTML;
const observedPaths = [...gapSvg.matchAll(/<polyline points="([^"]+)"/g)];
assert.equal(observedPaths.length, 3, 'all three reflection trends must be continuous');
for (const path of observedPaths) {
  const xPositions = path[1].split(' ').map(point => Number(point.split(',')[0]));
  assert.deepEqual(xPositions, [56, 250.5, 445], 'connect observed dates 1, 3, 5 without filling gaps');
}
assert.equal((gapSvg.match(/<title>/g) || []).length, 9, 'draw 3 marks per item on observed days only');

const singleRow = gapRows.map((row, i) => ({
  ...row,
  reflection_understood_observed: i === 0,
  reflection_conveyed_observed: i === 0,
  reflection_culture_observed: i === 0,
}));
browser.window.renderDashboard({ charts: { lessonCumulativeReflection: singleRow } });
assert.doesNotMatch(reflectionElement.innerHTML, /<polyline /, 'a single observed date must not draw a line');
assert.equal((reflectionElement.innerHTML.match(/<title>/g) || []).length, 3, 'single day has only 3 marks');


// With the same observed values, word/min uses a tighter automatic axis while
// turn/min keeps the prior shared renderer's original y-axis behavior.
const axisNumbers = (svg: string) => [...svg.matchAll(/<text x="39" y="[^"]+" text-anchor="middle" class="unified-line-axis">([^<]+)<\/text>/g)]
  .map(match => Number(match[1]));
const wordExample = [
  { class_id: '5-2', label: '5年2組', school_condition: 'intervention', points: [
    {date:'2026-10-07',value:9.3,n:1,observed:true},
  ] },
  { class_id: '5-3', label: '5年3組', school_condition: 'intervention', points: [
    {date:'2026-09-17',value:13.7,n:1,observed:true},
  ] },
];
browser.window.renderDashboard({ charts: {
  cumulativeWordsByClass: wordExample,
  cumulativeTurnsByClass: wordExample,
} });
assert.deepEqual(axisNumbers(wordElement.innerHTML), [9,10,11,12,13,14],
  'word/min y-axis should fit representative values 9.3–13.7 instead of 6–16');
assert.deepEqual(axisNumbers(turnElement.innerHTML), [6,8,10,12,14,16],
  'turn/min y-axis must remain unchanged');
assert.match(wordElement.innerHTML, /9\.3 語\/分/, 'low observed word value must be retained');
assert.match(wordElement.innerHTML, /13\.7 語\/分/, 'high observed word value must be retained');
assert.match(wordElement.innerHTML, /<div class="unified-line-footnote" role="note">/);
assert.match(turnElement.innerHTML, /色＝学級別に固定/);
assert.match(reflectionElement.innerHTML, /<div class="unified-line-footnote" role="note">/);

const laterWords = [{ class_id: '5-3', label: '5年3組', school_condition: 'intervention', points: [
  {date:'2026-10-08',value:24.1,n:1,observed:true},
  {date:'2026-10-09',value:24.8,n:2,observed:true},
]}];
browser.window.renderDashboard({ charts: { cumulativeWordsByClass: laterWords } });
const laterTicks = axisNumbers(wordElement.innerHTML);
assert.ok(laterTicks[0] <= 24.1 && laterTicks.at(-1)! >= 24.8,
  'future word/min values must remain inside an automatically expanded axis');
assert.ok(laterTicks.at(-1)! - laterTicks[0] < 3,
  'small future word/min differences should not get excessively padded');


const paletteEntries=Object.entries(RESEARCH_CLASS_COLORS).filter(([id])=>id!=='UNKNOWN');
assert.equal(new Set(paletteEntries.map(([,color])=>color.toUpperCase())).size,paletteEntries.length,'known classes must not share a color');
const colorValue = (html: string, hex: string) => html.includes('stroke="'+hex+'"');
const stableSeries = [
  {class_id:'5-1',label:'5年1組',school_condition:'intervention',points:[{date:'2026-09-17',value:10,n:1,observed:true},{date:'2026-09-25',value:11,n:2,observed:true}]},
  {class_id:'5-2',label:'5年2組',school_condition:'intervention',points:[{date:'2026-09-17',value:9,n:1,observed:true},{date:'2026-09-25',value:10,n:2,observed:true}]},
  {class_id:'5-3',label:'5年3組',school_condition:'intervention',points:[{date:'2026-09-17',value:12,n:1,observed:true},{date:'2026-09-25',value:13,n:2,observed:true}]},
  {class_id:'6-C1',label:'6年比較1組',school_condition:'comparison',points:[{date:'2026-09-17',value:11,n:1,observed:true},{date:'2026-09-25',value:12,n:2,observed:true}]},
  {class_id:'6-C2',label:'6年比較2組',school_condition:'comparison',points:[{date:'2026-09-17',value:8,n:1,observed:true},{date:'2026-09-25',value:9,n:2,observed:true}]},
];
browser.window.renderDashboard({charts:{cumulativeWordsByClass:stableSeries,cumulativeTurnsByClass:stableSeries}});
const allColors = {words:wordElement.innerHTML,turns:turnElement.innerHTML};
for (const html of [allColors.words,allColors.turns]) {
  assert.ok(colorValue(html,'#3B82F6') && colorValue(html,'#10B981') && colorValue(html,'#A855F7'), 'all three intervention classes use distinct color families');
  assert.ok(colorValue(html,'#F59E0B') && colorValue(html,'#EC4899'), 'both comparison classes have their own distinct stable colors');
  assert.match(html, /<polygon points=/, 'triangle and diamond markers remain visible');
  assert.match(html, /<path d="M/, 'cross marker remains visible');
}
browser.window.renderDashboard({charts:{cumulativeWordsByClass:[stableSeries[2],stableSeries[3]],cumulativeTurnsByClass:[stableSeries[2],stableSeries[3]]}});
for (const html of [wordElement.innerHTML,turnElement.innerHTML]) {
  assert.ok(colorValue(html,'#A855F7') && colorValue(html,'#F59E0B'), 'filtered redraw cannot recolor the same class');
  assert.doesNotMatch(html, /<text[^>]*class="unified-line-note"/, 'footnote must not clip inside SVG');
  assert.match(html, /<\/svg><div class="unified-line-footnote" role="note">/, 'footnote must follow the graph, not overlap chart axis');
}


// Regression: the unified renderer is the ONE owner of all three line charts.
let productionHtml='';
const response:any={send(body:unknown){productionHtml=String(body);return body}};
let pageHandler:any=(_req:any,res:any)=>res.send(managementPageHtml());
pageHandler=withResearchDailyClassStack('/management',pageHandler);
pageHandler=withResearchWordsByClassRuntime('/management',pageHandler);
pageHandler=withResearchDashboardChartUnification('/management',pageHandler);
pageHandler({} as any,response,()=>{});
for(const id of ['researchDailyClassStack','researchDashboardChartUnification']){
  assert.ok(productionHtml.includes('id="'+id+'"'), 'production response must inject '+id);
}
assert.doesNotMatch(productionHtml,/id="researchWordsByClassRuntime"/,'removed legacy words script must never be injected');
assert.doesNotMatch(productionHtml,/function wordsByClassSvg\(/,'no obsolete words renderer');
assert.doesNotMatch(productionHtml,/function turnsByClassSvg\(/,'no obsolete turns renderer');
assert.doesNotMatch(productionHtml,/function aiReflectionLineSvg\(/,'no obsolete reflection renderer');
assert.doesNotMatch(productionHtml,/function cumulativeWordsLineSvg\(/,'no obsolete base words renderer');
assert.doesNotMatch(productionHtml,/cumulativeWordsLineSvg\(cumulativeRows\)/,'base management must not overwrite words');
assert.doesNotMatch(productionHtml,/aiReflectionLineSvg\(cumulativeRows\)/,'base management must not overwrite reflections');
assert.match(productionHtml,/chartWords'\)\.innerHTML='<div class="muted"/,'base chart remains a visible placeholder if unified renderer is unavailable');
// With missing lesson dates, vertices must be only the measured dates, not carried-forward plateaus.
const sparseSeries=[{class_id:'5-1',label:'5年1組',school_condition:'intervention',points:[
  {date:'2026-10-01',value:10,n:1,observed:true},
  {date:'2026-10-02',value:10,n:1,observed:false},
  {date:'2026-10-03',value:12,n:2,observed:true},
  {date:'2026-10-04',value:12,n:2,observed:false},
  {date:'2026-10-05',value:14,n:3,observed:true},
]}];
browser.window.renderDashboard({charts:{cumulativeTurnsByClass:sparseSeries,cumulativeWordsByClass:sparseSeries}});
for(const html of [wordElement.innerHTML,turnElement.innerHTML]){
  const points=html.match(/<polyline points="([^"]+)"/)?.[1].split(' ')||[];
  assert.equal(points.length,3,'connect only 3 measured days, without horizontal filler segments');
}
// Alternating collisions must not create spurious bends in a constant reflection series.
const constantWithCollisions=[
  reflectionTestRow('2026-10-01',true,2.8,2.8,2.4),
  reflectionTestRow('2026-10-02',true,2.8,2.5,2.8),
  reflectionTestRow('2026-10-03',true,2.8,2.8,2.8),
];
browser.window.renderDashboard({charts:{lessonCumulativeReflection:constantWithCollisions}});
const firstPolyline=reflectionElement.innerHTML.match(/<polyline points="([^"]+)"/)?.[1]||'';
const ys=firstPolyline.split(' ').map(point=>Number(point.split(',')[1]));
assert.equal(new Set(ys).size,1,'equal reflection values must form a true horizontal straight line');

// Regression for the issue where the solid green series hid the blue one.
// Blue must be dashed and drawn LAST; the green line remains visible in dash gaps.
const reflectionSvgHtml=reflectionElement.innerHTML;
assert.deepEqual(axisNumbers(reflectionSvgHtml),[2,2.5,3,3.5,4],
  'reflection zoom must use the requested 2–4 axis with half-step grid');
const bluePath=reflectionSvgHtml.match(/<polyline points="([^"]+)"[^>]*stroke="#2774ee"[^>]*>/)?.[0]||'';
const greenPath=reflectionSvgHtml.match(/<polyline points="([^"]+)"[^>]*stroke="#20a567"[^>]*>/)?.[0]||'';
assert.match(bluePath,/stroke-dasharray="4 3"/,'blue must use a distinct dashed stroke');
assert.match(greenPath,/stroke-width="1.45"/,'green must use a thin solid stroke');
assert.ok(reflectionSvgHtml.indexOf(greenPath)<reflectionSvgHtml.indexOf(bluePath),
  'blue line must be drawn above green');
assert.match(reflectionSvgHtml,/線は実測値、近接時はマーカーのみ左右に分離/);
const closeRows=[
  reflectionTestRow('2026-10-01',true,2.81,2.82,2.45),
  reflectionTestRow('2026-10-02',true,2.83,2.83,2.46),
  reflectionTestRow('2026-10-03',true,2.84,2.85,2.49),
];
browser.window.renderDashboard({charts:{lessonCumulativeReflection:closeRows}});
const closeSvg=reflectionElement.innerHTML;
assert.match(closeSvg,/data-series="reflection_understood" data-mean="2.81" data-visual-offset-x="-3" transform="translate\(-3 0\)"/);
assert.match(closeSvg,/data-series="reflection_conveyed" data-mean="2.82" data-visual-offset-x="3" transform="translate\(3 0\)"/);
assert.match(closeSvg,/平均 2.81/,'tooltip must report unmodified mean');
assert.match(closeSvg,/平均 2.82/,'tooltip must report unmodified mean');
// The collision algorithm must not move any line vertex or introduce zigzags.
for(const path of [...closeSvg.matchAll(/<polyline points="([^"]+)"[^>]*stroke="#(?:2774ee|20a567)"/g)]){
  const xs=path[1].split(' ').map(point=>Number(point.split(',')[0]));
  assert.deepEqual(xs,[56,250.5,445],'near-equal lines must remain anchored to exact dates');
}
const lowRows=[reflectionTestRow('2026-10-04',true,1.88,2.15,2.23)];
browser.window.renderDashboard({charts:{lessonCumulativeReflection:lowRows}});
assert.deepEqual(axisNumbers(reflectionElement.innerHTML),[1,1.5,2,2.5,3,3.5,4],
  'below-2 observed research values must never be clipped');
assert.match(reflectionElement.innerHTML,/2未満の実測値を含むため縦軸1～4/);

assert.doesNotMatch(productionHtml,/id="researchReflectionChartPolish"/,
  'production response must not load the old reflection postprocessing script');


// Date-axis collision regression: keep first/last date legible as the set grows.
// This tests the actual 460-unit SVG coordinate system and all three production charts.
const dateTickSelector: (dates:string[], x:(i:number)=>number, max:number, size:number)=>number[] =
  runInNewContext(RESEARCH_DATE_TICK_BROWSER_SCRIPT+'\nselectResearchDateTicks', {});
const makeDates=(count:number)=>Array.from({length:count},(_,i)=>
  new Date(Date.UTC(2026,8,17)+i*86400000).toISOString().slice(0,10));
for(const n of [0,1,2,7,14,22,23,30,60,120]){
  const dates=makeDates(n), x=(i:number)=>56+(n<2?389/2:i*389/(n-1));
  const indices=dateTickSelector(dates,x,7,10);
  if(!n){assert.deepEqual(Array.from(indices),[]);continue}
  assert.equal(indices[0],0,'date axis first tick must survive ('+n+')');
  assert.equal(indices.at(-1),n-1,'date axis final tick must survive ('+n+')');
  for(let i=1;i<indices.length;i++){
    const a=indices[i-1],b=indices[i];
    const width=(idx:number)=>Math.max(20,dates[idx].slice(5).length*10*.75);
    assert.ok(x(b)-x(a)>=(width(a)+width(b))/2+8-1e-6,
      'date labels collide for '+n+' days at ticks '+a+' and '+b);
  }
}
const readDateLabels=(html:string)=>{
  const re=/<text x="([^"]+)" y="[^"]+" text-anchor="middle" class="(?:unified-line-axis|svg-label)"[^>]*>(\d\d-\d\d)<\/text>/g;
  return [...html.matchAll(re)].map(match=>({x:Number(match[1]),label:match[2]}));
};
function assertDateLabels(html:string,dates:string[],fontSize:number,description:string){
  const labels=readDateLabels(html);
  assert.ok(labels.length>=2,description+' must display at least first and last dates');
  assert.equal(labels[0].label,dates[0].slice(5),description+' first date');
  assert.equal(labels.at(-1)?.label,dates.at(-1)?.slice(5),description+' final date');
  for(let i=1;i<labels.length;i++){
    const a=labels[i-1],b=labels[i];
    const required=(a.label.length+b.label.length)*fontSize*.75/2+8;
    assert.ok(b.x-a.x>=required-1e-6,description+' overlaps '+a.label+' and '+b.label);
  }
}
for(const n of [23,60]){
  const dates=makeDates(n);
  const points=dates.map((date,i)=>({date,value:8+i*.03,n:1,observed:i%3===0||i===n-1}));
  const series=[{class_id:'5-1',label:'5年1組',school_condition:'intervention',points}];
  const reflections=dates.map(date=>reflectionTestRow(date,true,2.5,2.7,2.6));
  browser.window.renderDashboard({charts:{
    cumulativeTurnsByClass:series,
    cumulativeWordsByClass:series,
    lessonCumulativeReflection:reflections,
  }});
  assertDateLabels(turnElement.innerHTML,dates,10,'turn/min '+n);
  assertDateLabels(wordElement.innerHTML,dates,10,'word/min '+n);
  assertDateLabels(reflectionElement.innerHTML,dates,10,'reflection '+n);
  const realPointCount=points.filter(p=>p.observed).length;
  for(const html of [turnElement.innerHTML,wordElement.innerHTML]){
    const path=html.match(/<polyline points="([^"]+)"/)?.[1]||'';
    assert.equal(path.split(' ').length,realPointCount,'date label thinning must never remove actual observations');
  }
}
// The daily class-stack renderer is still responsible for BAR CHARTS ONLY.
const dailyScript=productionHtml.match(/<script id="researchDailyClassStack">([\s\S]*?)<\/script>/)?.[1];
assert.ok(dailyScript,'daily bar renderer must remain present');
const turnsSentinel={innerHTML:'TURN_CHART_UNTOUCHED'};
const dailyChart={innerHTML:'',closest:()=>null};
const dailyBrowser:any={
  window:{__researchDashboardUnifiedChartsV2:false},
  document:{getElementById(id:string){
    if(id==='chartTurns')return turnsSentinel;
    if(id==='chartDaily')return dailyChart;
    return null;
  }},
  renderDashboard(){},
};
runInNewContext(dailyScript,dailyBrowser);
const longDates=makeDates(23);
dailyBrowser.window.renderDashboard({charts:{
  dailyClassStack:[{date:longDates.at(-1),sessions:1,by_class:[{class_id:'5-1',label:'5年1組',sessions:1,share_percent:100}]}],
  dailyClassLegend:[{class_id:'5-1',label:'5年1組'}],
  cumulativeTurnsByClass:sparseSeries,
}});
assert.equal(turnsSentinel.innerHTML,'TURN_CHART_UNTOUCHED','daily session renderer must not overwrite turn trend, even when unified flag is absent');
assert.match(dailyChart.innerHTML,/daily-class-stack-chart/,'daily stacked bars must remain operational');
const managementHtml=managementPageHtml();
assert.doesNotMatch(managementHtml,/function aiReflectionLineSvg\(/);
assert.doesNotMatch(managementHtml,/function cumulativeWordsLineSvg\(/);

console.log('Research dashboard chart unification QA: PASS');
