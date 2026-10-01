import { once } from 'node:events';
import { Readable } from 'node:stream';
import { createDeflateRaw } from 'node:zlib';
import type { RequestHandler, Response } from 'express';
import {
  RESEARCH_EXPORT_HEADERS,
  buildResearchExportDataSets,
  filterResearchSessionRows,
  normalizeFormalResearchExportQuery,
  serializeResearchCsv,
  type ResearchFilterQuery,
} from './researchDashboard';
import { getStudentRecordsForManagement } from './persistence';
import { getAllReflectionRecordsForTeacher } from './reflectionPersistence';
import {
  buildResearchLessonReflectionCodebookRows,
  buildResearchLessonReflectionRows,
  serializeResearchLessonReflectionCsv,
} from './researchLessonReflectionExport';
import {
  buildQuestionnaireCodebookRows,
  buildQuestionnaireExportRows,
  getAllQuestionnaireRecords,
  serializeQuestionnaireCsv,
} from './questionnaireResearch';
import {
  PHASE_BUNDLE_MANIFEST_SCHEMA_VERSION,
  PHASE_CODEBOOK_ROWS,
  PHASE_RESEARCH_EXPORT_SCHEMA_VERSION,
  PHASE_SESSION_EXPORT_HEADERS,
  augmentSessionRowsWithPhase,
} from './researchPhaseAnalyticsRuntime';
import {
  filterReflectionsForStudyPhase,
  filterSessionsForStudyPhase,
  normalizeStudyPhaseFilter,
} from './researchPhaseRuntime';
import { getAllStudySchedules, type StudyScheduleRecord } from './studySchedulePersistence';
import { readResearchSessionPage } from './researchExportPaging';
import {
  buildFastStreamingPreparation,
  buildFastStreamingRowsForPage,
  type FastStreamingPreparation,
} from './researchStreamingFastBuilder';

const FULL_PAGE_SIZE = 500;
const METADATA_PAGE_SIZE = 500;
const CSV_BATCH_ROWS = 200;
const METADATA_FIELDS = [
  'sessionId', 'studentId', 'researchId', 'classId', 'startedAt', 'endedAt', 'localDate', 'personaId', 'aiStudentId',
];

type Row = Record<string, any>;
type LargeDataset = 'sessions' | 'utterances' | 'expressions';
type StudentRecord = Awaited<ReturnType<typeof getStudentRecordsForManagement>>[number];
type StudentMap = Map<string, StudentRecord>;

export type StreamingPreparation = FastStreamingPreparation;

function documentId(row: Row): string {
  return String(row.sessionId || row._name || '').split('/').pop() || '';
}

function enrichSessions(rows: Row[], students: StudentMap): Row[] {
  return rows.map((session) => {
    const student = students.get(String(session.studentId || ''));
    return {
      ...session,
      sessionId: String(session.sessionId || documentId(session)),
      formalStudyParticipant: student?.formalStudyParticipant === true,
      studySiteId: student?.studySiteId || '',
      schoolCondition: student?.schoolCondition || '',
      studyGradeLevel: student?.gradeLevel || '',
      studyStartDate: student?.studyStartDate || '',
    };
  });
}

function isTransientPageError(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name}:${error.message}` : String(error || '');
  return /FIRESTORE_RESEARCH_PAGE_(?:408|429|500|502|503|504)|METADATA_TOKEN_(?:408|429|500|502|503|504)|AbortError|aborted|fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|UND_ERR/i.test(text);
}

async function readPageWithRetry(pageToken: string, pageSize: number, fieldPaths: string[] = []) {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await readResearchSessionPage(pageToken, pageSize, fieldPaths);
    } catch (error) {
      lastError = error;
      if (!isTransientPageError(error) || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt === 1 ? 120 : 320));
    }
  }
  throw lastError;
}

async function loadMetadataSessions(students: StudentMap): Promise<Row[]> {
  const rows: Row[] = [];
  let pageToken = '';
  do {
    const page = await readPageWithRetry(pageToken, METADATA_PAGE_SIZE, METADATA_FIELDS);
    rows.push(...enrichSessions(page.rows, students));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return rows;
}

async function* fullSessionPages(students: StudentMap): AsyncGenerator<Row[]> {
  let pageToken = '';
  do {
    const page = await readPageWithRetry(pageToken, FULL_PAGE_SIZE);
    yield enrichSessions(page.rows, students);
    pageToken = page.nextPageToken;
  } while (pageToken);
}

export function buildStreamingPreparationFromSessions(
  metadataSessions: Row[],
  schedules: StudyScheduleRecord[],
  studyPhase: unknown,
): StreamingPreparation {
  return buildFastStreamingPreparation(metadataSessions, schedules, studyPhase);
}

async function prepareProductionExport(
  students: StudentMap,
  schedules: StudyScheduleRecord[],
  studyPhase: unknown,
): Promise<StreamingPreparation> {
  const metadataSessions = await loadMetadataSessions(students);
  return buildStreamingPreparationFromSessions(metadataSessions, schedules, studyPhase);
}

function applyGlobalContext(rows: Row[], preparation: StreamingPreparation): Row[] {
  return rows.map((row) => ({
    ...row,
    ...(preparation.contextBySessionId.get(String(row.session_id || '')) || {}),
  }));
}

export function buildStreamingRowsForPage(
  pageSessions: Row[],
  preparation: StreamingPreparation,
  schedules: StudyScheduleRecord[],
  studyPhase: unknown,
  exportQuery: ResearchFilterQuery,
  dataset: LargeDataset,
): Row[] {
  if (dataset === 'utterances' || dataset === 'expressions') {
    return buildFastStreamingRowsForPage(pageSessions, preparation, schedules, studyPhase, exportQuery, dataset);
  }
  const phasePage = filterSessionsForStudyPhase(pageSessions, schedules, studyPhase);
  if (!phasePage.length) return [];
  const built = buildResearchExportDataSets(phasePage);
  const sessions = applyGlobalContext(built.sessions, preparation);
  const includedSessions = filterResearchSessionRows(sessions, exportQuery);
  if (!includedSessions.length) return [];
  return augmentSessionRowsWithPhase(includedSessions, schedules);
}

function csvCell(value: unknown, protectLeadingWhitespace: boolean): string {
  const numeric = typeof value === 'number' && Number.isFinite(value);
  const original = value === null || value === undefined ? '' : String(value);
  const formulaPattern = protectLeadingWhitespace ? /^\s*[=+\-@]/ : /^[=+\-@]/;
  const safe = !numeric && formulaPattern.test(original) ? `'${original}` : original;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function serializeStreamingCsvRow(row: Row, headers: readonly string[], protectLeadingWhitespace = true): string {
  return headers.map((key) => csvCell(row[key], protectLeadingWhitespace)).join(',');
}

function headersForDataset(dataset: LargeDataset): readonly string[] {
  return dataset === 'sessions' ? PHASE_SESSION_EXPORT_HEADERS : RESEARCH_EXPORT_HEADERS[dataset];
}

async function* productionDatasetCsvChunks(
  dataset: LargeDataset,
  students: StudentMap,
  preparation: StreamingPreparation,
  schedules: StudyScheduleRecord[],
  studyPhase: unknown,
  exportQuery: ResearchFilterQuery,
  counter: { rows: number },
): AsyncGenerator<Buffer> {
  const headers = headersForDataset(dataset);
  const protectLeadingWhitespace = dataset !== 'sessions';
  yield Buffer.from(`\uFEFF${headers.map((key) => csvCell(key, protectLeadingWhitespace)).join(',')}\n`, 'utf8');
  for await (const page of fullSessionPages(students)) {
    const rows = buildStreamingRowsForPage(page, preparation, schedules, studyPhase, exportQuery, dataset);
    counter.rows += rows.length;
    for (let index = 0; index < rows.length; index += CSV_BATCH_ROWS) {
      const batch = rows.slice(index, index + CSV_BATCH_ROWS)
        .map((row) => serializeStreamingCsvRow(row, headers, protectLeadingWhitespace))
        .join('\n');
      if (batch) yield Buffer.from(`${batch}\n`, 'utf8');
    }
  }
}

async function writeResponseChunk(res: Response, chunk: Buffer | string): Promise<void> {
  if (res.write(chunk)) return;
  await once(res, 'drain');
}

function phaseAwareCodebook(baseRows: Row[]): Row[] {
  return [
    ...baseRows.map((row) => row.variable === 'research_schema_version'
      ? { ...row, allowed_values: PHASE_RESEARCH_EXPORT_SCHEMA_VERSION }
      : row),
    ...PHASE_CODEBOOK_ROWS,
  ];
}

function serializeRows(rows: Row[], headers: readonly string[], protectLeadingWhitespace = false): string {
  const lines = [headers.map((header) => csvCell(header, protectLeadingWhitespace)).join(',')];
  for (const row of rows) lines.push(serializeStreamingCsvRow(row, headers, protectLeadingWhitespace));
  return `\uFEFF${lines.join('\n')}\n`;
}

function scheduleSnapshot(schedules: StudyScheduleRecord[]) {
  return Object.fromEntries(schedules.map((schedule) => [schedule.classId, {
    revision: schedule.revision,
    appStartDate: schedule.appStartDate,
    nationalityRevealDate: schedule.nationalityRevealDate,
    videoViewDate: schedule.videoViewDate,
    exchangeDate: schedule.exchangeDate,
  }]));
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32Update(crc: number, buffer: Buffer): number {
  let value = crc >>> 0;
  for (const byte of buffer) value = (CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8)) >>> 0;
  return value >>> 0;
}

type ZipEntry = {
  name: Buffer;
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  localOffset: number;
};

export class StreamingZipWriter {
  private offset = 0;
  private readonly entries: ZipEntry[] = [];

  constructor(private readonly sink: Response) {}

  private async write(chunk: Buffer): Promise<void> {
    await writeResponseChunk(this.sink, chunk);
    this.offset += chunk.length;
  }

  async addFile(nameText: string, chunks: AsyncIterable<Buffer | string>): Promise<void> {
    const name = Buffer.from(nameText, 'utf8');
    const localOffset = this.offset;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0808, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(name.length, 26);
    await this.write(local);
    await this.write(name);

    let crc = 0xffffffff;
    let uncompressedSize = 0;
    let compressedSize = 0;
    const counted = async function* () {
      for await (const chunk of chunks) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf8');
        crc = crc32Update(crc, buffer);
        uncompressedSize += buffer.length;
        yield buffer;
      }
    };
    const deflater = createDeflateRaw({ level: 6 });
    Readable.from(counted()).pipe(deflater);
    for await (const chunk of deflater) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      compressedSize += buffer.length;
      await this.write(buffer);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    if (uncompressedSize > 0xffffffff || compressedSize > 0xffffffff || localOffset > 0xffffffff) {
      throw new Error('RESEARCH_ZIP64_REQUIRED');
    }
    const descriptor = Buffer.alloc(16);
    descriptor.writeUInt32LE(0x08074b50, 0);
    descriptor.writeUInt32LE(crc, 4);
    descriptor.writeUInt32LE(compressedSize, 8);
    descriptor.writeUInt32LE(uncompressedSize, 12);
    await this.write(descriptor);
    this.entries.push({ name, crc, compressedSize, uncompressedSize, localOffset });
  }

  async finalize(): Promise<void> {
    const centralOffset = this.offset;
    for (const entry of this.entries) {
      const central = Buffer.alloc(46);
      central.writeUInt32LE(0x02014b50, 0);
      central.writeUInt16LE(20, 4);
      central.writeUInt16LE(20, 6);
      central.writeUInt16LE(0x0808, 8);
      central.writeUInt16LE(8, 10);
      central.writeUInt32LE(entry.crc, 16);
      central.writeUInt32LE(entry.compressedSize, 20);
      central.writeUInt32LE(entry.uncompressedSize, 24);
      central.writeUInt16LE(entry.name.length, 28);
      central.writeUInt32LE(entry.localOffset, 42);
      await this.write(central);
      await this.write(entry.name);
    }
    const centralSize = this.offset - centralOffset;
    if (this.entries.length > 0xffff || centralOffset > 0xffffffff || centralSize > 0xffffffff) throw new Error('RESEARCH_ZIP64_REQUIRED');
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(this.entries.length, 8);
    end.writeUInt16LE(this.entries.length, 10);
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(centralOffset, 16);
    await this.write(end);
  }
}

async function* oneChunk(content: string | Buffer): AsyncGenerator<string | Buffer> {
  yield content;
}

async function streamLargeCsv(req: any, res: Response, dataset: LargeDataset): Promise<void> {
  const query = req.query as Record<string, unknown>;
  const studyPhase = normalizeStudyPhaseFilter(query.studyPhase);
  const exportQuery = normalizeFormalResearchExportQuery(query);
  const [studentRecords, schedules] = await Promise.all([getStudentRecordsForManagement(), getAllStudySchedules()]);
  const students = new Map(studentRecords.map((student) => [student.studentId, student]));
  const preparation = await prepareProductionExport(students, schedules, studyPhase);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${dataset}.csv"`);
  res.setHeader('Cache-Control', 'no-store');
  const counter = { rows: 0 };
  for await (const chunk of productionDatasetCsvChunks(dataset, students, preparation, schedules, studyPhase, exportQuery, counter)) {
    await writeResponseChunk(res, chunk);
  }
  res.end();
  console.info('Streaming research CSV complete', { dataset, rows: counter.rows });
}

async function handleSmallCsv(req: any, res: Response, requested: string): Promise<boolean> {
  const query = req.query as Record<string, unknown>;
  const exportQuery = normalizeFormalResearchExportQuery(query);
  const studyPhase = normalizeStudyPhaseFilter(query.studyPhase);
  if (requested === 'lesson_reflections') {
    const [source, schedules] = await Promise.all([getAllReflectionRecordsForTeacher(), getAllStudySchedules()]);
    const rows = buildResearchLessonReflectionRows(filterReflectionsForStudyPhase(source, schedules, studyPhase), exportQuery);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="lesson_reflections.csv"');
    res.setHeader('Cache-Control', 'no-store');
    res.send(serializeResearchLessonReflectionCsv(rows));
    return true;
  }
  if (requested === 'student_questionnaires') {
    const rows = buildQuestionnaireExportRows(await getAllQuestionnaireRecords(), query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="student_questionnaires.csv"');
    res.setHeader('Cache-Control', 'no-store');
    res.send(serializeQuestionnaireCsv(rows));
    return true;
  }
  const base = buildResearchExportDataSets([]);
  if (requested === 'personas') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="personas.csv"');
    res.setHeader('Cache-Control', 'no-store');
    res.send(serializeResearchCsv(base.personas, 'personas'));
    return true;
  }
  if (requested === 'codebook') {
    const rows = phaseAwareCodebook([
      ...base.codebook,
      ...buildResearchLessonReflectionCodebookRows(),
      ...buildQuestionnaireCodebookRows(),
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="codebook.csv"');
    res.setHeader('Cache-Control', 'no-store');
    res.send(serializeRows(rows, RESEARCH_EXPORT_HEADERS.codebook));
    return true;
  }
  return false;
}

const streamingCsvHandler: RequestHandler = async (req, res) => {
  const requested = typeof req.query?.dataset === 'string' ? req.query.dataset : 'sessions';
  try {
    if (requested === 'sessions' || requested === 'utterances' || requested === 'expressions') {
      await streamLargeCsv(req, res, requested);
      return;
    }
    if (await handleSmallCsv(req, res, requested)) return;
    return res.status(400).json({ success: false, error: 'INVALID_RESEARCH_DATASET' });
  } catch (error: any) {
    console.error('Streaming research CSV failed', { dataset: requested, message: error?.message });
    if (res.headersSent) {
      res.destroy(error);
      return;
    }
    return res.status(503).json({ success: false, error: 'RESEARCH_EXPORT_UNAVAILABLE' });
  }
};

const streamingBundleHandler: RequestHandler = async (req, res) => {
  const query = req.query as Record<string, unknown>;
  try {
    const exportQuery = normalizeFormalResearchExportQuery(query);
    const studyPhase = normalizeStudyPhaseFilter(query.studyPhase);
    const [studentRecords, schedules, lessonReflections, questionnaireRecords] = await Promise.all([
      getStudentRecordsForManagement(),
      getAllStudySchedules(),
      getAllReflectionRecordsForTeacher(),
      getAllQuestionnaireRecords(),
    ]);
    const students = new Map(studentRecords.map((student) => [student.studentId, student]));
    const preparation = await prepareProductionExport(students, schedules, studyPhase);
    const lessonRows = buildResearchLessonReflectionRows(
      filterReflectionsForStudyPhase(lessonReflections, schedules, studyPhase),
      exportQuery,
    );
    const questionnaireRows = buildQuestionnaireExportRows(questionnaireRecords, query);
    const base = buildResearchExportDataSets([]);
    const personaRows = base.personas;
    const codebookRows = phaseAwareCodebook([
      ...base.codebook,
      ...buildResearchLessonReflectionCodebookRows(),
      ...buildQuestionnaireCodebookRows(),
    ]);
    const exportedAt = new Date().toISOString();

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="research-bundle-${exportedAt.slice(0, 10).replace(/-/g, '')}.zip"`);
    res.setHeader('Cache-Control', 'no-store');
    const zip = new StreamingZipWriter(res);
    const counts = { sessions: 0, utterances: 0, expressions: 0 };
    for (const dataset of ['sessions', 'utterances', 'expressions'] as const) {
      const counter = { rows: 0 };
      await zip.addFile(`${dataset}.csv`, productionDatasetCsvChunks(dataset, students, preparation, schedules, studyPhase, exportQuery, counter));
      counts[dataset] = counter.rows;
    }
    await zip.addFile('personas.csv', oneChunk(serializeResearchCsv(personaRows, 'personas')));
    await zip.addFile('lesson_reflections.csv', oneChunk(serializeResearchLessonReflectionCsv(lessonRows)));
    await zip.addFile('student_questionnaires.csv', oneChunk(serializeQuestionnaireCsv(questionnaireRows)));
    await zip.addFile('codebook.csv', oneChunk(serializeRows(codebookRows, RESEARCH_EXPORT_HEADERS.codebook)));

    const manifest = {
      export_id: `export_${Date.now()}`,
      exported_at: exportedAt,
      schema_version: PHASE_BUNDLE_MANIFEST_SCHEMA_VERSION,
      research_export_schema_version: PHASE_RESEARCH_EXPORT_SCHEMA_VERSION,
      filters: exportQuery,
      study_phase: studyPhase || 'all',
      study_schedule_snapshot: scheduleSnapshot(schedules),
      phase_definition_source: 'study_schedules + phaseForLocalDate(local_date)',
      analysis_period_definition_source: 'study_schedules + analysisPeriodForLocalDate(local_date); comparison C1/C2/Post are analysis boundaries only',
      phase_comparison_filter_exclusions: ['personaId', 'studyPhase'],
      assigned_country_persona_definition: 'assigned_partner_country compared with persona_country after country normalization',
      assignment_country_provenance: 'immutable session-time snapshot when present; blank remains blank and is never silently backfilled from the current student assignment record',
      row_counts: {
        sessions: counts.sessions,
        utterances: counts.utterances,
        expressions: counts.expressions,
        personas: personaRows.length,
        lesson_reflections: lessonRows.length,
        student_questionnaires: questionnaireRows.length,
        codebook: codebookRows.length,
      },
      lesson_reflection_join_key: ['research_id', 'local_date'],
      questionnaire_join_key: ['research_id', 'survey_wave'],
      questionnaire_phase_filter: 'not_applicable',
      export_transport: 'streaming-deflate-v1',
    };
    await zip.addFile('manifest.json', oneChunk(JSON.stringify(manifest, null, 2)));
    await zip.finalize();
    res.end();
    console.info('Streaming research bundle complete', { rows: manifest.row_counts });
  } catch (error: any) {
    console.error('Streaming research bundle failed', { message: error?.message });
    if (res.headersSent) {
      res.destroy(error);
      return;
    }
    return res.status(503).json({ success: false, error: 'RESEARCH_BUNDLE_UNAVAILABLE' });
  }
};

export function withResearchStreamingExportRuntime(path: string, handler: RequestHandler): RequestHandler {
  if (path === '/api/management/research.csv') return streamingCsvHandler;
  if (path === '/api/management/research.bundle.zip') return streamingBundleHandler;
  return handler;
}
