import { listCollectionFields } from './firestore';
import { PERSONA_CHOICE_REASONS_COLLECTION } from './questionnaireAutoSync';

export interface PersonaChoiceReasonRecord {
  researchId: string;
  classId: string;
  gradeLevel: number;
  schoolCondition: string;
  dataScope: string;
  surveyDate: string;
  submittedAt: string;
  initialReasons: string[];
  finalReasons: string[];
  comment: string;
  dataQualityFlag: string;
}

export interface PersonaChoiceReasonRow {
  reason: string;
  initialCount: number;
  finalCount: number;
  addedCount: number;
  removedCount: number;
  continuedCount: number;
  initialPercent: number;
  finalPercent: number;
}

export interface PersonaChoiceReasonGroup {
  groupId: string;
  label: string;
  n: number;
  reasons: PersonaChoiceReasonRow[];
}

export interface PersonaChoiceReasonAnalysis {
  counts: {
    storedRecords: number;
    validUniqueRespondents: number;
    invalidRecords: number;
    duplicateRespondents: number;
    duplicateRecordsExcluded: number;
  };
  groups: PersonaChoiceReasonGroup[];
  comments: Array<{ researchId: string; classId: string; comment: string }>;
  note: string;
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((v) => String(v ?? '').trim()).filter(Boolean))];
}

function normalize(raw: Record<string, unknown>): PersonaChoiceReasonRecord {
  return {
    researchId: String(raw.researchId ?? '').trim(),
    classId: String(raw.classId ?? '').trim(),
    gradeLevel: Number(raw.gradeLevel || 0),
    schoolCondition: String(raw.schoolCondition || 'intervention'),
    dataScope: String(raw.dataScope || ''),
    surveyDate: String(raw.surveyDate || ''),
    submittedAt: String(raw.submittedAt || ''),
    initialReasons: strings(raw.initialReasons),
    finalReasons: strings(raw.finalReasons),
    comment: String(raw.comment || ''),
    dataQualityFlag: String(raw.dataQualityFlag || ''),
  };
}

export async function getPersonaChoiceReasonRecords(): Promise<PersonaChoiceReasonRecord[]> {
  const fields = [
    'researchId', 'classId', 'gradeLevel', 'schoolCondition', 'dataScope',
    'surveyDate', 'submittedAt', 'initialReasons', 'finalReasons', 'comment', 'dataQualityFlag',
  ];
  const records = await listCollectionFields(PERSONA_CHOICE_REASONS_COLLECTION, fields);
  return records.map(normalize);
}

export function buildPersonaChoiceReasonAnalysis(records: PersonaChoiceReasonRecord[]): PersonaChoiceReasonAnalysis {
  // All calculations are learner-level: multiple submissions by the same learner
  // are retained in storage but excluded until a researcher reviews them.
  const usable: PersonaChoiceReasonRecord[] = [];
  const byResearchId = new Map<string, PersonaChoiceReasonRecord[]>();
  let invalidRecords = 0;

  for (const record of records) {
    if (
      !record.researchId ||
      !record.classId ||
      record.dataScope !== 'main' ||
      record.dataQualityFlag !== 'complete' ||
      record.initialReasons.length === 0 ||
      record.finalReasons.length === 0
    ) {
      invalidRecords += 1;
      continue;
    }
    const group = byResearchId.get(record.researchId) || [];
    group.push(record);
    byResearchId.set(record.researchId, group);
  }

  let duplicateRespondents = 0;
  let duplicateRecordsExcluded = 0;
  for (const group of byResearchId.values()) {
    if (group.length !== 1) {
      duplicateRespondents += 1;
      duplicateRecordsExcluded += group.length;
    } else {
      usable.push(group[0]);
    }
  }

  function grouped(groupId: string, label: string, subset: PersonaChoiceReasonRecord[]): PersonaChoiceReasonGroup {
    const summary = new Map<string, { initialCount: number; finalCount: number; addedCount: number; removedCount: number; continuedCount: number }>();
    for (const record of subset) {
      const before = new Set(record.initialReasons);
      const after = new Set(record.finalReasons);
      for (const reason of new Set([...before, ...after])) {
        const counts = summary.get(reason) || {
          initialCount: 0, finalCount: 0, addedCount: 0, removedCount: 0, continuedCount: 0,
        };
        if (before.has(reason)) counts.initialCount += 1;
        if (after.has(reason)) counts.finalCount += 1;
        if (!before.has(reason) && after.has(reason)) counts.addedCount += 1;
        if (before.has(reason) && !after.has(reason)) counts.removedCount += 1;
        if (before.has(reason) && after.has(reason)) counts.continuedCount += 1;
        summary.set(reason, counts);
      }
    }
    const n = subset.length;
    const reasons = [...summary.entries()].map(([reason, counts]) => ({
      reason,
      ...counts,
      initialPercent: n ? Number((counts.initialCount * 100 / n).toFixed(1)) : 0,
      finalPercent: n ? Number((counts.finalCount * 100 / n).toFixed(1)) : 0,
    })).sort((a, b) => b.finalCount - a.finalCount || b.initialCount - a.initialCount || a.reason.localeCompare(b.reason, 'ja'));
    return { groupId, label, n, reasons };
  }

  const groups: PersonaChoiceReasonGroup[] = [grouped('all', '全体', usable)];
  for (const condition of ['intervention', 'comparison']) {
    const conditionRows = usable.filter((r) => r.schoolCondition === condition);
    if (!conditionRows.length) continue;
    const prefix = condition === 'comparison' ? '比較校' : '実践校';
    groups.push(grouped(condition, prefix + ' 全体', conditionRows));
    for (const grade of [5, 6]) {
      const subset = conditionRows.filter((r) => r.gradeLevel === grade);
      if (subset.length) groups.push(grouped(condition + ':grade' + grade, prefix + ' ' + grade + '年', subset));
    }
    for (const classId of [...new Set(conditionRows.map((r) => r.classId))].sort((a, b) => a.localeCompare(b, 'ja'))) {
      groups.push(grouped(condition + ':' + classId, prefix + ' ' + classId, conditionRows.filter((r) => r.classId === classId)));
    }
  }

  const comments = usable.filter((r) => r.comment.trim()).map((r) => ({
    researchId: r.researchId,
    classId: r.classId,
    comment: r.comment.slice(0, 1000),
  })).sort((a, b) => a.classId.localeCompare(b.classId, 'ja') || a.researchId.localeCompare(b.researchId));

  return {
    counts: {
      storedRecords: records.length,
      validUniqueRespondents: usable.length,
      invalidRecords,
      duplicateRespondents,
      duplicateRecordsExcluded,
    },
    groups,
    comments,
    note: '同じ児童の複数回答はすべて集計から除外し、研究者確認の対象とします。回顧的質問紙であり、Phase別の実測質問紙ではありません。複数選択の割合は各群の有効回答児童数を分母とし、合計100%にはなりません。',
  };
}
