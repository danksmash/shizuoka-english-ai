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

export type ResearchSessionPage = {
  rows: Record<string, any>[];
  nextPageToken: string;
};

export async function readResearchSessionPage(
  pageToken = '',
  pageSize = 200,
  fieldPaths: string[] = [],
): Promise<ResearchSessionPage> {
  const token = await getAccessToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const params = new URLSearchParams();
    params.set('pageSize', String(Math.max(1, Math.min(500, Math.trunc(pageSize) || 200))));
    if (pageToken) params.set('pageToken', pageToken);
    for (const fieldPath of fieldPaths) {
      const field = String(fieldPath || '').trim();
      if (field) params.append('mask.fieldPaths', field);
    }
    const response = await fetch(`${baseUrl()}/sessions?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`FIRESTORE_RESEARCH_PAGE_${response.status}:${(await response.text()).slice(0, 500)}`);
    const data = await response.json() as {
      documents?: Array<{ fields?: Record<string, any>; name?: string }>;
      nextPageToken?: string;
    };
    return {
      rows: (data.documents || []).map((doc) => ({ ...fromFirestoreFields(doc.fields || {}), _name: doc.name })),
      nextPageToken: typeof data.nextPageToken === 'string' ? data.nextPageToken : '',
    };
  } finally {
    clearTimeout(timer);
  }
}
