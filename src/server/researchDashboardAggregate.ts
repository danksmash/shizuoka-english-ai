import crypto from 'node:crypto';
import { AI_STUDENTS_MASTER_LIST, TARGET_20_AI_STUDENT_IDS } from '../data/curriculum';
import { detectPersonaProfileExpressions } from '../data/personaResearch';
import { detectVocabularyInText } from '../data/vocabulary56';
import {
  RESEARCH_EXPORT_HEADERS,
  buildResearchExportDataSets,
  filterResearchSessionRows,
  researchDataScopeForRow,
  type ResearchFilterQuery,
} from './researchDashboard';
import { getDocument, listCollection, queryCollectionByStringRange, setDocument, setDocumentsBatch } from './firestore';
import { getSessionsForManagementByLocalDateRange } from './persistence';
import { normalizeStudyPhaseFilter } from './researchPhaseRuntime';
import { phaseForLocalDate, type StudyScheduleRecord, type StudyPhase } from './studySchedulePersistence';

export const RESEARCH_DASHBOARD_AGGREGATE_VERSION = 'research-dashboard-aggregate-v1';
const AGGREGATE_COLLECTION = 'research_dashboard_aggregates';
const AGGREGATE_META_COLLECTION = 'research_dashboard_aggregate_meta';
const AGGREGATE_META_ID = 'current';

type Row = Record<string, any>;

type ChildExpressionCount = {
  source: string;
  expression: string;
  count: number;
};

export type ResearchDashboardAggregateSession = Row & {
  __dashboard_utterance_count: number;
  __dashboard_expression_count: number;
  __dashboard_ai_failure_count: number;
  __dashboard_mic_error_count: number;
  __dashboard_tts_fallback_count: number;
  __dashboard_child_expressions: ChildExpressionCount[];
};

export type ResearchDashboardAggregateDocument = {
  schemaVersion: string;
  generationId: string;
  localDate: string;
  classId: string;
  sessionCount: number;
  participantCount: number;
  completeCount: number;
  totalChildWords: number;
  totalDurationSeconds: number;
  totalChildTurns: number;
  reflectionSums: { understood: number; conveyed: number; culture: number };
  reflectionNs: { understood: number; conveyed: number; culture: number };
  personaCounts: Record<string, number>;
  topicCounts: Record<string, number>;
  qualityCounts: Record<string, number>;
  dataScopeCounts: Record<string, number>;
  sourceSessionIdsHash: string;
  sourceMaxUpdatedAt: string;
  updatedAt: string;
  sessions: ResearchDashboardAggregateSession[];
};

export type ResearchDashboardAggregateState = {
  schemaVersion: string;
  generationId: string;
  status: 'building' | 'ready' | 'error';
  builtAt: string;
  updatedAt: string;
  documentCount: number;
  sessionCount: number;
  sourceSessionCount: number;
  lastIncrementalAt?: string;
};

const RESEARCH_PERSONAS = TARGET_20_AI_STUDENT_IDS.map((id) => {
  const persona = AI_STUDENTS_MASTER_LIST.find((item) => item.id === id);
  if (!persona) throw new Error(`RESEARCH_PERSONA_MISSING:${id}`);
  return persona;
});

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function topicLabel(id: string): string {
  return ({
    intro:'自己紹介・あいさつ', favorites:'好きなもの・すきなこと', shizuoka_culture:'静岡のじまん＆世界の文化',
    talents:'できること・得意なこと', daily_routine:'ふだんの生活・一日のようす', free:'自由トーク・おしゃべり',
  } as Record<string,string>)[id] || id;
}

function localDateTimeMs(value: unknown): number {
  const text = String(value || '').trim();
  if (!text) return 0;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text) ? `${text.replace(' ', 'T')}+09:00` : text;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizedCountry(value: unknown): string {
  const raw = String(value || '').trim().toLowerCase().replace(/[._-]/g, ' ').replace(/\s+/g, ' ');
  const aliases: Record<string, string> = {
    'usa':'united states','u s a':'united states','united states of america':'united states',
    'uk':'united kingdom','u k':'united kingdom','great britain':'united kingdom',
    'korea':'south korea','republic of korea':'south korea',
  };
  return aliases[raw] || raw;
}

function weekStart(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  const offset = (parsed.getUTCDay() + 6) % 7;
  parsed.setUTCDate(parsed.getUTCDate() - offset);
  return parsed.toISOString().slice(0, 10);
}

function increment(map: Record<string, number>, key: unknown, amount = 1) {
  const normalized = String(key || '未設定');
  map[normalized] = (map[normalized] || 0) + amount;
}

function stableDocumentId(localDate: string, classId: string): string {
  const encodedClass = Buffer.from(classId || 'unknown', 'utf8').toString('base64url');
  return `${localDate}__${encodedClass}`;
}

function sourceHash(sessionIds: string[]): string {
  return crypto.createHash('sha256').update(sessionIds.slice().sort().join('\n')).digest('hex');
}

function rawSystemEventCounts(raw: Row) {
  const events = Array.isArray(raw.systemEvents) ? raw.systemEvents : [];
  let aiFailures = 0;
  let micErrors = 0;
  let ttsFallbacks = 0;
  for (const event of events) {
    const type = String(event?.type || '');
    const value = String(event?.value || '');
    if (type === 'ai_request_failure') aiFailures += 1;
    if (type === 'mic_error') micErrors += 1;
    if (type === 'tts_provider' && /device|fallback/i.test(value)) ttsFallbacks += 1;
  }
  return { aiFailures, micErrors, ttsFallbacks };
}

function childExpressionCounts(raw: Row): ChildExpressionCount[] {
  const history = Array.isArray(raw.history) ? raw.history : [];
  const personaId = String(raw.personaId || raw.aiStudentId || '');
  const counts = new Map<string, ChildExpressionCount>();
  const add = (source: string, expression: unknown) => {
    const text = String(expression || '').trim();
    if (!text) return;
    const key = `${source}:${text.toLowerCase()}`;
    const current = counts.get(key) || { source, expression: text, count: 0 };
    current.count += 1;
    counts.set(key, current);
  };
  for (const message of history) {
    if (!message || message.sender !== 'child' || typeof message.englishText !== 'string') continue;
    for (const item of detectVocabularyInText(message.englishText)) add('curriculum', item.word);
    for (const item of detectPersonaProfileExpressions(message.englishText, personaId)) add('persona', item.expression);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.expression.localeCompare(b.expression, 'en'));
}

function summarizeSessions(rawSessions: Row[]): ResearchDashboardAggregateSession[] {
  const exported = buildResearchExportDataSets(rawSessions);
  const rawById = new Map(rawSessions.map((session) => [String(session.sessionId || ''), session]));
  const utteranceCounts = new Map<string, number>();
  const expressionCounts = new Map<string, number>();
  for (const row of exported.utterances) {
    const id = String(row.session_id || '');
    utteranceCounts.set(id, (utteranceCounts.get(id) || 0) + 1);
  }
  for (const row of exported.expressions) {
    const id = String(row.session_id || '');
    expressionCounts.set(id, (expressionCounts.get(id) || 0) + 1);
  }
  return exported.sessions.map((row) => {
    const id = String(row.session_id || '');
    const raw = rawById.get(id) || {};
    const system = rawSystemEventCounts(raw);
    return {
      ...row,
      __dashboard_utterance_count: utteranceCounts.get(id) || Number(row.dialogue_utterance_count || 0),
      __dashboard_expression_count: expressionCounts.get(id) || 0,
      __dashboard_ai_failure_count: system.aiFailures,
      __dashboard_mic_error_count: system.micErrors,
      __dashboard_tts_fallback_count: system.ttsFallbacks,
      __dashboard_child_expressions: childExpressionCounts(raw),
    };
  });
}

function aggregateDocumentForGroup(
  localDate: string,
  classId: string,
  sessions: ResearchDashboardAggregateSession[],
  rawById: Map<string, Row>,
  generationId: string,
): ResearchDashboardAggregateDocument {
  const participants = new Set<string>();
  const personaCounts: Record<string, number> = {};
  const topicCounts: Record<string, number> = {};
  const qualityCounts: Record<string, number> = {};
  const dataScopeCounts: Record<string, number> = {};
  const reflectionSums = { understood: 0, conveyed: 0, culture: 0 };
  const reflectionNs = { understood: 0, conveyed: 0, culture: 0 };
  let completeCount = 0;
  let totalChildWords = 0;
  let totalDurationSeconds = 0;
  let totalChildTurns = 0;
  let sourceMaxUpdatedAt = '';

  const reflectionKeys = [
    ['reflection_understood_partner', 'understood'],
    ['reflection_conveyed_ideas', 'conveyed'],
    ['reflection_noticed_language_culture', 'culture'],
  ] as const;

  for (const row of sessions) {
    const researchId = String(row.research_id || '');
    if (researchId) participants.add(researchId);
    if (String(row.data_quality_flag || '') === 'complete') completeCount += 1;
    totalChildWords += Math.max(0, Number(row.child_total_words || 0));
    totalDurationSeconds += Math.max(0, Number(row.actual_duration_seconds || 0));
    totalChildTurns += Math.max(0, Number(row.child_turn_count || 0));
    increment(personaCounts, row.persona_id);
    increment(topicCounts, row.topic);
    increment(qualityCounts, row.data_quality_flag);
    increment(dataScopeCounts, researchDataScopeForRow(row));
    if (String(row.reflection_scale_version || '') === '4point-v1') {
      for (const [field, key] of reflectionKeys) {
        const value = Number(row[field]);
        if ([1, 2, 3, 4].includes(value)) {
          reflectionSums[key] += value;
          reflectionNs[key] += 1;
        }
      }
    }
    const raw = rawById.get(String(row.session_id || '')) || {};
    const updatedAt = String(raw.updatedAt || raw.endedAt || raw.startedAt || '');
    if (updatedAt > sourceMaxUpdatedAt) sourceMaxUpdatedAt = updatedAt;
  }

  const ids = sessions.map((row) => String(row.session_id || '')).filter(Boolean);
  return {
    schemaVersion: RESEARCH_DASHBOARD_AGGREGATE_VERSION,
    generationId,
    localDate,
    classId,
    sessionCount: sessions.length,
    participantCount: participants.size,
    completeCount,
    totalChildWords,
    totalDurationSeconds,
    totalChildTurns,
    reflectionSums,
    reflectionNs,
    personaCounts,
    topicCounts,
    qualityCounts,
    dataScopeCounts,
    sourceSessionIdsHash: sourceHash(ids),
    sourceMaxUpdatedAt,
    updatedAt: new Date().toISOString(),
    sessions,
  };
}

export function buildResearchDashboardAggregateDocuments(
  rawSessions: Row[],
  generationId = 'qa-generation',
): Array<{ id: string; data: ResearchDashboardAggregateDocument }> {
  const summaries = summarizeSessions(rawSessions);
  const rawById = new Map(rawSessions.map((session) => [String(session.sessionId || ''), session]));
  const groups = new Map<string, ResearchDashboardAggregateSession[]>();
  for (const row of summaries) {
    const localDate = String(row.local_date || '');
    const classId = String(row.class_id || '') || 'unknown';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) continue;
    const key = `${localDate}\u0000${classId}`;
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .map(([key, sessions]) => {
      const [localDate, classId] = key.split('\u0000');
      return {
        id: stableDocumentId(localDate, classId),
        data: aggregateDocumentForGroup(localDate, classId, sessions, rawById, generationId),
      };
    })
    .sort((a, b) => a.data.localDate.localeCompare(b.data.localDate) || a.data.classId.localeCompare(b.data.classId, 'ja'));
}

export async function getResearchDashboardAggregateState(): Promise<ResearchDashboardAggregateState | null> {
  const row = await getDocument(AGGREGATE_META_COLLECTION, AGGREGATE_META_ID);
  if (!row) return null;
  const state = row as ResearchDashboardAggregateState;
  if (state.schemaVersion !== RESEARCH_DASHBOARD_AGGREGATE_VERSION) return null;
  return state;
}

export async function loadResearchDashboardAggregateDocuments(start?: unknown, end?: unknown): Promise<{
  available: boolean;
  state: ResearchDashboardAggregateState | null;
  documents: ResearchDashboardAggregateDocument[];
}> {
  const state = await getResearchDashboardAggregateState();
  if (!state || state.status !== 'ready' || !state.generationId) return { available: false, state, documents: [] };
  const startText = typeof start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : '';
  const endText = typeof end === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : '';
  const rows = startText || endText
    ? await queryCollectionByStringRange(AGGREGATE_COLLECTION, 'localDate', startText, endText)
    : await listCollection(AGGREGATE_COLLECTION, 500);
  const documents = rows
    .filter((row) => row.schemaVersion === RESEARCH_DASHBOARD_AGGREGATE_VERSION && row.generationId === state.generationId)
    .map((row) => row as ResearchDashboardAggregateDocument);
  return { available: true, state, documents };
}

export async function rebuildResearchDashboardAggregates(
  rawSessions: Row[],
  options: { dryRun?: boolean; generationId?: string } = {},
) {
  const generationId = options.generationId || `g_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const documents = buildResearchDashboardAggregateDocuments(rawSessions, generationId);
  const sessionCount = documents.reduce((sum, item) => sum + item.data.sessionCount, 0);
  const result = {
    generationId,
    documentCount: documents.length,
    sessionCount,
    sourceSessionCount: rawSessions.length,
  };
  if (options.dryRun) return { ...result, dryRun: true };

  const now = new Date().toISOString();
  await setDocument(AGGREGATE_META_COLLECTION, AGGREGATE_META_ID, {
    schemaVersion: RESEARCH_DASHBOARD_AGGREGATE_VERSION,
    generationId,
    status: 'building',
    builtAt: '',
    updatedAt: now,
    documentCount: 0,
    sessionCount: 0,
    sourceSessionCount: rawSessions.length,
  });
  for (let offset = 0; offset < documents.length; offset += 400) {
    await setDocumentsBatch(
      AGGREGATE_COLLECTION,
      documents.slice(offset, offset + 400).map((item) => ({ id: item.id, data: item.data })),
    );
  }
  const completedAt = new Date().toISOString();
  await setDocument(AGGREGATE_META_COLLECTION, AGGREGATE_META_ID, {
    schemaVersion: RESEARCH_DASHBOARD_AGGREGATE_VERSION,
    generationId,
    status: 'ready',
    builtAt: completedAt,
    updatedAt: completedAt,
    documentCount: documents.length,
    sessionCount,
    sourceSessionCount: rawSessions.length,
  });
  return { ...result, dryRun: false };
}

export async function refreshResearchDashboardAggregatesForDate(localDate: string): Promise<number> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) throw new Error('INVALID_AGGREGATE_LOCAL_DATE');
  const state = await getResearchDashboardAggregateState();
  if (!state || state.status !== 'ready') return 0;
  const rawSessions = await getSessionsForManagementByLocalDateRange(localDate, localDate);
  const documents = buildResearchDashboardAggregateDocuments(rawSessions, state.generationId);
  if (documents.length) {
    await setDocumentsBatch(AGGREGATE_COLLECTION, documents.map((item) => ({ id: item.id, data: item.data })));
  }
  await setDocument(AGGREGATE_META_COLLECTION, AGGREGATE_META_ID, {
    ...state,
    updatedAt: new Date().toISOString(),
    lastIncrementalAt: new Date().toISOString(),
  });
  return documents.length;
}

export function flattenResearchDashboardAggregateSessions(
  documents: ResearchDashboardAggregateDocument[],
): ResearchDashboardAggregateSession[] {
  return documents.flatMap((document) => Array.isArray(document.sessions) ? document.sessions : []);
}

const PHASE_TARGET: Record<string, StudyPhase> = {
  phase1: 'unknown_virtual_other',
  phase2: 'anticipated_other',
  phase3: 'identified_real_other',
  phase4: 'exchange_or_after',
};

export function filterAggregateSessionsForStudyPhase(
  sessions: ResearchDashboardAggregateSession[],
  schedules: StudyScheduleRecord[],
  requestedPhase: unknown,
): ResearchDashboardAggregateSession[] {
  const phase = normalizeStudyPhaseFilter(requestedPhase);
  if (!phase) return sessions;
  const byClass = new Map(schedules.map((schedule) => [schedule.classId, schedule]));
  const target = PHASE_TARGET[phase];
  return sessions.filter((row) => {
    if (String(row.school_condition || '') === 'comparison' || /^[56]-C[1-9]$/.test(String(row.class_id || ''))) return false;
    const schedule = byClass.get(String(row.class_id || ''));
    const localDate = String(row.local_date || '');
    return Boolean(schedule && localDate && phaseForLocalDate(localDate, schedule) === target);
  });
}

export function buildResearchDashboardDataFromAggregateSessions(
  aggregateSessions: ResearchDashboardAggregateSession[],
  query: ResearchFilterQuery = {},
  options: { includeInternal?: boolean } = {},
) {
  const data = filterResearchSessionRows(aggregateSessions, query) as ResearchDashboardAggregateSession[];
  const participants = new Set(data.map((row) => String(row.research_id || '')).filter(Boolean));
  const complete = data.filter((row) => String(row.data_quality_flag || '') === 'complete').length;
  const latestAt = data.map((row) => String(row.local_ended_at || row.local_started_at || '')).sort().at(-1) || '';
  const sessionWordsPerMinute = (row: Row): number | null => {
    if (String(row.data_quality_flag || '') === 'missing_core') return null;
    const words = Number(row.child_total_words);
    const seconds = Number(row.actual_duration_seconds);
    const childTurns = Number(row.child_turn_count);
    if (!Number.isFinite(words) || words < 0 || !Number.isFinite(seconds) || seconds <= 0 || !Number.isFinite(childTurns) || childTurns <= 0) return null;
    return words * 60 / seconds;
  };
  const sessionWpmValues = data.map(sessionWordsPerMinute).filter((value): value is number => value !== null);
  const meanChildWordsPerMinute = sessionWpmValues.length ? round(average(sessionWpmValues), 1) : 0;

  type SeriesBucket = { sessions:number; words:number[]; childWords:number; durationSeconds:number; reflections:[number[],number[],number[]] };
  const daily = new Map<string, SeriesBucket>();
  const weekly = new Map<string, SeriesBucket>();
  const addSeries = (target: Map<string, SeriesBucket>, key: string, row: Row) => {
    const bucket = target.get(key) || { sessions:0, words:[], childWords:0, durationSeconds:0, reflections:[[],[],[]] as [number[],number[],number[]] };
    bucket.sessions += 1;
    const words = Number(row.child_total_words);
    const seconds = Number(row.actual_duration_seconds);
    if (Number.isFinite(words)) bucket.words.push(words);
    if (Number.isFinite(words) && Number.isFinite(seconds) && seconds > 0) {
      bucket.childWords += words;
      bucket.durationSeconds += seconds;
    }
    if (String(row.reflection_scale_version || '') === '4point-v1') {
      [row.reflection_understood_partner,row.reflection_conveyed_ideas,row.reflection_noticed_language_culture].forEach((value, index) => {
        const rating = Number(value);
        if ([1,2,3,4].includes(rating)) bucket.reflections[index].push(rating);
      });
    }
    target.set(key, bucket);
  };
  for (const row of data) {
    const date = String(row.local_date || '');
    if (!date) continue;
    addSeries(daily, date, row);
    addSeries(weekly, weekStart(date), row);
  }

  const counts = (key: string) => {
    const map = new Map<string, number>();
    for (const row of data) {
      const value = String(row[key] || '未設定');
      map.set(value, (map.get(value) || 0) + 1);
    }
    return [...map.entries()].map(([label,value]) => ({ label,value })).sort((a,b) => b.value - a.value || a.label.localeCompare(b.label,'ja'));
  };
  const personaNames = new Map(RESEARCH_PERSONAS.map((persona) => [String(persona.id), String(persona.name)]));
  const personaUsageCounts = new Map(counts('persona_id').map((item) => [item.label, item.value]));
  const personaUsage = RESEARCH_PERSONAS.map((persona) => ({ label: persona.name, value: personaUsageCounts.get(persona.id) || 0 }));

  const topMap = new Map<string, { count:number; source:string; expression:string }>();
  for (const row of data) {
    for (const item of Array.isArray(row.__dashboard_child_expressions) ? row.__dashboard_child_expressions : []) {
      const expression = String(item.expression || '').trim();
      const source = String(item.source || '');
      if (!expression) continue;
      const key = `${source}:${expression.toLowerCase()}`;
      const current = topMap.get(key) || { count:0, source, expression };
      current.count += Math.max(0, Number(item.count || 0));
      topMap.set(key, current);
    }
  }
  const topExpressions = [...topMap.values()]
    .map((value) => ({ expression:value.expression, count:value.count, source:value.source }))
    .sort((a,b) => b.count - a.count || a.expression.localeCompare(b.expression, 'en'))
    .slice(0,10);

  const quality = counts('data_quality_flag');
  const systemQuality = [
    { label:'AI応答失敗', value:data.reduce((sum, row) => sum + Math.max(0, Number(row.__dashboard_ai_failure_count || 0)), 0) },
    { label:'マイクエラー', value:data.reduce((sum, row) => sum + Math.max(0, Number(row.__dashboard_mic_error_count || 0)), 0) },
    { label:'TTSフォールバック', value:data.reduce((sum, row) => sum + Math.max(0, Number(row.__dashboard_tts_fallback_count || 0)), 0) },
  ];

  let beforeAnnouncement = 0;
  let afterAnnouncement = 0;
  let afterCountryEligible = 0;
  let afterCountryMatched = 0;
  const configuredParticipants = new Set<string>();
  const individualSessions = data.filter((row) => row.usage_context_inferred === 'individual_like');
  const groupLikeSessions = data.filter((row) => row.usage_context_inferred === 'group_like');
  for (const row of data) {
    const announcedMs = localDateTimeMs(row.assignment_announced_at);
    const startedMs = localDateTimeMs(row.local_started_at);
    if (!announcedMs || !startedMs) continue;
    configuredParticipants.add(String(row.research_id || ''));
    if (startedMs < announcedMs) {
      beforeAnnouncement += 1;
      continue;
    }
    afterAnnouncement += 1;
    const assignedCountry = normalizedCountry(row.assigned_partner_country);
    const personaCountry = normalizedCountry(row.persona_country);
    if (assignedCountry && personaCountry) {
      afterCountryEligible += 1;
      if (assignedCountry === personaCountry) afterCountryMatched += 1;
    }
  }
  const individualDays = new Set(individualSessions.map((row) => `${String(row.research_id || '')}|${String(row.local_date || '')}`).filter((value) => !value.endsWith('|')));
  const individualTotalSeconds = individualSessions.reduce((sum,row) => sum + Math.max(0, Number(row.actual_duration_seconds || 0)), 0);

  const recentSessions = [...data]
    .sort((a,b) => String(b.local_started_at || '').localeCompare(String(a.local_started_at || '')))
    .slice(0,50)
    .map((row) => ({
      session_id:row.session_id || '', local_started_at:row.local_started_at || '', research_id:row.research_id || '', persona_id:row.persona_id || '',
      persona_name:personaNames.get(String(row.persona_id || '')) || '', topic:topicLabel(String(row.topic || '')),
      target_duration_minutes:row.target_duration_minutes || '', data_quality_flag:row.data_quality_flag || '',
    }));

  const seriesRows = (source: Map<string, SeriesBucket>) => [...source.entries()]
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([date,value]) => ({
      date,
      sessions:value.sessions,
      mean_child_words:round(average(value.words),1),
      mean_child_words_per_minute:value.durationSeconds > 0 ? round(value.childWords * 60 / value.durationSeconds,1) : null,
      reflection_understood:value.reflections[0].length ? round(average(value.reflections[0]),2) : null,
      reflection_understood_n:value.reflections[0].length,
      reflection_conveyed:value.reflections[1].length ? round(average(value.reflections[1]),2) : null,
      reflection_conveyed_n:value.reflections[1].length,
      reflection_culture:value.reflections[2].length ? round(average(value.reflections[2]),2) : null,
      reflection_culture_n:value.reflections[2].length,
    }));
  const dailyRows = seriesRows(daily);
  const weeklyRows = seriesRows(weekly);
  const aggregation = dailyRows.length > 21 ? 'weekly' : 'daily';
  const chartRows = aggregation === 'weekly' ? weeklyRows : dailyRows;

  const cumulativeDailyRows = (() => {
    const rowsByDate = new Map<string, ResearchDashboardAggregateSession[]>();
    for (const row of data) {
      const date = String(row.local_date || '');
      if (!date) continue;
      const rows = rowsByDate.get(date) || [];
      rows.push(row);
      rowsByDate.set(date, rows);
    }
    let cumulativeSessions = 0;
    let wpmSum = 0;
    let wpmN = 0;
    const reflectionSums = [0,0,0];
    const reflectionNs = [0,0,0];
    return [...rowsByDate.entries()]
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([date, rows]) => {
        for (const row of rows) {
          cumulativeSessions += 1;
          const wpm = sessionWordsPerMinute(row);
          if (wpm !== null) {
            wpmSum += wpm;
            wpmN += 1;
          }
          if (String(row.data_quality_flag || '') !== 'missing_core' && String(row.reflection_scale_version || '') === '4point-v1') {
            [row.reflection_understood_partner,row.reflection_conveyed_ideas,row.reflection_noticed_language_culture].forEach((value, index) => {
              const rating = Number(value);
              if ([1,2,3,4].includes(rating)) {
                reflectionSums[index] += rating;
                reflectionNs[index] += 1;
              }
            });
          }
        }
        return {
          date,
          sessions:cumulativeSessions,
          mean_child_words_per_minute:wpmN ? round(wpmSum / wpmN, 1) : null,
          mean_child_words_per_minute_n:wpmN,
          reflection_understood:reflectionNs[0] ? round(reflectionSums[0] / reflectionNs[0], 2) : null,
          reflection_understood_n:reflectionNs[0],
          reflection_conveyed:reflectionNs[1] ? round(reflectionSums[1] / reflectionNs[1], 2) : null,
          reflection_conveyed_n:reflectionNs[1],
          reflection_culture:reflectionNs[2] ? round(reflectionSums[2] / reflectionNs[2], 2) : null,
          reflection_culture_n:reflectionNs[2],
        };
      });
  })();

  const emptyExport = buildResearchExportDataSets([]);
  const payload = {
    success:true,
    metrics:{
      participantCount:participants.size,
      totalSessions:data.length,
      childUtteranceCount:data.reduce((sum, row) => sum + Math.max(0, Number(row.child_turn_count || 0)), 0),
      meanChildWordsPerMinute,
      completeRate:data.length ? round((complete / data.length) * 100,1) : 0,
      latestAt,
    },
    researchIndicators:{
      announcementConfiguredParticipants:configuredParticipants.size,
      beforeAnnouncementSessions:beforeAnnouncement,
      afterAnnouncementSessions:afterAnnouncement,
      assignedCountryPersonaEligibleSessions:afterCountryEligible,
      assignedCountryPersonaMatchedSessions:afterCountryMatched,
      assignedCountryPersonaSharePercent:afterCountryEligible ? round(afterCountryMatched * 100 / afterCountryEligible,1) : null,
      individualUseCount:individualSessions.length,
      individualUseDays:individualDays.size,
      individualUseTotalSeconds:individualTotalSeconds,
      groupLikeUseCount:groupLikeSessions.length,
    },
    filters:{
      dataScopes:['main','pilot_b','test','reserve'],
      schoolConditions:['intervention','comparison'],
      classes:[...new Set(data.map((row) => String(row.class_id || '')).filter(Boolean))].sort((a,b) => a.localeCompare(b,'ja')),
      grades:['5','6'],
      personas:RESEARCH_PERSONAS.map((persona) => persona.id),
      labelConditions:['shown','hidden'],
      topics:['intro','favorites','shizuoka_culture','talents','daily_routine','free'],
    },
    charts:{ daily:chartRows, cumulativeDaily:cumulativeDailyRows, aggregation, personas:personaUsage },
    dataQuality:quality,
    systemQuality,
    topExpressions,
    recentSessions,
    exportFiles:([
      ['sessions','sessions.csv','匿名ID・日時・Persona・担当留学生・発話量・振り返り・利用文脈・再現性','縦断・告知前後・担当国選択・専有関連分析', data.length],
      ['utterances','utterances.csv','児童・AIの匿名化された全発話と相互行為フラグ','発話内容・repair・応答性・専有の再判定', data.reduce((sum,row) => sum + Math.max(0, Number(row.__dashboard_utterance_count || 0)), 0)],
      ['expressions','expressions.csv','教科書辞書＋Persona辞書への一致表現','内容層・相手志向性の補助分析', data.reduce((sum,row) => sum + Math.max(0, Number(row.__dashboard_expression_count || 0)), 0)],
      ['personas','personas.csv','研究対象20名の固定Personaプロフィール','刺激条件・Persona属性の確認', emptyExport.personas.length],
      ['codebook','codebook.csv','全CSV列の定義・型・値域・分析用途','変数理解・共同研究・再現可能性', emptyExport.codebook.length],
    ] as const).map(([dataset,fileName,contains,analysisUse,rowCount]) => ({ dataset,fileName,contains,analysisUse,rowCount })),
  };
  return options.includeInternal
    ? { ...payload, __internal: { exportSessions: aggregateSessions } }
    : payload;
}

export function aggregateSchemaFields(): string[] {
  return [...RESEARCH_EXPORT_HEADERS.sessions];
}
