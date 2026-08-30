from __future__ import annotations

from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'missing replacement target: {label}')
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, repl: str, label: str, flags: int = 0) -> str:
    out, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f'regex replacement failed ({count}): {label}')
    return out


# -----------------------------------------------------------------------------
# 1. Shared types and persona research dictionary
# -----------------------------------------------------------------------------
types = read('src/types.ts')
types = replace_once(
    types,
    "export type DialogueDurationMinutes = 1 | 2 | 3 | 5;\n",
    "export type DialogueDurationMinutes = 1 | 2 | 3 | 5;\nexport type WorldEnglishesCircle = 'Inner' | 'Outer' | 'Expanding';\nexport type PersonaLabelCondition = 'shown' | 'hidden';\n",
    'world Englishes types',
)
types = replace_once(
    types,
    "  accentName: string;\n",
    "  accentName: string;\n  worldEnglishesCircle: WorldEnglishesCircle;\n",
    'persona circle field',
)
write('src/types.ts', types)

curriculum = read('src/data/curriculum.ts')
replacements = {
    "accentName: 'アメリカ英語 (General American)', voiceLang": "accentName: 'アメリカ英語 (General American)', worldEnglishesCircle: 'Inner', voiceLang",
    "accentName: 'イギリス英語 (British RP)', voiceLang": "accentName: 'イギリス英語 (British RP)', worldEnglishesCircle: 'Inner', voiceLang",
    "accentName: 'オーストラリア英語 (Australian English)', voiceLang": "accentName: 'オーストラリア英語 (Australian English)', worldEnglishesCircle: 'Inner', voiceLang",
    "accentName: 'カナダ英語 (Canadian English)', voiceLang": "accentName: 'カナダ英語 (Canadian English)', worldEnglishesCircle: 'Inner', voiceLang",
    "accentName: '中央ヨーロッパ英語 (Clear European English)', voiceLang": "accentName: '中央ヨーロッパ英語 (European English)', worldEnglishesCircle: 'Expanding', voiceLang",
    "accentName: '東ヨーロッパ英語 (Clear Polish Accent)', voiceLang": "accentName: '東ヨーロッパ英語 (Polish English Accent)', worldEnglishesCircle: 'Expanding', voiceLang",
    "accentName: '南アジア英語 (South Asian English)', voiceLang": "accentName: '南アジア英語 (South Asian English)', worldEnglishesCircle: 'Outer', voiceLang",
    "accentName: '東南アジア英語 (Southeast Asian English)', voiceLang": "accentName: '東南アジア英語 (Southeast Asian English)', worldEnglishesCircle: 'Expanding', voiceLang",
    "accentName: '東南アジア英語 (Clear Courteous English)', voiceLang": "accentName: '東南アジア英語 (Southeast Asian English)', worldEnglishesCircle: 'Expanding', voiceLang",
    "アメリカ・カリフォルニア出身。サーフィンとゲームが大好きで、明るい笑顔が魅力の留学生。クリアなアメリカ英語を話します！": "アメリカ・カリフォルニア出身。サーフィンとゲームが好きで、静岡のいちごにも関心がある留学生です。",
    "イギリス・オックスフォード出身。サッカーと紅茶が大好きで、とてもフレンドリー。伝統的なイギリス英語の響きが特徴です！": "イギリス・オックスフォード出身。サッカーと紅茶が好きで、日本文化にも関心がある留学生です。",
    "オーストラリア・シドニー出身。海と自然が大好きで、駿河湾の魚や海洋生物を研究しています。温かいオージー英語です！": "オーストラリア・シドニー出身。海と自然が好きで、駿河湾の魚や海洋生物を研究している留学生です。",
    "カナダ・バンクーバー出身。山や森の自然が好きで、富士山を見て大感動。とても優しく丁寧な英語で話してくれます！": "カナダ・バンクーバー出身。山や森の自然が好きで、富士山の景色にも関心がある留学生です。",
    "ハンガリー・ブダペスト出身。ルービックキューブやプログラミングが得意で、発音がとてもはっきりしていて聞き取りやすいです！": "ハンガリー・ブダペスト出身。ルービックキューブやプログラミングが好きな留学生です。",
    "ベトナム・ハノイ出身。バドミントンと静岡のみかんが大好き。やわらかく丁寧な英語で話してくれます！": "ベトナム・ハノイ出身。バドミントンと静岡のみかんが好きな留学生です。",
}
for old, new in replacements.items():
    if old not in curriculum:
        raise RuntimeError(f'curriculum target missing: {old[:45]}')
    curriculum = curriculum.replace(old, new, 1)
write('src/data/curriculum.ts', curriculum)

persona_research = r'''import { AI_STUDENTS_LIST } from './curriculum';
import type { AIStudentId, WorldEnglishesCircle } from '../types';

export const PERSONA_DICTIONARY_VERSION = 'persona-profile-v1';

export const GOOGLE_TTS_VOICES: Record<AIStudentId, { languageCode: string; name: string }> = {
  emma_usa: { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Aoede' },
  oliver_uk: { languageCode: 'en-GB', name: 'en-GB-Chirp3-HD-Orus' },
  liam_australia: { languageCode: 'en-AU', name: 'en-AU-Chirp3-HD-Puck' },
  chloe_canada: { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Kore' },
  bence_hungary: { languageCode: 'en-GB', name: 'en-GB-Chirp3-HD-Iapetus' },
  zofia_poland: { languageCode: 'en-GB', name: 'en-GB-Chirp3-HD-Leda' },
  rahul_bangladesh: { languageCode: 'en-IN', name: 'en-IN-Chirp3-HD-Orus' },
  linh_vietnam: { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Leda' },
  aung_myanmar: { languageCode: 'en-IN', name: 'en-IN-Chirp3-HD-Puck' },
};

const MAJOR_ENGLISH: Record<AIStudentId, { expression: string; keywords: string[] }> = {
  emma_usa: { expression: 'media and communication', keywords: ['media', 'communication', 'media communication'] },
  oliver_uk: { expression: 'environmental science and Japanese culture', keywords: ['environmental science', 'japanese culture'] },
  liam_australia: { expression: 'marine biology and conservation', keywords: ['marine biology', 'marine conservation', 'ocean conservation'] },
  chloe_canada: { expression: 'forest environment and international relations', keywords: ['forest environment', 'international relations'] },
  bence_hungary: { expression: 'information engineering and robotics', keywords: ['information engineering', 'robotics', 'programming'] },
  zofia_poland: { expression: 'architecture design and art history', keywords: ['architecture', 'architecture design', 'art history'] },
  rahul_bangladesh: { expression: 'agriculture and tea science', keywords: ['agriculture', 'tea science', 'tea research'] },
  linh_vietnam: { expression: 'language culture and tourism', keywords: ['language culture', 'tourism', 'international culture'] },
  aung_myanmar: { expression: 'history and Asian exchange studies', keywords: ['history', 'asian exchange', 'asian studies'] },
};

export type PersonaProfileField = 'likes' | 'major';
export type PersonaDictionaryEntry = {
  id: string;
  personaId: AIStudentId;
  profileField: PersonaProfileField;
  category: 'interest' | 'major';
  expression: string;
  japanese: string;
  keywords: string[];
};

function asciiLabel(value: string): string {
  return value.split('(')[0].replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();
}
function japaneseLabel(value: string): string {
  const match = value.match(/\(([^)]+)\)/);
  return match?.[1]?.trim() || '';
}
function keywordVariants(value: string): string[] {
  const phrase = value.toLowerCase().trim();
  const variants = new Set<string>([phrase]);
  if (phrase.endsWith('ies')) variants.add(`${phrase.slice(0, -3)}y`);
  else if (phrase.endsWith('s') && phrase.length > 4) variants.add(phrase.slice(0, -1));
  if (phrase.endsWith('ing') && phrase.length > 5) variants.add(phrase.slice(0, -3));
  return [...variants].filter(Boolean);
}

export const PERSONA_PROFILE_DICTIONARY: PersonaDictionaryEntry[] = AI_STUDENTS_LIST.flatMap((persona) => {
  const likes: PersonaDictionaryEntry[] = persona.likes.map((like, index) => {
    const expression = asciiLabel(like);
    return {
      id: `persona-${persona.id}-like-${index + 1}`,
      personaId: persona.id,
      profileField: 'likes',
      category: 'interest',
      expression,
      japanese: japaneseLabel(like),
      keywords: keywordVariants(expression),
    };
  });
  const major = MAJOR_ENGLISH[persona.id];
  return likes.concat({
    id: `persona-${persona.id}-major`,
    personaId: persona.id,
    profileField: 'major',
    category: 'major',
    expression: major.expression,
    japanese: persona.major,
    keywords: major.keywords,
  });
});

function normalize(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
}
function containsKeyword(text: string, keyword: string): boolean {
  const escaped = normalize(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, 'i').test(text);
}

export function detectPersonaProfileExpressions(text: string, personaId: string): PersonaDictionaryEntry[] {
  const normalized = normalize(String(text || ''));
  if (!normalized) return [];
  return PERSONA_PROFILE_DICTIONARY.filter((entry) => entry.personaId === personaId && entry.keywords.some((keyword) => containsKeyword(normalized, keyword)));
}

export function getPersonaResearchMetadata(personaId: string) {
  const persona = AI_STUDENTS_LIST.find((item) => item.id === personaId) || AI_STUDENTS_LIST[0];
  const cloudVoice = GOOGLE_TTS_VOICES[persona.id];
  return {
    personaId: persona.id,
    country: persona.country,
    gender: persona.gender,
    accentName: persona.accentName,
    worldEnglishesCircle: persona.worldEnglishesCircle as WorldEnglishesCircle,
    voiceLanguageCode: cloudVoice.languageCode,
    voiceName: cloudVoice.name,
    voiceGender: persona.voiceGender,
    voicePitch: persona.voicePitch,
    defaultVoiceRate: persona.voiceRate,
    personaDictionaryVersion: PERSONA_DICTIONARY_VERSION,
  };
}
'''
write('src/data/personaResearch.ts', persona_research)

# -----------------------------------------------------------------------------
# 2. Strict research-safe persistence contract
# -----------------------------------------------------------------------------
data = read('src/dataContract.ts')
data = data.replace("import { AIStudentId, ChatMessage, DialogueDurationMinutes, DialogueTopic, VisualVocabularyItem } from './types';", "import { AIStudentId, ChatMessage, DialogueDurationMinutes, DialogueTopic, PersonaLabelCondition, VisualVocabularyItem } from './types';")
data = data.replace("import { maskMessagesForExternalUse } from './utils/privacy';", "import { maskTextForResearchExport } from './utils/privacy';")
data = regex_once(
    data,
    r"export interface ReflectionAnswers \{.*?\n\}",
    "export interface ReflectionAnswers {\n  conveyedIdeas: 1 | 3 | 5;\n  understoodPartner: 1 | 3 | 5;\n  noticedLanguageCulture: 1 | 3 | 5;\n}",
    'reflection interface',
    re.S,
)
data = replace_once(
    data,
    "  'vocab_audio_play','speech_rate_change','ai_response_latency_ms','ai_request_failure',\n",
    "  'vocab_audio_play','speech_rate_change','ai_response_latency_ms','ai_request_failure',\n  'ai_model','ai_input_tokens','ai_output_tokens','ai_cache_read_tokens','ai_cache_creation_tokens','tts_provider','tts_effective_rate',\n",
    'research event types',
)
data = replace_once(
    data,
    "  systemEvents?: ResearchSystemEvent[];\n}",
    "  systemEvents?: ResearchSystemEvent[];\n  personaLabelCondition?: PersonaLabelCondition;\n  countryLabelVisible?: boolean;\n  accentLabelVisible?: boolean;\n  flagVisible?: boolean;\n  studentSelectedSpeechRate?: number;\n  effectiveTtsSpeechRate?: number;\n}",
    'session metadata input',
)
data = replace_once(
    data,
    "export function maskHistoryForStorage(history: ChatMessage[]): ChatMessage[] { return maskMessagesForExternalUse(history); }",
    "export function maskHistoryForStorage(history: ChatMessage[]): ChatMessage[] {\n  return history.map((message) => ({\n    ...message,\n    englishText: maskTextForResearchExport(message.englishText),\n    japaneseText: message.japaneseText ? maskTextForResearchExport(message.japaneseText) : message.japaneseText,\n    culturalNote: message.culturalNote ? maskTextForResearchExport(message.culturalNote) : message.culturalNote,\n  }));\n}",
    'strict storage mask',
)
data = regex_once(
    data,
    r"export function parseReflectionAnswers\(value: unknown\): ReflectionAnswers \| undefined \{.*?\n\}",
    """export function parseReflectionAnswers(value: unknown): ReflectionAnswers | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const source = value as Record<string, unknown>;
  const rating = (key: string): 1 | 3 | 5 | null => {
    const number = Number(source[key]);
    return number === 1 || number === 3 || number === 5 ? number : null;
  };
  const conveyedIdeas = rating('conveyedIdeas');
  const understoodPartner = rating('understoodPartner');
  const noticedLanguageCulture = rating('noticedLanguageCulture');
  if (conveyedIdeas === null || understoodPartner === null || noticedLanguageCulture === null) return undefined;
  return { conveyedIdeas, understoodPartner, noticedLanguageCulture };
}""",
    'reflection parser',
    re.S,
)
data = replace_once(
    data,
    "    reflection: parseReflectionAnswers(source.reflection),\n    systemEvents: parseResearchSystemEvents(source.systemEvents),\n",
    "    reflection: parseReflectionAnswers(source.reflection),\n    systemEvents: parseResearchSystemEvents(source.systemEvents),\n    personaLabelCondition: source.personaLabelCondition === 'hidden' ? 'hidden' : 'shown',\n    countryLabelVisible: source.countryLabelVisible !== false,\n    accentLabelVisible: source.accentLabelVisible !== false,\n    flagVisible: source.flagVisible !== false,\n    studentSelectedSpeechRate: Math.max(0.75, Math.min(1.25, Number(source.studentSelectedSpeechRate || 1))),\n    effectiveTtsSpeechRate: Math.max(0.75, Math.min(1.25, Number(source.effectiveTtsSpeechRate || source.studentSelectedSpeechRate || 1))),\n",
    'validated research metadata',
)
write('src/dataContract.ts', data)

# -----------------------------------------------------------------------------
# 3. Persistence: no repeated full-history query + provenance/persona snapshot
# -----------------------------------------------------------------------------
persistence = read('src/server/persistence.ts')
persistence = persistence.replace("import type { AIStudentId, ChatMessage, DialogueDurationMinutes, DialogueTopic, VisualVocabularyItem } from '../types';", "import type { AIStudentId, ChatMessage, DialogueDurationMinutes, DialogueTopic, PersonaLabelCondition, VisualVocabularyItem } from '../types';\nimport { getPersonaResearchMetadata } from '../data/personaResearch';")
persistence = replace_once(
    persistence,
    "  encounteredVocab: VisualVocabularyItem[]; reflection?: ReflectionAnswers; systemEvents?: ResearchSystemEvent[];\n}",
    "  encounteredVocab: VisualVocabularyItem[]; reflection?: ReflectionAnswers; systemEvents?: ResearchSystemEvent[];\n  personaLabelCondition?: PersonaLabelCondition; countryLabelVisible?: boolean; accentLabelVisible?: boolean; flagVisible?: boolean;\n  studentSelectedSpeechRate?: number; effectiveTtsSpeechRate?: number;\n}",
    'persistence args metadata',
)
persistence = replace_once(
    persistence,
    "  const studentSessions = await queryCollection(SESSION_COLLECTION, 'studentId', args.studentId, 5000);\n  const lifetimeSessionNumber = existing?.lifetimeSessionNumber || studentSessions.length + 1;\n  const localDate = new Date(args.startedAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });\n  const dailySessionNumber = existing?.dailySessionNumber || studentSessions.filter((session) => session.localDate === localDate).length + 1;\n",
    "  const studentSessions = existing ? [] : await queryCollection(SESSION_COLLECTION, 'studentId', args.studentId, 5000);\n  const lifetimeSessionNumber = existing?.lifetimeSessionNumber || studentSessions.length + 1;\n  const localDate = new Date(args.startedAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });\n  const dailySessionNumber = existing?.dailySessionNumber || studentSessions.filter((session) => session.localDate === localDate).length + 1;\n",
    'avoid repeated history read',
)
persistence = replace_once(
    persistence,
    "  const currentClassId = normalizeClassId(args.classId);\n  const document = {\n    schemaVersion: 3, sessionId: args.sessionId, studentId: args.studentId, researchId: args.researchId,\n",
    "  const currentClassId = normalizeClassId(args.classId);\n  const personaMeta = getPersonaResearchMetadata(args.aiStudentId);\n  const events = (args.systemEvents || []).slice(0, 500);\n  const eventValues = (type: string) => events.filter((event) => event.type === type).map((event) => Number(event.value || 0)).filter(Number.isFinite);\n  const sumEvent = (type: string) => eventValues(type).reduce((sum, value) => sum + value, 0);\n  const latestEvent = (type: string) => [...events].reverse().find((event) => event.type === type)?.value || '';\n  const document = {\n    schemaVersion: 4, researchSchemaVersion: 'research-2026-v1', sessionId: args.sessionId, studentId: args.studentId, researchId: args.researchId,\n",
    'persistence provenance setup',
)
persistence = replace_once(
    persistence,
    "    classId: currentClassId, academicYear: academicYearForLocalDate(localDate), gradeLevel: gradeLevelForClassId(currentClassId), aiStudentId: args.aiStudentId, topic: args.topic,\n",
    "    classId: currentClassId, academicYear: academicYearForLocalDate(localDate), gradeLevel: gradeLevelForClassId(currentClassId), aiStudentId: args.aiStudentId, topic: args.topic,\n    appVersion: process.env.APP_VERSION || 'unknown', build: process.env.APP_BUILD || 'unknown', aiModel: latestEvent('ai_model') || process.env.ANTHROPIC_MODEL || 'unknown',\n    aiInputTokens: sumEvent('ai_input_tokens'), aiOutputTokens: sumEvent('ai_output_tokens'), aiCacheReadTokens: sumEvent('ai_cache_read_tokens'), aiCacheCreationTokens: sumEvent('ai_cache_creation_tokens'),\n    personaId: personaMeta.personaId, personaCountry: personaMeta.country, personaGender: personaMeta.gender, personaAccentName: personaMeta.accentName, worldEnglishesCircle: personaMeta.worldEnglishesCircle,\n    personaLabelCondition: args.personaLabelCondition === 'hidden' ? 'hidden' : 'shown', countryLabelVisible: args.countryLabelVisible !== false, accentLabelVisible: args.accentLabelVisible !== false, flagVisible: args.flagVisible !== false,\n    ttsProvider: latestEvent('tts_provider') || 'not_observed', ttsVoiceName: personaMeta.voiceName, ttsLanguageCode: personaMeta.voiceLanguageCode, personaVoiceGender: personaMeta.voiceGender, personaVoicePitch: personaMeta.voicePitch, personaDefaultVoiceRate: personaMeta.defaultVoiceRate,\n    studentSelectedSpeechRate: Number(args.studentSelectedSpeechRate || 1), effectiveTtsSpeechRate: Number(latestEvent('tts_effective_rate') || args.effectiveTtsSpeechRate || args.studentSelectedSpeechRate || 1), personaDictionaryVersion: personaMeta.personaDictionaryVersion,\n",
    'persistence persona fields',
)
persistence = persistence.replace("history: safeHistory, systemEvents: (args.systemEvents || []).slice(0, 500),", "history: safeHistory, systemEvents: events,")
write('src/server/persistence.ts', persistence)

# -----------------------------------------------------------------------------
# 4. Research export: optimized grouping + persona dictionary/condition columns
# -----------------------------------------------------------------------------
research_export = r'''import { analyzeChildCommunication, countEnglishWords } from '../dataContract';
import { detectPersonaProfileExpressions, getPersonaResearchMetadata, PERSONA_DICTIONARY_VERSION } from '../data/personaResearch';
import { detectVocabularyInText } from '../data/vocabulary56';
import type { ChatMessage, VisualVocabularyItem } from '../types';
import { maskTextForResearchExport } from '../utils/privacy';

export type ResearchDatasetName = 'sessions' | 'turns' | 'expressions' | 'system_events';
type UsageContext = 'in_class' | 'out_of_class_school_hours' | 'out_of_school_hours' | 'non_school_day' | 'unknown';
type ContextMeta = { localDate:string; localStartTime:string; localEndTime:string; localStartedAt:string; localEndedAt:string; weekday:string; weekdayFlag:number; schoolHoursFlag:number; sameClassStarts5Min:number; sameClassStarts10Min:number; usageContext:UsageContext; usageContextConfidence:'high'|'medium'|'low' };

const CLASSIFICATION_RULE_VERSION='time-cluster-v2';
const SCHOOL_START_MINUTE=7*60+30; const SCHOOL_END_MINUTE=15*60; const CLASS_CLUSTER_5_MIN=8; const CLASS_CLUSTER_10_MIN=12;
function timestampMs(value:unknown):number{if(typeof value==='number'&&Number.isFinite(value))return value;if(typeof value==='string'&&value.trim()){const p=Date.parse(value);if(Number.isFinite(p))return p;}return 0;}
function sessionHistory(session:Record<string,any>):ChatMessage[]{return Array.isArray(session.history)?session.history.filter((m):m is ChatMessage=>Boolean(m&&typeof m==='object'&&typeof m.englishText==='string')):[];}
function tokyoParts(value:unknown){const ms=timestampMs(value);if(!ms)return{date:'',time:'',weekday:'',minuteOfDay:-1,valid:false};const date=new Date(ms);const f=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',weekday:'short'});const parts=Object.fromEntries(f.formatToParts(date).map((p)=>[p.type,p.value]));const h=Number(parts.hour),m=Number(parts.minute);return{date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}:${parts.second}`,weekday:parts.weekday||'',minuteOfDay:Number.isFinite(h)&&Number.isFinite(m)?h*60+m:-1,valid:true};}
function lowerBound(a:number[],x:number){let l=0,r=a.length;while(l<r){const m=(l+r)>>1;if(a[m]<x)l=m+1;else r=m;}return l;}
function upperBound(a:number[],x:number){let l=0,r=a.length;while(l<r){const m=(l+r)>>1;if(a[m]<=x)l=m+1;else r=m;}return l;}
function buildContextMeta(sessions:Record<string,any>[]):Map<string,ContextMeta>{
 const items=sessions.map(session=>({session,sessionId:String(session.sessionId||''),classId:String(session.classId||''),startMs:timestampMs(session.startedAt)||timestampMs(session.endedAt)}));
 const byClass=new Map<string,number[]>(); for(const item of items){if(item.classId&&item.startMs>0){const arr=byClass.get(item.classId)||[];arr.push(item.startMs);byClass.set(item.classId,arr);}} for(const arr of byClass.values())arr.sort((a,b)=>a-b);
 const result=new Map<string,ContextMeta>();
 for(const item of items){const start=tokyoParts(item.startMs),end=tokyoParts(item.session.endedAt||item.session.startedAt);const times=item.classId?(byClass.get(item.classId)||[]):[];const count=(window:number)=>item.startMs>0?upperBound(times,item.startMs+window)-lowerBound(times,item.startMs-window):0;const same5=count(5*60_000),same10=count(10*60_000);const weekdayFlag=start.valid&&!['Sat','Sun'].includes(start.weekday)?1:0;const schoolHoursFlag=weekdayFlag&&start.minuteOfDay>=SCHOOL_START_MINUTE&&start.minuteOfDay<SCHOOL_END_MINUTE?1:0;let usageContext:UsageContext='unknown',confidence:ContextMeta['usageContextConfidence']='low';if(start.valid){if(!weekdayFlag){usageContext='non_school_day';confidence='high';}else if(!schoolHoursFlag){usageContext='out_of_school_hours';confidence='high';}else if(!item.classId){usageContext='unknown';}else if(same5>=CLASS_CLUSTER_5_MIN){usageContext='in_class';confidence='high';}else if(same10>=CLASS_CLUSTER_10_MIN){usageContext='in_class';confidence='medium';}else usageContext='out_of_class_school_hours';}
 result.set(item.sessionId,{localDate:start.date,localStartTime:start.time,localEndTime:end.time,localStartedAt:start.valid?`${start.date} ${start.time}`:'',localEndedAt:end.valid?`${end.date} ${end.time}`:'',weekday:start.weekday,weekdayFlag,schoolHoursFlag,sameClassStarts5Min:same5,sameClassStarts10Min:same10,usageContext,usageContextConfidence:confidence});}
 return result;
}
function curriculumMatches(history:ChatMessage[]){const child=new Map<string,VisualVocabularyItem>(),ai=new Map<string,VisualVocabularyItem>();for(const m of history)for(const item of detectVocabularyInText(m.englishText||''))(m.sender==='child'?child:ai).set(item.id,item);return{child,ai,all:new Set([...child.keys(),...ai.keys()])};}
function questionType(text:string):string{const n=text.trim().toLowerCase();if(/\b(how about you|what about you|and you)\b/.test(n))return'reciprocal';if(/^(what|where|when|who|why|how|which)\b/.test(n))return'wh';if(/^(do|does|did|can|could|are|is|am|have|has|would|will)\b/.test(n))return'yes_no';if(/\?$/.test(n))return'other_question';return'';}
function turnFlags(message:ChatMessage){if(message.sender!=='child')return{isQuestion:0,questionType:'',isReciprocal:0,isRepair:0,isReason:0};const one=analyzeChildCommunication([message]);return{isQuestion:one.childQuestionCount>0?1:0,questionType:questionType(message.englishText),isReciprocal:one.childReciprocalQuestionCount>0?1:0,isRepair:one.childRepairCount>0?1:0,isReason:one.childReasonExpressionCount>0?1:0};}
function previousSessionDays(sessions:Record<string,any>[]):Map<string,number|''>{const by=new Map<string,Record<string,any>[]>();for(const s of sessions){const id=String(s.researchId||'');if(!id)continue;const list=by.get(id)||[];list.push(s);by.set(id,list);}const out=new Map<string,number|''>();for(const list of by.values()){list.sort((a,b)=>timestampMs(a.startedAt)-timestampMs(b.startedAt));let prev=0;for(const s of list){const cur=timestampMs(s.startedAt);out.set(String(s.sessionId||''),prev&&cur?Math.round(((cur-prev)/86_400_000)*100)/100:'');if(cur)prev=cur;}}return out;}
function sessionSequenceNumbers(sessions:Record<string,any>[]):Map<string,{lifetime:number;daily:number}>{const by=new Map<string,Record<string,any>[]>();for(const s of sessions){const id=String(s.researchId||'');if(!id)continue;const list=by.get(id)||[];list.push(s);by.set(id,list);}const out=new Map<string,{lifetime:number;daily:number}>();for(const list of by.values()){list.sort((a,b)=>(timestampMs(a.startedAt)-timestampMs(b.startedAt))||String(a.sessionId||'').localeCompare(String(b.sessionId||'')));const daily=new Map<string,number>();list.forEach((s,i)=>{const d=tokyoParts(s.startedAt||s.endedAt).date;const n=(daily.get(d)||0)+1;daily.set(d,n);out.set(String(s.sessionId||''),{lifetime:i+1,daily:n});});}return out;}
function academicYearFromDate(localDate:string):number|''{const[y,m]=localDate.split('-').map(Number);return Number.isInteger(y)&&Number.isInteger(m)?(m>=4?y:y-1):'';}
function gradeFromClassId(classId:unknown):number|''{const v=String(classId||'');return v.startsWith('5-')?5:v.startsWith('6-')?6:'';}
function commonFields(session:Record<string,any>,meta:ContextMeta){return{research_id:session.researchId||'',class_id:session.classId||'',session_id:session.sessionId||'',academic_year:session.academicYear||academicYearFromDate(meta.localDate),grade_level:session.gradeLevel||gradeFromClassId(session.classId),local_date:meta.localDate,local_start_time:meta.localStartTime,local_end_time:meta.localEndTime,weekday:meta.weekday,usage_context_inferred:meta.usageContext};}

export function buildResearchDataSets(sessions:Record<string,any>[]){
 const context=buildContextMeta(sessions),previousDays=previousSessionDays(sessions),sequenceNumbers=sessionSequenceNumbers(sessions);const sessionRows:Record<string,unknown>[]=[],turnRows:Record<string,unknown>[]=[],expressionRows:Record<string,unknown>[]=[],eventRows:Record<string,unknown>[]=[];
 for(const session of sessions){const sessionId=String(session.sessionId||'');const meta=context.get(sessionId)||{localDate:'',localStartTime:'',localEndTime:'',localStartedAt:'',localEndedAt:'',weekday:'',weekdayFlag:0,schoolHoursFlag:0,sameClassStarts5Min:0,sameClassStarts10Min:0,usageContext:'unknown' as UsageContext,usageContextConfidence:'low' as const};const history=sessionHistory(session),communication=analyzeChildCommunication(history),curriculum=curriculumMatches(history),childMessages=history.filter(m=>m.sender==='child'),systemEvents=Array.isArray(session.systemEvents)?session.systemEvents:[],hasReflection=Boolean(session.reflection&&typeof session.reflection==='object'),hasFinish=systemEvents.some((e:any)=>e?.type==='session_finish'),schemaVersion=Number(session.schemaVersion||0),dialogueCompleted=hasFinish||(Boolean(session.endedAt)&&hasReflection)||(Boolean(session.endedAt)&&schemaVersion<3&&childMessages.length>0),dataQuality=!sessionId||!session.researchId||history.length===0||childMessages.length===0?'missing_core':!dialogueCompleted?'interrupted':!hasReflection?'missing_reflection':'complete',sessionStatus=dialogueCompleted?(hasReflection?'complete':'dialogue_complete'):'in_progress_or_interrupted';const persona=getPersonaResearchMetadata(String(session.personaId||session.aiStudentId||''));
 sessionRows.push({research_id:session.researchId||'',class_id:session.classId||'',session_id:sessionId,schema_version:session.schemaVersion||2,research_schema_version:session.researchSchemaVersion||'',app_version:session.appVersion||'',build:session.build||'',ai_model:session.aiModel||'',ai_input_tokens:session.aiInputTokens||0,ai_output_tokens:session.aiOutputTokens||0,ai_cache_read_tokens:session.aiCacheReadTokens||0,ai_cache_creation_tokens:session.aiCacheCreationTokens||0,academic_year:session.academicYear||academicYearFromDate(meta.localDate),grade_level:session.gradeLevel||gradeFromClassId(session.classId),local_date:meta.localDate,local_start_time:meta.localStartTime,local_end_time:meta.localEndTime,local_started_at:meta.localStartedAt,local_ended_at:meta.localEndedAt,weekday:meta.weekday,weekday_flag:meta.weekdayFlag,school_hours_flag:meta.schoolHoursFlag,same_class_starts_5min:meta.sameClassStarts5Min,same_class_starts_10min:meta.sameClassStarts10Min,usage_context_inferred:meta.usageContext,usage_context_confidence:meta.usageContextConfidence,classification_rule_version:CLASSIFICATION_RULE_VERSION,lifetime_session_number:sequenceNumbers.get(sessionId)?.lifetime||0,daily_session_number:sequenceNumbers.get(sessionId)?.daily||0,source_lifetime_session_number:session.lifetimeSessionNumber||0,source_daily_session_number:session.dailySessionNumber||0,days_since_previous_session:previousDays.get(sessionId)??'',persona_id:session.personaId||persona.personaId,persona_country:session.personaCountry||persona.country,persona_gender:session.personaGender||persona.gender,accent_name:session.personaAccentName||persona.accentName,accent_circle:session.worldEnglishesCircle||persona.worldEnglishesCircle,persona_label_condition:session.personaLabelCondition||'shown',country_label_visible:session.countryLabelVisible===false?0:1,accent_label_visible:session.accentLabelVisible===false?0:1,flag_visible:session.flagVisible===false?0:1,tts_provider:session.ttsProvider||'',tts_voice_name:session.ttsVoiceName||persona.voiceName,tts_language_code:session.ttsLanguageCode||persona.voiceLanguageCode,persona_voice_gender:session.personaVoiceGender||persona.voiceGender,persona_voice_pitch:session.personaVoicePitch??persona.voicePitch,persona_default_voice_rate:session.personaDefaultVoiceRate??persona.defaultVoiceRate,student_selected_speech_rate:session.studentSelectedSpeechRate??1,effective_tts_speech_rate:session.effectiveTtsSpeechRate??1,persona_dictionary_version:session.personaDictionaryVersion||PERSONA_DICTIONARY_VERSION,ai_student_id:session.aiStudentId||'',topic:session.topic||'',target_duration_minutes:session.targetDurationMinutes||0,actual_duration_seconds:session.actualDurationSeconds||0,child_turn_count:communication.totalTurns,child_total_words:communication.totalChildWords,total_turns:communication.totalTurns,total_child_words:communication.totalChildWords,mean_child_words_per_turn:communication.meanChildWordsPerTurn,max_child_words_per_turn:communication.maxChildWordsPerTurn,child_unique_word_types:communication.childUniqueWordTypes,child_question_count:communication.childQuestionCount,child_reciprocal_question_count:communication.childReciprocalQuestionCount,child_repair_count:communication.childRepairCount,child_reason_expression_count:communication.childReasonExpressionCount,child_curriculum_vocab_count:curriculum.child.size,ai_curriculum_vocab_count:curriculum.ai.size,encountered_curriculum_vocab_count:curriculum.all.size,unique_vocabulary_count:curriculum.all.size,legacy_unique_vocabulary_count:session.uniqueVocabularyCount??'',reflection_conveyed_ideas:session.reflection?.conveyedIdeas??'',reflection_understood_partner:session.reflection?.understoodPartner??'',reflection_noticed_language_culture:session.reflection?.noticedLanguageCulture??'',system_event_count:systemEvents.length,session_completed:dialogueCompleted?1:0,session_status:sessionStatus,data_quality_flag:dataQuality});
 const speakerCounts={child:0,ai:0};history.forEach((message,index)=>{speakerCounts[message.sender]+=1;const flags=turnFlags(message),local=tokyoParts(message.timestamp),previousText=index>0?history[index-1]?.englishText||'':'';let researchEnglish=maskTextForResearchExport(message.englishText||''),researchJapanese=maskTextForResearchExport(message.japaneseText||'');if(message.sender==='child'&&/what(?:'|’)s your name|what is your name/i.test(previousText)){researchEnglish=researchEnglish.replace(/^\s*(i(?:'|’)m|i am)\s+.{1,40}?(?=\s+(?:and|but|how|what|where|when|i|my)\b|[,.!?]|$)/i,'$1 [name omitted]');researchJapanese=researchJapanese.replace(/^\s*(私は|わたしは|僕は|ぼくは)\s*[^。！？,.]{1,30}?(です|だよ)(?=[。！？,.]|$)/,'$1 [name omitted] $2');}
 turnRows.push({...commonFields(session,meta),turn_sequence:index+1,speaker_turn_number:speakerCounts[message.sender],speaker:message.sender,local_timestamp:local.valid?`${local.date} ${local.time}`:'',english_text_anonymized:researchEnglish,japanese_translation:researchJapanese,word_count:countEnglishWords(message.englishText||''),is_question:flags.isQuestion,question_type:flags.questionType,is_reciprocal_question:flags.isReciprocal,is_repair:flags.isRepair,is_reason_expression:flags.isReason});
 for(const item of detectVocabularyInText(message.englishText||'')){const unit=String(item.mitsumuraUnit||'');expressionRows.push({...commonFields(session,meta),turn_sequence:index+1,speaker:message.sender,dictionary_source:'curriculum',expression_id:item.id,expression:item.word,japanese:item.japanese,expression_category:item.category,curriculum_grade:unit.includes('6年')?'6':unit.includes('5年')?'5':'',curriculum_unit:unit,persona_id:persona.personaId,profile_field:'',persona_category:'',persona_dictionary_version:session.personaDictionaryVersion||PERSONA_DICTIONARY_VERSION});}
 for(const item of detectPersonaProfileExpressions(message.englishText||'',persona.personaId)){expressionRows.push({...commonFields(session,meta),turn_sequence:index+1,speaker:message.sender,dictionary_source:'persona',expression_id:item.id,expression:item.expression,japanese:item.japanese,expression_category:item.category,curriculum_grade:'',curriculum_unit:'',persona_id:item.personaId,profile_field:item.profileField,persona_category:item.category,persona_dictionary_version:session.personaDictionaryVersion||PERSONA_DICTIONARY_VERSION});}
 });
 systemEvents.slice(0,500).forEach((event:any,index:number)=>{const local=tokyoParts(event?.timestamp);eventRows.push({...commonFields(session,meta),event_sequence:index+1,local_timestamp:local.valid?`${local.date} ${local.time}`:'',event_type:typeof event?.type==='string'?event.type:'',event_value:typeof event?.value==='string'?event.value:''});});
 }
 return{sessions:sessionRows,turns:turnRows,expressions:expressionRows,system_events:eventRows} satisfies Record<ResearchDatasetName,Record<string,unknown>[]>;
}
'''
write('src/server/researchExport.ts', research_export)

# -----------------------------------------------------------------------------
# 5. Researcher-only management page
# -----------------------------------------------------------------------------
management_page = r'''export function managementPageHtml(): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI留学生 研究データ管理</title><style>
*{box-sizing:border-box}body{margin:0;background:#f7faff;color:#10224a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif}.wrap{max-width:1180px;margin:0 auto;padding:20px}.card{background:#fff;border:1px solid #d7e2f1;border-radius:18px;padding:18px;box-shadow:0 5px 20px rgba(32,73,128,.06)}.login{min-height:82vh;display:grid;place-items:center}.login .card{width:min(430px,94vw);padding:30px}.logo{width:48px;height:48px;border-radius:14px;background:#245bd7;color:white;display:grid;place-items:center;font-size:24px;font-weight:900;margin:auto}.field{margin:14px 0}.field label{display:block;font-size:12px;font-weight:800;margin-bottom:5px}input,select,button{font:inherit}input,select{width:100%;padding:10px;border:1px solid #b8c7df;border-radius:9px;background:#fff}button{border-radius:9px;padding:10px 14px;font-weight:800;cursor:pointer}.primary{border:1px solid #245bd7;background:#245bd7;color:#fff}.secondary{border:1px solid #9ab4df;background:#fff;color:#174aa8}.danger{border:1px solid #d4dbe7;background:#fff;color:#526581}.top{display:flex;gap:12px;align-items:center;justify-content:space-between;margin-bottom:14px}.brand{display:flex;gap:10px;align-items:center}.brand .logo{margin:0}.title{margin:0;font-size:22px}.muted{font-size:11px;color:#64748b}.actions{display:flex;gap:8px;flex-wrap:wrap}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 0}.metric{text-align:center}.metric b{display:block;font-size:26px;margin-top:4px}.filters{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 0}.filters label{font-size:11px;font-weight:800}.exports{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.status{margin-top:10px;font-size:12px;font-weight:800;color:#174aa8}.error{color:#b91c1c}.version{margin-top:14px;text-align:center;color:#94a3b8;font-size:10px}.note{background:#eef4ff;border:1px solid #bfd0f5;border-radius:12px;padding:12px;font-size:12px;font-weight:700;line-height:1.6}.classes{margin-top:8px;font-size:12px;line-height:1.8}@media(max-width:760px){.top{align-items:flex-start;flex-direction:column}.metrics,.filters,.exports{grid-template-columns:1fr 1fr}}@media(max-width:480px){.metrics,.filters,.exports{grid-template-columns:1fr}}
</style></head><body><div class="wrap"><div id="login" class="login"><div><div class="card"><div class="logo">◎</div><h1 style="text-align:center">研究データ管理</h1><p class="muted" style="text-align:center">匿名化された研究データ専用</p><div class="field"><label>研究者ID</label><input id="u" autocomplete="username"></div><div class="field"><label>パスワード</label><input id="p" type="password" autocomplete="current-password"></div><button id="loginBtn" class="primary" style="width:100%">ログイン</button><p id="msg" class="status"></p></div><p id="managementVersionFooter" class="version"></p></div></div>
<div id="panel" style="display:none"><header class="top"><div class="brand"><div class="logo">◎</div><div><h1 class="title">AI留学生えいご対話</h1><div class="muted">研究者用・匿名化データ</div></div></div><div class="actions"><span id="who" class="muted"></span><button id="refreshBtn" class="secondary">↻ 更新</button><button id="logoutBtn" class="danger">ログアウト</button></div></header><div class="note">児童の学習者IDや氏名を表示しません。研究用ID（research_id）と匿名化された発話データのみをExportします。</div>
<div class="metrics"><div class="card metric"><span>セッション</span><b id="mSessions">-</b></div><div class="card metric"><span>完全ケース</span><b id="mComplete">-</b></div><div class="card metric"><span>研究ID数</span><b id="mResearch">-</b></div><div class="card metric"><span>最終日</span><b id="mLatest" style="font-size:18px">-</b></div></div>
<div class="card"><h2>研究データExport</h2><div class="filters"><label>開始日<input id="start" type="date"></label><label>終了日<input id="end" type="date"></label><label>学級<select id="classId"><option value="all">すべて</option></select></label><label>完全ケース<select id="completeOnly"><option value="0">すべて</option><option value="1">completeのみ</option></select></label></div><div class="exports"><button class="primary" data-dataset="bundle">一括ZIP</button><button class="secondary" data-dataset="sessions">sessions.csv</button><button class="secondary" data-dataset="turns">turns.csv</button><button class="secondary" data-dataset="expressions">expressions.csv</button><button class="secondary" data-dataset="system_events">system_events.csv</button></div><p id="exportStatus" class="status"></p></div><div class="card" style="margin-top:12px"><h2>学級別件数</h2><div id="classes" class="classes">-</div></div><p id="panelVersion" class="version"></p></div></div>
<script>const $=id=>document.getElementById(id);let role='';async function json(url,opt){const r=await fetch(url,opt);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||('HTTP '+r.status));return d}async function health(){try{const d=await json('/api/health');const t='Version '+(d.appVersion||'unknown')+' / Build '+(d.build||'unknown');$('managementVersionFooter').textContent=t;$('panelVersion').textContent=t}catch{}}async function summary(){const d=await json('/api/management/research.summary');$('mSessions').textContent=d.totalSessions;$('mComplete').textContent=d.completeSessions;$('mResearch').textContent=d.researchIdCount;$('mLatest').textContent=d.latestDate||'-';const s=$('classId'),current=s.value;s.innerHTML='<option value="all">すべて</option>'+Object.keys(d.classCounts||{}).sort().map(k=>'<option value="'+k+'">'+k+'</option>').join('');s.value=[...s.options].some(o=>o.value===current)?current:'all';$('classes').innerHTML=Object.entries(d.classCounts||{}).map(([k,v])=>'<b>'+k+'</b>: '+v+' sessions').join('<br>')||'データなし'}function query(dataset){const p=new URLSearchParams();if(dataset!=='bundle')p.set('dataset',dataset);if($('start').value)p.set('start',$('start').value);if($('end').value)p.set('end',$('end').value);if($('classId').value&&$('classId').value!=='all')p.set('classId',$('classId').value);if($('completeOnly').value==='1')p.set('completeOnly','1');return(dataset==='bundle'?'/api/management/research.bundle.zip':'/api/management/research.csv')+'?'+p.toString()}$('loginBtn').onclick=async()=>{try{const d=await json('/api/management/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:$('u').value,password:$('p').value})});role=d.role;if(role!=='researcher')throw new Error('RESEARCHER_ONLY');$('login').style.display='none';$('panel').style.display='block';$('who').textContent='researcher';await summary()}catch(e){$('msg').textContent='ログインできません: '+e.message;$('msg').className='status error'}};$('logoutBtn').onclick=async()=>{await fetch('/api/management/logout',{method:'POST'});location.reload()};$('refreshBtn').onclick=()=>summary().catch(e=>$('exportStatus').textContent=e.message);document.querySelectorAll('[data-dataset]').forEach(b=>b.onclick=()=>{const d=b.dataset.dataset;$('exportStatus').textContent='ダウンロードを開始します';location.href=query(d)});health();</script></body></html>`;
}
'''
write('src/server/managementPage.ts', management_page)

# Build server no longer mutates management source at bundle time.
write('scripts/build-server.ts', """import { build } from 'esbuild';
await build({ entryPoints: ['server.ts'], bundle: true, platform: 'node', format: 'cjs', packages: 'external', sourcemap: true, outfile: 'dist/server.cjs' });
console.log('[build] server bundle complete');
""")

# -----------------------------------------------------------------------------
# 6. Server: Sonnet 5 medium/cache, TTS cache, research-only admin, safe limits
# -----------------------------------------------------------------------------
server = read('server.ts')
server = server.replace("import { getAIStudentById } from './src/data/curriculum';", "import { getAIStudentById } from './src/data/curriculum';\nimport { GOOGLE_TTS_VOICES } from './src/data/personaResearch';")
server = server.replace("import { createStudentCode, getAllSessionsForManagement, getTeacherSessionsForManagement, getStudentHistory, getStudentRecordsForManagement, reissueStudentCode, setStudentActive, updateStudentClass, persistenceConfigured, resolveStudentByCode, saveCanonicalSession } from './src/server/persistence';", "import { getAllSessionsForManagement, getStudentHistory, persistenceConfigured, resolveStudentByCode, saveCanonicalSession } from './src/server/persistence';")
server = regex_once(server, r"const GOOGLE_TTS_VOICES: Record<string, \{ languageCode: string; name: string \}> = \{.*?\n\};\n", "", 'remove duplicated TTS map', re.S)
server = server.replace("      maxRetries: 3,", "      maxRetries: 0,")
server = regex_once(
    server,
    r"async function callClaudeJson\(system: string, prompt: string, maxTokens: number\) \{.*?\n\}\n\nexport \{ maskHighRiskPII",
    r'''async function callClaudeJson(system: string, prompt: string, maxTokens: number) {
  const client = getAnthropicClient();
  if (!client) throw new Error('API_KEY_NOT_CONFIGURED');
  const configured = process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-5';
  const models = Array.from(new Set([configured, 'claude-sonnet-4-6']));
  let lastError: any = null;
  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];
    try {
      if (index > 0) await sleep(250 + Math.floor(Math.random() * 350));
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        output_config: { effort: 'medium' },
        cache_control: { type: 'ephemeral' },
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: prompt }],
      } as any);
      const rawText = response.content.filter((block: any) => block.type === 'text').map((block: any) => ('text' in block ? block.text : '')).join('').trim();
      const u: any = response.usage || {};
      return {
        parsed: extractJson(rawText), model,
        usage: {
          inputTokens: Number(u.input_tokens || 0), outputTokens: Number(u.output_tokens || 0),
          cacheReadTokens: Number(u.cache_read_input_tokens || 0), cacheCreationTokens: Number(u.cache_creation_input_tokens || 0),
        },
      };
    } catch (error: any) {
      lastError = error;
      if (index === 0 && !isRetryable(error) && Number(error?.status || 0) !== 400) break;
    }
  }
  throw lastError || new Error('AI_UNAVAILABLE');
}

export { maskHighRiskPII''',
    'Claude call implementation',
    re.S,
)
server = server.replace("    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',", "    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',\n    appVersion: process.env.APP_VERSION || 'unknown',\n    build: process.env.APP_BUILD || 'unknown',")
server = server.replace("    resilience: 'multi-retry-model-fallback',", "    resilience: 'single-attempt-model-fallback',")

# TTS in-memory cache and request de-duplication.
insert_after = "let googleAccessToken: { token: string; expiresAt: number } | null = null;\n"
tts_cache_code = """
const TTS_CACHE_TTL_MS = 20 * 60_000;
const ttsAudioCache = new Map<string, { audio: Buffer; expiresAt: number }>();
const ttsPending = new Map<string, Promise<Buffer>>();
function ttsCacheKey(text: string, aiStudentId: string, speakingRate: number): string { return `${aiStudentId}|${speakingRate.toFixed(2)}|${text}`; }
async function cachedGoogleTts(text: string, aiStudentId: string, speakingRate: number): Promise<{ audio: Buffer; cache: 'HIT' | 'MISS' }> {
  const key = ttsCacheKey(text, aiStudentId, speakingRate); const now = Date.now(); const hit = ttsAudioCache.get(key);
  if (hit && hit.expiresAt > now) return { audio: hit.audio, cache: 'HIT' };
  if (hit) ttsAudioCache.delete(key);
  const pending = ttsPending.get(key); if (pending) return { audio: await pending, cache: 'HIT' };
  const task = synthesizeGoogleTts(text, aiStudentId, speakingRate).then((audio) => { ttsAudioCache.set(key, { audio, expiresAt: Date.now() + TTS_CACHE_TTL_MS }); return audio; }).finally(() => ttsPending.delete(key));
  ttsPending.set(key, task); return { audio: await task, cache: 'MISS' };
}
"""
server = replace_once(server, insert_after, insert_after + tts_cache_code, 'TTS cache insertion')
server = server.replace("Math.max(\n    0.8,\n    Math.min(1.15, Number.isFinite(requestedRate) ? requestedRate : 1.0)\n  );", "Math.max(\n    0.75,\n    Math.min(1.25, Number.isFinite(requestedRate) ? requestedRate : 1.0)\n  );")
server = replace_once(server, "    const audio = await synthesizeGoogleTts(text, aiStudentId, speakingRate);\n", "    const { audio, cache } = await cachedGoogleTts(text, aiStudentId, speakingRate);\n", 'TTS cached call')
server = replace_once(server, "    res.setHeader('Cache-Control', 'no-store');\n    res.setHeader('X-TTS-Provider', 'google-chirp3-hd');", "    res.setHeader('Cache-Control', 'private, max-age=900');\n    res.setHeader('X-TTS-Provider', 'google-chirp3-hd');\n    res.setHeader('X-TTS-Cache', cache);\n    res.setHeader('X-TTS-Effective-Rate', speakingRate.toFixed(2));", 'TTS response headers')

# Chat diagnostics with model/token/cache usage.
server = server.replace("const { parsed, model } = await callClaudeJson(getSystemInstructionForPersona(aiStudentId), prompt, 300);", "const { parsed, model, usage } = await callClaudeJson(getSystemInstructionForPersona(aiStudentId), prompt, 300);")
server = replace_once(server, "        model,\n        latencyMs: Date.now() - requestStart,", "        model,\n        usage,\n        latencyMs: Date.now() - requestStart,", 'chat usage diagnostics')

# Replace student/management route block up to csvCell with school-safe learner behavior and researcher-only auth.
server = regex_once(
    server,
    r"const sensitiveAttemptMap = new Map<string, \{ count: number; resetTime: number \}>\(\);.*?function csvCell\(value:unknown\):string\{",
    r'''const sensitiveAttemptMap = new Map<string, { count: number; resetTime: number }>();
function checkSensitiveLimit(key: string, maxRequests: number, windowMs: number): boolean { const now=Date.now();const record=sensitiveAttemptMap.get(key);if(!record||now>record.resetTime){sensitiveAttemptMap.set(key,{count:1,resetTime:now+windowMs});return true;}if(record.count>=maxRequests)return false;record.count+=1;return true; }
function registerFailedCodeAttempt(ip:string):boolean{return checkSensitiveLimit(`student-fail:${ip}`,30,10*60_000);}
app.get('/management', (_req,res)=>{res.setHeader('Cache-Control','no-store');res.type('html').send(managementPageHtml());});
app.post('/api/student/resolve',async(req,res)=>{const ip=req.ip||req.socket.remoteAddress||'unknown';if(!persistenceConfigured())return res.status(503).json({success:false,error:'PERSISTENCE_NOT_CONFIGURED'});if(!isValidLearningCode(req.body?.learningCode)){registerFailedCodeAttempt(ip);return res.status(400).json({success:false,error:'INVALID_LEARNING_CODE'});}const learningCode=normalizeLearningCode(req.body.learningCode);try{const student=await resolveStudentByCode(learningCode);if(!student){const allowed=registerFailedCodeAttempt(ip);return res.status(allowed?401:429).json({success:false,error:allowed?'LEARNING_CODE_NOT_FOUND':'TOO_MANY_FAILED_CODE_ATTEMPTS'});}res.setHeader('Cache-Control','no-store');return res.json({success:true});}catch(error:any){console.error('Student code resolve failed',{message:error?.message});return res.status(503).json({success:false,error:'STUDENT_LOOKUP_UNAVAILABLE'});}});
app.post('/api/student/history',async(req,res)=>{const ip=req.ip||req.socket.remoteAddress||'unknown';if(!checkSensitiveLimit(`history:${ip}`,300,10*60_000))return res.status(429).json({success:false,error:'RATE_LIMITED'});if(!isValidLearningCode(req.body?.learningCode))return res.status(400).json({success:false,error:'INVALID_LEARNING_CODE'});const learningCode=normalizeLearningCode(req.body.learningCode);try{const student=await resolveStudentByCode(learningCode);if(!student)return res.status(401).json({success:false,error:'LEARNING_CODE_NOT_FOUND'});const history=await getStudentHistory(student.studentId);res.setHeader('Cache-Control','no-store');return res.json({success:true,history});}catch(error:any){console.error('Student history failed',{message:error?.message});return res.status(503).json({success:false,error:'HISTORY_UNAVAILABLE'});}});
app.post('/api/sessions',async(req,res)=>{const validated=validateSessionSaveInput(req.body);if('error'in validated)return res.status(400).json({success:false,error:validated.error});try{const student=await resolveStudentByCode(validated.value.learningCode);if(!student)return res.status(401).json({success:false,error:'LEARNING_CODE_NOT_FOUND'});const saved=await saveCanonicalSession({sessionId:validated.value.sessionId,studentId:student.studentId,researchId:student.researchId,classId:student.classId,aiStudentId:validated.value.aiStudentId,topic:validated.value.topic,targetDurationMinutes:validated.value.targetDurationMinutes,startedAt:validated.value.startedAt,endedAt:validated.value.endedAt,history:validated.value.history,encounteredVocab:validated.value.encounteredVocab||[],reflection:validated.value.reflection,systemEvents:validated.value.systemEvents||[],personaLabelCondition:validated.value.personaLabelCondition,countryLabelVisible:validated.value.countryLabelVisible,accentLabelVisible:validated.value.accentLabelVisible,flagVisible:validated.value.flagVisible,studentSelectedSpeechRate:validated.value.studentSelectedSpeechRate,effectiveTtsSpeechRate:validated.value.effectiveTtsSpeechRate});res.setHeader('Cache-Control','no-store');return res.json({success:true,session:{sessionId:saved.sessionId,lifetimeSessionNumber:saved.lifetimeSessionNumber}});}catch(error:any){console.error('Session save failed',{message:error?.message});const conflict=error?.message==='SESSION_ID_CONFLICT';return res.status(conflict?409:503).json({success:false,error:conflict?'SESSION_ID_CONFLICT':'SESSION_SAVE_UNAVAILABLE'});}});
app.post('/api/management/login',(req,res)=>{const ip=req.ip||req.socket.remoteAddress||'unknown';if(!checkSensitiveLimit(`mgmt:${ip}`,10,15*60_000))return res.status(429).json({success:false,error:'TOO_MANY_LOGIN_ATTEMPTS'});const username=typeof req.body?.username==='string'?req.body.username.slice(0,100):'';const password=typeof req.body?.password==='string'?req.body.password.slice(0,300):'';const result=authenticateManagement(username,password);if(!result)return res.status(managementAuthConfigured()?401:503).json({success:false,error:managementAuthConfigured()?'INVALID_CREDENTIALS':'MANAGEMENT_AUTH_NOT_CONFIGURED'});if(result.role!=='researcher')return res.status(403).json({success:false,error:'RESEARCHER_ONLY'});setManagementCookie(res,result.token);return res.json({success:true,role:result.role});});
app.post('/api/management/logout',(_req,res)=>{clearManagementCookie(res);return res.json({success:true});});
app.get('/api/management/me',requireManagementRole(['researcher']),(req:AuthenticatedRequest,res)=>{res.setHeader('Cache-Control','no-store');return res.json({success:true,user:req.managementUser});});
app.get('/api/management/research.summary',requireManagementRole(['researcher']),async(_req,res)=>{try{const rows=buildResearchDataSets(await getAllSessionsForManagement()).sessions;const classCounts:Record<string,number>={};const researchIds=new Set<string>();let latestDate='';let completeSessions=0;for(const row of rows){const c=String(row.class_id||'');if(c)classCounts[c]=(classCounts[c]||0)+1;const rid=String(row.research_id||'');if(rid)researchIds.add(rid);const d=String(row.local_date||'');if(d>latestDate)latestDate=d;if(String(row.data_quality_flag||'')==='complete')completeSessions+=1;}res.setHeader('Cache-Control','no-store');return res.json({success:true,totalSessions:rows.length,completeSessions,researchIdCount:researchIds.size,latestDate,classCounts});}catch(error:any){console.error('Research summary failed',{message:error?.message});return res.status(503).json({success:false,error:'RESEARCH_SUMMARY_UNAVAILABLE'});}});
function csvCell(value:unknown):string{''',
    'replace management/student routes',
    re.S,
)

# Helper to filter raw documents before expensive research dataset derivation.
filter_helper = """
function filterRawResearchSessions(rows:Record<string,any>[],query:any):Record<string,any>[] { const start=typeof query?.start==='string'?query.start:'';const end=typeof query?.end==='string'?query.end:'';const classId=typeof query?.classId==='string'?query.classId:'';return rows.filter(row=>{const date=String(row.localDate||'');return(!start||date>=start)&&(!end||date<=end)&&(!classId||classId==='all'||String(row.classId||'')===classId);}); }
"""
server = replace_once(server, "const RESEARCH_DEFAULT_HEADERS:Record<ResearchDatasetName,string[]>={", filter_helper + "\nconst RESEARCH_DEFAULT_HEADERS:Record<ResearchDatasetName,string[]>={", 'raw research filter helper')
server = server.replace("const raw=buildResearchDataSets(await getAllSessionsForManagement());", "const raw=buildResearchDataSets(filterRawResearchSessions(await getAllSessionsForManagement(),req.query));")
server = replace_once(server, "    const sessions=await getAllSessionsForManagement();\n    const requested=", "    const sessions=filterRawResearchSessions(await getAllSessionsForManagement(),req.query);\n    const requested=", 'research csv prefilter')
write('server.ts', server)

# -----------------------------------------------------------------------------
# 7. Speech provider/rate observation
# -----------------------------------------------------------------------------
speech = read('src/utils/speech.ts')
speech = speech.replace("  onError?: (e: unknown) => void\n): SpeechSynthesisUtterance | null {", "  onError?: (e: unknown) => void,\n  onProvider?: (provider: 'google-chirp3-hd' | 'device-fallback', effectiveRate: number) => void\n): SpeechSynthesisUtterance | null {")
speech = speech.replace("  const rate = Math.max(0.8, Math.min(1.15, customRate || student.voiceRate || 1.0));", "  const rate = Math.max(0.75, Math.min(1.25, customRate || student.voiceRate || 1.0));")
speech = replace_once(speech, "      speakStudentVoiceLocal(text, student, customRate, onStart, onEnd, onError);", "      onProvider?.('device-fallback', Math.max(0.75, Math.min(1.25, customRate || student.voiceRate || 1.0)));\n      speakStudentVoiceLocal(text, student, customRate, onStart, onEnd, onError);", 'TTS fallback provider callback')
speech = replace_once(speech, "      const blob = await response.blob();", "      onProvider?.('google-chirp3-hd', Number(response.headers.get('X-TTS-Effective-Rate') || rate));\n      const blob = await response.blob();", 'TTS cloud provider callback')
write('src/utils/speech.ts', speech)

# -----------------------------------------------------------------------------
# 8. Label-condition UI and research session telemetry
# -----------------------------------------------------------------------------
setup = read('src/components/SetupScreen.tsx')
setup = setup.replace("  onValidateLearningCode: (learningCode: string) => Promise<boolean>;\n}", "  onValidateLearningCode: (learningCode: string) => Promise<boolean>;\n  labelCondition?: 'shown' | 'hidden';\n}")
setup = setup.replace("export const SetupScreen: React.FC<SetupScreenProps> = ({ onStartDialogue, learningDataEnabled, onValidateLearningCode }) => {", "export const SetupScreen: React.FC<SetupScreenProps> = ({ onStartDialogue, learningDataEnabled, onValidateLearningCode, labelCondition = 'shown' }) => {\n  const showLabels = labelCondition === 'shown';")
setup = setup.replace("{selectedStudent.flag} {selectedStudent.countryJapanese} 選択中", "{showLabels ? `${selectedStudent.flag} ${selectedStudent.countryJapanese} 選択中` : `${selectedStudent.name} 選択中`}")
setup = setup.replace("<div className=\"setup-student-country pr-7 text-[12px] font-black\" title={countryLabel(student)}>{student.flag} {countryLabel(student)}</div>", "<div className=\"setup-student-country pr-7 text-[12px] font-black\" title={showLabels ? countryLabel(student) : 'AI留学生'}>{showLabels ? `${student.flag} ${countryLabel(student)}` : 'AI留学生'}</div>")
setup = setup.replace("<p className=\"setup-student-origin text-[10px] font-semibold text-slate-600\">{student.age}歳 · {student.city}</p>", "<p className=\"setup-student-origin text-[10px] font-semibold text-slate-600\">{student.age}歳{showLabels ? ` · ${student.city}` : ''}</p>")
setup = setup.replace("<p className=\"setup-student-accent rounded-md bg-slate-100 px-2 py-1 text-[9px] font-bold leading-tight text-slate-600\">🗣 {student.accentName}</p>", "{showLabels && <p className=\"setup-student-accent rounded-md bg-slate-100 px-2 py-1 text-[9px] font-bold leading-tight text-slate-600\">🗣 {student.accentName}</p>}")
setup = setup.replace("<span className=\"text-xl\">{selectedStudent.flag}</span>\n                    <p className=\"text-sm font-black\">{selectedStudent.countryJapanese} ({countryLabel(selectedStudent)})</p>", "{showLabels && <><span className=\"text-xl\">{selectedStudent.flag}</span><p className=\"text-sm font-black\">{selectedStudent.countryJapanese} ({countryLabel(selectedStudent)})</p></>}")
setup = setup.replace("<p className=\"text-sm font-bold text-blue-700\">{selectedStudent.age}歳 · {selectedStudent.city}</p>", "<p className=\"text-sm font-bold text-blue-700\">{selectedStudent.age}歳{showLabels ? ` · ${selectedStudent.city}` : ''}</p>")
setup = setup.replace("<p className=\"mt-2 rounded-xl border border-blue-100 bg-blue-50/70 p-2 text-[11px] font-semibold leading-relaxed text-slate-700\">{selectedStudent.japaneseBio}</p>", "<p className=\"mt-2 rounded-xl border border-blue-100 bg-blue-50/70 p-2 text-[11px] font-semibold leading-relaxed text-slate-700\">{showLabels ? selectedStudent.japaneseBio : '好きなものや専攻について英語で話せるAI留学生です。'}</p>")
setup = setup.replace("<p><b>🏛 名所:</b> {selectedStudent.heritageLandmark}</p>", "{showLabels && <p><b>🏛 名所:</b> {selectedStudent.heritageLandmark}</p>}")
write('src/components/SetupScreen.tsx', setup)

card = read('src/components/AIStudentCard.tsx')
card = card.replace("  onChangeSpeechRate: (rate: number) => void;\n}", "  onChangeSpeechRate: (rate: number) => void;\n  labelCondition?: 'shown' | 'hidden';\n}")
card = card.replace("  onChangeSpeechRate,\n}) => {", "  onChangeSpeechRate,\n  labelCondition = 'shown',\n}) => {\n  const showLabels = labelCondition === 'shown';")
card = card.replace("<span className=\"text-lg leading-none flex-shrink-0\">{student.flag}</span>\n          <span className=\"truncate\">{student.country} ({student.countryNative})</span>", "{showLabels ? <><span className=\"text-lg leading-none flex-shrink-0\">{student.flag}</span><span className=\"truncate\">{student.country} ({student.countryNative})</span></> : <span className=\"truncate\">AI留学生</span>}")
card = card.replace("{student.japaneseName} ({student.age}歳・{student.city})", "{student.japaneseName} ({student.age}歳{showLabels ? `・${student.city}` : ''})")
card = card.replace("      <p className=\"text-[10px] text-slate-500 font-semibold leading-tight\">\n        {student.accentName}\n      </p>", "      {showLabels && <p className=\"text-[10px] text-slate-500 font-semibold leading-tight\">{student.accentName}</p>}")
write('src/components/AIStudentCard.tsx', card)

header = read('src/components/Header.tsx')
header = header.replace("  onFinishEarly: () => void;\n}", "  onFinishEarly: () => void;\n  labelCondition?: 'shown' | 'hidden';\n}")
header = header.replace("  onFinishEarly,\n}) => {", "  onFinishEarly,\n  labelCondition = 'shown',\n}) => {\n  const showLabels = labelCondition === 'shown';")
header = header.replace("<span className=\"sm:hidden\">{aiStudentFlag} {aiStudentName}</span>", "<span className=\"sm:hidden\">{showLabels ? aiStudentFlag : ''} {aiStudentName}</span>")
header = header.replace("× {aiStudentName} {aiStudentFlag}", "× {aiStudentName} {showLabels ? aiStudentFlag : ''}")
write('src/components/Header.tsx', header)

dialogue = read('src/components/DialogueView.tsx')
dialogue = dialogue.replace("  onPlayAudio: (text: string) => void;\n}", "  onPlayAudio: (text: string) => void;\n  labelCondition?: 'shown' | 'hidden';\n}")
dialogue = dialogue.replace("  onPlayAudio,\n}) => {", "  onPlayAudio,\n  labelCondition = 'shown',\n}) => {\n  const showLabels = labelCondition === 'shown';")
dialogue = dialogue.replace("          <span>{aiStudent.flag}</span>\n          <span>{aiStudent.name} との英語対話セッション", "          {showLabels && <span>{aiStudent.flag}</span>}\n          <span>{aiStudent.name} との英語対話セッション")
dialogue = dialogue.replace("{isAi ? `${aiStudent.name} (${aiStudent.countryJapanese})` : studentName || 'あなた (5・6年生)'}", "{isAi ? (showLabels ? `${aiStudent.name} (${aiStudent.countryJapanese})` : aiStudent.name) : studentName || 'あなた (5・6年生)'}")
write('src/components/DialogueView.tsx', dialogue)

reflection = read('src/components/ReflectionScreen.tsx')
reflection = reflection.replace("  saveMessage?: string;\n}", "  saveMessage?: string;\n  labelCondition?: 'shown' | 'hidden';\n}")
reflection = reflection.replace("  saveMessage,\n}) => {", "  saveMessage,\n  labelCondition = 'shown',\n}) => {\n  const showLabels = labelCondition === 'shown';")
reflection = reflection.replace("{aiStudent.flag} {aiStudent.name} ({aiStudent.countryJapanese}) 留学生との対話練習記録", "{showLabels ? `${aiStudent.flag} ${aiStudent.name} (${aiStudent.countryJapanese})` : aiStudent.name} 留学生との対話練習記録")
write('src/components/ReflectionScreen.tsx', reflection)

feedback = read('src/components/FeedbackScreen.tsx')
feedback = feedback.replace("  onOpenHistory?: () => void;\n}", "  onOpenHistory?: () => void;\n  labelCondition?: 'shown' | 'hidden';\n}")
feedback = feedback.replace("  onOpenHistory,\n}) => {", "  onOpenHistory,\n  labelCondition = 'shown',\n}) => {\n  const showLabels = labelCondition === 'shown';")
feedback = feedback.replace("{aiStudent.flag} {aiStudent.name} ({aiStudent.countryJapanese}) 留学生との対話練習記録", "{showLabels ? `${aiStudent.flag} ${aiStudent.name} (${aiStudent.countryJapanese})` : aiStudent.name} 留学生との対話練習記録")
feedback = feedback.replace("{isAi ? `${aiStudent.flag} ${aiStudent.name}` : `🧒 ${profile.name || 'じどう'}`}", "{isAi ? `${showLabels ? aiStudent.flag : ''} ${aiStudent.name}` : `🧒 ${profile.name || 'じどう'}`}")
write('src/components/FeedbackScreen.tsx', feedback)

app = read('src/App.tsx')
app = replace_once(app, "const apiUrl = (path: string) => `${API_BASE_URL}${path}`;\n", "const apiUrl = (path: string) => `${API_BASE_URL}${path}`;\nconst PERSONA_LABEL_CONDITION: 'shown' | 'hidden' = import.meta.env.VITE_PERSONA_LABEL_CONDITION === 'hidden' ? 'hidden' : 'shown';\nconst LABELS_VISIBLE = PERSONA_LABEL_CONDITION === 'shown';\n", 'app label constants')
app = replace_once(app, "  const speechRateRef = useRef(speechRate); speechRateRef.current = speechRate;\n", "  const speechRateRef = useRef(speechRate); speechRateRef.current = speechRate;\n  const effectiveTtsRateRef = useRef(speechRate);\n", 'effective tts ref')
provider_callback = "(provider, effectiveRate) => { effectiveTtsRateRef.current = effectiveRate; recordResearchEvent('tts_provider', provider); recordResearchEvent('tts_effective_rate', effectiveRate.toFixed(2)); }"
app = app.replace("      () => { setIsSpeaking(false); setMood('greeting'); },\n      () => { setIsSpeaking(false); setMood('greeting'); });", "      () => { setIsSpeaking(false); setMood('greeting'); },\n      () => { setIsSpeaking(false); setMood('greeting'); },\n      " + provider_callback + ");", 1)
# starter and farewell direct calls
app = app.replace("          () => { setIsSpeaking(false); setMood('greeting'); },\n          () => { setIsSpeaking(false); setMood('greeting'); });", "          () => { setIsSpeaking(false); setMood('greeting'); },\n          () => { setIsSpeaking(false); setMood('greeting'); },\n          " + provider_callback + ");", 1)
app = app.replace("    speakStudentVoice(farewell.english,studentObj,speechRateRef.current,()=>{setIsSpeaking(true);setMood('happy');},()=>{setIsSpeaking(false);executeTransition();},()=>{setIsSpeaking(false);executeTransition();});", "    speakStudentVoice(farewell.english,studentObj,speechRateRef.current,()=>{setIsSpeaking(true);setMood('happy');},()=>{setIsSpeaking(false);executeTransition();},()=>{setIsSpeaking(false);executeTransition();}," + provider_callback + ");")
# common snapshot metadata: add after systemEvents in all payloads by broad replacement
app = app.replace("systemEvents: systemEventsRef.current }", "systemEvents: systemEventsRef.current, personaLabelCondition: PERSONA_LABEL_CONDITION, countryLabelVisible: LABELS_VISIBLE, accentLabelVisible: LABELS_VISIBLE, flagVisible: LABELS_VISIBLE, studentSelectedSpeechRate: speechRateRef.current, effectiveTtsSpeechRate: effectiveTtsRateRef.current }")
app = app.replace("systemEvents: systemEventsRef.current,\n      };", "systemEvents: systemEventsRef.current, personaLabelCondition: PERSONA_LABEL_CONDITION, countryLabelVisible: LABELS_VISIBLE, accentLabelVisible: LABELS_VISIBLE, flagVisible: LABELS_VISIBLE, studentSelectedSpeechRate: speechRateRef.current, effectiveTtsSpeechRate: effectiveTtsRateRef.current,\n      };")
app = app.replace("reflection: answers, systemEvents: systemEventsRef.current,\n        });", "reflection: answers, systemEvents: systemEventsRef.current, personaLabelCondition: PERSONA_LABEL_CONDITION, countryLabelVisible: LABELS_VISIBLE, accentLabelVisible: LABELS_VISIBLE, flagVisible: LABELS_VISIBLE, studentSelectedSpeechRate: speechRateRef.current, effectiveTtsSpeechRate: effectiveTtsRateRef.current,\n        });")
# diagnostics -> research events
app = replace_once(app, "      const resData = await response.json();\n      recordResearchEvent('ai_response_latency_ms', String(Math.max(0, Date.now() - aiRequestStartedAt)));", "      const resData = await response.json();\n      recordResearchEvent('ai_response_latency_ms', String(Math.max(0, Date.now() - aiRequestStartedAt)));\n      if (resData?._diagnostics?.model) recordResearchEvent('ai_model', String(resData._diagnostics.model));\n      const usage = resData?._diagnostics?.usage || {};\n      if (Number(usage.inputTokens) > 0) recordResearchEvent('ai_input_tokens', String(usage.inputTokens));\n      if (Number(usage.outputTokens) > 0) recordResearchEvent('ai_output_tokens', String(usage.outputTokens));\n      if (Number(usage.cacheReadTokens) > 0) recordResearchEvent('ai_cache_read_tokens', String(usage.cacheReadTokens));\n      if (Number(usage.cacheCreationTokens) > 0) recordResearchEvent('ai_cache_creation_tokens', String(usage.cacheCreationTokens));", 'app usage telemetry')
# props to screens
app = app.replace("<SetupScreen onStartDialogue={handleStartDialogue} learningDataEnabled={learningDataEnabled} onValidateLearningCode={validateLearningCode}/>", "<SetupScreen onStartDialogue={handleStartDialogue} learningDataEnabled={learningDataEnabled} onValidateLearningCode={validateLearningCode} labelCondition={PERSONA_LABEL_CONDITION}/>")
app = app.replace("<Header studentName={profile.name}", "<Header labelCondition={PERSONA_LABEL_CONDITION} studentName={profile.name}")
app = app.replace("<AIStudentCard student={currentAiStudent}", "<AIStudentCard labelCondition={PERSONA_LABEL_CONDITION} student={currentAiStudent}")
app = app.replace("<DialogueView messages={messages}", "<DialogueView labelCondition={PERSONA_LABEL_CONDITION} messages={messages}")
app = app.replace("<span className=\"text-xl\">{currentAiStudent.flag}</span>", "{LABELS_VISIBLE && <span className=\"text-xl\">{currentAiStudent.flag}</span>}")
# Reflection and Feedback multiline openings
app = app.replace("<ReflectionScreen\n", "<ReflectionScreen\n            labelCondition={PERSONA_LABEL_CONDITION}\n", 1)
app = app.replace("<FeedbackScreen\n", "<FeedbackScreen\n            labelCondition={PERSONA_LABEL_CONDITION}\n", 1)
write('src/App.tsx', app)

# -----------------------------------------------------------------------------
# 9. Deployment/model configuration and focused QA
# -----------------------------------------------------------------------------
docker = read('Dockerfile').replace('ENV ANTHROPIC_MODEL=claude-sonnet-4-6', 'ENV ANTHROPIC_MODEL=claude-sonnet-5\nENV APP_VERSION=1.0.7\nENV APP_BUILD=local')
write('Dockerfile', docker)

workflow = read('.github/workflows/cloud-run-deploy.yml')
workflow = workflow.replace('--update-env-vars ANTHROPIC_MODEL=claude-sonnet-4-6,SESSION_RETENTION_DAYS=1095', '--update-env-vars ANTHROPIC_MODEL=claude-sonnet-5,SESSION_RETENTION_DAYS=1095,APP_VERSION=1.0.7,APP_BUILD=${GITHUB_SHA::12}')
workflow = workflow.replace("echo \"$health\" | grep -q '\"managementConfigured\":true'", "echo \"$health\" | grep -q '\"managementConfigured\":true'\n          echo \"$health\" | grep -q '\"model\":\"claude-sonnet-5\"'")
write('.github/workflows/cloud-run-deploy.yml', workflow)

pages = read('.github/workflows/pages.yml')
pages = pages.replace("          VITE_API_BASE_URL: https://shizuoka-english-ai-1075707511474.asia-northeast1.run.app\n", "          VITE_API_BASE_URL: https://shizuoka-english-ai-1075707511474.asia-northeast1.run.app\n          VITE_PERSONA_LABEL_CONDITION: shown\n")
write('.github/workflows/pages.yml', pages)

# Research-only management QA.
write('scripts/qa-management-page.ts', r'''import assert from 'node:assert/strict';
import fs from 'node:fs';
const page=fs.readFileSync('src/server/managementPage.ts','utf8');const server=fs.readFileSync('server.ts','utf8');
assert.ok(page.includes('研究データ管理'));assert.ok(page.includes('research.bundle.zip'));assert.ok(!page.includes('教師用管理'));assert.ok(!page.includes('学習者ID管理'));
assert.ok(server.includes("requireManagementRole(['researcher'])"));assert.ok(!server.includes("requireManagementRole(['teacher'])"));assert.ok(!server.includes("'/api/management/student-codes'"));assert.ok(!server.includes("'/api/management/sessions'"));
console.log('Research-only management QA: PASS');
''')

write('scripts/qa-version-ui.ts', r'''import assert from 'node:assert/strict';import fs from 'node:fs';import { getAppVersionMetadata,isVersionedCommit } from './app-version';
const m=getAppVersionMetadata(new Date('2026-08-30T00:00:00+09:00'));assert.match(m.version,/^1\.0\.\d+$/);assert.equal(isVersionedCommit('fix: sample',['base','feature']),false);const setup=fs.readFileSync('src/components/SetupScreen.tsx','utf8');const management=fs.readFileSync('src/server/managementPage.ts','utf8');assert.ok(!setup.includes('managementVersionFooter'));assert.ok(management.includes('managementVersionFooter'));console.log('Version/provenance QA: PASS');
''')

load_qa = r'''import assert from 'node:assert/strict';import fs from 'node:fs';import { buildResearchDataSets } from '../src/server/researchExport';import { validateSessionSaveInput } from '../src/dataContract';
const server=fs.readFileSync('server.ts','utf8');assert.ok(server.includes("student-fail:${ip}"));assert.ok(!server.includes("student:${ip}`,15"));assert.ok(server.includes("'claude-sonnet-5'"));assert.ok(server.includes("output_config: { effort: 'medium' }"));assert.ok(server.includes("cache_control: { type: 'ephemeral' }"));
const base=Date.now();const sessions:any[]=[];for(let i=0;i<300;i++){const started=base+(i%100)*100;const body={sessionId:`load_session_${String(i).padStart(4,'0')}`,learningCode:'A7M4',aiStudentId:'emma_usa',topic:'favorites',targetDurationMinutes:2,startedAt:started,endedAt:started+90_000,history:[{id:`a${i}`,sender:'ai',englishText:'I like surfing. What do you like?',timestamp:started},{id:`c${i}`,sender:'child',englishText:'I like strawberries.',timestamp:started+10_000}],reflection:{conveyedIdeas:3,understoodPartner:3,noticedLanguageCulture:3},personaLabelCondition:'shown',studentSelectedSpeechRate:1,effectiveTtsSpeechRate:1,systemEvents:[{type:'session_start',timestamp:started},{type:'session_finish',timestamp:started+89_000}]};const v=validateSessionSaveInput(body);assert.equal(v.ok,true);sessions.push({...body,researchId:`R-${i%100}`,classId:'5-1',schemaVersion:4,personaId:'emma_usa'});}const t=Date.now();const data=buildResearchDataSets(sessions);const elapsed=Date.now()-t;assert.equal(data.sessions.length,300);assert.ok(data.expressions.some(r=>r.dictionary_source==='persona'));assert.ok(data.sessions.every(r=>r.persona_id==='emma_usa'));assert.ok(elapsed<10000,`300-session research build too slow: ${elapsed}ms`);console.log(`100 users x 3 sessions synthetic load QA: PASS (${elapsed}ms)`);
'''
write('scripts/qa-research-run-load.ts', load_qa)

package = json.loads(read('package.json'))
package['scripts']['qa:load'] = 'tsx scripts/qa-research-run-load.ts'
package['scripts']['qa'] = package['scripts']['qa'].replace(' && npm run qa:dashboard', '').replace(' && npm run qa:identity', '') + ' && npm run qa:load'
write('package.json', json.dumps(package, ensure_ascii=False, indent=2) + '\n')

# Update integrated research QA expectations that intentionally referenced teacher system.
research_qa = read('scripts/qa-research-integrated.ts')
research_qa = research_qa.replace("assert.ok(!persistenceHardening.includes(\"TEACHER_ID_COLLECTION = 'teacher_ids'\"),'opaque teacher-only IDs must not be generated in the learner-ID architecture');", "assert.ok(!persistenceHardening.includes(\"TEACHER_ID_COLLECTION = 'teacher_ids'\"),'opaque teacher-only IDs must not be generated in the learner-ID architecture');")
research_qa = research_qa.replace("assert.ok(persistenceHardening.includes('learningId: normalized'),'teacher views must use the distributed learner ID');", "assert.ok(persistenceHardening.includes('learningId: normalized'),'learner identity records must retain the distributed learner ID');")
research_qa += "\nconst personaRow=data.sessions.find((row)=>row.session_id==='session_class_0')!;assert.equal(personaRow.persona_id,'emma_usa');assert.ok(['Inner','Outer','Expanding'].includes(String(personaRow.accent_circle)));assert.ok(data.expressions.some((row)=>row.dictionary_source==='persona'&&row.persona_id==='emma_usa'));\n"
write('scripts/qa-research-integrated.ts', research_qa)

# Documentation reflects researcher-only system and stricter storage.
doc = read('docs/DATA_ACCESS_RETENTION_BACKUP.md')
doc = doc.replace('教師・研究者用管理画面は児童画面からリンクしない別URL `/management` とする。\n- 教師は管理用セッション一覧を閲覧できる。研究者だけが匿名化CSVを取得できる。', '研究者用管理画面は児童画面からリンクしない別URL `/management` とする。\n- 教師用管理画面は設けず、研究者だけが匿名化された研究データを取得できる。')
doc = doc.replace('PIIマスク済み対話履歴', '氏名・学校名・学習者ID等も保存前に除去した研究用匿名化対話履歴')
write('docs/DATA_ACCESS_RETENTION_BACKUP.md', doc)

# Remove temporary automation itself from the resulting commit.
for temporary in ['scripts/apply-final-hardening.py', '.github/workflows/apply-final-hardening.yml']:
    target = ROOT / temporary
    if target.exists(): target.unlink()

print('Final research-run hardening transformations applied.')
