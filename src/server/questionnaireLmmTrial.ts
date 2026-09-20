import type { QuestionnaireRecord, QuestionnaireWave } from './questionnaireResearch';

export type QuestionnaireLmmMetric = 'l2wtc' | 'total';

interface TrialObservation {
  researchId: string;
  wave: QuestionnaireWave;
  condition: 'intervention' | 'comparison';
  value: number;
}

interface SubjectBlock {
  researchId: string;
  rows: Array<{ x: number[]; y: number }>;
}

interface LmmFit {
  beta: number[];
  covariance: number[][];
  residualVariance: number;
  randomInterceptVariance: number;
  lambda: number;
  nObservations: number;
  nParticipants: number;
  parameterCount: number;
}

export interface QuestionnaireLmmContrast {
  id: 'pre_mid' | 'mid_post' | 'pre_post';
  label: string;
  estimate: number | null;
  se: number | null;
  z: number | null;
  p: number | null;
  ciLow: number | null;
  ciHigh: number | null;
  interpretation: string;
}

export interface QuestionnaireLmmTrialMetricResult {
  metric: QuestionnaireLmmMetric;
  metricLabel: string;
  status: 'ok' | 'insufficient_data' | 'model_failed';
  mode: 'intervention_time_only' | 'group_time';
  nParticipants: number;
  nObservations: number;
  complete3: number;
  interventionParticipants: number;
  comparisonParticipants: number;
  randomInterceptVariance: number | null;
  residualVariance: number | null;
  contrasts: QuestionnaireLmmContrast[];
  note: string;
}

const WAVES: QuestionnaireWave[] = ['pre_app', 'mid_pre_reveal', 'post_pre_exchange'];

function round6(value: number): number | null {
  return Number.isFinite(value) ? Number(value.toFixed(6)) : null;
}

function normalCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const erf = sign * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax));
  return 0.5 * (1 + erf);
}

function metricValue(record: QuestionnaireRecord, metric: QuestionnaireLmmMetric): number {
  return metric === 'l2wtc' ? record.l2wtcMean : record.totalMean;
}

function recordCondition(record: QuestionnaireRecord): 'intervention' | 'comparison' {
  return (record as QuestionnaireRecord & { schoolCondition?: unknown }).schoolCondition === 'comparison' ? 'comparison' : 'intervention';
}

function uniqueObservations(records: QuestionnaireRecord[], metric: QuestionnaireLmmMetric): TrialObservation[] {
  const grouped = new Map<string, QuestionnaireRecord[]>();
  for (const record of records) {
    const key = `${record.researchId}|${record.surveyWave}`;
    const list = grouped.get(key) || [];
    list.push(record);
    grouped.set(key, list);
  }
  const out: TrialObservation[] = [];
  for (const list of grouped.values()) {
    if (list.length !== 1) continue;
    const record = list[0];
    const value = metricValue(record, metric);
    if (!Number.isFinite(value)) continue;
    out.push({
      researchId: record.researchId,
      wave: record.surveyWave,
      condition: recordCondition(record),
      value,
    });
  }
  return out;
}

function cholesky(matrix: number[][]): number[][] | null {
  const n = matrix.length;
  const l = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let sum = matrix[i][j];
      for (let k = 0; k < j; k += 1) sum -= l[i][k] * l[j][k];
      if (i === j) {
        if (!(sum > 1e-12)) return null;
        l[i][j] = Math.sqrt(sum);
      } else {
        l[i][j] = sum / l[j][j];
      }
    }
  }
  return l;
}

function solveCholesky(l: number[][], b: number[]): number[] {
  const n = l.length;
  const y = Array(n).fill(0);
  for (let i = 0; i < n; i += 1) {
    let sum = b[i];
    for (let k = 0; k < i; k += 1) sum -= l[i][k] * y[k];
    y[i] = sum / l[i][i];
  }
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i -= 1) {
    let sum = y[i];
    for (let k = i + 1; k < n; k += 1) sum -= l[k][i] * x[k];
    x[i] = sum / l[i][i];
  }
  return x;
}

function inverseFromCholesky(l: number[][]): number[][] {
  const n = l.length;
  const out = Array.from({ length: n }, () => Array(n).fill(0));
  for (let col = 0; col < n; col += 1) {
    const unit = Array(n).fill(0);
    unit[col] = 1;
    const solved = solveCholesky(l, unit);
    for (let row = 0; row < n; row += 1) out[row][col] = solved[row];
  }
  return out;
}

function dot(a: number[], b: number[]): number {
  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

function quadratic(vector: number[], matrix: number[][]): number {
  let total = 0;
  for (let i = 0; i < vector.length; i += 1) {
    for (let j = 0; j < vector.length; j += 1) total += vector[i] * matrix[i][j] * vector[j];
  }
  return total;
}

function profileFit(blocks: SubjectBlock[], parameterCount: number, lambda: number) {
  const xtax = Array.from({ length: parameterCount }, () => Array(parameterCount).fill(0));
  const xtay = Array(parameterCount).fill(0);
  let yay = 0;
  let logDetA = 0;
  let n = 0;

  for (const block of blocks) {
    const m = block.rows.length;
    if (!m) continue;
    n += m;
    const alpha = lambda / (1 + m * lambda);
    const sx = Array(parameterCount).fill(0);
    let sy = 0;
    for (const row of block.rows) {
      sy += row.y;
      yay += row.y * row.y;
      for (let a = 0; a < parameterCount; a += 1) {
        sx[a] += row.x[a];
        xtay[a] += row.x[a] * row.y;
        for (let b = 0; b < parameterCount; b += 1) xtax[a][b] += row.x[a] * row.x[b];
      }
    }
    yay -= alpha * sy * sy;
    for (let a = 0; a < parameterCount; a += 1) {
      xtay[a] -= alpha * sx[a] * sy;
      for (let b = 0; b < parameterCount; b += 1) xtax[a][b] -= alpha * sx[a] * sx[b];
    }
    logDetA += Math.log1p(m * lambda);
  }

  if (n <= parameterCount) return null;
  const l = cholesky(xtax);
  if (!l) return null;
  const beta = solveCholesky(l, xtay);
  const betaXtAy = dot(beta, xtay);
  const sse = yay - 2 * betaXtAy + quadratic(beta, xtax);
  if (!(sse > 1e-12)) return null;
  const residualDf = n - parameterCount;
  const residualVariance = sse / residualDf;
  const logDetXtAx = 2 * l.reduce((sum, row, index) => sum + Math.log(row[index]), 0);
  const objective = 0.5 * (logDetA + logDetXtAx + residualDf * Math.log(residualVariance));
  const inverse = inverseFromCholesky(l);
  const covariance = inverse.map((row) => row.map((value) => value * residualVariance));
  return {
    objective,
    fit: {
      beta,
      covariance,
      residualVariance,
      randomInterceptVariance: lambda * residualVariance,
      lambda,
      nObservations: n,
      nParticipants: blocks.length,
      parameterCount,
    } satisfies LmmFit,
  };
}

function fitRandomInterceptLmm(blocks: SubjectBlock[], parameterCount: number): LmmFit | null {
  const candidateThetas: number[] = [];
  for (let theta = -12; theta <= 10.0001; theta += 0.5) candidateThetas.push(theta);
  let best = profileFit(blocks, parameterCount, 0);
  let bestTheta: number | null = null;
  for (const theta of candidateThetas) {
    const candidate = profileFit(blocks, parameterCount, Math.exp(theta));
    if (candidate && (!best || candidate.objective < best.objective)) {
      best = candidate;
      bestTheta = theta;
    }
  }
  if (bestTheta !== null) {
    let left = bestTheta - 0.75;
    let right = bestTheta + 0.75;
    const phi = (Math.sqrt(5) - 1) / 2;
    let x1 = right - phi * (right - left);
    let x2 = left + phi * (right - left);
    let f1 = profileFit(blocks, parameterCount, Math.exp(x1));
    let f2 = profileFit(blocks, parameterCount, Math.exp(x2));
    for (let iteration = 0; iteration < 48; iteration += 1) {
      const v1 = f1?.objective ?? Number.POSITIVE_INFINITY;
      const v2 = f2?.objective ?? Number.POSITIVE_INFINITY;
      if (v1 <= v2) {
        right = x2;
        x2 = x1;
        f2 = f1;
        x1 = right - phi * (right - left);
        f1 = profileFit(blocks, parameterCount, Math.exp(x1));
      } else {
        left = x1;
        x1 = x2;
        f1 = f2;
        x2 = left + phi * (right - left);
        f2 = profileFit(blocks, parameterCount, Math.exp(x2));
      }
    }
    const refined = [f1, f2].filter((item): item is NonNullable<typeof item> => Boolean(item)).sort((a, b) => a.objective - b.objective)[0];
    if (refined && (!best || refined.objective < best.objective)) best = refined;
  }
  return best?.fit ?? null;
}

function contrast(fit: LmmFit, vector: number[], id: QuestionnaireLmmContrast['id'], label: string, interpretation: string): QuestionnaireLmmContrast {
  const estimate = dot(vector, fit.beta);
  const variance = quadratic(vector, fit.covariance);
  const se = variance > 0 ? Math.sqrt(variance) : Number.NaN;
  const z = Number.isFinite(se) && se > 0 ? estimate / se : Number.NaN;
  const p = Number.isFinite(z) ? 2 * (1 - normalCdf(Math.abs(z))) : Number.NaN;
  return {
    id,
    label,
    estimate: round6(estimate),
    se: round6(se),
    z: round6(z),
    p: round6(Math.max(0, Math.min(1, p))),
    ciLow: round6(estimate - 1.96 * se),
    ciHigh: round6(estimate + 1.96 * se),
    interpretation,
  };
}

function buildBlocks(observations: TrialObservation[], groupMode: boolean): SubjectBlock[] {
  const bySubject = new Map<string, TrialObservation[]>();
  for (const observation of observations) {
    const list = bySubject.get(observation.researchId) || [];
    list.push(observation);
    bySubject.set(observation.researchId, list);
  }
  return [...bySubject.entries()].map(([researchId, list]) => ({
    researchId,
    rows: list.map((observation) => {
      const mid = observation.wave === 'mid_pre_reveal' ? 1 : 0;
      const post = observation.wave === 'post_pre_exchange' ? 1 : 0;
      if (!groupMode) return { x: [1, mid, post], y: observation.value };
      const group = observation.condition === 'intervention' ? 1 : 0;
      return { x: [1, mid, post, group, mid * group, post * group], y: observation.value };
    }),
  }));
}

function participantCounts(observations: TrialObservation[]) {
  const wavesBySubject = new Map<string, Set<QuestionnaireWave>>();
  const conditionBySubject = new Map<string, 'intervention' | 'comparison'>();
  for (const observation of observations) {
    const set = wavesBySubject.get(observation.researchId) || new Set<QuestionnaireWave>();
    set.add(observation.wave);
    wavesBySubject.set(observation.researchId, set);
    conditionBySubject.set(observation.researchId, observation.condition);
  }
  const complete3 = [...wavesBySubject.values()].filter((set) => WAVES.every((wave) => set.has(wave))).length;
  const interventionParticipants = [...conditionBySubject.values()].filter((condition) => condition === 'intervention').length;
  const comparisonParticipants = [...conditionBySubject.values()].filter((condition) => condition === 'comparison').length;
  return { complete3, interventionParticipants, comparisonParticipants, nParticipants: wavesBySubject.size };
}

function emptyContrasts(groupMode: boolean): QuestionnaireLmmContrast[] {
  const suffix = groupMode ? 'の学校間変化差' : '（実践校内）';
  return [
    { id: 'pre_mid', label: `Pre→Mid${suffix}`, estimate: null, se: null, z: null, p: null, ciLow: null, ciHigh: null, interpretation: '推定できません' },
    { id: 'mid_post', label: `Mid→Post${suffix}`, estimate: null, se: null, z: null, p: null, ciLow: null, ciHigh: null, interpretation: '推定できません' },
    { id: 'pre_post', label: `Pre→Post${suffix}`, estimate: null, se: null, z: null, p: null, ciLow: null, ciHigh: null, interpretation: '推定できません' },
  ];
}

export function buildQuestionnaireLmmTrial(records: QuestionnaireRecord[], metric: QuestionnaireLmmMetric): QuestionnaireLmmTrialMetricResult {
  const observations = uniqueObservations(records, metric);
  const counts = participantCounts(observations);
  const groupMode = counts.interventionParticipants >= 2 && counts.comparisonParticipants >= 2;
  const mode: QuestionnaireLmmTrialMetricResult['mode'] = groupMode ? 'group_time' : 'intervention_time_only';
  const modelObservations = groupMode ? observations : observations.filter((observation) => observation.condition === 'intervention');
  const blocks = buildBlocks(modelObservations, groupMode);
  const parameterCount = groupMode ? 6 : 3;
  const nObservations = modelObservations.length;
  const minimumObservations = parameterCount + 4;

  if (nObservations < minimumObservations || blocks.length < 3) {
    return {
      metric,
      metricLabel: metric === 'l2wtc' ? 'L2 WTC' : '主体的に学習に取り組む態度',
      status: 'insufficient_data',
      mode,
      nParticipants: counts.nParticipants,
      nObservations,
      complete3: counts.complete3,
      interventionParticipants: counts.interventionParticipants,
      comparisonParticipants: counts.comparisonParticipants,
      randomInterceptVariance: null,
      residualVariance: null,
      contrasts: emptyContrasts(groupMode),
      note: groupMode
        ? '両校データはありますが、試験的LMMを安定して推定するには観測数が不足しています。'
        : '現在は実践校データのみのため、学校間の主要仮説はまだ検定しません。3時点データが蓄積すると実践校内の参考LMMを表示します。',
    };
  }

  const fit = fitRandomInterceptLmm(blocks, parameterCount);
  if (!fit) {
    return {
      metric,
      metricLabel: metric === 'l2wtc' ? 'L2 WTC' : '主体的に学習に取り組む態度',
      status: 'model_failed',
      mode,
      nParticipants: counts.nParticipants,
      nObservations,
      complete3: counts.complete3,
      interventionParticipants: counts.interventionParticipants,
      comparisonParticipants: counts.comparisonParticipants,
      randomInterceptVariance: null,
      residualVariance: null,
      contrasts: emptyContrasts(groupMode),
      note: '試験的LMMが収束しませんでした。通常の質問紙集計には影響しません。最終分析はR等で再検証してください。',
    };
  }

  const contrasts = groupMode
    ? [
        contrast(fit, [0, 0, 0, 0, 1, 0], 'pre_mid', 'Pre→Midの学校間変化差', '実践校と比較校のPre→Mid変化量の差'),
        contrast(fit, [0, 0, 0, 0, -1, 1], 'mid_post', 'Mid→Postの学校間変化差【主要】', '実践校と比較校のMid→Post変化量の差'),
        contrast(fit, [0, 0, 0, 0, 0, 1], 'pre_post', 'Pre→Postの学校間変化差', '実践校と比較校のPre→Post変化量の差'),
      ]
    : [
        contrast(fit, [0, 1, 0], 'pre_mid', 'Pre→Mid（実践校内・参考）', '実践校内のPre→Mid推定変化'),
        contrast(fit, [0, -1, 1], 'mid_post', 'Mid→Post（実践校内・参考）', '実践校内のMid→Post推定変化'),
        contrast(fit, [0, 0, 1], 'pre_post', 'Pre→Post（実践校内・参考）', '実践校内のPre→Post推定変化'),
      ];

  return {
    metric,
    metricLabel: metric === 'l2wtc' ? 'L2 WTC' : '主体的に学習に取り組む態度',
    status: 'ok',
    mode,
    nParticipants: counts.nParticipants,
    nObservations,
    complete3: counts.complete3,
    interventionParticipants: counts.interventionParticipants,
    comparisonParticipants: counts.comparisonParticipants,
    randomInterceptVariance: round6(fit.randomInterceptVariance),
    residualVariance: round6(fit.residualVariance),
    contrasts,
    note: groupMode
      ? 'ランダム切片LMMによるオンデマンド試験分析です。主要contrastはMid→Postの学校間変化差です。p値はWald z近似で、論文用最終分析ではR等で再検証します。'
      : '比較校データ未導入のため、実践校内の時期変化だけを参考表示しています。学校間の主要仮説は比較校データ導入後に表示します。p値はWald z近似で、論文用最終分析ではR等で再検証します。',
  };
}

export function buildQuestionnaireLmmTrialBundle(records: QuestionnaireRecord[]) {
  return {
    generatedAt: new Date().toISOString(),
    primary: buildQuestionnaireLmmTrial(records, 'l2wtc'),
    secondary: buildQuestionnaireLmmTrial(records, 'total'),
  };
}
