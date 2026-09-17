import type { QuestionnaireRecord, QuestionnaireWave } from './questionnaireResearch';

export type QuestionnaireDescriptiveMetricKey = 'total' | 'persistence' | 'self_regulation' | 'l2wtc';

export interface QuestionnaireDescriptiveMetricSummary {
  mean: number | null;
  sd: number | null;
}

export interface QuestionnaireDescriptiveWaveSummary {
  n: number;
  total: QuestionnaireDescriptiveMetricSummary;
  persistence: QuestionnaireDescriptiveMetricSummary;
  self_regulation: QuestionnaireDescriptiveMetricSummary;
  l2wtc: QuestionnaireDescriptiveMetricSummary;
}

export interface QuestionnaireDescriptiveRow {
  groupId: string;
  groupLabel: string;
  pre: QuestionnaireDescriptiveWaveSummary;
  post: QuestionnaireDescriptiveWaveSummary;
}

const GROUPS = [
  { id: '5-1', label: '5-1', match: (r: QuestionnaireRecord) => r.classId === '5-1' },
  { id: '5-2', label: '5-2', match: (r: QuestionnaireRecord) => r.classId === '5-2' },
  { id: '5-3', label: '5-3', match: (r: QuestionnaireRecord) => r.classId === '5-3' },
  { id: '6-1', label: '6-1', match: (r: QuestionnaireRecord) => r.classId === '6-1' },
  { id: '6-2', label: '6-2', match: (r: QuestionnaireRecord) => r.classId === '6-2' },
  { id: 'grade5', label: '5年', match: (r: QuestionnaireRecord) => r.gradeLevel === 5 },
  { id: 'grade6', label: '6年', match: (r: QuestionnaireRecord) => r.gradeLevel === 6 },
  { id: 'all', label: '全体', match: (_r: QuestionnaireRecord) => true },
] as const;

const METRICS: Array<{
  key: QuestionnaireDescriptiveMetricKey;
  value: (record: QuestionnaireRecord) => number;
}> = [
  { key: 'total', value: (r) => r.totalMean },
  { key: 'persistence', value: (r) => r.persistenceMean },
  { key: 'self_regulation', value: (r) => r.selfRegulationMean },
  { key: 'l2wtc', value: (r) => r.l2wtcMean },
];

function round6(value: number): number | null {
  return Number.isFinite(value) ? Number(value.toFixed(6)) : null;
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return round6(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function sampleSd(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1);
  return round6(Math.sqrt(variance));
}

function uniqueWaveRecords(records: QuestionnaireRecord[], wave: QuestionnaireWave): QuestionnaireRecord[] {
  const grouped = new Map<string, QuestionnaireRecord[]>();
  for (const record of records) {
    if (record.surveyWave !== wave) continue;
    const list = grouped.get(record.researchId) || [];
    list.push(record);
    grouped.set(record.researchId, list);
  }
  return [...grouped.values()].filter((list) => list.length === 1).map((list) => list[0]);
}

function summarizeWave(records: QuestionnaireRecord[], wave: QuestionnaireWave): QuestionnaireDescriptiveWaveSummary {
  const unique = uniqueWaveRecords(records, wave);
  const summary: QuestionnaireDescriptiveWaveSummary = {
    n: unique.length,
    total: { mean: null, sd: null },
    persistence: { mean: null, sd: null },
    self_regulation: { mean: null, sd: null },
    l2wtc: { mean: null, sd: null },
  };
  for (const metric of METRICS) {
    const values = unique.map(metric.value).filter((value) => Number.isFinite(value));
    summary[metric.key] = { mean: mean(values), sd: sampleSd(values) };
  }
  return summary;
}

export function buildQuestionnaireDescriptiveStatistics(records: QuestionnaireRecord[]) {
  const rows: QuestionnaireDescriptiveRow[] = GROUPS.map((group) => {
    const subset = records.filter(group.match);
    return {
      groupId: group.id,
      groupLabel: group.label,
      pre: summarizeWave(subset, 'pre_app'),
      post: summarizeWave(subset, 'post_exchange'),
    };
  });

  return {
    calculation: {
      basis: 'all_unique_valid_responses_at_each_wave',
      duplicateRule: 'exclude_research_id_when_multiple_records_exist_in_the_same_wave',
      absenceRule: 'show_current_N_mean_SD_from_available_valid_responses; late responses update automatically',
      sdRule: 'sample_sd; unavailable_for_N_less_than_2',
      scaleMinimum: 1,
      scaleMaximum: 6,
    },
    rows,
  };
}
