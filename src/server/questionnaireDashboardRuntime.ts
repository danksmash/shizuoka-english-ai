import type { RequestHandler } from 'express';
import { buildResearchExportDataSets, filterResearchExportDataSets, normalizeFormalResearchExportQuery, serializeResearchCsv, type ResearchExportDatasetName } from './researchDashboard';
import { getAllSessionsForManagement } from './persistence';
import { getAllReflectionRecordsForTeacher } from './reflectionPersistence';
import { buildResearchLessonReflectionCodebookRows, buildResearchLessonReflectionRows, serializeResearchLessonReflectionCsv } from './researchLessonReflectionExport';
import { getAllStudySchedules } from './studySchedulePersistence';
import { filterReflectionsForStudyPhase, filterSessionsForStudyPhase, normalizeStudyPhaseFilter } from './researchPhaseRuntime';
import {
  buildQuestionnaireCodebookRows,
  buildQuestionnaireExportRows,
  getAllQuestionnaireRecords,
  serializeQuestionnaireCsv,
} from './questionnaireResearch';

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function buildStoredZip(files: Array<{ name: string; content: string }>): Buffer {
  const localParts: Buffer[] = []; const centralParts: Buffer[] = []; let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8'); const data = Buffer.from(file.content, 'utf8'); const crc = crc32(data);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(0, 8); local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28); localParts.push(local, name, data);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0, 8); central.writeUInt16LE(0, 10); central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32); central.writeUInt16LE(0, 34); central.writeUInt16LE(0, 36); central.writeUInt32LE(0, 38); central.writeUInt32LE(offset, 42); centralParts.push(central, name); offset += local.length + name.length + data.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, ...centralParts, end]);
}

async function phaseContext(query: Record<string, unknown>) {
  const studyPhase = normalizeStudyPhaseFilter(query.studyPhase);
  return { studyPhase, schedules: studyPhase ? await getAllStudySchedules() : [] };
}

function injectQuestionnaireUi(html: string): string {
  const style = `<style>
#questionnaireSection{display:none;margin-top:14px}.q-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap}.q-controls{display:flex;gap:8px;align-items:end;flex-wrap:wrap}.q-controls label{font-size:12px;font-weight:800}.q-controls input,.q-controls select{font-size:13px;padding:7px}.q-status{font-size:12px;font-weight:800;color:#174aa8}.q-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:10px 0}.q-metric{background:#f8fbff;border:1px solid #dce7f5;border-radius:9px;padding:9px;text-align:center}.q-metric span{display:block;font-size:11px;color:#526581;font-weight:800}.q-metric b{font-size:20px}.q-table-wrap{overflow-x:auto;margin-top:10px}.q-table{width:100%;min-width:1180px;border-collapse:collapse;font-size:12px}.q-table th,.q-table td{border:1px solid #dce5f1;padding:7px 6px;text-align:center;white-space:nowrap}.q-table th{background:#f3f7fc}.q-table td:first-child,.q-table th:first-child{text-align:left;font-weight:800}.q-sig{background:#eaf3ff!important}.q-note{font-size:11px;line-height:1.5;color:#526581}.q-scale{margin-top:16px}.q-scale h3{margin:0 0 6px;font-size:16px}@media(max-width:760px){.q-metrics{grid-template-columns:1fr 1fr}.q-controls{align-items:stretch}.q-controls>*{max-width:100%}}
</style>`;
  const section = `<section id="questionnaireSection" class="card section"><div class="q-head"><div><h2 class="section-title">📊 事前・事後質問紙分析</h2><p class="q-note">15項目6件法（逆転項目なし）。全15項目＝主体的に学習に取り組む態度、A＝粘り強さ、B＝学習の自己調整、C＝L2 WTC。統計は同一research_idの事前・事後ペアだけで計算します。</p></div><div class="q-controls"><label>調査時点<select id="qWave"><option value="pre_app">事前 pre_app</option><option value="post_exchange">事後 post_exchange</option></select></label><label>Google Forms回答CSV<input id="qCsvFile" type="file" accept=".csv,text/csv"></label><button id="qImportBtn" class="secondary">回答CSVを取り込む</button><a href="/api/management/questionnaire/export.csv"><button class="secondary" type="button">質問紙CSV</button></a></div></div><p id="qStatus" class="q-status"></p><div class="q-metrics"><div class="q-metric"><span>取込レコード</span><b id="qRecords">-</b></div><div class="q-metric"><span>事前（重複なし）</span><b id="qPre">-</b></div><div class="q-metric"><span>事後（重複なし）</span><b id="qPost">-</b></div><div class="q-metric"><span>paired N</span><b id="qPair">-</b></div><div class="q-metric"><span>重複wave</span><b id="qDup">-</b></div></div><div id="qTables"></div><p class="q-note"><b>薄色セル：Holm補正後 p &lt; .05。</b> t検定は対応のあるt検定、効果量はCohen's dz。Wilcoxonは0差を除外し、n≤30は符号割当のexact、n&gt;30はtie補正＋連続性補正を用いた正規近似。効果量はrank-biserial correlation。全体4尺度を主要family、学級・学年7比較を尺度別探索familyとしてHolm補正します。</p></section>`;
  const script = `<script>
(function(){
  function q$(id){return document.getElementById(id)}
  function fmt(v,d){return v===null||v===undefined||!isFinite(Number(v))?'—':Number(v).toFixed(d===undefined?3:d)}
  function pfmt(v){if(v===null||v===undefined||!isFinite(Number(v)))return '—';var n=Number(v);return n<.001?'&lt;.001':n.toFixed(3)}
  function ms(m,s){return m===null?'—':fmt(m,2)+' ('+fmt(s,2)+')'}
  function cell(text,cls){return '<td'+(cls?' class="'+cls+'"':'')+'>'+text+'</td>'}
  function render(data){
    q$('qRecords').textContent=data.counts.records;q$('qPre').textContent=data.counts.preUnique;q$('qPost').textContent=data.counts.postUnique;q$('qPair').textContent=data.counts.paired;q$('qDup').textContent=data.counts.duplicateWaveKeys;
    var metrics=[['total','主体的に学習に取り組む態度'],['persistence','粘り強さ'],['self_regulation','学習の自己調整'],['l2wtc','L2 WTC']];
    var html='';
    metrics.forEach(function(pair){var rows=data.rows.filter(function(r){return r.metric===pair[0]});html+='<div class="q-scale"><h3>'+pair[1]+'</h3><div class="q-table-wrap"><table class="q-table"><thead><tr><th>対象</th><th>Pre N</th><th>Post N</th><th>Pair N</th><th>Pre M(SD)</th><th>Post M(SD)</th><th>ΔM</th><th>t(df)</th><th>t p raw/Holm</th><th>dz</th><th>W</th><th>W p raw/Holm</th><th>r_rb</th></tr></thead><tbody>';
      rows.forEach(function(r){var tcls=r.tSignificant?'q-sig':'';var wcls=r.wilcoxonSignificant?'q-sig':'';html+='<tr>'+cell(r.groupLabel)+cell(r.nPre)+cell(r.nPost)+cell(r.nPair)+cell(ms(r.preMean,r.preSd))+cell(ms(r.postMean,r.postSd))+cell(fmt(r.deltaMean,2))+cell(r.t===null?'—':fmt(r.t,2)+' ('+r.df+')')+cell(pfmt(r.tRawP)+' / '+pfmt(r.tHolmP),tcls)+cell(fmt(r.cohenDz,2),tcls)+cell(fmt(r.wilcoxonW,2))+cell(pfmt(r.wilcoxonRawP)+' / '+pfmt(r.wilcoxonHolmP),wcls)+cell(fmt(r.rankBiserial,2),wcls)+'</tr>'});
      html+='</tbody></table></div></div>'});q$('qTables').innerHTML=html;
  }
  async function load(){try{var res=await fetch('/api/management/questionnaire/statistics',{credentials:'same-origin'});if(res.status===401||res.status===403)return;var data=await res.json();if(!res.ok||!data.success)throw new Error(data.error||'LOAD_FAILED');q$('questionnaireSection').style.display='block';render(data)}catch(e){if(q$('questionnaireSection').style.display!=='none')q$('qStatus').textContent='質問紙統計を読み込めません: '+e.message}}
  async function importCsv(){var file=q$('qCsvFile').files&&q$('qCsvFile').files[0];if(!file){q$('qStatus').textContent='CSVファイルを選択してください。';return}q$('qImportBtn').disabled=true;q$('qStatus').textContent='取込中…';try{var csvText=await file.text();var res=await fetch('/api/management/questionnaire/import',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({surveyWave:q$('qWave').value,csvText:csvText})});var data=await res.json();if(!res.ok||!data.success)throw new Error(data.error||'IMPORT_FAILED');q$('qStatus').textContent='取込: '+data.imported+'件／既取込: '+data.alreadyImported+'件／除外: '+data.rejected+'件';await load()}catch(e){q$('qStatus').textContent='取込失敗: '+e.message}finally{q$('qImportBtn').disabled=false}}
  q$('qImportBtn').addEventListener('click',importCsv);var tries=0;(function waitPanel(){tries++;var panel=q$('panel');if(panel&&panel.style.display!=='none'){load();return}if(tries<600)setTimeout(waitPanel,500)})();
})();
</script>`;
  let out = html;
  if (out.includes('</style>')) out = out.replace('</style>', `</style>${style}`);
  if (out.includes('</body>')) out = out.replace('</body>', `${section}${script}</body>`);
  return out;
}

function managementWrapper(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    const originalSend = res.send.bind(res);
    (res as any).send = (body: any) => originalSend(typeof body === 'string' && body.includes('</body>') ? injectQuestionnaireUi(body) : body);
    return handler(req, res, next);
  };
}

function dashboardWrapper(handler: RequestHandler): RequestHandler {
  return async (req, res, next) => {
    try {
      const qRecords = await getAllQuestionnaireRecords();
      const qRows = buildQuestionnaireExportRows(qRecords, req.query as Record<string, unknown>);
      const qCodebookCount = buildQuestionnaireCodebookRows().length;
      const originalJson = res.json.bind(res);
      (res as any).json = (body: any) => {
        if (!body || body.success === false) return originalJson(body);
        const exportFiles = Array.isArray(body.exportFiles) ? body.exportFiles.map((file: any) => file.dataset === 'codebook' ? { ...file, rowCount: Number(file.rowCount || 0) + qCodebookCount } : file) : [];
        exportFiles.splice(Math.max(0, exportFiles.length - 1), 0, { dataset: 'student_questionnaires', label: 'student_questionnaires.csv', rowCount: qRows.length });
        return originalJson({ ...body, exportFiles, questionnaireRowCount: qRows.length });
      };
      return handler(req, res, next);
    } catch (error: any) {
      console.error('Questionnaire dashboard wrapper failed', { message: error?.message });
      return handler(req, res, next);
    }
  };
}

function csvWrapper(handler: RequestHandler): RequestHandler {
  return async (req, res, next) => {
    const requested = typeof req.query?.dataset === 'string' ? req.query.dataset : 'sessions';
    try {
      if (requested === 'student_questionnaires') {
        const rows = buildQuestionnaireExportRows(await getAllQuestionnaireRecords(), req.query as Record<string, unknown>);
        res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="student_questionnaires.csv"');res.setHeader('Cache-Control','no-store');return res.send(serializeQuestionnaireCsv(rows));
      }
      if (requested === 'codebook') {
        const ai = buildResearchExportDataSets([]);
        const rows = [...ai.codebook, ...buildResearchLessonReflectionCodebookRows(), ...buildQuestionnaireCodebookRows()];
        res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="codebook.csv"');res.setHeader('Cache-Control','no-store');return res.send(serializeResearchCsv(rows,'codebook'));
      }
      return handler(req, res, next);
    } catch (error: any) {
      console.error('Questionnaire research CSV wrapper failed', { message: error?.message });
      return res.status(503).json({ success:false, error:'QUESTIONNAIRE_EXPORT_UNAVAILABLE' });
    }
  };
}

const bundleHandler: RequestHandler = async (req, res) => {
  try {
    const query = req.query as Record<string, unknown>; const exportQuery = normalizeFormalResearchExportQuery(query); const { studyPhase, schedules } = await phaseContext(query);
    const [sourceSessions, lessonReflections, questionnaireRecords] = await Promise.all([getAllSessionsForManagement(), getAllReflectionRecordsForTeacher(), getAllQuestionnaireRecords()]);
    const phaseSessions = filterSessionsForStudyPhase(sourceSessions, schedules, studyPhase); const phaseReflections = filterReflectionsForStudyPhase(lessonReflections, schedules, studyPhase);
    const datasets = filterResearchExportDataSets(buildResearchExportDataSets(phaseSessions), exportQuery); const lessonRows = buildResearchLessonReflectionRows(phaseReflections, exportQuery); const qRows = buildQuestionnaireExportRows(questionnaireRecords, query);
    const codebookRows = [...datasets.codebook, ...buildResearchLessonReflectionCodebookRows(), ...buildQuestionnaireCodebookRows()]; const exportedAt = new Date().toISOString();
    const rowCounts = { sessions:datasets.sessions.length, utterances:datasets.utterances.length, expressions:datasets.expressions.length, personas:datasets.personas.length, lesson_reflections:lessonRows.length, student_questionnaires:qRows.length, codebook:codebookRows.length };
    const manifest = { export_id:`export_${Date.now()}`, exported_at:exportedAt, schema_version:6, filters:exportQuery, study_phase:studyPhase || 'all', row_counts:rowCounts, lesson_reflection_join_key:['research_id','local_date'], questionnaire_join_key:['research_id','survey_wave'], questionnaire_phase_filter:'not_applicable' };
    const files = [
      {name:'sessions.csv',content:serializeResearchCsv(datasets.sessions,'sessions')},{name:'utterances.csv',content:serializeResearchCsv(datasets.utterances,'utterances')},{name:'expressions.csv',content:serializeResearchCsv(datasets.expressions,'expressions')},{name:'personas.csv',content:serializeResearchCsv(datasets.personas,'personas')},{name:'lesson_reflections.csv',content:serializeResearchLessonReflectionCsv(lessonRows)},{name:'student_questionnaires.csv',content:serializeQuestionnaireCsv(qRows)},{name:'codebook.csv',content:serializeResearchCsv(codebookRows,'codebook')},
    ];
    const zip = buildStoredZip([...files,{name:'manifest.json',content:JSON.stringify(manifest,null,2)}]); res.setHeader('Content-Type','application/zip');res.setHeader('Content-Disposition',`attachment; filename="research-bundle-${exportedAt.slice(0,10).replace(/-/g,'')}.zip"`);res.setHeader('Cache-Control','no-store');return res.send(zip);
  } catch (error: any) { console.error('Questionnaire augmented bundle failed',{message:error?.message});return res.status(503).json({success:false,error:'RESEARCH_BUNDLE_UNAVAILABLE'}); }
};

export function withQuestionnaireResearchRuntime(path: string, handler: RequestHandler): RequestHandler {
  if (path === '/management') return managementWrapper(handler);
  if (path === '/api/management/research.dashboard') return dashboardWrapper(handler);
  if (path === '/api/management/research.csv') return csvWrapper(handler);
  if (path === '/api/management/research.bundle.zip') return bundleHandler;
  return handler;
}
