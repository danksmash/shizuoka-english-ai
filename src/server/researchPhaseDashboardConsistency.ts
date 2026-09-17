import type { RequestHandler } from 'express';
import {
  buildResearchExportDataSets,
  filterResearchExportDataSets,
  type ResearchFilterQuery,
} from './researchDashboard';
import { getAllSessionsForManagement } from './persistence';
import {
  PHASE_CODEBOOK_ROWS,
  PHASE_IDS,
  buildPhaseComparison,
} from './researchPhaseAnalyticsRuntime';
import {
  getAllStudySchedules,
  type StudyScheduleRecord,
} from './studySchedulePersistence';

type Row = Record<string, any>;
export type PhaseDashboardStatus = 'ok' | 'not_applicable' | 'schedule_missing' | 'error';

function queryText(value: unknown): string {
  if (Array.isArray(value)) return queryText(value[0]);
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function phaseDashboardDataScope(query: Record<string, unknown>): string {
  return queryText(query.dataScope) || 'main';
}

function phaseComparisonQuery(query: Record<string, unknown>): ResearchFilterQuery {
  const cleaned: Record<string, unknown> = { ...query, dataScope: 'main' };
  delete cleaned.personaId;
  delete cleaned.studyPhase;
  delete cleaned.dataset;
  return cleaned as ResearchFilterQuery;
}

function zeroPhases() {
  return PHASE_IDS.map((phase, index) => ({
    phase,
    label: `Phase ${index + 1}`,
    sessions: 0,
    eligibleSessions: 0,
    matchedSessions: 0,
    sessionSharePercent: null,
    participantN: 0,
    participantMeanSharePercent: null,
  }));
}

export function buildPhaseDashboardErrorPayload(query: Record<string, unknown>) {
  const scope = phaseDashboardDataScope(query);
  const applicable = scope === 'main' || scope === 'all';
  return {
    applicable,
    status: applicable ? 'error' as const : 'not_applicable' as const,
    reason: applicable
      ? 'Phase集計を取得できません。通常の研究データ表示とは別処理のため、対話セッション自体が失われたことを示すものではありません。'
      : 'ResearchPhaseは本研究データのみを対象にします。',
    filterNote: applicable
      ? 'Study 1日程管理とPhase集計処理を確認してください。'
      : 'Phase比較はPersona・研究Phaseフィルタを除外して集計します。',
    phases: zeroPhases(),
  };
}

export function buildConsistentPhaseComparison(
  rawSessions: Row[],
  schedules: StudyScheduleRecord[],
  query: Record<string, unknown> = {},
) {
  const scope = phaseDashboardDataScope(query);
  if (scope !== 'main' && scope !== 'all') {
    const base = buildPhaseComparison(rawSessions, schedules, { ...query, dataScope: scope });
    return { ...base, applicable: false, status: 'not_applicable' as const };
  }

  const normalizedQuery = { ...query, dataScope: scope };
  const base = buildPhaseComparison(rawSessions, schedules, normalizedQuery);
  const candidates = filterResearchExportDataSets(
    buildResearchExportDataSets(rawSessions),
    phaseComparisonQuery(normalizedQuery),
  ).sessions;
  const byClass = new Map(schedules.map((schedule) => [schedule.classId, schedule]));
  const candidateClassIds = Array.from(new Set(candidates.map((row) => String(row.class_id || '')).filter(Boolean))).sort();
  const missingScheduleClassIds = candidateClassIds.filter((classId) => {
    const schedule = byClass.get(classId as any);
    return !schedule || !schedule.appStartDate;
  });
  const classifiedSessions = (base.phases || []).reduce((sum: number, phase: any) => sum + Number(phase.sessions || 0), 0);
  const unclassifiedSessions = Math.max(0, candidates.length - classifiedSessions);

  if (missingScheduleClassIds.length > 0) {
    return {
      ...base,
      applicable: true,
      status: 'schedule_missing' as const,
      reason: `Study 1日程未設定: ${missingScheduleClassIds.join('、')}。日程管理で開始日を設定してください。`,
      missingScheduleClassIds,
      unclassifiedSessions,
    };
  }

  return {
    ...base,
    applicable: true,
    status: 'ok' as const,
    reason: '',
    missingScheduleClassIds: [],
    unclassifiedSessions,
    filterNote: scope === 'all'
      ? `データ区分=すべての場合も、Phase比較は本研究(main)のみを対象にします。${base.filterNote || ''}`
      : base.filterNote,
  };
}

function patchManagementHtml(html: string): string {
  if (!html.includes('id="iPhaseCounts"') || html.includes('researchPhaseDashboardConsistencyPatch')) return html;
  let out = html;

  const filterCondition = "if(v&&v!=='all')p.set(id,v)";
  if (!out.includes(filterCondition)) throw new Error('PHASE_CONSISTENCY_FILTER_PARAMS_ANCHOR_MISSING');
  out = out.replace(filterCondition, "if(v&&(v!=='all'||id==='dataScope'))p.set(id,v)");

  const renderAnchor = 'function renderDashboard(d,appliedQuery){';
  if (!out.includes(renderAnchor)) throw new Error('PHASE_CONSISTENCY_RENDER_DASHBOARD_ANCHOR_MISSING');
  out = out.replace(
    renderAnchor,
    "function renderDashboard(d,appliedQuery){if(typeof window.__renderPhaseComparison==='function')window.__renderPhaseComparison(d);",
  );

  const statusStart = out.indexOf('    if(!pc||!pc.applicable){');
  const statusEnd = statusStart >= 0 ? out.indexOf('    box.innerHTML=', statusStart) : -1;
  if (statusStart < 0 || statusEnd < 0) throw new Error('PHASE_CONSISTENCY_STATUS_RENDER_ANCHOR_MISSING');
  const stateRenderer = `    var status=pc&&pc.status?pc.status:(!pc?'error':(pc.applicable?'ok':'not_applicable'));
    var countNote=p$('iPhaseCountNote');
    if(status==='error'){
      box.textContent='取得失敗';headline.textContent='取得失敗';detail.textContent=pc&&pc.reason?pc.reason:'Phase集計を取得できません。';chart.innerHTML='<div class="muted" style="padding:28px 8px">取得失敗</div>';if(countNote)countNote.textContent='通常ダッシュボードとは分離して状態を表示';if(note)note.textContent=detail.textContent;return;
    }
    if(status==='schedule_missing'){
      box.textContent='日程未設定';headline.textContent='日程未設定';detail.textContent=pc&&pc.reason?pc.reason:'Study 1日程が未設定です。';chart.innerHTML='<div class="muted" style="padding:28px 8px">日程未設定：Study 1日程管理を確認してください。</div>';if(countNote)countNote.textContent='Study 1日程を設定後にPhase集計が有効になります';if(note)note.textContent=detail.textContent;return;
    }
    if(!pc||!pc.applicable||status==='not_applicable'){
      box.textContent='対象外';headline.textContent='対象外';detail.textContent=pc&&pc.reason?pc.reason:'ResearchPhaseは本研究データのみを対象にします。';chart.innerHTML='<div class="muted" style="padding:28px 8px">対象外</div>';if(countNote)countNote.textContent='本研究(main)またはすべて(all)で利用できます';if(note)note.textContent=detail.textContent;return;
    }
`;
  out = out.slice(0, statusStart) + stateRenderer + out.slice(statusEnd);

  const loadStart = out.indexOf('  async function loadPhaseComparison(){');
  const loadEndMarker = "  var tries=0;(function waitPanel(){tries++;var panel=p$('panel');if(panel&&panel.style.display!=='none'){loadPhaseComparison();return}if(tries<600)setTimeout(waitPanel,500)})();\n";
  const loadEnd = loadStart >= 0 ? out.indexOf(loadEndMarker, loadStart) : -1;
  if (loadStart < 0 || loadEnd < 0) throw new Error('PHASE_CONSISTENCY_SECOND_REQUEST_ANCHOR_MISSING');
  out = out.slice(0, loadStart)
    + '  window.__renderPhaseComparison=renderPhaseComparison;\n'
    + out.slice(loadEnd + loadEndMarker.length);

  const marker = '<script id="researchPhaseDashboardConsistencyPatch">window.__researchPhaseDashboardConsistency=true;</script>';
  return out.replace('</body>', `${marker}</body>`);
}

function managementWrapper(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    const originalSend = res.send.bind(res);
    (res as any).send = (body: any) => originalSend(typeof body === 'string' ? patchManagementHtml(body) : body);
    return handler(req, res, next);
  };
}

function dashboardWrapper(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    const query = req.query as Record<string, unknown>;
    const phasePromise = Promise.all([getAllSessionsForManagement(), getAllStudySchedules()])
      .then(([sessions, schedules]) => buildConsistentPhaseComparison(sessions, schedules, query));
    const originalJson = res.json.bind(res);
    (res as any).json = async (body: any) => {
      if (!body || body.success === false) return originalJson(body);
      let phaseComparison;
      try {
        phaseComparison = await phasePromise;
      } catch (error: any) {
        console.error('Research phase consistent dashboard failed', { message: error?.message });
        phaseComparison = buildPhaseDashboardErrorPayload(query);
      }
      const exportFiles = Array.isArray(body.exportFiles)
        ? body.exportFiles.map((file: any) => file.dataset === 'codebook'
          ? { ...file, rowCount: Number(file.rowCount || 0) + PHASE_CODEBOOK_ROWS.length }
          : file)
        : body.exportFiles;
      return originalJson({ ...body, phaseComparison, exportFiles });
    };
    return handler(req, res, next);
  };
}

export function withResearchPhaseDashboardConsistency(path: string, handler: RequestHandler): RequestHandler {
  if (path === '/management') return managementWrapper(handler);
  if (path === '/api/management/research.dashboard') return dashboardWrapper(handler);
  return handler;
}
