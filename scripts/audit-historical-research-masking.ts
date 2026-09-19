import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'shizuoka-english-ai';
const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || '(default)';
const OUTPUT_DIR = process.env.AUDIT_OUTPUT_DIR || 'audit-output';
const COLLECTION = 'sessions';
const OMITTED = '[name omitted]';

function token(): string {
  const env = String(process.env.GOOGLE_OAUTH_ACCESS_TOKEN || '').trim();
  if (env) return env;
  return execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
}

function fromFirestoreValue(value: any): any {
  if (!value || typeof value !== 'object') return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue?.values || []).map(fromFirestoreValue);
  if ('mapValue' in value) return fromFirestoreFields(value.mapValue?.fields || {});
  return null;
}

function fromFirestoreFields(fields: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, fromFirestoreValue(value)]));
}

async function listSessions(): Promise<Record<string, any>[]> {
  const out: Record<string, any>[] = [];
  let pageToken = '';
  const accessToken = token();
  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/${encodeURIComponent(DATABASE_ID)}/documents/${COLLECTION}`;
  do {
    const url = pageToken ? `${base}?pageSize=1000&pageToken=${encodeURIComponent(pageToken)}` : `${base}?pageSize=1000`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error(`FIRESTORE_LIST_${response.status}:${(await response.text()).slice(0, 500)}`);
    const data = await response.json() as { documents?: any[]; nextPageToken?: string };
    for (const doc of data.documents || []) {
      out.push({ ...fromFirestoreFields(doc.fields || {}), _name: doc.name || '' });
    }
    pageToken = typeof data.nextPageToken === 'string' ? data.nextPageToken : '';
  } while (pageToken);
  return out;
}

type Candidate = {
  session_id: string;
  research_id: string;
  class_id: string;
  local_date: string;
  turn_index: number;
  timestamp: number | string;
  english_text: string;
  japanese_text: string;
  category: 'ai_japanese_only' | 'ai_english_and_japanese' | 'ai_english_only';
  repairability: 'high' | 'manual_review';
};

function containsOmitted(value: unknown): boolean {
  return typeof value === 'string' && value.includes(OMITTED);
}

function safeText(value: unknown, max = 500): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

const sessions = await listSessions();
const candidates: Candidate[] = [];
let childMaskedTurns = 0;
let childJapaneseMaskedOnlyTurns = 0;
let childEnglishMaskedTurns = 0;
let aiTurnsScanned = 0;
let childTurnsScanned = 0;

for (const session of sessions) {
  const history = Array.isArray(session.history) ? session.history : [];
  history.forEach((message: any, index: number) => {
    if (!message || typeof message !== 'object') return;
    const sender = String(message.sender || '');
    const englishHas = containsOmitted(message.englishText);
    const japaneseHas = containsOmitted(message.japaneseText);
    if (sender === 'ai') {
      aiTurnsScanned += 1;
      if (!englishHas && !japaneseHas) return;
      const category: Candidate['category'] = englishHas && japaneseHas
        ? 'ai_english_and_japanese'
        : englishHas ? 'ai_english_only' : 'ai_japanese_only';
      candidates.push({
        session_id: safeText(session.sessionId, 140),
        research_id: safeText(session.researchId, 80),
        class_id: safeText(session.classId, 40),
        local_date: safeText(session.localDate, 20),
        turn_index: index,
        timestamp: typeof message.timestamp === 'number' || typeof message.timestamp === 'string' ? message.timestamp : '',
        english_text: safeText(message.englishText),
        japanese_text: safeText(message.japaneseText),
        category,
        repairability: category === 'ai_japanese_only' && safeText(message.englishText).trim() ? 'high' : 'manual_review',
      });
      return;
    }
    if (sender === 'child') {
      childTurnsScanned += 1;
      if (englishHas || japaneseHas) childMaskedTurns += 1;
      if (!englishHas && japaneseHas) childJapaneseMaskedOnlyTurns += 1;
      if (englishHas) childEnglishMaskedTurns += 1;
    }
  });
}

const affectedSessionIds = new Set(candidates.map((row) => row.session_id));
const highConfidence = candidates.filter((row) => row.repairability === 'high');
const manualReview = candidates.filter((row) => row.repairability === 'manual_review');
const dateValues = sessions.map((s) => safeText(s.localDate, 20)).filter(Boolean).sort();

const report = {
  generated_at: new Date().toISOString(),
  project_id: PROJECT_ID,
  database_id: DATABASE_ID,
  mode: 'READ_ONLY_DRY_RUN',
  writes_performed: 0,
  scope: {
    collection: COLLECTION,
    sessions_scanned: sessions.length,
    ai_turns_scanned: aiTurnsScanned,
    child_turns_scanned: childTurnsScanned,
    earliest_local_date: dateValues[0] || '',
    latest_local_date: dateValues.at(-1) || '',
  },
  findings: {
    affected_sessions: affectedSessionIds.size,
    affected_ai_turns: candidates.length,
    high_confidence_ai_japanese_only: highConfidence.length,
    manual_review_ai_turns: manualReview.length,
    child_masked_turns_observed_not_modified: childMaskedTurns,
    child_japanese_only_masked_turns_observed_not_modified: childJapaneseMaskedOnlyTurns,
    child_english_masked_turns_observed_not_modified: childEnglishMaskedTurns,
  },
  safety: {
    firestore_write_methods_called: false,
    child_turns_modified: false,
    candidate_rule: 'sender=ai AND englishText/japaneseText contains [name omitted]',
    recommended_auto_repair_rule: 'sender=ai AND japaneseText contains [name omitted] AND englishText is non-empty and does not contain [name omitted]',
    recommended_backup_before_write: true,
    recommended_rollback_key: 'session_id',
  },
  high_confidence_candidates: highConfidence,
  manual_review_candidates: manualReview,
};

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(`${OUTPUT_DIR}/historical-mask-dry-run.json`, JSON.stringify(report, null, 2), 'utf8');
await writeFile(
  `${OUTPUT_DIR}/historical-mask-summary.txt`,
  [
    'Historical research masking audit (READ ONLY)',
    `Generated: ${report.generated_at}`,
    `Sessions scanned: ${sessions.length}`,
    `AI turns scanned: ${aiTurnsScanned}`,
    `Affected sessions: ${affectedSessionIds.size}`,
    `Affected AI turns: ${candidates.length}`,
    `High-confidence Japanese-only repair candidates: ${highConfidence.length}`,
    `Manual-review AI turns: ${manualReview.length}`,
    `Child masked turns observed (not modified): ${childMaskedTurns}`,
    'Writes performed: 0',
  ].join('\n') + '\n',
  'utf8',
);

console.log(JSON.stringify(report.findings, null, 2));
console.log('READ_ONLY_DRY_RUN_COMPLETE');
