import type { PersonaChoiceReasonRecord } from './personaChoiceReasonAnalysis';

export const PERSONA_CHOICE_REASON_EXPORT_HEADERS = [
  'research_id', 'site_id', 'school_condition', 'class_id', 'grade_level',
  'data_scope', 'survey_date', 'submitted_at', 'instrument_version',
  'initial_reasons', 'final_reasons', 'comment', 'data_quality_flag',
  'analysis_status', 'response_id',
] as const;

export type PersonaChoiceReasonExportRow =
  Record<(typeof PERSONA_CHOICE_REASON_EXPORT_HEADERS)[number], string | number>;

function valid(record: PersonaChoiceReasonRecord): boolean {
  return Boolean(
    record.researchId && record.classId && record.dataScope === 'main'
    && record.dataQualityFlag === 'complete'
    && record.initialReasons.length > 0 && record.finalReasons.length > 0,
  );
}

function filtered(records: PersonaChoiceReasonRecord[], query: Record<string, unknown>): PersonaChoiceReasonRecord[] {
  const condition = String(query.schoolCondition || 'all');
  const grade = String(query.grade || 'all');
  const classId = String(query.classId || 'all');
  return records.filter((r) =>
    r.dataScope === 'main'
    && (condition === 'all' || r.schoolCondition === condition)
    && (grade === 'all' || String(r.gradeLevel) === grade)
    && (classId === 'all' || r.classId === classId),
  );
}

export function buildPersonaChoiceReasonExportRows(
  records: PersonaChoiceReasonRecord[],
  query: Record<string, unknown> = {},
): PersonaChoiceReasonExportRow[] {
  // Determine duplicate status before applying class/grade filters, so filtering
  // never turns a duplicate respondent into an apparently unique response.
  const validCounts = new Map<string, number>();
  for (const record of records) {
    if (!valid(record)) continue;
    validCounts.set(record.researchId, (validCounts.get(record.researchId) || 0) + 1);
  }
  return filtered(records, query)
    .map((record) => ({
      research_id: record.researchId,
      site_id: record.siteId || (record.schoolCondition === 'comparison' ? 'site_b' : 'site_a'),
      school_condition: record.schoolCondition,
      class_id: record.classId,
      grade_level: record.gradeLevel,
      data_scope: record.dataScope,
      survey_date: record.surveyDate,
      submitted_at: record.submittedAt,
      instrument_version: record.instrumentVersion || 'persona-choice-reasons-20261103-v1',
      initial_reasons: JSON.stringify(record.initialReasons),
      final_reasons: JSON.stringify(record.finalReasons),
      comment: record.comment,
      data_quality_flag: record.dataQualityFlag,
      analysis_status: !valid(record) ? 'invalid_or_incomplete'
        : (validCounts.get(record.researchId) || 0) > 1 ? 'duplicate_research_id'
          : 'valid_unique',
      response_id: record.responseId || '',
    }))
    .sort((a, b) => a.research_id.localeCompare(b.research_id)
      || a.submitted_at.localeCompare(b.submitted_at) || a.response_id.localeCompare(b.response_id));
}

function csvCell(value: string | number): string {
  const text = String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const sanitized = /^\s*[=+\-@]/.test(text) ? "'" + text : text;
  return '"' + sanitized.replace(/"/g, '""') + '"';
}

export function serializePersonaChoiceReasonCsv(rows: PersonaChoiceReasonExportRow[]): string {
  const headers: readonly string[] = PERSONA_CHOICE_REASON_EXPORT_HEADERS;
  return '\uFEFF' + [
    headers.map(csvCell).join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header as keyof PersonaChoiceReasonExportRow])).join(',')),
  ].join('\r\n') + '\r\n';
}

export function buildPersonaChoiceReasonCodebookRows(): Record<string, unknown>[] {
  const definitions: Record<string, string> = {
    research_id: 'AI対話・RQ1・既存質問紙と結合する匿名研究ID',
    site_id: '匿名実施校ID。実際の学校名は含めない',
    school_condition: '実践校 intervention または比較校 comparison',
    class_id: '匿名化した学級ID',
    grade_level: '学年',
    data_scope: '正式研究データ区分',
    survey_date: '回答日（日本時間）',
    submitted_at: 'Googleフォームの回答日時（UTC正規化）',
    instrument_version: '質問紙項目構成のバージョン',
    initial_reasons: '児童が回顧的に回答した「初めの頃」の選択理由。JSON配列',
    final_reasons: '児童が回顧的に回答した「最後の方」の選択理由。JSON配列',
    comment: '自由記述。個人特定情報が含まれ得るため共有前に研究者確認が必要',
    data_quality_flag: '取込時の回答品質',
    analysis_status: 'valid_uniqueのみ記述集計に使用。重複は研究者確認まで除外',
    response_id: 'フォーム回答IDから生成した一意の匿名化回答ID',
  };
  return PERSONA_CHOICE_REASON_EXPORT_HEADERS.map((variable) => ({
    file_name: 'persona_choice_reason_responses.csv',
    variable,
    definition: definitions[variable],
    data_type: variable === 'grade_level' ? 'number' : 'string',
    allowed_values: variable === 'analysis_status'
      ? 'valid_unique | duplicate_research_id | invalid_or_incomplete'
      : variable === 'school_condition'
        ? 'intervention | comparison'
        : variable === 'data_scope' ? 'main' : '',
    analysis_use: '回答は事後の回顧でありPhase別の実測ではない。research_idでRQ1選択行動へ結合し探索的に解釈する',
  }));
}
