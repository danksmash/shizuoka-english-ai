import crypto from 'node:crypto';

export const RQ1_COMPARISON_ALLOCATION_METHOD = 'grade_stratified_distribution_matched_random';
export const RQ1_COMPARISON_ALLOCATION_ALGORITHM_VERSION = 'rq1-comparison-allocation-2026-v1';

export interface Rq1AllocationParticipant {
  researchId: string;
  siteId: string;
  schoolCondition: 'intervention' | 'comparison';
  classId: string;
  gradeLevel: 5 | 6 | '';
  assignedPartnerCountry: string;
}

export interface Rq1ComparisonAllocationAssignment {
  researchId: string;
  gradeLevel: 5 | 6;
  targetCountry: string;
}

export interface Rq1ComparisonAllocationGradeSummary {
  gradeLevel: 5 | 6;
  interventionN: number;
  comparisonN: number;
  interventionCountryCounts: Record<string, number>;
  comparisonTargetCounts: Record<string, number>;
}

export interface Rq1ComparisonAllocationPlan {
  method: typeof RQ1_COMPARISON_ALLOCATION_METHOD;
  algorithmVersion: typeof RQ1_COMPARISON_ALLOCATION_ALGORITHM_VERSION;
  seed: string;
  inputHash: string;
  assignments: Rq1ComparisonAllocationAssignment[];
  gradeSummaries: Rq1ComparisonAllocationGradeSummary[];
}

function hashText(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function buildRq1AllocationInputHash(participants: Rq1AllocationParticipant[]) {
  const payload = participants
    .map((row) => [
      row.researchId,
      row.siteId,
      row.schoolCondition,
      row.classId,
      row.gradeLevel,
      row.schoolCondition === 'intervention' ? row.assignedPartnerCountry : '',
    ].join('|'))
    .sort()
    .join('\n');
  return payload ? hashText(payload) : '';
}

function proportionalTargetCounts(sourceCounts: Map<string, number>, targetN: number) {
  const sourceN = Array.from(sourceCounts.values()).reduce((sum, value) => sum + value, 0);
  if (sourceN < 1) throw new Error('RQ1_MATCHING_INTERVENTION_GRADE_REQUIRED');
  const countries = Array.from(sourceCounts.keys()).sort((a, b) => a.localeCompare(b, 'en'));
  const rows = countries.map((country) => {
    const sourceCount = sourceCounts.get(country) || 0;
    const exact = sourceCount / sourceN * targetN;
    const base = Math.floor(exact);
    return { country, sourceCount, exact, base, remainder: exact - base };
  });
  let remaining = targetN - rows.reduce((sum, row) => sum + row.base, 0);
  rows
    .slice()
    .sort((a, b) => b.remainder - a.remainder || a.country.localeCompare(b.country, 'en'))
    .forEach((row) => {
      if (remaining <= 0) return;
      row.base += 1;
      remaining -= 1;
    });
  return new Map(rows.map((row) => [row.country, row.base]));
}

function deterministicParticipantOrder(seed: string, grade: number, researchIds: string[]) {
  return researchIds.slice().sort((a, b) => {
    const ha = hashText(`${seed}|grade:${grade}|participant:${a}`);
    const hb = hashText(`${seed}|grade:${grade}|participant:${b}`);
    return ha.localeCompare(hb) || a.localeCompare(b);
  });
}

export function buildRq1ComparisonAllocationPlan(
  participants: Rq1AllocationParticipant[],
  seed: string,
): Rq1ComparisonAllocationPlan {
  const cleanSeed = String(seed || '').trim();
  if (!cleanSeed) throw new Error('RQ1_ALLOCATION_SEED_REQUIRED');
  const intervention = participants.filter((row) => row.schoolCondition === 'intervention');
  const comparison = participants.filter((row) => row.schoolCondition === 'comparison');
  if (!intervention.length) throw new Error('RQ1_INTERVENTION_PARTICIPANTS_REQUIRED');
  if (!comparison.length) throw new Error('RQ1_COMPARISON_PARTICIPANTS_REQUIRED');
  if (intervention.some((row) => !row.assignedPartnerCountry)) throw new Error('RQ1_INTERVENTION_ASSIGNMENTS_INCOMPLETE');
  if (comparison.some((row) => row.gradeLevel !== 5 && row.gradeLevel !== 6)) throw new Error('RQ1_COMPARISON_GRADE_REQUIRED');

  const assignments: Rq1ComparisonAllocationAssignment[] = [];
  const gradeSummaries: Rq1ComparisonAllocationGradeSummary[] = [];
  const comparisonGrades = Array.from(new Set(comparison.map((row) => row.gradeLevel))).sort() as Array<5 | 6>;

  for (const grade of comparisonGrades) {
    const interventionGrade = intervention.filter((row) => row.gradeLevel === grade);
    const comparisonGrade = comparison.filter((row) => row.gradeLevel === grade);
    if (!interventionGrade.length) throw new Error('RQ1_MATCHING_INTERVENTION_GRADE_REQUIRED');

    const sourceCounts = new Map<string, number>();
    for (const row of interventionGrade) {
      sourceCounts.set(row.assignedPartnerCountry, (sourceCounts.get(row.assignedPartnerCountry) || 0) + 1);
    }
    const targetCounts = proportionalTargetCounts(sourceCounts, comparisonGrade.length);
    const slots = Array.from(targetCounts.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'en'))
      .flatMap(([country, count]) => Array.from({ length: count }, () => country));
    const orderedIds = deterministicParticipantOrder(cleanSeed, grade, comparisonGrade.map((row) => row.researchId));
    if (slots.length !== orderedIds.length) throw new Error('RQ1_ALLOCATION_SIZE_MISMATCH');
    orderedIds.forEach((researchId, index) => assignments.push({ researchId, gradeLevel: grade, targetCountry: slots[index] }));

    gradeSummaries.push({
      gradeLevel: grade,
      interventionN: interventionGrade.length,
      comparisonN: comparisonGrade.length,
      interventionCountryCounts: Object.fromEntries(Array.from(sourceCounts.entries()).sort(([a], [b]) => a.localeCompare(b, 'en'))),
      comparisonTargetCounts: Object.fromEntries(Array.from(targetCounts.entries()).sort(([a], [b]) => a.localeCompare(b, 'en'))),
    });
  }

  return {
    method: RQ1_COMPARISON_ALLOCATION_METHOD,
    algorithmVersion: RQ1_COMPARISON_ALLOCATION_ALGORITHM_VERSION,
    seed: cleanSeed,
    inputHash: buildRq1AllocationInputHash(participants),
    assignments: assignments.sort((a, b) => a.gradeLevel - b.gradeLevel || a.researchId.localeCompare(b.researchId)),
    gradeSummaries,
  };
}
