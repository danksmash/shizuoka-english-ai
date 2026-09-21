import { RQ2_STRATA, RQ2_STRATUM_LABELS, type Rq2Candidate, type Rq2SampledItem, type Rq2StratumId } from './researchRq2Sampling';

export const RQ2_FORMAL_TARGET_PER_STRATUM = 50;
export const RQ2_FORMAL_MAX_PER_PARTICIPANT_PER_STRATUM = 2;
export const RQ2_FORMAL_TOTAL = RQ2_STRATA.length * RQ2_FORMAL_TARGET_PER_STRATUM;

type SampleCounts = Record<Rq2StratumId, {
  candidates: number;
  participants: number;
  selected: number;
  shortfall: number;
}>;

function purposeExpected(targetPerStratum: number) {
  const development = Math.round(targetPerStratum * 0.4);
  const reliability = Math.round(targetPerStratum * 0.2);
  const other = Math.max(0, targetPerStratum - development - reliability);
  return {
    codebook_development: development * RQ2_STRATA.length,
    reliability: reliability * RQ2_STRATA.length,
    main_other: other * RQ2_STRATA.length,
  };
}

function duplicateIds(values: string[]) {
  const seen = new Set<string>();
  const duplicate = new Set<string>();
  for (const value of values.filter(Boolean)) {
    if (seen.has(value)) duplicate.add(value);
    else seen.add(value);
  }
  return [...duplicate].sort();
}

function sourceCount(codebook: Record<string, any>) {
  return Array.isArray(codebook.references) ? codebook.references.length : 0;
}

export function buildRq2PreflightAudit(args: {
  candidates: Rq2Candidate[];
  sampledItems: Rq2SampledItem[];
  counts: SampleCounts;
  codebook: Record<string, any>;
  activeFormalRuns: Record<string, any>[];
  targetPerStratum: number;
  maxPerParticipantPerStratum: number;
  lessonOnly: boolean;
}) {
  const {
    candidates,
    sampledItems,
    counts,
    codebook,
    activeFormalRuns,
    targetPerStratum,
    maxPerParticipantPerStratum,
    lessonOnly,
  } = args;

  const expectedPurposes = purposeExpected(targetPerStratum);
  const actualPurposes = {
    codebook_development: sampledItems.filter((row) => row.purpose === 'codebook_development').length,
    reliability: sampledItems.filter((row) => row.purpose === 'reliability').length,
    main_other: sampledItems.filter((row) => row.purpose === 'main_other').length,
  };
  const candidateDuplicates = duplicateIds(candidates.map((row) => row.sequenceId));
  const selectedDuplicates = duplicateIds(sampledItems.map((row) => row.sequenceId));

  const strata = RQ2_STRATA.map((stratum) => {
    const rows = candidates.filter((row) => row.stratum === stratum);
    const byParticipant = new Map<string, number>();
    for (const row of rows) {
      if (!row.researchId) continue;
      byParticipant.set(row.researchId, (byParticipant.get(row.researchId) || 0) + 1);
    }
    const effectiveCapacity = [...byParticipant.values()]
      .reduce((sum, n) => sum + Math.min(n, maxPerParticipantPerStratum), 0);
    const requiredParticipantsLowerBound = Math.ceil(targetPerStratum / maxPerParticipantPerStratum);
    const selected = Number(counts[stratum]?.selected || 0);
    return {
      stratum,
      label: RQ2_STRATUM_LABELS[stratum],
      candidates: rows.length,
      participants: byParticipant.size,
      effectiveCapacity,
      selected,
      shortfall: Math.max(0, targetPerStratum - selected),
      requiredParticipantsLowerBound,
      participantMargin: byParticipant.size - requiredParticipantsLowerBound,
      capacityMargin: effectiveCapacity - targetPerStratum,
      ready: selected >= targetPerStratum && effectiveCapacity >= targetPerStratum,
    };
  });

  const standardDesign = targetPerStratum === RQ2_FORMAL_TARGET_PER_STRATUM
    && maxPerParticipantPerStratum === RQ2_FORMAL_MAX_PER_PARTICIPANT_PER_STRATUM;
  const exactPurposeSplit = actualPurposes.codebook_development === expectedPurposes.codebook_development
    && actualPurposes.reliability === expectedPurposes.reliability
    && actualPurposes.main_other === expectedPurposes.main_other;
  const selectedTotal = sampledItems.length;

  const gates = [
    {
      id: 'literature_codebook_schema',
      label: '文献根拠型コードブック schema 4',
      blocking: true,
      passed: Number(codebook.schemaVersion || 0) >= 4 && sourceCount(codebook) > 0,
      detail: `schema=${codebook.schemaVersion || '—'} / 文献${sourceCount(codebook)}件`,
    },
    {
      id: 'standard_sampling_design',
      label: '正式設計 6区分×50系列・児童上限2系列',
      blocking: true,
      passed: standardDesign,
      detail: `各区分${targetPerStratum}系列 / 児童上限${maxPerParticipantPerStratum}系列`,
    },
    {
      id: 'all_strata_capacity',
      label: '6区分すべてで抽出可能',
      blocking: true,
      passed: strata.every((row) => row.ready),
      detail: strata.filter((row) => !row.ready).map((row) => `${row.label}:不足${row.shortfall}`).join(' / ') || '不足なし',
    },
    {
      id: 'exact_total',
      label: '正式設計300系列',
      blocking: true,
      passed: selectedTotal === RQ2_FORMAL_TOTAL,
      detail: `抽出予定${selectedTotal} / ${RQ2_FORMAL_TOTAL}`,
    },
    {
      id: 'purpose_split',
      label: '開発120・一致度60・その他120',
      blocking: true,
      passed: exactPurposeSplit
        && actualPurposes.codebook_development === 120
        && actualPurposes.reliability === 60
        && actualPurposes.main_other === 120,
      detail: `開発${actualPurposes.codebook_development} / 一致度${actualPurposes.reliability} / その他${actualPurposes.main_other}`,
    },
    {
      id: 'unique_sequences',
      label: '系列ID重複なし',
      blocking: true,
      passed: candidateDuplicates.length === 0 && selectedDuplicates.length === 0,
      detail: candidateDuplicates.length || selectedDuplicates.length
        ? `候補重複${candidateDuplicates.length} / 抽出重複${selectedDuplicates.length}`
        : '重複なし',
    },
    {
      id: 'no_active_formal_run',
      label: '有効な正式抽出runなし',
      blocking: true,
      passed: activeFormalRuns.length === 0,
      detail: activeFormalRuns.length ? `有効run ${activeFormalRuns.length}件` : '未抽出',
    },
    {
      id: 'lesson_only_default',
      label: '授業内推定のみ',
      blocking: false,
      passed: lessonOnly,
      detail: lessonOnly ? '既定の授業内推定のみ' : '授業外候補も含む設定。正式抽出前に研究計画と照合する。',
    },
    {
      id: 'codebook_development_state',
      label: 'コードブック開発状態',
      blocking: false,
      passed: ['literature_draft','validated_with_development_sample'].includes(String(codebook.developmentStatus || '')),
      detail: String(codebook.developmentStatus || '未設定'),
    },
  ];

  return {
    auditVersion: 'rq2-preflight-2026-v1',
    generatedAt: new Date().toISOString(),
    mutatesData: false,
    targetPerStratum,
    maxPerParticipantPerStratum,
    lessonOnly,
    formalDesign: {
      strata: RQ2_STRATA.length,
      targetPerStratum: RQ2_FORMAL_TARGET_PER_STRATUM,
      maxPerParticipantPerStratum: RQ2_FORMAL_MAX_PER_PARTICIPANT_PER_STRATUM,
      total: RQ2_FORMAL_TOTAL,
      purposeSplit: { codebook_development: 120, reliability: 60, main_other: 120 },
    },
    selectedTotal,
    purposeCounts: actualPurposes,
    expectedPurposeCounts: expectedPurposes,
    candidateDuplicateSequenceIds: candidateDuplicates,
    selectedDuplicateSequenceIds: selectedDuplicates,
    activeFormalRunIds: activeFormalRuns.map((row) => String(row.runId || '')).filter(Boolean),
    strata,
    gates,
    overallReady: gates.filter((gate) => gate.blocking).every((gate) => gate.passed),
  };
}
