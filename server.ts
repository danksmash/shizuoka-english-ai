import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import Anthropic from '@anthropic-ai/sdk';
import { getAIStudentById } from './src/data/curriculum';
import { detectVocabularyInText } from './src/data/vocabulary';
import { calculateCanonicalStats, canonicalizeHistory, isAIStudentId, isDialogueDuration, isDialogueTopic, isValidLearningCode, normalizeLearningCode, validateSessionSaveInput } from './src/dataContract';
import { generateFallbackFeedback } from './src/utils/feedbackFallback';
import { maskHighRiskPII, detectPromptInjection, detectInappropriateContent } from './src/utils/security';
import { validateAiResponse, inspectAiResponse, buildAlignedReply } from './src/utils/responseValidation';
import { createStudentCode, getAllSessionsForManagement, getTeacherSessionsForManagement, getStudentHistory, getStudentRecordsForManagement, reissueStudentCode, setStudentActive, anonymizeSessionForResearch, persistenceConfigured, resolveStudentByCode, saveCanonicalSession } from './src/server/persistence';
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

app.use(express.json({ limit: '10kb' }));
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

const GOOGLE_TTS_VOICES: Record<string, { languageCode: string; name: string }> = {
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

let googleAccessToken: { token: string; expiresAt: number } | null = null;

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
      maxRetries: 3,
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

  const configured = process.env.ANTHROPIC_MODEL?.trim();
  const models = Array.from(new Set([
    configured || 'claude-sonnet-4-6',
    'claude-haiku-4-5',
  ]));

  let lastError: any = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await client.messages.create({
          model,
          max_tokens: maxTokens,
          temperature: 0.5,
          system,
          messages: [{ role: 'user', content: prompt }],
        });

        const rawText = response.content
          .filter((block: any) => block.type === 'text')
          .map((block: any) => ('text' in block ? block.text : ''))
          .join('')
          .trim();

        return { parsed: extractJson(rawText), model };
      } catch (error: any) {
        lastError = error;
        if (!isRetryable(error)) break;
        await sleep(500 * Math.pow(2, attempt));
      }
    }
  }

  throw lastError || new Error('AI_UNAVAILABLE');
}

export { maskHighRiskPII, detectPromptInjection, detectInappropriateContent, validateAiResponse, inspectAiResponse };

function sanitizeStudentInput(text: string): string {
  return text ? maskHighRiskPII(text).maskedText : '';
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
   - If the student asks a question, answer that exact question first using the persona facts.
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
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    resilience: 'multi-retry-model-fallback',
    ttsProvider: 'google-chirp3-hd',
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
    0.8,
    Math.min(1.15, Number.isFinite(requestedRate) ? requestedRate : 1.0)
  );

  if (!text || text.length > 300) {
    return res.status(400).json({ success: false, error: 'Invalid TTS text' });
  }
  if (!GOOGLE_TTS_VOICES[aiStudentId]) {
    return res.status(400).json({ success: false, error: 'Unknown AI student' });
  }

  try {
    const audio = await synthesizeGoogleTts(text, aiStudentId, speakingRate);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-TTS-Provider', 'google-chirp3-hd');
    res.setHeader('X-TTS-Latency-Ms', String(Date.now() - requestStart));
    return res.send(audio);
  } catch (error: any) {
    console.error('Google TTS failed', { message: error?.message, aiStudentId });
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
Student's latest input: "${safeUserMessage}"
${hasHighRiskPII ? 'A private detail was masked. Continue naturally without asking for it.' : ''}

Respond naturally to the latest input.
Use the same easy English level as a simple self-introduction conversation, regardless of topic.
A natural short reaction or filler is allowed when it truly fits the immediate context, but never insert one because of the persona or topic.
Translate the student's latest English into Japanese too.`;

  try {
    const { parsed, model } = await callClaudeJson(getSystemInstructionForPersona(aiStudentId), prompt, 300);
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

app.post('/api/feedback', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) return res.status(429).json({ success: false, error: 'Rate limited' });

  const { history, durationMinutes, aiStudentId } = req.body;
  if (!isAIStudentId(aiStudentId)) return res.status(400).json({ success: false, error: 'INVALID_AI_STUDENT_ID' });
  const targetDuration = Number(durationMinutes);
  if (!isDialogueDuration(targetDuration)) return res.status(400).json({ success: false, error: 'INVALID_DURATION' });
  const persona = getAIStudentById(aiStudentId);
  const rawHistory = canonicalizeHistory(history);
  const childMessages = rawHistory.filter((m) => m.sender === 'child' && m.englishText.trim());
  const childUtterances = childMessages
    .map((m) => maskHighRiskPII(m.englishText.trim()).maskedText.slice(0, 100))
    .filter(Boolean);
  const examples = childUtterances.map((t) => `「${t}」`).join('、');
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
児童の実際の発話: ${examples || '(発話なし)'}

実際に出た表現だけを keyPhrases に入れ、架空の発話を追加しないでください。
JSONのみ:
{
 "goodPoints":["...","...","..."],
 "improvementAdvice":{"title":"...","detail":"...","examplePhrase":"..."},
 "overallComment":"指導者としての短い総合講評",
 "studentMessage":"選択された留学生本人が、実際の対話内容に触れながら児童へ直接話す自然な短いメッセージ",
 "keyPhrases":[{"english":"...","japanese":"...","culturalNote":"..."}]
}`;

  try {
    const { parsed } = await callClaudeJson(
      `あなたは小学校外国語教育の専門家です。児童を具体的かつ温かく励ましてください。
講評部分は指導者の視点で書き、studentMessageだけは${persona.name}本人が児童に直接話しかける自然な一人称メッセージにしてください。
${persona.name}の年齢は${persona.age}歳、出身は${persona.city}, ${persona.country}、好きなものは${persona.likes.join(', ')}です。`,
      prompt,
      900
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
    const uniqueKeyPhrases = Array.isArray(parsed.keyPhrases)
      ? parsed.keyPhrases.filter((phrase: any, index: number, all: any[]) => {
          const key = String(phrase?.english || '').trim().toLowerCase();
          return key && all.findIndex((p: any) => String(p?.english || '').trim().toLowerCase() === key) === index;
        })
      : [];

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
          typeof parsed.studentMessage === 'string' && parsed.studentMessage.trim()
            ? parsed.studentMessage.trim()
            : fallbackFeedback.studentMessage,
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
function checkSensitiveLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now(); const record = sensitiveAttemptMap.get(key);
  if (!record || now > record.resetTime) { sensitiveAttemptMap.set(key, { count: 1, resetTime: now + windowMs }); return true; }
  if (record.count >= maxRequests) return false; record.count += 1; return true;
}
app.get('/management', (_req, res) => { res.setHeader('Cache-Control', 'no-store'); res.type('html').send(managementPageHtml()); });
app.post('/api/student/resolve', async (req, res) => {
  const ip=req.ip||req.socket.remoteAddress||'unknown'; if(!checkSensitiveLimit(`student:${ip}`,15,10*60_000))return res.status(429).json({success:false,error:'TOO_MANY_CODE_ATTEMPTS'});
  if(!persistenceConfigured())return res.status(503).json({success:false,error:'PERSISTENCE_NOT_CONFIGURED'}); const learningCode=normalizeLearningCode(req.body?.learningCode);
  if(!isValidLearningCode(learningCode))return res.status(400).json({success:false,error:'INVALID_LEARNING_CODE'});
  try{const student=await resolveStudentByCode(learningCode);if(!student)return res.status(401).json({success:false,error:'LEARNING_CODE_NOT_FOUND'});res.setHeader('Cache-Control','no-store');return res.json({success:true});}
  catch(error:any){console.error('Student code resolve failed',{message:error?.message});return res.status(503).json({success:false,error:'STUDENT_LOOKUP_UNAVAILABLE'});}
});
app.post('/api/student/history', async (req,res)=>{
  const ip=req.ip||req.socket.remoteAddress||'unknown';if(!checkSensitiveLimit(`history:${ip}`,30,10*60_000))return res.status(429).json({success:false,error:'RATE_LIMITED'});const learningCode=normalizeLearningCode(req.body?.learningCode);
  if(!isValidLearningCode(learningCode))return res.status(400).json({success:false,error:'INVALID_LEARNING_CODE'});
  try{const student=await resolveStudentByCode(learningCode);if(!student)return res.status(401).json({success:false,error:'LEARNING_CODE_NOT_FOUND'});const history=await getStudentHistory(student.studentId);res.setHeader('Cache-Control','no-store');return res.json({success:true,history});}
  catch(error:any){console.error('Student history failed',{message:error?.message});return res.status(503).json({success:false,error:'HISTORY_UNAVAILABLE'});}
});
app.post('/api/sessions', async (req,res)=>{
  const validated=validateSessionSaveInput(req.body);if('error' in validated)return res.status(400).json({success:false,error:validated.error});
  try{const student=await resolveStudentByCode(validated.value.learningCode);if(!student)return res.status(401).json({success:false,error:'LEARNING_CODE_NOT_FOUND'});const saved=await saveCanonicalSession({sessionId:validated.value.sessionId,studentId:student.studentId,researchId:student.researchId,classId:student.classId,aiStudentId:validated.value.aiStudentId,topic:validated.value.topic,targetDurationMinutes:validated.value.targetDurationMinutes,startedAt:validated.value.startedAt,endedAt:validated.value.endedAt,history:validated.value.history,encounteredVocab:validated.value.encounteredVocab||[],reflection:validated.value.reflection});res.setHeader('Cache-Control','no-store');return res.json({success:true,session:{sessionId:saved.sessionId,lifetimeSessionNumber:saved.lifetimeSessionNumber}});}
  catch(error:any){console.error('Session save failed',{message:error?.message});const conflict=error?.message==='SESSION_ID_CONFLICT';return res.status(conflict?409:503).json({success:false,error:conflict?'SESSION_ID_CONFLICT':'SESSION_SAVE_UNAVAILABLE'});}
});
app.post('/api/management/login',(req,res)=>{const ip=req.ip||req.socket.remoteAddress||'unknown';if(!checkSensitiveLimit(`mgmt:${ip}`,10,15*60_000))return res.status(429).json({success:false,error:'TOO_MANY_LOGIN_ATTEMPTS'});const username=typeof req.body?.username==='string'?req.body.username.slice(0,100):'';const password=typeof req.body?.password==='string'?req.body.password.slice(0,300):'';const result=authenticateManagement(username,password);if(!result)return res.status(managementAuthConfigured()?401:503).json({success:false,error:managementAuthConfigured()?'INVALID_CREDENTIALS':'MANAGEMENT_AUTH_NOT_CONFIGURED'});setManagementCookie(res,result.token);return res.json({success:true,role:result.role});});
app.post('/api/management/logout',(_req,res)=>{clearManagementCookie(res);return res.json({success:true});});
app.get('/api/management/me',requireManagementRole(['teacher','researcher']),(req:AuthenticatedRequest,res)=>{res.setHeader('Cache-Control','no-store');return res.json({success:true,user:req.managementUser});});
app.get('/api/management/student-codes', requireManagementRole(['teacher']), async (_req,res) => {
  try { const students=await getStudentRecordsForManagement(); res.setHeader('Cache-Control','no-store'); return res.json({success:true,students}); }
  catch(error:any){console.error('Student code list failed',{message:error?.message});return res.status(503).json({success:false,error:'CODE_LIST_UNAVAILABLE'});}
});
app.post('/api/management/student-codes', requireManagementRole(['teacher']), async (req,res) => {
  const action=typeof req.body?.action==='string'?req.body.action:'create';
  try {
    if(action==='create'){const code=normalizeLearningCode(req.body?.learningCode);if(!isValidLearningCode(req.body?.learningCode))return res.status(400).json({success:false,error:'INVALID_LEARNING_CODE'});const created=await createStudentCode(code,undefined,undefined,req.body?.classId);return res.json({success:true,studentId:created.studentId,classId:created.classId});}
    if(action==='reissue'){const studentId=typeof req.body?.studentId==='string'?req.body.studentId:'';if(!studentId||!isValidLearningCode(req.body?.learningCode))return res.status(400).json({success:false,error:'INVALID_REISSUE_REQUEST'});const created=await reissueStudentCode(studentId,normalizeLearningCode(req.body.learningCode));return res.json({success:true,studentId:created.studentId,classId:created.classId});}
    if(action==='set-active'){const studentId=typeof req.body?.studentId==='string'?req.body.studentId:'';if(!studentId||typeof req.body?.active!=='boolean')return res.status(400).json({success:false,error:'INVALID_ACTIVE_REQUEST'});await setStudentActive(studentId,req.body.active);return res.json({success:true});}
    return res.status(400).json({success:false,error:'INVALID_CODE_ACTION'});
  } catch(error:any){console.error('Student code mutation failed',{message:error?.message});const conflict=error?.message==='LEARNING_CODE_ALREADY_EXISTS';return res.status(conflict?409:503).json({success:false,error:conflict?'LEARNING_CODE_ALREADY_EXISTS':'CODE_MUTATION_UNAVAILABLE'});}
});
app.get('/api/management/sessions',requireManagementRole(['teacher']),async(_req,res)=>{try{const sessions=await getTeacherSessionsForManagement();res.setHeader('Cache-Control','no-store');return res.json({success:true,sessions});}catch(error:any){console.error('Management sessions failed',{message:error?.message});return res.status(503).json({success:false,error:'MANAGEMENT_DATA_UNAVAILABLE'});}});
function csvCell(value:unknown):string{const text=String(value??'');return `"${text.replace(/"/g,'""')}"`;}
app.get('/api/management/research.csv',requireManagementRole(['researcher']),async(_req,res)=>{try{const sessions=await getAllSessionsForManagement();const rows=sessions.map(anonymizeSessionForResearch);const headers=rows.length?Object.keys(rows[0]):['research_id','session_id'];const csv=[headers.map(csvCell).join(','),...rows.map(row=>headers.map(key=>csvCell(row[key])).join(','))].join('\n');res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="research-export.csv"');res.setHeader('Cache-Control','no-store');return res.send('\uFEFF'+csv);}catch(error:any){console.error('Research export failed',{message:error?.message});return res.status(503).json({success:false,error:'RESEARCH_EXPORT_UNAVAILABLE'});}});

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