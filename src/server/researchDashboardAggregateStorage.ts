import crypto from 'node:crypto';
import {
  RESEARCH_DASHBOARD_AGGREGATE_VERSION,
  buildResearchDashboardAggregateDocuments,
  type ResearchDashboardAggregateDocument,
  type ResearchDashboardAggregateSession,
  type ResearchDashboardAggregateState,
} from './researchDashboardAggregate';
import { getDocument, listCollection, queryCollectionByStringRange, setDocument, setDocumentsBatch } from './firestore';

const AGGREGATE_COLLECTION = 'research_dashboard_aggregates';
const AGGREGATE_META_COLLECTION = 'research_dashboard_aggregate_meta';
const AGGREGATE_META_ID = 'current';
export const RESEARCH_DASHBOARD_AGGREGATE_SHARD_SIZE = 25;

export type StoredResearchDashboardAggregateDocument = ResearchDashboardAggregateDocument & {
  shardIndex: number;
  shardCount: number;
};

function aggregateBaseId(localDate: string, classId: string): string {
  const encodedClass = Buffer.from(classId || 'unknown', 'utf8').toString('base64url');
  return `${localDate}__${encodedClass}`;
}

export function shardResearchDashboardAggregateDocuments(
  documents: Array<{ id: string; data: ResearchDashboardAggregateDocument }>,
  shardSize = RESEARCH_DASHBOARD_AGGREGATE_SHARD_SIZE,
): Array<{ id: string; data: StoredResearchDashboardAggregateDocument }> {
  const safeSize = Math.max(5, Math.min(50, Math.trunc(shardSize) || RESEARCH_DASHBOARD_AGGREGATE_SHARD_SIZE));
  const out: Array<{ id: string; data: StoredResearchDashboardAggregateDocument }> = [];
  for (const item of documents) {
    const sessions = [...(item.data.sessions || [])].sort((a, b) => String(a.session_id || '').localeCompare(String(b.session_id || '')));
    const shardCount = Math.max(1, Math.ceil(sessions.length / safeSize));
    for (let shardIndex = 0; shardIndex < shardCount; shardIndex += 1) {
      const shardSessions = sessions.slice(shardIndex * safeSize, (shardIndex + 1) * safeSize);
      const id = `${aggregateBaseId(item.data.localDate, item.data.classId)}__s${String(shardIndex).padStart(3, '0')}`;
      out.push({
        id,
        data: {
          ...item.data,
          shardIndex,
          shardCount,
          sessionCount: shardSessions.length,
          sessions: shardSessions,
        },
      });
    }
  }
  return out;
}

function maxSourceUpdatedAt(rawSessions: Record<string, any>[]): string {
  return rawSessions
    .map((row) => String(row.updatedAt || row.endedAt || row.startedAt || ''))
    .filter(Boolean)
    .sort()
    .at(-1) || '';
}

export async function getStoredResearchDashboardAggregateState(): Promise<(ResearchDashboardAggregateState & { sourceWatermark?: string }) | null> {
  const row = await getDocument(AGGREGATE_META_COLLECTION, AGGREGATE_META_ID);
  if (!row || row.schemaVersion !== RESEARCH_DASHBOARD_AGGREGATE_VERSION) return null;
  return row as ResearchDashboardAggregateState & { sourceWatermark?: string };
}

export async function loadStoredResearchDashboardAggregates(start?: unknown, end?: unknown): Promise<{
  available: boolean;
  state: (ResearchDashboardAggregateState & { sourceWatermark?: string }) | null;
  documents: StoredResearchDashboardAggregateDocument[];
}> {
  const state = await getStoredResearchDashboardAggregateState();
  if (!state || state.status !== 'ready' || !state.generationId) return { available: false, state, documents: [] };
  const startText = typeof start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : '';
  const endText = typeof end === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : '';
  const rows = startText || endText
    ? await queryCollectionByStringRange(AGGREGATE_COLLECTION, 'localDate', startText, endText)
    : await listCollection(AGGREGATE_COLLECTION, 500);
  const documents = rows
    .filter((row) => row.schemaVersion === RESEARCH_DASHBOARD_AGGREGATE_VERSION && row.generationId === state.generationId)
    .map((row) => row as StoredResearchDashboardAggregateDocument);
  return { available: true, state, documents };
}

export async function rebuildStoredResearchDashboardAggregates(
  rawSessions: Record<string, any>[],
  options: { dryRun?: boolean; generationId?: string } = {},
) {
  const generationId = options.generationId || `g_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const logicalDocuments = buildResearchDashboardAggregateDocuments(rawSessions, generationId);
  const documents = shardResearchDashboardAggregateDocuments(logicalDocuments);
  const sessionCount = documents.reduce((sum, item) => sum + item.data.sessionCount, 0);
  const result = {
    generationId,
    logicalDocumentCount: logicalDocuments.length,
    documentCount: documents.length,
    sessionCount,
    sourceSessionCount: rawSessions.length,
    sourceWatermark: maxSourceUpdatedAt(rawSessions),
  };
  if (options.dryRun) return { ...result, dryRun: true };

  const now = new Date().toISOString();
  await setDocument(AGGREGATE_META_COLLECTION, AGGREGATE_META_ID, {
    schemaVersion: RESEARCH_DASHBOARD_AGGREGATE_VERSION,
    generationId,
    status: 'building',
    builtAt: '',
    updatedAt: now,
    documentCount: 0,
    sessionCount: 0,
    sourceSessionCount: rawSessions.length,
    sourceWatermark: result.sourceWatermark,
  });
  for (let offset = 0; offset < documents.length; offset += 400) {
    await setDocumentsBatch(
      AGGREGATE_COLLECTION,
      documents.slice(offset, offset + 400).map((item) => ({ id: item.id, data: item.data })),
    );
  }
  const completedAt = new Date().toISOString();
  await setDocument(AGGREGATE_META_COLLECTION, AGGREGATE_META_ID, {
    schemaVersion: RESEARCH_DASHBOARD_AGGREGATE_VERSION,
    generationId,
    status: 'ready',
    builtAt: completedAt,
    updatedAt: completedAt,
    documentCount: documents.length,
    sessionCount,
    sourceSessionCount: rawSessions.length,
    sourceWatermark: result.sourceWatermark,
  });
  return { ...result, dryRun: false };
}

export function flattenStoredResearchDashboardAggregateSessions(
  documents: StoredResearchDashboardAggregateDocument[],
): ResearchDashboardAggregateSession[] {
  const bySession = new Map<string, ResearchDashboardAggregateSession>();
  for (const document of documents) {
    for (const row of Array.isArray(document.sessions) ? document.sessions : []) {
      const id = String(row.session_id || '');
      if (!id) continue;
      bySession.set(id, row);
    }
  }
  return [...bySession.values()];
}
