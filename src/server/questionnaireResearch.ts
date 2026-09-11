import crypto from 'node:crypto';
import { createDocumentIfAbsent, listCollection } from './firestore';
import { resolveStudentByCode } from './persistence';

export type QuestionnaireWave = 'pre_app' | 'post_exchange';
export type QuestionnaireMetricKey = 'total' | 'persistence' | 'self_regulation' | 'l2wtc';

export const QUESTIONNAIRE_INSTRUMENT_VERSION = 'attitude-l2wtc-20260811-v1';
export const QUESTIONNAIRE_COLLECTION = 'student_questionnaires';

export const QUESTIONNAIRE_ITEMS = [
  { id: 'q1_1', sourceId: '1-1', scale: 'persistence', text: '相手の英語を聞いてわかるときは、うなずいたり、あいづちを打ったりして聞き続けています。' },
  { id: 'q1_2', sourceId: '1-2', scale: 'persistence', text: '英語を話すときは、まちがうことをおそれずに、相手に伝えています。' },
  { id: 'q1_3', sourceId: '1-3', scale: 'persistence', text: '英語で会話するとき、相手に聞きたいことを質問して、英語で話し続けています。' },
  { id: 'q1_4', sourceId: '1-4', scale: 'persistence', text: '英語で書かれた単語や文を読むとき、意味がわからない部分があっても、全体や前後の内容からその意味を予想しています。' },
  { id: 'q1_5', sourceId: '1-5', scale: 'persistence', text: '英語の文字を書くときは、文字の大きさや形、線の長さに注意して書いています。' },
  { id: 'q2_1', sourceId: '2-1', scale: 'self_regulation', text: '「英語を聞いて、わかるようになったことは何か」、「まだわからないことは何か」を定期的にふりかえっています。' },
  { id: 'q2_2', sourceId: '2-2', scale: 'self_regulation', text: '自分から進んで、英語を何度も読んだり書いたりするようにしています。' },
  { id: 'q2_3', sourceId: '2-3', scale: 'self_regulation', text: '英語の授業には、その日の授業で「何ができるようになるか」を考えながら、参加しています。' },
  { id: 'q2_4', sourceId: '2-4', scale: 'self_regulation', text: '英語の授業で、どうしてもわからないことがあったら、友だちに質問しています。' },
  { id: 'q2_5', sourceId: '2-5', scale: 'self_regulation', text: '「英語を話すときに、できるようになったことは何か」、「まだできないことは何か」を定期的にふりかえっています。' },
  { id: 'q3_1', sourceId: '3-1', scale: 'l2wtc', text: '初めて会った人が英語を話していたら、何を話しているのか聞いてみようとします。' },
  { id: 'q3_2', sourceId: '3-2', scale: 'l2wtc', text: '英語の授業中、できるだけ多くの友だちに英語で話しかけようとしています。' },
  { id: 'q3_3', sourceId: '3-3', scale: 'l2wtc', text: '英語を話す知り合いがいたら、英語で話しかけようとします。' },
  { id: 'q3_4', sourceId: '3-4', scale: 'l2wtc', text: '英語の授業中、チャンスがあれば、先生と英語で話そうとしています。' },
  { id: 'q3_5', sourceId: '3-5', scale: 'l2wtc', text: '英語がわかる知り合いがいたら、英語でメッセージを書いてみようとします。' },
] as const;

const RESPONSE_SCORE = new Map<string, number>([
  ['よくあてはまる', 6],
  ['あてはまる', 5],
  ['まあまああてはまる', 4],
  ['あまりあてはまらない', 3],
  ['あてはまらない', 2],
  ['まったくあてはまらない', 1],
]);

function normalizeResponseLabel(value: unknown): string {
  return String(value ?? '').normalize('NFKC').replace(/[\s　]+/g, '').replace(/[，,。．.]/g, '').trim();
}

export function scoreQuestionnaireResponse(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 6) return value;
  const text = normalizeResponseLabel(value);
  if (/^[1-6]$/.test(text)) return Number(text);
  return RESPONSE_SCORE.get(text) ?? null;
}

export type QuestionnaireItemScores = Record<(typeof QUESTIONNAIRE_ITEMS)[number]['id'], number>;

export interface QuestionnaireScores {
  totalSum: number;
  totalMean: number;
  persistenceSum: number;
  persistenceMean: number;
  selfRegulationSum: number;
  selfRegulationMean: number;
  l2wtcSum: number;
  l2wtcMean: number;
}

export function calculateQuestionnaireScores(items: QuestionnaireItemScores): QuestionnaireScores {
  const values = QUESTIONNAIRE_ITEMS.map((item) => items[item.id]);
  const persistence = QUESTIONNAIRE_ITEMS.filter((item) => item.scale === 'persistence').map((item) => items[item.id]);
  const selfRegulation = QUESTIONNAIRE_ITEMS.filter((item) => item.scale === 'self_regulation').map((item) => items[item.id]);
  const l2wtc = QUESTIONNAIRE_ITEMS.filter((item) => item.scale === 'l2wtc').map((item) => items[item.id]);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const fixed = (n: number) => Number(n.toFixed(6));
  return {
    totalSum: sum(values), totalMean: fixed(sum(values) / values.length),
    persistenceSum: sum(persistence), persistenceMean: fixed(sum(persistence) / persistence.length),
    selfRegulationSum: sum(selfRegulation), selfRegulationMean: fixed(sum(selfRegulation) / selfRegulation.length),
    l2wtcSum: sum(l2wtc), l2wtcMean: fixed(sum(l2wtc) / l2wtc.length),
  };
}

export interface QuestionnaireRecord extends QuestionnaireScores {
  responseId: string;
  researchId: string;
  classId: string;
  gradeLevel: 5 | 6;
  dataScope: 'main';
  surveyWave: QuestionnaireWave;
  surveyDate: string;
  submittedAt: string;
  instrumentVersion: string;
  items: QuestionnaireItemScores;
  dataQualityFlag: 'complete';
  importedAt: string;
}

function gradeForClassId(classId: string): 5 | 6 | null {
  if (/^5-[123]$/.test(classId)) return 5;
  if (/^6-[123]$/.test(classId)) return 6;
  return null;
}

function responseDocumentId(researchId: string, wave: QuestionnaireWave, submittedAt: string, items: QuestionnaireItemScores): string {
  const digest = crypto.createHash('sha256').update(JSON.stringify([researchId, wave, submittedAt, items])).digest('hex').slice(0, 24);
  return `q_${digest}`;
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

function timestampToIso(value: string): string {
  const text = value.trim();
  const parsed = Date.parse(text);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  const slash = text.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!slash) return '';
  const [, y, m, d, hh, mm, ss = '00'] = slash;
  const local = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${hh.padStart(2, '0')}:${mm}:${ss}+09:00`;
  const ms = Date.parse(local);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : '';
}

function tokyoDate(iso: string): string {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }) : '';
}

export interface QuestionnaireImportResult {
  totalRows: number;
  imported: number;
  alreadyImported: number;
  rejected: number;
  errors: Array<{ row: number; error: string }>;
}

export async function importGoogleFormsQuestionnaireCsv(csvText: string, surveyWave: QuestionnaireWave): Promise<QuestionnaireImportResult> {
  if (!['pre_app', 'post_exchange'].includes(surveyWave)) throw new Error('INVALID_SURVEY_WAVE');
  const rows = parseCsv(csvText.replace(/^\uFEFF/, ''));
  if (rows.length < 2) throw new Error('QUESTIONNAIRE_CSV_EMPTY');
  const headers = rows[0].map((h) => h.trim());
  const codeIndex = headers.findIndex((h) => /学習コード|4文字/.test(h));
  if (codeIndex < 0) throw new Error('QUESTIONNAIRE_CODE_COLUMN_MISSING');
  const timestampIndex = headers.findIndex((h) => /タイムスタンプ|timestamp/i.test(h));
  const itemColumnById = new Map<string, number>();
  headers.forEach((header, index) => {
    const sourceId = sourceIdFromHeader(header);
    const item = QUESTIONNAIRE_ITEMS.find((candidate) => candidate.sourceId === sourceId);
    if (item) itemColumnById.set(item.id, index);
  });
  if (itemColumnById.size !== QUESTIONNAIRE_ITEMS.length) throw new Error(`QUESTIONNAIRE_ITEM_COLUMNS_MISSING:${QUESTIONNAIRE_ITEMS.length - itemColumnById.size}`);

  const result: QuestionnaireImportResult = { totalRows: rows.length - 1, imported: 0, alreadyImported: 0, rejected: 0, errors: [] };
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const source = rows[rowIndex];
    try {
      const code = String(source[codeIndex] || '').trim().toUpperCase();
      if (!/^[A-HJ-NP-Z2-9]{4}$/.test(code)) throw new Error('INVALID_LEARNING_CODE');
      const student = await resolveStudentByCode(code);
      if (!student) throw new Error('LEARNING_CODE_NOT_FOUND');
      const gradeLevel = gradeForClassId(student.classId);
      if (!gradeLevel) throw new Error('NOT_MAIN_STUDY_CLASS');
      const items = {} as QuestionnaireItemScores;
      for (const item of QUESTIONNAIRE_ITEMS) {
        const index = itemColumnById.get(item.id)!;
        const score = scoreQuestionnaireResponse(source[index]);
        if (score === null) throw new Error(`INVALID_ITEM_RESPONSE:${item.sourceId}`);
        items[item.id] = score;
      }
      const submittedAt = timestampIndex >= 0 ? timestampToIso(String(source[timestampIndex] || '')) : '';
      if (!submittedAt) throw new Error('INVALID_TIMESTAMP');
      const scores = calculateQuestionnaireScores(items);
      const responseId = responseDocumentId(student.researchId, surveyWave, submittedAt, items);
      const record: QuestionnaireRecord = {
        responseId,
        researchId: student.researchId,
        classId: student.classId,
        gradeLevel,
        dataScope: 'main',
        surveyWave,
        surveyDate: tokyoDate(submittedAt),
        submittedAt,
        instrumentVersion: QUESTIONNAIRE_INSTRUMENT_VERSION,
        items,
        ...scores,
        dataQualityFlag: 'complete',
        importedAt: new Date().toISOString(),
      };
      const created = await createDocumentIfAbsent(QUESTIONNAIRE_COLLECTION, responseId, record as unknown as Record<string, unknown>);
      if (created) result.imported += 1;
      else result.alreadyImported += 1;
    } catch (error: any) {
      result.rejected += 1;
      result.errors.push({ row: rowIndex + 1, error: String(error?.message || 'UNKNOWN_IMPORT_ERROR').slice(0, 160) });
    }
  }
  return result;
}

function cleanRecord(raw: Record<string, any>): QuestionnaireRecord | null {
  const items = raw.items && typeof raw.items === 'object' ? raw.items as QuestionnaireItemScores : null;
  if (!items || !QUESTIONNAIRE_ITEMS.every((item) => Number.isInteger(items[item.id]) && items[item.id] >= 1 && items[item.id] <= 6)) return null;
  const gradeLevel = Number(raw.gradeLevel);
  if (![5, 6].includes(gradeLevel)) return null;
  if (!['pre_app', 'post_exchange'].includes(String(raw.surveyWave))) return null;
  return {
    responseId: String(raw.responseId || ''), researchId: String(raw.researchId || ''), classId: String(raw.classId || ''),
    gradeLevel: gradeLevel as 5 | 6, dataScope: 'main', surveyWave: raw.surveyWave as QuestionnaireWave,
    surveyDate: String(raw.surveyDate || ''), submittedAt: String(raw.submittedAt || ''), instrumentVersion: String(raw.instrumentVersion || ''),
    items, totalSum: Number(raw.totalSum), totalMean: Number(raw.totalMean), persistenceSum: Number(raw.persistenceSum), persistenceMean: Number(raw.persistenceMean),
    selfRegulationSum: Number(raw.selfRegulationSum), selfRegulationMean: Number(raw.selfRegulationMean), l2wtcSum: Number(raw.l2wtcSum), l2wtcMean: Number(raw.l2wtcMean),
    dataQualityFlag: 'complete', importedAt: String(raw.importedAt || ''),
  };
}

export async function getAllQuestionnaireRecords(): Promise<QuestionnaireRecord[]> {
  const rows = await listCollection(QUESTIONNAIRE_COLLECTION, 1000);
  return rows.map(cleanRecord).filter((row): row is QuestionnaireRecord => Boolean(row));
}

function mean(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN; }
function sampleSd(xs: number[]): number {
  if (xs.length < 2) return NaN;
  const m = mean(xs); return Math.sqrt(xs.reduce((sum, x) => sum + (x - m) ** 2, 0) / (xs.length - 1));
}
function median(xs: number[]): number {
  if (!xs.length) return NaN; const a = [...xs].sort((x, y) => x - y); const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}
function quantile(xs: number[], p: number): number {
  if (!xs.length) return NaN; const a = [...xs].sort((x, y) => x - y); const pos = (a.length - 1) * p; const lo = Math.floor(pos); const hi = Math.ceil(pos);
  return lo === hi ? a[lo] : a[lo] + (a[hi] - a[lo]) * (pos - lo);
}
function round6(value: number): number | null { return Number.isFinite(value) ? Number(value.toFixed(6)) : null; }

function logGamma(z: number): number {
  const p = [0.9999999999998099, 676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406, 12.507343278686905, -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1; let x = p[0]; for (let i = 1; i < p.length; i += 1) x += p[i] / (z + i);
  const t = z + p.length - 1.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}
function betaCf(a: number, b: number, x: number): number {
  const maxIter = 200; const eps = 3e-12; const fpmin = 1e-300;
  let qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < fpmin) d = fpmin; d = 1 / d; let h = d;
  for (let m = 1; m <= maxIter; m += 1) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < fpmin) d = fpmin; c = 1 + aa / c; if (Math.abs(c) < fpmin) c = fpmin; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < fpmin) d = fpmin; c = 1 + aa / c; if (Math.abs(c) < fpmin) c = fpmin; d = 1 / d;
    const del = d * c; h *= del; if (Math.abs(del - 1) < eps) break;
  }
  return h;
}
function regularizedBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betaCf(a, b, x) / a : 1 - bt * betaCf(b, a, 1 - x) / b;
}
function studentTCdf(t: number, df: number): number {
  if (!Number.isFinite(t) || df <= 0) return NaN;
  const x = df / (df + t * t); const ib = regularizedBeta(x, df / 2, 0.5);
  return t >= 0 ? 1 - 0.5 * ib : 0.5 * ib;
}
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1; const ax = Math.abs(x); const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return sign * y;
}
function normalCdf(x: number): number { return 0.5 * (1 + erf(x / Math.sqrt(2))); }

export interface PairedTResult { n: number; t: number | null; df: number | null; p: number | null; cohenDz: number | null; }
export function pairedTTest(pre: number[], post: number[]): PairedTResult {
  if (pre.length !== post.length || pre.length < 2) return { n: Math.min(pre.length, post.length), t: null, df: null, p: null, cohenDz: null };
  const diffs = post.map((value, i) => value - pre[i]); const md = mean(diffs); const sd = sampleSd(diffs); const df = diffs.length - 1;
  if (!Number.isFinite(sd) || sd === 0) return { n: diffs.length, t: md === 0 ? 0 : null, df, p: md === 0 ? 1 : null, cohenDz: md === 0 ? 0 : null };
  const t = md / (sd / Math.sqrt(diffs.length)); const p = 2 * (1 - studentTCdf(Math.abs(t), df));
  return { n: diffs.length, t: round6(t), df, p: round6(Math.max(0, Math.min(1, p))), cohenDz: round6(md / sd) };
}

function exactSignedRankP(scaledRanks: number[], observedScaledWPlus: number): number {
  const total = scaledRanks.reduce((a, b) => a + b, 0); let dist = new Float64Array(total + 1); dist[0] = 1;
  let currentMax = 0;
  for (const rank of scaledRanks) {
    const next = new Float64Array(total + 1);
    for (let s = 0; s <= currentMax; s += 1) if (dist[s] > 0) { next[s] += dist[s] * 0.5; next[s + rank] += dist[s] * 0.5; }
    dist = next; currentMax += rank;
  }
  let lower = 0, upper = 0;
  for (let s = 0; s <= total; s += 1) { if (s <= observedScaledWPlus) lower += dist[s]; if (s >= observedScaledWPlus) upper += dist[s]; }
  return Math.min(1, 2 * Math.min(lower, upper));
}

export interface WilcoxonResult { n: number; wPlus: number | null; wMinus: number | null; statistic: number | null; p: number | null; rankBiserial: number | null; method: 'exact' | 'normal' | 'unavailable'; }
export function wilcoxonSignedRank(pre: number[], post: number[]): WilcoxonResult {
  if (pre.length !== post.length) return { n: 0, wPlus: null, wMinus: null, statistic: null, p: null, rankBiserial: null, method: 'unavailable' };
  const diffs = post.map((v, i) => v - pre[i]).filter((d) => Math.abs(d) > 1e-12);
  const n = diffs.length;
  if (n === 0) return { n: 0, wPlus: 0, wMinus: 0, statistic: 0, p: 1, rankBiserial: 0, method: 'exact' };
  const ranked = diffs.map((d, i) => ({ i, d, a: Math.abs(d), rank: 0 })).sort((a, b) => a.a - b.a);
  const tieSizes: number[] = [];
  for (let start = 0; start < ranked.length;) {
    let end = start + 1; while (end < ranked.length && Math.abs(ranked[end].a - ranked[start].a) < 1e-12) end += 1;
    const avgRank = ((start + 1) + end) / 2; for (let j = start; j < end; j += 1) ranked[j].rank = avgRank;
    if (end - start > 1) tieSizes.push(end - start); start = end;
  }
  const wPlus = ranked.filter((r) => r.d > 0).reduce((s, r) => s + r.rank, 0);
  const wMinus = ranked.filter((r) => r.d < 0).reduce((s, r) => s + r.rank, 0);
  const total = wPlus + wMinus; const effect = total ? (wPlus - wMinus) / total : 0;
  let p: number; let method: 'exact' | 'normal';
  if (n <= 30) {
    const scaled = ranked.map((r) => Math.round(r.rank * 2)); p = exactSignedRankP(scaled, Math.round(wPlus * 2)); method = 'exact';
  } else {
    const mu = n * (n + 1) / 4;
    const tieCorrection = tieSizes.reduce((sum, t) => sum + (t ** 3 - t), 0) / 48;
    const variance = n * (n + 1) * (2 * n + 1) / 24 - tieCorrection;
    const z = variance > 0 ? Math.max(0, Math.abs(wPlus - mu) - 0.5) / Math.sqrt(variance) : 0;
    p = 2 * (1 - normalCdf(z)); method = 'normal';
  }
  return { n, wPlus: round6(wPlus), wMinus: round6(wMinus), statistic: round6(Math.min(wPlus, wMinus)), p: round6(Math.max(0, Math.min(1, p))), rankBiserial: round6(effect), method };
}

export function holmAdjust(values: Array<number | null>): Array<number | null> {
  const valid = values.map((p, index) => ({ p, index })).filter((row): row is { p: number; index: number } => typeof row.p === 'number' && Number.isFinite(row.p)).sort((a, b) => a.p - b.p);
  const out: Array<number | null> = values.map(() => null); let running = 0; const m = valid.length;
  valid.forEach((row, i) => { running = Math.max(running, Math.min(1, row.p * (m - i))); out[row.index] = Number(running.toFixed(6)); });
  return out;
}

const METRICS: Array<{ key: QuestionnaireMetricKey; label: string; value: (r: QuestionnaireRecord) => number }> = [
  { key: 'total', label: '主体的に学習に取り組む態度', value: (r) => r.totalMean },
  { key: 'persistence', label: '粘り強さ', value: (r) => r.persistenceMean },
  { key: 'self_regulation', label: '学習の自己調整', value: (r) => r.selfRegulationMean },
  { key: 'l2wtc', label: 'L2 WTC', value: (r) => r.l2wtcMean },
];
const GROUPS = [
  { id: '5-1', label: '5-1', match: (r: QuestionnaireRecord) => r.classId === '5-1', exploratory: true },
  { id: '5-2', label: '5-2', match: (r: QuestionnaireRecord) => r.classId === '5-2', exploratory: true },
  { id: '5-3', label: '5-3', match: (r: QuestionnaireRecord) => r.classId === '5-3', exploratory: true },
  { id: '6-1', label: '6-1', match: (r: QuestionnaireRecord) => r.classId === '6-1', exploratory: true },
  { id: '6-2', label: '6-2', match: (r: QuestionnaireRecord) => r.classId === '6-2', exploratory: true },
  { id: 'grade5', label: '5年', match: (r: QuestionnaireRecord) => r.gradeLevel === 5, exploratory: true },
  { id: 'grade6', label: '6年', match: (r: QuestionnaireRecord) => r.gradeLevel === 6, exploratory: true },
  { id: 'all', label: '全体', match: (_r: QuestionnaireRecord) => true, exploratory: false },
] as const;

export interface QuestionnaireStatsRow {
  groupId: string; groupLabel: string; metric: QuestionnaireMetricKey; metricLabel: string;
  nPre: number; nPost: number; nPair: number;
  preMean: number | null; preSd: number | null; preMedian: number | null; preIqr: number | null;
  postMean: number | null; postSd: number | null; postMedian: number | null; postIqr: number | null; deltaMean: number | null;
  t: number | null; df: number | null; tRawP: number | null; tHolmP: number | null; cohenDz: number | null;
  wilcoxonW: number | null; wilcoxonRawP: number | null; wilcoxonHolmP: number | null; rankBiserial: number | null; wilcoxonMethod: string;
  tSignificant: boolean; wilcoxonSignificant: boolean;
}

function uniqueWaveMap(records: QuestionnaireRecord[], wave: QuestionnaireWave): Map<string, QuestionnaireRecord> {
  const grouped = new Map<string, QuestionnaireRecord[]>();
  for (const r of records.filter((row) => row.surveyWave === wave)) { const list = grouped.get(r.researchId) || []; list.push(r); grouped.set(r.researchId, list); }
  const map = new Map<string, QuestionnaireRecord>(); for (const [rid, list] of grouped) if (list.length === 1) map.set(rid, list[0]);
  return map;
}

function descriptive(values: number[]) {
  return { mean: round6(mean(values)), sd: round6(sampleSd(values)), median: round6(median(values)), iqr: round6(quantile(values, 0.75) - quantile(values, 0.25)) };
}

export function buildQuestionnaireStatistics(records: QuestionnaireRecord[]) {
  const rawRows: QuestionnaireStatsRow[] = [];
  for (const metric of METRICS) {
    for (const group of GROUPS) {
      const subset = records.filter(group.match); const preMap = uniqueWaveMap(subset, 'pre_app'); const postMap = uniqueWaveMap(subset, 'post_exchange');
      const pairIds = [...preMap.keys()].filter((id) => postMap.has(id));
      const pre = pairIds.map((id) => metric.value(preMap.get(id)!)); const post = pairIds.map((id) => metric.value(postMap.get(id)!));
      const dPre = descriptive(pre), dPost = descriptive(post), tt = pairedTTest(pre, post), wx = wilcoxonSignedRank(pre, post);
      rawRows.push({
        groupId: group.id, groupLabel: group.label, metric: metric.key, metricLabel: metric.label,
        nPre: preMap.size, nPost: postMap.size, nPair: pairIds.length,
        preMean: dPre.mean, preSd: dPre.sd, preMedian: dPre.median, preIqr: dPre.iqr,
        postMean: dPost.mean, postSd: dPost.sd, postMedian: dPost.median, postIqr: dPost.iqr,
        deltaMean: pairIds.length ? round6(mean(post.map((v, i) => v - pre[i]))) : null,
        t: tt.t, df: tt.df, tRawP: tt.p, tHolmP: null, cohenDz: tt.cohenDz,
        wilcoxonW: wx.statistic, wilcoxonRawP: wx.p, wilcoxonHolmP: null, rankBiserial: wx.rankBiserial, wilcoxonMethod: wx.method,
        tSignificant: false, wilcoxonSignificant: false,
      });
    }
  }
  const overall = rawRows.filter((row) => row.groupId === 'all');
  const overallT = holmAdjust(overall.map((row) => row.tRawP)); const overallW = holmAdjust(overall.map((row) => row.wilcoxonRawP));
  overall.forEach((row, i) => { row.tHolmP = overallT[i]; row.wilcoxonHolmP = overallW[i]; });
  for (const metric of METRICS) {
    const family = rawRows.filter((row) => row.metric === metric.key && row.groupId !== 'all');
    const t = holmAdjust(family.map((row) => row.tRawP)); const w = holmAdjust(family.map((row) => row.wilcoxonRawP));
    family.forEach((row, i) => { row.tHolmP = t[i]; row.wilcoxonHolmP = w[i]; });
  }
  rawRows.forEach((row) => { row.tSignificant = typeof row.tHolmP === 'number' && row.tHolmP < 0.05; row.wilcoxonSignificant = typeof row.wilcoxonHolmP === 'number' && row.wilcoxonHolmP < 0.05; });
  const duplicateKeys = new Map<string, number>(); records.forEach((r) => { const key = `${r.researchId}|${r.surveyWave}`; duplicateKeys.set(key, (duplicateKeys.get(key) || 0) + 1); });
  const preUnique = uniqueWaveMap(records, 'pre_app'); const postUnique = uniqueWaveMap(records, 'post_exchange');
  return {
    instrumentVersion: QUESTIONNAIRE_INSTRUMENT_VERSION,
    scoring: { minimum: 1, maximum: 6, reverseItems: 0, significantThreshold: 0.05, adjustment: 'Holm' },
    counts: { records: records.length, preUnique: preUnique.size, postUnique: postUnique.size, paired: [...preUnique.keys()].filter((id) => postUnique.has(id)).length, duplicateWaveKeys: [...duplicateKeys.values()].filter((n) => n > 1).length },
    rows: rawRows,
  };
}

export const QUESTIONNAIRE_EXPORT_HEADERS = [
  'research_id','class_id','data_scope','grade_level','survey_wave','survey_date','submitted_at','instrument_version',
  ...QUESTIONNAIRE_ITEMS.map((item) => item.id),
  'total_sum','total_mean','persistence_sum','persistence_mean','self_regulation_sum','self_regulation_mean','l2wtc_sum','l2wtc_mean','data_quality_flag','response_id','imported_at',
] as const;

function classMatches(classId: string, requested: string): boolean { if (!requested || requested === 'all') return true; return ['1','2','3'].includes(requested) ? classId.endsWith(`-${requested}`) : classId === requested; }
export function buildQuestionnaireExportRows(records: QuestionnaireRecord[], query: Record<string, unknown> = {}): Record<string, unknown>[] {
  const grade = String(query.grade || 'all'); const classId = String(query.classId || 'all'); const scope = String(query.dataScope || 'main');
  return records.filter((r) => (scope === 'all' || scope === 'main') && (grade === 'all' || String(r.gradeLevel) === grade) && classMatches(r.classId, classId)).sort((a, b) => a.researchId.localeCompare(b.researchId) || a.surveyWave.localeCompare(b.surveyWave)).map((r) => ({
    research_id:r.researchId,class_id:r.classId,data_scope:r.dataScope,grade_level:r.gradeLevel,survey_wave:r.surveyWave,survey_date:r.surveyDate,submitted_at:r.submittedAt,instrument_version:r.instrumentVersion,
    ...Object.fromEntries(QUESTIONNAIRE_ITEMS.map((item) => [item.id, r.items[item.id]])),
    total_sum:r.totalSum,total_mean:r.totalMean,persistence_sum:r.persistenceSum,persistence_mean:r.persistenceMean,self_regulation_sum:r.selfRegulationSum,self_regulation_mean:r.selfRegulationMean,l2wtc_sum:r.l2wtcSum,l2wtc_mean:r.l2wtcMean,data_quality_flag:r.dataQualityFlag,response_id:r.responseId,imported_at:r.importedAt,
  }));
}
function csvCell(value: unknown): string { const text = String(value ?? '').replace(/\r\n/g,'\n').replace(/\r/g,'\n'); const safe = /^\s*[=+\-@]/.test(text) ? `'${text}` : text; return `"${safe.replace(/"/g,'""')}"`; }
export function serializeQuestionnaireCsv(rows: Record<string, unknown>[]): string { return '\uFEFF' + [QUESTIONNAIRE_EXPORT_HEADERS.map(csvCell).join(','), ...rows.map((row) => QUESTIONNAIRE_EXPORT_HEADERS.map((key) => csvCell(row[key])).join(','))].join('\r\n') + '\r\n'; }

export function buildQuestionnaireCodebookRows(): Record<string, unknown>[] {
  const definitions: Record<string, string> = {
    research_id:'AI対話・授業Reflectionと共通の匿名研究ID',class_id:'匿名化された学級ID',data_scope:'研究データ区分',grade_level:'学年',survey_wave:'質問紙時点',survey_date:'回答日（日本時間）',submitted_at:'Google Forms回答タイムスタンプのUTC正規化値',instrument_version:'質問紙尺度版',
    total_sum:'全15項目合計（15–90）',total_mean:'全15項目平均（1–6）',persistence_sum:'粘り強さ5項目合計（5–30）',persistence_mean:'粘り強さ5項目平均（1–6）',self_regulation_sum:'学習の自己調整5項目合計（5–30）',self_regulation_mean:'学習の自己調整5項目平均（1–6）',l2wtc_sum:'L2 WTC 5項目合計（5–30）',l2wtc_mean:'L2 WTC 5項目平均（1–6）',data_quality_flag:'質問紙回答品質',response_id:'匿名化された回答ID',imported_at:'研究システムへの取込日時',
  };
  for (const item of QUESTIONNAIRE_ITEMS) definitions[item.id] = `${item.sourceId} ${item.text}（1=まったくあてはまらない〜6=よくあてはまる、逆転なし）`;
  return QUESTIONNAIRE_EXPORT_HEADERS.map((variable) => ({ file_name:'student_questionnaires.csv',variable,definition:definitions[variable] || variable.replace(/_/g,' '),data_type:['grade_level',...QUESTIONNAIRE_ITEMS.map(i=>i.id),'total_sum','total_mean','persistence_sum','persistence_mean','self_regulation_sum','self_regulation_mean','l2wtc_sum','l2wtc_mean'].includes(variable as any)?'number':'string',allowed_values:variable==='survey_wave'?'pre_app | post_exchange':QUESTIONNAIRE_ITEMS.some(i=>i.id===variable)?'1 | 2 | 3 | 4 | 5 | 6':variable==='data_scope'?'main':'',analysis_use:'事前・事後質問紙とAI対話・Reflectionをresearch_idで結合し、記述統計・対応検定・効果量を分析' }));
}
