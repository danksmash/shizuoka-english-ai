import type { RequestHandler } from 'express';
import { getAllSessionsForManagement } from './persistence';
import { getAllReflectionRecordsForTeacher, type ReflectionRecord } from './reflectionPersistence';
import {
  buildResearchDashboardData,
  buildResearchExportDataSets,
  filterResearchExportDataSets,
  normalizeFormalResearchExportQuery,
  serializeResearchCsv,
  type ResearchExportDatasetName,
  type ResearchFilterQuery,
} from './researchDashboard';
import {
  buildResearchLessonReflectionCodebookRows,
  buildResearchLessonReflectionRows,
  serializeResearchLessonReflectionCsv,
} from './researchLessonReflectionExport';
import {
  getAllStudySchedules,
  phaseForLocalDate,
  type StudyPhase,
  type StudyScheduleRecord,
} from './studySchedulePersistence';
import { managementPageHtml } from './managementPage';

export const STUDY_PHASE_FILTER_IDS = ['phase1', 'phase2', 'phase3', 'phase4'] as const;
export type StudyPhaseFilterId = typeof STUDY_PHASE_FILTER_IDS[number];
type PhaseAwareResearchQuery = ResearchFilterQuery & { studyPhase?: unknown };

const PHASE_TARGET: Record<StudyPhaseFilterId, StudyPhase> = {
  phase1: 'unknown_virtual_other',
  phase2: 'anticipated_other',
  phase3: 'identified_real_other',
  phase4: 'exchange_or_after',
};

export function normalizeStudyPhaseFilter(value: unknown): StudyPhaseFilterId | '' {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return (STUDY_PHASE_FILTER_IDS as readonly string[]).includes(text) ? text as StudyPhaseFilterId : '';
}

function sessionLocalDate(session: Record<string, any>): string {
  if (typeof session.localDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(session.localDate)) return session.localDate;
  const raw = session.startedAt || session.endedAt;
  const parsed = raw ? new Date(raw) : null;
  return parsed && Number.isFinite(parsed.getTime())
    ? parsed.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
    : '';
}

function scheduleMap(schedules: StudyScheduleRecord[]): Map<string, StudyScheduleRecord> {
  return new Map(schedules.map((schedule) => [schedule.classId, schedule]));
}

export function filterSessionsForStudyPhase(
  sessions: Record<string, any>[],
  schedules: StudyScheduleRecord[],
  requestedPhase: unknown,
): Record<string, any>[] {
  const phase = normalizeStudyPhaseFilter(requestedPhase);
  if (!phase) return sessions;
  const byClass = scheduleMap(schedules);
  const target = PHASE_TARGET[phase];
  return sessions.filter((session) => {
    const schedule = byClass.get(String(session.classId || ''));
    const localDate = sessionLocalDate(session);
    return Boolean(schedule && localDate && phaseForLocalDate(localDate, schedule) === target);
  });
}

export function filterReflectionsForStudyPhase(
  records: ReflectionRecord[],
  schedules: StudyScheduleRecord[],
  requestedPhase: unknown,
): ReflectionRecord[] {
  const phase = normalizeStudyPhaseFilter(requestedPhase);
  if (!phase) return records;
  const byClass = scheduleMap(schedules);
  const target = PHASE_TARGET[phase];
  return records.filter((record) => {
    const schedule = byClass.get(record.classId);
    return Boolean(schedule && record.localDate && phaseForLocalDate(record.localDate, schedule) === target);
  });
}

async function phaseContext(query: PhaseAwareResearchQuery) {
  const studyPhase = normalizeStudyPhaseFilter(query.studyPhase);
  const schedules = studyPhase ? await getAllStudySchedules() : [];
  return { studyPhase, schedules };
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

export function managementPageHtmlWithStudyPhase(): string {
  const replacements: Array<[string, string]> = [
    [
      '<label>Persona情報ラベル<select id="labelCondition"><option value="all">すべて</option><option value="shown">表示あり</option><option value="hidden">表示なし</option></select></label>',
      '<label>研究Phase<select id="studyPhase"><option value="all">すべて</option><option value="phase1">Phase 1</option><option value="phase2">Phase 2</option><option value="phase3">Phase 3</option><option value="phase4">Phase 4</option></select></label>',
    ],
    [
      "const labelConditionLabels={shown:'表示あり',hidden:'非表示'};",
      "const studyPhaseLabels={phase1:'Phase 1',phase2:'Phase 2',phase3:'Phase 3',phase4:'Phase 4'};",
    ],
    [
      "['personaId','labelCondition','topic','completeOnly'].forEach(function(k){p.delete(k)})",
      "['personaId','topic','completeOnly'].forEach(function(k){p.delete(k)})",
    ],
    [
      "['start','end','dataScope','grade','classId','personaId','labelCondition','topic']",
      "['start','end','dataScope','grade','classId','personaId','studyPhase','topic']",
    ],
    [
      "setOptions('labelCondition',['shown','hidden'],function(v){return labelConditionLabels[v]||v});",
      "setOptions('studyPhase',f.studyPhases||['phase1','phase2','phase3','phase4'],function(v){return studyPhaseLabels[v]||v});",
    ],
    [
      "['grade','classId','personaId','labelCondition','topic'].forEach(function(id){$(id).value='all'})",
      "['grade','classId','personaId','studyPhase','topic'].forEach(function(id){$(id).value='all'})",
    ],
    [
      "['start','end','dataScope','grade','classId','personaId','labelCondition','topic','completeOnly']",
      "['start','end','dataScope','grade','classId','personaId','studyPhase','topic','completeOnly']",
    ],
    [
      'lesson_reflections.csv は授業日単位のため、開始日・終了日・データ区分・学年・学級を反映し、Persona・ラベル・テーマ・completeのみは適用しません。',
      'lesson_reflections.csv は授業日単位のため、開始日・終了日・データ区分・学年・学級・研究Phaseを反映し、Persona・テーマ・completeのみは適用しません。',
    ],
  ];
  let html = managementPageHtml();
  for (const [from, to] of replacements) {
    if (!html.includes(from)) throw new Error(`MANAGEMENT_PHASE_UI_PATTERN_MISSING:${from.slice(0, 40)}`);
    html = html.replace(from, to);
  }
  return html;
}

const managementHandler: RequestHandler = (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.type('html').send(managementPageHtmlWithStudyPhase());
};

const dashboardHandler: RequestHandler = async (req, res) => {
  try {
    const query = req.query as PhaseAwareResearchQuery;
    const [{ studyPhase, schedules }, sessions, lessonReflections] = await Promise.all([
      phaseContext(query),
      getAllSessionsForManagement(),
      getAllReflectionRecordsForTeacher(),
    ]);
    const phaseSessions = filterSessionsForStudyPhase(sessions, schedules, studyPhase);
    const phaseReflections = filterReflectionsForStudyPhase(lessonReflections, schedules, studyPhase);
    const dashboard = buildResearchDashboardData(phaseSessions, query);
    const lessonReflectionRowCount = buildResearchLessonReflectionRows(phaseReflections, normalizeFormalResearchExportQuery(query)).length;
    const lessonCodebookCount = buildResearchLessonReflectionCodebookRows().length;
    const exportFiles = dashboard.exportFiles.map((file: any) => file.dataset === 'codebook'
      ? { ...file, rowCount: Number(file.rowCount || 0) + lessonCodebookCount }
      : file);
    const filters = { ...dashboard.filters, studyPhases: [...STUDY_PHASE_FILTER_IDS] } as Record<string, unknown>;
    delete filters.labelConditions;
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ ...dashboard, filters, exportFiles, lessonReflectionRowCount });
  } catch (error: any) {
    console.error('Research phase dashboard failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'RESEARCH_DASHBOARD_UNAVAILABLE' });
  }
};

const csvHandler: RequestHandler = async (req, res) => {
  try {
    const query = req.query as PhaseAwareResearchQuery;
    const requested = typeof query?.dataset === 'string' ? query.dataset : 'sessions';
    const { studyPhase, schedules } = await phaseContext(query);
    const exportQuery = normalizeFormalResearchExportQuery(query);
    if (requested === 'lesson_reflections') {
      const source = await getAllReflectionRecordsForTeacher();
      const rows = buildResearchLessonReflectionRows(filterReflectionsForStudyPhase(source, schedules, studyPhase), exportQuery);
      const csv = serializeResearchLessonReflectionCsv(rows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="lesson_reflections.csv"');
      res.setHeader('Cache-Control', 'no-store');
      return res.send(csv);
    }
    if (requested === 'codebook') {
      const datasets = buildResearchExportDataSets([]);
      const rows = [...datasets.codebook, ...buildResearchLessonReflectionCodebookRows()];
      const csv = serializeResearchCsv(rows, 'codebook');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="codebook.csv"');
      res.setHeader('Cache-Control', 'no-store');
      return res.send(csv);
    }
    const allowed = ['sessions', 'utterances', 'expressions', 'personas', 'codebook'] as const;
    if (!(allowed as readonly string[]).includes(requested)) return res.status(400).json({ success: false, error: 'INVALID_RESEARCH_DATASET' });
    const dataset = requested as ResearchExportDatasetName;
    const sourceSessions = (dataset === 'personas' || dataset === 'codebook') ? [] : await getAllSessionsForManagement();
    const phaseSessions = filterSessionsForStudyPhase(sourceSessions, schedules, studyPhase);
    const datasets = filterResearchExportDataSets(buildResearchExportDataSets(phaseSessions), exportQuery);
    const csv = serializeResearchCsv(datasets[dataset], dataset);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${dataset}.csv"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(csv);
  } catch (error: any) {
    console.error('Research phase export failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'RESEARCH_EXPORT_UNAVAILABLE' });
  }
};

const bundleHandler: RequestHandler = async (req, res) => {
  try {
    const query = req.query as PhaseAwareResearchQuery;
    const exportQuery = normalizeFormalResearchExportQuery(query);
    const [{ studyPhase, schedules }, sourceSessions, lessonReflections] = await Promise.all([
      phaseContext(query),
      getAllSessionsForManagement(),
      getAllReflectionRecordsForTeacher(),
    ]);
    const phaseSessions = filterSessionsForStudyPhase(sourceSessions, schedules, studyPhase);
    const phaseReflections = filterReflectionsForStudyPhase(lessonReflections, schedules, studyPhase);
    const datasets = filterResearchExportDataSets(buildResearchExportDataSets(phaseSessions), exportQuery);
    const lessonReflectionRows = buildResearchLessonReflectionRows(phaseReflections, exportQuery);
    const codebookRows = [...datasets.codebook, ...buildResearchLessonReflectionCodebookRows()];
    const exportedAt = new Date().toISOString();
    const rowCounts = {
      sessions: datasets.sessions.length,
      utterances: datasets.utterances.length,
      expressions: datasets.expressions.length,
      personas: datasets.personas.length,
      lesson_reflections: lessonReflectionRows.length,
      codebook: codebookRows.length,
    };
    const manifest = {
      export_id: `export_${Date.now()}`,
      exported_at: exportedAt,
      schema_version: 5,
      filters: exportQuery,
      row_counts: rowCounts,
      lesson_reflection_join_key: ['research_id', 'local_date'],
      lesson_reflection_filter_scope: ['start', 'end', 'dataScope', 'grade', 'classId', 'studyPhase'],
    };
    const files = [
      { name: 'sessions.csv', content: serializeResearchCsv(datasets.sessions, 'sessions') },
      { name: 'utterances.csv', content: serializeResearchCsv(datasets.utterances, 'utterances') },
      { name: 'expressions.csv', content: serializeResearchCsv(datasets.expressions, 'expressions') },
      { name: 'personas.csv', content: serializeResearchCsv(datasets.personas, 'personas') },
      { name: 'lesson_reflections.csv', content: serializeResearchLessonReflectionCsv(lessonReflectionRows) },
      { name: 'codebook.csv', content: serializeResearchCsv(codebookRows, 'codebook') },
    ];
    const zip = buildStoredZip([...files, { name: 'manifest.json', content: JSON.stringify(manifest, null, 2) }]);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="research-bundle-${exportedAt.slice(0, 10).replace(/-/g, '')}.zip"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(zip);
  } catch (error: any) {
    console.error('Research phase bundle export failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'RESEARCH_BUNDLE_UNAVAILABLE' });
  }
};

export function phaseAwareGetHandler(path: string): RequestHandler | null {
  if (path === '/management') return managementHandler;
  if (path === '/api/management/research.dashboard') return dashboardHandler;
  if (path === '/api/management/research.csv') return csvHandler;
  if (path === '/api/management/research.bundle.zip') return bundleHandler;
  return null;
}
