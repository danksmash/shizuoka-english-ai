import { RQ2_STRATA, RQ2_STRATUM_LABELS } from './researchRq2Sampling';

type Dimension = 'reference' | 'function' | 'locus';
type CodingSource = 'ai' | 'human';

function codeSet(row: Record<string, any>, dimension: Dimension, source: CodingSource): string[] {
  const key = source === 'human'
    ? (dimension === 'reference' ? 'humanReferenceCodes' : dimension === 'function' ? 'humanFunctionCodes' : 'humanRecipientLocus')
    : (dimension === 'reference' ? 'aiReferenceCodes' : dimension === 'function' ? 'aiFunctionCodes' : 'aiRecipientLocus');
  return Array.isArray(row[key]) ? row[key].map(String) : [];
}

function countsByCode(rows: Record<string, any>[], dimension: Dimension, source: CodingSource) {
  const out: Record<string, number> = {};
  for (const row of rows) {
    for (const code of codeSet(row, dimension, source)) out[code] = (out[code] || 0) + 1;
  }
  return out;
}

function humanFinalRows(rows: Record<string, any>[]) {
  return rows.filter((row) => row.humanStatus === 'confirmed' || row.humanStatus === 'modified');
}

export function buildRq2Analysis(items: Record<string, any>[]) {
  return {
    codingRule: 'AIは候補コード、人間確認済みコードだけを正式集計として扱う。',
    strata: RQ2_STRATA.map((stratum) => {
      const rows = items.filter((row) => row.stratum === stratum);
      const finalRows = humanFinalRows(rows);
      return {
        stratum,
        label: RQ2_STRATUM_LABELS[stratum],
        n: rows.length,
        aiCoded: rows.filter((row) => row.aiStatus === 'coded').length,
        humanConfirmed: finalRows.length,
        finalPending: rows.length - finalRows.length,
        needsReview: rows.filter((row) => row.aiNeedsReview === true).length,
        aiCandidateReferenceCodes: countsByCode(rows, 'reference', 'ai'),
        aiCandidateFunctionCodes: countsByCode(rows, 'function', 'ai'),
        aiCandidateRecipientLocus: countsByCode(rows, 'locus', 'ai'),
        finalReferenceCodes: countsByCode(finalRows, 'reference', 'human'),
        finalFunctionCodes: countsByCode(finalRows, 'function', 'human'),
        finalRecipientLocus: countsByCode(finalRows, 'locus', 'human'),
      };
    }),
  };
}

function binaryKappa(a: boolean[], b: boolean[]) {
  const n = Math.min(a.length, b.length);
  if (!n) return { n: 0, agreement: null, kappa: null };
  let agree = 0, aYes = 0, bYes = 0;
  for (let i = 0; i < n; i += 1) {
    if (a[i] === b[i]) agree += 1;
    if (a[i]) aYes += 1;
    if (b[i]) bYes += 1;
  }
  const po = agree / n;
  const pa = aYes / n;
  const pb = bYes / n;
  const pe = pa * pb + (1 - pa) * (1 - pb);
  const kappa = Math.abs(1 - pe) < 1e-12 ? null : (po - pe) / (1 - pe);
  return { n, agreement: Number((po * 100).toFixed(1)), kappa: kappa === null ? null : Number(kappa.toFixed(3)) };
}

export function buildRq2ReliabilitySummary(records: Record<string, any>[]) {
  const coders = [...new Set(records.map((row) => String(row.coderKey || '')).filter(Boolean))].sort();
  if (coders.length < 2) return { coders, commonItems: 0, codes: [] };
  const [coderA, coderB] = coders;
  const aRows = new Map(records.filter((row) => row.coderKey === coderA).map((row) => [String(row.sequenceId || ''), row]));
  const bRows = new Map(records.filter((row) => row.coderKey === coderB).map((row) => [String(row.sequenceId || ''), row]));
  const common = [...aRows.keys()].filter((key) => bRows.has(key));
  const allCodes = new Set<string>();
  for (const key of common) {
    const a = aRows.get(key)!; const b = bRows.get(key)!;
    for (const field of ['referenceCodes','functionCodes','recipientLocus']) {
      for (const code of [...(Array.isArray(a[field]) ? a[field] : []), ...(Array.isArray(b[field]) ? b[field] : [])]) allCodes.add(String(code));
    }
  }
  const codes = [...allCodes].sort().map((code) => {
    const aValues = common.map((key) => ['referenceCodes','functionCodes','recipientLocus'].some((field) => (aRows.get(key)?.[field] || []).includes(code)));
    const bValues = common.map((key) => ['referenceCodes','functionCodes','recipientLocus'].some((field) => (bRows.get(key)?.[field] || []).includes(code)));
    return { code, ...binaryKappa(aValues, bValues) };
  });
  return { coders: [coderA, coderB], commonItems: common.length, codes };
}
