import type { RequestHandler } from 'express';
import {
  RESEARCH_EXPORT_HEADERS,
  buildResearchExportDataSets,
  filterResearchExportDataSets,
  normalizeFormalResearchExportQuery,
  type ResearchFilterQuery,
} from './researchDashboard';
import { getAllSessionsForManagement } from './persistence';
import { getAllReflectionRecordsForTeacher } from './reflectionPersistence';
import {
  buildResearchLessonReflectionCodebookRows,
  buildResearchLessonReflectionRows,
  serializeResearchLessonReflectionCsv,
} from './researchLessonReflectionExport';
import {
  getAllStudySchedules,
  phaseForLocalDate,
  type StudyScheduleRecord,
} from './studySchedulePersistence';
import {
  filterReflectionsForStudyPhase,
  filterSessionsForStudyPhase,
  normalizeStudyPhaseFilter,
} from './researchPhaseRuntime';
import {
  buildQuestionnaireCodebookRows,
  buildQuestionnaireExportRows,
  getAllQuestionnaireRecords,
  serializeQuestionnaireCsv,
} from './questionnaireResearch';

export const PHASE_RESEARCH_EXPORT_SCHEMA_VERSION = 'research-2026-v5';
export const PHASE_BUNDLE_MANIFEST_SCHEMA_VERSION = 7;

export const PHASE_IDS = ['phase1', 'phase2', 'phase3', 'phase4'] as const;
export type PhaseId = typeof PHASE_IDS[number];

type Row = Record<string, any>;
type PhaseStats = {
  phase: PhaseId;
  label: string;
  sessions: number;
  eligibleSessions: number;
  matchedSessions: number;
  sessionSharePercent: number | null;
  participantN: number;
  participantMeanSharePercent: number | null;
};

const PHASE_LABELS: Record<PhaseId, string> = {
  phase1: 'Phase 1',
  phase2: 'Phase 2',
  phase3: 'Phase 3',
  phase4: 'Phase 4',
};

function phaseIdForRow(row: Row, schedules: StudyScheduleRecord[]): PhaseId | '' {
  const schedule = schedules.find((item) => item.classId === String(row.class_id || row.classId || ''));
  const localDate = String(row.local_date || row.localDate || '');
  if (!schedule || !localDate) return '';
  const phase = phaseForLocalDate(localDate, schedule);
  if (phase === 'unknown_virtual_other') return 'phase1';
  if (phase === 'anticipated_other') return 'phase2';
  if (phase === 'identified_real_other') return 'phase3';
  if (phase === 'exchange_or_after') return 'phase4';
  return '';
}

export function normalizedResearchCountry(value: unknown): string {
  const raw = String(value || '').trim().toLowerCase().replace(/[._-]/g, ' ').replace(/\s+/g, ' ');
  const aliases: Record<string, string> = {
    usa: 'united states',
    'u s a': 'united states',
    'united states of america': 'united states',
    uk: 'united kingdom',
    'u k': 'united kingdom',
    'great britain': 'united kingdom',
    korea: 'south korea',
    'republic of korea': 'south korea',
  };
  return aliases[raw] || raw;
}

function comparisonQuery(query: Record<string, unknown>): ResearchFilterQuery {
  const cleaned: Record<string, unknown> = { ...query, dataScope: 'main' };
  delete cleaned.personaId;
  delete cleaned.studyPhase;
  delete cleaned.dataset;
  return cleaned as ResearchFilterQuery;
}

function requestedDataScope(query: Record<string, unknown>): string {
  return typeof query.dataScope === 'string' && query.dataScope.trim() ? query.dataScope.trim() : 'main';
}

export function buildPhaseComparison(
  rawSessions: Row[],
  schedules: StudyScheduleRecord[],
  query: Record<string, unknown> = {},
) {
  const scope = requestedDataScope(query);
  if (!['main', 'all'].includes(scope)) {
    return {
      applicable: false,
      reason: 'ResearchPhaseは本研究データのみを対象にします。',
      filterNote: 'Phase比較はPersona・研究Phaseフィルタを除外して集計します。',
      phases: PHASE_IDS.map((phase) => ({
        phase,
        label: PHASE_LABELS[phase],
        sessions: 0,
        eligibleSessions: 0,
        matchedSessions: 0,
        sessionSharePercent: null,
        participantN: 0,
        participantMeanSharePercent: null,
      })),
    };
  }

  const data = filterResearchExportDataSets(
    buildResearchExportDataSets(rawSessions),
    comparisonQuery(query),
  );
  const buckets = new Map<PhaseId, { sessions: number; eligible: number; matched: number; participants: Map<string, { eligible: number; matched: number }> }>();
  for (const phase of PHASE_IDS) buckets.set(phase, { sessions: 0, eligible: 0, matched: 0, participants: new Map() });

  for (const row of data.sessions) {
    const phase = phaseIdForRow(row, schedules);
    if (!phase) continue;
    const bucket = buckets.get(phase)!;
    bucket.sessions += 1;
    const assigned = normalizedResearchCountry(row.assigned_partner_country);
    const selected = normalizedResearchCountry(row.persona_country);
    if (!assigned || !selected) continue;
    bucket.eligible += 1;
    const matched = assigned === selected ? 1 : 0;
    bucket.matched += matched;
    const researchId = String(row.research_id || '');
    if (!researchId) continue;
    const participant = bucket.participants.get(researchId) || { eligible: 0, matched: 0 };
    participant.eligible += 1;
    participant.matched += matched;
    bucket.participants.set(researchId, participant);
  }

  const phases: PhaseStats[] = PHASE_IDS.map((phase) => {
    const bucket = buckets.get(phase)!;
    const participantShares = Array.from(bucket.participants.values())
      .filter((item) => item.eligible > 0)
      .map((item) => (item.matched / item.eligible) * 100);
    const participantMean = participantShares.length
      ? participantShares.reduce((sum, value) => sum + value, 0) / participantShares.length
      : null;
    return {
      phase,
      label: PHASE_LABELS[phase],
      sessions: bucket.sessions,
      eligibleSessions: bucket.eligible,
      matchedSessions: bucket.matched,
      sessionSharePercent: bucket.eligible ? Math.round((bucket.matched / bucket.eligible) * 1000) / 10 : null,
      participantN: participantShares.length,
      participantMeanSharePercent: participantMean === null ? null : Math.round(participantMean * 10) / 10,
    };
  });

  return {
    applicable: true,
    reason: '',
    filterNote: 'Phase比較はPersona・研究Phaseフィルタを除外し、開始日・終了日・データ区分・学年・学級・テーマ・complete条件を反映します。',
    phase1Note: 'Phase 1は、後に担当となる国のPersonaとの一致率です。児童はこの時点では担当国を知りません。',
    phases,
  };
}

export function augmentSessionRowsWithPhase(rows: Row[], schedules: StudyScheduleRecord[]): Row[] {
  return rows.map((row) => {
    const studyPhase = phaseIdForRow(row, schedules);
    const assigned = normalizedResearchCountry(row.assigned_partner_country);
    const selected = normalizedResearchCountry(row.persona_country);
    const eligible = Boolean(studyPhase && assigned && selected);
    return {
      ...row,
      research_schema_version: PHASE_RESEARCH_EXPORT_SCHEMA_VERSION,
      study_phase: studyPhase,
      assigned_country_persona_eligible: eligible ? 1 : 0,
      assigned_country_persona_match: eligible ? (assigned === selected ? 1 : 0) : '',
    };
  });
}

export const PHASE_SESSION_EXPORT_HEADERS = (() => {
  const headers = [...RESEARCH_EXPORT_HEADERS.sessions];
  const insertAt = Math.max(0, headers.indexOf('assignment_announced_at') + 1);
  headers.splice(insertAt, 0, 'study_phase', 'assigned_country_persona_eligible', 'assigned_country_persona_match');
  return headers;
})();

export const PHASE_CODEBOOK_ROWS = [
  {
    file_name: 'sessions.csv', variable: 'study_phase',
    definition: 'Study Scheduleの学級別日程とlocal_dateからphaseForLocalDateで算出した研究Phase',
    data_type: 'string', allowed_values: 'phase1 | phase2 | phase3 | phase4 | blank',
    analysis_use: '対話相手の段階的具体化に伴う縦断比較',
  },
  {
    file_name: 'sessions.csv', variable: 'assigned_country_persona_eligible',
    definition: 'study_phase、担当国、選択Persona国がすべて判定可能な場合1',
    data_type: 'number', allowed_values: '0 | 1',
    analysis_use: '担当国Persona選択率の分母判定',
  },
  {
    file_name: 'sessions.csv', variable: 'assigned_country_persona_match',
    definition: '比較可能sessionで担当留学生の国と選択Personaの国が一致した場合1、不一致0、比較不能は空欄',
    data_type: 'number', allowed_values: '0 | 1 | blank',
    analysis_use: 'Phase別担当国Persona選択率',
  },
];

function phaseAwareCodebook(baseRows: Row[]): Row[] {
  return [
    ...baseRows.map((row) => row.variable === 'research_schema_version'
      ? { ...row, allowed_values: PHASE_RESEARCH_EXPORT_SCHEMA_VERSION }
      : row),
    ...PHASE_CODEBOOK_ROWS,
  ];
}

function safeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let text = typeof value === 'string' ? value : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function serializeRows(rows: Row[], headers: string[]): string {
  const lines = [headers.map(safeCsvCell).join(',')];
  for (const row of rows) lines.push(headers.map((header) => safeCsvCell(row[header])).join(','));
  return `\uFEFF${lines.join('\n')}\n`;
}

function scheduleSnapshot(schedules: StudyScheduleRecord[]) {
  return Object.fromEntries(schedules.map((schedule) => [schedule.classId, {
    revision: schedule.revision,
    appStartDate: schedule.appStartDate,
    nationalityRevealDate: schedule.nationalityRevealDate,
    videoViewDate: schedule.videoViewDate,
    exchangeDate: schedule.exchangeDate,
  }]));
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildStoredZip(files: Array<{ name: string; content: string }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const data = Buffer.from(file.content, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    localParts.push(local, name, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0, 8); central.writeUInt16LE(0, 10);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32); central.writeUInt16LE(0, 34); central.writeUInt16LE(0, 36); central.writeUInt32LE(0, 38); central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, ...centralParts, end]);
}

function injectPhaseAnalyticsUi(html: string): string {
  const oldIndicators = '<div class="research-indicators section"><div class="card indicator"><h3>告知前／告知後セッション</h3><b><span id="iBefore">-</span> / <span id="iAfter">-</span></b><p>担当留学生の告知日時が登録されている児童のみを集計</p></div><div class="card indicator"><h3>告知後・担当国Persona選択率</h3><b id="iCountryShare">-</b><p id="iCountryDetail">対象データなし</p></div><div class="card indicator"><h3>個別利用らしいセッション</h3><b id="iIndividual">-</b><p id="iIndividualDetail">対象データなし</p></div></div>';
  const newIndicators = '<div class="research-indicators section"><div class="card indicator"><h3>Phase別セッション数</h3><div id="iPhaseCounts" class="phase-mini">読み込み中…</div><p id="iPhaseCountNote">Phase 1〜4をStudy 1日程から判定</p></div><div class="card indicator"><h3>担当国Persona選択率（Phase別）</h3><b id="iPhaseCountryHeadline">-</b><p id="iPhaseCountryDetail">児童平均を主指標として表示</p></div><div class="card indicator"><h3>個別利用らしいセッション（推定）</h3><b id="iIndividual">-</b><p id="iIndividualDetail">対象データなし</p><p>同学級の開始時刻集中度から推定。家庭利用を直接示すものではありません。</p></div><span id="iBefore" hidden></span><span id="iAfter" hidden></span><span id="iCountryShare" hidden></span><span id="iCountryDetail" hidden></span></div>';
  if (!html.includes(oldIndicators)) throw new Error('PHASE_ANALYTICS_INDICATOR_ANCHOR_MISSING');
  let out = html.replace(oldIndicators, newIndicators);

  const reflectionCard = '<div class="card chart-card"><h3 id="chartReflectionTitle">AI対話ふりかえり平均（4件法）</h3><div id="chartReflection" class="chart"></div></div></div>';
  const phaseCard = '<div class="card chart-card"><h3>担当国Persona選択率のPhase別変化</h3><div id="chartPhaseCountry" class="chart"></div><p id="chartPhaseNote" class="muted" style="font-size:11px"></p></div></div>';
  if (!out.includes(reflectionCard)) throw new Error('PHASE_ANALYTICS_CHART_ANCHOR_MISSING');
  out = out.replace(reflectionCard, reflectionCard.replace('</div></div>', '</div></div>') + phaseCard.replace(/^/, '').replace('</div></div>', '</div></div>'));
  // The previous replacement creates an extra charts close; normalize to five cards under one charts container.
  out = out.replace('</div></div><div class="card chart-card"><h3>担当国Persona選択率のPhase別変化</h3>', '</div><div class="card chart-card"><h3>担当国Persona選択率のPhase別変化</h3>');

  const extraStyle = '<style>.phase-mini{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 10px;font-size:13px}.phase-mini b{font-size:18px}.phase-rate-row{display:grid;grid-template-columns:80px 1fr 58px;gap:8px;align-items:center;margin:16px 4px}.phase-rate-track{height:18px;background:#edf3ff;border-radius:999px;overflow:hidden}.phase-rate-fill{height:100%;background:#4d8df7;border-radius:999px}.phase-rate-label{font-weight:800;color:#425878}.phase-rate-value{font-weight:900;text-align:right}.phase-rate-sub{grid-column:2/4;font-size:11px;color:#64748b;margin-top:-4px}@media(max-width:760px){.phase-mini{grid-template-columns:1fr 1fr}.phase-rate-row{grid-template-columns:70px 1fr 52px}}</style>';
  out = out.replace('</head>', `${extraStyle}</head>`);

  const script = `<script>
(function(){
  function p$(id){return document.getElementById(id)}
  function pct(value){return value===null||value===undefined||!isFinite(Number(value))?'—':Number(value).toFixed(1)+'%'}
  function phaseParams(){
    var p=typeof filterParams==='function'?filterParams():new URLSearchParams();
    p.delete('personaId');p.delete('studyPhase');p.delete('dataset');
    return p;
  }
  function renderPhaseComparison(data){
    var box=p$('iPhaseCounts'), headline=p$('iPhaseCountryHeadline'), detail=p$('iPhaseCountryDetail'), chart=p$('chartPhaseCountry'), note=p$('chartPhaseNote');
    if(!box||!headline||!detail||!chart)return;
    var pc=data&&data.phaseComparison;
    if(!pc||!pc.applicable){
      box.textContent='対象外';headline.textContent='対象外';detail.textContent=pc&&pc.reason?pc.reason:'ResearchPhaseは本研究データのみを対象にします。';chart.innerHTML='<div class="muted" style="padding:28px 8px">対象外</div>';if(note)note.textContent=detail.textContent;return;
    }
    box.innerHTML=pc.phases.map(function(r){return '<div>'+r.label+' <b>'+r.sessions+'</b></div>'}).join('');
    var p2=pc.phases.find(function(r){return r.phase==='phase2'}), p3=pc.phases.find(function(r){return r.phase==='phase3'});
    headline.textContent=(p3&&p3.participantMeanSharePercent!==null)?'Phase 3 '+pct(p3.participantMeanSharePercent):(p2&&p2.participantMeanSharePercent!==null?'Phase 2 '+pct(p2.participantMeanSharePercent):'—');
    detail.textContent='児童平均を主表示。'+pc.filterNote;
    chart.innerHTML=pc.phases.map(function(r){var v=r.participantMeanSharePercent===null?0:Math.max(0,Math.min(100,Number(r.participantMeanSharePercent)));return '<div class="phase-rate-row"><div class="phase-rate-label">'+r.label+'</div><div class="phase-rate-track"><div class="phase-rate-fill" style="width:'+v+'%"></div></div><div class="phase-rate-value">'+pct(r.participantMeanSharePercent)+'</div><div class="phase-rate-sub">児童 n='+r.participantN+' ／ session '+r.matchedSessions+'/'+r.eligibleSessions+' = '+pct(r.sessionSharePercent)+'</div></div>'}).join('');
    if(note)note.textContent=pc.phase1Note+' '+pc.filterNote;
  }
  async function loadPhaseComparison(){
    try{var res=await fetch('/api/management/research.dashboard?'+phaseParams().toString(),{credentials:'same-origin'});if(res.status===401||res.status===403)return;var data=await res.json();if(res.ok&&data&&data.success!==false)renderPhaseComparison(data)}catch(_error){}
  }
  ['filterBtn','refreshBtn','resetBtn'].forEach(function(id){var el=p$(id);if(el)el.addEventListener('click',function(){setTimeout(loadPhaseComparison,120)})});
  ['start','end','dataScope','grade','classId','personaId','studyPhase','topic','completeOnly'].forEach(function(id){var el=p$(id);if(el)el.addEventListener('change',function(){setTimeout(loadPhaseComparison,120)})});
  var tries=0;(function waitPanel(){tries++;var panel=p$('panel');if(panel&&panel.style.display!=='none'){loadPhaseComparison();return}if(tries<600)setTimeout(waitPanel,500)})();
})();
</script>`;
  return out.replace('</body>', `${script}</body>`);
}

function managementWrapper(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    const originalSend = res.send.bind(res);
    (res as any).send = (body: any) => originalSend(typeof body === 'string' && body.includes('</body>') ? injectPhaseAnalyticsUi(body) : body);
    return handler(req, res, next);
  };
}

function dashboardWrapper(handler: RequestHandler): RequestHandler {
  return async (req, res, next) => {
    try {
      const [sessions, schedules] = await Promise.all([getAllSessionsForManagement(), getAllStudySchedules()]);
      const phaseComparison = buildPhaseComparison(sessions, schedules, req.query as Record<string, unknown>);
      const originalJson = res.json.bind(res);
      (res as any).json = (body: any) => {
        if (!body || body.success === false) return originalJson(body);
        const exportFiles = Array.isArray(body.exportFiles)
          ? body.exportFiles.map((file: any) => file.dataset === 'codebook'
            ? { ...file, rowCount: Number(file.rowCount || 0) + PHASE_CODEBOOK_ROWS.length }
            : file)
          : body.exportFiles;
        return originalJson({ ...body, phaseComparison, exportFiles });
      };
      return handler(req, res, next);
    } catch (error: any) {
      console.error('Research phase analytics dashboard wrapper failed', { message: error?.message });
      return handler(req, res, next);
    }
  };
}

function csvWrapper(handler: RequestHandler): RequestHandler {
  return async (req, res, next) => {
    const requested = typeof req.query?.dataset === 'string' ? req.query.dataset : 'sessions';
    if (requested !== 'sessions' && requested !== 'codebook') return handler(req, res, next);
    try {
      if (requested === 'codebook') {
        const base = buildResearchExportDataSets([]);
        const rows = phaseAwareCodebook([
          ...base.codebook,
          ...buildResearchLessonReflectionCodebookRows(),
          ...buildQuestionnaireCodebookRows(),
        ]);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="codebook.csv"');
        res.setHeader('Cache-Control', 'no-store');
        return res.send(serializeRows(rows, RESEARCH_EXPORT_HEADERS.codebook));
      }
      const query = req.query as Record<string, unknown>;
      const schedules = await getAllStudySchedules();
      const source = await getAllSessionsForManagement();
      const requestedPhase = normalizeStudyPhaseFilter(query.studyPhase);
      const phaseSessions = filterSessionsForStudyPhase(source, schedules, requestedPhase);
      const datasets = filterResearchExportDataSets(buildResearchExportDataSets(phaseSessions), normalizeFormalResearchExportQuery(query));
      const rows = augmentSessionRowsWithPhase(datasets.sessions, schedules);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="sessions.csv"');
      res.setHeader('Cache-Control', 'no-store');
      return res.send(serializeRows(rows, PHASE_SESSION_EXPORT_HEADERS));
    } catch (error: any) {
      console.error('Research phase analytics CSV failed', { message: error?.message });
      return res.status(503).json({ success: false, error: 'RESEARCH_EXPORT_UNAVAILABLE' });
    }
  };
}

const bundleHandler: RequestHandler = async (req, res) => {
  try {
    const query = req.query as Record<string, unknown>;
    const exportQuery = normalizeFormalResearchExportQuery(query);
    const studyPhase = normalizeStudyPhaseFilter(query.studyPhase);
    const [schedules, sourceSessions, lessonReflections, questionnaireRecords] = await Promise.all([
      getAllStudySchedules(),
      getAllSessionsForManagement(),
      getAllReflectionRecordsForTeacher(),
      getAllQuestionnaireRecords(),
    ]);
    const phaseSessions = filterSessionsForStudyPhase(sourceSessions, schedules, studyPhase);
    const phaseReflections = filterReflectionsForStudyPhase(lessonReflections, schedules, studyPhase);
    const datasets = filterResearchExportDataSets(buildResearchExportDataSets(phaseSessions), exportQuery);
    const sessionRows = augmentSessionRowsWithPhase(datasets.sessions, schedules);
    const lessonRows = buildResearchLessonReflectionRows(phaseReflections, exportQuery);
    const questionnaireRows = buildQuestionnaireExportRows(questionnaireRecords, query);
    const codebookRows = phaseAwareCodebook([
      ...datasets.codebook,
      ...buildResearchLessonReflectionCodebookRows(),
      ...buildQuestionnaireCodebookRows(),
    ]);
    const exportedAt = new Date().toISOString();
    const rowCounts = {
      sessions: sessionRows.length,
      utterances: datasets.utterances.length,
      expressions: datasets.expressions.length,
      personas: datasets.personas.length,
      lesson_reflections: lessonRows.length,
      student_questionnaires: questionnaireRows.length,
      codebook: codebookRows.length,
    };
    const manifest = {
      export_id: `export_${Date.now()}`,
      exported_at: exportedAt,
      schema_version: PHASE_BUNDLE_MANIFEST_SCHEMA_VERSION,
      research_export_schema_version: PHASE_RESEARCH_EXPORT_SCHEMA_VERSION,
      filters: exportQuery,
      study_phase: studyPhase || 'all',
      study_schedule_snapshot: scheduleSnapshot(schedules),
      phase_definition_source: 'study_schedules + phaseForLocalDate(local_date)',
      phase_comparison_filter_exclusions: ['personaId', 'studyPhase'],
      assigned_country_persona_definition: 'assigned_partner_country compared with persona_country after country normalization',
      assignment_country_provenance: 'session assignment when stored; management retrieval may fall back to the current student assignment record',
      row_counts: rowCounts,
      lesson_reflection_join_key: ['research_id', 'local_date'],
      questionnaire_join_key: ['research_id', 'survey_wave'],
      questionnaire_phase_filter: 'not_applicable',
    };
    const files = [
      { name: 'sessions.csv', content: serializeRows(sessionRows, PHASE_SESSION_EXPORT_HEADERS) },
      { name: 'utterances.csv', content: serializeRows(datasets.utterances, RESEARCH_EXPORT_HEADERS.utterances) },
      { name: 'expressions.csv', content: serializeRows(datasets.expressions, RESEARCH_EXPORT_HEADERS.expressions) },
      { name: 'personas.csv', content: serializeRows(datasets.personas, RESEARCH_EXPORT_HEADERS.personas) },
      { name: 'lesson_reflections.csv', content: serializeResearchLessonReflectionCsv(lessonRows) },
      { name: 'student_questionnaires.csv', content: serializeQuestionnaireCsv(questionnaireRows) },
      { name: 'codebook.csv', content: serializeRows(codebookRows, RESEARCH_EXPORT_HEADERS.codebook) },
    ];
    const zip = buildStoredZip([...files, { name: 'manifest.json', content: JSON.stringify(manifest, null, 2) }]);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="research-bundle-${exportedAt.slice(0, 10).replace(/-/g, '')}.zip"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(zip);
  } catch (error: any) {
    console.error('Research phase analytics bundle failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'RESEARCH_BUNDLE_UNAVAILABLE' });
  }
};

export function withResearchPhaseAnalyticsRuntime(path: string, handler: RequestHandler): RequestHandler {
  if (path === '/management') return managementWrapper(handler);
  if (path === '/api/management/research.dashboard') return dashboardWrapper(handler);
  if (path === '/api/management/research.csv') return csvWrapper(handler);
  if (path === '/api/management/research.bundle.zip') return bundleHandler;
  return handler;
}
