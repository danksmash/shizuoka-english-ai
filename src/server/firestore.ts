const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'shizuoka-english-ai';
const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || '(default)';

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.value;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {
      headers: { 'Metadata-Flavor': 'Google' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`METADATA_TOKEN_${response.status}`);
    const data = await response.json() as { access_token?: string; expires_in?: number };
    if (!data.access_token) throw new Error('METADATA_TOKEN_MISSING');
    cachedToken = {
      value: data.access_token,
      expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 3000)) * 1000,
    };
    return cachedToken.value;
  } finally {
    clearTimeout(timer);
  }
}

const baseUrl = () => `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/${encodeURIComponent(DATABASE_ID)}/documents`;

function toFirestoreValue(value: unknown): any {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === 'object') {
    const fields: Record<string, any> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (nested !== undefined) fields[key] = toFirestoreValue(nested);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
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

async function firestoreFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    return await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function firestoreAvailable(): Promise<boolean> {
  try {
    const response = await firestoreFetch('/__health_probe__?mask.fieldPaths=missing');
    return response.status === 200 || response.status === 404;
  } catch {
    return false;
  }
}

export async function getDocument(collection: string, id: string): Promise<Record<string, any> | null> {
  const response = await firestoreFetch(`/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`FIRESTORE_GET_${response.status}:${(await response.text()).slice(0, 300)}`);
  const doc = await response.json() as { fields?: Record<string, any>; name?: string };
  return { ...fromFirestoreFields(doc.fields || {}), _name: doc.name };
}

export async function setDocument(collection: string, id: string, data: Record<string, unknown>): Promise<void> {
  const fields = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined).map(([key, value]) => [key, toFirestoreValue(value)]));
  const response = await firestoreFetch(`/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields }),
  });
  if (!response.ok) throw new Error(`FIRESTORE_SET_${response.status}:${(await response.text()).slice(0, 500)}`);
}

export async function queryCollection(collection: string, field: string, value: string, limit = 50): Promise<Record<string, any>[]> {
  const token = await getAccessToken();
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/${encodeURIComponent(DATABASE_ID)}/documents:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collection }],
        where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } },
        limit,
      },
    }),
  });
  if (!response.ok) throw new Error(`FIRESTORE_QUERY_${response.status}:${(await response.text()).slice(0, 500)}`);
  const rows = await response.json() as Array<{ document?: { fields?: Record<string, any>; name?: string } }>;
  return rows.filter((row) => row.document).map((row) => ({ ...fromFirestoreFields(row.document!.fields || {}), _name: row.document!.name }));
}

export async function listCollection(collection: string, pageSize = 200): Promise<Record<string, any>[]> {
  const response = await firestoreFetch(`/${encodeURIComponent(collection)}?pageSize=${Math.max(1, Math.min(1000, pageSize))}`);
  if (!response.ok) throw new Error(`FIRESTORE_LIST_${response.status}:${(await response.text()).slice(0, 500)}`);
  const data = await response.json() as { documents?: Array<{ fields?: Record<string, any>; name?: string }> };
  return (data.documents || []).map((doc) => ({ ...fromFirestoreFields(doc.fields || {}), _name: doc.name }));
}
