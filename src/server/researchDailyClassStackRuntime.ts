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

  const aggregation: Aggregation = body.charts.aggregation === 'weekly' ? 'weekly' : 'daily';
  const stack = buildDailyClassStackRows(filteredSessions, aggregation);
  const existingRows = Array.isArray(body.charts.daily) ? body.charts.daily : [];
  const totalsMatch = totalsMatchExistingChart(stack.rows, existingRows);

  if (!totalsMatch) {
    console.error('Research daily class stack total mismatch', {
      aggregation,
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

  return {
    ...body,
    charts: {
      ...body.charts,
      dailyClassStack: stack.rows,
      dailyClassLegend: stack.legend,
      dailyClassStackMatchesTotal: true,
    },
  };
}

function injectResearchDailyClassStack(html: string): string {
  if (!html.includes('id="chartDaily"') || html.includes('researchDailyClassStack')) return html;

  const style = `<style id="researchDailyClassStackStyle">
.daily-class-stack-card{display:flex;flex-direction:column;min-height:390px}.daily-class-stack-card #chartDaily{height:auto;flex:1 1 auto;min-height:0;overflow:hidden}.daily-class-stack-chart{height:100%;min-height:0;display:flex;flex-direction:column;gap:8px;padding:2px 0}.daily-class-legend{flex:0 0 auto;display:flex;flex-wrap:wrap;gap:5px 12px;align-items:center;padding:0 2px 4px;font-size:12px;font-weight:800;color:#425878}.daily-class-legend-item{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}.daily-class-swatch{width:11px;height:11px;border-radius:3px;display:inline-block;box-shadow:inset 0 0 0 1px rgba(15,35,70,.08)}.daily-class-stack-rows{flex:1 1 auto;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:2px 3px 4px 0;scrollbar-gutter:stable}.daily-class-row{display:grid;grid-template-columns:minmax(116px,27%) minmax(110px,1fr) 40px;align-items:center;gap:9px;min-height:28px}.daily-class-date{font-size:15px;font-weight:750;line-height:1.2;color:#425878;white-space:nowrap}.daily-class-scale{height:21px;background:#edf3ff;border-radius:999px;overflow:hidden}.daily-class-bar{height:100%;display:flex;border-radius:999px;overflow:hidden}.daily-class-segment{height:100%;min-width:1px;box-shadow:inset -1px 0 rgba(255,255,255,.5)}.daily-class-total{font-size:16px;font-weight:900;color:#173461;text-align:left}.daily-class-empty{padding:90px 8px;text-align:center}.daily-class-note{flex:0 0 auto;font-size:10px;color:#64748b;font-weight:700;padding:0 2px}.daily-class-segment:focus{outline:2px solid #10224a;outline-offset:-2px}@media(max-width:760px){.daily-class-stack-card #chartDaily{min-height:330px}.daily-class-row{grid-template-columns:minmax(104px,31%) minmax(78px,1fr) 36px;gap:7px}.daily-class-date,.daily-class-total{font-size:14px}.daily-class-legend{font-size:11px;gap:4px 9px}}
</style>`;

  const script = `<script id="researchDailyClassStack">
(function(){
  var fixedColors={
    '5-1':'#2563eb','5-2':'#16a34a','5-3':'#f59e0b',
    '6-1':'#7c3aed','6-2':'#dc2626','6-3':'#0891b2',
    'unknown':'#94a3b8'
  };
  var fallbackColors=['#0f766e','#9333ea','#be123c','#4f46e5','#15803d','#c2410c','#0369a1','#a16207','#6d28d9','#047857'];
  function classColor(classId){
    var id=String(classId||'unknown');
    if(fixedColors[id])return fixedColors[id];
    var hash=0;for(var i=0;i<id.length;i+=1)hash=((hash*31)+id.charCodeAt(i))>>>0;
    return fallbackColors[hash%fallbackColors.length];
  }
  function h(value){return String(value==null?'':value).replace(/[&<>\"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]})}
  function stackedClassBars(rows,legend){
    var items=Array.isArray(rows)?rows.slice():[];
    if(!items.length)return '<div class="muted daily-class-empty">データなし</div>';
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
    return '<div class="daily-class-stack-chart">'+legendHtml+'<div class="daily-class-stack-rows">'+rowsHtml+'</div><div class="daily-class-note">棒全体＝その日の総セッション数｜色＝学級別内訳（色部分に合わせると件数・割合を表示）</div></div>';
  }
  var originalRenderDashboard=renderDashboard;
  renderDashboard=function(d,appliedQuery){
    originalRenderDashboard(d,appliedQuery);
    var charts=(d&&d.charts)||{},rows=charts.dailyClassStack;
    if(!Array.isArray(rows))return;
    var aggregation=charts.aggregation==='weekly'?'weekly':'daily';
    var title=document.getElementById('chartDailyTitle');
    var chart=document.getElementById('chartDaily');
    if(title)title.textContent=aggregation==='weekly'?'週別セッション数（学級別内訳）':'日別セッション数（学級別内訳）';
    if(chart){
      var card=chart.closest&&chart.closest('.chart-card');
      if(card)card.classList.add('daily-class-stack-card');
      chart.innerHTML=stackedClassBars(rows,charts.dailyClassLegend||[]);
    }
  };
  window.renderDashboard=renderDashboard;
})();
</script>`;

  return html.replace('</head>', `${style}</head>`).replace('</body>', `${script}</body>`);
}

export function withResearchDailyClassStack(path: string, handler: RequestHandler): RequestHandler {
  if (path === '/management') {
    return (req, res, next) => {
      const originalSend = res.send.bind(res);
      (res as any).send = (body: any) => originalSend(typeof body === 'string' ? injectResearchDailyClassStack(body) : body);
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
