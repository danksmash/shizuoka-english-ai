import { assessResearchDuration } from '../src/server/researchDurationQuality';

/** Read-only audit of sessions.csv exported by the researcher dashboard.
 * No learning codes, utterance text, student identifiers, or Firestore writes.
 */
export type SessionCsvRow = Record<string, string>;

export function parseSessionCsv(source: string): SessionCsvRow[] {
  const input = source.replace(/^\uFEFF/, '');
  const cells: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') { cell += '"'; i += 1; }
        else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i += 1;
      row.push(cell); cell = '';
      if (row.some((value) => value !== '')) cells.push(row);
      row = [];
    } else cell += ch;
  }
  if (quoted) throw new Error('UNTERMINATED_CSV_QUOTE');
  if (cell || row.length) {
    row.push(cell);
    if (row.some((value) => value !== '')) cells.push(row);
  }
  const [header, ...data] = cells;
  if (!header?.length) throw new Error('EMPTY_CSV');
  const required = ['session_id','class_id','local_date','actual_duration_seconds','target_duration_minutes','child_total_words','child_turn_count'];
  const missing = required.filter((key) => !header.includes(key));
  if (missing.length) throw new Error('MISSING_CSV_COLUMNS:' + missing.join(','));
  return data.map((values) => Object.fromEntries(header.map((key, index) => [key.trim(), values[index] ?? ''])));
}

type Measures = { sessions: number; durationUsable: number; meanWpm: number | null; pooledWpm: number | null; meanTurnsPerMinute: number | null };
type Counts = { total: number; valid: number; needs_review: number; invalid: number; capped3600: number };
export type DurationAuditResult = {
  source: 'sessions.csv';
  qaVersion: string;
  totalRows: number;
  duplicateSessionIds: number;
  quality: Counts;
  overall: { before: Measures; after: Measures };
  lessonOnly: { before: Measures; after: Measures };
  byClass: Array<{ classId: string; count: number; invalid: number; needsReview: number; beforeMeanWpm: number | null; afterMeanWpm: number | null; beforePooledWpm: number | null; afterPooledWpm: number | null; beforeMeanTurnsPerMinute: number | null; afterMeanTurnsPerMinute: number | null }>;
  byDate: Array<{ date: string; count: number; invalid: number; needsReview: number }>;
  interpretation: string[];
};
type Classified = { row: SessionCsvRow; quality: ReturnType<typeof assessResearchDuration> };
const round = (x: number | null) => x === null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100;
const nonnegative = (v: unknown): number | null => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const zeroCounts = (): Counts => ({total:0,valid:0,needs_review:0,invalid:0,capped3600:0});
function countQuality(rows: Classified[]): Counts {
  const counts = zeroCounts();
  for (const item of rows) {
    counts.total++;
    counts[item.quality.quality]++;
    if (item.quality.reason === 'wall_clock_3600_cap') counts.capped3600++;
  }
  return counts;
}
function measures(rows: Classified[], after: boolean): Measures {
  let sessionWpm = 0, wpmN = 0, turnsRateSum = 0, turnsN = 0, wordsTotal = 0, secondsTotal = 0, eligibleN = 0;
  for (const {row,quality} of rows) {
    const seconds = after ? quality.seconds : nonnegative(row.actual_duration_seconds);
    if (seconds === null || seconds <= 0) continue;
    const childTurns = nonnegative(row.child_turn_count);
    const words = nonnegative(row.child_total_words);
    if (childTurns === null || childTurns <= 0 || words === null) continue;
    sessionWpm += 60 * words / seconds; wpmN++;
    secondsTotal += seconds; wordsTotal += words; eligibleN++;
    const both = nonnegative(row.dialogue_utterance_count);
    const aiTurns = nonnegative(row.ai_turn_count);
    const dialogueTurns = both ?? (aiTurns === null ? null : aiTurns + childTurns);
    if (dialogueTurns !== null) { turnsRateSum += 60 * dialogueTurns / seconds; turnsN++; }
  }
  return {
    sessions: rows.length, durationUsable: eligibleN,
    meanWpm: round(wpmN ? sessionWpm / wpmN : null),
    pooledWpm: round(secondsTotal ? wordsTotal * 60 / secondsTotal : null),
    meanTurnsPerMinute: round(turnsN ? turnsRateSum / turnsN : null),
  };
}
export function auditDurationCsv(csv: string): DurationAuditResult {
  const rows = parseSessionCsv(csv);
  const seen = new Set<string>();
  let duplicateSessionIds = 0;
  const classified: Classified[] = [];
  for (const row of rows) {
    if (seen.has(row.session_id)) duplicateSessionIds++;
    seen.add(row.session_id);
    classified.push({row,quality:assessResearchDuration(row)});
  }
  const classMap = new Map<string, Classified[]>();
  const dateMap = new Map<string, Classified[]>();
  for (const item of classified) {
    const cl = item.row.class_id || 'unknown';
    const date = item.row.local_date || 'unknown';
    classMap.set(cl,[...(classMap.get(cl)||[]),item]);
    dateMap.set(date,[...(dateMap.get(date)||[]),item]);
  }
  const lessons = classified.filter((item) => (item.row.lesson_context_final || item.row.lesson_context_inferred) === 'in_lesson');
  return {
    source: 'sessions.csv',
    qaVersion: 'duration-qa-2026-10-09-v1',
    totalRows: rows.length, duplicateSessionIds,
    quality:countQuality(classified),
    overall:{before:measures(classified,false),after:measures(classified,true)},
    lessonOnly:{before:measures(lessons,false),after:measures(lessons,true)},
    byClass:[...classMap.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([classId,items]) => {
      const c=countQuality(items), before=measures(items,false), after=measures(items,true);
      return {classId,count:items.length,invalid:c.invalid,needsReview:c.needs_review,
        beforeMeanWpm:before.meanWpm,afterMeanWpm:after.meanWpm,
        beforePooledWpm:before.pooledWpm,afterPooledWpm:after.pooledWpm,
        beforeMeanTurnsPerMinute:before.meanTurnsPerMinute,afterMeanTurnsPerMinute:after.meanTurnsPerMinute};
    }),
    byDate:[...dateMap.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([date,items])=>{
      const c=countQuality(items);return {date,count:items.length,invalid:c.invalid,needsReview:c.needs_review};
    }),
    interpretation:[
      'Before/after estimates compare only duration-based metrics; RQ1 Persona choices and RQ2/RQ3 utterances are never discarded.',
      'Lesson-only uses the CSV lesson_context_final column when present, otherwise lesson_context_inferred. It cannot reproduce manual overrides missing from the CSV.',
      'WPM is reported both as the unweighted mean of session rates and as total child words / total eligible seconds.',
      'A 3600-second cap is an invalid denominator, not proof that the actual dialogue lasted 60 minutes.',
    ],
  };
}
