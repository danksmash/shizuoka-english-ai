import type { QuestionnaireRecord, QuestionnaireWave } from './questionnaireResearch';

export type QuestionnaireDescriptiveMetricKey = 'attitude' | 'persistence' | 'self_regulation' | 'l2wtc';

export interface QuestionnaireDescriptiveMetricSummary {
  mean: number | null;
  sd: number | null;
}

export interface QuestionnaireDescriptiveWaveSummary {
  n: number;
  attitude: QuestionnaireDescriptiveMetricSummary;
  persistence: QuestionnaireDescriptiveMetricSummary;
  self_regulation: QuestionnaireDescriptiveMetricSummary;
  l2wtc: QuestionnaireDescriptiveMetricSummary;
}

export interface QuestionnaireDescriptiveRow {
  groupId: string;
  groupLabel: string;
  pre: QuestionnaireDescriptiveWaveSummary;
  mid: QuestionnaireDescriptiveWaveSummary;
  post: QuestionnaireDescriptiveWaveSummary;
}

type QuestionnaireDescriptiveGroup = {
  id: string;
  label: string;
  match: (record: QuestionnaireRecord) => boolean;
};

function conditionLabel(condition: QuestionnaireRecord['schoolCondition']): string {
  return condition === 'comparison' ? '比較校' : '実践校';
}

function recordCondition(record: QuestionnaireRecord): 'intervention' | 'comparison' {
  return record.schoolCondition === 'comparison' ? 'comparison' : 'intervention';
}

function groupsForRecords(records: QuestionnaireRecord[]): QuestionnaireDescriptiveGroup[] {
  const conditions = (['intervention', 'comparison'] as const).filter((condition) => records.some((record) => recordCondition(record) === condition));
  const hasComparison = conditions.includes('comparison');
  const groups: QuestionnaireDescriptiveGroup[] = [];

  if (!hasComparison) {
    const classIds = [...new Set(records.map((record) => record.classId).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja'));
    for (const classId of classIds) groups.push({ id: classId, label: classId, match: (record) => record.classId === classId });
    if (records.some((record) => record.gradeLevel === 5)) groups.push({ id: 'grade5', label: '5年', match: (record) => record.gradeLevel === 5 });
    if (records.some((record) => record.gradeLevel === 6)) groups.push({ id: 'grade6', label: '6年', match: (record) => record.gradeLevel === 6 });
    groups.push({ id: 'all', label: '全体', match: () => true });
    return groups;
  }

  for (const condition of conditions) {
    const prefix = conditionLabel(condition);
    const conditionRecords = records.filter((record) => recordCondition(record) === condition);
    const classIds = [...new Set(conditionRecords.map((record) => record.classId).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja'));
    for (const classId of classIds) {
      groups.push({
        id: `${condition}:${classId}`,
        label: `${prefix} ${classId}`,
        match: (record) => recordCondition(record) === condition && record.classId === classId,
      });
    }
    for (const grade of [5, 6] as const) {
      if (!conditionRecords.some((record) => record.gradeLevel === grade)) continue;
      groups.push({
        id: `${condition}:grade${grade}`,
        label: `${prefix} ${grade}年`,
        match: (record) => recordCondition(record) === condition && record.gradeLevel === grade,
      });
    }
    groups.push({
      id: `${condition}:all`,
      label: `${prefix} 全体`,
      match: (record) => recordCondition(record) === condition,
    });
  }
  groups.push({ id: 'all', label: '両校 全体', match: () => true });
  return groups;
}

const METRICS: Array<{
  key: QuestionnaireDescriptiveMetricKey;
  value: (record: QuestionnaireRecord) => number;
}> = [
  { key: 'attitude', value: (r) => r.attitudeMean },
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
    attitude: { mean: null, sd: null },
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
  const rows: QuestionnaireDescriptiveRow[] = groupsForRecords(records).map((group) => {
    const subset = records.filter(group.match);
    return {
      groupId: group.id,
      groupLabel: group.label,
      pre: summarizeWave(subset, 'pre_app'),
      mid: summarizeWave(subset, 'mid_pre_reveal'),
      post: summarizeWave(subset, 'post_pre_exchange'),
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
      waveOrder: ['pre_app', 'mid_pre_reveal', 'post_pre_exchange'],
    },
    rows,
  };
}
