import type { RequestHandler } from 'express';

function injectResearchDashboardChartUnification(html: string): string {
  if (!html.includes('id="chartTurns"') || html.includes('researchDashboardChartUnification')) return html;

  const style = `<style id="researchDashboardChartUnificationStyle">
.research-chart-left-stack{display:grid;grid-template-rows:minmax(0,1fr) minmax(0,1fr);gap:14px;min-width:0;align-self:stretch}.research-chart-left-stack>.chart-card{min-height:0;height:100%}.research-chart-left-stack .unified-daily-card{display:flex;flex-direction:column}.research-chart-left-stack .unified-daily-card #chartDaily{flex:1 1 auto;min-height:0}.research-turns-card{display:flex;flex-direction:column}.research-turns-card #chartTurns{flex:1 1 auto;min-height:0}.unified-line-chart svg{display:block;min-width:460px;width:100%;height:100%}.research-turns-card h3{margin:0 0 12px;font-size:18px}.unified-line-chart text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif}.unified-line-axis{font-size:10px;fill:#425878;font-weight:700}.unified-line-legend{font-size:10px;fill:#10224a;font-weight:800}.unified-line-note{font-size:9px;fill:#64748b;font-weight:700}@media(max-width:760px){.research-chart-left-stack{grid-template-rows:auto auto}.research-chart-left-stack>.chart-card{min-height:390px;height:auto}.unified-line-chart svg{min-width:460px}}
</style>`;

  const script = `<script id="researchDashboardChartUnification">
(function(){
  var W=460,H=245,LEFT=56,RIGHT=15,BOTTOM=43,LINE_WIDTH=1.6;
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]})}
  function valid(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))}
  function niceStep(range){
    var target=Math.max(.1,range/4),power=Math.pow(10,Math.floor(Math.log10(target))),scaled=target/power;
    var factor=scaled<=1?1:scaled<=2?2:scaled<=2.5?2.5:scaled<=5?5:10;
    return factor*power;
  }
  function conditionColors(condition){
    return condition==='comparison'
      ? ['#f59e0b']
      : ['#1d4ed8','#2563eb','#3b82f6','#60a5fa','#1e40af','#93c5fd'];
  }
  function classShape(classId){
    var m=String(classId||'').match(/(?:C)?([1-9])$/i),n=m?Number(m[1]):1;
    return n%3===2?'square':n%3===0?'diamond':'circle';
  }
  function marker(shape,cx,cy,color,title){
    var t=title?'<title>'+esc(title)+'</title>':'';
    if(shape==='square')return '<g>'+t+'<rect x="'+(cx-3.2)+'" y="'+(cy-3.2)+'" width="6.4" height="6.4" rx="0.8" fill="#fff" stroke="'+color+'" stroke-width="1.8"/></g>';
    if(shape==='diamond')return '<g>'+t+'<polygon points="'+cx+','+(cy-4)+' '+(cx+4)+','+cy+' '+cx+','+(cy+4)+' '+(cx-4)+','+cy+'" fill="#fff" stroke="'+color+'" stroke-width="1.8"/></g>';
    return '<g>'+t+'<circle cx="'+cx+'" cy="'+cy+'" r="3.2" fill="#fff" stroke="'+color+'" stroke-width="1.8"/></g>';
  }
  function classSeriesSvg(series,unit,aria,note){
    var list=(Array.isArray(series)?series:[]).filter(function(s){return Array.isArray(s.points)&&s.points.some(function(p){return valid(p.value)})});
    var w=W,h=H,left=LEFT,right=RIGHT,bottom=BOTTOM;
    if(!list.length)return '<svg viewBox="0 0 '+w+' '+h+'" width="100%" height="100%" role="img" aria-label="'+esc(aria)+'"><text x="230" y="122" text-anchor="middle" class="unified-line-axis">データなし</text></svg>';
    var dates=[];list.forEach(function(s){s.points.forEach(function(p){if(dates.indexOf(p.date)<0)dates.push(p.date)})});dates.sort();
    var values=[];list.forEach(function(s){s.points.forEach(function(p){if(valid(p.value))values.push(Number(p.value))})});
    var rawMin=Math.min.apply(null,values),rawMax=Math.max.apply(null,values),rawRange=Math.max(0,rawMax-rawMin);
    var desiredSpan=Math.max(.8,rawRange*1.28),center=(rawMin+rawMax)/2,axisMin=Math.max(0,center-desiredSpan/2),axisMax=axisMin+desiredSpan;
    if(axisMax<rawMax){axisMax=rawMax;axisMin=Math.max(0,axisMax-desiredSpan)}
    var step=niceStep(axisMax-axisMin),pad=Math.max(step*.6,(axisMax-axisMin)*.06);
    axisMin=Math.max(0,Math.floor((axisMin-pad)/step)*step);axisMax=Math.ceil((axisMax+pad)/step)*step;
    if(axisMax-axisMin<.8)axisMax=axisMin+Math.ceil(.8/step)*step;
    var legendRows=Math.ceil(list.length/3),top=18+legendRows*18,plotH=h-top-bottom,plotW=w-left-right;
    var x=function(date){var i=dates.indexOf(date);return left+(dates.length<=1?plotW/2:i*plotW/(dates.length-1))};
    var y=function(v){return top+plotH-(Number(v)-axisMin)*plotH/(axisMax-axisMin||1)};
    var fmt=function(v){return Math.abs(v-Math.round(v))<1e-9?String(Math.round(v)):String(Math.round(v*10)/10)};
    var out='<svg viewBox="0 0 '+w+' '+h+'" width="100%" height="100%" role="img" aria-label="'+esc(aria)+'">';
    for(var tick=axisMin,guard=0;tick<=axisMax+step*.001&&guard<10;tick+=step,guard+=1){var yy=y(tick);out+='<line x1="'+left+'" y1="'+yy+'" x2="'+(left+plotW)+'" y2="'+yy+'" stroke="#dfe7f2" stroke-width="1"/><text x="'+(left-17)+'" y="'+(yy+4)+'" text-anchor="middle" class="unified-line-axis">'+esc(fmt(tick))+'</text>'}
    var every=Math.max(1,Math.ceil(dates.length/7));dates.forEach(function(date,i){if(i%every===0||i===dates.length-1)out+='<text x="'+x(date)+'" y="'+(h-19)+'" text-anchor="middle" class="unified-line-axis">'+esc(String(date).slice(5))+'</text>'});
    var counts={intervention:0,comparison:0,unknown:0};
    list.forEach(function(s,si){
      var isComparison=s.school_condition==='comparison'||/^[1-9]-C[1-9]$/i.test(String(s.class_id||'')),condition=isComparison?'comparison':'intervention',palette=conditionColors(condition),color=palette[counts[condition]++%palette.length],shape=classShape(s.class_id),points=[];
      (s.points||[]).forEach(function(p){if(valid(p.value)&&p.observed!==false)points.push(x(p.date)+','+y(Number(p.value)))});
      if(points.length>1)out+='<polyline points="'+points.join(' ')+'" fill="none" stroke="'+color+'" stroke-width="'+LINE_WIDTH+'" stroke-linecap="round" stroke-linejoin="round"/>';
      (s.points||[]).forEach(function(p){if(!valid(p.value)||p.observed===false)return;var title=String(p.date||'')+' '+String(s.label||s.class_id||'')+': '+fmt(Number(p.value))+' '+unit+' (n='+Number(p.n||0)+')';out+=marker(shape,x(p.date),y(Number(p.value)),color,title)});
      var col=si%3,row=Math.floor(si/3),lx=left+col*132,ly=12+row*18;
      out+='<line x1="'+lx+'" y1="'+ly+'" x2="'+(lx+16)+'" y2="'+ly+'" stroke="'+color+'" stroke-width="'+LINE_WIDTH+'" stroke-linecap="round"/>'+marker(shape,lx+8,ly,color,'')+'<text x="'+(lx+21)+'" y="'+(ly+4)+'" class="unified-line-legend">'+esc(s.label||s.class_id||'')+'</text>';
    });
    out+='<text x="'+left+'" y="'+(h-3)+'" class="unified-line-note">'+esc(note)+'</text>';
    return out+'</svg>';
  }
  function reflectionSvg(rows){
    rows=Array.isArray(rows)?rows:[];
    var series=[
      {key:'reflection_understood',n:'reflection_understood_n',observed:'reflection_understood_observed',label:'相手の話を聞いて分かる',color:'#2774ee',shape:'circle',legendX:56,legendY:12},
      {key:'reflection_conveyed',n:'reflection_conveyed_n',observed:'reflection_conveyed_observed',label:'自分の考えを伝える',color:'#20a567',shape:'square',legendX:245,legendY:12},
      {key:'reflection_culture',n:'reflection_culture_n',observed:'reflection_culture_observed',label:'新しい言葉や文化に気づいた',color:'#f59e0b',shape:'diamond',legendX:56,legendY:30}
    ];
    var has=rows.some(function(r){return series.some(function(s){return valid(r[s.key])})});
    var w=W,h=H,left=LEFT,right=RIGHT,bottom=BOTTOM,top=48,plotW=w-left-right,plotH=h-top-bottom;
    var out='<svg viewBox="0 0 '+w+' '+h+'" width="100%" height="100%" role="img" aria-label="AI対話ふりかえり平均 4件法">';
    if(!rows.length||!has)return out+'<text x="230" y="122" text-anchor="middle" class="unified-line-axis">データなし</text></svg>';
    var x=function(i){return left+(rows.length<=1?plotW/2:i*plotW/(rows.length-1))},y=function(v){return top+plotH-(Number(v)-1)*plotH/3};
    var offsets=function(r){var result=[0,0,0],groups={};series.forEach(function(s,si){if(!valid(r[s.key]))return;var key=Number(r[s.key]).toFixed(6);(groups[key]||(groups[key]=[])).push(si)});Object.keys(groups).forEach(function(key){var group=groups[key];if(group.length===2){result[group[0]]=-2.5;result[group[1]]=2.5}else if(group.length>=3){result[group[0]]=-3.5;result[group[1]]=0;result[group[2]]=3.5}});return result};
    [1,2,3,4].forEach(function(tick){var yy=y(tick);out+='<line x1="'+left+'" y1="'+yy+'" x2="'+(left+plotW)+'" y2="'+yy+'" stroke="#dfe7f2" stroke-width="1"/><text x="'+(left-17)+'" y="'+(yy+4)+'" text-anchor="middle" class="unified-line-axis">'+tick+'</text>'});
    var every=Math.max(1,Math.ceil(rows.length/7));rows.forEach(function(r,i){if(i%every===0||i===rows.length-1)out+='<text x="'+x(i)+'" y="'+(h-19)+'" text-anchor="middle" class="unified-line-axis">'+esc(String(r.date||'').slice(5))+'</text>'});
    series.forEach(function(item,si){
      var points=[];rows.forEach(function(r,i){if(valid(r[item.key])&&r[item.observed]!==false){var off=offsets(r)[si];points.push(x(i)+','+(y(Number(r[item.key]))+off))}});
      if(points.length>1)out+='<polyline points="'+points.join(' ')+'" fill="none" stroke="'+item.color+'" stroke-width="'+LINE_WIDTH+'" stroke-linecap="round" stroke-linejoin="round"/>';
      rows.forEach(function(r,i){if(!valid(r[item.key])||r[item.observed]===false)return;var off=offsets(r)[si],value=Math.round(Number(r[item.key])*100)/100,count=Number(r[item.n]||0),title=String(r.date||'')+' '+item.label+': 平均 '+value+' (n='+count+')';out+=marker(item.shape,x(i),y(Number(r[item.key]))+off,item.color,title)});
      out+='<line x1="'+item.legendX+'" y1="'+item.legendY+'" x2="'+(item.legendX+16)+'" y2="'+item.legendY+'" stroke="'+item.color+'" stroke-width="'+LINE_WIDTH+'" stroke-linecap="round"/>'+marker(item.shape,item.legendX+8,item.legendY,item.color,'')+'<text x="'+(item.legendX+21)+'" y="'+(item.legendY+4)+'" class="unified-line-legend">'+esc(item.label)+'</text>';
    });
    out+='<text x="'+left+'" y="'+(h-3)+'" class="unified-line-note">4件法｜授業内のみ｜累積平均（セッション単位）｜授業外利用は除外</text>';
    return out+'</svg>';
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
    if(turns&&Array.isArray(charts.cumulativeTurnsByClass))turns.innerHTML=classSeriesSvg(charts.cumulativeTurnsByClass,'ターン/分','1分あたり平均ターン数学級別累積平均','授業内のみ｜累積平均（セッション単位）｜授業外利用は除外｜ターン＝児童＋AI発話｜実践校＝青系・比較校＝緑系');
    var words=document.getElementById('chartWords');
    if(words&&Array.isArray(charts.cumulativeWordsByClass))words.innerHTML=classSeriesSvg(charts.cumulativeWordsByClass,'語/分','1分あたり平均発話語数学級別累積平均','授業内のみ｜累積平均（セッション単位）｜授業外利用は除外｜実践校＝青系・比較校＝緑系');
    var wordsTitle=document.getElementById('chartWordsTitle');if(wordsTitle)wordsTitle.textContent='1分あたり平均発話語数（学級別・累積平均・日別）';
    var reflection=document.getElementById('chartReflection');var cumulative=charts.lessonCumulativeReflection||charts.cumulativeDaily||charts.daily||[];
    if(reflection)reflection.innerHTML=reflectionSvg(cumulative);
  }
  ensureSeparateCards();
  var previousRenderDashboard=renderDashboard;
  renderDashboard=function(d,appliedQuery){previousRenderDashboard(d,appliedQuery);renderUnified(d)};
  window.renderDashboard=renderDashboard;
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
