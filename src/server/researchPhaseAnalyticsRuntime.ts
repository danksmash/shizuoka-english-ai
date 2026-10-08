import type { RequestHandler } from 'express';
import {
  RESEARCH_EXPORT_HEADERS,
  buildResearchExportDataSets,
  filterResearchExportDataSets,
  filterResearchSessionRows,
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
  analysisPeriodForLocalDate,
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

export const PHASE_RESEARCH_EXPORT_SCHEMA_VERSION = 'research-2026-v10';
export const PHASE_BUNDLE_MANIFEST_SCHEMA_VERSION = 10;

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
  visitorEligibleSessions: number;
  visitorMatchedSessions: number;
  visitorSessionSharePercent: number | null;
  visitorParticipantN: number;
  visitorParticipantMeanSharePercent: number | null;
};

const PHASE_LABELS: Record<PhaseId, string> = {
  phase1: 'Phase 1',
  phase2: 'Phase 2',
  phase3: 'Phase 3',
  phase4: 'Phase 4',
};

function phaseIdForRow(row: Row, schedules: StudyScheduleRecord[]): PhaseId | '' {
  if (String(row.school_condition || row.schoolCondition || '') === 'comparison') return '';
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
  const cleaned: Record<string, unknown> = { ...query, dataScope: 'main', schoolCondition: 'intervention' };
  delete cleaned.personaId;
  delete cleaned.studyPhase;
  delete cleaned.dataset;
  return cleaned as ResearchFilterQuery;
}

function requestedDataScope(query: Record<string, unknown>): string {
  return typeof query.dataScope === 'string' && query.dataScope.trim() ? query.dataScope.trim() : 'main';
}

export function buildPhaseComparisonFromExportSessions(
  exportSessions: Row[],
  schedules: StudyScheduleRecord[],
  query: Record<string, unknown> = {},
) {
  const scope = requestedDataScope(query);
  const requestedCondition = typeof query.schoolCondition === 'string' ? query.schoolCondition.trim() : '';
  const emptyPhase = (phase: PhaseId): PhaseStats => ({
    phase,
    label: PHASE_LABELS[phase],
    sessions: 0,
    eligibleSessions: 0,
    matchedSessions: 0,
    sessionSharePercent: null,
    participantN: 0,
    participantMeanSharePercent: null,
    visitorEligibleSessions: 0,
    visitorMatchedSessions: 0,
    visitorSessionSharePercent: null,
    visitorParticipantN: 0,
    visitorParticipantMeanSharePercent: null,
  });
  if (requestedCondition === 'comparison') {
    return {
      applicable: false,
      reason: 'ResearchPhaseは国籍告知・本人動画・実在留学生交流を行う実践校のみを対象にします。比較校はPhase 1～4へ割り当てません。',
      filterNote: '比較校は同じ相対経過時点でPre／Mid／Postを実施しますが、Phase分析には含めません。',
      phases: PHASE_IDS.map(emptyPhase),
    };
  }
  if (!['main', 'all'].includes(scope)) {
    return {
      applicable: false,
      reason: 'ResearchPhaseは本研究データのみを対象にします。',
      filterNote: 'Phase比較はPersona・研究Phaseフィルタを除外して集計します。',
      phases: PHASE_IDS.map(emptyPhase),
    };
  }

  type MatchBucket = { eligible: number; matched: number; participants: Map<string, { eligible: number; matched: number }> };
  const buckets = new Map<PhaseId, { sessions: number; assigned: MatchBucket; visitor: MatchBucket }>();
  for (const phase of PHASE_IDS) {
    buckets.set(phase, {
      sessions: 0,
      assigned: { eligible: 0, matched: 0, participants: new Map() },
      visitor: { eligible: 0, matched: 0, participants: new Map() },
    });
  }
  const addMatch = (bucket: MatchBucket, researchId: string, matched: number) => {
    bucket.eligible += 1;
    bucket.matched += matched;
    if (!researchId) return;
    const participant = bucket.participants.get(researchId) || { eligible: 0, matched: 0 };
    participant.eligible += 1;
    participant.matched += matched;
    bucket.participants.set(researchId, participant);
  };
  const statsFor = (bucket: MatchBucket) => {
    const shares = Array.from(bucket.participants.values())
      .filter((item) => item.eligible > 0)
      .map((item) => (item.matched / item.eligible) * 100);
    const mean = shares.length ? shares.reduce((sum, value) => sum + value, 0) / shares.length : null;
    return {
      eligible: bucket.eligible,
      matched: bucket.matched,
      sessionShare: bucket.eligible ? Math.round((bucket.matched / bucket.eligible) * 1000) / 10 : null,
      participantN: shares.length,
      participantMean: mean === null ? null : Math.round(mean * 10) / 10,
    };
  };

  const sessions = filterResearchSessionRows(exportSessions, comparisonQuery(query));
  for (const row of sessions) {
    const phase = phaseIdForRow(row, schedules);
    if (!phase) continue;
    const classId = String(row.class_id || row.classId || '');
    const localDate = String(row.local_date || row.localDate || '');
    const schedule = schedules.find((item) => item.classId === classId);
    if (!schedule) continue;
    const bucket = buckets.get(phase)!;
    bucket.sessions += 1;
    const selected = normalizedResearchCountry(row.persona_country);
    const researchId = String(row.research_id || '');

    const visitorSet = new Set((schedule.announcedVisitorCountries || []).map(normalizedResearchCountry).filter(Boolean));
    if (selected && visitorSet.size) addMatch(bucket.visitor, researchId, visitorSet.has(selected) ? 1 : 0);

    const assigned = normalizedResearchCountry(row.assigned_partner_country);
    const assignmentKnown = Boolean(schedule.assignmentRevealDate && localDate && localDate >= schedule.assignmentRevealDate);
    if (assignmentKnown && assigned && selected) addMatch(bucket.assigned, researchId, assigned === selected ? 1 : 0);
  }

  const phases: PhaseStats[] = PHASE_IDS.map((phase) => {
    const bucket = buckets.get(phase)!;
    const assigned = statsFor(bucket.assigned);
    const visitor = statsFor(bucket.visitor);
    return {
      phase,
      label: PHASE_LABELS[phase],
      sessions: bucket.sessions,
      eligibleSessions: assigned.eligible,
      matchedSessions: assigned.matched,
      sessionSharePercent: assigned.sessionShare,
      participantN: assigned.participantN,
      participantMeanSharePercent: assigned.participantMean,
      visitorEligibleSessions: visitor.eligible,
      visitorMatchedSessions: visitor.matched,
      visitorSessionSharePercent: visitor.sessionShare,
      visitorParticipantN: visitor.participantN,
      visitorParticipantMeanSharePercent: visitor.participantMean,
    };
  });

  return {
    applicable: true,
    reason: '',
    filterNote: 'Phase比較は実践校のみを対象にし、Persona・研究Phaseフィルタを除外して、開始日・終了日・データ区分・学年・学級・テーマ・complete条件を反映します。',
    phase1Note: 'Phase 1の来校国籍群一致は、後に告知される国籍集合を分析上だけ遡及適用した基準選好です。児童はこの時点では来校国籍を知りません。',
    phase2Note: 'Phase 2は来校予定国籍群への焦点化、Phase 3は担当相手告知後の担当国への焦点化を別指標として扱います。',
    phases,
  };
}
export function buildPhaseComparison(
  rawSessions: Row[],
  schedules: StudyScheduleRecord[],
  query: Record<string, unknown> = {},
) {
  return buildPhaseComparisonFromExportSessions(
    buildResearchExportDataSets(rawSessions).sessions,
    schedules,
    query,
  );
}

export function augmentSessionRowsWithPhase(rows: Row[], schedules: StudyScheduleRecord[]): Row[] {
  return rows.map((row) => {
    const classId = String(row.class_id || row.classId || '');
    const schedule = schedules.find((item) => item.classId === classId);
    const localDate = String(row.local_date || row.localDate || '');
    const studyPhase = phaseIdForRow(row, schedules);
    const analysisPeriod = schedule ? analysisPeriodForLocalDate(localDate, schedule) : '';
    const assigned = normalizedResearchCountry(row.assigned_partner_country);
    const selected = normalizedResearchCountry(row.persona_country);
    const visitorCountries = schedule?.announcedVisitorCountries || [];
    const visitorSet = new Set(visitorCountries.map(normalizedResearchCountry).filter(Boolean));
    const visitorEligible = Boolean(schedule && selected && visitorSet.size > 0 && studyPhase);
    const assignmentKnown = Boolean(schedule?.assignmentRevealDate && localDate && localDate >= schedule.assignmentRevealDate);
    const assignedEligible = Boolean(studyPhase && assignmentKnown && assigned && selected);
    return {
      ...row,
      research_schema_version: PHASE_RESEARCH_EXPORT_SCHEMA_VERSION,
      study_phase: studyPhase,
      analysis_period: analysisPeriod,
      recipient_specificity_stage: studyPhase,
      announced_visitor_countries: visitorCountries.join('|'),
      announced_visitor_country_counts: schedule
        ? visitorCountries.map((country) => `${country}:${schedule.announcedVisitorCountryCounts[country] || 1}`).join('|')
        : '',
      nationality_reveal_date: schedule?.nationalityRevealDate || '',
      video_view_date: schedule?.videoViewDate || '',
      assignment_reveal_date: schedule?.assignmentRevealDate || '',
      visitor_country_persona_eligible: visitorEligible ? 1 : 0,
      visitor_country_persona_match: visitorEligible ? (visitorSet.has(selected) ? 1 : 0) : '',
      assignment_known_to_learner: assignmentKnown ? 1 : 0,
      assigned_country_persona_eligible: assignedEligible ? 1 : 0,
      assigned_country_persona_match: assignedEligible ? (assigned === selected ? 1 : 0) : '',
    };
  });
}
export const PHASE_SESSION_EXPORT_HEADERS = (() => {
  const headers = [...RESEARCH_EXPORT_HEADERS.sessions];
  const insertAt = Math.max(0, headers.indexOf('assignment_announced_at') + 1);
  headers.splice(insertAt, 0,
    'study_phase','analysis_period','recipient_specificity_stage',
    'announced_visitor_countries','announced_visitor_country_counts','nationality_reveal_date','video_view_date','assignment_reveal_date',
    'visitor_country_persona_eligible','visitor_country_persona_match',
    'assignment_known_to_learner','assigned_country_persona_eligible','assigned_country_persona_match'
  );
  return headers;
})();

export const PHASE_CODEBOOK_ROWS = [
  {
    file_name: 'sessions.csv', variable: 'study_phase',
    definition: 'Study Scheduleの学級別日程とlocal_dateから算出した研究Phase',
    data_type: 'string', allowed_values: 'phase1 | phase2 | phase3 | phase4 | blank',
    analysis_use: '対話相手の段階的具体化に伴う縦断比較',
  },
  {
    file_name: 'sessions.csv', variable: 'analysis_period',
    definition: '既に設定済みの基準日だけで逐次判定する主要分析期間。未来日程が未確定でもperiod1/2を確定できる',
    data_type: 'string', allowed_values: 'period1 | period2 | period3 | blank',
    analysis_use: '実践校・比較校の共通時間軸による縦断比較',
  },
  {
    file_name: 'sessions.csv', variable: 'recipient_specificity_stage',
    definition: '相手具体化段階。study_phaseと同じ段階ラベルを明示的に保持する',
    data_type: 'string', allowed_values: 'phase1 | phase2 | phase3 | phase4 | blank',
    analysis_use: '20 Persona→来校国籍群→担当相手というrecipient specificityの分析',
  },
  {
    file_name: 'sessions.csv', variable: 'announced_visitor_countries',
    definition: '学級全体に国籍告知日に提示した来校予定留学生の国籍集合。session本体を書き換えずStudy Scheduleから分析時結合する',
    data_type: 'string', allowed_values: 'country1|country2|... | blank',
    analysis_use: 'Phase 1→2の来校国籍群Persona選択率',
  },
  {
    file_name: 'sessions.csv', variable: 'announced_visitor_country_counts',
    definition: '国籍別の実際の来校予定人数をCountry:n形式で保持する補助情報',
    data_type: 'string', allowed_values: 'Country:n|... | blank',
    analysis_use: '来校者構成の再現・感度分析',
  },
  {
    file_name: 'sessions.csv', variable: 'assignment_reveal_date',
    definition: '児童が自分のグループの担当留学生を知った学級共通基準日',
    data_type: 'string', allowed_values: 'YYYY-MM-DD | blank',
    analysis_use: 'Phase 3開始と担当国Persona分析の基準',
  },
  {
    file_name: 'sessions.csv', variable: 'visitor_country_persona_eligible',
    definition: '学級の来校国籍集合と選択Persona国が判定可能な場合1。Phase 1では将来告知される集合を分析上だけ遡及適用する',
    data_type: 'number', allowed_values: '0 | 1',
    analysis_use: '来校国籍群Persona選択率の分母判定',
  },
  {
    file_name: 'sessions.csv', variable: 'visitor_country_persona_match',
    definition: '選択Persona国が来校国籍集合に含まれる場合1、不一致0、比較不能は空欄',
    data_type: 'number', allowed_values: '0 | 1 | blank',
    analysis_use: 'Phase 1→2の20→来校国籍群への焦点化',
  },
  {
    file_name: 'sessions.csv', variable: 'assignment_known_to_learner',
    definition: 'local_dateがassignment_reveal_date以降で、児童が担当相手を知っている段階なら1',
    data_type: 'number', allowed_values: '0 | 1',
    analysis_use: '担当国Persona指標の曝露時点判定',
  },
  {
    file_name: 'sessions.csv', variable: 'assigned_country_persona_eligible',
    definition: '担当相手告知後で、session時点の担当国snapshotと選択Persona国が判定可能な場合1',
    data_type: 'number', allowed_values: '0 | 1',
    analysis_use: 'Phase 3の担当国Persona選択率の分母判定',
  },
  {
    file_name: 'sessions.csv', variable: 'assigned_country_persona_match',
    definition: '担当相手告知後の比較可能sessionで担当留学生の国と選択Personaの国が一致した場合1、不一致0、比較不能は空欄',
    data_type: 'number', allowed_values: '0 | 1 | blank',
    analysis_use: 'Phase 2→3の来校国籍群→担当国への焦点化',
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
    announcedVisitorCountries: schedule.announcedVisitorCountries,
    announcedVisitorCountryCounts: schedule.announcedVisitorCountryCounts,
    videoViewDate: schedule.videoViewDate,
    assignmentRevealDate: schedule.assignmentRevealDate,
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
  const newIndicators = '<div class="research-indicators section"><div class="card indicator"><h3>実践進行確認：Phase別セッション数</h3><div id="iPhaseCounts" class="phase-mini">読み込み中…</div><p id="iPhaseCountNote">Phase 1〜4をStudy 1日程から判定</p></div><div class="card indicator"><h3>過程指標：相手選択の焦点化</h3><b id="iPhaseCountryHeadline">-</b><p id="iPhaseCountryDetail">Phase 1→2は来校国籍群、Phase 2→3は担当国を別指標で表示</p></div><div class="card indicator"><h3>個別利用らしいセッション（推定）</h3><b id="iIndividual">-</b><p id="iIndividualDetail">対象データなし</p><p>同学級の開始時刻集中度から推定。家庭利用を直接示すものではありません。</p></div><span id="iBefore" hidden></span><span id="iAfter" hidden></span><span id="iCountryShare" hidden></span><span id="iCountryDetail" hidden></span></div>';
  if (!html.includes(oldIndicators)) throw new Error('PHASE_ANALYTICS_INDICATOR_ANCHOR_MISSING');
  let out = html.replace(oldIndicators, newIndicators);

  const phaseSlot = '<div id="phaseCountryPanelSlot" class="phase-country-slot"></div>';
  const phaseCard = '<div class="card chart-card phase-country-card"><h3>過程指標：20→来校国籍群→担当国への焦点化</h3><div id="chartPhaseCountry" class="chart"></div><p id="chartPhaseNote" class="muted" style="font-size:11px"></p></div>';
  if (!out.includes(phaseSlot)) throw new Error('PHASE_ANALYTICS_LAYOUT_SLOT_MISSING');
  out = out.replace(phaseSlot, '<div id="phaseCountryPanelSlot" class="phase-country-slot">' + phaseCard + '</div>');

  const extraStyle = '<style>.phase-country-card{min-height:390px}.phase-country-card .chart{height:330px}.phase-mini{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 10px;font-size:13px}.phase-mini b{font-size:18px}.phase-rate-row{display:grid;grid-template-columns:80px 1fr 58px;gap:8px;align-items:center;margin:16px 4px}.phase-rate-track{height:18px;background:#edf3ff;border-radius:999px;overflow:hidden}.phase-rate-fill{height:100%;background:#4d8df7;border-radius:999px}.phase-rate-label{font-weight:800;color:#425878}.phase-rate-value{font-weight:900;text-align:right}.phase-rate-sub{grid-column:2/4;font-size:11px;color:#64748b;margin-top:-4px}@media(max-width:760px){.phase-mini{grid-template-columns:1fr 1fr}.phase-rate-row{grid-template-columns:70px 1fr 52px}}</style>';
  out = out.replace('</head>', `${extraStyle}</head>`);

  const script = `<script>
(function(){
  function p$(id){return document.getElementById(id)}
  function pct(value){return value===null||value===undefined||!isFinite(Number(value))?'—':Number(value).toFixed(1)+'%'}
  function row(label,value,n,matched,eligible,sessionShare){
    var v=value===null||value===undefined?0:Math.max(0,Math.min(100,Number(value)));
    return '<div class="phase-rate-row"><div class="phase-rate-label">'+label+'</div><div class="phase-rate-track"><div class="phase-rate-fill" style="width:'+v+'%"></div></div><div class="phase-rate-value">'+pct(value)+'</div><div class="phase-rate-sub">児童 n='+n+' ／ session '+matched+'/'+eligible+' = '+pct(sessionShare)+'</div></div>';
  }
  function renderPhaseComparison(data){
    var box=p$('iPhaseCounts'), headline=p$('iPhaseCountryHeadline'), detail=p$('iPhaseCountryDetail'), chart=p$('chartPhaseCountry'), note=p$('chartPhaseNote');
    if(!box||!headline||!detail||!chart)return;
    var pc=data&&data.phaseComparison;
    if(!pc||!pc.applicable){
      box.textContent='対象外';headline.textContent='対象外';detail.textContent=pc&&pc.reason?pc.reason:'ResearchPhaseは本研究データのみを対象にします。';chart.innerHTML='<div class="muted" style="padding:28px 8px">対象外</div>';if(note)note.textContent=detail.textContent;return;
    }
    box.innerHTML=pc.phases.map(function(r){return '<div>'+r.label+' <b>'+r.sessions+'</b></div>'}).join('');
    var p1=pc.phases.find(function(r){return r.phase==='phase1'}), p2=pc.phases.find(function(r){return r.phase==='phase2'}), p3=pc.phases.find(function(r){return r.phase==='phase3'});
    var visitor=p2&&p2.visitorParticipantMeanSharePercent!==null?pct(p2.visitorParticipantMeanSharePercent):'—';
    var assigned=p3&&p3.participantMeanSharePercent!==null?pct(p3.participantMeanSharePercent):'—';
    headline.textContent='来校国籍群 P2 '+visitor+' / 担当国 P3 '+assigned;
    detail.textContent='児童平均。Phase 1→2とPhase 2→3は偶然一致確率が異なるため別指標として扱います。';
    var html='<div class="muted" style="font-weight:800;margin:8px 4px">来校国籍群Persona選択率（20→集合）</div>';
    if(p1)html+=row('Phase 1',p1.visitorParticipantMeanSharePercent,p1.visitorParticipantN,p1.visitorMatchedSessions,p1.visitorEligibleSessions,p1.visitorSessionSharePercent);
    if(p2)html+=row('Phase 2',p2.visitorParticipantMeanSharePercent,p2.visitorParticipantN,p2.visitorMatchedSessions,p2.visitorEligibleSessions,p2.visitorSessionSharePercent);
    html+='<div class="muted" style="font-weight:800;margin:20px 4px 8px">担当国Persona選択率（集合→担当国）</div>';
    if(p2)html+=row('Phase 2',p2.participantMeanSharePercent,p2.participantN,p2.matchedSessions,p2.eligibleSessions,p2.sessionSharePercent);
    if(p3)html+=row('Phase 3',p3.participantMeanSharePercent,p3.participantN,p3.matchedSessions,p3.eligibleSessions,p3.sessionSharePercent);
    chart.innerHTML=html;
    if(note)note.textContent=pc.phase1Note+' '+(pc.phase2Note||'')+' '+pc.filterNote;
  }
  window.__renderPhaseComparison=renderPhaseComparison;
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
      analysis_period_definition_source: 'study_schedules + analysisPeriodForLocalDate(local_date); known boundaries are usable before future dates are configured; comparison C1/C2/Post are analysis boundaries only',
      phase_comparison_filter_exclusions: ['personaId', 'studyPhase'],
      visitor_country_persona_definition: 'announcedVisitorCountries class-level historical configuration compared with persona_country; Phase 1 uses the future announced set only as a retrospective analysis reference',
      visitor_country_provenance: 'class-level study_schedules configuration joined at export time; raw session documents are never rewritten',
      assigned_country_persona_definition: 'only after assignmentRevealDate; immutable session-time assigned_partner_country compared with persona_country after country normalization',
      assignment_country_provenance: 'immutable session-time snapshot when present; blank remains blank and is never silently backfilled from the current student assignment record',
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
