import crypto from 'node:crypto';
import { listCollection, setDocument, setDocumentsBatch } from './firestore';

export const RQ3_RUN_COLLECTION = 'research_rq3_runs';
export const RQ3_ITEM_COLLECTION = 'research_rq3_items';

function safeKey(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 28);
}

async function writeBatches(collection: string, rows: Array<{ id: string; data: Record<string, unknown> }>) {
  for (let index = 0; index < rows.length; index += 400) {
    await setDocumentsBatch(collection, rows.slice(index, index + 400));
  }
}

export async function createRq3Run(args: {
  items: Record<string, any>[];
  codebookVersion: string;
  createdBy: string;
}) {
  const runId = `rq3_${Date.now()}_${safeKey(args.codebookVersion).slice(0, 8)}`;
  const now = new Date().toISOString();
  const run = {
    runId,
    createdAt: now,
    createdBy: String(args.createdBy || 'researcher').slice(0, 100),
    codebookVersion: args.codebookVersion,
    promptVersion: 'rq2-coding-prompt-v3',
    itemCount: args.items.length,
    status: 'active',
  };
  await setDocument(RQ3_RUN_COLLECTION, runId, run);
  await writeBatches(RQ3_ITEM_COLLECTION, args.items.map((item) => {
    const itemId = `${runId}_${safeKey(String(item.sequenceId || ''))}`;
    return {
      id: itemId,
      data: {
        ...item,
        itemId,
        runId,
        createdAt: now,
        aiStatus: 'pending',
        humanStatus: 'pending',
      },
    };
  }));
  return run;
}

export async function getRq3Runs() {
  const rows = await listCollection(RQ3_RUN_COLLECTION, 1000);
  return rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export async function findActiveRq3Run() {
  return (await getRq3Runs()).find((row) => String(row.status || '') === 'active') || null;
}

export async function getRq3Run(runId: string) {
  return (await getRq3Runs()).find((row) => String(row.runId || '') === runId) || null;
}

export async function invalidateRq3Run(runId: string, invalidatedBy: string, reason: string) {
  const run = await getRq3Run(runId);
  if (!run) throw new Error('RQ3_RUN_NOT_FOUND');
  if (String(run.status || '') === 'invalidated') return run;
  const next = {
    ...run,
    status: 'invalidated',
    invalidatedAt: new Date().toISOString(),
    invalidatedBy: String(invalidatedBy || 'researcher').slice(0, 100),
    invalidationReason: String(reason || 'manual_reset').slice(0, 300),
  };
  delete (next as Record<string, any>)._name;
  await setDocument(RQ3_RUN_COLLECTION, runId, next);
  return next;
}

export async function getRq3Items(runId: string) {
  const rows = await listCollection(RQ3_ITEM_COLLECTION, 1000);
  return rows
    .filter((row) => String(row.runId || '') === runId)
    .sort((a, b) => String(a.schoolCondition || '').localeCompare(String(b.schoolCondition || ''))
      || String(a.analysisPeriod || '').localeCompare(String(b.analysisPeriod || ''))
      || String(a.researchId || '').localeCompare(String(b.researchId || ''))
      || Number(a.childTurnSequence || 0) - Number(b.childTurnSequence || 0));
}

export async function patchRq3Items(updates: Array<{ current: Record<string, any>; patch: Record<string, any> }>) {
  if (!updates.length) return [];
  const now = new Date().toISOString();
  const docs = updates.map(({ current, patch }) => {
    const itemId = String(current.itemId || '');
    const runId = String(current.runId || '');
    if (!itemId || !runId) throw new Error('RQ3_ITEM_ID_REQUIRED');
    const next = { ...current, ...patch, itemId, runId, updatedAt: now };
    delete (next as Record<string, any>)._name;
    return { id: itemId, data: next };
  });
  await writeBatches(RQ3_ITEM_COLLECTION, docs);
  return docs.map((row) => row.data);
}

export async function updateRq3Item(runId: string, sequenceId: string, patch: Record<string, any>) {
  const current = (await getRq3Items(runId)).find((row) => String(row.sequenceId || '') === sequenceId);
  if (!current) throw new Error('RQ3_ITEM_NOT_FOUND');
  const itemId = String(current.itemId || '');
  const next = { ...current, ...patch, itemId, runId, updatedAt: new Date().toISOString() };
  delete (next as Record<string, any>)._name;
  await setDocument(RQ3_ITEM_COLLECTION, itemId, next);
  return next;
}

export function summarizeRq3Progress(items: Record<string, any>[]) {
  return {
    total: items.length,
    aiCoded: items.filter((item) => item.aiStatus === 'coded').length,
    needsReview: items.filter((item) => item.aiNeedsReview === true).length,
    humanConfirmed: items.filter((item) => item.humanStatus === 'confirmed' || item.humanStatus === 'modified').length,
    pendingHuman: items.filter((item) => item.humanStatus !== 'confirmed' && item.humanStatus !== 'modified').length,
  };
}
