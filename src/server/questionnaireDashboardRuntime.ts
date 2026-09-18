import type { RequestHandler } from 'express';
import { buildResearchExportDataSets, filterResearchExportDataSets, normalizeFormalResearchExportQuery, serializeResearchCsv } from './researchDashboard';
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
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, ...centralParts, end]);
}

async function phaseContext(query: Record<string, unknown>) {
  const studyPhase = normalizeStudyPhaseFilter(query.studyPhase);
  return { studyPhase, schedules: studyPhase ? await getAllStudySchedules() : [] };
}

/**
 * Keep the shared codebook row count accurate without reading questionnaire
 * records on every Research Dashboard request. Questionnaire data/statistics are
 * intentionally loaded only on /questionnaire-analysis.html or explicit export.
 */
function dashboardWrapper(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    const questionnaireCodebookCount = buildQuestionnaireCodebookRows().length;
    const originalJson = res.json.bind(res);
    (res as any).json = (body: any) => {
      if (!body || body.success === false) return originalJson(body);
      const exportFiles = Array.isArray(body.exportFiles)
        ? body.exportFiles.map((file: any) => file.dataset === 'codebook'
          ? { ...file, rowCount: Number(file.rowCount || 0) + questionnaireCodebookCount }
          : file)
        : body.exportFiles;
      return originalJson({ ...body, exportFiles });
    };
    return handler(req, res, next);
  };
}

function csvWrapper(handler: RequestHandler): RequestHandler {
  return async (req, res, next) => {
    const requested = typeof req.query?.dataset === 'string' ? req.query.dataset : 'sessions';
    try {
      if (requested === 'student_questionnaires') {
        const rows = buildQuestionnaireExportRows(await getAllQuestionnaireRecords(), req.query as Record<string, unknown>);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="student_questionnaires.csv"');
        res.setHeader('Cache-Control', 'no-store');
        return res.send(serializeQuestionnaireCsv(rows));
      }
      if (requested === 'codebook') {
        const ai = buildResearchExportDataSets([]);
        const rows = [...ai.codebook, ...buildResearchLessonReflectionCodebookRows(), ...buildQuestionnaireCodebookRows()];
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="codebook.csv"');
        res.setHeader('Cache-Control', 'no-store');
        return res.send(serializeResearchCsv(rows, 'codebook'));
      }
      return handler(req, res, next);
    } catch (error: any) {
      console.error('Questionnaire research CSV wrapper failed', { message: error?.message });
      return res.status(503).json({ success: false, error: 'QUESTIONNAIRE_EXPORT_UNAVAILABLE' });
    }
  };
}

const bundleHandler: RequestHandler = async (req, res) => {
  try {
    const query = req.query as Record<string, unknown>;
    const exportQuery = normalizeFormalResearchExportQuery(query);
    const { studyPhase, schedules } = await phaseContext(query);
    const [sourceSessions, lessonReflections, questionnaireRecords] = await Promise.all([
      getAllSessionsForManagement(),
      getAllReflectionRecordsForTeacher(),
      getAllQuestionnaireRecords(),
    ]);
    const phaseSessions = filterSessionsForStudyPhase(sourceSessions, schedules, studyPhase);
    const phaseReflections = filterReflectionsForStudyPhase(lessonReflections, schedules, studyPhase);
    const datasets = filterResearchExportDataSets(buildResearchExportDataSets(phaseSessions), exportQuery);
    const lessonRows = buildResearchLessonReflectionRows(phaseReflections, exportQuery);
    const qRows = buildQuestionnaireExportRows(questionnaireRecords, query);
    const codebookRows = [...datasets.codebook, ...buildResearchLessonReflectionCodebookRows(), ...buildQuestionnaireCodebookRows()];
    const exportedAt = new Date().toISOString();
    const rowCounts = {
      sessions: datasets.sessions.length,
      utterances: datasets.utterances.length,
      expressions: datasets.expressions.length,
      personas: datasets.personas.length,
      lesson_reflections: lessonRows.length,
      student_questionnaires: qRows.length,
      codebook: codebookRows.length,
    };
    const manifest = {
      export_id: `export_${Date.now()}`,
      exported_at: exportedAt,
      schema_version: 6,
      filters: exportQuery,
      study_phase: studyPhase || 'all',
      row_counts: rowCounts,
      lesson_reflection_join_key: ['research_id', 'local_date'],
      questionnaire_join_key: ['research_id', 'survey_wave'],
      questionnaire_phase_filter: 'not_applicable',
    };
    const files = [
      { name: 'sessions.csv', content: serializeResearchCsv(datasets.sessions, 'sessions') },
      { name: 'utterances.csv', content: serializeResearchCsv(datasets.utterances, 'utterances') },
      { name: 'expressions.csv', content: serializeResearchCsv(datasets.expressions, 'expressions') },
      { name: 'personas.csv', content: serializeResearchCsv(datasets.personas, 'personas') },
      { name: 'lesson_reflections.csv', content: serializeResearchLessonReflectionCsv(lessonRows) },
      { name: 'student_questionnaires.csv', content: serializeQuestionnaireCsv(qRows) },
      { name: 'codebook.csv', content: serializeResearchCsv(codebookRows, 'codebook') },
    ];
    const zip = buildStoredZip([...files, { name: 'manifest.json', content: JSON.stringify(manifest, null, 2) }]);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="research-bundle-${exportedAt.slice(0, 10).replace(/-/g, '')}.zip"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(zip);
  } catch (error: any) {
    console.error('Questionnaire augmented bundle failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'RESEARCH_BUNDLE_UNAVAILABLE' });
  }
};

export function withQuestionnaireResearchRuntime(path: string, handler: RequestHandler): RequestHandler {
  if (path === '/api/management/research.dashboard') return dashboardWrapper(handler);
  if (path === '/api/management/research.csv') return csvWrapper(handler);
  if (path === '/api/management/research.bundle.zip') return bundleHandler;
  return handler;
}
