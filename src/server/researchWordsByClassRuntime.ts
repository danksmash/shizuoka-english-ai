import type { RequestHandler } from 'express';
import {
  buildResearchExportDataSets,
  filterResearchSessionRows,
  type ResearchFilterQuery,
} from './researchDashboard';
import {
  filterSessionsForStudyPhase,
  normalizeStudyPhaseFilter,
} from './researchPhaseRuntime';

type Row = Record<string, unknown>;
type PhaseAwareQuery = ResearchFilterQuery & { studyPhase?: unknown };

type ClassWordsPoint = {
  date: string;
  value: number | null;
  n: number;
};

type ClassWordsSeries = {
  class_id: string;
  label: string;
  school_condition: 'intervention' | 'comparison' | 'unknown';
  points: ClassWordsPoint[];
};

function researchClassLabel(classId: unknown): string {
  const value = String(classId || '').trim();
  if (!value || value === 'unknown') return '学級不明';
  const intervention = value.match(/^([1-9])-([1-9])$/);
  if (intervention) return `${intervention[1]}年${intervention[2]}組`;
  const comparison = value.match(/^([1-9])-C([1-9])$/i);
  if (comparison) return `${comparison[1]}年比較${comparison[2]}組`;
  return value;
}

function classSortTuple(classId: string): [number, number, number, string] {
  if (classId === 'unknown') return [999, 999, 999, classId];
  const intervention = classId.match(/^([1-9])-([1-9])$/);
  if (intervention) return [Number(intervention[1]), 0, Number(intervention[2]), classId];
  const comparison = classId.match(/^([1-9])-C([1-9])$/i);
  if (comparison) return [Number(comparison[1]), 1, Number(comparison[2]), classId];
  return [900, 0, 0, classId];
}

function compareClassIds(a: string, b: string): number {
  const aa = classSortTuple(a);
  const bb = classSortTuple(b);
  for (let index = 0; index < 3; index += 1) {
    if (aa[index] !== bb[index]) return Number(aa[index]) - Number(bb[index]);
  }
  return String(aa[3]).localeCompare(String(bb[3]), 'ja');
}

function sessionWordsPerMinute(row: Row): number | null {
  const words = Number(row.child_total_words);
  const seconds = Number(row.actual_duration_seconds);
  const childTurns = Number(row.child_turn_count);
  if (!Number.isFinite(words) || words < 0) return null;
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  if (!Number.isFinite(childTurns) || childTurns <= 0) return null;
  return words * 60 / seconds;
}

function normalizeSchoolCondition(value: unknown): 'intervention' | 'comparison' | 'unknown' {
  const normalized = String(value || '').trim();
  if (normalized === 'intervention' || normalized === 'comparison') return normalized;
  return 'unknown';
}

export function buildCumulativeWordsByClass(sessions: Row[]): ClassWordsSeries[] {
  const validSessions = sessions
    .map((row) => ({
      row,
      classId: String(row.class_id || '').trim() || 'unknown',
      date: String(row.local_date || '').trim(),
      wpm: sessionWordsPerMinute(row),
    }))
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date) && item.wpm !== null);

  const dates = [...new Set(validSessions.map((item) => item.date))].sort();
  const classIds = [...new Set(validSessions.map((item) => item.classId))].sort(compareClassIds);

  return classIds.map((classId) => {
    const classRows = validSessions.filter((item) => item.classId === classId);
    const condition = normalizeSchoolCondition(classRows.find((item) => item.row.school_condition)?.row.school_condition);
    let sum = 0;
    let n = 0;
    const points = dates.map((date) => {
      for (const item of classRows) {
        if (item.date !== date || item.wpm === null) continue;
        sum += item.wpm;
        n += 1;
      }
      return {
        date,
        value: n > 0 ? Math.round((sum / n) * 100) / 100 : null,
        n,
      };
    });
    return {
      class_id: classId,
      label: researchClassLabel(classId),
      school_condition: condition,
      points,
    };
  });
}

function dashboardFilteredExportSessions(req: any, res: any): Row[] | null {
  const query = req.query as PhaseAwareQuery;
  const studyPhase = normalizeStudyPhaseFilter(query.studyPhase);
  const prepared = res.locals.researchDashboardExportSessions;

  let exportSessions: Row[] | null = null;
  if (!studyPhase && Array.isArray(prepared)) {
    exportSessions = prepared as Row[];
  } else {
    const rawSessions = res.locals.researchDashboardSessions;
    const schedules = res.locals.researchDashboardSchedules;
    if (!Array.isArray(rawSessions) || !Array.isArray(schedules)) return null;
    const phaseSessions = filterSessionsForStudyPhase(rawSessions, schedules, studyPhase);
    exportSessions = buildResearchExportDataSets(phaseSessions).sessions;
  }
  return filterResearchSessionRows(exportSessions, query);
}

function enhanceDashboardJson(req: any, res: any, body: any): any {
  if (!body || body.success === false || !body.charts) return body;
  const sessions = dashboardFilteredExportSessions(req, res);
  if (!sessions) return body;
  return {
    ...body,
    charts: {
      ...body.charts,
      cumulativeWordsByClass: buildCumulativeWordsByClass(sessions),
    },
  };
}

function injectWordsByClassChart(html: string): string {
  if (!html.includes('id="chartWords"') || html.includes('researchWordsByClassRuntime')) return html;

  const script = `<script id="researchWordsByClassRuntime">
(function(){
  function escapeHtml(value){return String(value==null?'':value).replace(/[&<>\"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]})}
  function valid(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))}
  function conditionColors(condition){
    return condition==='comparison'
      ? ['#047857','#059669','#10b981','#34d399','#065f46','#6ee7b7']
      : ['#1d4ed8','#2563eb','#3b82f6','#60a5fa','#1e40af','#93c5fd'];
  }
  function shapeForClassId(classId){
    var m=String(classId||'').match(/(?:C)?([1-9])$/i),n=m?Number(m[1]):1;
    return n%3===2?'square':n%3===0?'diamond':'circle';
  }
  function marker(shape,cx,cy,color,title){
    var t=title?'<title>'+escapeHtml(title)+'</title>':'';
    if(shape==='square')return '<g>'+t+'<rect x="'+(cx-3.4)+'" y="'+(cy-3.4)+'" width="6.8" height="6.8" rx="0.8" fill="#fff" stroke="'+color+'" stroke-width="1.5"/></g>';
    if(shape==='diamond')return '<g>'+t+'<polygon points="'+cx+','+(cy-4.2)+' '+(cx+4.2)+','+cy+' '+cx+','+(cy+4.2)+' '+(cx-4.2)+','+cy+'" fill="#fff" stroke="'+color+'" stroke-width="1.5"/></g>';
    return '<g>'+t+'<circle cx="'+cx+'" cy="'+cy+'" r="3.3" fill="#fff" stroke="'+color+'" stroke-width="1.5"/></g>';
  }
  function niceStep(range){
    var target=Math.max(.1,range/5),power=Math.pow(10,Math.floor(Math.log10(target))),scaled=target/power;
    var factor=scaled<=1?1:scaled<=2?2:scaled<=2.5?2.5:scaled<=5?5:10;
    return factor*power;
  }
  function wordsByClassSvg(series){
    var list=(Array.isArray(series)?series:[]).filter(function(s){return Array.isArray(s.points)&&s.points.some(function(p){return valid(p.value)})});
    var w=460,h=270,left=62,right=16,bottom=50;
    if(!list.length)return '<svg viewBox="0 0 '+w+' '+h+'" width="100%" height="100%"><text x="230" y="135" text-anchor="middle" class="svg-label">データなし</text></svg>';
    var dates=[];list.forEach(function(s){s.points.forEach(function(p){if(dates.indexOf(p.date)<0)dates.push(p.date)})});dates.sort();
    var values=[];list.forEach(function(s){s.points.forEach(function(p){if(valid(p.value))values.push(Number(p.value))})});
    var rawMin=Math.min.apply(null,values),rawMax=Math.max.apply(null,values),rawRange=Math.max(0,rawMax-rawMin);
    var desiredSpan=Math.max(.8,rawRange*1.28),center=(rawMin+rawMax)/2,axisMin=Math.max(0,center-desiredSpan/2),axisMax=axisMin+desiredSpan;
    if(axisMax<rawMax){axisMax=rawMax;axisMin=Math.max(0,axisMax-desiredSpan)}
    var step=niceStep(axisMax-axisMin),pad=Math.max(step*.6,(axisMax-axisMin)*.06);
    axisMin=Math.max(0,Math.floor((axisMin-pad)/step)*step);axisMax=Math.ceil((axisMax+pad)/step)*step;
    if(axisMax-axisMin<.8)axisMax=axisMin+Math.ceil(.8/step)*step;
    var legendRows=Math.ceil(list.length/3),top=24+legendRows*21,plotH=h-top-bottom,plotW=w-left-right;
    var x=function(date){var i=dates.indexOf(date);return left+(dates.length<=1?plotW/2:i*plotW/(dates.length-1))};
    var y=function(v){return top+plotH-(Number(v)-axisMin)*plotH/(axisMax-axisMin||1)};
    var fmt=function(v){return Math.abs(v-Math.round(v))<1e-9?String(Math.round(v)):String(Math.round(v*10)/10)};
    var out='<svg viewBox="0 0 '+w+' '+h+'" width="100%" height="100%" role="img" aria-label="1分あたり平均発話語数学級別累積平均">';
    for(var tick=axisMin,guard=0;tick<=axisMax+step*.001&&guard<12;tick+=step,guard+=1){var yy=y(tick);out+='<line x1="'+left+'" y1="'+yy+'" x2="'+(left+plotW)+'" y2="'+yy+'" stroke="#dfe7f2" stroke-width="1"/><text x="'+(left-18)+'" y="'+(yy+5)+'" text-anchor="middle" class="svg-label">'+escapeHtml(fmt(tick))+'</text>'}
    var every=Math.max(1,Math.ceil(dates.length/8));dates.forEach(function(date,i){if(i%every===0||i===dates.length-1)out+='<text x="'+x(date)+'" y="'+(h-24)+'" text-anchor="middle" class="svg-label">'+escapeHtml(String(date).slice(5))+'</text>'});
    var counts={intervention:0,comparison:0,unknown:0};
    list.forEach(function(s,si){
      var condition=s.school_condition==='comparison'?'comparison':'intervention',palette=conditionColors(condition),color=palette[counts[condition]++%palette.length],shape=shapeForClassId(s.class_id),points=[];
      (s.points||[]).forEach(function(p){if(valid(p.value))points.push(x(p.date)+','+y(Number(p.value)))});
      if(points.length>1)out+='<polyline points="'+points.join(' ')+'" fill="none" stroke="'+color+'" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>';
      (s.points||[]).forEach(function(p){if(!valid(p.value))return;var title=String(p.date||'')+' '+String(s.label||s.class_id||'')+': '+fmt(Number(p.value))+' 語/分 (n='+Number(p.n||0)+')';out+=marker(shape,x(p.date),y(Number(p.value)),color,title)});
      var col=si%3,row=Math.floor(si/3),lx=left+col*132,ly=15+row*21;
      out+='<line x1="'+lx+'" y1="'+ly+'" x2="'+(lx+18)+'" y2="'+ly+'" stroke="'+color+'" stroke-width="1.6" stroke-linecap="round"/>'+marker(shape,lx+9,ly,color,'')+'<text x="'+(lx+24)+'" y="'+(ly+4)+'" class="svg-label" style="font-size:11px;fill:#10224a">'+escapeHtml(s.label||s.class_id||'')+'</text>';
    });
    out+='<text x="'+left+'" y="'+(h-3)+'" class="svg-label" style="font-size:9.5px;fill:#64748b">各点＝当日までの学級別有効セッション累積平均｜実践校＝青系・比較校＝緑系</text>';
    return out+'</svg>';
  }
  var previousRenderDashboard=renderDashboard;
  renderDashboard=function(d,appliedQuery){
    previousRenderDashboard(d,appliedQuery);
    var charts=(d&&d.charts)||{},series=charts.cumulativeWordsByClass;
    if(!Array.isArray(series))return;
    var title=document.getElementById('chartWordsTitle'),chart=document.getElementById('chartWords');
    if(title)title.textContent='1分あたり平均発話語数（学級別・累積平均・日別）';
    if(chart)chart.innerHTML=wordsByClassSvg(series);
  };
  window.renderDashboard=renderDashboard;
})();
</script>`;

  return html.replace('</body>', `${script}</body>`);
}

export function withResearchWordsByClassRuntime(path: string, handler: RequestHandler): RequestHandler {
  if (path === '/management') {
    return (req, res, next) => {
      const originalSend = res.send.bind(res);
      (res as any).send = (body: any) => originalSend(typeof body === 'string' ? injectWordsByClassChart(body) : body);
      return handler(req, res, next);
    };
  }
  if (path === '/api/management/research.dashboard') {
    return (req, res, next) => {
      const originalJson = res.json.bind(res);
      (res as any).json = (body: any) => originalJson(enhanceDashboardJson(req, res, body));
      return handler(req, res, next);
    };
  }
  return handler;
}
