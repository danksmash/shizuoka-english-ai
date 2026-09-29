from pathlib import Path
import re

ROOT = Path('.')

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def write(path, text):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding='utf-8')

def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected 1 occurrence, found {count}: {old[:120]!r}')
    write(path, text.replace(old, new, 1))

def regex_once(path, pattern, replacement, flags=0):
    text = read(path)
    new_text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f'{path}: regex expected 1 occurrence, found {count}: {pattern}')
    write(path, new_text)

repair_module = r'''export const REPAIR_SUBTYPES = ['self_initiated','response_to_trouble','third_position'] as const;
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
'''
write('src/server/researchRepair.ts', repair_module)

# Codebook schema v5 + repair taxonomy
replace_once('src/server/researchRq2Codebook.ts', "export const RQ2_CODEBOOK_SCHEMA_VERSION = 4;", "export const RQ2_CODEBOOK_SCHEMA_VERSION = 5;")
replace_once('src/server/researchRq2Codebook.ts', "version: 'literature-v1-2026-09-22',", "version: 'literature-v2-2026-09-29',")
replace_once('src/server/researchRq2Codebook.ts', "title: 'RQ2 文献根拠型コードブック v1',", "title: 'RQ2 文献根拠型コードブック v2',")
replace_once('src/server/researchRq2Codebook.ts',
"  functionBoundaryRule: 'ACKは傾聴・反応の表示、RESは質問への直接応答や自己開示、Qは相手の直前内容に依存しない情報要求、TOPは相手が提示した内容を受けた関連質問・関連コメント・話題の深掘り、COMPは理解を確認・要求・交渉する行動、REPは理解上の問題を解消するために自分の発話を訂正・反復・言い換える行動とする。',\n",
"  functionBoundaryRule: 'ACKは傾聴・反応の表示、RESは質問への直接応答や自己開示、Qは相手の直前内容に依存しない情報要求、TOPは相手が提示した内容を受けた関連質問・関連コメント・話題の深掘り、COMPは理解を確認・要求・交渉する行動、REPは理解上の問題を解消するために自分の発話を訂正・反復・言い換える行動とする。',\n  repairTaxonomy: {\n    rule: '対話機能の主コードがREPの場合のみ付与する補助属性。旧childRepairCountとは別物で、正式REPは局所系列をAI候補＋人間確認で判定する。',\n    subtypes: [\n      { code: 'self_initiated', label: '自己開始修復', definition: '相手から明示的な修復要求が出る前に、児童が自分の発話を自発的に訂正・言い換える。' },\n      { code: 'response_to_trouble', label: '相手の理解困難への応答', definition: 'AIの聞き返し・理解困難表明・確認要求を受け、児童が自分の発話を修正する。' },\n      { code: 'third_position', label: 'AIの誤理解への第三位置修復', definition: 'AIの応答から自分の意図が誤解されたことを児童が検知し、次の児童ターンで先行発話を訂正・言い換える。' },\n    ],\n    outcomes: [\n      { code: 'resolved', label: '解決', definition: '修復後のAI応答から修正された意味の受容が確認できる。' },\n      { code: 'unresolved', label: '未解決', definition: '修復後も誤解・理解困難が継続している。' },\n      { code: 'unclear', label: '判定不能', definition: '後続ターン不足等により解決の成否を判定できない。' },\n    ],\n    technologyInvolvement: [\n      { code: 'probable', label: '技術要因の関与が強く疑われる', definition: '保存文字列や連続的な再試行等からASR等の技術要因が強く疑われるが、録音がないため原因を断定しない。' },\n      { code: 'possible', label: '技術要因の可能性あり', definition: '技術要因の可能性はあるが、児童の表現・発音等との切り分けができない。' },\n      { code: 'not_evident', label: '技術要因を示す証拠なし', definition: '局所系列から技術要因を示す明確な証拠が見られない。' },\n      { code: 'unclear', label: '判定不能', definition: '保存ログだけでは技術要因の関与を判断できない。' },\n    ],\n  },\n")
replace_once('src/server/researchRq2Codebook.ts',
"      include: ['AIのI do not understand等に応じた言い換え・説明', '相手の誤解を受けた訂正'],",
"      include: ['AIのI do not understand等に応じた言い換え・説明', '相手の誤解を受けた訂正', 'AIの応答で誤理解を検知し次ターンで先行発話を修正する第三位置修復'],")
replace_once('src/server/researchRq2Codebook.ts',
"      examples: ['AI: I do not understand “ekiben.” / Child: Ekiben is a lunch box at a station.'],",
"      examples: ['AI: I do not understand “ekiben.” / Child: Ekiben is a lunch box at a station.', 'Child: I play for tonight. / AI: Okay, have fun playing tonight! / Child: No no. I play Fortnite.'],")
replace_once('src/server/researchRq2Codebook.ts',
"      include: ['自分の言い間違いを即時訂正', '相手の理解困難を受けて同じ内容をより簡単に言い換える'],",
"      include: ['自分の言い間違いを即時訂正', '相手の理解困難を受けて同じ内容をより簡単に言い換える', 'AIの誤理解を児童が検知し、No / I mean等を用いて先行発話の意味を訂正する'],")
replace_once('src/server/researchRq2Codebook.ts',
"      boundaryRule: 'トラブル源となった自分の先行発話を置き換える／修正する働きが観察できる場合にREP。AI/ASR由来のトラブルかどうかはhumanNote等に記録し、REP出現を能力向上と直結させない。',",
"      boundaryRule: 'トラブル源となった自分の先行発話を置き換える／修正する働きが観察できる場合にREP。単なるNoや聞き返しだけではREPとしない。AIの誤理解が応答に表れ、それを受けて児童が先行発話を修正する場合はB4＋REPのthird_positionとする。AI/ASR由来かはtechnologyInvolvementで確率的に記録し、REP出現を能力向上と直結させない。',")
replace_once('src/server/researchRq2Codebook.ts',
"      examples: ['Child: I like baseball—sorry, I like basketball.'],",
"      examples: ['Child: I like baseball—sorry, I like basketball.', 'Child: I play for tonight. / AI: Okay, have fun playing tonight! / Child: No no. I play Fortnite. / AI: Oh, Fortnite!'],")
replace_once('src/server/researchRq2Codebook.ts',
"    '本v1は「文献による演繹的出発点」であり、最終コードブックではない。300系列のうちコードブック開発用120系列で境界事例・未分類行動を確認して精緻化する。',",
"    '本v2は「文献による演繹的出発点＋実データで確認されたrepair境界事例」を反映した開発版である。300系列のうちコードブック開発用120系列で境界事例・未分類行動を確認して精緻化する。',\n    '旧childRepairCountはPardon等の表層的キーワード集計であり、RQ2の正式REPとは同一視しない。正式REPはB4等の参照基盤と局所系列を確認し、人間確定コードとして扱う。',")
replace_once('src/server/researchRq2Codebook.ts',
"      migrationNote: '旧コードブックを、国内外の相互行為能力・Small Talk・AI対話研究を根拠とした文献根拠型v1（schema 4）へ移行する未保存プレビューです。旧定義を自動流用せず、新v1を開発用120系列で検証してから確定してください。',",
"      migrationNote: '旧コードブックを、第三位置修復を含むrepair補助属性を追加した文献根拠型v2（schema 5）へ移行する未保存プレビューです。旧定義を自動流用せず、新v2を開発用120系列で検証してから確定してください。',")
replace_once('src/server/researchRq2Codebook.ts',
"  const recipientLocus = Array.isArray(input.recipientLocus) ? input.recipientLocus : DEFAULT_RQ2_CODEBOOK.recipientLocus;",
"  const recipientLocus = Array.isArray(input.recipientLocus) ? input.recipientLocus : DEFAULT_RQ2_CODEBOOK.recipientLocus;\n  const repairTaxonomy = input.repairTaxonomy && typeof input.repairTaxonomy === 'object' ? input.repairTaxonomy : DEFAULT_RQ2_CODEBOOK.repairTaxonomy;")
replace_once('src/server/researchRq2Codebook.ts',
"    if ([...referenceBasis, ...interactionFunction].some(freezeRowIncomplete)) {\n      throw new Error('RQ2_CODEBOOK_INCOMPLETE');\n    }",
"    if ([...referenceBasis, ...interactionFunction].some(freezeRowIncomplete)) {\n      throw new Error('RQ2_CODEBOOK_INCOMPLETE');\n    }\n    if (!Array.isArray(repairTaxonomy?.subtypes) || repairTaxonomy.subtypes.length < 3\n      || !Array.isArray(repairTaxonomy?.outcomes) || repairTaxonomy.outcomes.length < 3\n      || !Array.isArray(repairTaxonomy?.technologyInvolvement) || repairTaxonomy.technologyInvolvement.length < 4) {\n      throw new Error('RQ2_CODEBOOK_REPAIR_TAXONOMY_INCOMPLETE');\n    }")
replace_once('src/server/researchRq2Codebook.ts',
"    analysisDimensions: ['referenceBasis', 'interactionFunction'],\n    recipientLocus,",
"    analysisDimensions: ['referenceBasis', 'interactionFunction'],\n    recipientLocus,\n    repairTaxonomy,")

# Preflight requires schema 5 for new formal runs
replace_once('src/server/researchRq2Preflight.ts', "label: '文献根拠型コードブック schema 4',", "label: '文献根拠型コードブック schema 5',")
replace_once('src/server/researchRq2Preflight.ts', "passed: Number(codebook.schemaVersion || 0) >= 4 && sourceCount(codebook) > 0,", "passed: Number(codebook.schemaVersion || 0) >= 5 && sourceCount(codebook) > 0,")

# AI coding v5
replace_once('src/server/researchRq2Ai.ts', "import { rq2CanonicalPrimaryAndAux, rq2CanonicalizeCodes } from './researchRq2Codebook';", "import { rq2CanonicalPrimaryAndAux, rq2CanonicalizeCodes } from './researchRq2Codebook';\nimport { canonicalRepairAttributes } from './researchRepair';")
text = read('src/server/researchRq2Ai.ts').replace("'rq2-coding-prompt-v4'", "'rq2-coding-prompt-v5'")
write('src/server/researchRq2Ai.ts', text)
replace_once('src/server/researchRq2Ai.ts',
"B2a/B2bは情報源の検証が必要です。局所的対話系列だけで既知情報かどうか確定できない場合は推測せず needs_review=true としてください。B3は、単にAIの質問へ答えた場合ではなく、直前AIターンで新たに提示された具体的内容を児童が取り上げた場合に限ります。\n",
"B2a/B2bは情報源の検証が必要です。局所的対話系列だけで既知情報かどうか確定できない場合は推測せず needs_review=true としてください。B3は、単にAIの質問へ答えた場合ではなく、直前AIターンで新たに提示された具体的内容を児童が取り上げた場合に限ります。\nREPは単なるPardon/WhatやNoの有無では決めません。AIの理解困難への応答、児童自身の自己訂正、またはAI応答に表れた誤理解を児童が次ターンで訂正する第三位置修復を、前AI→児童→後AIの系列で判定してください。第三位置修復は原則B4＋REPです。REPの場合はrepair_subtype・repair_outcome・technology_involvementを必ず候補化し、技術原因を断定せず不明ならunclearを使ってください。\n")
replace_once('src/server/researchRq2Ai.ts',
"    functionBoundaryRule: codebook.functionBoundaryRule || '',\n    referenceBasis: codebook.referenceBasis || [],",
"    functionBoundaryRule: codebook.functionBoundaryRule || '',\n    repairTaxonomy: codebook.repairTaxonomy || {},\n    referenceBasis: codebook.referenceBasis || [],")
replace_once('src/server/researchRq2Ai.ts',
" {\"token\":\"S1\",\"reference_primary\":\"B3\",\"reference_aux_codes\":[],\"function_primary\":\"Q\",\"function_aux_codes\":[],\"needs_review\":false,\"review_reason\":\"\",\"reason\":\"短い根拠\"}",
" {\"token\":\"S1\",\"reference_primary\":\"B4\",\"reference_aux_codes\":[],\"function_primary\":\"REP\",\"function_aux_codes\":[],\"repair_subtype\":\"third_position\",\"repair_outcome\":\"resolved\",\"technology_involvement\":\"unclear\",\"repair_reason\":\"AIの誤理解を次ターンで訂正\",\"needs_review\":false,\"review_reason\":\"\",\"reason\":\"短い根拠\"}")
replace_once('src/server/researchRq2Ai.ts',
"      const invalid = [...reference.invalid, ...functions.invalid, ...legacyReference.invalid, ...legacyFunctions.invalid];\n      const missing = !reference.primary || !functions.primary;",
"      const repair = canonicalRepairAttributes(functions.primary, raw, false);\n      const invalid = [...reference.invalid, ...functions.invalid, ...legacyReference.invalid, ...legacyFunctions.invalid, ...repair.invalid];\n      const missing = !reference.primary || !functions.primary;")
replace_once('src/server/researchRq2Ai.ts',
"        aiFunctionCodes: functions.primary ? [functions.primary, ...functions.aux] : [],\n        aiRecipientLocus: [],",
"        aiFunctionCodes: functions.primary ? [functions.primary, ...functions.aux] : [],\n        aiRepairSubtype: repair.repairSubtype,\n        aiRepairOutcome: repair.repairOutcome,\n        aiTechnologyInvolvement: repair.technologyInvolvement,\n        aiRepairReason: String(raw.repair_reason || '').slice(0, 500),\n        aiRecipientLocus: [],")

# Persistence v5 + reliability attributes
text = read('src/server/researchRq2Persistence.ts').replace("'rq2-coding-prompt-v4'", "'rq2-coding-prompt-v5'")
write('src/server/researchRq2Persistence.ts', text)
replace_once('src/server/researchRq2Persistence.ts',
"  functionAuxCodes?: string[];\n  codebookVersion: string;",
"  functionAuxCodes?: string[];\n  repairSubtype?: string;\n  repairOutcome?: string;\n  technologyInvolvement?: string;\n  codebookVersion: string;")
replace_once('src/server/researchRq2Persistence.ts',
"    functionCodes: args.functionPrimary ? [args.functionPrimary, ...functionAuxCodes] : [],\n    coderKey,",
"    functionCodes: args.functionPrimary ? [args.functionPrimary, ...functionAuxCodes] : [],\n    repairSubtype: String(args.repairSubtype || ''),\n    repairOutcome: String(args.repairOutcome || ''),\n    technologyInvolvement: String(args.technologyInvolvement || ''),\n    coderKey,")

# Analysis summaries + repair attribute agreement
replace_once('src/server/researchRq2Analysis.ts',
"function humanFinalRows(rows: Record<string, any>[]) {",
"function countsByField(rows: Record<string, any>[], key: string) {\n  const out: Record<string, number> = {};\n  for (const row of rows) {\n    const value = String(row[key] || '').trim();\n    if (value) out[value] = (out[value] || 0) + 1;\n  }\n  return out;\n}\n\nfunction humanFinalRows(rows: Record<string, any>[]) {")
replace_once('src/server/researchRq2Analysis.ts',
"      const finalFunction = countsByPrimary(finalRows, 'function', 'human');\n      return {",
"      const finalFunction = countsByPrimary(finalRows, 'function', 'human');\n      const aiRepRows = rows.filter((row) => primaryCode(row, 'function', 'ai') === 'REP');\n      const finalRepRows = finalRows.filter((row) => primaryCode(row, 'function', 'human') === 'REP');\n      return {")
replace_once('src/server/researchRq2Analysis.ts',
"        finalFunctionAuxCodes: countsByAux(finalRows, 'function', 'human'),\n        // Backward-compatible aliases",
"        finalFunctionAuxCodes: countsByAux(finalRows, 'function', 'human'),\n        aiRepair: {\n          n: aiRepRows.length,\n          subtype: countsByField(aiRepRows, 'aiRepairSubtype'),\n          outcome: countsByField(aiRepRows, 'aiRepairOutcome'),\n          technologyInvolvement: countsByField(aiRepRows, 'aiTechnologyInvolvement'),\n        },\n        finalRepair: {\n          n: finalRepRows.length,\n          subtype: countsByField(finalRepRows, 'humanRepairSubtype'),\n          outcome: countsByField(finalRepRows, 'humanRepairOutcome'),\n          technologyInvolvement: countsByField(finalRepRows, 'humanTechnologyInvolvement'),\n        },\n        // Backward-compatible aliases")
replace_once('src/server/researchRq2Analysis.ts',
"      function: { n: 0, agreement: null, kappa: null },\n    };",
"      function: { n: 0, agreement: null, kappa: null },\n      repair: { n: 0, subtypeAgreement: null, outcomeAgreement: null, technologyAgreement: null },\n    };")
replace_once('src/server/researchRq2Analysis.ts',
"  const functionPairs = common.map((key) => [\n    reliabilityPrimary(aRows.get(key)!, 'function'),\n    reliabilityPrimary(bRows.get(key)!, 'function'),\n  ] as [string, string]);\n  return {",
"  const functionPairs = common.map((key) => [\n    reliabilityPrimary(aRows.get(key)!, 'function'),\n    reliabilityPrimary(bRows.get(key)!, 'function'),\n  ] as [string, string]);\n  const repairCommon = common.filter((key) => reliabilityPrimary(aRows.get(key)!, 'function') === 'REP' && reliabilityPrimary(bRows.get(key)!, 'function') === 'REP');\n  const attrAgreement = (key: string) => {\n    const pairs = repairCommon.map((sequenceId) => [String(aRows.get(sequenceId)?.[key] || ''), String(bRows.get(sequenceId)?.[key] || '')]).filter(([a,b]) => Boolean(a && b));\n    if (!pairs.length) return null;\n    return Number((pairs.filter(([a,b]) => a === b).length / pairs.length * 100).toFixed(1));\n  };\n  return {")
replace_once('src/server/researchRq2Analysis.ts',
"    function: categoricalKappa(functionPairs),\n  };",
"    function: categoricalKappa(functionPairs),\n    repair: {\n      n: repairCommon.length,\n      subtypeAgreement: attrAgreement('repairSubtype'),\n      outcomeAgreement: attrAgreement('repairOutcome'),\n      technologyAgreement: attrAgreement('technologyInvolvement'),\n    },\n  };")

# RQ2 routes
replace_once('src/server/researchRq2Routes.ts',
"import { serializeRq2LiteratureMapCsv } from './researchRq2LiteratureMap';",
"import { serializeRq2LiteratureMapCsv } from './researchRq2LiteratureMap';\nimport { buildRepairCandidateAudit, canonicalRepairAttributes, serializeRepairCandidatesCsv } from './researchRepair';")
replace_once('src/server/researchRq2Routes.ts',
"          for (const key of ['aiReferencePrimary','aiReferenceAuxCodes','aiReferenceCodes','aiFunctionPrimary','aiFunctionAuxCodes','aiFunctionCodes','aiRecipientLocus','aiNeedsReview','aiReviewReason','aiReason','aiModel','aiPromptVersion','aiCodebookVersion','aiCodedAt']) delete safe[key];",
"          for (const key of ['aiReferencePrimary','aiReferenceAuxCodes','aiReferenceCodes','aiFunctionPrimary','aiFunctionAuxCodes','aiFunctionCodes','aiRepairSubtype','aiRepairOutcome','aiTechnologyInvolvement','aiRepairReason','aiRecipientLocus','aiNeedsReview','aiReviewReason','aiReason','aiModel','aiPromptVersion','aiCodebookVersion','aiCodedAt']) delete safe[key];")
replace_once('src/server/researchRq2Routes.ts',
"    const functions = canonicalPrimaryAux(codebook, 'function', req.body?.functionPrimary, req.body?.functionAuxCodes, req.body?.functionCodes);\n    const item = await updateRq2Item(runId, sequenceId, {",
"    const functions = canonicalPrimaryAux(codebook, 'function', req.body?.functionPrimary, req.body?.functionAuxCodes, req.body?.functionCodes);\n    const repair = canonicalRepairAttributes(functions.primary, req.body || {}, true);\n    const item = await updateRq2Item(runId, sequenceId, {")
replace_once('src/server/researchRq2Routes.ts',
"      humanFunctionCodes: [functions.primary, ...functions.aux],\n      humanRecipientLocus: [],",
"      humanFunctionCodes: [functions.primary, ...functions.aux],\n      humanRepairSubtype: repair.repairSubtype,\n      humanRepairOutcome: repair.repairOutcome,\n      humanTechnologyInvolvement: repair.technologyInvolvement,\n      humanRecipientLocus: [],")
# second canonical functions occurrence for reliability
needle = "    const functions = canonicalPrimaryAux(codebook, 'function', req.body?.functionPrimary, req.body?.functionAuxCodes, req.body?.functionCodes);\n    const record = await saveRq2ReliabilityCode({"
replace_once('src/server/researchRq2Routes.ts', needle, "    const functions = canonicalPrimaryAux(codebook, 'function', req.body?.functionPrimary, req.body?.functionAuxCodes, req.body?.functionCodes);\n    const repair = canonicalRepairAttributes(functions.primary, req.body || {}, true);\n    const record = await saveRq2ReliabilityCode({")
replace_once('src/server/researchRq2Routes.ts',
"      functionPrimary: functions.primary,\n      functionAuxCodes: functions.aux,\n      codebookVersion: String(codebook.version || ''),",
"      functionPrimary: functions.primary,\n      functionAuxCodes: functions.aux,\n      repairSubtype: repair.repairSubtype,\n      repairOutcome: repair.repairOutcome,\n      technologyInvolvement: repair.technologyInvolvement,\n      codebookVersion: String(codebook.version || ''),")
# Repair audit endpoints
insert_before = "router.get('/research-rq2/analysis', requireManagementRole(['researcher']), async (req, res) => {"
repair_routes = r'''router.get('/research-rq2/repair-audit', requireManagementRole(['researcher']), async (req, res) => {
  try {
    const lessonOnly = bool(req.query.lessonOnly, true);
    const [sessions, schedules] = await Promise.all([getAllSessionsForManagement(), getAllStudySchedules()]);
    const candidates = buildRq2Candidates(sessions, schedules, { lessonOnly });
    const audit = buildRepairCandidateAudit(candidates);
    const { rows, ...summary } = audit;
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, lessonOnly, audit: summary });
  } catch (error: any) {
    return rq2ErrorResponse(res, error, 'RQ2_REPAIR_AUDIT_UNAVAILABLE');
  }
});

router.get('/research-rq2/repair-candidates.csv', requireManagementRole(['researcher']), async (req, res) => {
  try {
    const lessonOnly = bool(req.query.lessonOnly, true);
    const [sessions, schedules] = await Promise.all([getAllSessionsForManagement(), getAllStudySchedules()]);
    const candidates = buildRq2Candidates(sessions, schedules, { lessonOnly });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="rq2_repair_candidates.csv"');
    return res.send(serializeRepairCandidatesCsv(candidates));
  } catch (error: any) {
    return rq2ErrorResponse(res, error, 'RQ2_REPAIR_CANDIDATES_EXPORT_UNAVAILABLE');
  }
});

'''
replace_once('src/server/researchRq2Routes.ts', insert_before, repair_routes + insert_before)
replace_once('src/server/researchRq2Routes.ts',
"'ai_function_primary','ai_function_aux_codes','ai_needs_review'",
"'ai_function_primary','ai_function_aux_codes','ai_repair_subtype','ai_repair_outcome','ai_technology_involvement','ai_repair_reason','ai_needs_review'")
replace_once('src/server/researchRq2Routes.ts',
"'human_function_primary','human_function_aux_codes','human_status'",
"'human_function_primary','human_function_aux_codes','human_repair_subtype','human_repair_outcome','human_technology_involvement','human_status'")
replace_once('src/server/researchRq2Routes.ts',
"      ai_function_aux_codes: item.aiFunctionAuxCodes || (Array.isArray(item.aiFunctionCodes) ? item.aiFunctionCodes.slice(1) : []),\n      ai_needs_review:",
"      ai_function_aux_codes: item.aiFunctionAuxCodes || (Array.isArray(item.aiFunctionCodes) ? item.aiFunctionCodes.slice(1) : []),\n      ai_repair_subtype: item.aiRepairSubtype || '', ai_repair_outcome: item.aiRepairOutcome || '', ai_technology_involvement: item.aiTechnologyInvolvement || '', ai_repair_reason: item.aiRepairReason || '',\n      ai_needs_review:")
replace_once('src/server/researchRq2Routes.ts',
"      human_function_aux_codes: item.humanFunctionAuxCodes || (Array.isArray(item.humanFunctionCodes) ? item.humanFunctionCodes.slice(1) : []),\n      human_status:",
"      human_function_aux_codes: item.humanFunctionAuxCodes || (Array.isArray(item.humanFunctionCodes) ? item.humanFunctionCodes.slice(1) : []),\n      human_repair_subtype: item.humanRepairSubtype || '', human_repair_outcome: item.humanRepairOutcome || '', human_technology_involvement: item.humanTechnologyInvolvement || '',\n      human_status:")
replace_once('src/server/researchRq2Routes.ts',
"const headers = ['run_id','sequence_id','coder_id','codebook_version','reference_primary','reference_aux_codes','function_primary','function_aux_codes','saved_at'];",
"const headers = ['run_id','sequence_id','coder_id','codebook_version','reference_primary','reference_aux_codes','function_primary','function_aux_codes','repair_subtype','repair_outcome','technology_involvement','saved_at'];")
replace_once('src/server/researchRq2Routes.ts',
"      function_aux_codes: row.functionAuxCodes || (Array.isArray(row.functionCodes) ? row.functionCodes.slice(1) : []),\n      saved_at:",
"      function_aux_codes: row.functionAuxCodes || (Array.isArray(row.functionCodes) ? row.functionCodes.slice(1) : []),\n      repair_subtype: row.repairSubtype || '', repair_outcome: row.repairOutcome || '', technology_involvement: row.technologyInvolvement || '',\n      saved_at:")

# RQ3: new formal runs require schema 5; AI prompt assertion updated in QA below
replace_once('src/server/researchRq3Routes.ts', "if (Number(codebook.schemaVersion || 0) < 4) throw new Error('RQ3_CODEBOOK_SCHEMA_OUTDATED');", "if (Number(codebook.schemaVersion || 0) < 5) throw new Error('RQ3_CODEBOOK_SCHEMA_OUTDATED');")

# RQ2 UI: v2 labels, repair audit card, structured repair attributes
text = read('public/research-rq2.html').replace('文献根拠型コードブック v1', '文献根拠型コードブック v2').replace('文献根拠型v1（schema 4）', '文献根拠型v2（schema 5）')
text = text.replace("const schemaOk=Number(codebook?.schemaVersion||0)>=4;", "const schemaOk=Number(codebook?.schemaVersion||0)>=5;")
write('public/research-rq2.html', text)
replace_once('public/research-rq2.html',
'''  <div class="card">\n    <h2 style="margin:0 0 10px;font-size:19px">6. 集計・一致度</h2>''',
'''  <div class="card">\n    <div class="top"><div><h2 style="margin:0;font-size:19px">6. repair候補監査</h2><div class="muted">正式REPの確定ではなく、全候補系列から見落とし防止用の候補を抽出します。No等だけでREPとは確定しません。</div></div><div class="actions"><button id="repairAuditBtn" class="secondary">候補監査を実行</button><button id="repairCsvBtn" class="secondary">候補CSV</button></div></div>\n    <div id="repairAuditBox" class="note" style="margin-top:10px">未実行</div>\n  </div>\n\n  <div class="card">\n    <h2 style="margin:0 0 10px;font-size:19px">7. 集計・一致度</h2>''')
regex_once('public/research-rq2.html', r"function codeInputs\(item,prefix\)\{.*?\}\nfunction splitCodes", r'''function repairOptions(value,values){return '<option value="">—</option>'+values.map(([v,l])=>'<option value="'+v+'"'+(value===v?' selected':'')+'>'+l+'</option>').join('');}
function codeInputs(item,prefix){const human=prefix==='human';const refPrimary=human?(item.aiReferencePrimary||item.aiReferenceCodes?.[0]||''):'';const refAux=human?(item.aiReferenceAuxCodes||item.aiReferenceCodes?.slice(1)||[]).join(','):'';const funPrimary=human?(item.aiFunctionPrimary||item.aiFunctionCodes?.[0]||''):'';const funAux=human?(item.aiFunctionAuxCodes||item.aiFunctionCodes?.slice(1)||[]).join(','):'';const repairSubtype=human?(item.aiRepairSubtype||''):'';const repairOutcome=human?(item.aiRepairOutcome||''):'';const tech=human?(item.aiTechnologyInvolvement||''):'';const repair='<div data-'+prefix+'-repair-box="'+esc(item.sequenceId)+'" style="display:'+(funPrimary==='REP'?'grid':'none')+';grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:6px"><div><label class="muted">repair種類</label><select data-'+prefix+'-repair-subtype="'+esc(item.sequenceId)+'">'+repairOptions(repairSubtype,[['self_initiated','自己開始'],['response_to_trouble','理解困難への応答'],['third_position','AI誤理解への第三位置修復']])+'</select></div><div><label class="muted">修復結果</label><select data-'+prefix+'-repair-outcome="'+esc(item.sequenceId)+'">'+repairOptions(repairOutcome,[['resolved','解決'],['unresolved','未解決'],['unclear','判定不能']])+'</select></div><div><label class="muted">技術要因</label><select data-'+prefix+'-repair-tech="'+esc(item.sequenceId)+'">'+repairOptions(tech,[['probable','強く疑われる'],['possible','可能性あり'],['not_evident','証拠なし'],['unclear','判定不能']])+'</select></div></div>';return '<div><label class="muted">参照基盤・主コード</label><input class="mini-input" data-'+prefix+'-ref-primary="'+esc(item.sequenceId)+'" value="'+esc(refPrimary)+'" placeholder="B0 / B2a / B3"></div><div><label class="muted">参照基盤・補助</label><input class="mini-input" data-'+prefix+'-ref-aux="'+esc(item.sequenceId)+'" value="'+esc(refAux)+'" placeholder="必要時のみ"></div><div><label class="muted">対話機能・主コード</label><input class="mini-input" data-'+prefix+'-fun-primary="'+esc(item.sequenceId)+'" value="'+esc(funPrimary)+'" placeholder="ACK / RES / Q / TOP / COMP / REP"></div><div><label class="muted">対話機能・補助</label><input class="mini-input" data-'+prefix+'-fun-aux="'+esc(item.sequenceId)+'" value="'+esc(funAux)+'" placeholder="必要時のみ"></div>'+repair;}
function splitCodes''', flags=re.S)
regex_once('public/research-rq2.html', r"function renderItems\(\)\{.*?\}\nfunction bindRows", r'''function renderItems(){const reliability=currentItems.length&&currentItems.every(x=>x.purpose==='reliability');$('itemRows').innerHTML=currentItems.map(item=>{const ai=reliability?'<span class="muted">一致度確認用のためAI候補は非表示</span>':'<div><b>参照基盤</b> <span class="pill">'+esc(item.aiReferencePrimary||item.aiReferenceCodes?.[0]||'—')+'</span> '+((item.aiReferenceAuxCodes||item.aiReferenceCodes?.slice(1)||[]).map(x=>'<span class="pill">'+esc(x)+'</span>').join(''))+'</div><div><b>対話機能</b> <span class="pill">'+esc(item.aiFunctionPrimary||item.aiFunctionCodes?.[0]||'—')+'</span> '+((item.aiFunctionAuxCodes||item.aiFunctionCodes?.slice(1)||[]).map(x=>'<span class="pill">'+esc(x)+'</span>').join(''))+'</div>'+((item.aiFunctionPrimary||item.aiFunctionCodes?.[0])==='REP'?'<div class="muted"><b>repair</b> '+esc(item.aiRepairSubtype||'—')+' / '+esc(item.aiRepairOutcome||'—')+' / 技術 '+esc(item.aiTechnologyInvolvement||'—')+'</div>':'')+(item.aiNeedsReview?'<span class="pill warn">要確認</span><div class="muted">'+esc(item.aiReviewReason||'')+'</div>':'')+'<div class="muted">'+esc(item.aiReason||'')+'</div>';const controls=codeInputs(item,reliability?'rel':'human');const actions=reliability?'<button class="secondary" data-rel-save="'+esc(item.sequenceId)+'">独立コード保存</button>':'<button class="secondary" data-confirm="'+esc(item.sequenceId)+'">AI候補を確認して採用</button> <button class="primary" data-modify="'+esc(item.sequenceId)+'">入力コードで修正</button>';return '<tr><td><b>'+esc(item.stratum)+'</b><br>'+esc(item.purpose)+'<br><span class="muted">rank '+item.stratumRank+'</span></td><td class="transcript"><b>AI前:</b> '+esc(item.previousAiEnglish||'')+'<br><b>児童:</b> '+esc(item.childEnglish||'')+'<br><b>AI後:</b> '+esc(item.nextAiEnglish||'')+'<br><button class="secondary" data-context="'+esc(item.sessionId)+'">前後文脈</button><div id="rq2ctx-'+esc(item.sessionId)+'" class="muted" style="display:none;white-space:pre-wrap;margin-top:6px"></div></td><td>'+ai+'</td><td>'+controls+'</td><td>'+actions+'</td></tr>';}).join('')||'<tr><td colspan="5">対象データなし</td></tr>';bindRows();}
function toggleRepair(sequenceId,prefix){const fun=document.querySelector('[data-'+prefix+'-fun-primary="'+CSS.escape(sequenceId)+'"]');const box=document.querySelector('[data-'+prefix+'-repair-box="'+CSS.escape(sequenceId)+'"]');if(box)box.style.display=String(fun?.value||'').trim()==='REP'?'grid':'none';}
function bindRows''', flags=re.S)
replace_once('public/research-rq2.html',
"function bindRows(){document.querySelectorAll('[data-confirm]').forEach(b=>b.onclick=()=>saveHuman(b.dataset.confirm,true));document.querySelectorAll('[data-modify]').forEach(b=>b.onclick=()=>saveHuman(b.dataset.modify,false));document.querySelectorAll('[data-rel-save]').forEach(b=>b.onclick=()=>saveReliability(b.dataset.relSave));document.querySelectorAll('[data-context]').forEach(b=>b.onclick=()=>loadContext(b.dataset.context));}",
"function bindRows(){document.querySelectorAll('[data-confirm]').forEach(b=>b.onclick=()=>saveHuman(b.dataset.confirm,true));document.querySelectorAll('[data-modify]').forEach(b=>b.onclick=()=>saveHuman(b.dataset.modify,false));document.querySelectorAll('[data-rel-save]').forEach(b=>b.onclick=()=>saveReliability(b.dataset.relSave));document.querySelectorAll('[data-context]').forEach(b=>b.onclick=()=>loadContext(b.dataset.context));for(const prefix of ['human','rel'])document.querySelectorAll('[data-'+prefix+'-fun-primary]').forEach(el=>{const id=el.getAttribute('data-'+prefix+'-fun-primary');el.addEventListener('input',()=>toggleRepair(id,prefix));toggleRepair(id,prefix);});}")
regex_once('public/research-rq2.html', r"async function saveHuman\(sequenceId,adoptAi\)\{.*?\}\nasync function saveReliability", r'''async function saveHuman(sequenceId,adoptAi){try{const item=currentItems.find(x=>x.sequenceId===sequenceId)||{};const q=s=>document.querySelector(s)?.value||'';const referencePrimary=adoptAi?(item.aiReferencePrimary||item.aiReferenceCodes?.[0]||''):q('[data-human-ref-primary="'+CSS.escape(sequenceId)+'"]');const referenceAuxCodes=adoptAi?(item.aiReferenceAuxCodes||item.aiReferenceCodes?.slice(1)||[]):splitCodes(q('[data-human-ref-aux="'+CSS.escape(sequenceId)+'"]'));const functionPrimary=adoptAi?(item.aiFunctionPrimary||item.aiFunctionCodes?.[0]||''):q('[data-human-fun-primary="'+CSS.escape(sequenceId)+'"]');const functionAuxCodes=adoptAi?(item.aiFunctionAuxCodes||item.aiFunctionCodes?.slice(1)||[]):splitCodes(q('[data-human-fun-aux="'+CSS.escape(sequenceId)+'"]'));const repairSubtype=functionPrimary==='REP'?(adoptAi?(item.aiRepairSubtype||''):q('[data-human-repair-subtype="'+CSS.escape(sequenceId)+'"]')):'';const repairOutcome=functionPrimary==='REP'?(adoptAi?(item.aiRepairOutcome||''):q('[data-human-repair-outcome="'+CSS.escape(sequenceId)+'"]')):'';const technologyInvolvement=functionPrimary==='REP'?(adoptAi?(item.aiTechnologyInvolvement||''):q('[data-human-repair-tech="'+CSS.escape(sequenceId)+'"]')):'';await api('/api/management/research-rq2/human-code',{method:'POST',body:JSON.stringify({runId:runId(),sequenceId,referencePrimary,referenceAuxCodes,functionPrimary,functionAuxCodes,repairSubtype,repairOutcome,technologyInvolvement,decision:adoptAi?'confirm':'modify'})});status('itemStatus','人間確認を保存しました。');}catch(e){status('itemStatus','保存失敗: '+errorText(e.message),true);}}
async function saveReliability''', flags=re.S)
regex_once('public/research-rq2.html', r"async function saveReliability\(sequenceId\)\{.*?\}\nfunction countText", r'''async function saveReliability(sequenceId){try{const coder=$('coderKey').value.trim();if(!coder)throw new Error('coder IDを入力してください');const q=s=>document.querySelector(s)?.value||'';const functionPrimary=q('[data-rel-fun-primary="'+CSS.escape(sequenceId)+'"]');await api('/api/management/research-rq2/reliability-code',{method:'POST',body:JSON.stringify({runId:runId(),sequenceId,coderKey:coder,referencePrimary:q('[data-rel-ref-primary="'+CSS.escape(sequenceId)+'"]'),referenceAuxCodes:splitCodes(q('[data-rel-ref-aux="'+CSS.escape(sequenceId)+'"]')),functionPrimary,functionAuxCodes:splitCodes(q('[data-rel-fun-aux="'+CSS.escape(sequenceId)+'"]')),repairSubtype:functionPrimary==='REP'?q('[data-rel-repair-subtype="'+CSS.escape(sequenceId)+'"]'):'',repairOutcome:functionPrimary==='REP'?q('[data-rel-repair-outcome="'+CSS.escape(sequenceId)+'"]'):'',technologyInvolvement:functionPrimary==='REP'?q('[data-rel-repair-tech="'+CSS.escape(sequenceId)+'"]'):''})});status('itemStatus','独立コードを保存しました。');}catch(e){status('itemStatus','一致度コード保存失敗: '+errorText(e.message),true);}}
function countText''', flags=re.S)
replace_once('public/research-rq2.html',
"async function analysis(){if(!runId())return;try{const d=await api('/api/management/research-rq2/analysis?runId='+encodeURIComponent(runId()));",
"async function repairAudit(){try{const d=await api('/api/management/research-rq2/repair-audit?lessonOnly='+($('lessonOnly').checked?'1':'0'));const a=d.audit||{};const strata=(a.byStratum||[]).map(r=>'<div class=\"muted\">'+esc(r.stratum)+'：候補 '+r.candidateSequences+' / third-position '+r.thirdPositionCandidates+' / 理解困難応答 '+r.responseToTroubleCandidates+'</div>').join('');$('repairAuditBox').innerHTML='<b>候補 '+(a.candidateSequences||0)+' / 全系列 '+(a.totalSequences||0)+'</b><br>third-position候補 '+(a.thirdPositionCandidates||0)+' / 理解困難応答 '+(a.responseToTroubleCandidates||0)+' / 自己開始 '+(a.selfInitiatedCandidates||0)+' / 名前修復候補 '+(a.nameRepairCandidates||0)+' / 聞き返し '+(a.comprehensionRequestCandidates||0)+'<br><span class=\"muted\">候補抽出であり正式REPではありません。</span>'+strata;}catch(e){$('repairAuditBox').textContent='監査失敗: '+errorText(e.message);}}\nasync function analysis(){if(!runId())return;try{const d=await api('/api/management/research-rq2/analysis?runId='+encodeURIComponent(runId()));")
replace_once('public/research-rq2.html',
"<span class=\"muted\">参照基盤 補助</span> '+countText(r.finalReferenceAuxCodes)+'<br><span class=\"muted\">対話機能 補助</span> '+countText(r.finalFunctionAuxCodes)+'<hr",
"<span class=\"muted\">参照基盤 補助</span> '+countText(r.finalReferenceAuxCodes)+'<br><span class=\"muted\">対話機能 補助</span> '+countText(r.finalFunctionAuxCodes)+'<br><b>人間確定repair</b> n='+(r.finalRepair?.n||0)+' / 種類 '+countText(r.finalRepair?.subtype)+' / 結果 '+countText(r.finalRepair?.outcome)+' / 技術 '+countText(r.finalRepair?.technologyInvolvement)+'<hr")
replace_once('public/research-rq2.html',
"+'<br><span class=\"muted\">出現率の偏りが大きい場合は、出力CSVをR＋irrCACに読み込みGwet AC1/AC2も確認します。</span>';}",
"+'<br>REP補助属性：n='+(rel.repair?.n||0)+' / subtype一致率 '+(rel.repair?.subtypeAgreement??'—')+'% / outcome '+(rel.repair?.outcomeAgreement??'—')+'% / 技術 '+(rel.repair?.technologyAgreement??'—')+'%<br><span class=\"muted\">repair補助属性はREP共通系列が少ない場合はκを算出せず記述的一致率のみ確認します。出現率の偏りが大きい主コードはR＋irrCACでGwet AC1/AC2も確認します。</span>';}")
replace_once('public/research-rq2.html',
"$('analysisBtn').onclick=analysis;$('csvBtn').onclick=()=>runId()&&download('/api/management/research-rq2/export.csv?runId='+encodeURIComponent(runId()));",
"$('repairAuditBtn').onclick=repairAudit;$('repairCsvBtn').onclick=()=>download('/api/management/research-rq2/repair-candidates.csv?lessonOnly='+($('lessonOnly').checked?'1':'0'));$('analysisBtn').onclick=analysis;$('csvBtn').onclick=()=>runId()&&download('/api/management/research-rq2/export.csv?runId='+encodeURIComponent(runId()));")

# QA updates + additional checks
text = read('scripts/qa-research-rq2.ts')
text = text.replace("assert.equal(RQ2_CODEBOOK_SCHEMA_VERSION, 4);", "assert.equal(RQ2_CODEBOOK_SCHEMA_VERSION, 5);")
text = text.replace("assert.ok(page.includes('文献根拠型コードブック v1'));", "assert.ok(page.includes('文献根拠型コードブック v2'));\nassert.ok(page.includes('repair候補監査'));\nassert.ok(page.includes('third-position'));\nassert.ok(routes.includes('/research-rq2/repair-audit'));\nassert.ok(routes.includes('/research-rq2/repair-candidates.csv'));\nassert.ok(routes.includes('humanRepairSubtype'));\nassert.ok(routes.includes('technology_involvement'));")
text = text.replace("assert.ok(persistence.includes(\"promptVersion: 'rq2-coding-prompt-v4'\"));", "assert.ok(persistence.includes(\"promptVersion: 'rq2-coding-prompt-v5'\"));")
text = text.replace("console.log('RQ2 code analysis QA: PASS');", "assert.deepEqual(DEFAULT_RQ2_CODEBOOK.repairTaxonomy.subtypes.map((row) => row.code), ['self_initiated','response_to_trouble','third_position']);\nassert.ok(DEFAULT_RQ2_CODEBOOK.referenceBasis.find((row) => row.code === 'B4')?.examples.some((x) => x.includes('Fortnite')));\nconsole.log('RQ2 code analysis QA: PASS');")
write('scripts/qa-research-rq2.ts', text)

text = read('scripts/qa-research-rq3.ts').replace("schemaVersion || 0) < 4", "schemaVersion || 0) < 5").replace("promptVersion = 'rq2-coding-prompt-v4'", "promptVersion = 'rq2-coding-prompt-v5'")
write('scripts/qa-research-rq3.ts', text)

repair_qa = r'''import assert from 'node:assert/strict';
import { buildRepairCandidateAudit, canonicalRepairAttributes, detectRepairCandidate } from '../src/server/researchRepair';

const fortnite = detectRepairCandidate({
  sequenceId: 'fortnite',
  previousAiEnglish: 'Okay, have fun playing tonight!',
  childEnglish: 'No no. I play fortnite.',
  nextAiEnglish: 'Oh, Fortnite! That is a popular game.',
});
assert.equal(fortnite.candidate, true);
assert.ok(fortnite.candidateTypes.includes('third_position'));
assert.equal(fortnite.suggestedFunction, 'REP');
assert.equal(fortnite.suggestedRepairSubtype, 'third_position');

const ordinaryNo = detectRepairCandidate({
  sequenceId: 'ordinary-no',
  previousAiEnglish: 'Do you like soccer?',
  childEnglish: 'No. I like baseball.',
  nextAiEnglish: 'Baseball is fun!',
});
assert.equal(ordinaryNo.candidateTypes.includes('third_position'), false);

const trouble = detectRepairCandidate({
  sequenceId: 'trouble',
  previousAiEnglish: "Sorry, I don't understand. Can you say that again?",
  childEnglish: 'I play soccer.',
  nextAiEnglish: 'Oh, soccer!',
});
assert.ok(trouble.candidateTypes.includes('response_to_trouble'));
assert.equal(trouble.suggestedRepairSubtype, 'response_to_trouble');

const comp = detectRepairCandidate({ previousAiEnglish: 'I like hiking.', childEnglish: 'Pardon?', nextAiEnglish: 'Hiking means walking in nature.' });
assert.ok(comp.candidateTypes.includes('comprehension_request'));
assert.equal(comp.suggestedFunction, 'COMP');

assert.deepEqual(canonicalRepairAttributes('REP', {
  repairSubtype: 'third_position', repairOutcome: 'resolved', technologyInvolvement: 'unclear',
}, true), {
  repairSubtype: 'third_position', repairOutcome: 'resolved', technologyInvolvement: 'unclear', invalid: [],
});
assert.throws(() => canonicalRepairAttributes('REP', { repairSubtype: 'third_position' }, true), /RQ2_INVALID_REPAIR_ATTRIBUTE/);
assert.deepEqual(canonicalRepairAttributes('RES', {}, true), { repairSubtype: '', repairOutcome: '', technologyInvolvement: '', invalid: [] });

const audit = buildRepairCandidateAudit([fortnite, ordinaryNo, trouble, comp]);
assert.equal(audit.totalSequences, 4);
assert.equal(audit.thirdPositionCandidates, 1);
assert.equal(audit.responseToTroubleCandidates, 1);
assert.equal(audit.comprehensionRequestCandidates, 1);
console.log('RQ2 repair coding QA: PASS');
'''
write('scripts/qa-rq2-repair.ts', repair_qa)
replace_once('package.json', '"qa:research-rq2": "tsx scripts/qa-research-rq2.ts"', '"qa:research-rq2": "tsx scripts/qa-research-rq2.ts && tsx scripts/qa-rq2-repair.ts"')

# Documentation for research audit trail
doc = '''# RQ2 repair coding v2 (schema 5)\n\n## Purpose\nThe existing session-level `childRepairCount` is a surface marker count and is not treated as the formal RQ2 REP code. Formal repair coding uses the local sequence (previous AI turn → child turn → following AI turn), AI candidate coding, and human confirmation.\n\n## Formal representation\n- Reference basis: B4 when the child adapts to the AI's comprehension/trouble state.\n- Interaction function: REP when the child repairs/replaces a prior own utterance.\n- Repair subtype: `self_initiated`, `response_to_trouble`, `third_position`.\n- Outcome: `resolved`, `unresolved`, `unclear`.\n- Technology involvement: `probable`, `possible`, `not_evident`, `unclear`. The log does not justify claiming ASR as a certain cause.\n\n## Third-position example\nChild: I play for tonight. → AI: Okay, have fun playing tonight! → Child: No no. I play Fortnite. → AI: Oh, Fortnite!\n\nThis is coded as B4 + REP + `third_position`; outcome is `resolved`. Technology involvement must be judged separately.\n\n## Candidate audit\nThe repair candidate audit is recall-oriented and may contain false positives. Candidate status never becomes a formal REP code without the normal RQ2 human-confirmation process.\n'''
write('docs/research/rq2-repair-coding-v2.md', doc)

print('RQ2 repair v5 implementation patch applied')
