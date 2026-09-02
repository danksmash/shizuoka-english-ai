import { analyzeChildCommunication, countEnglishWords } from '../dataContract';
import { detectPersonaProfileExpressions, getPersonaResearchMetadata, PERSONA_DICTIONARY_VERSION } from '../data/personaResearch';
import { detectVocabularyInText } from '../data/vocabulary56';
import type { ChatMessage, VisualVocabularyItem } from '../types';
import { maskTextForResearchExport } from '../utils/privacy';

export type ResearchDatasetName = 'sessions' | 'turns' | 'expressions' | 'system_events';
type UsageContext = 'group_like' | 'individual_like' | 'unknown';
type ContextMeta = {
  localDate: string;
  localStartTime: string;
  localEndTime: string;
  localStartedAt: string;
  localEndedAt: string;
  sameClassStarts5Min: number;
  sameClassStarts10Min: number;
  usageContext: UsageContext;
};

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

function tokyoParts(value: unknown) {
  const ms = timestampMs(value);
  if (!ms) return { date: '', time: '', valid: false };
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
    valid: true,
  };
}

function lowerBound(values: number[], target: number) {
  let left = 0; let right = values.length;
  while (left < right) {
    const middle = (left + right) >> 1;
    if (values[middle] < target) left = middle + 1;
    else right = middle;
  }
  return left;
}

function upperBound(values: number[], target: number) {
  let left = 0; let right = values.length;
  while (left < right) {
    const middle = (left + right) >> 1;
    if (values[middle] <= target) left = middle + 1;
    else right = middle;
  }
  return left;
}

function buildContextMeta(sessions: Record<string, any>[]): Map<string, ContextMeta> {
  const items = sessions.map((session) => ({
    session,
    sessionId: String(session.sessionId || ''),
    classId: String(session.classId || ''),
    startMs: timestampMs(session.startedAt) || timestampMs(session.endedAt),
  }));
  const startsByClass = new Map<string, number[]>();
  for (const item of items) {
    if (!item.classId || item.startMs <= 0) continue;
    const values = startsByClass.get(item.classId) || [];
    values.push(item.startMs);
    startsByClass.set(item.classId, values);
  }
  for (const values of startsByClass.values()) values.sort((a, b) => a - b);

  const result = new Map<string, ContextMeta>();
  for (const item of items) {
    const start = tokyoParts(item.startMs);
    const end = tokyoParts(item.session.endedAt || item.session.startedAt);
    const classStarts = item.classId ? (startsByClass.get(item.classId) || []) : [];
    const countWithin = (windowMs: number) => item.startMs > 0
      ? upperBound(classStarts, item.startMs + windowMs) - lowerBound(classStarts, item.startMs - windowMs)
      : 0;
    const same5 = countWithin(5 * 60_000);
    const same10 = countWithin(10 * 60_000);
    let usageContext: UsageContext = 'unknown';
    if (start.valid && item.classId) {
      usageContext = same5 >= CLASS_CLUSTER_5_MIN || same10 >= CLASS_CLUSTER_10_MIN ? 'group_like' : 'individual_like';
    }
    result.set(item.sessionId, {
      localDate: start.date,
      localStartTime: start.time,
      localEndTime: end.time,
      localStartedAt: start.valid ? `${start.date} ${start.time}` : '',
      localEndedAt: end.valid ? `${end.date} ${end.time}` : '',
      sameClassStarts5Min: same5,
      sameClassStarts10Min: same10,
      usageContext,
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
  return { child, ai, all: new Set([...child.keys(), ...ai.keys()]) };
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
  const byResearchId = new Map<string, Record<string, any>[]>();
  for (const session of sessions) {
    const researchId = String(session.researchId || '');
    if (!researchId) continue;
    const list = byResearchId.get(researchId) || [];
    list.push(session);
    byResearchId.set(researchId, list);
  }
  const out = new Map<string, number | ''>();
  for (const list of byResearchId.values()) {
    list.sort((a, b) => timestampMs(a.startedAt) - timestampMs(b.startedAt));
    let previous = 0;
    for (const session of list) {
      const current = timestampMs(session.startedAt);
      out.set(String(session.sessionId || ''), previous && current ? Math.round(((current - previous) / 86_400_000) * 100) / 100 : '');
      if (current) previous = current;
    }
  }
  return out;
}

function sessionSequenceNumbers(sessions: Record<string, any>[]): Map<string, { lifetime: number; daily: number }> {
  const byResearchId = new Map<string, Record<string, any>[]>();
  for (const session of sessions) {
    const researchId = String(session.researchId || '');
    if (!researchId) continue;
    const list = byResearchId.get(researchId) || [];
    list.push(session);
    byResearchId.set(researchId, list);
  }
  const out = new Map<string, { lifetime: number; daily: number }>();
  for (const list of byResearchId.values()) {
    list.sort((a, b) => (timestampMs(a.startedAt) - timestampMs(b.startedAt)) || String(a.sessionId || '').localeCompare(String(b.sessionId || '')));
    const daily = new Map<string, number>();
    list.forEach((session, index) => {
      const date = tokyoParts(session.startedAt || session.endedAt).date;
      const number = (daily.get(date) || 0) + 1;
      daily.set(date, number);
      out.set(String(session.sessionId || ''), { lifetime: index + 1, daily: number });
    });
  }
  return out;
}

function academicYearFromDate(localDate: string): number | '' {
  const [year, month] = localDate.split('-').map(Number);
  return Number.isInteger(year) && Number.isInteger(month) ? (month >= 4 ? year : year - 1) : '';
}
function gradeFromClassId(classId: unknown): number | '' {
  const value = String(classId || '');
  return value.startsWith('5-') ? 5 : value.startsWith('6-') ? 6 : '';
}
function commonFields(session: Record<string, any>, meta: ContextMeta) {
  return {
    research_id: session.researchId || '',
    class_id: session.classId || '',
    session_id: session.sessionId || '',
    academic_year: session.academicYear || academicYearFromDate(meta.localDate),
    grade_level: session.gradeLevel || gradeFromClassId(session.classId),
    local_date: meta.localDate,
    local_start_time: meta.localStartTime,
    local_end_time: meta.localEndTime,
    usage_context_inferred: meta.usageContext,
  };
}

export function buildResearchDataSets(sessions: Record<string, any>[]) {
  const context = buildContextMeta(sessions);
  const previousDays = previousSessionDays(sessions);
  const sequenceNumbers = sessionSequenceNumbers(sessions);
  const sessionRows: Record<string, unknown>[] = [];
  const turnRows: Record<string, unknown>[] = [];
  const expressionRows: Record<string, unknown>[] = [];
  const eventRows: Record<string, unknown>[] = [];

  for (const session of sessions) {
    const sessionId = String(session.sessionId || '');
    const meta = context.get(sessionId) || {
      localDate: '', localStartTime: '', localEndTime: '', localStartedAt: '', localEndedAt: '',
      sameClassStarts5Min: 0, sameClassStarts10Min: 0, usageContext: 'unknown' as UsageContext,
    };
    const history = sessionHistory(session);
    const communication = analyzeChildCommunication(history);
    const curriculum = curriculumMatches(history);
    const childMessages = history.filter((message) => message.sender === 'child');
    const systemEvents = Array.isArray(session.systemEvents) ? session.systemEvents : [];
    const hasReflection = Boolean(session.reflection && typeof session.reflection === 'object');
    const hasFinish = systemEvents.some((event: any) => event?.type === 'session_finish');
    const schemaVersion = Number(session.schemaVersion || 0);
    const dialogueCompleted = hasFinish || (Boolean(session.endedAt) && hasReflection) || (Boolean(session.endedAt) && schemaVersion < 3 && childMessages.length > 0);
    const dataQuality = !sessionId || !session.researchId || history.length === 0 || childMessages.length === 0
      ? 'missing_core'
      : !dialogueCompleted ? 'interrupted' : !hasReflection ? 'missing_reflection' : 'complete';
    const sessionStatus = dialogueCompleted ? (hasReflection ? 'complete' : 'dialogue_complete') : 'in_progress_or_interrupted';
    const persona = getPersonaResearchMetadata(String(session.personaId || session.aiStudentId || ''));

    sessionRows.push({
      research_id: session.researchId || '', class_id: session.classId || '', session_id: sessionId,
      schema_version: session.schemaVersion || 2, research_schema_version: session.researchSchemaVersion || '', app_version: session.appVersion || '', build: session.build || '',
      ai_model: session.aiModel || '', ai_input_tokens: session.aiInputTokens || 0, ai_output_tokens: session.aiOutputTokens || 0,
      ai_cache_read_tokens: session.aiCacheReadTokens || 0, ai_cache_creation_tokens: session.aiCacheCreationTokens || 0,
      academic_year: session.academicYear || academicYearFromDate(meta.localDate), grade_level: session.gradeLevel || gradeFromClassId(session.classId),
      local_date: meta.localDate, local_start_time: meta.localStartTime, local_end_time: meta.localEndTime,
      local_started_at: meta.localStartedAt, local_ended_at: meta.localEndedAt,
      same_class_starts_5min: meta.sameClassStarts5Min, same_class_starts_10min: meta.sameClassStarts10Min, usage_context_inferred: meta.usageContext,
      lifetime_session_number: sequenceNumbers.get(sessionId)?.lifetime || 0, daily_session_number: sequenceNumbers.get(sessionId)?.daily || 0,
      source_lifetime_session_number: session.lifetimeSessionNumber || 0, source_daily_session_number: session.dailySessionNumber || 0,
      days_since_previous_session: previousDays.get(sessionId) ?? '',
      persona_id: session.personaId || persona.personaId, persona_country: session.personaCountry || persona.country, persona_gender: session.personaGender || persona.gender,
      accent_name: session.personaAccentName || persona.accentName, accent_circle: session.worldEnglishesCircle || persona.worldEnglishesCircle,
      persona_label_condition: session.personaLabelCondition || 'shown', country_label_visible: session.countryLabelVisible === false ? 0 : 1,
      accent_label_visible: session.accentLabelVisible === false ? 0 : 1, flag_visible: session.flagVisible === false ? 0 : 1,
      assigned_partner_id: session.assignedPartnerId || '', assigned_partner_country: session.assignedPartnerCountry || '', assignment_announced_at: session.assignmentAnnouncedAt || '',
      tts_provider: session.ttsProvider || '', tts_voice_name: session.ttsVoiceName || persona.voiceName, tts_language_code: session.ttsLanguageCode || persona.voiceLanguageCode,
      persona_voice_gender: session.personaVoiceGender || persona.voiceGender, persona_voice_pitch: session.personaVoicePitch ?? persona.voicePitch,
      persona_default_voice_rate: session.personaDefaultVoiceRate ?? persona.defaultVoiceRate, student_selected_speech_rate: session.studentSelectedSpeechRate ?? 1,
      effective_tts_speech_rate: session.effectiveTtsSpeechRate ?? 1, persona_dictionary_version: session.personaDictionaryVersion || PERSONA_DICTIONARY_VERSION,
      ai_student_id: session.aiStudentId || '', topic: session.topic || '', target_duration_minutes: session.targetDurationMinutes || 0,
      actual_duration_seconds: session.actualDurationSeconds || 0, child_turn_count: communication.totalTurns, child_total_words: communication.totalChildWords,
      total_turns: communication.totalTurns, total_child_words: communication.totalChildWords, mean_child_words_per_turn: communication.meanChildWordsPerTurn,
      max_child_words_per_turn: communication.maxChildWordsPerTurn, child_unique_word_types: communication.childUniqueWordTypes,
      child_question_count: communication.childQuestionCount, child_reciprocal_question_count: communication.childReciprocalQuestionCount,
      child_repair_count: communication.childRepairCount, child_reason_expression_count: communication.childReasonExpressionCount,
      child_curriculum_vocab_count: curriculum.child.size, ai_curriculum_vocab_count: curriculum.ai.size, encountered_curriculum_vocab_count: curriculum.all.size,
      unique_vocabulary_count: curriculum.all.size, legacy_unique_vocabulary_count: session.uniqueVocabularyCount ?? '',
      reflection_conveyed_ideas: session.reflection?.conveyedIdeas ?? '', reflection_understood_partner: session.reflection?.understoodPartner ?? '',
      reflection_noticed_language_culture: session.reflection?.noticedLanguageCulture ?? '', system_event_count: systemEvents.length,
      session_completed: dialogueCompleted ? 1 : 0, session_status: sessionStatus, data_quality_flag: dataQuality,
    });

    const speakerCounts = { child: 0, ai: 0 };
    history.forEach((message, index) => {
      speakerCounts[message.sender] += 1;
      const flags = turnFlags(message);
      const local = tokyoParts(message.timestamp);
      const previousText = index > 0 ? history[index - 1]?.englishText || '' : '';
      let researchEnglish = maskTextForResearchExport(message.englishText || '');
      let researchJapanese = maskTextForResearchExport(message.japaneseText || '');
      if (message.sender === 'child' && /what(?:'|’)s your name|what is your name/i.test(previousText)) {
        researchEnglish = researchEnglish.replace(/^\s*(i(?:'|’)m|i am)\s+.{1,40}?(?=\s+(?:and|but|how|what|where|when|i|my)\b|[,.!?]|$)/i, '$1 [name omitted]');
        researchJapanese = researchJapanese.replace(/^\s*(私は|わたしは|僕は|ぼくは)\s*[^。！？,.]{1,30}?(です|だよ)(?=[。！？,.]|$)/, '$1 [name omitted] $2');
      }
      turnRows.push({
        ...commonFields(session, meta), turn_sequence: index + 1, speaker_turn_number: speakerCounts[message.sender], speaker: message.sender,
        local_timestamp: local.valid ? `${local.date} ${local.time}` : '', english_text_anonymized: researchEnglish,
        japanese_translation: researchJapanese, word_count: countEnglishWords(message.englishText || ''),
        is_question: flags.isQuestion, question_type: flags.questionType, is_reciprocal_question: flags.isReciprocal,
        is_repair: flags.isRepair, is_reason_expression: flags.isReason,
      });
      for (const item of detectVocabularyInText(message.englishText || '')) {
        const unit = String(item.mitsumuraUnit || '');
        expressionRows.push({
          ...commonFields(session, meta), turn_sequence: index + 1, speaker: message.sender, dictionary_source: 'curriculum',
          expression_id: item.id, expression: item.word, japanese: item.japanese, expression_category: item.category,
          curriculum_grade: unit.includes('6年') ? '6' : unit.includes('5年') ? '5' : '', curriculum_unit: unit,
          persona_id: persona.personaId, profile_field: '', persona_category: '', persona_dictionary_version: session.personaDictionaryVersion || PERSONA_DICTIONARY_VERSION,
        });
      }
      for (const item of detectPersonaProfileExpressions(message.englishText || '', persona.personaId)) {
        expressionRows.push({
          ...commonFields(session, meta), turn_sequence: index + 1, speaker: message.sender, dictionary_source: 'persona',
          expression_id: item.id, expression: item.expression, japanese: item.japanese, expression_category: item.category,
          curriculum_grade: '', curriculum_unit: '', persona_id: item.personaId, profile_field: item.profileField,
          persona_category: item.category, persona_dictionary_version: session.personaDictionaryVersion || PERSONA_DICTIONARY_VERSION,
        });
      }
    });

    systemEvents.slice(0, 500).forEach((event: any, index: number) => {
      const local = tokyoParts(event?.timestamp);
      eventRows.push({
        ...commonFields(session, meta), event_sequence: index + 1,
        local_timestamp: local.valid ? `${local.date} ${local.time}` : '',
        event_type: typeof event?.type === 'string' ? event.type : '',
        event_value: typeof event?.value === 'string' ? event.value : '',
      });
    });
  }

  const result: Record<ResearchDatasetName, Record<string, unknown>[]> = {
    sessions: sessionRows,
    turns: turnRows,
    expressions: expressionRows,
    system_events: eventRows,
  };
  return result;
}
