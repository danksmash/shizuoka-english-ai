import express from 'express';
import { requireManagementRole, type AuthenticatedRequest } from './auth';
import { getAllSessionsForManagement } from './persistence';
import { getAllStudySchedules } from './studySchedulePersistence';
import { getRq2Codebook, saveRq2Codebook, rq2CanonicalizeCodes } from './researchRq2Codebook';
import { buildRq2Candidates, sampleRq2Candidates, summarizeRq2Candidates, type Rq2Purpose } from './researchRq2Sampling';
import { codeRq2Batch } from './researchRq2Ai';
import { buildRq2Analysis, buildRq2ReliabilitySummary } from './researchRq2Analysis';
import {
  createRq2Run,
  findActiveFormalRq2Runs,
  invalidateRq2Run,
  filterRq2Items,
  getRq2Items,
  getRq2ReliabilityCodes,
  getRq2Run,
  saveRq2ReliabilityCode,
  patchRq2ItemRecords,
  updateRq2Item,
} from './researchRq2Persistence';
import {
  assertRq2RunActive,
  assertRq2SamplingConfirmation,
  rq2FormalSamplingReady,
  rq2OperationErrorStatus,
  rq2RunType,
  summarizeRq2RunProgress,
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
function canonicalCodes(codebook: Record<string, any>, dimension: 'reference' | 'function' | 'locus', values: unknown) {
  const result = rq2CanonicalizeCodes(codebook, dimension, values);
  if (result.invalid.length) throw new Error(`RQ2_INVALID_CODE:${result.invalid.join(',')}`);
  return result.valid;
}

function rq2ErrorResponse(res: express.Response, error: any, fallback: string) {
  const message = String(error?.message || '');
  const isKnown = message.startsWith('RQ2_');
  return res.status(isKnown ? rq2OperationErrorStatus(message) : 503).json({
    success: false,
    error: isKnown ? message : fallback,
  });
}

async function activeRq2Run(runId: string) {
  if (!runId) throw new Error('RQ2_RUN_ID_REQUIRED');
  return assertRq2RunActive(await getRq2Run(runId));
}


router.get('/research-rq2/status', requireManagementRole(['researcher']), async (req, res) => {
  try {
    const lessonOnly = bool(req.query.lessonOnly, true);
    const [sessions, schedules, codebook] = await Promise.all([getAllSessionsForManagement(), getAllStudySchedules(), getRq2Codebook()]);
    const candidates = buildRq2Candidates(sessions, schedules, { lessonOnly });
    const defaultPreview = sampleRq2Candidates(candidates, 'RQ2-PREVIEW-ONLY', 50, 2);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      lessonOnly,
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
    console.error('RQ2 status failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'RQ2_STATUS_UNAVAILABLE' });
  }
});

router.post('/research-rq2/sample', requireManagementRole(['researcher']), async (req: AuthenticatedRequest, res) => {
  try {
    const seed = text(req.body?.seed, 100) || 'RQ2-2026-v1';
    const targetPerStratum = intValue(req.body?.targetPerStratum, 50, 10, 100);
    const maxPerParticipantPerStratum = intValue(req.body?.maxPerParticipantPerStratum, 2, 1, 5);
    const lessonOnly = bool(req.body?.lessonOnly, true);
    const runType = rq2RunType(req.body?.runType);
    const [sessions, schedules, codebook] = await Promise.all([getAllSessionsForManagement(), getAllStudySchedules(), getRq2Codebook()]);
    const candidates = buildRq2Candidates(sessions, schedules, { lessonOnly });
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
      run,
      counts: sampled.counts,
      selected: sampled.items.length,
      formalReady: rq2FormalSamplingReady(sampled.counts),
    });
  } catch (error: any) {
    console.error('RQ2 sampling failed', { message: error?.message });
    return rq2ErrorResponse(res, error, 'RQ2_SAMPLING_UNAVAILABLE');
  }
});

router.get('/research-rq2/run', requireManagementRole(['researcher']), async (req, res) => {
  try {
    const runId = text(req.query.runId, 120);
    if (!runId) return res.status(400).json({ success: false, error: 'RQ2_RUN_ID_REQUIRED' });
    const [run, items, reliability] = await Promise.all([getRq2Run(runId), getRq2Items(runId), getRq2ReliabilityCodes(runId)]);
    if (!run) return res.status(404).json({ success: false, error: 'RQ2_RUN_NOT_FOUND' });
    return res.json({
      success: true,
      run,
      itemCount: items.length,
      progress: summarizeRq2RunProgress(items, reliability),
    });
  } catch (error: any) {
    return rq2ErrorResponse(res, error, 'RQ2_RUN_UNAVAILABLE');
  }
});

router.post('/research-rq2/reset', requireManagementRole(['researcher']), async (req: AuthenticatedRequest, res) => {
  try {
    const runId = text(req.body?.runId, 120);
    if (!runId) throw new Error('RQ2_RUN_ID_REQUIRED');
    if (text(req.body?.confirmText, 40) !== '抽出をリセット') throw new Error('RQ2_RESET_CONFIRM_TEXT_REQUIRED');
    const run = await getRq2Run(runId);
    if (!run) throw new Error('RQ2_RUN_NOT_FOUND');
    const [items, reliability] = await Promise.all([getRq2Items(runId), getRq2ReliabilityCodes(runId)]);
    const progress = summarizeRq2RunProgress(items, reliability);
    const invalidated = await invalidateRq2Run(
      runId,
      req.managementUser?.username || 'researcher',
      text(req.body?.reason, 200) || 'manual_reset',
      progress,
    );
    return res.json({
      success: true,
      run: invalidated,
      progress,
      message: 'RQ2_RUN_INVALIDATED',
    });
  } catch (error: any) {
    return rq2ErrorResponse(res, error, 'RQ2_RESET_UNAVAILABLE');
  }
});

router.get('/research-rq2/items', requireManagementRole(['researcher']), async (req, res) => {
  try {
    const runId = text(req.query.runId, 120);
    if (!runId) return res.status(400).json({ success: false, error: 'RQ2_RUN_ID_REQUIRED' });
    await activeRq2Run(runId);
    const purposeText = text(req.query.purpose, 40);
    const purpose = ['codebook_development','reliability','main_other'].includes(purposeText) ? purposeText as Rq2Purpose : '';
    const rows = filterRq2Items(await getRq2Items(runId), purpose, bool(req.query.reviewOnly, false));
    const items = purpose === 'reliability'
      ? rows.map((row) => {
          const safe = { ...row };
          for (const key of ['aiReferenceCodes','aiFunctionCodes','aiRecipientLocus','aiNeedsReview','aiReviewReason','aiReason','aiModel','aiPromptVersion','aiCodebookVersion','aiCodedAt']) delete safe[key];
          return safe;
        })
      : rows;
    return res.json({ success: true, items });
  } catch (error: any) {
    console.error('RQ2 item read failed', { message: error?.message });
    return rq2ErrorResponse(res, error, 'RQ2_ITEMS_UNAVAILABLE');
  }
});

router.get('/research-rq2/codebook', requireManagementRole(['researcher']), async (_req, res) => {
  return res.json({ success: true, codebook: await getRq2Codebook() });
});

router.put('/research-rq2/codebook', requireManagementRole(['researcher']), async (req: AuthenticatedRequest, res) => {
  try {
    const codebook = await saveRq2Codebook(req.body?.codebook || {}, req.managementUser?.username || 'researcher', bool(req.body?.freeze, false));
    return res.json({ success: true, codebook });
  } catch (error: any) {
    const message = String(error?.message || '');
    const validation = message.startsWith('RQ2_CODEBOOK_');
    return res.status(validation ? 400 : 503).json({ success: false, error: validation ? message : 'RQ2_CODEBOOK_SAVE_UNAVAILABLE' });
  }
});

router.post('/research-rq2/ai-code', requireManagementRole(['researcher']), async (req, res) => {
  try {
    const runId = text(req.body?.runId, 120);
    const batchSize = intValue(req.body?.batchSize, 20, 1, 20);
    if (!runId) return res.status(400).json({ success: false, error: 'RQ2_RUN_ID_REQUIRED' });
    await activeRq2Run(runId);
    const [items, codebook] = await Promise.all([getRq2Items(runId), getRq2Codebook()]);
    if (String(codebook.status || '') !== 'frozen') return res.status(409).json({ success: false, error: 'RQ2_CODEBOOK_NOT_FROZEN' });
    const codedVersions = new Set(items.filter((item) => item.aiStatus === 'coded' && item.aiCodebookVersion).map((item) => String(item.aiCodebookVersion)));
    if (codedVersions.size && (!codedVersions.has(String(codebook.version || '')) || codedVersions.size > 1)) {
      return res.status(409).json({ success: false, error: 'RQ2_CODEBOOK_VERSION_MISMATCH' });
    }
    const pending = items.filter((item) => item.aiStatus !== 'coded').slice(0, batchSize);
    const coded = await codeRq2Batch(pending, codebook);
    const pendingBySequence = new Map(pending.map((item) => [String(item.sequenceId || ''), item]));
    await patchRq2ItemRecords(coded.results.map((result) => ({
      current: pendingBySequence.get(result.sequenceId),
      patch: result,
    })).filter((entry): entry is { current: Record<string, any>; patch: Record<string, any> } => Boolean(entry.current)));
    const remaining = Math.max(0, items.filter((item) => item.aiStatus !== 'coded').length - coded.results.length);
    return res.json({ success: true, processed: coded.results.length, remaining, model: coded.model, promptVersion: coded.promptVersion });
  } catch (error: any) {
    console.error('RQ2 AI coding failed', { message: error?.message });
    return rq2ErrorResponse(res, error, 'RQ2_AI_CODING_UNAVAILABLE');
  }
});

router.post('/research-rq2/human-code', requireManagementRole(['researcher']), async (req: AuthenticatedRequest, res) => {
  try {
    const runId = text(req.body?.runId, 120);
    const sequenceId = text(req.body?.sequenceId, 220);
    await activeRq2Run(runId);
    const codebook = await getRq2Codebook();
    const decision = req.body?.decision === 'modify' ? 'modified' : 'confirmed';
    const item = await updateRq2Item(runId, sequenceId, {
      humanReferenceCodes: canonicalCodes(codebook, 'reference', req.body?.referenceCodes),
      humanFunctionCodes: canonicalCodes(codebook, 'function', req.body?.functionCodes),
      humanRecipientLocus: canonicalCodes(codebook, 'locus', req.body?.recipientLocus),
      humanStatus: decision,
      humanCoder: req.managementUser?.username || 'researcher',
      humanNote: text(req.body?.note, 500),
      humanCodedAt: new Date().toISOString(),
    });
    return res.json({ success: true, item });
  } catch (error: any) {
    return rq2ErrorResponse(res, error, 'RQ2_HUMAN_CODE_UNAVAILABLE');
  }
});

router.post('/research-rq2/reliability-code', requireManagementRole(['researcher']), async (req, res) => {
  try {
    const runId = text(req.body?.runId, 120);
    const sequenceId = text(req.body?.sequenceId, 220);
    const coderKey = text(req.body?.coderKey, 80);
    await activeRq2Run(runId);
    const item = (await getRq2Items(runId)).find((row) => row.sequenceId === sequenceId && row.purpose === 'reliability');
    if (!item) return res.status(400).json({ success: false, error: 'RQ2_RELIABILITY_ITEM_REQUIRED' });
    const codebook = await getRq2Codebook();
    const record = await saveRq2ReliabilityCode({
      runId,
      sequenceId,
      coderKey,
      referenceCodes: canonicalCodes(codebook, 'reference', req.body?.referenceCodes),
      functionCodes: canonicalCodes(codebook, 'function', req.body?.functionCodes),
      recipientLocus: canonicalCodes(codebook, 'locus', req.body?.recipientLocus),
    });
    return res.json({ success: true, record });
  } catch (error: any) {
    return rq2ErrorResponse(res, error, 'RQ2_RELIABILITY_SAVE_UNAVAILABLE');
  }
});

router.get('/research-rq2/analysis', requireManagementRole(['researcher']), async (req, res) => {
  try {
    const runId = text(req.query.runId, 120);
    await activeRq2Run(runId);
    const [items, reliability] = await Promise.all([getRq2Items(runId), getRq2ReliabilityCodes(runId)]);
    return res.json({ success: true, analysis: buildRq2Analysis(items), reliability: buildRq2ReliabilitySummary(reliability) });
  } catch (error: any) {
    return rq2ErrorResponse(res, error, 'RQ2_ANALYSIS_UNAVAILABLE');
  }
});

function csvCell(value: unknown) {
  const raw = value === null || value === undefined ? '' : (Array.isArray(value) ? value.join('|') : String(value));
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

router.get('/research-rq2/export.csv', requireManagementRole(['researcher']), async (req, res) => {
  try {
    const runId = text(req.query.runId, 120);
    const [run, items] = await Promise.all([getRq2Run(runId), getRq2Items(runId)]);
    assertRq2RunActive(run);
    const headers = ['run_id','run_type','run_status','seed','target_per_stratum','max_per_participant','lesson_only','run_codebook_version','run_prompt_version','sequence_id','stratum','purpose','stratum_rank','research_id','class_id','session_id','local_date','topic','persona_id','child_utterance_id','child_turn_sequence','previous_ai_english','child_english','next_ai_english','ai_reference_codes','ai_function_codes','ai_recipient_locus','ai_needs_review','ai_review_reason','ai_reason','ai_model','ai_prompt_version','ai_codebook_version','ai_coded_at','human_reference_codes','human_function_codes','human_recipient_locus','human_status','human_coder','human_note','human_coded_at'];
    const rows = items.map((item) => ({
      run_id: runId, run_type: run.runType || 'legacy', run_status: run.status || 'sampled', seed: run.seed, target_per_stratum: run.targetPerStratum, max_per_participant: run.maxPerParticipantPerStratum,
      lesson_only: run.lessonOnly ? 1 : 0, run_codebook_version: run.codebookVersion, run_prompt_version: run.promptVersion,
      sequence_id: item.sequenceId, stratum: item.stratum, purpose: item.purpose, stratum_rank: item.stratumRank,
      research_id: item.researchId, class_id: item.classId, session_id: item.sessionId, local_date: item.localDate, topic: item.topic, persona_id: item.personaId,
      child_utterance_id: item.childUtteranceId, child_turn_sequence: item.childTurnSequence,
      previous_ai_english: item.previousAiEnglish, child_english: item.childEnglish, next_ai_english: item.nextAiEnglish,
      ai_reference_codes: item.aiReferenceCodes || [], ai_function_codes: item.aiFunctionCodes || [], ai_recipient_locus: item.aiRecipientLocus || [],
      ai_needs_review: item.aiNeedsReview ? 1 : 0, ai_review_reason: item.aiReviewReason || '', ai_reason: item.aiReason || '',
      ai_model: item.aiModel || '', ai_prompt_version: item.aiPromptVersion || '', ai_codebook_version: item.aiCodebookVersion || '', ai_coded_at: item.aiCodedAt || '',
      human_reference_codes: item.humanReferenceCodes || [], human_function_codes: item.humanFunctionCodes || [], human_recipient_locus: item.humanRecipientLocus || [],
      human_status: item.humanStatus || '', human_coder: item.humanCoder || '', human_note: item.humanNote || '', human_coded_at: item.humanCodedAt || '',
    }));
    const body = '\uFEFF' + [headers.map(csvCell).join(','), ...rows.map((row) => headers.map((header) => csvCell((row as any)[header])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="rq2-coding-${runId}.csv"`);
    return res.send(body);
  } catch (error: any) {
    return rq2ErrorResponse(res, error, 'RQ2_EXPORT_UNAVAILABLE');
  }
});

router.get('/research-rq2/codebook.json', requireManagementRole(['researcher']), async (_req, res) => {
  const codebook = await getRq2Codebook();
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="rq2-codebook-${String(codebook.version || 'draft')}.json"`);
  return res.send(JSON.stringify(codebook, null, 2));
});

export function createResearchRq2Router() { return router; }
