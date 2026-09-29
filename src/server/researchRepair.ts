export const REPAIR_SUBTYPES = ['self_initiated','response_to_trouble','third_position'] as const;
export const REPAIR_OUTCOMES = ['resolved','unresolved','unclear'] as const;
export const REPAIR_TECHNOLOGY_INVOLVEMENT = ['probable','possible','not_evident','unclear'] as const;

export type RepairSubtype = typeof REPAIR_SUBTYPES[number];
export type RepairOutcome = typeof REPAIR_OUTCOMES[number];
export type RepairTechnologyInvolvement = typeof REPAIR_TECHNOLOGY_INVOLVEMENT[number];

function stringValue(source: Record<string, any>, keys: string[]): string {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function allowed<T extends readonly string[]>(value: string, values: T): value is T[number] {
  return Boolean(value) && (values as readonly string[]).includes(value);
}

export function canonicalRepairAttributes(
  functionPrimary: string,
  source: Record<string, any>,
  strict = false,
) {
  const rawSubtype = stringValue(source, ['repairSubtype','repair_subtype','aiRepairSubtype','humanRepairSubtype']);
  const rawOutcome = stringValue(source, ['repairOutcome','repair_outcome','aiRepairOutcome','humanRepairOutcome']);
  const rawTechnology = stringValue(source, ['technologyInvolvement','technology_involvement','aiTechnologyInvolvement','humanTechnologyInvolvement']);
  const invalid: string[] = [];

  if (functionPrimary !== 'REP') {
    if (rawSubtype || rawOutcome || rawTechnology) invalid.push('REPAIR_ATTRIBUTES_WITHOUT_REP');
    if (strict && invalid.length) throw new Error(`RQ2_INVALID_REPAIR_ATTRIBUTE:${invalid.join(',')}`);
    return { repairSubtype: '', repairOutcome: '', technologyInvolvement: '', invalid };
  }

  if (!rawSubtype) invalid.push('REPAIR_SUBTYPE_REQUIRED');
  else if (!allowed(rawSubtype, REPAIR_SUBTYPES)) invalid.push(`REPAIR_SUBTYPE:${rawSubtype}`);
  if (!rawOutcome) invalid.push('REPAIR_OUTCOME_REQUIRED');
  else if (!allowed(rawOutcome, REPAIR_OUTCOMES)) invalid.push(`REPAIR_OUTCOME:${rawOutcome}`);
  if (!rawTechnology) invalid.push('TECHNOLOGY_INVOLVEMENT_REQUIRED');
  else if (!allowed(rawTechnology, REPAIR_TECHNOLOGY_INVOLVEMENT)) invalid.push(`TECHNOLOGY_INVOLVEMENT:${rawTechnology}`);

  if (strict && invalid.length) throw new Error(`RQ2_INVALID_REPAIR_ATTRIBUTE:${invalid.join(',')}`);
  return {
    repairSubtype: allowed(rawSubtype, REPAIR_SUBTYPES) ? rawSubtype : '',
    repairOutcome: allowed(rawOutcome, REPAIR_OUTCOMES) ? rawOutcome : '',
    technologyInvolvement: allowed(rawTechnology, REPAIR_TECHNOLOGY_INVOLVEMENT) ? rawTechnology : '',
    invalid,
  };
}

export interface RepairCandidateInput {
  sequenceId?: string;
  stratum?: string;
  researchId?: string;
  classId?: string;
  sessionId?: string;
  localDate?: string;
  childTurnSequence?: number;
  previousAiEnglish?: string;
  childEnglish?: string;
  nextAiEnglish?: string;
}

export function detectRepairCandidate(item: RepairCandidateInput) {
  const previousAi = String(item.previousAiEnglish || '').trim();
  const child = String(item.childEnglish || '').trim();
  const nextAi = String(item.nextAiEnglish || '').trim();
  const correctionCue = /^(?:no\b|no[,.!\s]+no\b)|\b(i mean|actually|sorry[,\s]+(?:i|my)|not\b)/i.test(child);
  const explicitSelfCorrection = /\b(i mean|actually|sorry[,\s]+(?:i|my))\b/i.test(child)
    || /\b\w+\b\s*[-—]\s*(?:sorry|no)[,\s]+\b\w+/i.test(child);
  const previousAiTrouble = /\b(i (?:do not|don't|didn't) understand|i'm not sure i understand|could you say|can you say that again|say that again|please repeat|what do you mean|did you mean|sorry[,! ]+(?:what|i didn't)|i couldn't hear)\b/i.test(previousAi);
  const previousAiQuestion = /\?\s*$/.test(previousAi);
  const thirdPosition = Boolean(previousAi) && correctionCue && !previousAiTrouble && !previousAiQuestion;
  const responseToTrouble = Boolean(previousAi) && previousAiTrouble && Boolean(child);
  const selfInitiated = explicitSelfCorrection && !responseToTrouble && !thirdPosition;
  const nameRepair = correctionCue && /\b(my name|i am|i'm)\b/i.test(child);
  const comprehensionRequest = /^(?:what\??|pardon\??|sorry\??)$/i.test(child)
    || /\b(one more time|say that again|please repeat|repeat please|i don't understand|i do not understand)\b/i.test(child);

  const candidateTypes: string[] = [];
  if (thirdPosition) candidateTypes.push('third_position');
  if (responseToTrouble) candidateTypes.push('response_to_trouble');
  if (selfInitiated) candidateTypes.push('self_initiated');
  if (nameRepair) candidateTypes.push('name_repair');
  if (comprehensionRequest) candidateTypes.push('comprehension_request');

  const suggestedRepairSubtype = thirdPosition ? 'third_position'
    : responseToTrouble ? 'response_to_trouble'
    : selfInitiated ? 'self_initiated'
    : '';
  const suggestedFunction = suggestedRepairSubtype ? 'REP' : comprehensionRequest ? 'COMP' : '';
  const evidence = [
    thirdPosition ? '児童の訂正手掛かり＋直前AIの非質問応答' : '',
    responseToTrouble ? '直前AIに理解困難・聞き返し表現' : '',
    selfInitiated ? '児童発話内に自己訂正表現' : '',
    nameRepair ? '名前表現を含む訂正候補' : '',
    comprehensionRequest ? '明示的な聞き返し・理解困難表現' : '',
  ].filter(Boolean).join(' / ');

  return {
    ...item,
    previousAiEnglish: previousAi,
    childEnglish: child,
    nextAiEnglish: nextAi,
    candidate: candidateTypes.length > 0,
    candidateTypes,
    suggestedFunction,
    suggestedRepairSubtype,
    evidence,
  };
}

export function buildRepairCandidateAudit(items: RepairCandidateInput[]) {
  const rows = items.map(detectRepairCandidate).filter((row) => row.candidate);
  const countType = (type: string) => rows.filter((row) => row.candidateTypes.includes(type)).length;
  const byStratum = [...new Set(items.map((row) => String(row.stratum || '')).filter(Boolean))].sort().map((stratum) => {
    const source = items.filter((row) => String(row.stratum || '') === stratum);
    const selected = rows.filter((row) => String(row.stratum || '') === stratum);
    return {
      stratum,
      totalSequences: source.length,
      candidateSequences: selected.length,
      thirdPositionCandidates: selected.filter((row) => row.candidateTypes.includes('third_position')).length,
      responseToTroubleCandidates: selected.filter((row) => row.candidateTypes.includes('response_to_trouble')).length,
      selfInitiatedCandidates: selected.filter((row) => row.candidateTypes.includes('self_initiated')).length,
      nameRepairCandidates: selected.filter((row) => row.candidateTypes.includes('name_repair')).length,
      comprehensionRequestCandidates: selected.filter((row) => row.candidateTypes.includes('comprehension_request')).length,
    };
  });
  return {
    auditVersion: 'rq2-repair-candidate-v1',
    generatedAt: new Date().toISOString(),
    mutatesData: false,
    rule: '候補抽出のみ。No等の表層形だけで正式REPと確定せず、AI候補＋人間確認で確定する。',
    totalSequences: items.length,
    candidateSequences: rows.length,
    thirdPositionCandidates: countType('third_position'),
    responseToTroubleCandidates: countType('response_to_trouble'),
    selfInitiatedCandidates: countType('self_initiated'),
    nameRepairCandidates: countType('name_repair'),
    comprehensionRequestCandidates: countType('comprehension_request'),
    byStratum,
    examples: rows.slice(0, 50),
    rows,
  };
}

function csvCell(value: unknown) {
  const raw = value === null || value === undefined ? '' : Array.isArray(value) ? value.join('|') : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function serializeRepairCandidatesCsv(items: RepairCandidateInput[]) {
  const audit = buildRepairCandidateAudit(items);
  const headers = ['sequence_id','stratum','research_id','class_id','session_id','local_date','child_turn_sequence','previous_ai_english','child_english','next_ai_english','candidate_types','suggested_function','suggested_repair_subtype','evidence'];
  const lines = audit.rows.map((row: any) => ({
    sequence_id: row.sequenceId || '', stratum: row.stratum || '', research_id: row.researchId || '', class_id: row.classId || '', session_id: row.sessionId || '', local_date: row.localDate || '', child_turn_sequence: row.childTurnSequence || '',
    previous_ai_english: row.previousAiEnglish || '', child_english: row.childEnglish || '', next_ai_english: row.nextAiEnglish || '', candidate_types: row.candidateTypes || [], suggested_function: row.suggestedFunction || '', suggested_repair_subtype: row.suggestedRepairSubtype || '', evidence: row.evidence || '',
  }));
  return '\uFEFF' + [headers.map(csvCell).join(','), ...lines.map((row) => headers.map((header) => csvCell((row as any)[header])).join(','))].join('\n');
}
