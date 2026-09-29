import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'shizuoka-english-ai';
const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || '(default)';
const OUTPUT_DIR = process.env.AUDIT_OUTPUT_DIR || 'audit-rq2-rq3-state';

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

const accessToken = token();
const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/${encodeURIComponent(DATABASE_ID)}/documents`;

async function getDocument(collection: string, id: string) {
  const response = await fetch(`${base}/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`FIRESTORE_GET_${response.status}:${(await response.text()).slice(0, 300)}`);
  const doc = await response.json() as any;
  return fromFirestoreFields(doc.fields || {});
}

async function listCollection(collection: string) {
  const rows: Record<string, any>[] = [];
  let pageToken = '';
  do {
    const suffix = pageToken ? `?pageSize=1000&pageToken=${encodeURIComponent(pageToken)}` : '?pageSize=1000';
    const response = await fetch(`${base}/${encodeURIComponent(collection)}${suffix}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error(`FIRESTORE_LIST_${collection}_${response.status}:${(await response.text()).slice(0, 300)}`);
    const data = await response.json() as any;
    for (const doc of data.documents || []) rows.push(fromFirestoreFields(doc.fields || {}));
    pageToken = typeof data.nextPageToken === 'string' ? data.nextPageToken : '';
  } while (pageToken);
  return rows;
}

const codebook = await getDocument('research_rq2_codebooks', 'draft-current');
const rq2Runs = await listCollection('research_rq2_runs');
const rq3Runs = await listCollection('research_rq3_runs');

const summarizeRun = (row: Record<string, any>) => ({
  runId: String(row.runId || ''),
  runType: String(row.runType || ''),
  status: String(row.status || ''),
  codebookVersion: String(row.codebookVersion || ''),
  promptVersion: String(row.promptVersion || ''),
  createdAt: String(row.createdAt || ''),
  itemCount: Number(row.itemCount || 0),
});
const report = {
  generatedAt: new Date().toISOString(),
  readOnly: true,
  codebook: codebook ? {
    schemaVersion: Number(codebook.schemaVersion || 0),
    version: String(codebook.version || ''),
    status: String(codebook.status || ''),
    developmentStatus: String(codebook.developmentStatus || ''),
    revision: Number(codebook.revision || 0),
  } : null,
  rq2Runs: rq2Runs.map(summarizeRun).sort((a,b) => a.createdAt.localeCompare(b.createdAt)),
  rq3Runs: rq3Runs.map(summarizeRun).sort((a,b) => a.createdAt.localeCompare(b.createdAt)),
};
await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(`${OUTPUT_DIR}/rq2-rq3-live-state.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log('writes_performed: 0');
