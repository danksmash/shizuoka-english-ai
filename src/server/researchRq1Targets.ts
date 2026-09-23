import crypto from 'node:crypto';
import { AI_STUDENTS_MASTER_LIST, TARGET_20_AI_STUDENT_IDS } from '../data/curriculum';
import { getDocument, listCollection, setDocument } from './firestore';
import { getStudentRecordsForManagement } from './persistence';
import {
  RQ1_COMPARISON_ALLOCATION_ALGORITHM_VERSION,
  RQ1_COMPARISON_ALLOCATION_METHOD,
  buildRq1AllocationInputHash,
  buildRq1ComparisonAllocationPlan,
  type Rq1ComparisonAllocationGradeSummary,
} from './researchRq1Allocation';

export const RQ1_TARGET_COLLECTION = 'research_rq1_target_mappings';
export const RQ1_TARGET_CONFIG_COLLECTION = 'research_rq1_target_config';
export const RQ1_TARGET_CONFIG_ID = 'default';
export const RQ1_TARGET_SCHEMA_VERSION = 'rq1-target-2026-v2';

export type Rq1TargetTableStatus = 'draft' | 'frozen';
export type Rq1TargetSource = 'intervention_assignment_snapshot' | 'comparison_matched_manual' | 'comparison_distribution_randomized';

export const RQ1_COUNTRY_OPTIONS = TARGET_20_AI_STUDENT_IDS.map((id) => {
  const persona = AI_STUDENTS_MASTER_LIST.find((item) => item.id === id);
  if (!persona) throw new Error(`RQ1_PERSONA_MISSING:${id}`);
  return { value: persona.country, label: `${persona.country}（${persona.countryJapanese}）` };
}).filter((item, index, list) => list.findIndex((candidate) => candidate.value === item.value) === index);

export interface Rq1TargetMapping {
  schemaVersion: string;
  researchId: string;
  siteId: string;
  schoolCondition: 'intervention' | 'comparison';
  classId: string;
  gradeLevel: 5 | 6 | '';
  targetCountry: string;
  source: Rq1TargetSource;
  note: string;
  revision: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  history: Array<Record<string, unknown>>;
}

export interface Rq1TargetConfig {
  schemaVersion: string;
  status: Rq1TargetTableStatus;
  revision: number;
  frozenAt: string;
  frozenBy: string;
  snapshotHash: string;
  participantCount: number;
  allocationMethod: string;
  allocationAlgorithmVersion: string;
  allocationSeed: string;
  allocationGeneratedAt: string;
  allocationGeneratedBy: string;
  allocationInputHash: string;
  allocationCompletedAt: string;
  allocationGradeSummaries: Rq1ComparisonAllocationGradeSummary[];
  updatedAt: string;
  updatedBy: string;
  history: Array<Record<string, unknown>>;
}

function safeDocId(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 180);
}

function normalizeCountryKey(value: unknown): string {
  const raw = String(value || '').trim().toLowerCase().replace(/[._-]/g, ' ').replace(/\s+/g, ' ');
  const aliases: Record<string, string> = {
    usa: 'united states',
    'u s a': 'united states',
    'united states of america': 'united states',
    uk: 'united kingdom',
    'u k': 'united kingdom',
    'great britain': 'united kingdom',
    korea: 'south korea',
    'republic of korea': 'south korea',
  };
  return aliases[raw] || raw;
}

export function canonicalRq1Country(value: unknown): string {
  const key = normalizeCountryKey(value);
  if (!key) return '';
  const option = RQ1_COUNTRY_OPTIONS.find((row) => normalizeCountryKey(row.value) === key);
  return option?.value || '';
}

function defaultConfig(): Rq1TargetConfig {
  return {
    schemaVersion: RQ1_TARGET_SCHEMA_VERSION,
    status: 'draft',
    revision: 0,
    frozenAt: '',
    frozenBy: '',
    snapshotHash: '',
    participantCount: 0,
    allocationMethod: '',
    allocationAlgorithmVersion: '',
    allocationSeed: '',
    allocationGeneratedAt: '',
    allocationGeneratedBy: '',
    allocationInputHash: '',
    allocationCompletedAt: '',
    allocationGradeSummaries: [],
    updatedAt: '',
    updatedBy: '',
    history: [],
  };
}

function cleanConfig(row: Record<string, any> | null): Rq1TargetConfig {
  if (!row) return defaultConfig();
  const status: Rq1TargetTableStatus = row.status === 'frozen' ? 'frozen' : 'draft';
  return {
    schemaVersion: String(row.schemaVersion || RQ1_TARGET_SCHEMA_VERSION),
    status,
    revision: Number.isInteger(Number(row.revision)) ? Number(row.revision) : 0,
    frozenAt: String(row.frozenAt || ''),
    frozenBy: String(row.frozenBy || ''),
    snapshotHash: String(row.snapshotHash || ''),
    participantCount: Number(row.participantCount || 0),
    allocationMethod: String(row.allocationMethod || ''),
    allocationAlgorithmVersion: String(row.allocationAlgorithmVersion || ''),
    allocationSeed: String(row.allocationSeed || ''),
    allocationGeneratedAt: String(row.allocationGeneratedAt || ''),
    allocationGeneratedBy: String(row.allocationGeneratedBy || ''),
    allocationInputHash: String(row.allocationInputHash || ''),
    allocationCompletedAt: String(row.allocationCompletedAt || ''),
    allocationGradeSummaries: Array.isArray(row.allocationGradeSummaries) ? row.allocationGradeSummaries : [],
    updatedAt: String(row.updatedAt || ''),
    updatedBy: String(row.updatedBy || ''),
    history: Array.isArray(row.history) ? row.history.slice(-100) : [],
  };
}

function cleanMapping(row: Record<string, any>): Rq1TargetMapping | null {
  const researchId = String(row.researchId || '').trim().toUpperCase();
  const condition = row.schoolCondition === 'comparison' ? 'comparison' : row.schoolCondition === 'intervention' ? 'intervention' : '';
  const targetCountry = canonicalRq1Country(row.targetCountry);
  if (!researchId || !condition || !targetCountry) return null;
  const rawSource = String(row.source || '');
  const source: Rq1TargetSource = rawSource === 'comparison_distribution_randomized'
    ? 'comparison_distribution_randomized'
    : rawSource === 'comparison_matched_manual'
      ? 'comparison_matched_manual'
      : 'intervention_assignment_snapshot';
  return {
    schemaVersion: String(row.schemaVersion || RQ1_TARGET_SCHEMA_VERSION),
    researchId,
    siteId: String(row.siteId || ''),
    schoolCondition: condition,
    classId: String(row.classId || ''),
    gradeLevel: row.gradeLevel === 5 || row.gradeLevel === 6 ? row.gradeLevel : '',
    targetCountry,
    source,
    note: String(row.note || ''),
    revision: Number.isInteger(Number(row.revision)) ? Number(row.revision) : 0,
    createdAt: String(row.createdAt || ''),
    createdBy: String(row.createdBy || ''),
    updatedAt: String(row.updatedAt || ''),
    updatedBy: String(row.updatedBy || ''),
    history: Array.isArray(row.history) ? row.history.slice(-100) : [],
  };
}

export async function getRq1TargetConfig(): Promise<Rq1TargetConfig> {
  return cleanConfig(await getDocument(RQ1_TARGET_CONFIG_COLLECTION, RQ1_TARGET_CONFIG_ID));
}

export async function getRq1TargetMappings(): Promise<Rq1TargetMapping[]> {
  const rows = await listCollection(RQ1_TARGET_COLLECTION, 1000);
  return rows.map(cleanMapping).filter((row): row is Rq1TargetMapping => Boolean(row));
}

export async function getRq1FormalParticipants() {
  const rows = await getStudentRecordsForManagement();
  return rows
    .filter((row) => row.active && row.formalStudyParticipant && (row.schoolCondition === 'intervention' || row.schoolCondition === 'comparison'))
    .map((row) => ({
      researchId: String(row.researchId || '').trim().toUpperCase(),
      siteId: String(row.studySiteId || ''),
      schoolCondition: row.schoolCondition as 'intervention' | 'comparison',
      classId: String(row.classId || ''),
      gradeLevel: row.gradeLevel === 5 || row.gradeLevel === 6 ? row.gradeLevel : '' as 5 | 6 | '',
      assignedPartnerCountry: canonicalRq1Country(row.assignedPartnerCountry),
    }))
    .filter((row) => Boolean(row.researchId))
    .sort((a, b) => a.schoolCondition.localeCompare(b.schoolCondition) || a.classId.localeCompare(b.classId, 'ja') || a.researchId.localeCompare(b.researchId));
}

export async function getRq1TargetStatus() {
  const [config, mappings, participants] = await Promise.all([
    getRq1TargetConfig(),
    getRq1TargetMappings(),
    getRq1FormalParticipants(),
  ]);
  const byResearchId = new Map(mappings.map((row) => [row.researchId, row]));
  const rows = participants.map((participant) => {
    const mapping = byResearchId.get(participant.researchId) || null;
    const targetCountry = mapping?.targetCountry || '';
    const interventionMismatch = participant.schoolCondition === 'intervention'
      && Boolean(targetCountry)
      && targetCountry !== participant.assignedPartnerCountry;
    return {
      ...participant,
      targetCountry,
      targetSource: mapping?.source || '',
      targetRevision: mapping?.revision || 0,
      targetUpdatedAt: mapping?.updatedAt || '',
      targetNote: mapping?.note || '',
      interventionMismatch,
      ready: Boolean(targetCountry) && !interventionMismatch,
    };
  });
  const conditionCounts = {
    intervention: rows.filter((row) => row.schoolCondition === 'intervention').length,
    comparison: rows.filter((row) => row.schoolCondition === 'comparison').length,
  };
  const missing = rows.filter((row) => !row.targetCountry).map((row) => row.researchId);
  const mismatches = rows.filter((row) => row.interventionMismatch).map((row) => row.researchId);
  const manualComparisonMappings = rows.filter((row) => row.schoolCondition === 'comparison' && row.targetCountry && row.targetSource !== 'comparison_distribution_randomized').map((row) => row.researchId);
  const randomizedComparisonCount = rows.filter((row) => row.schoolCondition === 'comparison' && row.targetSource === 'comparison_distribution_randomized' && row.targetCountry).length;
  const mappingIds = new Set(rows.map((row) => row.researchId));
  const orphanMappings = mappings.filter((row) => !mappingIds.has(row.researchId)).map((row) => row.researchId);
  const currentSnapshot = rows
    .map((row) => `${row.researchId}|${row.schoolCondition}|${row.targetCountry}`)
    .sort()
    .join('\n');
  const currentSnapshotHash = currentSnapshot ? crypto.createHash('sha256').update(currentSnapshot).digest('hex') : '';
  const currentAllocationInputHash = buildRq1AllocationInputHash(participants);
  const allocationInputMatches = Boolean(config.allocationInputHash) && config.allocationInputHash === currentAllocationInputHash;
  const allocationReady = conditionCounts.comparison > 0
    && config.allocationMethod === RQ1_COMPARISON_ALLOCATION_METHOD
    && config.allocationAlgorithmVersion === RQ1_COMPARISON_ALLOCATION_ALGORITHM_VERSION
    && Boolean(config.allocationSeed)
    && Boolean(config.allocationCompletedAt)
    && allocationInputMatches
    && randomizedComparisonCount === conditionCounts.comparison
    && manualComparisonMappings.length === 0;
  const frozenSnapshotMatches = config.status !== 'frozen' || !config.snapshotHash || config.snapshotHash === currentSnapshotHash;
  const readyToFreeze = rows.length > 0
    && conditionCounts.intervention > 0
    && conditionCounts.comparison > 0
    && missing.length === 0
    && mismatches.length === 0
    && allocationReady;
  const formalReady = config.status === 'frozen'
    && readyToFreeze
    && frozenSnapshotMatches
    && config.participantCount === rows.length;
  return {
    config,
    countries: RQ1_COUNTRY_OPTIONS,
    participants: rows,
    counts: {
      participants: rows.length,
      intervention: conditionCounts.intervention,
      comparison: conditionCounts.comparison,
      mapped: rows.filter((row) => Boolean(row.targetCountry)).length,
      missing: missing.length,
      mismatches: mismatches.length,
      randomizedComparison: randomizedComparisonCount,
      manualComparison: manualComparisonMappings.length,
      orphanMappings: orphanMappings.length,
    },
    missingResearchIds: missing,
    mismatchResearchIds: mismatches,
    manualComparisonResearchIds: manualComparisonMappings,
    orphanMappingResearchIds: orphanMappings,
    currentSnapshotHash,
    currentAllocationInputHash,
    allocationInputMatches,
    allocationReady,
    frozenSnapshotMatches,
    readyToFreeze,
    formalReady,
  };
}

async function assertDraftConfig() {
  const config = await getRq1TargetConfig();
  if (config.status === 'frozen') throw new Error('RQ1_TARGET_TABLE_FROZEN');
  return config;
}

async function writeMapping(args: {
  participant: Awaited<ReturnType<typeof getRq1FormalParticipants>>[number];
  targetCountry: string;
  source: Rq1TargetSource;
  note?: string;
  updatedBy: string;
}) {
  const { participant, targetCountry, source } = args;
  const id = safeDocId(participant.researchId);
  const existingRaw = await getDocument(RQ1_TARGET_COLLECTION, id);
  const existing = existingRaw ? cleanMapping(existingRaw) : null;
  const now = new Date().toISOString();
  const actor = String(args.updatedBy || 'researcher').slice(0, 100);
  const changed = !existing
    || existing.targetCountry !== targetCountry
    || existing.source !== source
    || existing.classId !== participant.classId
    || existing.siteId !== participant.siteId
    || existing.gradeLevel !== participant.gradeLevel
    || String(existing.note || '') !== String(args.note || '');
  if (!changed && existing) return { mapping: existing, changed: false };
  const history = existing?.history || [];
  const next: Rq1TargetMapping = {
    schemaVersion: RQ1_TARGET_SCHEMA_VERSION,
    researchId: participant.researchId,
    siteId: participant.siteId,
    schoolCondition: participant.schoolCondition,
    classId: participant.classId,
    gradeLevel: participant.gradeLevel,
    targetCountry,
    source,
    note: String(args.note || '').trim().slice(0, 500),
    revision: (existing?.revision || 0) + 1,
    createdAt: existing?.createdAt || now,
    createdBy: existing?.createdBy || actor,
    updatedAt: now,
    updatedBy: actor,
    history: [...history, {
      revision: (existing?.revision || 0) + 1,
      previousTargetCountry: existing?.targetCountry || '',
      nextTargetCountry: targetCountry,
      previousSource: existing?.source || '',
      nextSource: source,
      changedAt: now,
      changedBy: actor,
    }].slice(-100),
  };
  await setDocument(RQ1_TARGET_COLLECTION, id, next as unknown as Record<string, unknown>);
  return { mapping: next, changed: true };
}

async function saveConfig(next: Rq1TargetConfig) {
  await setDocument(RQ1_TARGET_CONFIG_COLLECTION, RQ1_TARGET_CONFIG_ID, next as unknown as Record<string, unknown>);
  return next;
}

export async function initializeRq1InterventionTargets(updatedBy: string) {
  const config = await assertDraftConfig();
  const participants = await getRq1FormalParticipants();
  const inputHash = buildRq1AllocationInputHash(participants);
  const reusableAllocation = config.allocationInputHash === inputHash
    && config.allocationAlgorithmVersion === RQ1_COMPARISON_ALLOCATION_ALGORITHM_VERSION
    && Boolean(config.allocationSeed);
  const seed = reusableAllocation ? config.allocationSeed : `RQ1-${crypto.randomBytes(16).toString('hex')}`;
  const generatedAt = reusableAllocation && config.allocationGeneratedAt ? config.allocationGeneratedAt : new Date().toISOString();
  const actor = String(updatedBy || 'researcher').slice(0, 100);
  const plan = buildRq1ComparisonAllocationPlan(participants, seed);
  const freshAllocation = !reusableAllocation;
  let workingConfig = config;

  if (freshAllocation || !config.allocationGeneratedAt) {
    workingConfig = {
      ...config,
      schemaVersion: RQ1_TARGET_SCHEMA_VERSION,
      allocationMethod: plan.method,
      allocationAlgorithmVersion: plan.algorithmVersion,
      allocationSeed: seed,
      allocationGeneratedAt: generatedAt,
      allocationGeneratedBy: actor,
      allocationInputHash: plan.inputHash,
      allocationCompletedAt: '',
      allocationGradeSummaries: plan.gradeSummaries,
      updatedAt: generatedAt,
      updatedBy: actor,
      history: [...config.history, {
        action: 'comparison_allocation_started',
        method: plan.method,
        algorithmVersion: plan.algorithmVersion,
        seed,
        inputHash: plan.inputHash,
        gradeSummaries: plan.gradeSummaries,
        changedAt: generatedAt,
        changedBy: actor,
      }].slice(-100),
    };
    await saveConfig(workingConfig);
  }

  let interventionChanged = 0;
  for (const participant of participants.filter((row) => row.schoolCondition === 'intervention')) {
    if (!participant.assignedPartnerCountry) throw new Error('RQ1_INTERVENTION_ASSIGNMENTS_INCOMPLETE');
    const result = await writeMapping({
      participant,
      targetCountry: participant.assignedPartnerCountry,
      source: 'intervention_assignment_snapshot',
      note: '実践校の担当国をRQ1全期間共通の分析上の参照国として固定するためのスナップショット',
      updatedBy: actor,
    });
    if (result.changed) interventionChanged += 1;
  }

  const participantById = new Map(participants.map((row) => [row.researchId, row]));
  let comparisonChanged = 0;
  for (const assignment of plan.assignments) {
    const participant = participantById.get(assignment.researchId);
    if (!participant || participant.schoolCondition !== 'comparison') throw new Error('RQ1_FORMAL_PARTICIPANT_NOT_FOUND');
    const summary = plan.gradeSummaries.find((row) => row.gradeLevel === assignment.gradeLevel);
    const note = [
      `自動割付 method=${plan.method}`,
      `algorithm=${plan.algorithmVersion}`,
      `seed=${seed}`,
      `generatedAt=${generatedAt}`,
      `inputHash=${plan.inputHash}`,
      `grade=${assignment.gradeLevel}`,
      `interventionN=${summary?.interventionN ?? ''}`,
      `comparisonN=${summary?.comparisonN ?? ''}`,
    ].join('; ');
    const result = await writeMapping({
      participant,
      targetCountry: assignment.targetCountry,
      source: 'comparison_distribution_randomized',
      note,
      updatedBy: actor,
    });
    if (result.changed) comparisonChanged += 1;
  }

  const completedAt = reusableAllocation && config.allocationCompletedAt && comparisonChanged === 0
    ? config.allocationCompletedAt
    : new Date().toISOString();
  if (freshAllocation || interventionChanged > 0 || comparisonChanged > 0 || !workingConfig.allocationCompletedAt) {
    const finalConfig: Rq1TargetConfig = {
      ...workingConfig,
      schemaVersion: RQ1_TARGET_SCHEMA_VERSION,
      allocationMethod: plan.method,
      allocationAlgorithmVersion: plan.algorithmVersion,
      allocationSeed: seed,
      allocationGeneratedAt: generatedAt,
      allocationGeneratedBy: reusableAllocation && config.allocationGeneratedBy ? config.allocationGeneratedBy : actor,
      allocationInputHash: plan.inputHash,
      allocationCompletedAt: completedAt,
      allocationGradeSummaries: plan.gradeSummaries,
      updatedAt: completedAt,
      updatedBy: actor,
      history: [...workingConfig.history, {
        action: 'comparison_allocation_completed',
        method: plan.method,
        algorithmVersion: plan.algorithmVersion,
        seed,
        inputHash: plan.inputHash,
        interventionMappingsChanged: interventionChanged,
        comparisonMappingsChanged: comparisonChanged,
        changedAt: completedAt,
        changedBy: actor,
      }].slice(-100),
    };
    await saveConfig(finalConfig);
  }

  return {
    createdOrUpdated: interventionChanged + comparisonChanged,
    interventionCreatedOrUpdated: interventionChanged,
    comparisonCreatedOrUpdated: comparisonChanged,
    allocation: {
      method: plan.method,
      algorithmVersion: plan.algorithmVersion,
      seed,
      generatedAt,
      inputHash: plan.inputHash,
      gradeSummaries: plan.gradeSummaries,
    },
    status: await getRq1TargetStatus(),
  };
}

export async function saveRq1TargetMapping(args: {
  researchId: string;
  targetCountry: string;
  note?: string;
  expectedRevision?: number;
  updatedBy: string;
}) {
  await assertDraftConfig();
  const researchId = String(args.researchId || '').trim().toUpperCase();
  const targetCountry = canonicalRq1Country(args.targetCountry);
  if (!researchId) throw new Error('RQ1_RESEARCH_ID_REQUIRED');
  if (!targetCountry) throw new Error('RQ1_TARGET_COUNTRY_INVALID');
  const participants = await getRq1FormalParticipants();
  const participant = participants.find((row) => row.researchId === researchId);
  if (!participant) throw new Error('RQ1_FORMAL_PARTICIPANT_NOT_FOUND');
  if (participant.schoolCondition === 'comparison') throw new Error('RQ1_COMPARISON_TARGET_AUTO_ALLOCATION_REQUIRED');
  if (targetCountry !== participant.assignedPartnerCountry) throw new Error('RQ1_INTERVENTION_TARGET_MUST_MATCH_ASSIGNMENT');
  const existing = (await getRq1TargetMappings()).find((row) => row.researchId === researchId);
  if (args.expectedRevision !== undefined && Number(args.expectedRevision) !== Number(existing?.revision || 0)) {
    throw new Error('RQ1_TARGET_REVISION_CONFLICT');
  }
  return writeMapping({
    participant,
    targetCountry,
    source: 'intervention_assignment_snapshot',
    note: args.note,
    updatedBy: args.updatedBy,
  });
}

export async function freezeRq1TargetTable(updatedBy: string) {
  const config = await assertDraftConfig();
  const status = await getRq1TargetStatus();
  if (status.counts.intervention < 1 || status.counts.comparison < 1) throw new Error('RQ1_BOTH_CONDITIONS_REQUIRED_TO_FREEZE');
  if (!status.allocationReady) throw new Error('RQ1_COMPARISON_ALLOCATION_NOT_READY');
  if (!status.readyToFreeze) throw new Error('RQ1_TARGET_TABLE_NOT_READY');
  const now = new Date().toISOString();
  const actor = String(updatedBy || 'researcher').slice(0, 100);
  const next: Rq1TargetConfig = {
    ...config,
    schemaVersion: RQ1_TARGET_SCHEMA_VERSION,
    status: 'frozen',
    revision: config.revision + 1,
    frozenAt: now,
    frozenBy: actor,
    snapshotHash: status.currentSnapshotHash,
    participantCount: status.counts.participants,
    updatedAt: now,
    updatedBy: actor,
    history: [...config.history, {
      revision: config.revision + 1,
      action: 'freeze',
      snapshotHash: status.currentSnapshotHash,
      participantCount: status.counts.participants,
      allocationInputHash: config.allocationInputHash,
      allocationSeed: config.allocationSeed,
      changedAt: now,
      changedBy: actor,
    }].slice(-100),
  };
  await saveConfig(next);
  return getRq1TargetStatus();
}

export async function unfreezeRq1TargetTable(updatedBy: string) {
  const config = await getRq1TargetConfig();
  if (config.status !== 'frozen') return getRq1TargetStatus();
  const now = new Date().toISOString();
  const actor = String(updatedBy || 'researcher').slice(0, 100);
  const next: Rq1TargetConfig = {
    ...config,
    status: 'draft',
    revision: config.revision + 1,
    frozenAt: '',
    frozenBy: '',
    snapshotHash: '',
    participantCount: 0,
    updatedAt: now,
    updatedBy: actor,
    history: [...config.history, {
      revision: config.revision + 1,
      action: 'unfreeze',
      changedAt: now,
      changedBy: actor,
    }].slice(-100),
  };
  await saveConfig(next);
  return getRq1TargetStatus();
}

export function assertRq1FormalTargetStatus(status: Awaited<ReturnType<typeof getRq1TargetStatus>>) {
  if (status.config.status !== 'frozen') throw new Error('RQ1_TARGET_TABLE_NOT_FROZEN');
  if (!status.formalReady) throw new Error('RQ1_TARGET_TABLE_NOT_READY');
}
