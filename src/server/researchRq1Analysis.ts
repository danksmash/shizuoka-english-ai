import { buildResearchExportDataSets, researchDataScopeForRow } from './researchDashboard';
import { getManualResearchExclusion } from './researchManualExclusions';
import { effectivePersonaSelectionExclusionReason } from './researchAnalysisEligibility';
import { analysisPeriodForLocalDate, phaseForLocalDate, type StudyScheduleRecord } from './studySchedulePersistence';
import { canonicalRq1Country } from './researchRq1Targets';

export const RQ1_CHOICE_SCHEMA_VERSION = 'rq1-choice-2026-v3';
export const RQ1_PERIOD_SUMMARY_SCHEMA_VERSION = 'rq1-period-summary-2026-v3';
export const RQ1_TRANSITION_SCHEMA_VERSION = 'rq1-transition-2026-v3';

export const RQ1_CHOICE_HEADERS = [
  'rq1_choice_schema_version','site_id','research_id','participant_key','school_condition','class_id','grade_level',
  'session_id','local_date','local_started_at','study_phase','analysis_period','session_lifetime_number','selection_order_all','selection_order_valid',
  'persona_id','persona_country','persona_gender',
  'visitor_country_set','visitor_set_source','visitor_match',
  'assigned_target_country','assignment_known_to_learner','assigned_target_reference_match','assigned_target_exposed_match',
  'target_country','target_match',
  'child_turn_count','actual_duration_seconds','rapid_restart_flag',
  'lesson_context_inferred','lesson_context_final','dialogue_analysis_included','data_quality_flag','session_status','session_finish_reason','mic_error_count',
  'free_choice_status','raw_selection_included','effective_selection_included','effective_selection_exclusion_reason','selection_included','selection_exclusion_reason',
] as const;

export const RQ1_PERIOD_SUMMARY_HEADERS = [
  'rq1_period_summary_schema_version','site_id','research_id','participant_key','school_condition','class_id','grade_level','analysis_period',
  'visitor_country_set','visitor_choice_denominator','visitor_choice_numerator','visitor_selection_rate',
  'visitor_continuation_denominator','visitor_continuation_numerator','visitor_continuation_rate',
  'assigned_target_country','assigned_choice_denominator','assigned_choice_numerator','assigned_selection_rate',
  'assigned_continuation_denominator','assigned_continuation_numerator','assigned_continuation_rate',
  'choice_denominator','target_choice_numerator','target_selection_rate','period_observed',
  'distinct_persona_count','distinct_country_count','selection_entropy_bits','first_choice_at','last_choice_at',
] as const;

export const RQ1_TRANSITION_HEADERS = [
  'rq1_transition_schema_version','site_id','research_id','participant_key','school_condition','class_id','grade_level',
  'visitor_country_set','visitor_period1_choice_count','visitor_period1_match_count','visitor_baseline_eligible','visitor_baseline_eligibility_reason',
  'visitor_period2_observed','visitor_transition_by_period2','visitor_first_transition_date','visitor_first_transition_session_id','visitor_opportunities_before_transition',
  'assigned_target_country','assigned_period2_choice_count','assigned_period2_match_count','assigned_baseline_eligible','assigned_baseline_eligibility_reason',
  'assigned_period3_observed','assigned_transition_by_period3','assigned_first_transition_date','assigned_first_transition_session_id','assigned_opportunities_before_transition',
] as const;

export interface Rq1AnalysisParticipant {
  researchId: string;
  siteId: string;
  schoolCondition: 'intervention' | 'comparison';
  classId: string;
  gradeLevel: 5 | 6 | '';
  targetCountry: string;
  visitorCountries?: string[];
  visitorSetSource?: string;
}

type Row = Record<string, any>;

function phaseId(localDate: string, schedule: StudyScheduleRecord | undefined, condition: string) {
  if (!schedule || condition === 'comparison') return '';
  const phase = phaseForLocalDate(localDate, schedule);
  if (phase === 'unknown_virtual_other') return 'phase1';
  if (phase === 'anticipated_other') return 'phase2';
  if (phase === 'identified_real_other') return 'phase3';
  if (phase === 'exchange_or_after') return 'phase4';
  return '';
}

function participantKey(participant: Rq1AnalysisParticipant) {
  return [participant.siteId, participant.researchId].filter(Boolean).join(':');
}

function sortKey(row: Row) {
  return `${String(row.local_started_at || '')}|${String(row.session_id || '')}`;
}

function localStartedMs(value: unknown): number {
  const text = String(value || '').trim();
  if (!text) return 0;
  const parsed = Date.parse(text.includes('T') ? text : `${text.replace(' ', 'T')}+09:00`);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numericRate(numerator: number, denominator: number): number | '' {
  return denominator > 0 ? Number((numerator / denominator).toFixed(6)) : '';
}

function canonicalCountrySet(values: unknown[]): string[] {
  return [...new Set(values.map(canonicalRq1Country).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'en'));
}

function continuation(rows: Row[], field: string) {
  let denominator = 0;
  let numerator = 0;
  for (let index = 1; index < rows.length; index += 1) {
    const previous = rows[index - 1];
    const current = rows[index];
    if (Number(previous[field]) !== 1) continue;
    denominator += 1;
    if (Number(current[field]) === 1) numerator += 1;
  }
  return { denominator, numerator, rate: numericRate(numerator, denominator) };
}

function entropyBits(rows: Row[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = String(row.persona_id || '');
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const n = Array.from(counts.values()).reduce((sum, value) => sum + value, 0);
  if (!n) return '';
  let h = 0;
  for (const count of counts.values()) {
    const p = count / n;
    h -= p * Math.log2(p);
  }
  return Number(h.toFixed(6));
}

export function buildRq1ChoiceRows(args: {
  rawSessions: Row[];
  schedules: StudyScheduleRecord[];
  analysisSessionRows: Row[];
  participants: Rq1AnalysisParticipant[];
}) {
  const datasets = buildResearchExportDataSets(args.rawSessions);
  const participantById = new Map(args.participants.map((row) => [row.researchId, row]));
  const analysisBySession = new Map(args.analysisSessionRows.map((row) => [String(row.session_id || ''), row]));
  const scheduleByClass = new Map(args.schedules.map((row) => [row.classId, row]));
  const candidateRows: Row[] = [];

  for (const session of datasets.sessions) {
    const researchId = String(session.research_id || '');
    const participant = participantById.get(researchId);
    if (!participant) continue;
    const sessionId = String(session.session_id || '');
    const localDate = String(session.local_date || '');
    const classId = String(session.class_id || participant.classId || '');
    const schedule = scheduleByClass.get(classId);
    const analysisPeriod = schedule ? analysisPeriodForLocalDate(localDate, schedule) : '';
    const studyPhase = phaseId(localDate, schedule, participant.schoolCondition);
    const analysisSession = analysisBySession.get(sessionId);
    const finalLessonContext = String(analysisSession?.lesson_context_final || session.lesson_context_inferred || 'unknown');
    const targetCountry = canonicalRq1Country(participant.targetCountry);
    const personaCountry = canonicalRq1Country(session.persona_country);
    const visitorCountries = canonicalCountrySet(Array.isArray(participant.visitorCountries) ? participant.visitorCountries : []);
    const visitorMatch = visitorCountries.length && personaCountry ? (visitorCountries.includes(personaCountry) ? 1 : 0) : '';
    const targetReferenceMatch = targetCountry && personaCountry ? (targetCountry === personaCountry ? 1 : 0) : '';
    const assignmentKnown = participant.schoolCondition === 'intervention'
      && Boolean(schedule?.assignmentRevealDate)
      && Boolean(localDate)
      && localDate >= String(schedule?.assignmentRevealDate || '');
    const targetExposedMatch = assignmentKnown && targetReferenceMatch !== '' ? targetReferenceMatch : '';

    const manual = getManualResearchExclusion(sessionId);
    const dataScope = researchDataScopeForRow({
      class_id: classId,
      local_date: localDate,
      formal_study_participant: 1,
      school_condition: participant.schoolCondition,
      study_start_date: session.study_start_date || '',
    });

    let rawExclusionReason = '';
    if (manual) rawExclusionReason = `manual:${manual.reason}`;
    else if (dataScope !== 'main') rawExclusionReason = `data_scope:${dataScope}`;
    else if (!analysisPeriod) rawExclusionReason = 'outside_analysis_period';
    else if (finalLessonContext !== 'in_lesson') rawExclusionReason = `lesson_context:${finalLessonContext || 'unknown'}`;
    else if (!personaCountry) rawExclusionReason = 'persona_country_missing';

    const childTurnCount = Math.max(0, Number(session.child_turn_count || 0));
    const rawSelectionIncluded = rawExclusionReason ? 0 : 1;
    const effectiveQualityReason = effectivePersonaSelectionExclusionReason(childTurnCount);
    const effectiveExclusionReason = rawExclusionReason || effectiveQualityReason;
    const effectiveSelectionIncluded = effectiveExclusionReason ? 0 : 1;
    const dialogueAnalysisIncluded = Number(
      analysisSession?.dialogue_analysis_included ?? analysisSession?.analysis_included ?? 0,
    );

    candidateRows.push({
      rq1_choice_schema_version: RQ1_CHOICE_SCHEMA_VERSION,
      site_id: participant.siteId,
      research_id: researchId,
      participant_key: participantKey(participant),
      school_condition: participant.schoolCondition,
      class_id: classId,
      grade_level: participant.gradeLevel || session.grade_level || '',
      session_id: sessionId,
      local_date: localDate,
      local_started_at: String(session.local_started_at || ''),
      study_phase: studyPhase,
      analysis_period: analysisPeriod,
      session_lifetime_number: Number(session.lifetime_session_number || 0),
      selection_order_all: 0,
      selection_order_valid: '',
      persona_id: String(session.persona_id || ''),
      persona_country: personaCountry || String(session.persona_country || ''),
      persona_gender: String(session.persona_gender || ''),
      visitor_country_set: visitorCountries.join('|'),
      visitor_set_source: String(participant.visitorSetSource || ''),
      visitor_match: visitorMatch,
      assigned_target_country: targetCountry,
      assignment_known_to_learner: assignmentKnown ? 1 : 0,
      assigned_target_reference_match: targetReferenceMatch,
      assigned_target_exposed_match: targetExposedMatch,
      target_country: targetCountry,
      target_match: targetReferenceMatch,
      child_turn_count: childTurnCount,
      actual_duration_seconds: Math.max(0, Number(session.actual_duration_seconds || 0)),
      rapid_restart_flag: 0,
      lesson_context_inferred: String(session.lesson_context_inferred || 'unknown'),
      lesson_context_final: finalLessonContext,
      dialogue_analysis_included: dialogueAnalysisIncluded,
      data_quality_flag: String(session.data_quality_flag || ''),
      session_status: String(session.session_status || ''),
      session_finish_reason: String(session.session_finish_reason || ''),
      mic_error_count: Number(session.mic_error_count || 0),
      free_choice_status: 'app_free_selection_default_not_independently_verified',
      raw_selection_included: rawSelectionIncluded,
      effective_selection_included: effectiveSelectionIncluded,
      effective_selection_exclusion_reason: effectiveExclusionReason,
      selection_included: effectiveSelectionIncluded,
      selection_exclusion_reason: effectiveExclusionReason,
    });
  }

  const byParticipant = new Map<string, Row[]>();
  for (const row of candidateRows) {
    const key = String(row.participant_key || row.research_id || '');
    const list = byParticipant.get(key) || [];
    list.push(row);
    byParticipant.set(key, list);
  }
  for (const rows of byParticipant.values()) {
    rows.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    let valid = 0;
    rows.forEach((row, index) => {
      row.selection_order_all = index + 1;
      if (Number(row.selection_included || 0) === 1) {
        valid += 1;
        row.selection_order_valid = valid;
      }
      if (Number(row.child_turn_count || 0) > 0 || index + 1 >= rows.length) return;
      const currentMs = localStartedMs(row.local_started_at);
      const nextMs = localStartedMs(rows[index + 1].local_started_at);
      const sameDate = String(row.local_date || '') === String(rows[index + 1].local_date || '');
      if (sameDate && currentMs > 0 && nextMs >= currentMs && nextMs - currentMs <= 30_000) row.rapid_restart_flag = 1;
    });
  }

  return candidateRows.sort((a, b) => String(a.participant_key).localeCompare(String(b.participant_key)) || sortKey(a).localeCompare(sortKey(b)));
}

export function buildRq1PeriodSummaryRows(choiceRows: Row[], participants: Rq1AnalysisParticipant[]) {
  const periods = ['period1','period2','period3'];
  const included = choiceRows.filter((row) => Number(row.effective_selection_included ?? row.selection_included ?? 0) === 1);
  return participants.flatMap((participant) => periods.map((period) => {
    const rows = included
      .filter((row) => String(row.research_id || '') === participant.researchId && String(row.analysis_period || '') === period)
      .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

    const visitorRows = rows.filter((row) => row.visitor_match === 0 || row.visitor_match === 1);
    const visitorN = visitorRows.filter((row) => Number(row.visitor_match) === 1).length;
    const visitorCont = continuation(visitorRows, 'visitor_match');

    const targetRows = rows.filter((row) => row.assigned_target_reference_match === 0 || row.assigned_target_reference_match === 1);
    const targetN = targetRows.filter((row) => Number(row.assigned_target_reference_match) === 1).length;
    const targetCont = continuation(targetRows, 'assigned_target_reference_match');

    return {
      rq1_period_summary_schema_version: RQ1_PERIOD_SUMMARY_SCHEMA_VERSION,
      site_id: participant.siteId,
      research_id: participant.researchId,
      participant_key: participantKey(participant),
      school_condition: participant.schoolCondition,
      class_id: participant.classId,
      grade_level: participant.gradeLevel,
      analysis_period: period,
      visitor_country_set: canonicalCountrySet(Array.isArray(participant.visitorCountries) ? participant.visitorCountries : []).join('|'),
      visitor_choice_denominator: visitorRows.length,
      visitor_choice_numerator: visitorN,
      visitor_selection_rate: numericRate(visitorN, visitorRows.length),
      visitor_continuation_denominator: visitorCont.denominator,
      visitor_continuation_numerator: visitorCont.numerator,
      visitor_continuation_rate: visitorCont.rate,
      assigned_target_country: canonicalRq1Country(participant.targetCountry),
      assigned_choice_denominator: targetRows.length,
      assigned_choice_numerator: targetN,
      assigned_selection_rate: numericRate(targetN, targetRows.length),
      assigned_continuation_denominator: targetCont.denominator,
      assigned_continuation_numerator: targetCont.numerator,
      assigned_continuation_rate: targetCont.rate,
      choice_denominator: targetRows.length,
      target_choice_numerator: targetN,
      target_selection_rate: numericRate(targetN, targetRows.length),
      period_observed: rows.length > 0 ? 1 : 0,
      distinct_persona_count: new Set(rows.map((row) => String(row.persona_id || '')).filter(Boolean)).size,
      distinct_country_count: new Set(rows.map((row) => String(row.persona_country || '')).filter(Boolean)).size,
      selection_entropy_bits: entropyBits(rows),
      first_choice_at: rows[0]?.local_started_at || '',
      last_choice_at: rows.at(-1)?.local_started_at || '',
    };
  }));
}

export function buildRq1TransitionRows(choiceRows: Row[], participants: Rq1AnalysisParticipant[]) {
  const included = choiceRows.filter((row) => Number(row.effective_selection_included ?? row.selection_included ?? 0) === 1);
  return participants.map((participant) => {
    const rows = included
      .filter((row) => String(row.research_id || '') === participant.researchId)
      .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    const p1 = rows.filter((row) => row.analysis_period === 'period1' && (row.visitor_match === 0 || row.visitor_match === 1));
    const p2Visitor = rows.filter((row) => row.analysis_period === 'period2' && (row.visitor_match === 0 || row.visitor_match === 1));
    const p2Target = rows.filter((row) => row.analysis_period === 'period2' && (row.assigned_target_reference_match === 0 || row.assigned_target_reference_match === 1));
    const p3Target = rows.filter((row) => row.analysis_period === 'period3' && (row.assigned_target_reference_match === 0 || row.assigned_target_reference_match === 1));

    const p1VisitorMatches = p1.filter((row) => Number(row.visitor_match) === 1).length;
    const visitorEligible = p1.length > 0 && p1VisitorMatches === 0;
    const visitorReason = p1.length === 0 ? 'no_valid_period1_choice' : p1VisitorMatches > 0 ? 'visitor_set_selected_in_period1' : 'eligible';
    const visitorFirst = visitorEligible ? p2Visitor.find((row) => Number(row.visitor_match) === 1) : undefined;
    const visitorFirstIndex = visitorFirst ? p2Visitor.findIndex((row) => row.session_id === visitorFirst.session_id) : -1;

    const p2TargetMatches = p2Target.filter((row) => Number(row.assigned_target_reference_match) === 1).length;
    const targetEligible = p2Target.length > 0 && p2TargetMatches === 0;
    const targetReason = p2Target.length === 0 ? 'no_valid_period2_choice' : p2TargetMatches > 0 ? 'assigned_target_selected_in_period2' : 'eligible';
    const targetFirst = targetEligible ? p3Target.find((row) => Number(row.assigned_target_reference_match) === 1) : undefined;
    const targetFirstIndex = targetFirst ? p3Target.findIndex((row) => row.session_id === targetFirst.session_id) : -1;

    return {
      rq1_transition_schema_version: RQ1_TRANSITION_SCHEMA_VERSION,
      site_id: participant.siteId,
      research_id: participant.researchId,
      participant_key: participantKey(participant),
      school_condition: participant.schoolCondition,
      class_id: participant.classId,
      grade_level: participant.gradeLevel,
      visitor_country_set: canonicalCountrySet(Array.isArray(participant.visitorCountries) ? participant.visitorCountries : []).join('|'),
      visitor_period1_choice_count: p1.length,
      visitor_period1_match_count: p1VisitorMatches,
      visitor_baseline_eligible: visitorEligible ? 1 : 0,
      visitor_baseline_eligibility_reason: visitorReason,
      visitor_period2_observed: p2Visitor.length > 0 ? 1 : 0,
      visitor_transition_by_period2: visitorEligible && p2Visitor.length > 0 ? (visitorFirst ? 1 : 0) : '',
      visitor_first_transition_date: visitorFirst?.local_date || '',
      visitor_first_transition_session_id: visitorFirst?.session_id || '',
      visitor_opportunities_before_transition: visitorFirstIndex >= 0 ? visitorFirstIndex : '',
      assigned_target_country: canonicalRq1Country(participant.targetCountry),
      assigned_period2_choice_count: p2Target.length,
      assigned_period2_match_count: p2TargetMatches,
      assigned_baseline_eligible: targetEligible ? 1 : 0,
      assigned_baseline_eligibility_reason: targetReason,
      assigned_period3_observed: p3Target.length > 0 ? 1 : 0,
      assigned_transition_by_period3: targetEligible && p3Target.length > 0 ? (targetFirst ? 1 : 0) : '',
      assigned_first_transition_date: targetFirst?.local_date || '',
      assigned_first_transition_session_id: targetFirst?.session_id || '',
      assigned_opportunities_before_transition: targetFirstIndex >= 0 ? targetFirstIndex : '',
    };
  });
}

function csvCell(value: unknown) {
  const raw = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function serializeRq1Csv(rows: Row[], headers: readonly string[]) {
  return '\uFEFF' + [
    headers.map(csvCell).join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ].join('\n') + '\n';
}

export const RQ1_ANALYSIS_SPEC = {
  version: 'rq1-analysis-plan-2026-v3',
  status: 'staged_recipient_specificity_model',
  sourcePlan: '当初の段階的相手具体化（来校者情報なし→来校国籍群→本人動画＋担当相手）と2026-10-06監査結果を統合',
  conceptualSequence: '20 Persona → 来校予定国籍群 → 担当国／特定された実在留学生',
  visitorCountryRule: {
    intervention: 'Phase 2で学級全体に実際に告知した来校予定国籍集合をStudy Scheduleに固定し、Phase 1にも分析上だけ遡及適用して基準選好を作る。raw sessionは書き換えない。',
    comparison: '児童には情報提示せず、同学年の実践校来校国籍集合プロフィールを固定規則で分析上割り当てる。',
    primaryContrast: 'period1→period2 の来校国籍群Persona選択確率変化の学校間差',
  },
  assignedCountryRule: {
    intervention: 'Phase 3で児童が自分のグループの担当留学生を知った後に担当国を曝露情報として扱う。最終担当国はperiod2にも分析上だけ遡及適用し、period2→period3の基準差を作る。',
    comparison: '実践校の担当国構成・学年に基づく分析上の対応国を児童ごとに固定し、児童には知らせない。',
    freeze: '最終担当国を用いる正式なPhase 3分析では対応国表をfrozenかつ再現可能な状態にする。',
  },
  choiceUnit: '全開始選択はsession作成を1回としてraw_selection_includedに保持する。主要分析の有効Persona選択は、通常の研究採否条件に加えてchild_turn_count>=1を満たすsessionとする。actual_duration_secondsには閾値を設けない。',
  inclusion: {
    primary: ['data_scope == main','analysis_period in period1..3','lesson_context_final == in_lesson','manual research exclusionなし','Persona国が判定可能','child_turn_count >= 1'],
    rawSensitivity: '児童発話0回を含む全開始選択はraw_selection_includedで保持し、主要結果に対する感度分析とQAに用いる。',
    shortSession: '短時間終了・missing_reflectionを時間だけで一律除外しない。児童発話が1回以上あれば有効選択とし、対話内容分析の採否はdialogue_analysis_includedで別管理する。',
    rapidRestart: '児童発話0回のsession後30秒以内に同一児童が次sessionを開始した場合はrapid_restart_flag=1とし、操作再試行のQAに用いる。主要選択率の分母には入れない。',
  },
  files: {
    persona_choices: '1session開始1行。visitor_matchとassigned_target_reference_matchを分離し、20→集合と集合→担当国を同一系列から再現する。',
    persona_period_summary: '児童×period 1行。来校国籍群選択率・担当国選択率・各継続率・選択多様性を別々に保持。',
    persona_transition: '児童1行。period1→2の来校国籍群への初回移行と、period2→3の担当国への初回移行を別々に保持。',
  },
  primaryModels: {
    rq1a: {
      family: 'binomial_logit_mixed',
      dependent: 'visitor_match',
      fixedEffects: ['school_condition','analysis_period(period1/period2)','school_condition:analysis_period'],
      randomEffects: ['1|participant_key'],
      contrast: 'period1→period2 の来校国籍群Persona選択確率変化の学校間差',
    },
    rq1b: {
      family: 'binomial_logit_mixed',
      dependent: 'assigned_target_reference_match',
      fixedEffects: ['school_condition','analysis_period(period2/period3)','school_condition:analysis_period'],
      randomEffects: ['1|participant_key'],
      contrast: 'period2→period3 の担当国Persona選択確率変化の学校間差',
    },
    report: ['推定確率','確率差','95%信頼区間','児童・期間別分子/分母'],
  },
  transitions: {
    visitor: 'period1に有効選択があり来校国籍群Personaを一度も選ばなかった児童について、period2で初めて集合内Personaを選んだ割合。',
    assigned: 'period2に有効選択があり最終担当国Personaを一度も選ばなかった児童について、period3で初めて担当国Personaを選んだ割合。',
    missing: '追跡不能を非移行に置き換えない。',
  },
  continuation: {
    visitor: '同一児童・同一period内で前回が来校国籍群内Personaの対を分母、次回も集合内なら分子。',
    assigned: '同一児童・同一period内で前回が担当国Personaの対を分母、次回も担当国なら分子。同じ国の別Personaも継続に含む。',
  },
  diversity: 'distinct_persona_count、distinct_country_count、selection_entropy_bitsは20→集合→1への収束を記述する補助指標で、主要仮説検定には用いない。',
  multiplicity: 'RQ1-AとRQ1-Bを主要な段階別対比として事前に区別する。移行率・継続率は副次指標としてHolm法を検討し、その他の期間対比は探索的。',
  personaConfounding: '画面上の位置、性別、イラスト・性格等はPersonaと固定的に結び付くため個別補正しない。Phase 1の実測選好をこれらを含む包括的な基準とし、因果的に交絡が除去されたとは解釈しない。',
  software: {
    primary: 'jamovi + GAMLj3（二項混合モデル）',
    supplemental: 'R + RStudio（移行追跡、確率差区間、感度分析・診断）',
  },
} as const;
