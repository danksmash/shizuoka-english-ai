import express from 'express';
import { requireManagementRole, type AuthenticatedRequest } from './auth';
import { getAllSessionsForManagement } from './persistence';
import { getAllStudySchedules } from './studySchedulePersistence';
import { buildResearchExportDataSets } from './researchDashboard';
import { getRq2Codebook, rq2CanonicalPrimaryAndAux } from './researchRq2Codebook';
import { codeRq2Batch } from './researchRq2Ai';
import { findActiveFormalRq2Runs, getRq2ReliabilityCodes } from './researchRq2Persistence';
import {
  buildAnalysisSessionRows,
  saveAnalysisSessionOverride,
  serializeAnalysisSessionsCsv,
} from './researchAnalysisSessions';
import {
  buildInteractionCodeRows,
  buildRq3Candidates,
  buildRq3Distribution,
  serializeInteractionCodesCsv,
} from './researchRq3Analysis';
import {
  createRq3Run,
  findActiveRq3Run,
  getRq3Items,
  getRq3Run,
  invalidateRq3Run,
  patchRq3Items,
  summarizeRq3Progress,
  updateRq3Item,
} from './researchRq3Persistence';

const router = express.Router();

function text(value: unknown, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function intValue(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}
function bool(value: unknown, fallback = false) {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return fallback;
}
function csvCell(value: unknown) {
  const raw = value === null || value === undefined ? '' : (Array.isArray(value) ? value.join('|') : String(value));
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}
function canonicalPrimaryAux(
  codebook: Record<string, any>,
  dimension: 'reference' | 'function',
  primary: unknown,
  aux: unknown,
) {
  const result = rq2CanonicalPrimaryAndAux(codebook, dimension, primary, Array.isArray(aux) ? aux : []);
  if (result.invalid.length) throw new Error(`RQ3_INVALID_CODE:${result.invalid.join(',')}`);
  if (!result.primary) throw new Error('RQ3_PRIMARY_CODE_REQUIRED');
  return result;
}
function rq3StatusCode(message: string) {
  if (message === 'RQ3_RUN_NOT_FOUND') return 404;
  if (['RQ3_ACTIVE_RUN_EXISTS','RQ3_RUN_INVALIDATED','RQ3_CODEBOOK_NOT_FROZEN','RQ3_CODEBOOK_VERSION_MISMATCH'].includes(message)) return 409;
  if (message.startsWith('RQ3_INVALID_CODE:') || message.endsWith('_REQUIRED') || message === 'RQ3_CONFIRM_TEXT_REQUIRED') return 400;
  return 503;
}
function rq3Error(res: express.Response, error: any, fallback: string) {
  const message = String(error?.message || '');
  return res.status(message.startsWith('RQ3_') ? rq3StatusCode(message) : 503).json({
    success: false,
    error: message.startsWith('RQ3_') ? message : fallback,
  });
}
async function activeRun(runId: string) {
  if (!runId) throw new Error('RQ3_RUN_ID_REQUIRED');
  const run = await getRq3Run(runId);
  if (!run) throw new Error('RQ3_RUN_NOT_FOUND');
  if (String(run.status || '') !== 'active') throw new Error('RQ3_RUN_INVALIDATED');
  return run;
}
async function baseData() {
  const [sessions, schedules] = await Promise.all([getAllSessionsForManagement(), getAllStudySchedules()]);
  const analysisSessions = await buildAnalysisSessionRows(sessions, schedules);
  const candidates = buildRq3Candidates(sessions, schedules, analysisSessions);
  return { sessions, schedules, analysisSessions, candidates };
}
function candidateCounts(candidates: Record<string, any>[]) {
  const conditions = ['intervention','comparison'];
  const periods = ['period1','period2','period3'];
  return conditions.flatMap((schoolCondition) => periods.map((analysisPeriod) => {
    const rows = candidates.filter((row) => row.schoolCondition === schoolCondition && row.analysisPeriod === analysisPeriod);
    return {
      schoolCondition,
      analysisPeriod,
      candidates: rows.length,
      participants: new Set(rows.map((row) => row.participantKey || row.researchId).filter(Boolean)).size,
    };
  }));
}

router.get('/research-rq3/status', requireManagementRole(['researcher']), async (_req, res) => {
  try {
    const [{ analysisSessions, candidates }, codebook, run] = await Promise.all([
      baseData(),
      getRq2Codebook(),
      findActiveRq3Run(),
    ]);
    const items = run ? await getRq3Items(String(run.runId || '')) : [];
    return res.json({
      success: true,
      codebook: {
        version: codebook.version || '',
        status: codebook.status || 'draft',
        schemaVersion: codebook.schemaVersion || '',
      },
      analysisSessions: {
        total: analysisSessions.length,
        included: analysisSessions.filter((row) => Number(row.analysis_included || 0) === 1).length,
        manualOverrides: analysisSessions.filter((row) => row.analysis_decision_source === 'manual_override').length,
        unresolvedLessonContext: analysisSessions.filter((row) => row.exclusion_reason === 'lesson_context_not_confirmed').length,
      },
      candidateCounts: candidateCounts(candidates),
      totalCandidates: candidates.length,
      run,
      progress: run ? summarizeRq3Progress(items) : null,
    });
  } catch (error: any) {
    return rq3Error(res, error, 'RQ3_STATUS_UNAVAILABLE');
  }
});

router.get('/research-rq3/analysis-sessions', requireManagementRole(['researcher']), async (req, res) => {
  try {
    const { analysisSessions } = await baseData();
    const reviewOnly = bool(req.query.reviewOnly, true);
    const limit = intValue(req.query.limit, 200, 20, 500);
    const rows = analysisSessions
      .filter((row) => !reviewOnly || ['lesson_context_not_confirmed','outside_lesson'].includes(String(row.exclusion_reason || '')) || row.analysis_decision_source === 'manual_override')
      .slice(0, limit);
    return res.json({ success: true, rows, total: rows.length });
  } catch (error: any) {
    return rq3Error(res, error, 'RQ3_ANALYSIS_SESSIONS_UNAVAILABLE');
  }
});

router.post('/research-rq3/session-override', requireManagementRole(['researcher']), async (req: AuthenticatedRequest, res) => {
  try {
    const record = await saveAnalysisSessionOverride({
      sessionId: text(req.body?.sessionId, 220),
      analysisIncluded: bool(req.body?.analysisIncluded, false),
      lessonContextFinal: text(req.body?.lessonContextFinal, 40),
      note: text(req.body?.note, 500),
      updatedBy: req.managementUser?.username || 'researcher',
    });
    return res.json({ success: true, record });
  } catch (error: any) {
    return rq3Error(res, error, 'RQ3_SESSION_OVERRIDE_UNAVAILABLE');
  }
});

router.post('/research-rq3/create-run', requireManagementRole(['researcher']), async (req: AuthenticatedRequest, res) => {
  try {
    if (text(req.body?.confirmText, 40) !== 'RQ3正式コード化') throw new Error('RQ3_CONFIRM_TEXT_REQUIRED');
    if (await findActiveRq3Run()) throw new Error('RQ3_ACTIVE_RUN_EXISTS');
    const codebook = await getRq2Codebook();
    if (String(codebook.status || '') !== 'frozen') throw new Error('RQ3_CODEBOOK_NOT_FROZEN');
    const { candidates } = await baseData();
    if (!candidates.length) throw new Error('RQ3_NO_CANDIDATES');
    const run = await createRq3Run({
      items: candidates,
      codebookVersion: String(codebook.version || ''),
      createdBy: req.managementUser?.username || 'researcher',
    });
    return res.json({ success: true, run, itemCount: candidates.length });
  } catch (error: any) {
    return rq3Error(res, error, 'RQ3_CREATE_RUN_UNAVAILABLE');
  }
});

router.post('/research-rq3/reset', requireManagementRole(['researcher']), async (req: AuthenticatedRequest, res) => {
  try {
    const runId = text(req.body?.runId, 140);
    if (text(req.body?.confirmText, 40) !== 'RQ3をリセット') throw new Error('RQ3_CONFIRM_TEXT_REQUIRED');
    const run = await invalidateRq3Run(runId, req.managementUser?.username || 'researcher', text(req.body?.reason, 300) || 'manual_reset');
    return res.json({ success: true, run });
  } catch (error: any) {
    return rq3Error(res, error, 'RQ3_RESET_UNAVAILABLE');
  }
});

router.get('/research-rq3/run', requireManagementRole(['researcher']), async (req, res) => {
  try {
    const run = await activeRun(text(req.query.runId, 140));
    const items = await getRq3Items(String(run.runId || ''));
    return res.json({ success: true, run, progress: summarizeRq3Progress(items) });
  } catch (error: any) {
    return rq3Error(res, error, 'RQ3_RUN_UNAVAILABLE');
  }
});

router.post('/research-rq3/ai-code', requireManagementRole(['researcher']), async (req, res) => {
  try {
    const run = await activeRun(text(req.body?.runId, 140));
    const batchSize = intValue(req.body?.batchSize, 20, 1, 20);
    const [items, codebook] = await Promise.all([getRq3Items(String(run.runId || '')), getRq2Codebook()]);
    if (String(codebook.status || '') !== 'frozen') throw new Error('RQ3_CODEBOOK_NOT_FROZEN');
    if (String(run.codebookVersion || '') !== String(codebook.version || '')) throw new Error('RQ3_CODEBOOK_VERSION_MISMATCH');
    const pending = items.filter((item) => item.aiStatus !== 'coded').slice(0, batchSize);
    const coded = await codeRq2Batch(pending, codebook);
    const bySequence = new Map(pending.map((item) => [String(item.sequenceId || ''), item]));
    await patchRq3Items(coded.results.map((patch) => ({
      current: bySequence.get(String(patch.sequenceId || ''))!,
      patch,
    })).filter((row) => Boolean(row.current)));
    return res.json({
      success: true,
      processed: coded.results.length,
      remaining: Math.max(0, items.filter((item) => item.aiStatus !== 'coded').length - coded.results.length),
      model: coded.model,
      promptVersion: coded.promptVersion,
    });
  } catch (error: any) {
    return rq3Error(res, error, 'RQ3_AI_CODING_UNAVAILABLE');
  }
});

router.get('/research-rq3/items', requireManagementRole(['researcher']), async (req, res) => {
  try {
    const run = await activeRun(text(req.query.runId, 140));
    const offset = intValue(req.query.offset, 0, 0, 100000);
    const limit = intValue(req.query.limit, 50, 10, 100);
    const filter = text(req.query.filter, 40);
    let items = await getRq3Items(String(run.runId || ''));
    if (filter === 'needs_review') items = items.filter((item) => item.aiNeedsReview === true);
    if (filter === 'pending_human') items = items.filter((item) => item.aiStatus === 'coded' && item.humanStatus !== 'confirmed' && item.humanStatus !== 'modified');
    if (filter === 'confirmed') items = items.filter((item) => item.humanStatus === 'confirmed' || item.humanStatus === 'modified');
    const rows = items.slice(offset, offset + limit);
    return res.json({ success: true, rows, total: items.length, offset, limit });
  } catch (error: any) {
    return rq3Error(res, error, 'RQ3_ITEMS_UNAVAILABLE');
  }
});

router.post('/research-rq3/human-code', requireManagementRole(['researcher']), async (req: AuthenticatedRequest, res) => {
  try {
    const run = await activeRun(text(req.body?.runId, 140));
    const sequenceId = text(req.body?.sequenceId, 240);
    const codebook = await getRq2Codebook();
    const reference = canonicalPrimaryAux(codebook, 'reference', req.body?.referencePrimary, req.body?.referenceAuxCodes);
    const functions = canonicalPrimaryAux(codebook, 'function', req.body?.functionPrimary, req.body?.functionAuxCodes);
    const decision = req.body?.decision === 'modify' ? 'modified' : 'confirmed';
    const item = await updateRq3Item(String(run.runId || ''), sequenceId, {
      humanReferencePrimary: reference.primary,
      humanReferenceAuxCodes: reference.aux,
      humanReferenceCodes: [reference.primary, ...reference.aux],
      humanFunctionPrimary: functions.primary,
      humanFunctionAuxCodes: functions.aux,
      humanFunctionCodes: [functions.primary, ...functions.aux],
      humanStatus: decision,
      humanCoder: req.managementUser?.username || 'researcher',
      humanNote: text(req.body?.note, 500),
      humanCodedAt: new Date().toISOString(),
    });
    return res.json({ success: true, item });
  } catch (error: any) {
    return rq3Error(res, error, 'RQ3_HUMAN_CODE_UNAVAILABLE');
  }
});

router.get('/research-rq3/context', requireManagementRole(['researcher']), async (req, res) => {
  try {
    const sessionId = text(req.query.sessionId, 220);
    if (!sessionId) throw new Error('RQ3_SESSION_ID_REQUIRED');
    const sessions = await getAllSessionsForManagement();
    const datasets = buildResearchExportDataSets(sessions);
    const utterances = datasets.utterances
      .filter((row: any) => String(row.session_id || '') === sessionId)
      .sort((a: any, b: any) => Number(a.turn_sequence || 0) - Number(b.turn_sequence || 0))
      .map((row: any) => ({
        utteranceId: row.utterance_id,
        turnSequence: row.turn_sequence,
        speaker: row.speaker,
        english: row.english_text_anonymized,
        japanese: row.japanese_translation,
      }));
    return res.json({ success: true, sessionId, utterances });
  } catch (error: any) {
    return rq3Error(res, error, 'RQ3_CONTEXT_UNAVAILABLE');
  }
});

router.get('/research-rq3/analysis', requireManagementRole(['researcher']), async (req, res) => {
  try {
    const run = await activeRun(text(req.query.runId, 140));
    const items = await getRq3Items(String(run.runId || ''));
    return res.json({ success: true, run, progress: summarizeRq3Progress(items), distribution: buildRq3Distribution(items) });
  } catch (error: any) {
    return rq3Error(res, error, 'RQ3_ANALYSIS_UNAVAILABLE');
  }
});

router.get('/research-rq3/analysis_sessions.csv', requireManagementRole(['researcher']), async (_req, res) => {
  try {
    const { analysisSessions } = await baseData();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="analysis_sessions.csv"');
    return res.send(serializeAnalysisSessionsCsv(analysisSessions));
  } catch (error: any) {
    return rq3Error(res, error, 'RQ3_ANALYSIS_SESSIONS_EXPORT_UNAVAILABLE');
  }
});

router.get('/research-rq3/interaction_codes.csv', requireManagementRole(['researcher']), async (req, res) => {
  try {
    const run = await activeRun(text(req.query.runId, 140));
    const items = await getRq3Items(String(run.runId || ''));
    const rows = buildInteractionCodeRows(items, run);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="interaction_codes.csv"');
    return res.send(serializeInteractionCodesCsv(rows));
  } catch (error: any) {
    return rq3Error(res, error, 'RQ3_INTERACTION_EXPORT_UNAVAILABLE');
  }
});

function serializeReliabilityCsv(runId: string, records: Record<string, any>[]) {
  const headers = ['run_id','sequence_id','coder_id','reference_primary','reference_aux_codes','function_primary','function_aux_codes','saved_at'];
  const rows = records.map((row) => ({
    run_id: runId,
    sequence_id: row.sequenceId || '',
    coder_id: row.coderKey || '',
    reference_primary: row.referencePrimary || row.referenceCodes?.[0] || '',
    reference_aux_codes: row.referenceAuxCodes || (Array.isArray(row.referenceCodes) ? row.referenceCodes.slice(1) : []),
    function_primary: row.functionPrimary || row.functionCodes?.[0] || '',
    function_aux_codes: row.functionAuxCodes || (Array.isArray(row.functionCodes) ? row.functionCodes.slice(1) : []),
    saved_at: row.savedAt || '',
  }));
  return '\uFEFF' + [
    headers.map(csvCell).join(','),
    ...rows.map((row) => headers.map((header) => csvCell((row as any)[header])).join(',')),
  ].join('\n') + '\n';
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
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0); endRecord.writeUInt16LE(files.length, 8); endRecord.writeUInt16LE(files.length, 10);
  endRecord.writeUInt32LE(centralSize, 12); endRecord.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, ...centralParts, endRecord]);
}

router.get('/research-rq3/analysis.bundle.zip', requireManagementRole(['researcher']), async (req, res) => {
  try {
    const run = await activeRun(text(req.query.runId, 140));
    const [{ analysisSessions }, items, formalRuns] = await Promise.all([
      baseData(),
      getRq3Items(String(run.runId || '')),
      findActiveFormalRq2Runs(),
    ]);
    const interactionRows = buildInteractionCodeRows(items, run);
    const matchingFormalRuns = formalRuns.filter((row) => String(row.codebookVersion || '') === String(run.codebookVersion || ''));
    const rq2Run = [...matchingFormalRuns].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0] || null;
    const reliabilityRecords = rq2Run ? await getRq2ReliabilityCodes(String(rq2Run.runId || '')) : [];
    const files = [
      { name: 'analysis_sessions.csv', content: serializeAnalysisSessionsCsv(analysisSessions) },
      { name: 'interaction_codes.csv', content: serializeInteractionCodesCsv(interactionRows) },
      { name: 'rq2_reliability.csv', content: serializeReliabilityCsv(String(rq2Run?.runId || ''), reliabilityRecords) },
    ];
    const manifest = {
      export_id: `rq3_export_${Date.now()}`,
      exported_at: new Date().toISOString(),
      rq3_run_id: run.runId,
      rq3_codebook_version: run.codebookVersion,
      rq2_reliability_run_id: rq2Run?.runId || '',
      row_counts: {
        analysis_sessions: analysisSessions.length,
        interaction_codes: interactionRows.length,
        interaction_codes_analysis_ready: interactionRows.filter((row) => Number(row.analysis_ready || 0) === 1).length,
        rq2_reliability: reliabilityRecords.length,
      },
      reference_model_rule: 'B2a and B2b are retained in reference_primary_raw and collapsed to B2 in reference_primary_model',
      analysis_rule: 'formal RQ3 distributions use human-confirmed primary codes only',
      warning: rq2Run ? '' : 'No active formal RQ2 sampling run with the same frozen codebook version was available; rq2_reliability.csv contains headers only.',
    };
    const zip = buildStoredZip([...files, { name: 'analysis_manifest.json', content: JSON.stringify(manifest, null, 2) }]);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="rq2-rq3-analysis-bundle.zip"');
    return res.send(zip);
  } catch (error: any) {
    return rq3Error(res, error, 'RQ3_BUNDLE_UNAVAILABLE');
  }
});

export function createResearchRq3Router() {
  return router;
}
