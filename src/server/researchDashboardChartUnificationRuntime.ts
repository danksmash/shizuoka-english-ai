import type { RequestHandler } from 'express';
import { RESEARCH_CLASS_PALETTE_BROWSER_SCRIPT } from './researchClassChartPalette';
import { RESEARCH_DATE_TICK_BROWSER_SCRIPT } from './researchChartDateTicks';

function injectResearchDashboardChartUnification(html: string): string {
  // The turns element is added by a separate middleware; do not gate this script on its injection timing.
  if (!html.includes('id="chartDaily"') || html.includes('id="researchDashboardChartUnification"')) return html;

  const style = `<style id="researchDashboardChartUnificationStyle">
.research-chart-left-stack{display:grid;grid-template-rows:minmax(0,1fr) minmax(0,1fr);gap:14px;min-width:0;align-self:stretch}.research-chart-left-stack>.chart-card{min-height:0;height:100%}.research-chart-left-stack .unified-daily-card{display:flex;flex-direction:column}.research-chart-left-stack .unified-daily-card #chartDaily{flex:1 1 auto;min-height:0}.research-turns-card{display:flex;flex-direction:column}.research-turns-card #chartTurns{flex:1 1 auto;min-height:0}.unified-line-chart{display:flex;flex-direction:column;align-items:stretch;gap:5px;overflow-x:auto;overflow-y:visible}.unified-line-chart svg{display:block;min-width:460px;width:100%;height:auto;flex:1 1 auto;min-height:0}.unified-line-footnote{flex:0 0 auto;min-width:460px;margin:0;padding:1px 2px 3px;font-size:11px;line-height:1.5;color:#64748b;font-weight:700;white-space:normal;overflow-wrap:anywhere}.research-chart-left-stack .chart-card h3,.charts>.chart-card h3{font-size:18px;line-height:1.35;margin:0 0 10px}.research-turns-card h3{margin:0 0 12px;font-size:18px}.unified-line-chart text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif}.unified-line-axis{font-size:10px;fill:#425878;font-weight:700}.unified-line-legend{font-size:11px;fill:#10224a;font-weight:800}@media(max-width:760px){.research-chart-left-stack{grid-template-rows:auto auto}.research-chart-left-stack>.chart-card{min-height:390px;height:auto}.unified-line-chart svg{min-width:460px}}
</style>`;

  const script = `<script id="researchDashboardChartUnification">
(function(){
  var W=460,H=245,LEFT=56,RIGHT=15,BOTTOM=43,LINE_WIDTH=1.6;
${RESEARCH_DATE_TICK_BROWSER_SCRIPT}
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]})}
  function valid(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))}
  function niceStep(range){
    var target=Math.max(.1,range/4),power=Math.pow(10,Math.floor(Math.log10(target))),scaled=target/power;
    var factor=scaled<=1?1:scaled<=2?2:scaled<=2.5?2.5:scaled<=5?5:10;
    return factor*power;
  }
  // Both line charts and the daily bars use one shared, ID-stable palette.
${RESEARCH_CLASS_PALETTE_BROWSER_SCRIPT}
  function classShape(classId){
    var id=String(classId||'').trim().toUpperCase();
    if(id==='5-1')return 'circle';
    if(id==='5-2')return 'square';
    if(id==='5-3')return 'triangle';
    if(id==='6-C1')return 'diamond';
    if(id==='6-C2')return 'cross';
    var m=id.match(/(?:C)?([1-9])$/i),n=m?Number(m[1]):1;
    return n%3===2?'square':n%3===0?'diamond':'circle';
  }
  function marker(shape,cx,cy,color,title){
    var t=title?'<title>'+esc(title)+'</title>':'';
    if(shape==='square')return '<g>'+t+'<rect x="'+(cx-3.2)+'" y="'+(cy-3.2)+'" width="6.4" height="6.4" rx="0.8" fill="#fff" stroke="'+color+'" stroke-width="1.8"/></g>';
    if(shape==='diamond')return '<g>'+t+'<polygon points="'+cx+','+(cy-4)+' '+(cx+4)+','+cy+' '+cx+','+(cy+4)+' '+(cx-4)+','+cy+'" fill="#fff" stroke="'+color+'" stroke-width="1.8"/></g>';
    if(shape==='triangle')return '<g>'+t+'<polygon points="'+cx+','+(cy-4.1)+' '+(cx+4.1)+','+(cy+3.5)+' '+(cx-4.1)+','+(cy+3.5)+'" fill="#fff" stroke="'+color+'" stroke-width="1.8"/></g>';
    if(shape==='cross')return '<g>'+t+'<path d="M'+(cx-3.7)+','+cy+' H'+(cx+3.7)+' M'+cx+','+(cy-3.7)+' V'+(cy+3.7)+'" fill="none" stroke="'+color+'" stroke-width="2.2" stroke-linecap="round"/></g>';
    return '<g>'+t+'<circle cx="'+cx+'" cy="'+cy+'" r="3.2" fill="#fff" stroke="'+color+'" stroke-width="1.8"/></g>';
  }
  function classSeriesSvg(series,unit,aria,note){
    var list=(Array.isArray(series)?series:[]).filter(function(s){return Array.isArray(s.points)&&s.points.some(function(p){return valid(p.value)})});
    var w=W,h=H,left=LEFT,right=RIGHT,bottom=BOTTOM;
    if(!list.length)return '<svg viewBox="0 0 '+w+' '+h+'" width="100%" height="100%" role="img" aria-label="'+esc(aria)+'"><text x="230" y="122" text-anchor="middle" class="unified-line-axis">データなし</text></svg><div class="unified-line-footnote" role="note">'+esc(note)+'</div>';
    var dates=[];list.forEach(function(s){s.points.forEach(function(p){if(dates.indexOf(p.date)<0)dates.push(p.date)})});dates.sort();
    var values=[];list.forEach(function(s){s.points.forEach(function(p){if(valid(p.value))values.push(Number(p.value))})});
    var rawMin=Math.min.apply(null,values),rawMax=Math.max.apply(null,values),rawRange=Math.max(0,rawMax-rawMin);
    var desiredSpan=Math.max(.8,rawRange*1.28),center=(rawMin+rawMax)/2,axisMin=Math.max(0,center-desiredSpan/2),axisMax=axisMin+desiredSpan;
    if(axisMax<rawMax){axisMax=rawMax;axisMin=Math.max(0,axisMax-desiredSpan)}
    var step=niceStep(axisMax-axisMin),pad=Math.max(step*.6,(axisMax-axisMin)*.06);
    axisMin=Math.max(0,Math.floor((axisMin-pad)/step)*step);axisMax=Math.ceil((axisMax+pad)/step)*step;
    if(axisMax-axisMin<.8)axisMax=axisMin+Math.ceil(.8/step)*step;
    // Word/min only: use a data-fitted y-axis so modest changes remain readable.
    // Keep the existing turn/min axis behavior and the measured values unchanged.
    if(unit==='語/分'){
      var wordRange=rawMax-rawMin,wordPad=Math.max(.2,wordRange*.05);
      step=niceStep((wordRange+wordPad*2)*.75);
      axisMin=Math.max(0,Math.floor((rawMin-wordPad)/step)*step);
      axisMax=Math.ceil((rawMax+wordPad)/step)*step;
      if(axisMax<=axisMin)axisMax=axisMin+step;
    }
    var legendRows=Math.ceil(list.length/3),top=18+legendRows*18,plotH=h-top-bottom,plotW=w-left-right;
    var x=function(date){var i=dates.indexOf(date);return left+(dates.length<=1?plotW/2:i*plotW/(dates.length-1))};
    var y=function(v){return top+plotH-(Number(v)-axisMin)*plotH/(axisMax-axisMin||1)};
    var fmt=function(v){return Math.abs(v-Math.round(v))<1e-9?String(Math.round(v)):String(Math.round(v*10)/10)};
    var out='<svg viewBox="0 0 '+w+' '+h+'" width="100%" height="100%" role="img" aria-label="'+esc(aria)+'">';
    for(var tick=axisMin,guard=0;tick<=axisMax+step*.001&&guard<10;tick+=step,guard+=1){var yy=y(tick);out+='<line x1="'+left+'" y1="'+yy+'" x2="'+(left+plotW)+'" y2="'+yy+'" stroke="#dfe7f2" stroke-width="1"/><text x="'+(left-17)+'" y="'+(yy+4)+'" text-anchor="middle" class="unified-line-axis">'+esc(unit==='語/分'?String(Math.round(tick*100)/100):fmt(tick))+'</text>'}
    selectResearchDateTicks(dates,function(i){return x(dates[i])},7,10).forEach(function(i){var date=dates[i];out+='<text x="'+x(date)+'" y="'+(h-19)+'" text-anchor="middle" class="unified-line-axis">'+esc(String(date).slice(5))+'</text>'});
    list.forEach(function(s,si){
      var isComparison=s.school_condition==='comparison'||/^[1-9]-C[1-9]$/i.test(String(s.class_id||'')),condition=isComparison?'comparison':'intervention',color=classColor(s.class_id,condition),shape=classShape(s.class_id),points=[];
      (s.points||[]).forEach(function(p){if(valid(p.value)&&p.observed!==false)points.push(x(p.date)+','+y(Number(p.value)))});
      if(points.length>1)out+='<polyline points="'+points.join(' ')+'" fill="none" stroke="'+color+'" stroke-width="'+LINE_WIDTH+'" stroke-linecap="round" stroke-linejoin="round"/>';
      (s.points||[]).forEach(function(p){if(!valid(p.value)||p.observed===false)return;var title=String(p.date||'')+' '+String(s.label||s.class_id||'')+': '+fmt(Number(p.value))+' '+unit+' (n='+Number(p.n||0)+')';out+=marker(shape,x(p.date),y(Number(p.value)),color,title)});
      var col=si%3,row=Math.floor(si/3),lx=left+col*132,ly=12+row*18;
      out+='<line x1="'+lx+'" y1="'+ly+'" x2="'+(lx+16)+'" y2="'+ly+'" stroke="'+color+'" stroke-width="'+LINE_WIDTH+'" stroke-linecap="round"/>'+marker(shape,lx+8,ly,color,'')+'<text x="'+(lx+21)+'" y="'+(ly+4)+'" class="unified-line-legend">'+esc(s.label||s.class_id||'')+'</text>';
    });
    return out+'</svg><div class="unified-line-footnote" role="note">'+esc(note)+'</div>';
  }
  function reflectionSvg(rows){
    rows=Array.isArray(rows)?rows:[];
    var series=[
      {key:'reflection_understood',n:'reflection_understood_n',observed:'reflection_understood_observed',label:'相手の話を聞いて分かる',color:'#2774ee',shape:'circle',legendX:56,legendY:12,dashed:true},
      {key:'reflection_conveyed',n:'reflection_conveyed_n',observed:'reflection_conveyed_observed',label:'自分の考えを伝える',color:'#20a567',shape:'square',legendX:245,legendY:12},
      {key:'reflection_culture',n:'reflection_culture_n',observed:'reflection_culture_observed',label:'新しい言葉や文化に気づいた',color:'#f59e0b',shape:'diamond',legendX:56,legendY:30}
    ];
    function observed(row,item){return valid(row[item.key])&&row[item.observed]!==false}
    var has=rows.some(function(r){return series.some(function(item){return observed(r,item)})});
    var w=W,h=H,left=LEFT,right=RIGHT,bottom=BOTTOM,top=48,plotW=w-left-right,plotH=h-top-bottom;
    var out='<svg viewBox="0 0 '+w+' '+h+'" width="100%" height="100%" role="img" aria-label="AI対話ふりかえり平均 4件法">';
    if(!rows.length||!has)return out+'<text x="230" y="122" text-anchor="middle" class="unified-line-axis">データなし</text></svg><div class="unified-line-footnote" role="note">4件法｜授業内のみ｜累積平均（セッション単位）｜授業外利用は除外</div>';
    // Zoom from 1–4 to 2–4. If observed ratings below 2 occur, expand to 1–4
    // instead of clipping research observations or changing the underlying data.
    var values=[];
    rows.forEach(function(r){series.forEach(function(item){if(observed(r,item))values.push(Number(r[item.key]))})});
    var axisMin=values.some(function(v){return v<2})?1:2;
    var x=function(i){return left+(rows.length<=1?plotW/2:i*plotW/(rows.length-1))};
    var y=function(v){return top+plotH-(Number(v)-axisMin)*plotH/(4-axisMin)};
    var ticks=axisMin===2?[2,2.5,3,3.5,4]:[1,1.5,2,2.5,3,3.5,4];
    ticks.forEach(function(tick){var yy=y(tick);out+='<line x1="'+left+'" y1="'+yy+'" x2="'+(left+plotW)+'" y2="'+yy+'" stroke="#dfe7f2" stroke-width="1"/><text x="'+(left-17)+'" y="'+(yy+4)+'" text-anchor="middle" class="unified-line-axis">'+tick+'</text>'});
    selectResearchDateTicks(rows.map(function(r){return r.date}),x,7,10).forEach(function(i){var r=rows[i];out+='<text x="'+x(i)+'" y="'+(h-19)+'" text-anchor="middle" class="unified-line-axis">'+esc(String(r.date||'').slice(5))+'</text>'});
    // Draw all polylines at exact data coordinates. The green solid line remains
    // visible in the gaps of the blue dashed line, even for identical values.
    // Blue is deliberately drawn last, so it cannot be hidden by green.
    var drawOrder=[series[1],series[2],series[0]];
    drawOrder.forEach(function(item){
      var points=[];
      rows.forEach(function(r,i){if(observed(r,item))points.push(x(i)+','+y(Number(r[item.key])))});
      if(points.length>1)out+='<polyline points="'+points.join(' ')+'" fill="none" stroke="'+item.color+'" stroke-width="'+(item.dashed?'1.35':'1.45')+'"'+(item.dashed?' stroke-dasharray="4 3"':'')+' stroke-linecap="round" stroke-linejoin="round"/>';
    });
    // Visual-only horizontal separation of POINT MARKERS when two or more
    // displayed series come within 7 SVG units. All line vertices and tooltip
    // means remain at their real coordinates, avoiding artificial zigzags.
    drawOrder.forEach(function(item){
      rows.forEach(function(r,i){
        if(!observed(r,item))return;
        var near=series.filter(function(other){return observed(r,other)&&Math.abs(y(Number(r[item.key]))-y(Number(r[other.key])))<7});
        var rank=near.indexOf(item),dx=near.length<2?0:(rank-(near.length-1)/2)*6;
        var value=Math.round(Number(r[item.key])*100)/100,count=Number(r[item.n]||0);
        var title=String(r.date||'')+' '+item.label+': 平均 '+value+' (n='+count+')';
        out+='<g class="reflection-point" data-series="'+esc(item.key)+'" data-mean="'+Number(r[item.key])+'" data-visual-offset-x="'+dx+'"'+(dx?' transform="translate('+dx+' 0)"':'')+'>'+marker(item.shape,x(i),y(Number(r[item.key])),item.color,title)+'</g>';
      });
    });
    series.forEach(function(item){
      out+='<line x1="'+item.legendX+'" y1="'+item.legendY+'" x2="'+(item.legendX+16)+'" y2="'+item.legendY+'" stroke="'+item.color+'" stroke-width="'+(item.dashed?'1.35':'1.45')+'"'+(item.dashed?' stroke-dasharray="4 3"':'')+' stroke-linecap="round"/>'+marker(item.shape,item.legendX+8,item.legendY,item.color,'')+'<text x="'+(item.legendX+21)+'" y="'+(item.legendY+4)+'" class="unified-line-legend">'+esc(item.label)+'</text>';
    });
    var scaleNote=axisMin===2?'縦軸2～4（0.5刻み）':'2未満の実測値を含むため縦軸1～4';
    return out+'</svg><div class="unified-line-footnote" role="note">4件法｜'+scaleNote+'｜授業内のみ｜累積平均（セッション単位）｜授業外利用は除外｜線は実測値、近接時はマーカーのみ左右に分離</div>';
  }
  function ensureSeparateCards(){
    var daily=document.getElementById('chartDaily'),turns=document.getElementById('chartTurns');
    if(!daily||!turns)return;
    var dailyCard=daily.closest&&daily.closest('.chart-card');
    if(!dailyCard)return;
    var charts=dailyCard.parentElement&&dailyCard.parentElement.classList.contains('research-chart-left-stack')?dailyCard.parentElement:dailyCard.parentElement;
    if(!charts)return;
    var leftStack=document.querySelector('.research-chart-left-stack');
    if(!leftStack){
      var root=dailyCard.parentElement;
      leftStack=document.createElement('div');
      leftStack.className='research-chart-left-stack';
      root.insertBefore(leftStack,dailyCard);
      leftStack.appendChild(dailyCard);
      var turnsTitle=document.getElementById('chartTurnsTitle');
      var divider=dailyCard.querySelector('.daily-turn-divider');
      if(divider)divider.remove();
      var turnsCard=document.createElement('div');
      turnsCard.className='card chart-card research-turns-card';
      if(turnsTitle){turnsTitle.className='';turnsCard.appendChild(turnsTitle)}
      turns.classList.add('unified-line-chart');
      turnsCard.appendChild(turns);
      leftStack.appendChild(turnsCard);
    }
    dailyCard.classList.remove('daily-class-stack-card');
    dailyCard.classList.add('unified-daily-card');
    turns.classList.add('unified-line-chart');
    var words=document.getElementById('chartWords'),reflection=document.getElementById('chartReflection');
    if(words)words.classList.add('unified-line-chart');
    if(reflection)reflection.classList.add('unified-line-chart');
  }
  function renderUnified(d){
    ensureSeparateCards();
    var charts=(d&&d.charts)||{};
    var turns=document.getElementById('chartTurns');
    if(turns&&Array.isArray(charts.cumulativeTurnsByClass))turns.innerHTML=classSeriesSvg(charts.cumulativeTurnsByClass,'ターン/分','1分あたり平均ターン数学級別累積平均','授業内のみ｜累積平均（セッション単位）｜授業外利用は除外｜ターン＝児童＋AI発話｜色＝学級別に固定');
    var words=document.getElementById('chartWords');
    if(words&&Array.isArray(charts.cumulativeWordsByClass))words.innerHTML=classSeriesSvg(charts.cumulativeWordsByClass,'語/分','1分あたり平均発話語数学級別累積平均','授業内のみ｜累積平均（セッション単位）｜授業外利用は除外｜色＝学級別に固定');
    var wordsTitle=document.getElementById('chartWordsTitle');if(wordsTitle)wordsTitle.textContent='1分あたり平均発話語数（学級別・累積平均・日別）';
    var reflection=document.getElementById('chartReflection');var cumulative=charts.lessonCumulativeReflection||charts.cumulativeDaily||charts.daily||[];
    if(reflection)reflection.innerHTML=reflectionSvg(cumulative);
  }
  window.__researchDashboardUnifiedChartsV2=true;
  ensureSeparateCards();
  var previousRenderDashboard=renderDashboard;
  renderDashboard=function(d,appliedQuery){previousRenderDashboard(d,appliedQuery);renderUnified(d)};
  window.renderDashboard=renderDashboard;
  // Session-cache restoration can finish before the injected chart scripts load.
  // Repaint only existing chart DOM from the same cached response: no network or data changes.
  if(typeof lastDashboard!=='undefined'&&lastDashboard&&lastDashboard.charts){
    renderUnified(lastDashboard);
  }
})();
</script>`;

  return html.replace('</body>', `${style}${script}</body>`);
}

export function withResearchDashboardChartUnification(path: string, handler: RequestHandler): RequestHandler {
  if (path !== '/management') return handler;
  return (req, res, next) => {
    const originalSend = res.send.bind(res);
    (res as any).send = (body: any) => originalSend(
      typeof body === 'string' ? injectResearchDashboardChartUnification(body) : body,
    );
    return handler(req, res, next);
  };
}
