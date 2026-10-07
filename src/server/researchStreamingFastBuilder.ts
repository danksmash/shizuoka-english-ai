import { TARGET_20_AI_STUDENT_IDS } from '../data/curriculum';
import { analyzeChildCommunication, countEnglishWords } from '../dataContract';
import { detectPersonaProfileExpressions, getPersonaResearchMetadata, PERSONA_DICTIONARY_VERSION } from '../data/personaResearch';
import { detectVocabularyInText } from '../data/vocabulary56';
import type { ChatMessage } from '../types';
import { maskChildMessageForResearch } from '../utils/privacy';
import { filterResearchSessionRows, type ResearchFilterQuery } from './researchDashboard';
import {
  buildResearchLessonContextDecisions,
  RESEARCH_LESSON_CONTEXT_RULE_VERSION,
} from './researchLessonContext';
import { filterSessionsForStudyPhase } from './researchPhaseRuntime';
import type { StudyScheduleRecord } from './studySchedulePersistence';

export type FastStreamingPreparation = {
  contextBySessionId: Map<string, Record<string, any>>;
};

const TARGET_PERSONAS = new Set<string>(TARGET_20_AI_STUDENT_IDS as readonly string[]);
const CLASS_CLUSTER_5_MIN = 8;
const CLASS_CLUSTER_10_MIN = 12;
const TOKYO_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function timestampMs(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function tokyoParts(value: unknown) {
  const ms = timestampMs(value);
  if (!ms) return { date: '', time: '', valid: false };
  const parts = Object.fromEntries(TOKYO_FORMATTER.formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}:${parts.second}`, valid: true };
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

function isTargetSession(session: Record<string, any>): boolean {
  return TARGET_PERSONAS.has(String(session.personaId || session.aiStudentId || ''));
}

export function buildFastStreamingPreparation(
  metadataSessions: Record<string, any>[],
  schedules: StudyScheduleRecord[],
  studyPhase: unknown,
): FastStreamingPreparation {
  const sessions = filterSessionsForStudyPhase(metadataSessions, schedules, studyPhase).filter(isTargetSession);
  const items = sessions.map((session) => ({
    session,
    sessionId: String(session.sessionId || ''),
    researchId: String(session.researchId || ''),
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

  const contextBySessionId = new Map<string, Record<string, any>>();
  const itemDate = new Map<string, string>();
  const lessonDecisions = buildResearchLessonContextDecisions(sessions);
  for (const item of items) {
    const start = tokyoParts(item.startMs);
    const end = tokyoParts(item.session.endedAt || item.session.startedAt);
    const classStarts = item.classId ? (startsByClass.get(item.classId) || []) : [];
    const same5 = item.startMs > 0 ? upperBound(classStarts, item.startMs + 5 * 60_000) - lowerBound(classStarts, item.startMs - 5 * 60_000) : 0;
    const same10 = item.startMs > 0 ? upperBound(classStarts, item.startMs + 10 * 60_000) - lowerBound(classStarts, item.startMs - 10 * 60_000) : 0;
    const usage = start.valid && item.classId
      ? (same5 >= CLASS_CLUSTER_5_MIN || same10 >= CLASS_CLUSTER_10_MIN ? 'group_like' : 'individual_like')
      : 'unknown';
    const lessonDecision = lessonDecisions.get(item.sessionId);
    itemDate.set(item.sessionId, start.date);
    contextBySessionId.set(item.sessionId, {
      local_date: start.date,
      local_start_time: start.time,
      local_end_time: end.time,
      local_started_at: start.valid ? `${start.date} ${start.time}` : '',
      local_ended_at: end.valid ? `${end.date} ${end.time}` : '',
      same_class_starts_5min: same5,
      same_class_starts_10min: same10,
      same_class_unique_participants_10min: lessonDecision?.sameClassUniqueParticipants10Min || 0,
      lesson_cluster_start_local: lessonDecision?.lessonClusterStartLocal || '',
      lesson_context_rule_version: lessonDecision?.lessonContextRuleVersion || RESEARCH_LESSON_CONTEXT_RULE_VERSION,
      usage_context_inferred: usage,
      lesson_context_inferred: lessonDecision?.lessonContext || 'unknown',
      lifetime_session_number: 0,
      daily_session_number: 0,
      days_since_previous_session: '',
    });
  }

  const byResearchId = new Map<string, typeof items>();
  for (const item of items) {
    if (!item.researchId) continue;
    const list = byResearchId.get(item.researchId) || [];
    list.push(item);
    byResearchId.set(item.researchId, list);
  }
  for (const list of byResearchId.values()) {
    list.sort((a, b) => (a.startMs - b.startMs) || a.sessionId.localeCompare(b.sessionId));
    const daily = new Map<string, number>();
    let previous = 0;
    list.forEach((item, index) => {
      const context = contextBySessionId.get(item.sessionId);
      if (!context) return;
      const date = itemDate.get(item.sessionId) || '';
      const dailyNumber = (daily.get(date) || 0) + 1;
      daily.set(date, dailyNumber);
      context.lifetime_session_number = index + 1;
      context.daily_session_number = dailyNumber;
      context.days_since_previous_session = previous && item.startMs
        ? Math.round(((item.startMs - previous) / 86_400_000) * 100) / 100
        : '';
      if (item.startMs) previous = item.startMs;
    });
  }
  return { contextBySessionId };
}

function sessionHistory(session: Record<string, any>): ChatMessage[] {
  return Array.isArray(session.history)
    ? session.history.filter((message): message is ChatMessage => Boolean(message && typeof message === 'object' && typeof message.englishText === 'string'))
    : [];
}

function dataQuality(session: Record<string, any>, history: ChatMessage[]): string {
  const childMessages = history.filter((message) => message.sender === 'child');
  const events = Array.isArray(session.systemEvents) ? session.systemEvents : [];
  const hasReflection = Boolean(session.reflection && typeof session.reflection === 'object');
  const hasFinish = events.some((event: any) => event?.type === 'session_finish');
  const schemaVersion = Number(session.schemaVersion || 0);
  const completed = hasFinish || (Boolean(session.endedAt) && hasReflection) || (Boolean(session.endedAt) && schemaVersion < 3 && childMessages.length > 0);
  if (!session.sessionId || !session.researchId || history.length === 0 || childMessages.length === 0) return 'missing_core';
  if (!completed) return 'interrupted';
  return hasReflection ? 'complete' : 'missing_reflection';
}

function gradeFromClassId(classId: unknown): number | '' {
  const value = String(classId || '');
  return value.startsWith('5-') ? 5 : value.startsWith('6-') ? 6 : '';
}

function minimalFilterRow(session: Record<string, any>, preparation: FastStreamingPreparation, quality: string) {
  const context = preparation.contextBySessionId.get(String(session.sessionId || '')) || {};
  return {
    research_id: session.researchId || '',
    site_id: session.studySiteId || '',
    school_condition: session.schoolCondition || '',
    formal_study_participant: session.formalStudyParticipant === true ? 1 : 0,
    study_start_date: session.studyStartDate || '',
    class_id: session.classId || '',
    session_id: session.sessionId || '',
    grade_level: session.gradeLevel || session.studyGradeLevel || gradeFromClassId(session.classId),
    local_date: context.local_date || '',
    persona_id: session.personaId || session.aiStudentId || '',
    persona_label_condition: session.personaLabelCondition || 'shown',
    topic: session.topic || '',
    data_quality_flag: quality,
    ...context,
  };
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

function commonExportFields(session: Record<string, any>) {
  return {
    research_id: session.researchId || '',
    site_id: session.studySiteId || '',
    school_condition: session.schoolCondition || '',
    formal_study_participant: session.formalStudyParticipant === true ? 1 : 0,
    study_start_date: session.studyStartDate || '',
    class_id: session.classId || '',
    session_id: session.sessionId || '',
  };
}

export function buildFastStreamingRowsForPage(
  pageSessions: Record<string, any>[],
  preparation: FastStreamingPreparation,
  schedules: StudyScheduleRecord[],
  studyPhase: unknown,
  exportQuery: ResearchFilterQuery,
  dataset: 'utterances' | 'expressions',
): Record<string, any>[] {
  const phasePage = filterSessionsForStudyPhase(pageSessions, schedules, studyPhase).filter(isTargetSession);
  const output: Record<string, any>[] = [];
  for (const session of phasePage) {
    const history = sessionHistory(session);
    const quality = dataQuality(session, history);
    const filterRow = minimalFilterRow(session, preparation, quality);
    if (!filterResearchSessionRows([filterRow], exportQuery).length) continue;
    const personaId = String(session.personaId || session.aiStudentId || '');
    const persona = getPersonaResearchMetadata(personaId);
    const common = commonExportFields(session);
    if (dataset === 'utterances') {
      const speakerCounts = { child: 0, ai: 0 };
      let previousAiText = '';
      history.forEach((message, index) => {
        speakerCounts[message.sender] += 1;
        const flags = turnFlags(message);
        const local = tokyoParts(message.timestamp);
        const researchMessage = message.sender === 'child' ? maskChildMessageForResearch(message, previousAiText) : message;
        const storedWordCount = Number(message.wordCount);
        void (message.sender === 'child' && Number.isFinite(storedWordCount) && storedWordCount >= 0
          ? storedWordCount
          : countEnglishWords(message.englishText || ''));
        output.push({
          ...common,
          utterance_id: `u_${String(session.sessionId || '')}_${index + 1}`,
          persona_id: personaId,
          topic: session.topic || '',
          turn_sequence: index + 1,
          speaker_turn_number: speakerCounts[message.sender],
          speaker: message.sender,
          local_timestamp: local.valid ? `${local.date} ${local.time}` : '',
          english_text_anonymized: researchMessage.englishText || '',
          japanese_translation: researchMessage.japaneseText || '',
          is_question: flags.isQuestion,
          question_type: flags.questionType,
          is_reciprocal_question: flags.isReciprocal,
          is_repair: flags.isRepair,
          is_reason_expression: flags.isReason,
        });
        if (message.sender === 'ai') previousAiText = message.englishText || '';
      });
      continue;
    }
    history.forEach((message, index) => {
      for (const item of detectVocabularyInText(message.englishText || '')) {
        const unit = String(item.mitsumuraUnit || '');
        output.push({
          ...common,
          utterance_id: `u_${String(session.sessionId || '')}_${index + 1}`,
          dictionary_source: 'curriculum',
          expression_id: item.id,
          expression: item.word,
          persona_id: persona.personaId,
          profile_field: '',
          persona_category: '',
          curriculum_grade: unit.includes('6年') ? '6' : unit.includes('5年') ? '5' : '',
          curriculum_unit: unit,
        });
      }
      for (const item of detectPersonaProfileExpressions(message.englishText || '', persona.personaId)) {
        output.push({
          ...common,
          utterance_id: `u_${String(session.sessionId || '')}_${index + 1}`,
          dictionary_source: 'persona',
          expression_id: item.id,
          expression: item.expression,
          persona_id: item.personaId,
          profile_field: item.profileField,
          persona_category: item.category,
          curriculum_grade: '',
          curriculum_unit: '',
          persona_dictionary_version: session.personaDictionaryVersion || PERSONA_DICTIONARY_VERSION,
        });
      }
    });
  }
  return output;
}
