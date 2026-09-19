import { execFileSync } from 'node:child_process';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'shizuoka-english-ai';
const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || '(default)';
const COLLECTION = 'sessions';
const MARKER = '[name omitted]';

function accessToken() {
  const token = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
  if (!token) throw new Error('GOOGLE_ACCESS_TOKEN_MISSING');
  return token;
}

function fromFirestoreValue(value) {
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

function fromFirestoreFields(fields) {
  return Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, fromFirestoreValue(value)]));
}

async function listAllSessions() {
  const token = accessToken();
  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/${encodeURIComponent(DATABASE_ID)}/documents/${COLLECTION}`;
  const rows = [];
  let pageToken = '';
  do {
    const url = new URL(base);
    url.searchParams.set('pageSize', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`FIRESTORE_LIST_${response.status}:${(await response.text()).slice(0, 300)}`);
    const data = await response.json();
    rows.push(...(data.documents || []).map((doc) => ({ ...fromFirestoreFields(doc.fields || {}), _name: doc.name || '' })));
    pageToken = typeof data.nextPageToken === 'string' ? data.nextPageToken : '';
  } while (pageToken);
  return rows;
}

function hasMarker(value) {
  return typeof value === 'string' && value.includes(MARKER);
}

function markerCount(value) {
  return typeof value === 'string' ? value.split(MARKER).length - 1 : 0;
}

const sessions = await listAllSessions();
const anySessions = new Set();
const aiSessions = new Set();
const aiJapaneseOnlySessions = new Set();
const childSessions = new Set();

let totalTurns = 0;
let aiTurns = 0;
let childTurns = 0;
let turnsWithMarker = 0;
let aiTurnsWithMarker = 0;
let aiEnglishMarkerTurns = 0;
let aiJapaneseMarkerTurns = 0;
let aiJapaneseOnlyCandidateTurns = 0;
let aiJapaneseOnlySingleMarkerTurns = 0;
let aiJapaneseOnlyMissingEnglishTurns = 0;
let childTurnsWithMarker = 0;
let otherSenderTurnsWithMarker = 0;
let earliestAffectedDate = '';
let latestAffectedDate = '';

for (const session of sessions) {
  const history = Array.isArray(session.history) ? session.history : [];
  const sessionId = String(session.sessionId || session._name || '');
  const localDate = typeof session.localDate === 'string' ? session.localDate : '';

  for (const message of history) {
    if (!message || typeof message !== 'object') continue;
    totalTurns += 1;
    const sender = String(message.sender || '');
    const english = typeof message.englishText === 'string' ? message.englishText : '';
    const japanese = typeof message.japaneseText === 'string' ? message.japaneseText : '';
    const englishMasked = hasMarker(english);
    const japaneseMasked = hasMarker(japanese);
    const affected = englishMasked || japaneseMasked;

    if (sender === 'ai') aiTurns += 1;
    if (sender === 'child') childTurns += 1;
    if (!affected) continue;

    turnsWithMarker += 1;
    anySessions.add(sessionId);
    if (localDate) {
      if (!earliestAffectedDate || localDate < earliestAffectedDate) earliestAffectedDate = localDate;
      if (!latestAffectedDate || localDate > latestAffectedDate) latestAffectedDate = localDate;
    }

    if (sender === 'ai') {
      aiTurnsWithMarker += 1;
      aiSessions.add(sessionId);
      if (englishMasked) aiEnglishMarkerTurns += 1;
      if (japaneseMasked) aiJapaneseMarkerTurns += 1;
      if (japaneseMasked && !englishMasked) {
        aiJapaneseOnlyCandidateTurns += 1;
        aiJapaneseOnlySessions.add(sessionId);
        if (english.trim()) {
          if (markerCount(japanese) === 1) aiJapaneseOnlySingleMarkerTurns += 1;
        } else {
          aiJapaneseOnlyMissingEnglishTurns += 1;
        }
      }
    } else if (sender === 'child') {
      childTurnsWithMarker += 1;
      childSessions.add(sessionId);
    } else {
      otherSenderTurnsWithMarker += 1;
    }
  }
}

const report = {
  mode: 'dry-run-read-only',
  projectId: PROJECT_ID,
  databaseId: DATABASE_ID,
  totalSessionsScanned: sessions.length,
  totalTurnsScanned: totalTurns,
  aiTurnsScanned: aiTurns,
  childTurnsScanned: childTurns,
  sessionsWithAnyNameOmitted: anySessions.size,
  turnsWithAnyNameOmitted: turnsWithMarker,
  aiSessionsWithNameOmitted: aiSessions.size,
  aiTurnsWithNameOmitted: aiTurnsWithMarker,
  aiEnglishMarkerTurns,
  aiJapaneseMarkerTurns,
  aiJapaneseOnlyCandidateSessions: aiJapaneseOnlySessions.size,
  aiJapaneseOnlyCandidateTurns,
  aiJapaneseOnlySingleMarkerTurns,
  aiJapaneseOnlyMissingEnglishTurns,
  childSessionsWithNameOmitted: childSessions.size,
  childTurnsWithNameOmitted,
  otherSenderTurnsWithNameOmitted,
  earliestAffectedDate,
  latestAffectedDate,
  mutationPerformed: false,
};

console.log('RESEARCH_MASK_AUDIT ' + JSON.stringify(report));
