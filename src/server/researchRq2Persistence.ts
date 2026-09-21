import crypto from 'node:crypto';
import { getDocument, queryCollection, setDocument } from './firestore';
import type { Rq2SampledItem, Rq2Purpose } from './researchRq2Sampling';

export const RQ2_RUN_COLLECTION = 'research_rq2_runs';
export const RQ2_ITEM_COLLECTION = 'research_rq2_items';
export const RQ2_RELIABILITY_COLLECTION = 'research_rq2_reliability';

function safeKey(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 28);
}

export async function createRq2Run(args: {
  seed: string;
  targetPerStratum: number;
  maxPerParticipantPerStratum: number;
  lessonOnly: boolean;
  codebookVersion: string;
  counts: Record<string, any>;
  items: Rq2SampledItem[];
  createdBy: string;
}) {
  const runId = `rq2_${Date.now()}_${safeKey(args.seed).slice(0, 8)}`;
  const now = new Date().toISOString();
  const run = {
    runId,
    createdAt: now,
    createdBy: args.createdBy,
    seed: args.seed,
    targetPerStratum: args.targetPerStratum,
    maxPerParticipantPerStratum: args.maxPerParticipantPerStratum,
    lessonOnly: args.lessonOnly,
    codebookVersion: args.codebookVersion,
    promptVersion: 'rq2-coding-prompt-v1',
    counts: args.counts,
    itemCount: args.items.length,
    status: 'sampled',
  };
  await setDocument(RQ2_RUN_COLLECTION, runId, run);
  for (const item of args.items) {
    const itemId = `${runId}_${safeKey(item.sequenceId)}`;
    await setDocument(RQ2_ITEM_COLLECTION, itemId, {
      ...item,
      itemId,
      runId,
      sampledAt: now,
      aiStatus: 'pending',
      humanStatus: 'pending',
    });
  }
  return run;
}

export async function getRq2Run(runId: string) {
  return getDocument(RQ2_RUN_COLLECTION, runId);
}

export async function getRq2Items(runId: string): Promise<Record<string, any>[]> {
  const rows = await queryCollection(RQ2_ITEM_COLLECTION, 'runId', runId, 1000);
  return rows.sort((a, b) => String(a.stratum || '').localeCompare(String(b.stratum || '')) || Number(a.stratumRank || 0) - Number(b.stratumRank || 0));
}

export async function updateRq2Item(runId: string, sequenceId: string, patch: Record<string, any>) {
  const rows = await getRq2Items(runId);
  const current = rows.find((row) => String(row.sequenceId || '') === sequenceId);
  if (!current) throw new Error('RQ2_ITEM_NOT_FOUND');
  const itemId = String(current.itemId || '');
  const next = { ...current, ...patch, itemId, runId, updatedAt: new Date().toISOString() };
  delete next._name;
  await setDocument(RQ2_ITEM_COLLECTION, itemId, next);
  return next;
}

export async function saveRq2ReliabilityCode(args: {
  runId: string;
  sequenceId: string;
  coderKey: string;
  referenceCodes: string[];
  functionCodes: string[];
  recipientLocus: string[];
}) {
  const coderKey = String(args.coderKey || '').trim().slice(0, 80);
  if (!coderKey) throw new Error('RQ2_CODER_KEY_REQUIRED');
  const id = `${args.runId}_${safeKey(args.sequenceId)}_${safeKey(coderKey)}`;
  const record = {
    ...args,
    coderKey,
    savedAt: new Date().toISOString(),
  };
  await setDocument(RQ2_RELIABILITY_COLLECTION, id, record);
  return record;
}

export async function getRq2ReliabilityCodes(runId: string) {
  return queryCollection(RQ2_RELIABILITY_COLLECTION, 'runId', runId, 1000);
}

export function filterRq2Items(rows: Record<string, any>[], purpose?: Rq2Purpose | '', reviewOnly = false) {
  return rows.filter((row) => (!purpose || row.purpose === purpose) && (!reviewOnly || row.aiNeedsReview === true));
}
