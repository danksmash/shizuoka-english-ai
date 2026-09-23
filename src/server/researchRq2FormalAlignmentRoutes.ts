import express from 'express';
import { requireManagementRole, type AuthenticatedRequest } from './auth';
import { getAllSessionsForManagement } from './persistence';
import { getAllStudySchedules } from './studySchedulePersistence';
import { buildAnalysisSessionRows } from './researchAnalysisSessions';
import { buildRq2Candidates, sampleRq2Candidates, summarizeRq2Candidates } from './researchRq2Sampling';
import { getRq2Codebook } from './researchRq2Codebook';
import { buildRq2PreflightAudit } from './researchRq2Preflight';
import { createRq2Run, findActiveFormalRq2Runs } from './researchRq2Persistence';
import {
  assertRq2SamplingConfirmation,
  rq2FormalSamplingReady,
  rq2OperationErrorStatus,
  rq2RunType,
  rq2SamplingShortfalls,
} from './researchRq2RunGuard';

const router = express.Router();

function intValue(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}
function text(value: unknown, max = 120) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function bool(value: unknown, fallback = false) {
  if (value === true || value === '1' || value === 'true') return true;
  if (value === false || value === '0' || value === 'false') return false;
  return fallback;
}

function errorStatus(message: string) {
  if (message === 'RQ2_FORMAL_FINAL_INCLUSION_REQUIRED') return 409;
  return rq2OperationErrorStatus(message);
}

function errorResponse(res: express.Response, error: any, fallback: string) {
  const message = String(error?.message || '');
  const isKnown = message.startsWith('RQ2_');
  return res.status(isKnown ? errorStatus(message) : 503).json({
    success: false,
    error: isKnown ? message : fallback,
  });
}

async function loadCandidateSource(lessonOnly: boolean) {
  const [sessions, schedules] = await Promise.all([getAllSessionsForManagement(), getAllStudySchedules()]);
  if (!lessonOnly) {
    return {
      sessions,
      schedules,
      candidates: buildRq2Candidates(sessions, schedules, { lessonOnly: false }),
      candidateSource: 'all_eligible_main_sessions',
      finalIncludedSessionCount: null,
    };
  }
  const analysisSessions = await buildAnalysisSessionRows(sessions, schedules);
  const includedIds = new Set(
    analysisSessions
      .filter((row) => Number(row.analysis_included || 0) === 1)
      .map((row) => String(row.session_id || ''))
      .filter(Boolean),
  );
  const finalSessions = sessions.filter((session) => includedIds.has(String(session.sessionId || '')));
  return {
    sessions: finalSessions,
    schedules,
    candidates: buildRq2Candidates(finalSessions, schedules, { lessonOnly: false }),
    candidateSource: 'analysis_included_final',
    finalIncludedSessionCount: finalSessions.length,
  };
}

router.get('/research-rq2/status', requireManagementRole(['researcher']), async (req, res) => {
  try {
    const lessonOnly = bool(req.query.lessonOnly, true);
    const [{ candidates, candidateSource, finalIncludedSessionCount }, codebook] = await Promise.all([
      loadCandidateSource(lessonOnly),
      getRq2Codebook(),
    ]);
    const defaultPreview = sampleRq2Candidates(candidates, 'RQ2-PREVIEW-ONLY', 50, 2);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      lessonOnly,
      candidateSource,
      finalIncludedSessionCount,
      codebook,
      strata: summarizeRq2Candidates(candidates),
      totalCandidates: candidates.length,
      defaultSampling: {
        targetPerStratum: 50,
        maxPerParticipantPerStratum: 2,
        counts: defaultPreview.counts,
        formalReady: rq2FormalSamplingReady(defaultPreview.counts),
      },
    });
  } catch (error: any) {
    return errorResponse(res, error, 'RQ2_STATUS_UNAVAILABLE');
  }
});

router.get('/research-rq2/preflight-audit', requireManagementRole(['researcher']), async (req, res) => {
  try {
    const seed = text(req.query.seed, 100) || 'RQ2-2026-v1';
    const targetPerStratum = intValue(req.query.targetPerStratum, 50, 10, 100);
    const maxPerParticipantPerStratum = intValue(req.query.maxPerParticipantPerStratum, 2, 1, 5);
    const lessonOnly = bool(req.query.lessonOnly, true);
    const [{ candidates, candidateSource, finalIncludedSessionCount }, codebook, activeFormalRuns] = await Promise.all([
      loadCandidateSource(lessonOnly),
      getRq2Codebook(),
      findActiveFormalRq2Runs(),
    ]);
    const sampled = sampleRq2Candidates(candidates, seed, targetPerStratum, maxPerParticipantPerStratum);
    const audit = buildRq2PreflightAudit({
      candidates,
      sampledItems: sampled.items,
      counts: sampled.counts,
      codebook,
      activeFormalRuns,
      targetPerStratum,
      maxPerParticipantPerStratum,
      lessonOnly,
    });
    const finalGate = {
      id: 'final_analysis_inclusion',
      label: '最終採否 analysis_included を使用',
      blocking: true,
      passed: lessonOnly && candidateSource === 'analysis_included_final',
      detail: candidateSource === 'analysis_included_final'
        ? `最終採用session ${finalIncludedSessionCount ?? 0}件から候補生成`
        : '授業内推定だけでは正式抽出不可',
    };
    const gates = [...audit.gates, finalGate];
    const alignedAudit = {
      ...audit,
      candidateSource,
      finalIncludedSessionCount,
      gates,
      overallReady: audit.overallReady && finalGate.passed,
    };
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, audit: alignedAudit });
  } catch (error: any) {
    return errorResponse(res, error, 'RQ2_PREFLIGHT_UNAVAILABLE');
  }
});

router.get('/research-rq2/sample-preview', requireManagementRole(['researcher']), async (req, res) => {
  try {
    const seed = text(req.query.seed, 100) || 'RQ2-2026-v1';
    const targetPerStratum = intValue(req.query.targetPerStratum, 50, 10, 100);
    const maxPerParticipantPerStratum = intValue(req.query.maxPerParticipantPerStratum, 2, 1, 5);
    const lessonOnly = bool(req.query.lessonOnly, true);
    const { candidates, candidateSource, finalIncludedSessionCount } = await loadCandidateSource(lessonOnly);
    const sampled = sampleRq2Candidates(candidates, seed, targetPerStratum, maxPerParticipantPerStratum);
    return res.json({
      success: true,
      selected: sampled.items.length,
      counts: sampled.counts,
      formalReady: lessonOnly && candidateSource === 'analysis_included_final' && rq2FormalSamplingReady(sampled.counts),
      shortfalls: rq2SamplingShortfalls(sampled.counts),
      targetPerStratum,
      maxPerParticipantPerStratum,
      lessonOnly,
      candidateSource,
      finalIncludedSessionCount,
    });
  } catch (error: any) {
    return errorResponse(res, error, 'RQ2_SAMPLE_PREVIEW_UNAVAILABLE');
  }
});

router.post('/research-rq2/sample', requireManagementRole(['researcher']), async (req: AuthenticatedRequest, res) => {
  try {
    const seed = text(req.body?.seed, 100) || 'RQ2-2026-v1';
    const targetPerStratum = intValue(req.body?.targetPerStratum, 50, 10, 100);
    const maxPerParticipantPerStratum = intValue(req.body?.maxPerParticipantPerStratum, 2, 1, 5);
    const lessonOnly = bool(req.body?.lessonOnly, true);
    const runType = rq2RunType(req.body?.runType);
    if (runType === 'formal' && !lessonOnly) throw new Error('RQ2_FORMAL_FINAL_INCLUSION_REQUIRED');

    const [{ candidates, candidateSource, finalIncludedSessionCount }, codebook] = await Promise.all([
      loadCandidateSource(lessonOnly),
      getRq2Codebook(),
    ]);
    if (runType === 'formal' && candidateSource !== 'analysis_included_final') throw new Error('RQ2_FORMAL_FINAL_INCLUSION_REQUIRED');
    const sampled = sampleRq2Candidates(candidates, seed, targetPerStratum, maxPerParticipantPerStratum);

    assertRq2SamplingConfirmation({
      runType,
      acknowledged: bool(req.body?.acknowledged, false),
      confirmText: text(req.body?.confirmText, 40),
      counts: sampled.counts,
    });

    if (runType === 'formal') {
      const activeFormalRuns = await findActiveFormalRq2Runs();
      if (activeFormalRuns.length) throw new Error('RQ2_ACTIVE_FORMAL_RUN_EXISTS');
      const audit = buildRq2PreflightAudit({
        candidates,
        sampledItems: sampled.items,
        counts: sampled.counts,
        codebook,
        activeFormalRuns,
        targetPerStratum,
        maxPerParticipantPerStratum,
        lessonOnly: true,
      });
      if (!audit.overallReady) throw new Error('RQ2_FORMAL_PREFLIGHT_REQUIRED');
    }

    const run = await createRq2Run({
      seed,
      targetPerStratum,
      maxPerParticipantPerStratum,
      lessonOnly,
      runType,
      codebookVersion: String(codebook.version || 'draft'),
      counts: sampled.counts,
      items: sampled.items,
      createdBy: req.managementUser?.username || 'researcher',
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      run: { ...run, candidateSource, finalIncludedSessionCount },
      counts: sampled.counts,
      selected: sampled.items.length,
      formalReady: runType !== 'formal' || rq2FormalSamplingReady(sampled.counts),
      candidateSource,
      finalIncludedSessionCount,
    });
  } catch (error: any) {
    return errorResponse(res, error, 'RQ2_SAMPLING_UNAVAILABLE');
  }
});

export function createResearchRq2FormalAlignmentRouter() {
  return router;
}
