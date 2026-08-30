from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label} anchor not found')
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, replacement: str, label: str) -> str:
    out, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{label} pattern not found')
    return out

# -----------------------------------------------------------------------------
# Researcher UI: immediate filter updates, synchronized exports, missing-data
# chart rendering, responsive wrapping, and no "博士" wording.
# -----------------------------------------------------------------------------
p = Path('src/server/managementPage.ts')
s = p.read_text(encoding='utf-8')
s = replace_once(
    s,
    '.top{display:flex;gap:12px;align-items:center;justify-content:space-between;padding-bottom:8px;border-bottom:1px solid #dde6f2}',
    '.top{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding-bottom:8px;border-bottom:1px solid #dde6f2}',
    'top flex wrap',
)
s = replace_once(
    s,
    '.nav,.actions{display:flex;gap:7px;flex-wrap:wrap;align-items:center}',
    '.nav,.actions{display:flex;gap:7px;flex-wrap:wrap;align-items:center}.nav{flex:1;min-width:360px;justify-content:center}.actions{min-width:280px;justify-content:flex-end}',
    'nav actions',
)
s = replace_once(
    s,
    '.filter-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:10px}',
    '.filter-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:10px}',
    'filter actions',
)
s = replace_once(
    s,
    '.quality-row,.expression-row{display:grid;grid-template-columns:1fr auto;gap:8px;padding:6px 0;border-bottom:1px solid #edf2f8;font-size:11px}',
    '.quality-row,.expression-row{display:grid;grid-template-columns:1fr auto;gap:8px;padding:6px 0;border-bottom:1px solid #edf2f8;font-size:11px}.quality-group-title{font-size:10px;font-weight:900;color:#174aa8;margin:9px 0 4px;padding-top:7px;border-top:1px solid #edf2f8}.quality-group-title:first-child{margin-top:0;padding-top:0;border-top:0}button:disabled{opacity:.5;cursor:not-allowed}',
    'quality css',
)
s = replace_once(
    s,
    '@media(max-width:760px){.top{align-items:flex-start;flex-direction:column}.metrics{grid-template-columns:1fr 1fr}.filters{grid-template-columns:1fr 1fr}.charts,.lower,.exports{grid-template-columns:1fr}.lower .recent-card{grid-column:auto}.nav{display:none}}',
    '@media(max-width:760px){.top{align-items:flex-start;flex-direction:column}.nav,.actions{width:100%;min-width:0;justify-content:flex-start}.nav{flex-wrap:wrap}.metrics{grid-template-columns:1fr 1fr}.filters{grid-template-columns:1fr 1fr}.charts,.lower,.exports{grid-template-columns:1fr}.lower .recent-card{grid-column:auto}}',
    'mobile nav',
)
s = s.replace('博士論文・共同研究向け Research Dashboard', '研究者用 Research Dashboard')
s = replace_once(s, '<div class="charts"><div class="card chart-card"><h3>日別セッション数</h3>', '<div class="charts"><div class="card chart-card"><h3 id="chartDailyTitle">日別セッション数</h3>', 'daily chart title')
s = replace_once(s, '<div class="card chart-card"><h3>1セッションあたり児童総語数（平均）</h3><div id="chartWords"', '<div class="card chart-card"><h3 id="chartWordsTitle">1セッションあたり児童総語数（平均）</h3><div id="chartWords"', 'words chart title')
s = replace_once(s, '<div class="card chart-card"><h3>振り返り平均値（1/3/5）</h3><div id="chartReflection"', '<div class="card chart-card"><h3 id="chartReflectionTitle">振り返り平均値（1/3/5）</h3><div id="chartReflection"', 'reflection chart title')
s = replace_once(
    s,
    "const $=id=>document.getElementById(id);let role='';let lastDashboard=null;",
    "const $=id=>document.getElementById(id);let role='';let lastDashboard=null;let appliedFilterQuery='';let dashboardRequestSeq=0;let filterTimer=0;let dashboardLoading=false;",
    'dashboard state',
)
s = replace_once(
    s,
    "function queryUrl(path,dataset){const p=filterParams();if(dataset)p.set('dataset',dataset);const q=p.toString();return path+(q?'?'+q:'')}",
    "function queryUrlFromParams(path,params,dataset){const p=new URLSearchParams(params.toString());if(dataset)p.set('dataset',dataset);const q=p.toString();return path+(q?'?'+q:'')}\nfunction queryUrl(path,dataset){return queryUrlFromParams(path,filterParams(),dataset)}\nfunction appliedQueryUrl(path,dataset){return queryUrlFromParams(path,new URLSearchParams(appliedFilterQuery),dataset)}",
    'query URL',
)

line_fn = r'''function lineSvg(items,keys){
  const rows=items||[],w=420,h=190,left=35,top=10,right=8,bottom=28,plotW=w-left-right,plotH=h-top-bottom;
  const valid=function(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))};
  const vals=[];rows.forEach(function(r){keys.forEach(function(k){if(valid(r[k.key]))vals.push(Number(r[k.key]))})});
  if(!rows.length||!vals.length)return '<div class="muted" style="padding:70px 8px;text-align:center">データなし</div>';
  let max=Math.max(...vals),min=Math.min(...vals);if(max===min){max+=1;min=Math.max(0,min-1)}
  const x=function(i){return left+(rows.length<=1?plotW/2:i*plotW/(rows.length-1))},y=function(v){return top+plotH-(Number(v)-min)*plotH/(max-min||1)};
  let out='<svg viewBox="0 0 '+w+' '+h+'" width="100%" height="100%" role="img"><line x1="'+left+'" y1="'+(top+plotH)+'" x2="'+(left+plotW)+'" y2="'+(top+plotH)+'" stroke="#cbd8ea"/>';
  const every=Math.max(1,Math.ceil(rows.length/10));rows.forEach(function(r,i){if(i%every===0||i===rows.length-1)out+='<text x="'+x(i)+'" y="'+(h-8)+'" text-anchor="middle" class="svg-label">'+esc(String(r.date||'').slice(5))+'</text>'});
  keys.forEach(function(k,ki){const color=['#2774ee','#20a567','#f59e0b'][ki%3];let segment=[];const segments=[];rows.forEach(function(r,i){if(valid(r[k.key]))segment.push(x(i)+','+y(Number(r[k.key])));else if(segment.length){segments.push(segment);segment=[]}});if(segment.length)segments.push(segment);segments.forEach(function(points){if(points.length>1)out+='<polyline points="'+points.join(' ')+'" fill="none" stroke="'+color+'" stroke-width="2.5"/>'});rows.forEach(function(r,i){if(valid(r[k.key]))out+='<circle cx="'+x(i)+'" cy="'+y(Number(r[k.key]))+'" r="3" fill="'+color+'"/>'});out+='<text x="'+(left+ki*120)+'" y="9" class="svg-label" fill="'+color+'">'+esc(k.label)+'</text>'});
  return out+'</svg>'
}'''
s = regex_once(s, r'function lineSvg\(items,keys\)\{.*?\}\nfunction renderDashboard', line_fn + '\nfunction renderDashboard', 'lineSvg')
s = replace_once(
    s,
    'function renderDashboard(d){lastDashboard=d;',
    "function renderDashboard(d,appliedQuery){if(typeof appliedQuery==='string')appliedFilterQuery=appliedQuery;lastDashboard=d;",
    'render signature',
)
old = "const f=d.filters||{};setOptions('classId',f.classes);setOptions('grade',f.grades);setOptions('personaId',f.personas);setOptions('circle',f.circles);setOptions('labelCondition',f.labelConditions);setOptions('topic',f.topics,function(v){return topicLabels[v]||v});"
new = old + "\nconst aggregation=((d.charts||{}).aggregation||'daily');$('chartDailyTitle').textContent=aggregation==='weekly'?'週別セッション数':'日別セッション数';$('chartWordsTitle').textContent=aggregation==='weekly'?'1セッションあたり児童総語数（週別平均）':'1セッションあたり児童総語数（平均）';$('chartReflectionTitle').textContent=aggregation==='weekly'?'振り返り平均値（週別・1/3/5）':'振り返り平均値（1/3/5）';"
s = replace_once(s, old, new, 'aggregation titles')
old = "$('qualityRows').innerHTML=(d.dataQuality||[]).map(function(r){return '<div class=\"quality-row\"><span>'+esc(r.label)+'</span><b>'+esc(r.value)+'</b></div>'}).join('')||'<span class=\"muted\">データなし</span>';"
new = "const qualityLabels={complete:'完全ケース',missing_reflection:'振り返り欠測',interrupted:'中断',missing_core:'主要データ欠測'};const qSession=(d.dataQuality||[]).map(function(r){return '<div class=\"quality-row\"><span>'+esc(qualityLabels[r.label]||r.label)+'</span><b>'+esc(r.value)+'</b></div>'}).join('')||'<span class=\"muted\">データなし</span>';const qSystem=(d.systemQuality||[]).map(function(r){return '<div class=\"quality-row\"><span>'+esc(r.label)+'</span><b>'+esc(r.value)+'</b></div>'}).join('')||'<span class=\"muted\">該当なし</span>';$('qualityRows').innerHTML='<div class=\"quality-group-title\">セッション品質（件）</div>'+qSession+'<div class=\"quality-group-title\">システムイベント（回）</div>'+qSystem;"
s = replace_once(s, old, new, 'quality render')

actions_block = r'''function setExportAvailability(enabled){dashboardLoading=!enabled;$('bundleBtn').disabled=!enabled;document.querySelectorAll('[data-export-dataset]').forEach(function(b){b.disabled=!enabled})}
function bindDynamicExportButtons(){document.querySelectorAll('[data-export-dataset]').forEach(function(b){b.disabled=dashboardLoading;b.onclick=function(){downloadDataset(b.dataset.exportDataset)}})}
async function loadDashboard(){const seq=++dashboardRequestSeq,params=filterParams(),query=params.toString();setExportAvailability(false);try{$('dashboardStatus').className='status';$('dashboardStatus').textContent='データを集計しています…';const d=await json(queryUrlFromParams('/api/management/research.dashboard',params));if(seq!==dashboardRequestSeq)return;renderDashboard(d,query);$('dashboardStatus').textContent='選択条件を反映した匿名化データを表示しています'}catch(e){if(seq!==dashboardRequestSeq)return;$('dashboardStatus').textContent='読み込み失敗: '+e.message;$('dashboardStatus').className='status error'}finally{if(seq===dashboardRequestSeq)setExportAvailability(true)}}
function scheduleDashboardReload(){if(filterTimer)clearTimeout(filterTimer);$('dashboardStatus').className='status';$('dashboardStatus').textContent='条件を反映しています…';filterTimer=setTimeout(function(){loadDashboard()},180)}
function downloadDataset(dataset){if(dashboardLoading)return;$('exportStatus').textContent=dataset+'.csv を現在表示中の条件でダウンロードします';location.href=appliedQueryUrl('/api/management/research.csv',dataset)}
function resetFilters(){['start','end'].forEach(function(id){$(id).value=''});['grade','classId','personaId','circle','labelCondition','topic'].forEach(function(id){$(id).value='all'});$('completeOnly').checked=false;return loadDashboard()}
'''
s = regex_once(
    s,
    r"function bindDynamicExportButtons\(\)\{.*?\}\nasync function loadDashboard\(\)\{.*?\}\nfunction downloadDataset\(dataset\)\{.*?\}\nfunction resetFilters\(\)\{.*?\}\n",
    actions_block,
    'dashboard actions',
)
old = "$('logoutBtn').onclick=async function(){await fetch('/api/management/logout',{method:'POST'});location.reload()};$('refreshBtn').onclick=loadDashboard;$('filterBtn').onclick=loadDashboard;$('resetBtn').onclick=resetFilters;$('bundleBtn').onclick=function(){$('exportStatus').textContent='5 CSV一括ZIPをダウンロードします';location.href=queryUrl('/api/management/research.bundle.zip')};"
new = "$('logoutBtn').onclick=async function(){await fetch('/api/management/logout',{method:'POST'});location.reload()};$('refreshBtn').onclick=loadDashboard;$('filterBtn').onclick=loadDashboard;$('resetBtn').onclick=resetFilters;$('bundleBtn').onclick=function(){if(dashboardLoading)return;$('exportStatus').textContent='5 CSV一括ZIPを現在表示中の条件でダウンロードします';location.href=appliedQueryUrl('/api/management/research.bundle.zip')};['start','end','grade','classId','personaId','circle','labelCondition','topic','completeOnly'].forEach(function(id){$(id).onchange=scheduleDashboardReload});"
s = replace_once(s, old, new, 'button/event binding')
p.write_text(s, encoding='utf-8')

# -----------------------------------------------------------------------------
# Server-side dashboard: daily -> weekly aggregation for long ranges; keep
# missing reflections null; separate session-quality counts from system events.
# -----------------------------------------------------------------------------
p = Path('src/server/researchDashboard.ts')
s = p.read_text(encoding='utf-8')
series_block = '''  type SeriesBucket={sessions:number;words:number[];reflections:[number[],number[],number[]]};
  const daily = new Map<string, SeriesBucket>();
  const weekly = new Map<string, SeriesBucket>();
  const weekStart=(date:string):string=>{const d=new Date(`${date}T00:00:00Z`);if(Number.isNaN(d.getTime()))return date;const offset=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-offset);return d.toISOString().slice(0,10);};
  const addSeries=(target:Map<string,SeriesBucket>,key:string,row:Row)=>{const d=target.get(key)||{sessions:0,words:[],reflections:[[],[],[]]};d.sessions+=1;const words=Number(row.child_total_words);if(Number.isFinite(words))d.words.push(words);const refs=[row.reflection_conveyed_ideas,row.reflection_understood_partner,row.reflection_noticed_language_culture];refs.forEach((value,index)=>{const n=Number(value);if([1,3,5].includes(n))d.reflections[index].push(n)});target.set(key,d);};
  for (const row of data.sessions) {
    const date = String(row.local_date || '');
    if (!date) continue;
    addSeries(daily,date,row);addSeries(weekly,weekStart(date),row);
  }
  const counts ='''
s = regex_once(s, r'  const daily = new Map<.*?\n  const counts =', series_block, 'series maps')
quality_block = '''  const quality = counts('data_quality_flag');
  const sumField = (key: string) => data.sessions.reduce((sum,row)=>sum+Number(row[key]||0),0);
  const systemQuality=[
    { label:'AI応答失敗', value:sumField('ai_request_failure_count') },
    { label:'マイクエラー', value:sumField('mic_error_count') },
    { label:'TTSフォールバック', value:sumField('tts_fallback_count') },
  ];
  const recentSessions ='''
s = regex_once(s, r"  const quality = counts\('data_quality_flag'\);.*?\n  const recentSessions =", quality_block, 'quality separation')
rows_block = '''  const seriesRows=(source:Map<string,SeriesBucket>)=>[...source.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([date,value])=>({
    date, sessions:value.sessions, mean_child_words:round(average(value.words),1),
    reflection_conveyed:value.reflections[0].length?round(average(value.reflections[0]),2):null,
    reflection_understood:value.reflections[1].length?round(average(value.reflections[1]),2):null,
    reflection_culture:value.reflections[2].length?round(average(value.reflections[2]),2):null,
  }));
  const dailyRows=seriesRows(daily),weeklyRows=seriesRows(weekly),aggregation=dailyRows.length>21?'weekly':'daily';
  const chartRows=aggregation==='weekly'?weeklyRows:dailyRows;
  return {'''
s = regex_once(s, r'  const dailyRows=.*?\n  return \{', rows_block, 'series rows')
s = replace_once(
    s,
    "    charts:{ daily:dailyRows, personas:personaUsage, circles:counts('accent_circle') },\n    dataQuality:quality,",
    "    charts:{ daily:chartRows, aggregation, personas:personaUsage, circles:counts('accent_circle') },\n    dataQuality:quality,\n    systemQuality,",
    'dashboard return',
)
p.write_text(s, encoding='utf-8')

# -----------------------------------------------------------------------------
# Dashboard behavior QA.
# -----------------------------------------------------------------------------
p = Path('scripts/qa-dashboard-data-sync.ts')
s = p.read_text(encoding='utf-8')
s = replace_once(
    s,
    "return {id,value:'',checked:false,innerHTML:'',textContent:'',style:{},options:[{value:'all'}],dataset:{},onclick:null,",
    "return {id,value:'',checked:false,disabled:false,innerHTML:'',textContent:'',style:{},options:[{value:'all'}],dataset:{},onclick:null,onchange:null,",
    'fake element state',
)
s = replace_once(
    s,
    "scrollIntoView:()=>{},addEventListener:()=>{},appendChild:()=>{},remove:()=>{},click(){if(typeof this.onclick==='function')return this.onclick();}};",
    "scrollIntoView:()=>{},addEventListener:()=>{},appendChild:()=>{},remove:()=>{},click(){if(typeof this.onclick==='function')return this.onclick();},change(){if(typeof this.onchange==='function')return this.onchange();}};",
    'fake change',
)
s = replace_once(
    s,
    "    personas:[{label:'Emma (emma_usa)',value:45},{label:'Rahul (rahul_bangladesh)',value:30}],circles:[{label:'Inner',value:45},{label:'Outer',value:30}]\n  },\n  dataQuality:[{label:'complete',value:379},{label:'missing_reflection',value:5}],",
    "    personas:[{label:'Emma (emma_usa)',value:45},{label:'Rahul (rahul_bangladesh)',value:30}],circles:[{label:'Inner',value:45},{label:'Outer',value:30}],aggregation:'daily'\n  },\n  dataQuality:[{label:'complete',value:379},{label:'missing_reflection',value:5}],\n  systemQuality:[{label:'AI応答失敗',value:2},{label:'マイクエラー',value:1},{label:'TTSフォールバック',value:3}],",
    'sample quality',
)
s = replace_once(
    s,
    "assert.ok(element('qualityRows').innerHTML.includes('complete'));",
    "assert.ok(element('qualityRows').innerHTML.includes('完全ケース'));assert.ok(element('qualityRows').innerHTML.includes('システムイベント'));assert.ok(element('qualityRows').innerHTML.includes('TTSフォールバック'));",
    'quality assertions',
)
old = """const dashboardUrl=context.queryUrl('/api/management/research.dashboard');
assert.ok(dashboardUrl.includes('personaId=emma_usa')&&dashboardUrl.includes('completeOnly=1'),'dashboard API must receive every active filter');

context.downloadDataset('sessions');"""
new = """const dashboardUrl=context.queryUrl('/api/management/research.dashboard');
assert.ok(dashboardUrl.includes('personaId=emma_usa')&&dashboardUrl.includes('completeOnly=1'),'dashboard API must receive every active filter');
context.renderDashboard(sample,params.toString());
assert.ok(context.appliedQueryUrl('/api/management/research.csv','sessions').includes('personaId=emma_usa'),'applied dashboard filters must be snapshotted for exports');

context.downloadDataset('sessions');"""
s = replace_once(s, old, new, 'applied filter QA')
s = replace_once(
    s,
    "assert.ok(pageSource.includes(\"$('bundleBtn').onclick\"),'bundle button must be linked to download endpoint');",
    "assert.ok(pageSource.includes(\"$('bundleBtn').onclick\"),'bundle button must be linked to download endpoint');\nassert.ok(pageSource.includes('onchange=scheduleDashboardReload'),'all filter controls must auto-refresh the dashboard');\nassert.ok(pageSource.includes('appliedQueryUrl'),'CSV and ZIP downloads must use the last successfully rendered filter snapshot');\nassert.ok(pageSource.includes('flex-wrap:wrap'),'research header/actions must wrap instead of overflowing');\nassert.equal(pageSource.includes('博士'),false,'researcher UI must not display 博士');\nfor(const id of ['start','end','grade','classId','personaId','circle','labelCondition','topic','completeOnly'])assert.equal(typeof element(id).onchange,'function',id+' must have immediate-change binding');",
    'new page assertions',
)
p.write_text(s, encoding='utf-8')

# -----------------------------------------------------------------------------
# CSV completeness, referential integrity, missing reflection, long-period chart.
# -----------------------------------------------------------------------------
p = Path('scripts/qa-research-export-complete.ts')
s = p.read_text(encoding='utf-8')
old = """assert.ok(dashboard.dataQuality.some((r)=>r.label==='AI request failure'&&r.value===1),'dashboard must expose AI failure quality events');
assert.ok(dashboard.dataQuality.some((r)=>r.label==='Mic error'&&r.value===1),'dashboard must expose microphone error quality events');
assert.ok(dashboard.dataQuality.some((r)=>r.label==='TTS fallback'&&r.value===1),'dashboard must expose TTS fallback quality events');"""
new = """assert.ok(dashboard.systemQuality.some((r)=>r.label==='AI応答失敗'&&r.value===1),'dashboard must expose AI failure events separately');
assert.ok(dashboard.systemQuality.some((r)=>r.label==='マイクエラー'&&r.value===1),'dashboard must expose microphone errors separately');
assert.ok(dashboard.systemQuality.some((r)=>r.label==='TTSフォールバック'&&r.value===1),'dashboard must expose TTS fallback separately');"""
s = replace_once(s, old, new, 'system quality QA')
marker = "assert.equal(rateCodebook.allowed_values,'0.75–1.25','speech rate range must be documented in codebook');"
addition = marker + """
const betaDate=String(beta.local_date||'');
const betaSeries=dashboard.charts.daily.find((r)=>r.date===betaDate)!;
assert.equal(betaSeries.reflection_conveyed,null,'missing reflection must stay null, never become a false zero score');
for(const utterance of data.utterances){const session=data.sessions.find((r)=>r.session_id===utterance.session_id)!;assert.ok(session,'orphan utterance');assert.equal(utterance.research_id,session.research_id);assert.equal(utterance.class_id,session.class_id);assert.equal(utterance.persona_id,session.persona_id);assert.equal(utterance.topic,session.topic);}
for(const expression of data.expressions){const utterance=data.utterances.find((r)=>r.utterance_id===expression.utterance_id)!;assert.ok(utterance,'orphan expression');assert.equal(expression.session_id,utterance.session_id);assert.equal(expression.research_id,utterance.research_id);assert.equal(expression.class_id,utterance.class_id);assert.equal(expression.speaker,utterance.speaker);}
for(const session of data.sessions)assert.ok(personaIds.has(String(session.persona_id)),'every session persona_id must resolve in personas.csv');
const expectedCodebookRows=['sessions','utterances','expressions','personas','codebook'].reduce((sum,name)=>sum+RESEARCH_EXPORT_HEADERS[name as keyof typeof RESEARCH_EXPORT_HEADERS].length,0);
assert.equal(data.codebook.length,expectedCodebookRows,'codebook must contain exactly one row for every exported column');
const longSessions=Array.from({length:22},(_,i)=>({...sessions[0],sessionId:'long_'+i,researchId:'RLONG',startedAt:new Date(base+i*86400000).toISOString(),endedAt:new Date(base+i*86400000+120000).toISOString()}));
const longDashboard=buildResearchDashboardData(longSessions as any,{});
assert.equal(longDashboard.charts.aggregation,'weekly','more than 21 daily points must aggregate to weekly display');
assert.ok(longDashboard.charts.daily.length<22,'weekly aggregation must reduce chart density');"""
s = replace_once(s, marker, addition, 'extra export assertions')
p.write_text(s, encoding='utf-8')

if '博士' in Path('src/server/managementPage.ts').read_text(encoding='utf-8'):
    raise SystemExit('forbidden researcher UI wording remains')

print('researcher dashboard UX fixes applied')
