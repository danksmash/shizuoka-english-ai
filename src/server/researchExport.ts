import { analyzeChildCommunication, countEnglishWords } from '../dataContract';
import { detectVocabularyInText } from '../data/vocabulary56';
import type { ChatMessage, VisualVocabularyItem } from '../types';

export type ResearchDatasetName = 'sessions' | 'turns' | 'expressions' | 'system_events';

type UsageContext = 'in_class' | 'out_of_class_school_hours' | 'out_of_school_hours' | 'non_school_day' | 'unknown';

type ContextMeta = {
  localDate: string;
  localStartTime: string;
  localEndTime: string;
  localStartedAt: string;
  localEndedAt: string;
  weekday: string;
  weekdayFlag: number;
  schoolHoursFlag: number;
  sameClassStarts5Min: number;
  sameClassStarts10Min: number;
  usageContext: UsageContext;
  usageContextConfidence: 'high' | 'medium' | 'low';
};

const CLASSIFICATION_RULE_VERSION = 'time-cluster-v1';
const SCHOOL_START_MINUTE = 7 * 60 + 30;
const SCHOOL_END_MINUTE = 15 * 60;
const CLASS_CLUSTER_5_MIN = 8;
const CLASS_CLUSTER_10_MIN = 12;

function timestampMs(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function sessionHistory(session: Record<string, any>): ChatMessage[] {
  return Array.isArray(session.history)
    ? session.history.filter((message): message is ChatMessage => Boolean(message && typeof message === 'object' && typeof message.englishText === 'string'))
    : [];
}

function tokyoParts(value: unknown): { date: string; time: string; weekday: string; minuteOfDay: number; valid: boolean } {
  const ms = timestampMs(value);
  if (!ms) return { date: '', time: '', weekday: '', minuteOfDay: -1, valid: false };
  const date = new Date(ms);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', weekday: 'short',
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const localDate = `${parts.year}-${parts.month}-${parts.day}`;
  const localTime = `${parts.hour}:${parts.minute}:${parts.second}`;
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  return {
    date: localDate,
    time: localTime,
    weekday: parts.weekday || '',
    minuteOfDay: Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : -1,
    valid: true,
  };
}

function buildContextMeta(sessions: Record<string, any>[]): Map<string, ContextMeta> {
  const starts = sessions.map((session) => ({
    session,
    sessionId: String(session.sessionId || ''),
    classId: String(session.classId || ''),
    startMs: timestampMs(session.startedAt) || timestampMs(session.endedAt),
  }));
  const result = new Map<string, ContextMeta>();

  for (const item of starts) {
    const start = tokyoParts(item.startMs);
    const end = tokyoParts(item.session.endedAt || item.session.startedAt);
    const sameClass = item.classId
      ? starts.filter((other) => other.classId === item.classId && other.startMs > 0)
      : [];
    const same5 = item.startMs > 0 ? sameClass.filter((other) => Math.abs(other.startMs - item.startMs) <= 5 * 60_000).length : 0;
    const same10 = item.startMs > 0 ? sameClass.filter((other) => Math.abs(other.startMs - item.startMs) <= 10 * 60_000).length : 0;
    const weekdayFlag = start.valid && !['Sat', 'Sun'].includes(start.weekday) ? 1 : 0;
    const schoolHoursFlag = weekdayFlag && start.minuteOfDay >= SCHOOL_START_MINUTE && start.minuteOfDay < SCHOOL_END_MINUTE ? 1 : 0;

    let usageContext: UsageContext = 'unknown';
    let confidence: ContextMeta['usageContextConfidence'] = 'low';
    if (start.valid) {
      if (!weekdayFlag) {
        usageContext = 'non_school_day';
        confidence = 'high';
      } else if (!schoolHoursFlag) {
        usageContext = 'out_of_school_hours';
        confidence = 'high';
      } else if (same5 >= CLASS_CLUSTER_5_MIN) {
        usageContext = 'in_class';
        confidence = 'high';
      } else if (same10 >= CLASS_CLUSTER_10_MIN) {
        usageContext = 'in_class';
        confidence = 'medium';
      } else {
        usageContext = 'out_of_class_school_hours';
        confidence = 'low';
      }
    }

    result.set(item.sessionId, {
      localDate: start.date,
      localStartTime: start.time,
      localEndTime: end.time,
      localStartedAt: start.valid ? `${start.date} ${start.time}` : '',
      localEndedAt: end.valid ? `${end.date} ${end.time}` : '',
      weekday: start.weekday,
      weekdayFlag,
      schoolHoursFlag,
      sameClassStarts5Min: same5,
      sameClassStarts10Min: same10,
      usageContext,
      usageContextConfidence: confidence,
    });
  }
  return result;
}

function curriculumMatches(history: ChatMessage[]) {
  const child = new Map<string, VisualVocabularyItem>();
  const ai = new Map<string, VisualVocabularyItem>();
  for (const message of history) {
    for (const item of detectVocabularyInText(message.englishText || '')) {
      (message.sender === 'child' ? child : ai).set(item.id, item);
    }
  }
  const all = new Set([...child.keys(), ...ai.keys()]);
  return { child, ai, all };
}

function questionType(text: string): string {
  const normalized = text.trim().toLowerCase();
  if (/\b(how about you|what about you|and you)\b/.test(normalized)) return 'reciprocal';
  if (/^(what|where|when|who|why|how|which)\b/.test(normalized)) return 'wh';
  if (/^(do|does|did|can|could|are|is|am|have|has|would|will)\b/.test(normalized)) return 'yes_no';
  if (/\?$/.test(normalized)) return 'other_question';
  return '';
}

function turnFlags(message: ChatMessage) {
  if (message.sender !== 'child') return { isQuestion: 0, questionType: '', isReciprocal: 0, isRepair: 0, isReason: 0 };
  const one = analyzeChildCommunication([message]);
  return {
    isQuestion: one.childQuestionCount > 0 ? 1 : 0,
    questionType: questionType(message.englishText),
    isReciprocal: one.childReciprocalQuestionCount > 0 ? 1 : 0,
    isRepair: one.childRepairCount > 0 ? 1 : 0,
    isReason: one.childReasonExpressionCount > 0 ? 1 : 0,
  };
}

function previousSessionDays(sessions: Record<string, any>[]): Map<string, number | ''> {
  const byResearch = new Map<string, Record<string, any>[]>();
  for (const session of sessions) {
    const rid = String(session.researchId || '');
    if (!rid) continue;
    const list = byResearch.get(rid) || [];
    list.push(session);
    byResearch.set(rid, list);
  }
  const result = new Map<string, number | ''>();
  for (const list of byResearch.values()) {
    list.sort((a, b) => timestampMs(a.startedAt) - timestampMs(b.startedAt));
    let previous = 0;
    for (const session of list) {
      const current = timestampMs(session.startedAt);
      result.set(String(session.sessionId || ''), previous && current ? Math.round(((current - previous) / 86_400_000) * 100) / 100 : '');
      if (current) previous = current;
    }
  }
  return result;
}

function commonFields(session: Record<string, any>, meta: ContextMeta) {
  return {
    research_id: session.researchId || '',
    class_id: session.classId || '',
    session_id: session.sessionId || '',
    local_date: meta.localDate,
    local_start_time: meta.localStartTime,
    local_end_time: meta.localEndTime,
    weekday: meta.weekday,
    usage_context_inferred: meta.usageContext,
  };
}

export function buildResearchDataSets(sessions: Record<string, any>[]) {
  const context = buildContextMeta(sessions);
  const previousDays = previousSessionDays(sessions);
  const sessionRows: Record<string, unknown>[] = [];
  const turnRows: Record<string, unknown>[] = [];
  const expressionRows: Record<string, unknown>[] = [];
  const eventRows: Record<string, unknown>[] = [];

  for (const session of sessions) {
    const sessionId = String(session.sessionId || '');
    const meta = context.get(sessionId) || {
      localDate: '', localStartTime: '', localEndTime: '', localStartedAt: '', localEndedAt: '', weekday: '', weekdayFlag: 0,
      schoolHoursFlag: 0, sameClassStarts5Min: 0, sameClassStarts10Min: 0, usageContext: 'unknown' as UsageContext, usageContextConfidence: 'low' as const,
    };
    const history = sessionHistory(session);
    const communication = analyzeChildCommunication(history);
    const curriculum = curriculumMatches(history);
    const childMessages = history.filter((message) => message.sender === 'child');
    const systemEvents = Array.isArray(session.systemEvents) ? session.systemEvents : [];
    const hasReflection = Boolean(session.reflection && typeof session.reflection === 'object');
    const dataQuality = !sessionId || !session.researchId || history.length === 0
      ? 'missing_core'
      : !hasReflection ? 'missing_reflection' : 'complete';

    sessionRows.push({
      research_id: session.researchId || '',
      class_id: session.classId || '',
      session_id: sessionId,
      schema_version: session.schemaVersion || 2,
      local_date: meta.localDate,
      local_start_time: meta.localStartTime,
      local_end_time: meta.localEndTime,
      local_started_at: meta.localStartedAt,
      local_ended_at: meta.localEndedAt,
      weekday: meta.weekday,
      weekday_flag: meta.weekdayFlag,
      school_hours_flag: meta.schoolHoursFlag,
      same_class_starts_5min: meta.sameClassStarts5Min,
      same_class_starts_10min: meta.sameClassStarts10Min,
      usage_context_inferred: meta.usageContext,
      usage_context_confidence: meta.usageContextConfidence,
      classification_rule_version: CLASSIFICATION_RULE_VERSION,
      lifetime_session_number: session.lifetimeSessionNumber || 0,
      daily_session_number: session.dailySessionNumber || 0,
      days_since_previous_session: previousDays.get(sessionId) ?? '',
      ai_student_id: session.aiStudentId || '',
      topic: session.topic || '',
      target_duration_minutes: session.targetDurationMinutes || 0,
      actual_duration_seconds: session.actualDurationSeconds || 0,
      child_turn_count: communication.totalTurns,
      child_total_words: communication.totalChildWords,
      total_turns: communication.totalTurns,
      total_child_words: communication.totalChildWords,
      mean_child_words_per_turn: communication.meanChildWordsPerTurn,
      max_child_words_per_turn: communication.maxChildWordsPerTurn,
      child_unique_word_types: communication.childUniqueWordTypes,
      child_question_count: communication.childQuestionCount,
      child_reciprocal_question_count: communication.childReciprocalQuestionCount,
      child_repair_count: communication.childRepairCount,
      child_reason_expression_count: communication.childReasonExpressionCount,
      child_curriculum_vocab_count: curriculum.child.size,
      ai_curriculum_vocab_count: curriculum.ai.size,
      encountered_curriculum_vocab_count: curriculum.all.size,
      unique_vocabulary_count: curriculum.all.size,
      legacy_unique_vocabulary_count: session.uniqueVocabularyCount ?? '',
      reflection_conveyed_ideas: session.reflection?.conveyedIdeas ?? '',
      reflection_understood_partner: session.reflection?.understoodPartner ?? '',
      reflection_noticed_language_culture: session.reflection?.noticedLanguageCulture ?? '',
      system_event_count: systemEvents.length,
      session_completed: childMessages.length > 0 && session.endedAt ? 1 : 0,
      data_quality_flag: dataQuality,
    });

    const speakerCounts = { child: 0, ai: 0 };
    history.forEach((message, index) => {
      speakerCounts[message.sender] += 1;
      const flags = turnFlags(message);
      const local = tokyoParts(message.timestamp);
      turnRows.push({
        ...commonFields(session, meta),
        turn_sequence: index + 1,
        speaker_turn_number: speakerCounts[message.sender],
        speaker: message.sender,
        local_timestamp: local.valid ? `${local.date} ${local.time}` : '',
        english_text_anonymized: message.englishText || '',
        japanese_translation: message.japaneseText || '',
        word_count: countEnglishWords(message.englishText || ''),
        is_question: flags.isQuestion,
        question_type: flags.questionType,
        is_reciprocal_question: flags.isReciprocal,
        is_repair: flags.isRepair,
        is_reason_expression: flags.isReason,
      });

      for (const item of detectVocabularyInText(message.englishText || '')) {
        const unit = String(item.mitsumuraUnit || '');
        expressionRows.push({
          ...commonFields(session, meta),
          turn_sequence: index + 1,
          speaker: message.sender,
          expression_id: item.id,
          expression: item.word,
          japanese: item.japanese,
          expression_category: item.category,
          curriculum_grade: unit.includes('6年') ? '6' : unit.includes('5年') ? '5' : '',
          curriculum_unit: unit,
          expression_source: 'fixed_curriculum_dictionary',
        });
      }
    });

    systemEvents.slice(0, 500).forEach((event: any, index: number) => {
      const local = tokyoParts(event?.timestamp);
      eventRows.push({
        ...commonFields(session, meta),
        event_sequence: index + 1,
        local_timestamp: local.valid ? `${local.date} ${local.time}` : '',
        event_type: typeof event?.type === 'string' ? event.type : '',
        event_value: typeof event?.value === 'string' ? event.value : '',
      });
    });
  }

  return {
    sessions: sessionRows,
    turns: turnRows,
    expressions: expressionRows,
    system_events: eventRows,
  } satisfies Record<ResearchDatasetName, Record<string, unknown>[]>;
}
