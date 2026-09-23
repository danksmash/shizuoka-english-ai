import express from 'express';
import { requireManagementRole, type AuthenticatedRequest } from './auth';
import { getAllSessionsForManagement } from './persistence';
import { getAllStudySchedules } from './studySchedulePersistence';
import { buildAnalysisSessionRows } from './researchAnalysisSessions';
import {
  assertRq1FormalTargetStatus,
  freezeRq1TargetTable,
  getRq1TargetStatus,
  initializeRq1InterventionTargets,
  saveRq1TargetMapping,
  unfreezeRq1TargetTable,
} from './researchRq1Targets';
import {
  RQ1_ANALYSIS_SPEC,
  RQ1_CHOICE_HEADERS,
  RQ1_PERIOD_SUMMARY_HEADERS,
  RQ1_TRANSITION_HEADERS,
  buildRq1ChoiceRows,
  buildRq1PeriodSummaryRows,
  buildRq1TransitionRows,
  serializeRq1Csv,
  type Rq1AnalysisParticipant,
} from './researchRq1Analysis';

const router = express.Router();

function text(value: unknown, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function rq1ErrorStatus(message: string) {
  if (message.endsWith('_REQUIRED') || message.endsWith('_INVALID') || message === 'RQ1_FORMAL_PARTICIPANT_NOT_FOUND') return 400;
  if (message.includes('FROZEN') || message.includes('NOT_READY') || message.includes('MUST_MATCH') || message.includes('REVISION_CONFLICT') || message.includes('BOTH_CONDITIONS')) return 409;
  return 503;
}

function rq1Error(res: express.Response, error: any, fallback: string) {
  const message = String(error?.message || '');
  return res.status(message.startsWith('RQ1_') ? rq1ErrorStatus(message) : 503).json({
    success: false,
    error: message.startsWith('RQ1_') ? message : fallback,
  });
}

function csvCell(value: unknown) {
  const raw = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

const TARGET_TABLE_HEADERS = [
  'research_id','site_id','school_condition','class_id','grade_level','target_country','target_source','target_revision','target_updated_at','target_note','intervention_current_assignment','intervention_mismatch',
] as const;

function targetTableCsv(status: Awaited<ReturnType<typeof getRq1TargetStatus>>) {
  const rows = status.participants.map((row) => ({
    research_id: row.researchId,
    site_id: row.siteId,
    school_condition: row.schoolCondition,
    class_id: row.classId,
    grade_level: row.gradeLevel,
    target_country: row.targetCountry,
    target_source: row.targetSource,
    target_revision: row.targetRevision,
    target_updated_at: row.targetUpdatedAt,
    target_note: row.targetNote,
    intervention_current_assignment: row.schoolCondition === 'intervention' ? row.assignedPartnerCountry : '',
    intervention_mismatch: row.interventionMismatch ? 1 : 0,
  }));
  return '\uFEFF' + [
    TARGET_TABLE_HEADERS.map(csvCell).join(','),
    ...rows.map((row) => TARGET_TABLE_HEADERS.map((header) => csvCell((row as any)[header])).join(',')),
  ].join('\n') + '\n';
}

function analysisParticipants(status: Awaited<ReturnType<typeof getRq1TargetStatus>>): Rq1AnalysisParticipant[] {
  return status.participants.map((row) => ({
    researchId: row.researchId,
    siteId: row.siteId,
    schoolCondition: row.schoolCondition,
    classId: row.classId,
    gradeLevel: row.gradeLevel,
    targetCountry: row.targetCountry,
  }));
}

async function formalData() {
  const [sessions, schedules, targetStatus] = await Promise.all([
    getAllSessionsForManagement(),
    getAllStudySchedules(),
    getRq1TargetStatus(),
  ]);
  assertRq1FormalTargetStatus(targetStatus);
  const analysisSessions = await buildAnalysisSessionRows(sessions, schedules);
  const participants = analysisParticipants(targetStatus);
  const choices = buildRq1ChoiceRows({
    rawSessions: sessions,
    schedules,
    analysisSessionRows: analysisSessions,
    participants,
  });
  const periodSummary = buildRq1PeriodSummaryRows(choices, participants);
  const transitions = buildRq1TransitionRows(choices, participants);
  return { targetStatus, choices, periodSummary, transitions };
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

router.get('/research-rq1/status', requireManagementRole(['researcher']), async (_req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, ...(await getRq1TargetStatus()) });
  } catch (error: any) {
    return rq1Error(res, error, 'RQ1_STATUS_UNAVAILABLE');
  }
});

router.post('/research-rq1/initialize-targets', requireManagementRole(['researcher']), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await initializeRq1InterventionTargets(req.managementUser?.username || 'researcher');
    return res.json({ success: true, ...result });
  } catch (error: any) {
    return rq1Error(res, error, 'RQ1_TARGET_INITIALIZE_UNAVAILABLE');
  }
});

router.post('/research-rq1/target', requireManagementRole(['researcher']), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await saveRq1TargetMapping({
      researchId: text(req.body?.researchId, 80),
      targetCountry: text(req.body?.targetCountry, 120),
      note: text(req.body?.note, 500),
      expectedRevision: req.body?.expectedRevision === undefined ? undefined : Number(req.body.expectedRevision),
      updatedBy: req.managementUser?.username || 'researcher',
    });
    return res.json({ success: true, ...result, status: await getRq1TargetStatus() });
  } catch (error: any) {
    return rq1Error(res, error, 'RQ1_TARGET_SAVE_UNAVAILABLE');
  }
});

router.post('/research-rq1/freeze', requireManagementRole(['researcher']), async (req: AuthenticatedRequest, res) => {
  try {
    if (text(req.body?.confirmText, 60) !== 'RQ1対応国表を固定') throw new Error('RQ1_FREEZE_CONFIRM_TEXT_REQUIRED');
    return res.json({ success: true, status: await freezeRq1TargetTable(req.managementUser?.username || 'researcher') });
  } catch (error: any) {
    return rq1Error(res, error, 'RQ1_TARGET_FREEZE_UNAVAILABLE');
  }
});

router.post('/research-rq1/unfreeze', requireManagementRole(['researcher']), async (req: AuthenticatedRequest, res) => {
  try {
    if (text(req.body?.confirmText, 80) !== 'RQ1対応国表の固定解除') throw new Error('RQ1_UNFREEZE_CONFIRM_TEXT_REQUIRED');
    return res.json({ success: true, status: await unfreezeRq1TargetTable(req.managementUser?.username || 'researcher') });
  } catch (error: any) {
    return rq1Error(res, error, 'RQ1_TARGET_UNFREEZE_UNAVAILABLE');
  }
});

router.get('/research-rq1/analysis-spec', requireManagementRole(['researcher']), async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Disposition', 'attachment; filename="rq1_analysis_spec.json"');
  return res.json({ success: true, spec: RQ1_ANALYSIS_SPEC });
});

router.get('/research-rq1/target-table.csv', requireManagementRole(['researcher']), async (_req, res) => {
  try {
    const status = await getRq1TargetStatus();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="rq1_target_table.csv"');
    return res.send(targetTableCsv(status));
  } catch (error: any) {
    return rq1Error(res, error, 'RQ1_TARGET_EXPORT_UNAVAILABLE');
  }
});

router.get('/research-rq1/persona_choices.csv', requireManagementRole(['researcher']), async (_req, res) => {
  try {
    const { choices } = await formalData();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="persona_choices.csv"');
    return res.send(serializeRq1Csv(choices, RQ1_CHOICE_HEADERS));
  } catch (error: any) {
    return rq1Error(res, error, 'RQ1_CHOICE_EXPORT_UNAVAILABLE');
  }
});

router.get('/research-rq1/persona_period_summary.csv', requireManagementRole(['researcher']), async (_req, res) => {
  try {
    const { periodSummary } = await formalData();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="persona_period_summary.csv"');
    return res.send(serializeRq1Csv(periodSummary, RQ1_PERIOD_SUMMARY_HEADERS));
  } catch (error: any) {
    return rq1Error(res, error, 'RQ1_PERIOD_EXPORT_UNAVAILABLE');
  }
});

router.get('/research-rq1/persona_transition.csv', requireManagementRole(['researcher']), async (_req, res) => {
  try {
    const { transitions } = await formalData();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="persona_transition.csv"');
    return res.send(serializeRq1Csv(transitions, RQ1_TRANSITION_HEADERS));
  } catch (error: any) {
    return rq1Error(res, error, 'RQ1_TRANSITION_EXPORT_UNAVAILABLE');
  }
});

router.get('/research-rq1/bundle.zip', requireManagementRole(['researcher']), async (_req, res) => {
  try {
    const { targetStatus, choices, periodSummary, transitions } = await formalData();
    const exportedAt = new Date().toISOString();
    const files = [
      { name: 'rq1_target_table.csv', content: targetTableCsv(targetStatus) },
      { name: 'persona_choices.csv', content: serializeRq1Csv(choices, RQ1_CHOICE_HEADERS) },
      { name: 'persona_period_summary.csv', content: serializeRq1Csv(periodSummary, RQ1_PERIOD_SUMMARY_HEADERS) },
      { name: 'persona_transition.csv', content: serializeRq1Csv(transitions, RQ1_TRANSITION_HEADERS) },
      { name: 'rq1_analysis_spec.json', content: JSON.stringify(RQ1_ANALYSIS_SPEC, null, 2) },
    ];
    const manifest = {
      export_id: `rq1_export_${Date.now()}`,
      exported_at: exportedAt,
      target_table_status: targetStatus.config.status,
      target_table_revision: targetStatus.config.revision,
      target_table_snapshot_hash: targetStatus.config.snapshotHash,
      row_counts: {
        target_table: targetStatus.participants.length,
        persona_choices: choices.length,
        persona_choices_included: choices.filter((row) => Number(row.selection_included || 0) === 1).length,
        persona_period_summary: periodSummary.length,
        persona_transition: transitions.length,
      },
      rule: 'Formal RQ1 exports require a frozen target-country table; raw session assignment snapshots are never backfilled.',
    };
    const zip = buildStoredZip([...files, { name: 'rq1_manifest.json', content: JSON.stringify(manifest, null, 2) }]);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="rq1-analysis-bundle.zip"');
    return res.send(zip);
  } catch (error: any) {
    return rq1Error(res, error, 'RQ1_BUNDLE_UNAVAILABLE');
  }
});

export function createResearchRq1Router() {
  return router;
}
