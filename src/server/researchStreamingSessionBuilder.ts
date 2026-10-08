import { TARGET_20_AI_STUDENT_IDS } from '../data/curriculum';
import { analyzeChildCommunication } from '../dataContract';
import { assessResearchDuration } from './researchDurationQuality';
import { getPersonaResearchMetadata } from '../data/personaResearch';
import type { ChatMessage } from '../types';
import {
  RESEARCH_EXPORT_HEADERS,
  RESEARCH_EXPORT_SCHEMA_VERSION,
  filterResearchSessionRows,
  type ResearchFilterQuery,
} from './researchDashboard';
import { filterSessionsForStudyPhase } from './researchPhaseRuntime';
import type { FastStreamingPreparation } from './researchStreamingFastBuilder';
import type { StudyScheduleRecord } from './studySchedulePersistence';

const TARGET_PERSONAS = new Set<string>(TARGET_20_AI_STUDENT_IDS as readonly string[]);

type Row = Record<string, any>;

function gradeFromClassId(classId: unknown): number | '' {
  const value = String(classId || '');
  return value.startsWith('5-') ? 5 : value.startsWith('6-') ? 6 : '';
}

function isTargetSession(session: Row): boolean {
  return TARGET_PERSONAS.has(String(session.personaId || session.aiStudentId || ''));
}

function sessionHistory(session: Row): ChatMessage[] {
  return Array.isArray(session.history)
    ? session.history.filter((message): message is ChatMessage => Boolean(message && typeof message === 'object' && typeof message.englishText === 'string'))
    : [];
}

function countEvent(events: any[], type: string): number {
  let count = 0;
  for (const event of events) if (event?.type === type) count += 1;
  return count;
}

export function buildFastStreamingSessionRowsForPage(
  pageSessions: Row[],
  preparation: FastStreamingPreparation,
  schedules: StudyScheduleRecord[],
  studyPhase: unknown,
  exportQuery: ResearchFilterQuery,
): Row[] {
  const phasePage = filterSessionsForStudyPhase(pageSessions, schedules, studyPhase).filter(isTargetSession);
  const rows: Row[] = [];
  for (const session of phasePage) {
    const sessionId = String(session.sessionId || '');
    const context = preparation.contextBySessionId.get(sessionId) || {};
    const history = sessionHistory(session);
    const communication = analyzeChildCommunication(history);
    let childTurns = 0;
    let aiTurns = 0;
    for (const message of history) {
      if (message.sender === 'child') childTurns += 1;
      else if (message.sender === 'ai') aiTurns += 1;
    }
    const systemEvents = Array.isArray(session.systemEvents) ? session.systemEvents : [];
    const hasReflection = Boolean(session.reflection && typeof session.reflection === 'object');
    const finishEvent = [...systemEvents].reverse().find((event: any) => event?.type === 'session_finish');
    const hasFinish = Boolean(finishEvent);
    const hasInterrupted = String(session.sessionStatus || '') === 'interrupted' || systemEvents.some((event: any) => event?.type === 'session_interrupted');
    const schemaVersion = Number(session.schemaVersion || 0);
    const dialogueCompleted = !hasInterrupted && (hasFinish
      || (Boolean(session.endedAt) && hasReflection)
      || (Boolean(session.endedAt) && schemaVersion < 3 && childTurns > 0));
    const dataQuality = !sessionId || !session.researchId || history.length === 0 || childTurns === 0
      ? 'missing_core'
      : !dialogueCompleted ? 'interrupted' : !hasReflection ? 'missing_reflection' : 'complete';
    const sessionStatus = hasInterrupted ? 'interrupted' : dialogueCompleted ? (hasReflection ? 'complete' : 'dialogue_complete') : 'in_progress_or_interrupted';
    const durationAssessment = assessResearchDuration(session);
    const persona = getPersonaResearchMetadata(String(session.personaId || session.aiStudentId || ''));
    const ttsTelemetryVersion = String(session.ttsTelemetryVersion || '');
    const ttsTelemetryReliable = ttsTelemetryVersion === 'cors-visible-v1';
    const row: Row = {
      research_id: session.researchId || '',
      site_id: session.studySiteId || '',
      school_condition: session.schoolCondition || '',
      formal_study_participant: session.formalStudyParticipant === true ? 1 : 0,
      study_start_date: session.studyStartDate || '',
      class_id: session.classId || '',
      session_id: sessionId,
      grade_level: session.gradeLevel || gradeFromClassId(session.classId),
      local_date: context.local_date || '',
      local_start_time: context.local_start_time || '',
      local_end_time: context.local_end_time || '',
      local_started_at: context.local_started_at || '',
      local_ended_at: context.local_ended_at || '',
      lifetime_session_number: context.lifetime_session_number || 0,
      daily_session_number: context.daily_session_number || 0,
      days_since_previous_session: context.days_since_previous_session ?? '',
      persona_id: session.personaId || persona.personaId,
      persona_country: session.personaCountry || persona.country,
      persona_gender: session.personaGender || persona.gender,
      ai_student_id: session.aiStudentId || '',
      assigned_partner_id: session.assignedPartnerId || '',
      assigned_partner_country: session.assignedPartnerCountry || '',
      assignment_announced_at: session.assignmentAnnouncedAt || '',
      topic: session.topic || '',
      child_total_words: communication.totalChildWords,
      mean_child_words_per_turn: communication.meanChildWordsPerTurn,
      max_child_words_per_turn: communication.maxChildWordsPerTurn,
      child_unique_word_types: communication.childUniqueWordTypes,
      child_turn_count: communication.totalTurns,
      ai_turn_count: aiTurns,
      dialogue_utterance_count: childTurns + aiTurns,
      child_repair_count: communication.childRepairCount,
      child_reason_expression_count: communication.childReasonExpressionCount,
      target_duration_minutes: session.targetDurationMinutes || 0,
      actual_duration_seconds: session.actualDurationSeconds || 0,
      wall_duration_seconds: session.wallDurationSeconds ?? '',
      active_dialogue_seconds: session.activeDialogueSeconds ?? '',
      duration_quality: durationAssessment.quality,
      duration_quality_reason: durationAssessment.reason,
      analysis_duration_seconds: durationAssessment.seconds ?? '',
      reflection_scale_version: session.reflection?.scaleVersion || (session.reflection ? 'legacy-135' : ''),
      reflection_understood_partner: session.reflection?.understoodPartner ?? '',
      reflection_conveyed_ideas: session.reflection?.conveyedIdeas ?? '',
      reflection_noticed_language_culture: session.reflection?.noticedLanguageCulture ?? '',
      same_class_starts_5min: context.same_class_starts_5min || 0,
      same_class_starts_10min: context.same_class_starts_10min || 0,
      same_class_unique_participants_10min: context.same_class_unique_participants_10min || 0,
      lesson_cluster_start_local: context.lesson_cluster_start_local || '',
      lesson_context_rule_version: context.lesson_context_rule_version || '',
      usage_context_inferred: context.usage_context_inferred || 'unknown',
      lesson_context_inferred: context.lesson_context_inferred || 'unknown',
      persona_label_condition: session.personaLabelCondition || 'shown',
      country_label_visible: session.countryLabelVisible === false ? 0 : 1,
      accent_label_visible: session.accentLabelVisible === false ? 0 : 1,
      flag_visible: session.flagVisible === false ? 0 : 1,
      help_open_count: countEvent(systemEvents, 'help_open'),
      vocab_bank_open_count: countEvent(systemEvents, 'vocab_bank_open'),
      speech_rate_change_count: countEvent(systemEvents, 'speech_rate_change'),
      student_selected_speech_rate: session.studentSelectedSpeechRate ?? 1,
      tts_telemetry_version: ttsTelemetryReliable ? ttsTelemetryVersion : 'legacy_unreliable',
      tts_primary_provider: session.ttsPrimaryProvider || 'azure-speech',
      tts_actual_provider: ttsTelemetryReliable ? (session.ttsActualProvider || 'not_observed') : 'not_observed',
      tts_provider_observed: ttsTelemetryReliable ? (session.ttsProviderObserved ?? 0) : 0,
      tts_provider_event_count: ttsTelemetryReliable ? (session.ttsProviderEventCount ?? 0) : 0,
      tts_fallback_count: ttsTelemetryReliable ? (session.ttsFallbackCount ?? 0) : 0,
      tts_fallback_reason: ttsTelemetryReliable ? (session.ttsFallbackReason || '') : '',
      tts_provider_deviation: ttsTelemetryReliable ? (session.ttsProviderDeviation ?? '') : '',
      schema_version: session.schemaVersion || 2,
      research_schema_version: RESEARCH_EXPORT_SCHEMA_VERSION,
      app_version: session.appVersion || '',
      build: session.build || '',
      session_completed: dialogueCompleted ? 1 : 0,
      session_status: sessionStatus,
      session_finish_reason: hasFinish ? String(finishEvent?.value || 'unspecified') : '',
      mic_error_count: countEvent(systemEvents, 'mic_error'),
      data_quality_flag: dataQuality,
    };
    const filtered = filterResearchSessionRows([row], exportQuery);
    if (!filtered.length) continue;
    rows.push(Object.fromEntries(RESEARCH_EXPORT_HEADERS.sessions.map((key) => [key, row[key] ?? ''])));
  }
  return rows;
}
