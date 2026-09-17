import type { RequestHandler } from 'express';
import { buildPhaseComparison } from './researchPhaseAnalyticsRuntime';
import { getAllSessionsForManagement } from './persistence';
import {
  STUDY_CLASS_IDS,
  getAllStudySchedules,
  getStudySchedule,
  type StudyScheduleRecord,
} from './studySchedulePersistence';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadSchedulesResiliently(): Promise<StudyScheduleRecord[]> {
  try {
    return await getAllStudySchedules();
  } catch (error: any) {
    console.warn('Phase dashboard schedule list failed; falling back to per-class reads', { message: error?.message });
    return Promise.all(STUDY_CLASS_IDS.map((classId) => getStudySchedule(classId)));
  }
}

async function rebuildPhaseComparison(query: Record<string, unknown>) {
  let lastError: any = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const [sessions, schedules] = await Promise.all([
        getAllSessionsForManagement(),
        loadSchedulesResiliently(),
      ]);
      return buildPhaseComparison(sessions, schedules, query);
    } catch (error: any) {
      lastError = error;
      if (attempt === 0) await delay(120);
    }
  }
  throw lastError || new Error('PHASE_COMPARISON_RECOVERY_FAILED');
}

function phaseErrorPayload() {
  return {
    applicable: false,
    status: 'error',
    reason: 'Phase集計を取得できません。Study 1日程管理の設定と紐付け監査を確認してください。',
    filterNote: '通常の研究データ表示とは分離しているため、対話セッション自体が失われたことを示すものではありません。',
    phases: ['phase1', 'phase2', 'phase3', 'phase4'].map((phase, index) => ({
      phase,
      label: `Phase ${index + 1}`,
      sessions: 0,
      eligibleSessions: 0,
      matchedSessions: 0,
      sessionSharePercent: null,
      participantN: 0,
      participantMeanSharePercent: null,
    })),
  };
}

function injectPhaseErrorLabelPatch(html: string): string {
  if (!html.includes('id="iPhaseCounts"') || html.includes('phaseErrorLabelPatch')) return html;
  const script = `<script id="phaseErrorLabelPatch">
(function(){
  function patch(){
    var detail=document.getElementById('iPhaseCountryDetail');
    if(!detail||detail.textContent.indexOf('Phase集計を取得できません')<0)return;
    var counts=document.getElementById('iPhaseCounts');
    var headline=document.getElementById('iPhaseCountryHeadline');
    var chart=document.getElementById('chartPhaseCountry');
    if(counts&&counts.textContent==='対象外')counts.textContent='集計エラー';
    if(headline&&headline.textContent==='対象外')headline.textContent='集計エラー';
    if(chart&&chart.textContent.trim()==='対象外')chart.innerHTML='<div class="muted" style="padding:28px 8px">集計エラー：Study 1日程管理を確認してください。</div>';
  }
  var root=document.getElementById('panel')||document.body;
  if(window.MutationObserver)new MutationObserver(patch).observe(root,{childList:true,subtree:true,characterData:true});
  setTimeout(patch,0);setTimeout(patch,500);setTimeout(patch,1500);
})();
</script>`;
  return html.replace('</body>', `${script}</body>`);
}

export function withResearchPhaseDashboardRecovery(path: string, handler: RequestHandler): RequestHandler {
  if (path === '/management') {
    return (req, res, next) => {
      const originalSend = res.send.bind(res);
      (res as any).send = (body: any) => originalSend(typeof body === 'string' ? injectPhaseErrorLabelPatch(body) : body);
      return handler(req, res, next);
    };
  }

  if (path !== '/api/management/research.dashboard') return handler;

  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    (res as any).json = async (body: any) => {
      if (!body || body.success === false || body.phaseComparison) return originalJson(body);
      try {
        const phaseComparison = await rebuildPhaseComparison(req.query as Record<string, unknown>);
        console.warn('Phase dashboard recovered missing phaseComparison');
        return originalJson({ ...body, phaseComparison });
      } catch (error: any) {
        console.error('Phase dashboard recovery failed', { message: error?.message });
        return originalJson({ ...body, phaseComparison: phaseErrorPayload() });
      }
    };
    return handler(req, res, next);
  };
}
