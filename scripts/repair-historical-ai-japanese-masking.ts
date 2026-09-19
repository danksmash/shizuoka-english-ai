import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'shizuoka-english-ai';
const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || '(default)';
const SESSION_COLLECTION = 'sessions';
const BACKUP_COLLECTION = 'session_repair_backups';
const BATCH_ID = 'maskfix-20260919-ai-ja-v1';
const OUTPUT_DIR = process.env.REPAIR_OUTPUT_DIR || 'repair-output';
const OMITTED = '[name omitted]';

type RepairItem = {
  sessionId: string;
  turnIndex: number;
  expectedEnglish: string;
  expectedJapanese: string;
  replacementJapanese: string;
};

type FirestoreDoc = {
  id: string;
  updateTime: string;
  fields: Record<string, any>;
  data: Record<string, any>;
};

function accessToken(): string {
  const env = String(process.env.GOOGLE_OAUTH_ACCESS_TOKEN || '').trim();
  if (env) return env;
  return execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
}

const TOKEN = accessToken();
const baseUrl = () =>
  `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/${encodeURIComponent(DATABASE_ID)}/documents`;

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

function toFirestoreValue(value: unknown): any {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (typeof value === 'object') {
    const fields: Record<string, any> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (nested !== undefined) fields[key] = toFirestoreValue(nested);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

async function firestoreFetch(path: string, init: RequestInit = {}) {
  return fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

async function getDocument(collection: string, id: string): Promise<FirestoreDoc> {
  const response = await firestoreFetch(`/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error(`GET_${collection}_${id}_${response.status}:${(await response.text()).slice(0, 400)}`);
  const raw = await response.json() as { name?: string; fields?: Record<string, any>; updateTime?: string };
  return {
    id,
    updateTime: String(raw.updateTime || ''),
    fields: raw.fields || {},
    data: fromFirestoreFields(raw.fields || {}),
  };
}

async function backupExists(id: string): Promise<boolean> {
  const response = await firestoreFetch(`/${BACKUP_COLLECTION}/${encodeURIComponent(id)}`);
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`BACKUP_CHECK_${response.status}:${(await response.text()).slice(0, 400)}`);
  const raw = await response.json() as { fields?: Record<string, any> };
  const data = fromFirestoreFields(raw.fields || {});
  if (data.batchId !== BATCH_ID) throw new Error(`BACKUP_BATCH_MISMATCH:${id}`);
  return true;
}

async function createBackup(session: FirestoreDoc): Promise<void> {
  const backupId = `${BATCH_ID}__${session.id}`;
  if (await backupExists(backupId)) return;
  const history = Array.isArray(session.data.history) ? session.data.history : [];
  const body = {
    fields: {
      batchId: toFirestoreValue(BATCH_ID),
      sourceSessionId: toFirestoreValue(session.id),
      sourceUpdateTime: toFirestoreValue(session.updateTime),
      createdAt: toFirestoreValue(new Date().toISOString()),
      history: toFirestoreValue(history),
    },
  };
  const response = await firestoreFetch(
    `/${BACKUP_COLLECTION}?documentId=${encodeURIComponent(backupId)}`,
    { method: 'POST', body: JSON.stringify(body) },
  );
  if (response.status === 409 && await backupExists(backupId)) return;
  if (!response.ok) throw new Error(`BACKUP_CREATE_${session.id}_${response.status}:${(await response.text()).slice(0, 500)}`);
}

async function patchHistory(sessionId: string, history: any[], expectedUpdateTime: string): Promise<string> {
  const path =
    `/${SESSION_COLLECTION}/${encodeURIComponent(sessionId)}`
    + `?updateMask.fieldPaths=history&currentDocument.updateTime=${encodeURIComponent(expectedUpdateTime)}`;
  const response = await firestoreFetch(path, {
    method: 'PATCH',
    body: JSON.stringify({ fields: { history: toFirestoreValue(history) } }),
  });
  if (!response.ok) throw new Error(`PATCH_${sessionId}_${response.status}:${(await response.text()).slice(0, 500)}`);
  const raw = await response.json() as { updateTime?: string };
  return String(raw.updateTime || '');
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function validateManifest(items: RepairItem[]) {
  if (items.length !== 37) throw new Error(`UNEXPECTED_MANIFEST_LENGTH:${items.length}`);
  for (const item of items) {
    if (!/^session_[A-Za-z0-9]+$/.test(item.sessionId)) throw new Error(`INVALID_SESSION_ID:${item.sessionId}`);
    if (!Number.isInteger(item.turnIndex) || item.turnIndex < 0) throw new Error(`INVALID_TURN_INDEX:${item.sessionId}`);
    if (!item.expectedJapanese.includes(OMITTED)) throw new Error(`EXPECTED_MASK_MISSING:${item.sessionId}:${item.turnIndex}`);
    if (item.expectedEnglish.includes(OMITTED)) throw new Error(`EXPECTED_ENGLISH_NOT_CLEAN:${item.sessionId}:${item.turnIndex}`);
    if (!item.replacementJapanese.trim() || item.replacementJapanese.includes(OMITTED)) throw new Error(`INVALID_REPLACEMENT:${item.sessionId}:${item.turnIndex}`);
  }
}

const manifest = JSON.parse(
  await readFile(new URL('./historical-ai-japanese-repair-manifest.json', import.meta.url), 'utf8'),
) as RepairItem[];
validateManifest(manifest);

const grouped = new Map<string, RepairItem[]>();
for (const item of manifest) {
  const list = grouped.get(item.sessionId) || [];
  list.push(item);
  grouped.set(item.sessionId, list);
}

const prepared = new Map<string, {
  original: FirestoreDoc;
  originalHistory: any[];
  repairedHistory: any[];
}>();

// Phase 1: strict preflight. No writes of any kind occur before every target matches.
for (const [sessionId, items] of grouped.entries()) {
  const session = await getDocument(SESSION_COLLECTION, sessionId);
  const originalHistory = Array.isArray(session.data.history) ? session.data.history : [];
  if (!originalHistory.length) throw new Error(`HISTORY_MISSING:${sessionId}`);
  const repairedHistory = structuredClone(originalHistory);

  for (const item of items) {
    const message = repairedHistory[item.turnIndex];
    if (!message || message.sender !== 'ai') throw new Error(`TARGET_NOT_AI:${sessionId}:${item.turnIndex}`);
    if (String(message.englishText || '') !== item.expectedEnglish) throw new Error(`ENGLISH_PRECONDITION_FAILED:${sessionId}:${item.turnIndex}`);
    if (String(message.japaneseText || '') !== item.expectedJapanese) throw new Error(`JAPANESE_PRECONDITION_FAILED:${sessionId}:${item.turnIndex}`);
    message.japaneseText = item.replacementJapanese;
  }

  // Child turns and every field except targeted AI japaneseText must remain untouched.
  originalHistory.forEach((before: any, index: number) => {
    const after = repairedHistory[index];
    const target = items.find((item) => item.turnIndex === index);
    if (!target && !deepEqual(before, after)) throw new Error(`NON_TARGET_CHANGED:${sessionId}:${index}`);
    if (before?.sender === 'child' && !deepEqual(before, after)) throw new Error(`CHILD_CHANGED:${sessionId}:${index}`);
    if (target) {
      const beforeCopy = { ...before, japaneseText: target.replacementJapanese };
      if (!deepEqual(beforeCopy, after)) throw new Error(`TARGET_FIELD_SCOPE_INVALID:${sessionId}:${index}`);
    }
  });

  prepared.set(sessionId, { original: session, originalHistory, repairedHistory });
}

const modified: string[] = [];
let rollbackPerformed = false;

try {
  // Phase 2: create all private Firestore backups before the first session write.
  for (const entry of prepared.values()) await createBackup(entry.original);

  // Phase 3: update only the history field, guarded by Firestore updateTime preconditions.
  for (const [sessionId, entry] of prepared.entries()) {
    await patchHistory(sessionId, entry.repairedHistory, entry.original.updateTime);
    modified.push(sessionId);
  }

  // Phase 4: re-read and verify exact intended result.
  for (const [sessionId, entry] of prepared.entries()) {
    const current = await getDocument(SESSION_COLLECTION, sessionId);
    const currentHistory = Array.isArray(current.data.history) ? current.data.history : [];
    if (!deepEqual(currentHistory, entry.repairedHistory)) throw new Error(`POST_VERIFY_FAILED:${sessionId}`);
  }
} catch (error) {
  if (modified.length) {
    rollbackPerformed = true;
    for (const sessionId of [...modified].reverse()) {
      const entry = prepared.get(sessionId);
      if (!entry) continue;
      try {
        const current = await getDocument(SESSION_COLLECTION, sessionId);
        await patchHistory(sessionId, entry.originalHistory, current.updateTime);
      } catch (rollbackError) {
        console.error('ROLLBACK_FAILED', sessionId, rollbackError);
      }
    }
  }
  throw error;
}

const report = {
  generated_at: new Date().toISOString(),
  batch_id: BATCH_ID,
  project_id: PROJECT_ID,
  database_id: DATABASE_ID,
  status: 'SUCCESS',
  manifest_turns: manifest.length,
  affected_sessions: grouped.size,
  repaired_turns: manifest.length,
  repaired_sessions: modified.length,
  child_turns_modified: 0,
  english_text_modified: 0,
  fields_patched_on_session_documents: ['history'],
  backup_collection: BACKUP_COLLECTION,
  backups_created_or_reused: prepared.size,
  rollback_performed: rollbackPerformed,
  manual_review_ai_turns_left_untouched: 30,
};

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(`${OUTPUT_DIR}/historical-ai-japanese-repair-summary.json`, JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report, null, 2));
console.log('HISTORICAL_AI_JAPANESE_REPAIR_COMPLETE');
