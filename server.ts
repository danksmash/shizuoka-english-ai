import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import Anthropic from '@anthropic-ai/sdk';
import { getAIStudentById } from './src/data/curriculum';
import { getDialogueTopicContext } from './src/data/dialogueTopicContext';
import { GOOGLE_TTS_VOICES } from './src/data/personaResearch';
import { azureTtsConfigured, synthesizeAzureTts } from './src/server/azureTts';
import { detectVocabularyInText } from './src/data/vocabulary56';
import { getTopicLearningGoals } from './src/data/topicLearningGoals';
import { calculateCanonicalStats, canonicalizeHistory, isAIStudentId, isDialogueDuration, isDialogueTopic, isValidLearningCode, normalizeLearningCode, validateSessionSaveInput } from './src/dataContract';
import { generateFallbackFeedback } from './src/utils/feedbackFallback';
import { maskHighRiskPII, detectPromptInjection, detectInappropriateContent } from './src/utils/security';
import { validateAiResponse, inspectAiResponse, buildAlignedReply } from './src/utils/responseValidation';
import { getAllSessionsForManagement, getStudentHistory, persistenceConfigured, resolveStudentByCode, saveCanonicalSession } from './src/server/persistence';
import { buildResearchDashboardData, buildResearchExportDataSets, filterResearchExportDataSets, serializeResearchCsv, type ResearchExportDatasetName } from './src/server/researchDashboard';
import { authenticateManagement, clearManagementCookie, managementAuthConfigured, requireManagementRole, setManagementCookie, type AuthenticatedRequest } from './src/server/auth';
import { managementPageHtml } from './src/server/managementPage';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const ALLOWED_ORIGINS = new Set([
  'https://danksmash.github.io',
  'http://localhost:3000',
  'http://localhost:5173',
]);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '512kb' }));
app.use('/images', express.static(path.join(process.cwd(), 'src', 'assets', 'images')));

interface RateRecord { count: number; resetTime: number; }
const rateLimitMap = new Map<string, RateRecord>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const maxRequests = 1200;
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (record.count >= maxRequests) return false;
  record.count += 1;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) rateLimitMap.delete(ip);
  }
}, 5 * 60_000);


let googleAccessToken: { token: string; expiresAt: number } | null = null;

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

async function getGoogleAccessToken(): Promise<string> {
  if (googleAccessToken && Date.now() < googleAccessToken.expiresAt - 60_000) {
    return googleAccessToken.token;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2_000);
  try {
    const response = await fetch(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
      {
        headers: { 'Metadata-Flavor': 'Google' },
        signal: controller.signal,
      }
    );
    if (!response.ok) throw new Error(`Metadata token HTTP ${response.status}`);

    const data = await response.json() as { access_token?: string; expires_in?: number };
    if (!data.access_token) throw new Error('Metadata token missing');
    googleAccessToken = {
      token: data.access_token,
      expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 3000)) * 1000,
    };
    return googleAccessToken.token;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function synthesizeGoogleTts(
  text: string,
  aiStudentId: string,
  speakingRate: number
): Promise<Buffer> {
  const voice = GOOGLE_TTS_VOICES[aiStudentId];
  if (!voice) throw new Error('UNKNOWN_TTS_PERSONA');

  const token = await getGoogleAccessToken();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        input: { text },
        voice,
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate,
        },
      }),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(`Google TTS HTTP ${response.status}: ${detail}`);
    }

    const data = await response.json() as { audioContent?: string };
    if (!data.audioContent) throw new Error('Google TTS returned no audio');
    return Buffer.from(data.audioContent, 'base64');
  } finally {
    clearTimeout(timeoutId);
  }
}

let anthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey,
      maxRetries: 0,
      timeout: 30_000,
    });
  }
  return anthropicClient;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractJson(text: string): any {
  const trimmed = text.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('API_INVALID_RESPONSE');
  return JSON.parse(trimmed.slice(start, end + 1));
}

function isRetryable(error: any): boolean {
  const status = Number(error?.status || 0);
  if ([408, 409, 429, 500, 502, 503, 504, 529].includes(status)) return true;
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('aborted') ||
    message.includes('connection') ||
    message.includes('network') ||
    message.includes('socket') ||
    message.includes('econnreset') ||
    message.includes('api_invalid_response')
  );
}

async function callClaudeJson(system: string, prompt: string, maxTokens: number) {
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

export { maskHighRiskPII, detectPromptInjection, detectInappropriateContent, validateAiResponse, inspectAiResponse };

function sanitizeStudentInput(text: string): string {
  return text ? maskHighRiskPII(text).maskedText : '';
}

function isPredominantlyJapanese(text: unknown): text is string {
  if (typeof text !== 'string') return false;
  const compact = text.trim().replace(/\s+/g, '');
  if (!compact) return false;
  const japaneseCount = (compact.match(/[ぁ-んァ-ヶ一-龯々ー]/g) || []).length;
  const latinCount = (compact.match(/[A-Za-z]/g) || []).length;
  return japaneseCount >= 8 && japaneseCount >= latinCount;
}


function extractSpokenName(text: string): string | null {
  const match = text.match(/\b(?:my name is|call me)\s+([A-Za-z]{2,15})\b/i);
  if (!match) return null;
  const candidate = match[1].trim();
  const blocked = new Set(['in','from','ten','eleven','twelve','fine','good','happy','ready','fifth','sixth','student','boy','girl','japanese','japan']);
  if (blocked.has(candidate.toLowerCase())) return null;
  return candidate.charAt(0).toUpperCase() + candidate.slice(1).toLowerCase();
}

function getSystemInstructionForPersona(studentId: string): string {
  const p = getAIStudentById(studentId);
  return `You are ${p.name}, a friendly ${p.age}-year-old Shizuoka University exchange student from ${p.city}, ${p.country}.
You are speaking one-on-one with a Japanese elementary school student in Grade 5 or 6.

Keep the conversation natural, warm, and genuinely responsive.
Use the SAME easy spoken-English level for every topic and every conversation length.
Use the self-introduction topic as the level reference.
- Prefer very common everyday words.
- Prefer short, clear SVO sentences.
- Usually use one short statement and one short question.
- Aim for about 6-14 English words total when possible.
- Avoid difficult idioms, uncommon phrasal verbs, abstract words, and long clauses unless the child used them first.
- Do not make culture, hobbies, talents, or free-talk language harder than self-introduction language.
- Do not sound like a textbook, quiz, or scripted lesson.

Conversation rules:
1. Answer the student's actual message first.
2. If the student asks a question, answer it directly before asking one short related question.
3. Respond to the communicative purpose of the student's latest utterance first.
   - If the student asks a question, answer that exact question first using the persona facts and current topic context.
   - If the student shares information, react to that information first.
   - If the student gives a short Yes/No answer, use the preceding conversation for context.
   - If the student asks for repetition, rephrase the previous idea in easier English.
4. After responding, usually ask one short, natural question when it helps the conversation continue. Do not force a question when it would be unnatural.
5. Keep the complete response to one or two short sentence units whenever possible.
6. Do not use any fixed script, fixed reaction, fixed filler list, catchphrase, or repeated praise phrase from persona data.
7. Natural reactions or fillers are allowed only when you generate them naturally from the immediate conversation. Do not force them, repeat them mechanically, or use them as a persona signature.
8. Persona identity comes from facts, interests, home country, and voice, not from catchphrases.
9. Do not correct grammar unless asked.
10. If the student's English is incomplete, infer the likely meaning and answer simply.
11. If the student says Pardon?, Sorry?, or What?, rephrase the previous idea with easier words.
12. Only explicit Goodbye/Bye/See you ends the conversation.
13. The selected topic changes WHAT you talk about, not the English difficulty.
14. The selected conversation duration changes only how long the dialogue continues, not the English difficulty.

Persona field of study: ${p.major}.
Persona interests: ${p.likes.join(', ')}.

Return strictly valid JSON:
{
  "replySegments": [
    {
      "english": "one complete natural English sentence unit",
      "japanese": "そのenglishだけに対応する自然な日本語訳"
    }
  ],
  "studentJapaneseTranslation": "児童の最新英語の自然な日本語訳",
  "studentTranslationStatus": "translated" | "incomplete",
  "mood": "happy" | "speaking" | "thinking" | "encouraging",
  "culturalNote": "必要なときだけ短い日本語。不要なら空文字"
}`;
}

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    aiConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
    appVersion: process.env.APP_VERSION || 'unknown',
    build: process.env.APP_BUILD || 'unknown',
    resilience: 'single-attempt-model-fallback',
    ttsProvider: 'azure-speech',
    ttsFallback: 'google-chirp3-hd',
    azureTtsConfigured: azureTtsConfigured(),
    learningDataConfigured: persistenceConfigured(),
    managementConfigured: managementAuthConfigured(),
  });
});

app.post('/api/tts', async (req, res) => {
  const requestStart = Date.now();
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ success: false, error: 'Rate limited' });
  }

  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  const aiStudentId = typeof req.body?.aiStudentId === 'string' ? req.body.aiStudentId : '';
  const requestedRate = Number(req.body?.speakingRate || 1.0);
  const speakingRate = Math.max(
    0.75,
    Math.min(1.25, Number.isFinite(requestedRate) ? requestedRate : 1.0)
  );

  if (!text || text.length > 300) {
    return res.status(400).json({ success: false, error: 'Invalid TTS text' });
  }
  if (!GOOGLE_TTS_VOICES[aiStudentId]) {
    return res.status(400).json({ success: false, error: 'Unknown AI student' });
  }

  try {
    try {
      const azure = await synthesizeAzureTts(text, aiStudentId, speakingRate, 3_500);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'private, max-age=900');
      res.setHeader('X-TTS-Provider', 'azure-speech');
      res.setHeader('X-TTS-Cache', 'MISS');
      res.setHeader('X-TTS-Effective-Rate', azure.effectiveRate.toFixed(2));
      res.setHeader('X-TTS-Latency-Ms', String(Date.now() - requestStart));
      return res.send(azure.audio);
    } catch (azureError: any) {
      console.error('Azure TTS failed; trying Google Chirp fallback', { message: azureError?.message, aiStudentId });
      const { audio, cache } = await cachedGoogleTts(text, aiStudentId, speakingRate);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'private, max-age=900');
      res.setHeader('X-TTS-Provider', 'google-chirp3-hd');
      res.setHeader('X-TTS-Fallback-From', 'azure-speech');
      res.setHeader('X-TTS-Cache', cache);
      res.setHeader('X-TTS-Effective-Rate', speakingRate.toFixed(2));
      res.setHeader('X-TTS-Latency-Ms', String(Date.now() - requestStart));
      return res.send(audio);
    }
  } catch (error: any) {
    console.error('All server TTS providers failed', { message: error?.message, aiStudentId });
    return res.status(503).json({ success: false, error: 'TTS unavailable' });
  }
});

app.post('/api/chat', async (req, res) => {
  const requestStart = Date.now();
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ success: false, error: 'Too many requests. Please retry.' });
  }

  const { message, history, topic, aiStudentId } = req.body;
  if (!isAIStudentId(aiStudentId)) return res.status(400).json({ success: false, error: 'INVALID_AI_STUDENT_ID' });
  if (!isDialogueTopic(topic)) return res.status(400).json({ success: false, error: 'INVALID_TOPIC' });
  const persona = getAIStudentById(aiStudentId);
  const trimmedMessage = typeof message === 'string' ? message.trim() : '';

  if (!trimmedMessage) {
    return res.status(400).json({ success: false, error: 'Empty message' });
  }

  if (trimmedMessage.length > 100) {
    return res.json({
      success: true,
      data: {
        reply: 'Please use a shorter sentence. What do you want to say?',
        japaneseTranslation: 'もう少し短い文で話してみてね。何を伝えたいですか？',
        studentJapaneseTranslation: '',
        studentTranslationStatus: 'translated',
        mood: 'thinking',
        culturalNote: '',
      },
    });
  }

  if (detectPromptInjection(trimmedMessage) || detectInappropriateContent(trimmedMessage)) {
    return res.json({
      success: true,
      data: {
        reply: `Let's keep our English friendly. What do you like?`,
        japaneseTranslation: '楽しく英語で話そう。何が好きですか？',
        studentJapaneseTranslation: '',
        studentTranslationStatus: 'translated',
        mood: 'encouraging',
        culturalNote: '',
      },
    });
  }

  const { maskedText: safeUserMessage, hasHighRiskPII } = maskHighRiskPII(trimmedMessage);
  const rawHistory = Array.isArray(history) ? history : [];
  const recentHistory = rawHistory.slice(-16);
  const formattedHistory = recentHistory
    .map((msg: { sender: string; englishText: string }) =>
      `${msg.sender === 'ai' ? persona.name : 'Student'}: ${sanitizeStudentInput(msg.englishText || '').slice(0, 100)}`
    )
    .join('\n');

  const prompt = `Recent conversation:
${formattedHistory || '(start)'}

Selected topic: ${String(topic || 'favorites')}
Topic context: ${getDialogueTopicContext(topic)}
Student's latest input: "${safeUserMessage}"
${hasHighRiskPII ? 'A private detail was masked. Continue naturally without asking for it.' : ''}

Respond naturally to the latest input.
Use the same easy English level as a simple self-introduction conversation, regardless of topic.
A natural short reaction or filler is allowed when it truly fits the immediate context, but never insert one because of the persona or topic.
Translate the student's latest English into Japanese too.`;

  try {
    const { parsed, model, usage } = await callClaudeJson(getSystemInstructionForPersona(aiStudentId), prompt, 300);
    const alignedReply = buildAlignedReply(parsed, persona.name);
    const reply = alignedReply.english;
    const japaneseTranslation = alignedReply.japanese;

    const studentTranslationStatus = parsed.studentTranslationStatus === 'incomplete' ? 'incomplete' : 'translated';
    const studentJapaneseTranslation =
      studentTranslationStatus === 'incomplete'
        ? '日本語に訳せませんでした。'
        : typeof parsed.studentJapaneseTranslation === 'string' && /[ぁ-んァ-ヶ一-龠]/.test(parsed.studentJapaneseTranslation)
          ? parsed.studentJapaneseTranslation.trim()
          : '日本語に訳せませんでした。';

    return res.json({
      success: true,
      isFallback: false,
      data: {
        reply,
        japaneseTranslation,
        studentJapaneseTranslation,
        studentTranslationStatus,
        mood: parsed.mood || 'speaking',
        culturalNote: parsed.culturalNote || '',
        detectedName: extractSpokenName(trimmedMessage) || undefined,
      },
      _diagnostics: {
        requestId: `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        model,
        usage,
        latencyMs: Date.now() - requestStart,
        route: 'anthropic-resilient',
      },
    });
  } catch (error: any) {
    console.error('All Claude attempts failed', {
      status: error?.status,
      name: error?.name,
      message: error?.message,
    });
    return res.status(503).json({
      success: false,
      error: 'AI service unavailable after automatic retries.',
      _diagnostics: {
        requestId: `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        latencyMs: Date.now() - requestStart,
        route: 'all-ai-attempts-failed',
      },
    });
  }
});



type FeedbackExpressionCandidate = {
  english?: unknown;
  japanese?: unknown;
  reason?: unknown;
  speaker?: unknown;
  culturalNote?: unknown;
};

function normalizeFeedbackEvidence(value: unknown): string {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function groundFeedbackExpressions(
  candidates: unknown,
  speaker: 'child' | 'ai',
  history: ReturnType<typeof canonicalizeHistory>,
  limit = 3,
) {
  if (!Array.isArray(candidates)) return [];
  const sourceMessages = history.filter((message) => message.sender === speaker && message.englishText.trim());
  const seen = new Set<string>();
  const grounded: Array<{
    english: string;
    japanese: string;
    reason: string;
    evidenceText: string;
    speaker: 'child' | 'ai';
    messageId?: string;
    culturalNote?: string;
  }> = [];

  for (const raw of candidates as FeedbackExpressionCandidate[]) {
    if (grounded.length >= limit) break;
    const english = typeof raw?.english === 'string' ? raw.english.trim().slice(0, 100) : '';
    const normalized = normalizeFeedbackEvidence(english);
    if (!english || normalized.length < 2 || seen.has(normalized)) continue;
    const source = sourceMessages.find((message) => normalizeFeedbackEvidence(message.englishText).includes(normalized));
    if (!source) continue;
    seen.add(normalized);
    grounded.push({
      english,
      japanese: typeof raw?.japanese === 'string' && raw.japanese.trim() ? raw.japanese.trim().slice(0, 100) : '対話で使われたことば・表現',
      reason: typeof raw?.reason === 'string' && raw.reason.trim() ? raw.reason.trim().slice(0, 160) : '別の英会話でも使いやすい表現です。',
      evidenceText: source.sender === 'child' ? maskHighRiskPII(source.englishText).maskedText.slice(0, 180) : source.englishText.slice(0, 180),
      speaker,
      messageId: source.id,
      culturalNote: typeof raw?.culturalNote === 'string' && raw.culturalNote.trim() ? raw.culturalNote.trim().slice(0, 160) : undefined,
    });
  }
  return grounded;
}

function groundKeyPhrases(
  candidates: unknown,
  history: ReturnType<typeof canonicalizeHistory>,
  limit = 3,
) {
  if (!Array.isArray(candidates)) return [];
  const result: ReturnType<typeof groundFeedbackExpressions> = [];
  const seen = new Set<string>();
  for (const candidate of candidates as FeedbackExpressionCandidate[]) {
    if (result.length >= limit) break;
    const preferredSpeaker = candidate?.speaker === 'ai' ? 'ai' : 'child';
    let grounded = groundFeedbackExpressions([candidate], preferredSpeaker, history, 1);
    if (grounded.length === 0) {
      const otherSpeaker = preferredSpeaker === 'child' ? 'ai' : 'child';
      grounded = groundFeedbackExpressions([candidate], otherSpeaker, history, 1);
    }
    const item = grounded[0];
    if (!item) continue;
    const key = normalizeFeedbackEvidence(item.english);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

app.post('/api/feedback', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) return res.status(429).json({ success: false, error: 'Rate limited' });

  const { history, durationMinutes, aiStudentId, topic } = req.body;
  if (!isAIStudentId(aiStudentId)) return res.status(400).json({ success: false, error: 'INVALID_AI_STUDENT_ID' });
  const targetDuration = Number(durationMinutes);
  if (!isDialogueDuration(targetDuration)) return res.status(400).json({ success: false, error: 'INVALID_DURATION' });
  const persona = getAIStudentById(aiStudentId);
  const feedbackTopic = isDialogueTopic(topic) ? topic : undefined;
  const learningGoalContext = feedbackTopic
    ? getTopicLearningGoals(feedbackTopic)
        .map((goal) => `- ${goal.label}（例: ${goal.examples}）`)
        .join('\n')
    : 'テーマ情報なし。実際の対話全体から学習上の焦点を判断してください。';
  const rawHistory = canonicalizeHistory(history);
  const childMessages = rawHistory.filter((m) => m.sender === 'child' && m.englishText.trim());
  const childUtterances = childMessages
    .map((m) => maskHighRiskPII(m.englishText.trim()).maskedText.slice(0, 100))
    .filter(Boolean);
  const examples = childUtterances.map((t) => `「${t}」`).join('、');
  const feedbackTranscript = rawHistory.map((message, index) => {
    const safeText = message.sender === 'child'
      ? maskHighRiskPII(message.englishText.trim()).maskedText.slice(0, 180)
      : message.englishText.trim().slice(0, 180);
    return `${index + 1}. ${message.sender === 'child' ? '児童' : 'AI留学生'}: ${safeText}`;
  }).filter((line) => !line.endsWith(': ')).join('\n');
  const detectedVocabMap = new Map<string, ReturnType<typeof detectVocabularyInText>[number]>();
  for (const message of rawHistory) {
    for (const item of detectVocabularyInText(message.englishText)) detectedVocabMap.set(item.id, item);
  }
  const canonicalVocab = Array.from(detectedVocabMap.values());
  const firstTimestamp = rawHistory[0]?.timestamp || Date.now();
  const lastTimestamp = rawHistory[rawHistory.length - 1]?.timestamp || firstTimestamp;
  const stats = calculateCanonicalStats(rawHistory, firstTimestamp, lastTimestamp, targetDuration, canonicalVocab);

  const prompt = `小学5・6年生の英会話練習を日本語で短く講評してください。
留学生: ${persona.name}
時間: ${targetDuration}分
ターン: ${stats.totalTurns}
選択テーマ: ${feedbackTopic || '会話内容から判断'}

【今回のテーマで画面に示している学習のめあて・表現例】
${learningGoalContext}

【児童の実際の発話】
${examples || '(発話なし)'}

【実際の対話ログ】
${feedbackTranscript || '(発話なし)'}

対話全体を一つのやり取りとして読み、小学5・6年生の児童に今回の学びとして返す価値が最も高いことば・表現を選んでください。
固定スコア、単純なキーワード一致、発話順だけで機械的に選ばず、対話の文脈、今回のテーマやめあてとの関係、その表現が会話を成立・発展させた役割、別の相手にも使える価値、児童にとっての学びやすさを総合して判断してください。
上のめあてや表現例は判断材料であり、そこに表面的に一致させる必要はありません。実際の対話で別の表現の方が学習価値が高いなら、そちらを選んでください。

1. childLearningItems: 児童自身が実際に使った語・短いチャンク・表現から、今回もっとも価値の高いものを1件だけ選ぶ。
2. aiLearningItems: AI留学生が実際に使った語・短いチャンク・表現から、児童が次の会話で取り入れる価値が高いものを2件選ぶ。2件は、できるだけ異なる学びをもたらすものにする。
3. keyPhrases: 児童またはAIが実際に使った表現のうち、別の相手・別のテーマでも再利用価値が特に高い重要表現を最大3件。

childLearningItemsとaiLearningItemsは、十分な実発話がある限り指定件数を選んでください。妥当な実発話がない場合は架空の表現を作らず、少ない件数または空配列にしてください。
englishはログ中に実際に連続して現れた語句を抜き出してください。長い発話全体より、児童が意味を理解して次に使いやすい自然なチャンクを選んでも構いません。
AIの運営上の指示やメタ発話より、児童自身のコミュニケーションに役立つ表現を優先してください。

JSONのみ:
{
 "goodPoints":["...","...","..."],
 "improvementAdvice":{"title":"...","detail":"...","examplePhrase":"..."},
 "overallComment":"指導者としての短い総合講評",
 "studentMessage":"選択された留学生本人が、実際の対話内容に触れながら児童へ直接話す自然な短い日本語メッセージ。必ず日本語で書き、英語文は書かない",
 "childLearningItems":[{"english":"実発話から抜き出した語・表現","japanese":"意味","reason":"なぜ今後役立つか"}],
 "aiLearningItems":[{"english":"実発話から抜き出した語・表現","japanese":"意味","reason":"なぜ児童に役立つか"}],
 "keyPhrases":[{"english":"実発話から抜き出した重要表現","japanese":"意味","reason":"なぜ重要か","speaker":"child または ai","culturalNote":"必要な場合だけ"}]
}`;

  try {
    const { parsed } = await callClaudeJson(
      `あなたは小学校外国語教育の専門家です。児童を具体的かつ温かく励ましてください。
講評部分は指導者の視点で書き、studentMessageだけは${persona.name}本人が児童に直接話しかける自然な一人称メッセージにしてください。studentMessageは必ず日本語で書いてください。英語の文章は禁止です。児童が使った英語に触れる場合も、日本語で内容を要約してください。
${persona.name}の年齢は${persona.age}歳、出身は${persona.city}, ${persona.country}、好きなものは${persona.likes.join(', ')}です。`,
      prompt,
      1400
    );
    const fallbackFeedback = generateFallbackFeedback(
      persona,
      'あなた',
      stats.totalTurns,
      stats.totalChildWords,
      stats.actualDurationSeconds,
      targetDuration,
      canonicalVocab,
      rawHistory
    );
    const childLearningItems = groundFeedbackExpressions(parsed.childLearningItems, 'child', rawHistory, 1);
    const aiLearningItems = groundFeedbackExpressions(parsed.aiLearningItems, 'ai', rawHistory, 2);
    const uniqueKeyPhrases = groundKeyPhrases(parsed.keyPhrases, rawHistory, 3);

    return res.json({
      success: true,
      isFallback: false,
      data: {
        ...parsed,
        overallComment:
          typeof parsed.overallComment === 'string' && parsed.overallComment.trim()
            ? parsed.overallComment.trim()
            : fallbackFeedback.overallComment,
        studentMessage:
          isPredominantlyJapanese(parsed.studentMessage)
            ? parsed.studentMessage.trim()
            : fallbackFeedback.studentMessage,
        childLearningItems,
        aiLearningItems,
        keyPhrases: uniqueKeyPhrases,
        encounteredVocab: canonicalVocab,
        aiStudent: persona,
        stats: {
          totalTurns: stats.totalTurns,
          totalChildWords: stats.totalChildWords,
          durationSeconds: stats.actualDurationSeconds,
          targetDurationMinutes: targetDuration,
        },
      },
    });
  } catch {
    const fallbackData = generateFallbackFeedback(
      persona,
      'あなた',
      stats.totalTurns,
      stats.totalChildWords,
      stats.actualDurationSeconds,
      targetDuration,
      canonicalVocab,
      rawHistory
    );
    return res.json({ success: true, isFallback: true, fallbackReason: 'AI_RETRY_EXHAUSTED', data: fallbackData });
  }
});

const sensitiveAttemptMap = new Map<string, { count: number; resetTime: number }>();
function checkSensitiveLimit(key: string, maxRequests: number, windowMs: number): boolean { const now=Date.now();const record=sensitiveAttemptMap.get(key);if(!record||now>record.resetTime){sensitiveAttemptMap.set(key,{count:1,resetTime:now+windowMs});return true;}if(record.count>=maxRequests)return false;record.count+=1;return true; }
function registerFailedCodeAttempt(ip:string):boolean{return checkSensitiveLimit(`student-fail:${ip}`,30,10*60_000);}
app.get('/management', (_req,res)=>{res.setHeader('Cache-Control','no-store');res.type('html').send(managementPageHtml());});
app.post('/api/student/resolve',async(req,res)=>{const ip=req.ip||req.socket.remoteAddress||'unknown';if(!persistenceConfigured())return res.status(503).json({success:false,error:'PERSISTENCE_NOT_CONFIGURED'});if(!isValidLearningCode(req.body?.learningCode)){registerFailedCodeAttempt(ip);return res.status(400).json({success:false,error:'INVALID_LEARNING_CODE'});}const learningCode=normalizeLearningCode(req.body.learningCode);try{const student=await resolveStudentByCode(learningCode);if(!student){const allowed=registerFailedCodeAttempt(ip);return res.status(allowed?401:429).json({success:false,error:allowed?'LEARNING_CODE_NOT_FOUND':'TOO_MANY_FAILED_CODE_ATTEMPTS'});}res.setHeader('Cache-Control','no-store');return res.json({success:true});}catch(error:any){console.error('Student code resolve failed',{message:error?.message});return res.status(503).json({success:false,error:'STUDENT_LOOKUP_UNAVAILABLE'});}});
app.post('/api/student/history',async(req,res)=>{const ip=req.ip||req.socket.remoteAddress||'unknown';if(!checkSensitiveLimit(`history:${ip}`,300,10*60_000))return res.status(429).json({success:false,error:'RATE_LIMITED'});if(!isValidLearningCode(req.body?.learningCode))return res.status(400).json({success:false,error:'INVALID_LEARNING_CODE'});const learningCode=normalizeLearningCode(req.body.learningCode);try{const student=await resolveStudentByCode(learningCode);if(!student)return res.status(401).json({success:false,error:'LEARNING_CODE_NOT_FOUND'});const history=await getStudentHistory(student.studentId);res.setHeader('Cache-Control','no-store');return res.json({success:true,history});}catch(error:any){console.error('Student history failed',{message:error?.message});return res.status(503).json({success:false,error:'HISTORY_UNAVAILABLE'});}});
app.post('/api/sessions',async(req,res)=>{const validated=validateSessionSaveInput(req.body);if('error'in validated)return res.status(400).json({success:false,error:validated.error});try{const student=await resolveStudentByCode(validated.value.learningCode);if(!student)return res.status(401).json({success:false,error:'LEARNING_CODE_NOT_FOUND'});const saved=await saveCanonicalSession({sessionId:validated.value.sessionId,studentId:student.studentId,researchId:student.researchId,classId:student.classId,aiStudentId:validated.value.aiStudentId,topic:validated.value.topic,targetDurationMinutes:validated.value.targetDurationMinutes,startedAt:validated.value.startedAt,endedAt:validated.value.endedAt,history:validated.value.history,encounteredVocab:validated.value.encounteredVocab||[],reflection:validated.value.reflection,systemEvents:validated.value.systemEvents||[],personaLabelCondition:validated.value.personaLabelCondition,countryLabelVisible:validated.value.countryLabelVisible,accentLabelVisible:validated.value.accentLabelVisible,flagVisible:validated.value.flagVisible,studentSelectedSpeechRate:validated.value.studentSelectedSpeechRate,effectiveTtsSpeechRate:validated.value.effectiveTtsSpeechRate});res.setHeader('Cache-Control','no-store');return res.json({success:true,session:{sessionId:saved.sessionId,lifetimeSessionNumber:saved.lifetimeSessionNumber}});}catch(error:any){console.error('Session save failed',{message:error?.message});const conflict=error?.message==='SESSION_ID_CONFLICT';return res.status(conflict?409:503).json({success:false,error:conflict?'SESSION_ID_CONFLICT':'SESSION_SAVE_UNAVAILABLE'});}});
app.post('/api/management/login',(req,res)=>{const ip=req.ip||req.socket.remoteAddress||'unknown';if(!checkSensitiveLimit(`mgmt:${ip}`,10,15*60_000))return res.status(429).json({success:false,error:'TOO_MANY_LOGIN_ATTEMPTS'});const username=typeof req.body?.username==='string'?req.body.username.slice(0,100):'';const password=typeof req.body?.password==='string'?req.body.password.slice(0,300):'';const result=authenticateManagement(username,password);if(!result)return res.status(managementAuthConfigured()?401:503).json({success:false,error:managementAuthConfigured()?'INVALID_CREDENTIALS':'MANAGEMENT_AUTH_NOT_CONFIGURED'});if(result.role!=='researcher')return res.status(403).json({success:false,error:'RESEARCHER_ONLY'});setManagementCookie(res,result.token);return res.json({success:true,role:result.role});});
app.post('/api/management/logout',(_req,res)=>{clearManagementCookie(res);return res.json({success:true});});
app.get('/api/management/me',requireManagementRole(['researcher']),(req:AuthenticatedRequest,res)=>{res.setHeader('Cache-Control','no-store');return res.json({success:true,user:req.managementUser});});
app.get('/api/management/research.summary',requireManagementRole(['researcher']),async(_req,res)=>{
  try{
    const data=buildResearchExportDataSets(await getAllSessionsForManagement());
    const classCounts:Record<string,number>={};const researchIds=new Set<string>();let latestDate='';let completeSessions=0;
    for(const row of data.sessions){const c=String(row.class_id||'');if(c)classCounts[c]=(classCounts[c]||0)+1;const rid=String(row.research_id||'');if(rid)researchIds.add(rid);const d=String(row.local_date||'');if(d>latestDate)latestDate=d;if(String(row.data_quality_flag||'')==='complete')completeSessions+=1;}
    res.setHeader('Cache-Control','no-store');return res.json({success:true,totalSessions:data.sessions.length,completeSessions,researchIdCount:researchIds.size,latestDate,classCounts});
  }catch(error:any){console.error('Research summary failed',{message:error?.message});return res.status(503).json({success:false,error:'RESEARCH_SUMMARY_UNAVAILABLE'});}
});

app.get('/api/management/research.dashboard',requireManagementRole(['researcher']),async(req,res)=>{
  try{
    const dashboard=buildResearchDashboardData(await getAllSessionsForManagement(),req.query);
    res.setHeader('Cache-Control','no-store');return res.json(dashboard);
  }catch(error:any){console.error('Research dashboard failed',{message:error?.message});return res.status(503).json({success:false,error:'RESEARCH_DASHBOARD_UNAVAILABLE'});}
});

function crc32(buffer:Buffer):number{
  let crc=0xffffffff;
  for(const byte of buffer){crc^=byte;for(let bit=0;bit<8;bit+=1)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
function buildStoredZip(files:Array<{name:string;content:string}>):Buffer{
  const localParts:Buffer[]=[];const centralParts:Buffer[]=[];let offset=0;
  for(const file of files){
    const name=Buffer.from(file.name,'utf8');const data=Buffer.from(file.content,'utf8');const crc=crc32(data);
    const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0,6);local.writeUInt16LE(0,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(name.length,26);local.writeUInt16LE(0,28);
    localParts.push(local,name,data);
    const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0,8);central.writeUInt16LE(0,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(name.length,28);central.writeUInt16LE(0,30);central.writeUInt16LE(0,32);central.writeUInt16LE(0,34);central.writeUInt16LE(0,36);central.writeUInt32LE(0,38);central.writeUInt32LE(offset,42);
    centralParts.push(central,name);offset+=local.length+name.length+data.length;
  }
  const centralSize=centralParts.reduce((sum,part)=>sum+part.length,0);const endRecord=Buffer.alloc(22);endRecord.writeUInt32LE(0x06054b50,0);endRecord.writeUInt16LE(files.length,8);endRecord.writeUInt16LE(files.length,10);endRecord.writeUInt32LE(centralSize,12);endRecord.writeUInt32LE(offset,16);
  return Buffer.concat([...localParts,...centralParts,endRecord]);
}

app.get('/api/management/research.bundle.zip',requireManagementRole(['researcher']),async(req,res)=>{
  try{
    const datasets=filterResearchExportDataSets(buildResearchExportDataSets(await getAllSessionsForManagement()),req.query);
    const exportedAt=new Date().toISOString();
    const names=['sessions','utterances','expressions','personas','codebook'] as const;
    const manifest={export_id:`export_${Date.now()}`,exported_at:exportedAt,schema_version:4,filters:req.query,row_counts:Object.fromEntries(names.map((name)=>[name,datasets[name].length]))};
    const files=names.map((name)=>({name:`${name}.csv`,content:serializeResearchCsv(datasets[name],name)}));
    const zip=buildStoredZip([...files,{name:'manifest.json',content:JSON.stringify(manifest,null,2)}]);
    res.setHeader('Content-Type','application/zip');res.setHeader('Content-Disposition',`attachment; filename="research-bundle-${exportedAt.slice(0,10).replace(/-/g,'')}.zip"`);res.setHeader('Cache-Control','no-store');return res.send(zip);
  }catch(error:any){console.error('Research bundle export failed',{message:error?.message});return res.status(503).json({success:false,error:'RESEARCH_BUNDLE_UNAVAILABLE'});}
});

app.get('/api/management/research.csv',requireManagementRole(['researcher']),async(req,res)=>{
  try{
    const requested=typeof req.query?.dataset==='string'?req.query.dataset:'sessions';
    const allowed=['sessions','utterances','expressions','personas','codebook'] as const;
    if(!(allowed as readonly string[]).includes(requested)) return res.status(400).json({success:false,error:'INVALID_RESEARCH_DATASET'});
    const dataset=requested as ResearchExportDatasetName;
    const sourceSessions=(dataset==='personas'||dataset==='codebook')?[]:await getAllSessionsForManagement();
    const datasets=filterResearchExportDataSets(buildResearchExportDataSets(sourceSessions),req.query);
    const csv=serializeResearchCsv(datasets[dataset],dataset);
    res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="${dataset}.csv"`);res.setHeader('Cache-Control','no-store');return res.send(csv);
  }catch(error:any){console.error('Research export failed',{message:error?.message});return res.status(503).json({success:false,error:'RESEARCH_EXPORT_UNAVAILABLE'});}
});


async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();