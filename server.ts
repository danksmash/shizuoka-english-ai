import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import Anthropic from '@anthropic-ai/sdk';
import { getAIStudentById } from './src/data/curriculum';
import { generateFallbackFeedback } from './src/utils/feedbackFallback';
import { maskHighRiskPII, detectPromptInjection, detectInappropriateContent } from './src/utils/security';
import { validateAiResponse, inspectAiResponse, buildAlignedReply, inspectStudentJapaneseTranslation } from './src/utils/responseValidation';

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

function isExplicitFarewell(text: string): boolean {
  return /\b(?:goodbye|bye(?: bye)?|see you|see ya)\b/i.test(text.trim());
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
  "studentJapaneseTranslation": "児童の最新英語全体を、日本語だけで自然に訳した文。英語原文を残したり括弧内に繰り返したりしない",
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
  });
});

app.post('/api/chat', async (req, res) => {
  const requestStart = Date.now();
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ success: false, error: 'Too many requests. Please retry.' });
  }

  const { message, history, topic, aiStudentId } = req.body;
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
  const recentHistory = rawHistory.slice(-8);
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

    const requestedStudentTranslationStatus =
      parsed.studentTranslationStatus === 'incomplete' ? 'incomplete' : 'translated';
    const inspectedStudentTranslation = inspectStudentJapaneseTranslation(
      parsed.studentJapaneseTranslation,
      trimmedMessage
    );
    const studentTranslationStatus =
      requestedStudentTranslationStatus === 'incomplete' || !inspectedStudentTranslation.isValid
        ? 'incomplete'
        : 'translated';
    const studentJapaneseTranslation =
      studentTranslationStatus === 'translated'
        ? inspectedStudentTranslation.translation
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

  const { history, durationMinutes, turns, totalWords, aiStudentId, encounteredVocab } = req.body;
  const persona = getAIStudentById(aiStudentId);
  const rawHistory = Array.isArray(history) ? history : [];
  const childMessages = rawHistory.filter((m: any) => m.sender !== 'ai' && m.englishText?.trim());
  const childUtterances = childMessages
    .slice(-8)
    .map((m: any) => maskHighRiskPII(String(m.englishText).trim()).maskedText.slice(0, 60))
    .filter(Boolean);
  const examples = childUtterances.map((t: string) => `「${t}」`).join('、');

  const prompt = `小学5・6年生の英会話練習を日本語で短く講評してください。
留学生: ${persona.name}
時間: ${durationMinutes || 1}分
ターン: ${turns || 0}
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
      turns || 0,
      totalWords || 0,
      (durationMinutes || 1) * 60,
      durationMinutes || 1,
      encounteredVocab || [],
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
        encounteredVocab: encounteredVocab || [],
        aiStudent: persona,
        stats: {
          totalTurns: turns || 0,
          totalChildWords: totalWords || 0,
          durationSeconds: (durationMinutes || 1) * 60,
          targetDurationMinutes: durationMinutes || 1,
        },
      },
    });
  } catch {
    const fallbackData = generateFallbackFeedback(
      persona,
      'あなた',
      turns || 0,
      totalWords || 0,
      (durationMinutes || 1) * 60,
      durationMinutes || 1,
      encounteredVocab || [],
      rawHistory
    );
    return res.json({ success: true, isFallback: true, fallbackReason: 'AI_RETRY_EXHAUSTED', data: fallbackData });
  }
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
