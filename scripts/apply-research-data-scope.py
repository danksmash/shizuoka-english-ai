from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'pattern not found in {path}: {old[:160]!r}')
    p.write_text(text.replace(old, new, 1))


# Research filter model: data scope is separate from grade and class.
replace_once(
    'src/server/researchDashboard.ts',
    "  classId?: unknown;\n  grade?: unknown;\n",
    "  classId?: unknown;\n  grade?: unknown;\n  dataScope?: unknown;\n",
)

replace_once(
    'src/server/researchDashboard.ts',
    """function textQuery(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
function gradeMatches(row: Row, grade: string): boolean {
  if (!grade || grade === 'all') return true;
  const storedClass = String(row.class_id || '');
  if (grade === 'test') return storedClass === 'テスト';
  if (grade === 'reserve') return storedClass === '予備';
  return String(row.grade_level || '') === grade;
}
function classMatches(row: Row, classId: string): boolean {
  if (!classId || classId === 'all') return true;
  const storedClass = String(row.class_id || '');
  if (classId === 'test') return storedClass === 'テスト';
  if (classId === 'reserve') return storedClass === '予備';
  if (classId === 'pilotb') return storedClass === '5-PB' || storedClass === '6-PB';
  if (['1','2','3'].includes(classId)) return storedClass.endsWith(`-${classId}`);
  return storedClass === classId;
}
""",
    """function textQuery(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
export type ResearchDataScope = 'main' | 'pilot_b' | 'test' | 'reserve';
const PILOT_B_OFFICIAL_DATES = new Set(['2026-09-09']);
export function researchDataScopeForRow(row: Record<string, unknown>): ResearchDataScope {
  const storedClass = String(row.class_id || '');
  const localDate = String(row.local_date || '');
  if (storedClass === 'テスト') return 'test';
  if (storedClass === '予備') return 'reserve';
  if (storedClass === '5-PB' || storedClass === '6-PB') return PILOT_B_OFFICIAL_DATES.has(localDate) ? 'pilot_b' : 'test';
  return 'main';
}
function dataScopeMatches(row: Row, scope: string): boolean {
  if (!scope || scope === 'all') return true;
  return researchDataScopeForRow(row) === scope;
}
export function normalizeFormalResearchExportQuery(query: ResearchFilterQuery): ResearchFilterQuery {
  const scope = textQuery(query.dataScope);
  return { ...query, dataScope: (!scope || scope === 'all') ? 'main' : scope };
}
function gradeMatches(row: Row, grade: string): boolean {
  if (!grade || grade === 'all') return true;
  return (grade === '5' || grade === '6') && String(row.grade_level || '') === grade;
}
function classMatches(row: Row, classId: string): boolean {
  if (!classId || classId === 'all') return true;
  const storedClass = String(row.class_id || '');
  if (['1','2','3'].includes(classId)) return storedClass.endsWith(`-${classId}`);
  return storedClass === classId;
}
""",
)

replace_once(
    'src/server/researchDashboard.ts',
    "  const grade = textQuery(query.grade);\n  const personaId = textQuery(query.personaId);\n",
    "  const grade = textQuery(query.grade);\n  const dataScope = textQuery(query.dataScope);\n  const personaId = textQuery(query.personaId);\n",
)
replace_once(
    'src/server/researchDashboard.ts',
    "      && classMatches(row, classId) && gradeMatches(row, grade)\n",
    "      && dataScopeMatches(row, dataScope) && classMatches(row, classId) && gradeMatches(row, grade)\n",
)
replace_once(
    'src/server/researchDashboard.ts',
    """    filters:{
      classes:['1','2','3','test','reserve'],
      grades:['5','6','test','reserve'],
""",
    """    filters:{
      dataScopes:['main','pilot_b','test','reserve'],
      classes:['1','2','3'],
      grades:['5','6'],
""",
)

# Dashboard UI.
replace_once(
    'src/server/managementPage.ts',
    '.filters{display:grid;grid-template-columns:repeat(7,minmax(105px,1fr));gap:8px}',
    '.filters{display:grid;grid-template-columns:repeat(8,minmax(105px,1fr));gap:8px}',
)

old_filter_html = '''<div class="card"><h2 class="section-title">🔎 絞り込み条件</h2><div class="filters"><label>開始日<input id="start" type="date"></label><label>終了日<input id="end" type="date"></label><label>学年<select id="grade"><option value="all">すべて</option><option value="5">５年</option><option value="6">６年</option><option value="test">テスト</option><option value="reserve">予備</option></select></label><label>学級<select id="classId"><option value="all">すべて</option><option value="1">１組</option><option value="2">２組</option><option value="3">３組</option><option value="test">テスト</option><option value="reserve">予備</option><option value="pilotb">Pilot B</option></select></label>'''
new_filter_html = '''<div class="card"><h2 class="section-title">🔎 絞り込み条件</h2><div class="filters"><label>開始日<input id="start" type="date"></label><label>終了日<input id="end" type="date"></label><label>データ区分<select id="dataScope"><option value="main" selected>本研究</option><option value="pilot_b">Pilot B</option><option value="test">テスト</option><option value="reserve">予備</option><option value="all">すべて</option></select></label><label>学年<select id="grade"><option value="all">すべて</option><option value="5">５年</option><option value="6">６年</option></select></label><label>学級<select id="classId"><option value="all">すべて</option><option value="1">１組</option><option value="2">２組</option><option value="3">３組</option></select></label>'''
replace_once('src/server/managementPage.ts', old_filter_html, new_filter_html)

replace_once(
    'src/server/managementPage.ts',
    "const topicLabels={intro:'自己紹介・あいさつ',favorites:'好きなもの・すきなこと',shizuoka_culture:'静岡のじまん＆世界の文化',talents:'できること・得意なこと',daily_routine:'ふだんの生活・一日のようす',free:'自由トーク・おしゃべり'};const gradeLabels={'5':'５年','6':'６年',test:'テスト',reserve:'予備'};const classLabels={'1':'１組','2':'２組','3':'３組',test:'テスト',reserve:'予備'};",
    "const topicLabels={intro:'自己紹介・あいさつ',favorites:'好きなもの・すきなこと',shizuoka_culture:'静岡のじまん＆世界の文化',talents:'できること・得意なこと',daily_routine:'ふだんの生活・一日のようす',free:'自由トーク・おしゃべり'};const dataScopeLabels={main:'本研究',pilot_b:'Pilot B',test:'テスト',reserve:'予備'};const gradeLabels={'5':'５年','6':'６年'};const classLabels={'1':'１組','2':'２組','3':'３組'};",
)
replace_once(
    'src/server/managementPage.ts',
    "function filterParams(){const p=new URLSearchParams();['start','end','grade','classId','personaId','labelCondition','topic'].forEach(function(id){",
    "function filterParams(){const p=new URLSearchParams();['start','end','dataScope','grade','classId','personaId','labelCondition','topic'].forEach(function(id){",
)
replace_once(
    'src/server/managementPage.ts',
    "const f=d.filters||{};setOptions('classId',['1','2','3','test','reserve'],function(v){return classLabels[v]||v});setOptions('grade',['5','6','test','reserve'],function(v){return gradeLabels[v]||v});",
    "const f=d.filters||{};setOptions('dataScope',['main','pilot_b','test','reserve'],function(v){return dataScopeLabels[v]||v});setOptions('classId',['1','2','3'],function(v){return classLabels[v]||v});setOptions('grade',['5','6'],function(v){return gradeLabels[v]||v});",
)
replace_once(
    'src/server/managementPage.ts',
    "function resetFilters(){['start','end'].forEach(function(id){$(id).value=''});['grade','classId','personaId','labelCondition','topic'].forEach(function(id){$(id).value='all'});$('completeOnly').checked=false;return loadDashboard()}",
    "function resetFilters(){['start','end'].forEach(function(id){$(id).value=''});$('dataScope').value='main';['grade','classId','personaId','labelCondition','topic'].forEach(function(id){$(id).value='all'});$('completeOnly').checked=false;return loadDashboard()}",
)
replace_once(
    'src/server/managementPage.ts',
    "['start','end','grade','classId','personaId','labelCondition','topic','completeOnly'].forEach(function(id){$(id).onchange=scheduleDashboardReload});",
    "['start','end','dataScope','grade','classId','personaId','labelCondition','topic','completeOnly'].forEach(function(id){$(id).onchange=scheduleDashboardReload});",
)

old_export = '''<div class="section" id="exports"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><h2 class="section-title" style="font-size:16px">研究用 CSV ファイル</h2><button id="bundleBtn" class="primary">5 CSVを一括ZIP</button></div><div id="exportCards" class="exports"></div><p id="exportStatus" class="status"></p></div>'''
new_export = '''<div class="section" id="exports"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><h2 class="section-title" style="font-size:16px">研究用 CSV ファイル</h2><button id="bundleBtn" class="primary">5 CSVを一括ZIP</button></div><div class="note" style="margin:8px 0">正式Exportは安全のため「本研究」が標準です。Pilot Bはデータ区分で「Pilot B」を明示選択してからExportしてください。「すべて」表示中にExportした場合も本研究のみを出力します。</div><div id="exportCards" class="exports"></div><p id="exportStatus" class="status"></p></div>'''
replace_once('src/server/managementPage.ts', old_export, new_export)

replace_once(
    'src/server/managementPage.ts',
    "function appliedQueryUrl(path,dataset){return queryUrlFromParams(path,new URLSearchParams(appliedFilterQuery),dataset)}",
    "function appliedQueryUrl(path,dataset){return queryUrlFromParams(path,new URLSearchParams(appliedFilterQuery),dataset)}\nfunction appliedExportQueryUrl(path,dataset){const p=new URLSearchParams(appliedFilterQuery);if(!p.get('dataScope')||p.get('dataScope')==='all')p.set('dataScope','main');return queryUrlFromParams(path,p,dataset)}",
)
replace_once(
    'src/server/managementPage.ts',
    "function downloadDataset(dataset){return downloadFile(appliedQueryUrl('/api/management/research.csv',dataset),dataset+'.csv',dataset+'.csv を現在表示中の条件でダウンロードします')}",
    "function downloadDataset(dataset){return downloadFile(appliedExportQueryUrl('/api/management/research.csv',dataset),dataset+'.csv',dataset+'.csv を安全なデータ区分でダウンロードします')}",
)
replace_once(
    'src/server/managementPage.ts',
    "$('bundleBtn').onclick=function(){return downloadFile(appliedQueryUrl('/api/management/research.bundle.zip'),'research-bundle.zip','5 CSV一括ZIPを現在表示中の条件でダウンロードします')};",
    "$('bundleBtn').onclick=function(){return downloadFile(appliedExportQueryUrl('/api/management/research.bundle.zip'),'research-bundle.zip','5 CSV一括ZIPを安全なデータ区分でダウンロードします')};",
)

# Server-side safety for formal CSV / ZIP export.
replace_once(
    'server.ts',
    "import { buildResearchDashboardData, buildResearchExportDataSets, filterResearchExportDataSets, serializeResearchCsv, type ResearchExportDatasetName } from './src/server/researchDashboard';",
    "import { buildResearchDashboardData, buildResearchExportDataSets, filterResearchExportDataSets, normalizeFormalResearchExportQuery, serializeResearchCsv, type ResearchExportDatasetName } from './src/server/researchDashboard';",
)
replace_once(
    'server.ts',
    "    const datasets=filterResearchExportDataSets(buildResearchExportDataSets(await getAllSessionsForManagement()),req.query);\n    const exportedAt=new Date().toISOString();",
    "    const exportQuery=normalizeFormalResearchExportQuery(req.query);\n    const datasets=filterResearchExportDataSets(buildResearchExportDataSets(await getAllSessionsForManagement()),exportQuery);\n    const exportedAt=new Date().toISOString();",
)
replace_once(
    'server.ts',
    "const manifest={export_id:`export_${Date.now()}`,exported_at:exportedAt,schema_version:4,filters:req.query,row_counts:Object.fromEntries(names.map((name)=>[name,datasets[name].length]))};",
    "const manifest={export_id:`export_${Date.now()}`,exported_at:exportedAt,schema_version:4,filters:exportQuery,row_counts:Object.fromEntries(names.map((name)=>[name,datasets[name].length]))};",
)
replace_once(
    'server.ts',
    "    const datasets=filterResearchExportDataSets(buildResearchExportDataSets(sourceSessions),req.query);\n",
    "    const datasets=filterResearchExportDataSets(buildResearchExportDataSets(sourceSessions),normalizeFormalResearchExportQuery(req.query));\n",
)

# QA: 9/8 teacher pretest and 9/9 pupil Pilot B must never overlap.
Path('scripts/qa-pilot-b-isolation.ts').write_text("""import assert from 'node:assert/strict';
import { filterResearchExportDataSets, normalizeFormalResearchExportQuery, researchDataScopeForRow } from '../src/server/researchDashboard';

const ids = ['teacher-pretest','pb5','pb6','main5','main6','explicit-test','reserve'];
const data: any = {
  sessions: [
    { session_id:'teacher-pretest', class_id:'6-PB', grade_level:6, local_date:'2026-09-08', data_quality_flag:'complete' },
    { session_id:'pb5', class_id:'5-PB', grade_level:5, local_date:'2026-09-09', data_quality_flag:'complete' },
    { session_id:'pb6', class_id:'6-PB', grade_level:6, local_date:'2026-09-09', data_quality_flag:'complete' },
    { session_id:'main5', class_id:'5-1', grade_level:5, local_date:'2026-09-09', data_quality_flag:'complete' },
    { session_id:'main6', class_id:'6-1', grade_level:6, local_date:'2026-09-09', data_quality_flag:'complete' },
    { session_id:'explicit-test', class_id:'テスト', grade_level:'', local_date:'2026-09-08', data_quality_flag:'complete' },
    { session_id:'reserve', class_id:'予備', grade_level:'', local_date:'2026-09-08', data_quality_flag:'complete' },
  ],
  utterances: ids.map((session_id) => ({ session_id, utterance_id:session_id+'-1' })),
  expressions: ids.map((session_id) => ({ session_id, utterance_id:session_id+'-1' })),
  personas: [{ persona_id:'emma_usa' }],
  codebook: [{ file_name:'sessions.csv' }],
};

assert.equal(researchDataScopeForRow(data.sessions[0]), 'test');
assert.equal(researchDataScopeForRow(data.sessions[1]), 'pilot_b');
assert.equal(researchDataScopeForRow(data.sessions[2]), 'pilot_b');
assert.equal(researchDataScopeForRow(data.sessions[3]), 'main');
assert.equal(researchDataScopeForRow(data.sessions[5]), 'test');
assert.equal(researchDataScopeForRow(data.sessions[6]), 'reserve');

const pilot = filterResearchExportDataSets(data, { dataScope:'pilot_b' });
assert.deepEqual(pilot.sessions.map((row:any) => row.session_id), ['pb5','pb6']);
assert.deepEqual(pilot.utterances.map((row:any) => row.session_id), ['pb5','pb6']);
assert.deepEqual(pilot.expressions.map((row:any) => row.session_id), ['pb5','pb6']);
assert.deepEqual(filterResearchExportDataSets(data, { dataScope:'pilot_b', grade:'6' }).sessions.map((row:any) => row.session_id), ['pb6']);

assert.deepEqual(filterResearchExportDataSets(data, { dataScope:'test' }).sessions.map((row:any) => row.session_id), ['teacher-pretest','explicit-test']);
assert.deepEqual(filterResearchExportDataSets(data, { dataScope:'main' }).sessions.map((row:any) => row.session_id), ['main5','main6']);
assert.deepEqual(filterResearchExportDataSets(data, { dataScope:'main', grade:'6' }).sessions.map((row:any) => row.session_id), ['main6']);
assert.deepEqual(filterResearchExportDataSets(data, { dataScope:'reserve' }).sessions.map((row:any) => row.session_id), ['reserve']);

assert.equal(normalizeFormalResearchExportQuery({}).dataScope, 'main');
assert.equal(normalizeFormalResearchExportQuery({ dataScope:'all' }).dataScope, 'main');
assert.equal(normalizeFormalResearchExportQuery({ dataScope:'pilot_b' }).dataScope, 'pilot_b');
assert.equal(normalizeFormalResearchExportQuery({ dataScope:'test' }).dataScope, 'test');

console.log('Pilot B / main / test / reserve data-scope isolation QA: PASS');
""")

print('Research data-scope migration applied')
