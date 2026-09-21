import { RQ2_STRATA, RQ2_STRATUM_LABELS } from './researchRq2Sampling';

type Dimension = 'reference' | 'function';
type CodingSource = 'ai' | 'human';

function primaryCode(row: Record<string, any>, dimension: Dimension, source: CodingSource): string {
  const primaryKey = source === 'human'
    ? (dimension === 'reference' ? 'humanReferencePrimary' : 'humanFunctionPrimary')
    : (dimension === 'reference' ? 'aiReferencePrimary' : 'aiFunctionPrimary');
  const legacyKey = source === 'human'
    ? (dimension === 'reference' ? 'humanReferenceCodes' : 'humanFunctionCodes')
    : (dimension === 'reference' ? 'aiReferenceCodes' : 'aiFunctionCodes');
  const explicit = String(row[primaryKey] || '').trim();
  if (explicit) return explicit;
  const legacy = Array.isArray(row[legacyKey]) ? row[legacyKey].map(String).filter(Boolean) : [];
  return legacy[0] || '';
}

function auxCodes(row: Record<string, any>, dimension: Dimension, source: CodingSource): string[] {
  const auxKey = source === 'human'
    ? (dimension === 'reference' ? 'humanReferenceAuxCodes' : 'humanFunctionAuxCodes')
    : (dimension === 'reference' ? 'aiReferenceAuxCodes' : 'aiFunctionAuxCodes');
  const explicit = Array.isArray(row[auxKey]) ? row[auxKey].map(String).filter(Boolean) : [];
  if (explicit.length) return explicit;
  const legacyKey = source === 'human'
    ? (dimension === 'reference' ? 'humanReferenceCodes' : 'humanFunctionCodes')
    : (dimension === 'reference' ? 'aiReferenceCodes' : 'aiFunctionCodes');
  const legacy = Array.isArray(row[legacyKey]) ? row[legacyKey].map(String).filter(Boolean) : [];
  return legacy.slice(1);
}

function countsByPrimary(rows: Record<string, any>[], dimension: Dimension, source: CodingSource) {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const code = primaryCode(row, dimension, source);
    if (code) out[code] = (out[code] || 0) + 1;
  }
  return out;
}

function countsByAux(rows: Record<string, any>[], dimension: Dimension, source: CodingSource) {
  const out: Record<string, number> = {};
  for (const row of rows) {
    for (const code of auxCodes(row, dimension, source)) out[code] = (out[code] || 0) + 1;
  }
  return out;
}

function humanFinalRows(rows: Record<string, any>[]) {
  return rows.filter((row) => row.humanStatus === 'confirmed' || row.humanStatus === 'modified');
}

export function buildRq2Analysis(items: Record<string, any>[]) {
  return {
    codingRule: 'AIは候補コード。正式集計は人間確認済みの参照基盤主コード・対話機能主コードを用い、補助ラベルは記述用に保持する。',
    strata: RQ2_STRATA.map((stratum) => {
      const rows = items.filter((row) => row.stratum === stratum);
      const finalRows = humanFinalRows(rows);
      const aiReference = countsByPrimary(rows, 'reference', 'ai');
      const aiFunction = countsByPrimary(rows, 'function', 'ai');
      const finalReference = countsByPrimary(finalRows, 'reference', 'human');
      const finalFunction = countsByPrimary(finalRows, 'function', 'human');
      return {
        stratum,
        label: RQ2_STRATUM_LABELS[stratum],
        n: rows.length,
        aiCoded: rows.filter((row) => row.aiStatus === 'coded').length,
        humanConfirmed: finalRows.length,
        finalPending: rows.length - finalRows.length,
        needsReview: rows.filter((row) => row.aiNeedsReview === true).length,
        aiCandidateReferencePrimaryCodes: aiReference,
        aiCandidateFunctionPrimaryCodes: aiFunction,
        aiCandidateReferenceAuxCodes: countsByAux(rows, 'reference', 'ai'),
        aiCandidateFunctionAuxCodes: countsByAux(rows, 'function', 'ai'),
        finalReferencePrimaryCodes: finalReference,
        finalFunctionPrimaryCodes: finalFunction,
        finalReferenceAuxCodes: countsByAux(finalRows, 'reference', 'human'),
        finalFunctionAuxCodes: countsByAux(finalRows, 'function', 'human'),
        // Backward-compatible aliases for older dashboard code.
        aiCandidateReferenceCodes: aiReference,
        aiCandidateFunctionCodes: aiFunction,
        finalReferenceCodes: finalReference,
        finalFunctionCodes: finalFunction,
      };
    }),
  };
}

function categoricalKappa(pairs: Array<[string, string]>) {
  const valid = pairs.filter(([a, b]) => Boolean(a && b));
  const n = valid.length;
  if (!n) return { n: 0, agreement: null, kappa: null };
  const categories = [...new Set(valid.flat())];
  let agree = 0;
  const aCounts = new Map<string, number>();
  const bCounts = new Map<string, number>();
  for (const [a, b] of valid) {
    if (a === b) agree += 1;
    aCounts.set(a, (aCounts.get(a) || 0) + 1);
    bCounts.set(b, (bCounts.get(b) || 0) + 1);
  }
  const po = agree / n;
  const pe = categories.reduce((sum, category) => {
    const pa = (aCounts.get(category) || 0) / n;
    const pb = (bCounts.get(category) || 0) / n;
    return sum + pa * pb;
  }, 0);
  const kappa = Math.abs(1 - pe) < 1e-12 ? null : (po - pe) / (1 - pe);
  return {
    n,
    agreement: Number((po * 100).toFixed(1)),
    kappa: kappa === null ? null : Number(kappa.toFixed(3)),
  };
}

function reliabilityPrimary(row: Record<string, any>, dimension: Dimension): string {
  const explicit = dimension === 'reference'
    ? String(row.referencePrimary || '').trim()
    : String(row.functionPrimary || '').trim();
  if (explicit) return explicit;
  const legacy = dimension === 'reference' ? row.referenceCodes : row.functionCodes;
  return Array.isArray(legacy) && legacy.length ? String(legacy[0] || '') : '';
}

export function buildRq2ReliabilitySummary(records: Record<string, any>[]) {
  const coders = [...new Set(records.map((row) => String(row.coderKey || '')).filter(Boolean))].sort();
  if (coders.length < 2) {
    return {
      coders,
      commonItems: 0,
      reference: { n: 0, agreement: null, kappa: null },
      function: { n: 0, agreement: null, kappa: null },
    };
  }
  const [coderA, coderB] = coders;
  const aRows = new Map(records.filter((row) => row.coderKey === coderA).map((row) => [String(row.sequenceId || ''), row]));
  const bRows = new Map(records.filter((row) => row.coderKey === coderB).map((row) => [String(row.sequenceId || ''), row]));
  const common = [...aRows.keys()].filter((key) => bRows.has(key));
  const referencePairs = common.map((key) => [
    reliabilityPrimary(aRows.get(key)!, 'reference'),
    reliabilityPrimary(bRows.get(key)!, 'reference'),
  ] as [string, string]);
  const functionPairs = common.map((key) => [
    reliabilityPrimary(aRows.get(key)!, 'function'),
    reliabilityPrimary(bRows.get(key)!, 'function'),
  ] as [string, string]);
  return {
    coders: [coderA, coderB],
    commonItems: common.length,
    reference: categoricalKappa(referencePairs),
    function: categoricalKappa(functionPairs),
  };
}
