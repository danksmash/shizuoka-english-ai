import { isAIStudentId } from '../dataContract';
import { listCollectionFields, patchDocumentsBatch } from './firestore';

const SESSION_COLLECTION = 'sessions';
const REPAIR_FIELDS = [
  'sessionId',
  'aiStudentId',
  'history',
  'totalTurns',
  'aiTurnCount',
  'dialogueUtteranceCount',
  'dialogueTurnMetricSource',
  'aggregateSyncStatus',
];

type Row = Record<string, any>;

export type ResearchTurnMetricRepairAudit = {
  researchSessions: number;
  exactExisting: number;
  repairableFromHistory: number;
  unavailableHistoryMissing: number;
  unavailableChildMismatch: number;
  unavailableOther: number;
  wouldPatch: number;
};

function finiteNonNegative(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function documentId(row: Row): string {
  return String(
    row.sessionId
    || (typeof row._name === 'string' ? row._name.split('/').at(-1) || '' : ''),
  );
}

export function deriveDialogueTurnMetricsFromStoredHistory(row: Row): {
  childTurns: number;
  aiTurns: number;
  dialogueTurns: number;
} | null {
  if (!Array.isArray(row.history) || row.history.length === 0) return null;
  const childTurns = row.history.filter((message: any) => (
    message
    && message.sender === 'child'
    && typeof message.englishText === 'string'
    && message.englishText.trim().length > 0
  )).length;
  // Session saves canonicalize history before storage, so every retained AI
  // message is a real dialogue utterance. Count by sender to match the current
  // saveCanonicalSession() definition exactly.
  const aiTurns = row.history.filter((message: any) => message && message.sender === 'ai').length;
  if (childTurns <= 0 || aiTurns < 0) return null;
  return { childTurns, aiTurns, dialogueTurns: childTurns + aiTurns };
}

function hasExactStoredMetric(row: Row): boolean {
  const child = finiteNonNegative(row.totalTurns);
  const ai = finiteNonNegative(row.aiTurnCount);
  const dialogue = finiteNonNegative(row.dialogueUtteranceCount);
  return child !== null
    && child > 0
    && ai !== null
    && dialogue !== null
    && dialogue === child + ai;
}

function classify(row: Row) {
  if (hasExactStoredMetric(row)) return { status:'exact' as const };
  const canonicalChild = finiteNonNegative(row.totalTurns);
  if (canonicalChild === null || canonicalChild <= 0) return { status:'unavailable_other' as const };
  const fromHistory = deriveDialogueTurnMetricsFromStoredHistory(row);
  if (!fromHistory) return { status:'unavailable_history' as const };
  if (fromHistory.childTurns !== canonicalChild) {
    return { status:'unavailable_child_mismatch' as const, fromHistory };
  }
  return { status:'repairable' as const, fromHistory };
}

async function sourceSessions(): Promise<Row[]> {
  const rows = await listCollectionFields(SESSION_COLLECTION, REPAIR_FIELDS, 250);
  return rows.filter((row) => isAIStudentId(row.aiStudentId));
}

export function auditResearchTurnMetricRows(rows: Row[]): ResearchTurnMetricRepairAudit {
  const audit: ResearchTurnMetricRepairAudit = {
    researchSessions: 0,
    exactExisting: 0,
    repairableFromHistory: 0,
    unavailableHistoryMissing: 0,
    unavailableChildMismatch: 0,
    unavailableOther: 0,
    wouldPatch: 0,
  };
  for (const row of rows) {
    if (!isAIStudentId(row.aiStudentId)) continue;
    audit.researchSessions += 1;
    const result = classify(row);
    if (result.status === 'exact') {
      audit.exactExisting += 1;
      continue;
    }
    audit.wouldPatch += 1;
    if (result.status === 'repairable') audit.repairableFromHistory += 1;
    else if (result.status === 'unavailable_history') audit.unavailableHistoryMissing += 1;
    else if (result.status === 'unavailable_child_mismatch') audit.unavailableChildMismatch += 1;
    else audit.unavailableOther += 1;
  }
  return audit;
}

export async function auditResearchTurnMetricRepair(): Promise<ResearchTurnMetricRepairAudit> {
  return auditResearchTurnMetricRows(await sourceSessions());
}

export async function repairResearchTurnMetricsFromStoredHistory() {
  const rows = await sourceSessions();
  const auditBefore = auditResearchTurnMetricRows(rows);
  const patches: Array<{ id: string; data: Record<string, unknown> }> = [];

  for (const row of rows) {
    const result = classify(row);
    if (result.status === 'exact') continue;
    const id = documentId(row);
    if (!id) throw new Error('RESEARCH_TURN_METRIC_REPAIR_SESSION_ID_MISSING');

    if (result.status === 'repairable') {
      patches.push({
        id,
        data: {
          aiTurnCount: result.fromHistory.aiTurns,
          dialogueUtteranceCount: result.fromHistory.dialogueTurns,
          dialogueTurnMetricSource: 'history_repair_v1',
          aggregateSyncStatus: 'pending',
        },
      });
      continue;
    }

    patches.push({
      id,
      data: {
        dialogueTurnMetricSource: result.status === 'unavailable_history'
          ? 'unavailable_history_missing'
          : result.status === 'unavailable_child_mismatch'
            ? 'unavailable_child_mismatch'
            : 'unavailable_other',
        aggregateSyncStatus: 'pending',
      },
    });
  }

  for (let index = 0; index < patches.length; index += 200) {
    await patchDocumentsBatch(SESSION_COLLECTION, patches.slice(index, index + 200));
  }

  const auditAfter = await auditResearchTurnMetricRepair();
  if (auditAfter.repairableFromHistory > 0) {
    throw new Error('RESEARCH_TURN_METRIC_REPAIR_INCOMPLETE');
  }
  return { auditBefore, auditAfter, patchedSessions: patches.length };
}
