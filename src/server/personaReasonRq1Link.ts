import type { PersonaChoiceReasonRecord } from './personaChoiceReasonAnalysis';
import { buildPersonaChoiceReasonExportRows } from './personaChoiceReasonExport';

export const PERSONA_REASON_RQ1_LINK_HEADERS = [
  'research_id', 'school_condition', 'class_id',
  'initial_reasons', 'final_reasons',
  'period1_visitor_n', 'period1_visitor_rate',
  'period2_visitor_n', 'period2_visitor_rate',
  'visitor_rate_change_p2_minus_p1',
  'period2_assigned_n', 'period2_assigned_rate',
  'period3_assigned_n', 'period3_assigned_rate',
  'assigned_rate_change_p3_minus_p2',
  'rq1_join_status',
] as const;

type Rq1Row = Record<string, unknown>;
export type PersonaReasonRq1LinkRow =
  Record<(typeof PERSONA_REASON_RQ1_LINK_HEADERS)[number], string | number>;

function rate(value: unknown, denominator: unknown): number | '' {
  const d = Number(denominator);
  if (!(d > 0) || value === null || value === undefined || value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : '';
}
function rateDiff(after: number | '', before: number | ''): number | '' {
  return after === '' || before === '' ? '' : Number((after - before).toFixed(6));
}
function count(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function buildPersonaReasonRq1LinkRows(
  responses: PersonaChoiceReasonRecord[],
  periodRows: Rq1Row[],
): PersonaReasonRq1LinkRow[] {
  const index = new Map<string, Map<string, Rq1Row>>();
  for (const periodRow of periodRows) {
    const researchId = String(periodRow.research_id || '');
    const period = String(periodRow.analysis_period || '');
    if (!researchId || !['period1', 'period2', 'period3'].includes(period)) continue;
    const group = index.get(researchId) || new Map<string, Rq1Row>();
    // Repeated period summaries are ambiguous: fail closed and display a mismatch.
    if (group.has(period)) group.set(period, { _duplicate: true });
    else group.set(period, periodRow);
    index.set(researchId, group);
  }

  return buildPersonaChoiceReasonExportRows(responses)
    .filter((response) => response.analysis_status === 'valid_unique')
    .map((response) => {
      const periods = index.get(String(response.research_id));
      const p1 = periods?.get('period1');
      const p2 = periods?.get('period2');
      const p3 = periods?.get('period3');
      const periodRows = [p1, p2, p3].filter((item): item is Rq1Row => Boolean(item));
      const mismatch = periodRows.some((row) => row._duplicate
        || String(row.class_id || '') !== response.class_id
        || String(row.school_condition || '') !== response.school_condition);
      const p1VisitorN = count(p1?.visitor_choice_denominator);
      const p2VisitorN = count(p2?.visitor_choice_denominator);
      const p2AssignedN = count(p2?.assigned_choice_denominator);
      const p3AssignedN = count(p3?.assigned_choice_denominator);
      const p1Visitor = mismatch ? '' as const : rate(p1?.visitor_selection_rate, p1VisitorN);
      const p2Visitor = mismatch ? '' as const : rate(p2?.visitor_selection_rate, p2VisitorN);
      const p2Assigned = mismatch ? '' as const : rate(p2?.assigned_selection_rate, p2AssignedN);
      const p3Assigned = mismatch ? '' as const : rate(p3?.assigned_selection_rate, p3AssignedN);
      const complete = p1Visitor !== '' && p2Visitor !== '' && p2Assigned !== '' && p3Assigned !== '';
      const joinStatus = mismatch ? 'mismatch_or_duplicate_period'
        : !periods ? 'rq1_not_found'
          : complete ? 'complete' : 'partial_periods';
      return {
        research_id: response.research_id,
        school_condition: response.school_condition,
        class_id: response.class_id,
        initial_reasons: response.initial_reasons,
        final_reasons: response.final_reasons,
        period1_visitor_n: mismatch ? '' : p1VisitorN,
        period1_visitor_rate: p1Visitor,
        period2_visitor_n: mismatch ? '' : p2VisitorN,
        period2_visitor_rate: p2Visitor,
        visitor_rate_change_p2_minus_p1: mismatch ? '' : rateDiff(p2Visitor, p1Visitor),
        period2_assigned_n: mismatch ? '' : p2AssignedN,
        period2_assigned_rate: p2Assigned,
        period3_assigned_n: mismatch ? '' : p3AssignedN,
        period3_assigned_rate: p3Assigned,
        assigned_rate_change_p3_minus_p2: mismatch ? '' : rateDiff(p3Assigned, p2Assigned),
        rq1_join_status: joinStatus,
      };
    }).sort((a, b) => a.class_id.localeCompare(b.class_id, 'ja') || a.research_id.localeCompare(b.research_id));
}
