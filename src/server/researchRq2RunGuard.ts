import { RQ2_STRATA, type Rq2StratumId } from './researchRq2Sampling';

export type Rq2RunType = 'trial' | 'formal';

export interface Rq2SamplingCounts {
  candidates: number;
  participants: number;
  selected: number;
  shortfall: number;
}

export function rq2RunType(value: unknown): Rq2RunType {
  return String(value || '') === 'formal' ? 'formal' : 'trial';
}

export function rq2SamplingShortfalls(
  counts: Partial<Record<Rq2StratumId, Rq2SamplingCounts>>,
): Array<{ stratum: Rq2StratumId; shortfall: number; selected: number }> {
  return RQ2_STRATA.map((stratum) => {
    const row = counts[stratum];
    return {
      stratum,
      shortfall: Math.max(0, Number(row?.shortfall || 0)),
      selected: Math.max(0, Number(row?.selected || 0)),
    };
  }).filter((row) => row.shortfall > 0);
}

export function rq2FormalSamplingReady(
  counts: Partial<Record<Rq2StratumId, Rq2SamplingCounts>>,
): boolean {
  return rq2SamplingShortfalls(counts).length === 0;
}

export function assertRq2SamplingConfirmation(args: {
  runType: Rq2RunType;
  acknowledged: boolean;
  confirmText?: string;
  counts: Partial<Record<Rq2StratumId, Rq2SamplingCounts>>;
}) {
  if (!args.acknowledged) throw new Error('RQ2_SAMPLE_CONFIRMATION_REQUIRED');
  if (args.runType === 'formal') {
    if (String(args.confirmText || '').trim() !== '正式抽出') {
      throw new Error('RQ2_FORMAL_CONFIRM_TEXT_REQUIRED');
    }
    if (!rq2FormalSamplingReady(args.counts)) {
      throw new Error('RQ2_FORMAL_SAMPLE_INCOMPLETE');
    }
  }
}

export function assertRq2RunActive(run: Record<string, any> | null | undefined) {
  if (!run) throw new Error('RQ2_RUN_NOT_FOUND');
  if (String(run.status || '') === 'invalidated') throw new Error('RQ2_RUN_INVALIDATED');
  return run;
}

export function summarizeRq2RunProgress(items: Record<string, any>[], reliability: Record<string, any>[]) {
  return {
    aiCoded: items.filter((item) => item.aiStatus === 'coded').length,
    humanConfirmed: items.filter((item) => item.humanStatus === 'confirmed' || item.humanStatus === 'modified').length,
    reliabilityRecords: reliability.length,
    hasDownstreamWork: items.some((item) => item.aiStatus === 'coded' || item.humanStatus === 'confirmed' || item.humanStatus === 'modified') || reliability.length > 0,
  };
}

export function rq2OperationErrorStatus(message: string): number {
  if (message === 'RQ2_RUN_NOT_FOUND') return 404;
  if (
    message === 'RQ2_RUN_INVALIDATED'
    || message === 'RQ2_FORMAL_SAMPLE_INCOMPLETE'
    || message === 'RQ2_ACTIVE_FORMAL_RUN_EXISTS'
    || message === 'RQ2_FORMAL_PREFLIGHT_REQUIRED'
  ) return 409;
  if (
    message === 'RQ2_SAMPLE_CONFIRMATION_REQUIRED'
    || message === 'RQ2_FORMAL_CONFIRM_TEXT_REQUIRED'
    || message === 'RQ2_RESET_CONFIRM_TEXT_REQUIRED'
    || message === 'RQ2_RUN_ID_REQUIRED'
    || message.startsWith('RQ2_INVALID_CODE:')
  ) return 400;
  return 503;
}
