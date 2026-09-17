import type { RequestHandler } from 'express';
import { getAllSessionsForManagement } from './persistence';
import {
  buildResearchExportDataSets,
  filterResearchExportDataSets,
  normalizeFormalResearchExportQuery,
  serializeResearchCsv,
  type ResearchExportDatasetName,
} from './researchDashboard';
import { getAllReflectionRecordsForTeacher } from './reflectionPersistence';
import {
  buildResearchLessonReflectionCodebookRows,
  buildResearchLessonReflectionRows,
  serializeResearchLessonReflectionCsv,
} from './researchLessonReflectionExport';
import { filterManualResearchExcludedSessions, MANUAL_RESEARCH_EXCLUSIONS } from './researchManualExclusions';

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

const researchCsvHandler: RequestHandler = async (req, res) => {
  try {
    const requested = typeof req.query?.dataset === 'string' ? req.query.dataset : 'sessions';
    if (requested === 'lesson_reflections') {
      const rows = buildResearchLessonReflectionRows(
        await getAllReflectionRecordsForTeacher(),
        normalizeFormalResearchExportQuery(req.query),
      );
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
    const rawSessions = (dataset === 'personas' || dataset === 'codebook') ? [] : await getAllSessionsForManagement();
    const analysisSessions = filterManualResearchExcludedSessions(rawSessions);
    const datasets = filterResearchExportDataSets(
      buildResearchExportDataSets(analysisSessions),
      normalizeFormalResearchExportQuery(req.query),
    );
    const csv = serializeResearchCsv(datasets[dataset], dataset);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${dataset}.csv"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(csv);
  } catch (error: any) {
    console.error('Research export with manual exclusions failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'RESEARCH_EXPORT_UNAVAILABLE' });
  }
};

const researchBundleHandler: RequestHandler = async (req, res) => {
  try {
    const exportQuery = normalizeFormalResearchExportQuery(req.query);
    const [rawSessions, lessonReflections] = await Promise.all([
      getAllSessionsForManagement(),
      getAllReflectionRecordsForTeacher(),
    ]);
    const analysisSessions = filterManualResearchExcludedSessions(rawSessions);
    const datasets = filterResearchExportDataSets(buildResearchExportDataSets(analysisSessions), exportQuery);
    const lessonReflectionRows = buildResearchLessonReflectionRows(lessonReflections, exportQuery);
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
      lesson_reflection_filter_scope: ['start', 'end', 'dataScope', 'grade', 'classId'],
      manual_session_exclusions: MANUAL_RESEARCH_EXCLUSIONS.map((row) => ({
        session_id: row.sessionId,
        research_id: row.researchId,
        decided_at: row.decidedAt,
        reason: row.reason,
      })),
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
    console.error('Research bundle with manual exclusions failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'RESEARCH_BUNDLE_UNAVAILABLE' });
  }
};

export function manualResearchExclusionGetHandler(path: string): RequestHandler | null {
  if (path === '/api/management/research.csv') return researchCsvHandler;
  if (path === '/api/management/research.bundle.zip') return researchBundleHandler;
  return null;
}
