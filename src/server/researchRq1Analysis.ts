import { buildResearchExportDataSets, researchDataScopeForRow } from './researchDashboard';
import { getManualResearchExclusion } from './researchManualExclusions';
import { effectivePersonaSelectionExclusionReason } from './researchAnalysisEligibility';
import { analysisPeriodForLocalDate, phaseForLocalDate, type StudyScheduleRecord } from './studySchedulePersistence';
import { canonicalRq1Country } from './researchRq1Targets';

export const RQ1_CHOICE_SCHEMA_VERSION = 'rq1-choice-2026-v2';
export const RQ1_PERIOD_SUMMARY_SCHEMA_VERSION = 'rq1-period-summary-2026-v2';
export const RQ1_TRANSITION_SCHEMA_VERSION = 'rq1-transition-2026-v2';

export const RQ1_CHOICE_HEADERS = [
  'rq1_choice_schema_version','site_id','research_id','participant_key','school_condition','class_id','grade_level',
  'session_id','local_date','local_started_at','study_phase','analysis_period','session_lifetime_number','selection_order_all','selection_order_valid',
  'persona_id','persona_country','persona_gender','target_country','target_match',
  'child_turn_count','actual_duration_seconds','rapid_restart_flag',
  'lesson_context_inferred','lesson_context_final','dialogue_analysis_included','data_quality_flag','session_status','session_finish_reason','mic_error_count',
  'free_choice_status','raw_selection_included','effective_selection_included','effective_selection_exclusion_reason','selection_included','selection_exclusion_reason',
] as const;

export const RQ1_PERIOD_SUMMARY_HEADERS = [
  'rq1_period_summary_schema_version','site_id','research_id','participant_key','school_condition','class_id','grade_level','target_country','analysis_period',
  'choice_denominator','target_choice_numerator','target_selection_rate','period_observed','distinct_persona_count',
  'continuation_denominator','continuation_numerator','continuation_rate',
  'first_choice_at','last_choice_at',
] as const;

export const RQ1_TRANSITION_HEADERS = [
  'rq1_transition_schema_version','site_id','research_id','participant_key','school_condition','class_id','grade_level','target_country',
  'period1_choice_count','period1_target_count','baseline_eligible','baseline_eligibility_reason',
  'period2_observed','period3_observed','transition_by_period2','transition_by_period3','period3_followup_status',
  'first_transition_period','first_transition_date','first_transition_session_id','first_transition_selection_order','opportunities_before_transition',
] as const;

export interface Rq1AnalysisParticipant {
  researchId: string;
  siteId: string;
  schoolCondition: 'intervention' | 'comparison';
  classId: string;
  gradeLevel: 5 | 6 | '';
  targetCountry: string;
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
    else if (!targetCountry) rawExclusionReason = 'target_country_missing';
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
      target_country: targetCountry,
      target_match: targetCountry && personaCountry ? (targetCountry === personaCountry ? 1 : 0) : '',
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
      if (sameDate && currentMs > 0 && nextMs >= currentMs && nextMs - currentMs <= 30_000) {
        row.rapid_restart_flag = 1;
      }
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
    const targetN = rows.filter((row) => Number(row.target_match) === 1).length;
    let continuationDenominator = 0;
    let continuationNumerator = 0;
    for (let index = 1; index < rows.length; index += 1) {
      const previous = rows[index - 1];
      const current = rows[index];
      if (Number(previous.target_match) !== 1) continue;
      continuationDenominator += 1;
      if (Number(current.target_match) === 1) continuationNumerator += 1;
    }
    return {
      rq1_period_summary_schema_version: RQ1_PERIOD_SUMMARY_SCHEMA_VERSION,
      site_id: participant.siteId,
      research_id: participant.researchId,
      participant_key: participantKey(participant),
      school_condition: participant.schoolCondition,
      class_id: participant.classId,
      grade_level: participant.gradeLevel,
      target_country: canonicalRq1Country(participant.targetCountry),
      analysis_period: period,
      choice_denominator: rows.length,
      target_choice_numerator: targetN,
      target_selection_rate: numericRate(targetN, rows.length),
      period_observed: rows.length > 0 ? 1 : 0,
      distinct_persona_count: new Set(rows.map((row) => String(row.persona_id || '')).filter(Boolean)).size,
      continuation_denominator: continuationDenominator,
      continuation_numerator: continuationNumerator,
      continuation_rate: numericRate(continuationNumerator, continuationDenominator),
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
    const p1 = rows.filter((row) => row.analysis_period === 'period1');
    const p2 = rows.filter((row) => row.analysis_period === 'period2');
    const p3 = rows.filter((row) => row.analysis_period === 'period3');
    const p1Target = p1.filter((row) => Number(row.target_match) === 1).length;
    const eligible = p1.length > 0 && p1Target === 0;
    const reason = p1.length === 0 ? 'no_valid_period1_choice' : p1Target > 0 ? 'target_selected_in_period1' : 'eligible';
    const later = [...p2, ...p3].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    const firstTransition = eligible ? later.find((row) => Number(row.target_match) === 1) : undefined;
    const period2Observed = p2.length > 0;
    const period3Observed = p3.length > 0;
    let transitionByPeriod2: number | '' = '';
    let transitionByPeriod3: number | '' = '';
    let period3FollowupStatus = eligible ? 'missing' : 'not_eligible';
    if (eligible && period2Observed) transitionByPeriod2 = p2.some((row) => Number(row.target_match) === 1) ? 1 : 0;
    if (eligible) {
      const transitionedByP2 = p2.some((row) => Number(row.target_match) === 1);
      if (transitionedByP2) {
        transitionByPeriod3 = 1;
        period3FollowupStatus = period3Observed ? 'observed_after_transition' : 'transition_already_observed_period2';
      } else if (period3Observed) {
        transitionByPeriod3 = p3.some((row) => Number(row.target_match) === 1) ? 1 : 0;
        period3FollowupStatus = 'observed_period3';
      }
    }
    const firstIndex = firstTransition ? later.findIndex((row) => row.session_id === firstTransition.session_id) : -1;
    return {
      rq1_transition_schema_version: RQ1_TRANSITION_SCHEMA_VERSION,
      site_id: participant.siteId,
      research_id: participant.researchId,
      participant_key: participantKey(participant),
      school_condition: participant.schoolCondition,
      class_id: participant.classId,
      grade_level: participant.gradeLevel,
      target_country: canonicalRq1Country(participant.targetCountry),
      period1_choice_count: p1.length,
      period1_target_count: p1Target,
      baseline_eligible: eligible ? 1 : 0,
      baseline_eligibility_reason: reason,
      period2_observed: period2Observed ? 1 : 0,
      period3_observed: period3Observed ? 1 : 0,
      transition_by_period2: transitionByPeriod2,
      transition_by_period3: transitionByPeriod3,
      period3_followup_status: period3FollowupStatus,
      first_transition_period: firstTransition?.analysis_period || '',
      first_transition_date: firstTransition?.local_date || '',
      first_transition_session_id: firstTransition?.session_id || '',
      first_transition_selection_order: firstTransition?.selection_order_valid || '',
      opportunities_before_transition: firstIndex >= 0 ? firstIndex : '',
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
  version: 'rq1-analysis-plan-2026-v2',
  status: 'fixed_template_not_executed',
  sourcePlan: 'JES共同研究計画 2026-09-22 RQ1選択変化修正版＋2026-10-01有効選択定義',
  targetCountryRule: {
    intervention: '実践校の最終的な担当国を、Phase 1を含む全期間共通の分析上の参照国として別対応表に固定する。過去session文書のassigned_partner_countryは書き換えない。',
    comparison: '実践校の担当国構成・学年に基づく学級対応で分析上の対応国を児童ごとに設定し、児童には知らせない。',
    freeze: '正式CSVは対応国表がfrozenかつ全正式参加者を被覆し、frozen時snapshotと一致する場合のみ出力する。',
  },
  choiceUnit: '全開始選択はsession作成を1回としてraw_selection_includedに保持する。RQ1主要分析の有効Persona選択は、通常の研究採否条件に加えてchild_turn_count>=1を満たすsessionとする。actual_duration_secondsには閾値を設けない。',
  inclusion: {
    primary: ['data_scope == main','analysis_period in period1..3','lesson_context_final == in_lesson','manual research exclusionなし','Persona国・対応国が判定可能','child_turn_count >= 1'],
    rawSensitivity: '児童発話0回を含む全開始選択はraw_selection_includedで保持し、主要結果に対する感度分析とQAに用いる。',
    shortSession: '短時間終了・missing_reflectionを時間だけで一律除外しない。児童発話が1回以上あれば有効選択とし、対話内容分析の採否はdialogue_analysis_includedで別管理する。',
    rapidRestart: '児童発話0回のsession後30秒以内に同一児童が次sessionを開始した場合はrapid_restart_flag=1とし、操作再試行のQAに用いる。主要選択率の分母には入れない。',
  },
  files: {
    persona_choices: '1session開始1行。raw_selection_includedとeffective_selection_includedを併記し、主要モデルはeffective_selection_included=1の行を使用する。',
    persona_period_summary: '児童×period 1行。有効選択のみで選択率と期間内継続率の分子・分母を保持。',
    persona_transition: '児童1行。有効選択系列に基づきperiod1非選択者の適格性、period2/3までの初回移行、追跡可否を保持。',
  },
  primaryModel: {
    family: 'binomial_logit_mixed',
    dependent: 'target_match',
    fixedEffects: ['school_condition','analysis_period','school_condition:analysis_period'],
    randomEffects: ['1|participant_key'],
    primaryContrast: 'period2→period3 の確率変化の学校間差',
    additionalContrasts: ['period1→period2 は操作確認的','period1→period3 は全体変化の補足'],
    report: ['推定確率','確率差','95%信頼区間','児童・期間別分子/分母'],
  },
  transition: {
    eligible: 'period1に有効選択が1回以上あり、対応国Personaを一度も選ばなかった児童',
    h2: 'period3までの累積初回移行の学校間差。児童1行の二項ロジスティック回帰を基本とする。',
    missing: '追跡不能を非移行に置き換えない。period3未観測でもperiod2で移行済みなら累積移行=1として保持する。',
  },
  continuation: {
    definition: '同一児童・同一period内の連続する有効選択対で、前回が対応国Personaの対を分母、今回も対応国Personaの対を分子とする。同じ国の別Personaも継続に含む。',
    model: '二項混合モデルでperiod1→period3の学校間変化差を副次的に推定する。期間境界の対は主集計に含めない。',
  },
  multiplicity: 'H1主要対比は1つ。H2とH3の副次仮説にはHolm法を適用する。その他の期間対比は探索的。',
  personaConfounding: '画面上の位置、性別、イラスト・性格等はPersonaと固定的に結び付くため個別補正しない。Phase 1の実測選好をこれらを含む包括的な基準とし、因果的に交絡が除去されたとは解釈しない。',
  software: {
    primary: 'jamovi + GAMLj3（二項混合モデル）',
    supplemental: 'R + RStudio（移行追跡、確率差区間、感度分析・診断）',
  },
} as const;
