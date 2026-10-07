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
type Aggregation = 'daily' | 'weekly';
type PhaseAwareQuery = ResearchFilterQuery & { studyPhase?: unknown };

export type DailyClassStackSegment = {
  class_id: string;
  label: string;
  sessions: number;
  share_percent: number;
};

export type DailyClassStackRow = {
  date: string;
  sessions: number;
  by_class: DailyClassStackSegment[];
};

export type DailyClassLegendItem = {
  class_id: string;
  label: string;
};

export type ClassTurnsPoint = {
  date: string;
  value: number | null;
  n: number;
};

export type ClassTurnsSeries = {
  class_id: string;
  label: string;
  points: ClassTurnsPoint[];
};

function weekStart(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  const offset = (parsed.getUTCDay() + 6) % 7;
  parsed.setUTCDate(parsed.getUTCDate() - offset);
  return parsed.toISOString().slice(0, 10);
}

export function researchClassLabel(classId: unknown): string {
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

export function buildDailyClassStackRows(
  sessions: Row[],
  aggregation: Aggregation = 'daily',
): { rows: DailyClassStackRow[]; legend: DailyClassLegendItem[] } {
  const buckets = new Map<string, Map<string, number>>();
  const classIds = new Set<string>();

  for (const row of sessions) {
    const localDate = String(row.local_date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) continue;
    const date = aggregation === 'weekly' ? weekStart(localDate) : localDate;
    const rawClassId = String(row.class_id || '').trim();
    const classId = rawClassId || 'unknown';
    classIds.add(classId);
    const byClass = buckets.get(date) || new Map<string, number>();
    byClass.set(classId, (byClass.get(classId) || 0) + 1);
    buckets.set(date, byClass);
  }

  const orderedClassIds = [...classIds].sort(compareClassIds);
  const rows = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, byClass]) => {
      const total = [...byClass.values()].reduce((sum, value) => sum + value, 0);
      const segments = orderedClassIds
        .map((classId) => ({ classId, count: byClass.get(classId) || 0 }))
        .filter((item) => item.count > 0)
        .map((item) => ({
          class_id: item.classId,
          label: researchClassLabel(item.classId),
          sessions: item.count,
          share_percent: total > 0 ? Math.round((item.count * 1000) / total) / 10 : 0,
        }));
      return { date, sessions: total, by_class: segments };
    });

  return {
    rows,
    legend: orderedClassIds.map((classId) => ({
      class_id: classId,
      label: researchClassLabel(classId),
    })),
  };
}

function explicitNonNegative(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function sessionDialogueTurns(row: Row): number | null {
  const utteranceCount = explicitNonNegative(row.dialogue_utterance_count);
  if (utteranceCount !== null && utteranceCount > 0) return utteranceCount;

  const childTurns = explicitNonNegative(row.child_turn_count);
  const aiTurns = explicitNonNegative(row.ai_turn_count);
  if (childTurns !== null && aiTurns !== null && childTurns + aiTurns > 0) {
    return childTurns + aiTurns;
  }
  return null;
}

function sessionTurnsPerMinute(row: Row): number | null {
  const turns = sessionDialogueTurns(row);
  const seconds = Number(row.actual_duration_seconds);
  if (turns === null) return null;
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return turns * 60 / seconds;
}

export function buildCumulativeTurnsByClass(sessions: Row[]): ClassTurnsSeries[] {
  const validSessions = sessions
    .map((row) => ({
      row,
      classId: String(row.class_id || '').trim() || 'unknown',
      date: String(row.local_date || '').trim(),
      turnsPerMinute: sessionTurnsPerMinute(row),
    }))
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date) && item.turnsPerMinute !== null);

  const dates = [...new Set(validSessions.map((item) => item.date))].sort();
  const classIds = [...new Set(validSessions.map((item) => item.classId))].sort(compareClassIds);

  return classIds.map((classId) => {
    const classRows = validSessions.filter((item) => item.classId === classId);
    let sum = 0;
    let n = 0;
    const points = dates.map((date) => {
      for (const item of classRows) {
        if (item.date !== date || item.turnsPerMinute === null) continue;
        sum += item.turnsPerMinute;
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
      points,
    };
  });
}

function totalsMatchExistingChart(stackRows: DailyClassStackRow[], existingRows: any[]): boolean {
  const expected = new Map<string, number>();
  for (const row of existingRows || []) {
    const date = String(row?.date || '');
    const sessions = Number(row?.sessions);
    if (date && Number.isFinite(sessions)) expected.set(date, sessions);
  }
  if (expected.size !== stackRows.length) return false;
  return stackRows.every((row) => expected.get(row.date) === row.sessions);
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
  const filteredSessions = dashboardFilteredExportSessions(req, res);
  if (!filteredSessions) return body;

  // This combined card is deliberately daily even when other dashboard charts
  // switch to weekly aggregation for a long date span.
  const stack = buildDailyClassStackRows(filteredSessions, 'daily');
  const dashboardAggregation: Aggregation = body.charts.aggregation === 'weekly' ? 'weekly' : 'daily';

  if (dashboardAggregation === 'daily') {
    const existingRows = Array.isArray(body.charts.daily) ? body.charts.daily : [];
    const totalsMatch = totalsMatchExistingChart(stack.rows, existingRows);
    if (!totalsMatch) {
      console.error('Research daily class stack total mismatch', {
        stackRows: stack.rows.map((row) => ({ date: row.date, sessions: row.sessions })),
        dashboardRows: existingRows.map((row: any) => ({ date: row?.date, sessions: row?.sessions })),
      });
      return {
        ...body,
        dashboardWarnings: [
          ...(Array.isArray(body.dashboardWarnings) ? body.dashboardWarnings : []),
          'daily_class_stack_total_mismatch',
        ],
      };
    }
  }

  return {
    ...body,
    charts: {
      ...body.charts,
      dailyClassStack: stack.rows,
      dailyClassLegend: stack.legend,
      cumulativeTurnsByClass: buildCumulativeTurnsByClass(filteredSessions),
      dailyClassStackMatchesTotal: dashboardAggregation === 'daily' ? true : null,
    },
  };
}

function injectResearchDailyClassStack(html: string): string {
  if (!html.includes('id="chartDaily"') || html.includes('researchDailyClassStack')) return html;

  const chartDailyMarkup = '<div id="chartDaily" class="chart"></div>';
  const combinedMarkup = `<div id="dailySessionRangeControls" class="daily-range-controls" role="group" aria-label="日別表示期間">
<button type="button" data-daily-range="7">7日</button>
<button type="button" data-daily-range="14" class="is-active">14日</button>
<button type="button" data-daily-range="30">30日</button>
<button type="button" data-daily-range="all">全期間</button>
</div>
<div id="chartDaily" class="chart"></div>
<div class="daily-turn-divider" aria-hidden="true"></div>
<h3 id="chartTurnsTitle" class="daily-turn-title">1分あたり平均ターン数（学級別・累積平均・日別）</h3>
<div id="chartTurns" class="chart"></div>`;

  const style = `<style id="researchDailyClassStackStyle">
.daily-class-stack-card{display:grid;grid-template-rows:auto auto minmax(0,1fr) auto auto minmax(0,1fr);gap:5px;min-height:390px;height:100%;align-self:stretch}.daily-class-stack-card #chartDaily,.daily-class-stack-card #chartTurns{height:auto;min-height:0;overflow:hidden}.daily-range-controls{display:flex;justify-content:flex-end;align-items:center;gap:4px;min-height:27px}.daily-range-controls button{padding:4px 8px;border:1px solid #c7d5e8;border-radius:7px;background:#fff;color:#425878;font-size:11px;line-height:1.2;font-weight:800}.daily-range-controls button:hover{border-color:#7fa5df}.daily-range-controls button.is-active{border-color:#1767ed;background:#1767ed;color:#fff}.daily-class-stack-chart{height:100%;min-height:0;display:flex;flex-direction:column;gap:5px;padding:1px 0}.daily-class-legend{flex:0 0 auto;display:flex;flex-wrap:wrap;gap:4px 11px;align-items:center;padding:0 2px 2px;font-size:11px;font-weight:800;color:#425878}.daily-class-legend-item{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}.daily-class-swatch{width:10px;height:10px;border-radius:3px;display:inline-block;box-shadow:inset 0 0 0 1px rgba(15,35,70,.08)}.daily-class-stack-rows{flex:1 1 auto;min-height:0;overflow-y:auto;display:flex;flex-direction:column;padding:1px 3px 3px 0;scrollbar-gutter:stable}.daily-density-comfortable .daily-class-stack-rows{gap:8px}.daily-density-compact .daily-class-stack-rows{gap:5px}.daily-density-dense .daily-class-stack-rows{gap:3px}.daily-class-row{display:grid;grid-template-columns:minmax(108px,27%) minmax(100px,1fr) 38px;align-items:center;gap:8px}.daily-density-comfortable .daily-class-row{min-height:28px}.daily-density-compact .daily-class-row{min-height:24px}.daily-density-dense .daily-class-row{min-height:21px}.daily-class-date{font-size:14px;font-weight:750;line-height:1.15;color:#425878;white-space:nowrap}.daily-class-scale{background:#edf3ff;border-radius:999px;overflow:hidden}.daily-density-comfortable .daily-class-scale{height:19px}.daily-density-compact .daily-class-scale{height:16px}.daily-density-dense .daily-class-scale{height:14px}.daily-class-bar{height:100%;display:flex;border-radius:999px;overflow:hidden}.daily-class-segment{height:100%;min-width:1px;box-shadow:inset -1px 0 rgba(255,255,255,.5)}.daily-class-total{font-size:15px;font-weight:900;color:#173461;text-align:left}.daily-class-empty{padding:35px 8px;text-align:center}.daily-class-note{flex:0 0 auto;font-size:9px;color:#64748b;font-weight:700;padding:0 2px;line-height:1.3}.daily-class-segment:focus{outline:2px solid #10224a;outline-offset:-2px}.daily-turn-divider{border-top:1px solid #e2eaf5;margin:4px 0 3px}.daily-class-stack-card .daily-turn-title{font-size:16px;margin:0 0 3px;line-height:1.25}.daily-class-stack-card #chartTurns svg{display:block;min-width:0;width:100%;height:100%}@media(max-width:760px){.daily-class-stack-card{grid-template-rows:auto auto minmax(210px,1fr) auto auto minmax(220px,1fr);height:auto}.daily-class-row{grid-template-columns:minmax(100px,31%) minmax(72px,1fr) 34px;gap:6px}.daily-class-date,.daily-class-total{font-size:13px}.daily-class-legend{font-size:10px;gap:3px 8px}.daily-range-controls{justify-content:flex-start}.daily-class-stack-card .daily-turn-title{font-size:15px}}
</style>`;

  const script = `<script id="researchDailyClassStack">
(function(){
  var fixedColors={
    '5-1':'#2563eb','5-2':'#16a34a','5-3':'#f59e0b',
    '6-1':'#7c3aed','6-2':'#dc2626','6-3':'#0891b2',
    'unknown':'#94a3b8'
  };
  var fallbackColors=['#0f766e','#9333ea','#be123c','#4f46e5','#15803d','#c2410c','#0369a1','#a16207','#6d28d9','#047857'];
  var selectedRange='14';
  var latestCharts=null;

  function classColor(classId){
    var id=String(classId||'unknown');
    if(fixedColors[id])return fixedColors[id];
    var hash=0;for(var i=0;i<id.length;i+=1)hash=((hash*31)+id.charCodeAt(i))>>>0;
    return fallbackColors[hash%fallbackColors.length];
  }
  function h(value){return String(value==null?'':value).replace(/[&<>\"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]})}
  function valid(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))}
  function parseDate(date){var parsed=new Date(String(date||'')+'T00:00:00Z');return Number.isNaN(parsed.getTime())?null:parsed}
  function cutoffForRange(latestDate,range){
    if(range==='all')return null;
    var days=Number(range),latest=parseDate(latestDate);
    if(!latest||!Number.isFinite(days)||days<1)return null;
    latest.setUTCDate(latest.getUTCDate()-(days-1));
    return latest.toISOString().slice(0,10);
  }
  function latestDateFromRows(rows){
    var dates=(Array.isArray(rows)?rows:[]).map(function(row){return String(row&&row.date||'')}).filter(function(date){return /^\\d{4}-\\d{2}-\\d{2}$/.test(date)}).sort();
    return dates.length?dates[dates.length-1]:'';
  }
  function filterRowsByRange(rows,range){
    var items=Array.isArray(rows)?rows.slice():[];
    var latest=latestDateFromRows(items),cutoff=cutoffForRange(latest,range);
    if(!cutoff)return items;
    return items.filter(function(row){return String(row&&row.date||'')>=cutoff});
  }
  function filterSeriesByRange(series,range,latestDate){
    var cutoff=cutoffForRange(latestDate,range);
    return (Array.isArray(series)?series:[]).map(function(item){
      var points=Array.isArray(item&&item.points)?item.points:[];
      return Object.assign({},item,{points:cutoff?points.filter(function(point){return String(point&&point.date||'')>=cutoff}):points.slice()});
    });
  }
  function stackedClassBars(rows,legend){
    var items=Array.isArray(rows)?rows.slice():[];
    if(!items.length)return '<div class="muted daily-class-empty">データなし</div>';
    var density=items.length<=7?'comfortable':items.length<=14?'compact':'dense';
    var max=Math.max.apply(null,[1].concat(items.map(function(row){return Number(row.sessions||0)})));
    var active={};items.forEach(function(row){(row.by_class||[]).forEach(function(item){if(Number(item.sessions||0)>0)active[String(item.class_id||'unknown')]=true})});
    var legendItems=(Array.isArray(legend)?legend:[]).filter(function(item){return active[String(item.class_id||'unknown')]});
    var legendHtml='<div class="daily-class-legend">'+legendItems.map(function(item){var id=String(item.class_id||'unknown');return '<span class="daily-class-legend-item"><span class="daily-class-swatch" style="background:'+classColor(id)+'"></span>'+h(item.label||id)+'</span>'}).join('')+'</div>';
    var rowsHtml=items.map(function(row){
      var total=Math.max(0,Number(row.sessions||0));
      var width=total>0?Math.max(1,(total/max)*100):0;
      var segments=(row.by_class||[]).map(function(item){
        var count=Math.max(0,Number(item.sessions||0));if(!count)return '';
        var id=String(item.class_id||'unknown'),label=String(item.label||id),share=Number(item.share_percent||0);
        var title=String(row.date||'')+'｜'+label+'：'+count+'セッション（'+share+'%）';
        return '<div class="daily-class-segment" tabindex="0" aria-label="'+h(title)+'" title="'+h(title)+'" style="background:'+classColor(id)+';flex:'+count+' 1 0"></div>';
      }).join('');
      return '<div class="daily-class-row"><div class="daily-class-date">'+h(row.date||'')+'</div><div class="daily-class-scale"><div class="daily-class-bar" style="width:'+width+'%">'+segments+'</div></div><div class="daily-class-total">'+h(total)+'</div></div>';
    }).join('');
    return '<div class="daily-class-stack-chart daily-density-'+density+'">'+legendHtml+'<div class="daily-class-stack-rows">'+rowsHtml+'</div><div class="daily-class-note">棒全体＝その日の総セッション数｜色＝学級別内訳（スクロールで全表示日を確認）</div></div>';
  }
  function niceStep(range){
    var target=Math.max(.1,range/4),power=Math.pow(10,Math.floor(Math.log10(target))),scaled=target/power;
    var factor=scaled<=1?1:scaled<=2?2:scaled<=2.5?2.5:scaled<=5?5:10;
    return factor*power;
  }
  function turnsByClassSvg(series){
    var list=(Array.isArray(series)?series:[]).filter(function(item){return Array.isArray(item.points)&&item.points.some(function(point){return valid(point.value)})});
    var w=460,hgt=245,left=56,right=15,bottom=43;
    if(!list.length)return '<svg viewBox="0 0 '+w+' '+hgt+'" role="img" aria-label="1分あたり平均ターン数学級別累積平均"><text x="230" y="122" text-anchor="middle" class="svg-label">データなし</text></svg>';
    var dates=[];list.forEach(function(item){item.points.forEach(function(point){if(dates.indexOf(point.date)<0)dates.push(point.date)})});dates.sort();
    var values=[];list.forEach(function(item){item.points.forEach(function(point){if(valid(point.value))values.push(Number(point.value))})});
    var rawMin=Math.min.apply(null,values),rawMax=Math.max.apply(null,values),rawRange=Math.max(0,rawMax-rawMin);
    var desiredSpan=Math.max(1,rawRange*1.3),center=(rawMin+rawMax)/2,axisMin=Math.max(0,center-desiredSpan/2),axisMax=axisMin+desiredSpan;
    if(axisMax<rawMax){axisMax=rawMax;axisMin=Math.max(0,axisMax-desiredSpan)}
    var step=niceStep(axisMax-axisMin),pad=Math.max(step*.5,(axisMax-axisMin)*.05);
    axisMin=Math.max(0,Math.floor((axisMin-pad)/step)*step);axisMax=Math.ceil((axisMax+pad)/step)*step;
    if(axisMax<=axisMin)axisMax=axisMin+step;
    var legendRows=Math.ceil(list.length/3),top=18+legendRows*18,plotH=hgt-top-bottom,plotW=w-left-right;
    var x=function(date){var i=dates.indexOf(date);return left+(dates.length<=1?plotW/2:i*plotW/(dates.length-1))};
    var y=function(value){return top+plotH-(Number(value)-axisMin)*plotH/(axisMax-axisMin||1)};
    var fmt=function(value){return Math.abs(value-Math.round(value))<1e-9?String(Math.round(value)):String(Math.round(value*10)/10)};
    var out='<svg viewBox="0 0 '+w+' '+hgt+'" role="img" aria-label="1分あたり平均ターン数学級別累積平均">';
    for(var tick=axisMin,guard=0;tick<=axisMax+step*.001&&guard<10;tick+=step,guard+=1){var yy=y(tick);out+='<line x1="'+left+'" y1="'+yy+'" x2="'+(left+plotW)+'" y2="'+yy+'" stroke="#dfe7f2" stroke-width="1"/><text x="'+(left-17)+'" y="'+(yy+4)+'" text-anchor="middle" class="svg-label" style="font-size:10px">'+h(fmt(tick))+'</text>'}
    var every=Math.max(1,Math.ceil(dates.length/7));dates.forEach(function(date,index){if(index%every===0||index===dates.length-1)out+='<text x="'+x(date)+'" y="'+(hgt-19)+'" text-anchor="middle" class="svg-label" style="font-size:10px">'+h(String(date).slice(5))+'</text>'});
    list.forEach(function(item,index){
      var color=classColor(item.class_id),points=[];
      (item.points||[]).forEach(function(point){if(valid(point.value))points.push(x(point.date)+','+y(Number(point.value)))});
      if(points.length>1)out+='<polyline points="'+points.join(' ')+'" fill="none" stroke="'+color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
      (item.points||[]).forEach(function(point){if(!valid(point.value))return;var title=String(point.date||'')+' '+String(item.label||item.class_id||'')+': '+fmt(Number(point.value))+' ターン/分 (n='+Number(point.n||0)+')';out+='<circle cx="'+x(point.date)+'" cy="'+y(Number(point.value))+'" r="3.2" fill="#fff" stroke="'+color+'" stroke-width="1.8"><title>'+h(title)+'</title></circle>'});
      var col=index%3,row=Math.floor(index/3),lx=left+col*132,ly=12+row*18;
      out+='<line x1="'+lx+'" y1="'+ly+'" x2="'+(lx+16)+'" y2="'+ly+'" stroke="'+color+'" stroke-width="2"/><circle cx="'+(lx+8)+'" cy="'+ly+'" r="2.8" fill="#fff" stroke="'+color+'" stroke-width="1.5"/><text x="'+(lx+21)+'" y="'+(ly+4)+'" class="svg-label" style="font-size:10px;fill:#10224a">'+h(item.label||item.class_id||'')+'</text>';
    });
    out+='<text x="'+left+'" y="'+(hgt-3)+'" class="svg-label" style="font-size:9px;fill:#64748b">各点＝当日までの有効セッション累積平均｜ターン＝児童＋AI発話</text>';
    return out+'</svg>';
  }
  function updateRangeButtons(){
    var controls=document.getElementById('dailySessionRangeControls');
    if(!controls)return;
    Array.prototype.forEach.call(controls.querySelectorAll('[data-daily-range]'),function(button){
      var active=String(button.getAttribute('data-daily-range')||'')===selectedRange;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',active?'true':'false');
    });
  }
  function renderCombinedCharts(charts){
    latestCharts=charts||latestCharts;
    if(!latestCharts)return;
    var rows=Array.isArray(latestCharts.dailyClassStack)?latestCharts.dailyClassStack:[];
    var latestDate=latestDateFromRows(rows);
    var visibleRows=filterRowsByRange(rows,selectedRange);
    var visibleTurns=filterSeriesByRange(latestCharts.cumulativeTurnsByClass||[],selectedRange,latestDate);
    var title=document.getElementById('chartDailyTitle');
    var chart=document.getElementById('chartDaily');
    var turns=document.getElementById('chartTurns');
    if(title)title.textContent='日別セッション数（学級別内訳）';
    if(chart)chart.innerHTML=stackedClassBars(visibleRows,latestCharts.dailyClassLegend||[]);
    if(turns)turns.innerHTML=turnsByClassSvg(visibleTurns);
    updateRangeButtons();
  }
  function bindRangeControls(){
    var controls=document.getElementById('dailySessionRangeControls');
    if(!controls||controls.getAttribute('data-bound')==='1')return;
    controls.setAttribute('data-bound','1');
    controls.addEventListener('click',function(event){
      var target=event.target&&event.target.closest?event.target.closest('[data-daily-range]'):null;
      if(!target)return;
      var range=String(target.getAttribute('data-daily-range')||'14');
      if(['7','14','30','all'].indexOf(range)<0)return;
      selectedRange=range;
      renderCombinedCharts(latestCharts);
    });
  }

  var originalRenderDashboard=renderDashboard;
  renderDashboard=function(d,appliedQuery){
    originalRenderDashboard(d,appliedQuery);
    var charts=(d&&d.charts)||{};
    if(!Array.isArray(charts.dailyClassStack))return;
    var chart=document.getElementById('chartDaily');
    if(chart){
      var card=chart.closest&&chart.closest('.chart-card');
      if(card)card.classList.add('daily-class-stack-card');
    }
    bindRangeControls();
    renderCombinedCharts(charts);
  };
  window.renderDashboard=renderDashboard;
})();
</script>`;

  const withCombinedMarkup = html.replace(chartDailyMarkup, combinedMarkup);
  return withCombinedMarkup.replace('</head>', `${style}</head>`).replace('</body>', `${script}</body>`);
}

export function withResearchDailyClassStack(path: string, handler: RequestHandler): RequestHandler {
  if (path === '/management') {
    return (req, res, next) => {
      const originalSend = res.send.bind(res);
      (res as any).send = (body: any) => originalSend(
        typeof body === 'string' ? injectResearchDailyClassStack(body) : body,
      );
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
