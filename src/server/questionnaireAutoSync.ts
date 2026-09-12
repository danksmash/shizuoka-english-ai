import crypto from 'node:crypto';
import { createDocumentIfAbsent, setDocument } from './firestore';
import { resolveStudentByCode } from './persistence';
import { STUDY1_FORMAL_PARTICIPANT_HASHES } from './study1FormalParticipantHashes';
import {
  QUESTIONNAIRE_COLLECTION,
  QUESTIONNAIRE_INSTRUMENT_VERSION,
  QUESTIONNAIRE_ITEMS,
  calculateQuestionnaireScores,
  scoreQuestionnaireResponse,
  type QuestionnaireItemScores,
  type QuestionnaireRecord,
  type QuestionnaireWave,
} from './questionnaireResearch';

export const QUESTIONNAIRE_PRE_FORM_ID = '1wI_kC4zO9fgnq0B7kfV9BVuojuGTyWJ8GDaeoMtRAuI';
export const QUESTIONNAIRE_POST_FORM_ID = '1OculFD2Ykkgj1ad3opG4I12wfal4fdhOO1dODmEwg-A';
export const QUESTIONNAIRE_SYNC_STATE_COLLECTION = 'questionnaire_sync_state';
export const QUESTIONNAIRE_SYNC_STATE_DOCUMENT = 'study1';
export const QUESTIONNAIRE_SIGNATURE_MAX_AGE_SECONDS = 300;

const FORMAL_CLASS_SIZES: Record<string, number> = {
  '5-1': 26,
  '5-2': 25,
  '5-3': 25,
  '6-1': 34,
  '6-2': 35,
};

export interface QuestionnaireAutoIngestPayload {
  formId: string;
  formResponseId: string;
  submittedAt: string;
  learningCode: string;
  answers: Record<string, unknown>;
}

export interface QuestionnaireAutoIngestResult {
  responseId: string;
  researchId: string;
  classId: string;
  surveyWave: QuestionnaireWave;
  created: boolean;
  submittedAt: string;
}

function normalizedLearningCode(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

export function questionnaireWaveForFormId(formId: unknown): QuestionnaireWave | null {
  const id = String(formId ?? '').trim();
  if (id === QUESTIONNAIRE_PRE_FORM_ID) return 'pre_app';
  if (id === QUESTIONNAIRE_POST_FORM_ID) return 'post_exchange';
  return null;
}

export function normalizeQuestionnaireSubmittedAt(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  // Google Forms CSV timestamps are Japan-local slash-formatted values.
  // Parse those explicitly before Date.parse so a UTC Cloud Run host cannot
  // shift a local response time by nine hours during manual fallback import.
  const local = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  let ms = Number.NaN;
  if (local) {
    const [, y, m, d, hh, mm, ss = '00'] = local;
    ms = Date.parse(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${hh.padStart(2, '0')}:${mm}:${ss}+09:00`);
  } else {
    ms = Date.parse(raw);
  }
  if (!Number.isFinite(ms)) return '';
  return new Date(Math.floor(ms / 1000) * 1000).toISOString();
}

function gradeForClassId(classId: string): 5 | 6 | null {
  return classId.startsWith('5-') ? 5 : classId.startsWith('6-') ? 6 : null;
}

export function formalStudy1ParticipantHash(studentId: string): string {
  return crypto.createHash('sha256').update(`study1-formal-v1|${String(studentId || '').trim()}`).digest('hex');
}

export function isFormalStudy1ParticipantHash(
  studentIdHash: string,
  classId: string,
  attendanceNumber: number | '',
): boolean {
  const max = FORMAL_CLASS_SIZES[classId];
  const attendance = Number(attendanceNumber);
  return STUDY1_FORMAL_PARTICIPANT_HASHES.has(studentIdHash)
    && Boolean(max)
    && Number.isInteger(attendance)
    && attendance >= 1
    && attendance <= max;
}

export function isFormalStudy1Participant(student: { studentId: string; classId: string; attendanceNumber: number | '' }): boolean {
  return isFormalStudy1ParticipantHash(
    formalStudy1ParticipantHash(student.studentId),
    student.classId,
    student.attendanceNumber,
  );
}

function itemScoresFromAnswers(answers: Record<string, unknown>): QuestionnaireItemScores {
  const items = {} as QuestionnaireItemScores;
  for (const item of QUESTIONNAIRE_ITEMS) {
    const score = scoreQuestionnaireResponse(answers[item.sourceId]);
    if (score === null) throw new Error(`INVALID_ITEM_RESPONSE:${item.sourceId}`);
    items[item.id] = score;
  }
  return items;
}

function orderedAnswers(answers: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(QUESTIONNAIRE_ITEMS.map((item) => [item.sourceId, String(answers[item.sourceId] ?? '')]));
}

export function canonicalQuestionnaireAutoPayload(payload: QuestionnaireAutoIngestPayload): string {
  return JSON.stringify({
    formId: String(payload.formId ?? '').trim(),
    formResponseId: String(payload.formResponseId ?? '').trim(),
    submittedAt: String(payload.submittedAt ?? '').trim(),
    learningCode: normalizedLearningCode(payload.learningCode),
    answers: orderedAnswers(payload.answers || {}),
  });
}

export function computeQuestionnaireAutoSignature(secret: string, requestTimestamp: string, payload: QuestionnaireAutoIngestPayload): string {
  return crypto.createHmac('sha256', secret).update(`${requestTimestamp}\n${canonicalQuestionnaireAutoPayload(payload)}`).digest('hex');
}

export function verifyQuestionnaireAutoSignature(
  secret: string,
  requestTimestamp: unknown,
  signature: unknown,
  payload: QuestionnaireAutoIngestPayload,
  nowMs = Date.now(),
): boolean {
  if (!secret) return false;
  const timestampText = String(requestTimestamp ?? '').trim();
  const signatureText = String(signature ?? '').trim().toLowerCase();
  if (!/^\d{10,13}$/.test(timestampText) || !/^[0-9a-f]{64}$/.test(signatureText)) return false;
  const timestampNumber = Number(timestampText);
  const timestampMs = timestampText.length === 10 ? timestampNumber * 1000 : timestampNumber;
  if (!Number.isFinite(timestampMs) || Math.abs(nowMs - timestampMs) > QUESTIONNAIRE_SIGNATURE_MAX_AGE_SECONDS * 1000) return false;
  const expected = computeQuestionnaireAutoSignature(secret, timestampText, payload);
  const left = Buffer.from(signatureText, 'hex');
  const right = Buffer.from(expected, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function responseDocumentId(researchId: string, wave: QuestionnaireWave, submittedAt: string, items: QuestionnaireItemScores): string {
  const digest = crypto.createHash('sha256').update(JSON.stringify([researchId, wave, submittedAt, items])).digest('hex').slice(0, 24);
  return `q_${digest}`;
}

function tokyoDate(iso: string): string {
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }) : '';
}

async function persistCanonicalQuestionnaire(
  learningCode: string,
  wave: QuestionnaireWave,
  submittedAtInput: string,
  answers: Record<string, unknown>,
): Promise<QuestionnaireAutoIngestResult> {
  const code = normalizedLearningCode(learningCode);
  if (!/^[A-HJ-NP-Z2-9]{4}$/.test(code)) throw new Error('INVALID_LEARNING_CODE');

  const student = await resolveStudentByCode(code);
  if (!student) throw new Error('LEARNING_CODE_NOT_FOUND');
  if (!isFormalStudy1Participant(student)) throw new Error('NOT_FORMAL_STUDY1_PARTICIPANT');

  const gradeLevel = gradeForClassId(student.classId);
  if (!gradeLevel) throw new Error('NOT_MAIN_STUDY_CLASS');
  const submittedAt = normalizeQuestionnaireSubmittedAt(submittedAtInput);
  if (!submittedAt) throw new Error('INVALID_TIMESTAMP');

  const items = itemScoresFromAnswers(answers);
  const scores = calculateQuestionnaireScores(items);
  const responseId = responseDocumentId(student.researchId, wave, submittedAt, items);
  const record: QuestionnaireRecord = {
    responseId,
    researchId: student.researchId,
    classId: student.classId,
    gradeLevel,
    dataScope: 'main',
    surveyWave: wave,
    surveyDate: tokyoDate(submittedAt),
    submittedAt,
    instrumentVersion: QUESTIONNAIRE_INSTRUMENT_VERSION,
    items,
    ...scores,
    dataQualityFlag: 'complete',
    importedAt: new Date().toISOString(),
  };

  const created = await createDocumentIfAbsent(QUESTIONNAIRE_COLLECTION, responseId, record as unknown as Record<string, unknown>);
  if (created) {
    await setDocument(QUESTIONNAIRE_SYNC_STATE_COLLECTION, QUESTIONNAIRE_SYNC_STATE_DOCUMENT, {
      lastIngestedAt: new Date().toISOString(),
      lastResponseId: responseId,
      lastSurveyWave: wave,
    });
  }
  return { responseId, researchId: student.researchId, classId: student.classId, surveyWave: wave, created, submittedAt };
}

export async function ingestQuestionnaireAutoSubmission(payload: QuestionnaireAutoIngestPayload): Promise<QuestionnaireAutoIngestResult> {
  const wave = questionnaireWaveForFormId(payload.formId);
  if (!wave) throw new Error('UNKNOWN_QUESTIONNAIRE_FORM');
  if (!String(payload.formResponseId ?? '').trim()) throw new Error('FORM_RESPONSE_ID_MISSING');
  return persistCanonicalQuestionnaire(payload.learningCode, wave, payload.submittedAt, payload.answers || {});
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

function sourceIdFromHeader(header: string): string {
  const compact = String(header || '').normalize('NFKC').trim();
  const match = compact.match(/(?:^|\s)([123]-[1-5])(?:[.．。\s]|$)/);
  return match?.[1] || '';
}

export interface StrictQuestionnaireImportResult {
  totalRows: number;
  imported: number;
  alreadyImported: number;
  rejected: number;
  errors: Array<{ row: number; error: string }>;
}

export async function importStrictGoogleFormsQuestionnaireCsv(csvText: string, surveyWave: QuestionnaireWave): Promise<StrictQuestionnaireImportResult> {
  const rows = parseCsv(csvText.replace(/^\uFEFF/, ''));
  if (rows.length < 2) throw new Error('QUESTIONNAIRE_CSV_EMPTY');
  const headers = rows[0].map((header) => header.trim());
  const codeIndex = headers.findIndex((header) => /学習コード|4文字/.test(header));
  const timestampIndex = headers.findIndex((header) => /タイムスタンプ|timestamp/i.test(header));
  if (codeIndex < 0) throw new Error('QUESTIONNAIRE_CODE_COLUMN_MISSING');
  if (timestampIndex < 0) throw new Error('QUESTIONNAIRE_TIMESTAMP_COLUMN_MISSING');
  const itemColumns = new Map<string, number>();
  headers.forEach((header, index) => {
    const sourceId = sourceIdFromHeader(header);
    if (sourceId) itemColumns.set(sourceId, index);
  });
  if (itemColumns.size !== QUESTIONNAIRE_ITEMS.length) throw new Error(`QUESTIONNAIRE_ITEM_COLUMNS_MISSING:${QUESTIONNAIRE_ITEMS.length - itemColumns.size}`);

  const result: StrictQuestionnaireImportResult = { totalRows: rows.length - 1, imported: 0, alreadyImported: 0, rejected: 0, errors: [] };
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const source = rows[rowIndex];
    try {
      const answers = Object.fromEntries(QUESTIONNAIRE_ITEMS.map((item) => [item.sourceId, source[itemColumns.get(item.sourceId)!]]));
      const saved = await persistCanonicalQuestionnaire(String(source[codeIndex] || ''), surveyWave, String(source[timestampIndex] || ''), answers);
      if (saved.created) result.imported += 1;
      else result.alreadyImported += 1;
    } catch (error: any) {
      result.rejected += 1;
      result.errors.push({ row: rowIndex + 1, error: String(error?.message || 'UNKNOWN_IMPORT_ERROR').slice(0, 160) });
    }
  }
  return result;
}
