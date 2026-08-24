import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import Anthropic from '@anthropic-ai/sdk';
import { getAIStudentById } from './src/data/curriculum';
import { generateFallbackFeedback } from './src/utils/feedbackFallback';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Security Middleware: Set headers compatible with iframe embedding
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// JSON Body Parser with strict 10kb limit to prevent payload flooding
app.use(express.json({ limit: '10kb' }));

// Classroom-friendly Rate Limiter for School NAT environments
// A single Hamamatsu school public IP may host 30-40 simultaneous Chromebooks in one class.
// Global IP limit: 300 requests per minute per IP.
// Fast repeated request throttle: Prevents automated flood from single connection.
interface RateRecord {
  count: number;
  resetTime: number;
}
const rateLimitMap = new Map<string, RateRecord>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 300; // Accommodates an entire 35-student classroom active concurrently

  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count += 1;
  return true;
}

// Clean up old rate limit records periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// Serve static images directly from src/assets/images
app.use('/images', express.static(path.join(process.cwd(), 'src', 'assets', 'images')));

// Health check endpoint (Minimal, does NOT leak API keys or internal configuration)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
  });
});

// Lazy initialization of Claude (Anthropic) Client
let anthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey,
    });
  }
  return anthropicClient;
}

// =====================================================================
import { maskHighRiskPII, detectPromptInjection, detectInappropriateContent } from './src/utils/security';
import { validateAiResponse, inspectAiResponse } from './src/utils/responseValidation';

export { maskHighRiskPII, detectPromptInjection, detectInappropriateContent, validateAiResponse, inspectAiResponse };

// Output Sanitizer to filter AI replies before sending to children
function sanitizeAiOutput(reply: string, personaName: string): string {
  return validateAiResponse(reply, personaName);
}

// Simple text sanitizer for history (removes raw high-risk PII)
function sanitizeStudentInput(text: string): string {
  if (!text) return '';
  return maskHighRiskPII(text).maskedText;
}

// Helper to extract student's spoken name from English introduction
function extractSpokenName(text: string): string | null {
  if (!text) return null;
  const match = text.match(/\b(?:my name is|call me)\s+([A-Za-z]{2,15})\b/i);
  if (match) {
    const candidate = match[1].trim();
    const excludeWords = [
      'in', 'from', 'ten', 'eleven', 'twelve', 'fine', 'good', 'happy', 'ready',
      'fifth', 'sixth', 'student', 'boy', 'girl', 'japanese', 'japan', 'not', 'very',
      'doing', 'great', 'tired', 'hungry', 'sad', 'okay', 'sorry', 'busy', 'a', 'an', 'the'
    ];
    if (!excludeWords.includes(candidate.toLowerCase())) {
      return candidate.charAt(0).toUpperCase() + candidate.slice(1).toLowerCase();
    }
  }
  return null;
}

// System Instruction Generator for Persona (Generative AI-centric Natural System Prompt)
function getSystemInstructionForPersona(studentId: string): string {
  const p = getAIStudentById(studentId);

  return `You are a friendly virtual international student.
You are having a one-on-one English conversation with a Japanese elementary school student in Grade 5 or 6.
Your role is to be a friendly conversation partner, not a teacher, examiner, or interviewer.
Be warm, curious, patient, and genuinely interested in what the student says.
Speak naturally and use English that is generally easy for a Japanese elementary school student to understand.
Prefer familiar everyday words and natural sentences.
However, do NOT follow a fixed vocabulary list, grammar list, sentence length, question list, conversation script, or set of reaction phrases.
Natural communication is more important than strict textbook conformity.

PERSONA DETAILS:
Name: ${p.name} (${p.japaneseName})
Age: ${p.age} years old
From: ${p.city}, ${p.country} (${p.countryJapanese})
University: Shizuoka University exchange student (静岡大学 交換留学生)
Major: ${p.major}
Interests / Background: ${p.likes.join(', ')}

IMPORTANT CONVERSATION RULES:
1. Listen carefully to the student's latest message.
2. Respond to what the student actually said.
3. If the student asks a question (e.g. "How are you?", "What food do you like?", "Where are you from?", "Can you play soccer?"), answer that question directly and naturally first before asking anything back.
4. Never give an unrelated response.
5. Usually continue the conversation by asking ONE natural question related to the student's latest message or current topic context.
6. Generate the follow-up question from the conversation context.
7. Do not use predetermined questions.
8. Do not rely on predetermined reaction phrases or filler expressions.
9. Do not repeatedly use the same wording.
10. Follow the student's topic when the conversation naturally changes direction.
11. Share a small amount of relevant information about yourself when appropriate.
12. Do not correct the student's grammar unless correction is specifically requested.
13. If the student's English is incomplete or imperfect, infer the intended meaning and respond naturally.
14. If the student says "Goodbye", "See you", "Thank you", or clearly ends the conversation, say goodbye warmly and do not force a follow-up question.
15. If the student asks for clarification (e.g. "Pardon?", "Sorry?", "What?"), rephrase what you previously said in simpler, clearer English.
16. Keep the conversation friendly, encouraging, age-appropriate, and natural.
17. Make the conversation feel like a genuine conversation, not an English test.

The student's latest message and the conversation context are more important than any predetermined conversation pattern.

Output strictly valid JSON:
{
  "reply": "English response from ${p.name}",
  "japaneseTranslation": "Natural, gentle Japanese translation suitable for 5th/6th grade student",
  "mood": "happy" | "speaking" | "thinking" | "encouraging",
  "culturalNote": "Brief friendly cultural tip in Japanese if relevant (or empty string)"
}`;
}

// =====================================================================
// API endpoint for Chat (/api/chat)
// =====================================================================
app.post('/api/chat', async (req, res) => {
  const requestStart = Date.now();
  let apiRequestStart: number | null = null;
  let apiResponseReceived: number | null = null;
  let route: 'anthropic' | 'fallback' = 'anthropic';
  let fallbackReason: string | undefined = undefined;

  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  // 1. Rate Limiting Check (300 requests/min/IP for school NAT environment)
  if (!checkRateLimit(ip)) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests. Please wait a moment.',
      data: {
        reply: 'Please wait a moment before sending another message.',
        japaneseTranslation: '少し時間をおいてから送信してね。',
        mood: 'thinking',
      },
    });
  }

  const { message, history, topic, studentName, aiStudentId } = req.body;
  const persona = getAIStudentById(aiStudentId);
  const rawMessage = typeof message === 'string' ? message : '';
  const trimmedMessage = rawMessage.trim();

  // 2. Character Length Restriction (Max 100 characters)
  if (trimmedMessage.length > 100) {
    return res.json({
      success: true,
      data: {
        reply: 'Your sentence is a bit long! Please try a shorter English sentence.',
        japaneseTranslation: '文が少し長いです！もう少し短い英語で話してみてね。',
        mood: 'thinking',
        culturalNote: '短い文でポンポン会話を続けるのが英語上達のコツだよ！',
      },
      _diagnostics: {
        requestStart,
        responseEnd: Date.now(),
        latencyMs: Date.now() - requestStart,
        route: 'precheck_length',
      },
    });
  }

  // 3. Prompt Injection Pre-Check
  if (detectPromptInjection(trimmedMessage)) {
    return res.json({
      success: true,
      data: {
        reply: `I am ${persona.name} from ${persona.countryJapanese}! Let's practice English together. What is your favourite sport?`,
        japaneseTranslation: `静岡大学留学生の${persona.name}だよ！一緒に英語の練習をしよう。好きなスポーツは何ですか？`,
        mood: 'encouraging',
        culturalNote: `${persona.name}と一緒に楽しく英語の会話を続けよう！`,
      },
      _diagnostics: {
        requestStart,
        responseEnd: Date.now(),
        latencyMs: Date.now() - requestStart,
        route: 'precheck_injection',
      },
    });
  }

  // 4. Inappropriate / Dangerous Topic Pre-Check
  if (detectInappropriateContent(trimmedMessage)) {
    return res.json({
      success: true,
      data: {
        reply: "Let's practice friendly English! What food do you like?",
        japaneseTranslation: '仲良く英語の練習をしよう！好きな食べ物は何ですか？',
        mood: 'encouraging',
        culturalNote: '好きな食べ物を英語で伝えてみよう！(例: I like sushi.)',
      },
      _diagnostics: {
        requestStart,
        responseEnd: Date.now(),
        latencyMs: Date.now() - requestStart,
        route: 'precheck_safety',
      },
    });
  }

  // 5. High-Risk PII Masking
  const { maskedText: safeUserMessage, hasHighRiskPII } = maskHighRiskPII(trimmedMessage);

  // Extract spoken name if the student just introduced themselves
  const spokenName = extractSpokenName(trimmedMessage);
  const effectiveName = spokenName || (studentName && studentName !== '5・6年生' ? studentName.slice(0, 12) : '');

  // 6. Sanitize History & Limit to last 4 turns (8 messages)
  const rawHistory = Array.isArray(history) ? history : [];
  const recentHistory = rawHistory.slice(-8);
  const formattedHistory = recentHistory
    .map((msg: { sender: string; englishText: string }) => {
      const speaker = msg.sender === 'ai' ? persona.name : (effectiveName || 'Student');
      return `${speaker}: ${sanitizeStudentInput(msg.englishText || '').slice(0, 100)}`;
    })
    .join('\n');

  const prompt = `Conversation history (recent turns):
${formattedHistory || '(Beginning of dialogue)'}

Selected topic: ${topic || 'favorites'}
Student Name: ${effectiveName || 'Elementary Student (Grade 5/6)'}
AI Student: ${persona.name} (${persona.country}, Likes/Culture: ${persona.likes.join(', ')})
Student's latest input: "${safeUserMessage || 'Hello!'}"
${hasHighRiskPII ? '(Note: A private contact detail in student input was masked for safety. Continue practicing English warmly.)' : ''}

CRITICAL RESPONSE MANDATES:
1. Listen carefully to student's latest input and respond directly and naturally.
2. If student asked a question (e.g. "How are you?", "What food do you like?", "Where are you from?", "Can you swim?"), DIRECTLY ANSWER FIRST with your persona details before asking any follow-up question.
3. If student says "Goodbye" / "See you", respond with a warm farewell and do not force a question.
4. If student asks for clarification (e.g. "Pardon?", "Sorry?"), rephrase your previous statement simply.
5. Return strictly valid JSON: { "reply": "...", "japaneseTranslation": "...", "mood": "happy"|"speaking"|"encouraging", "culturalNote": "..." }`;

  try {
    const claude = getAnthropicClient();
    if (claude) {
      const configuredModel = process.env.ANTHROPIC_MODEL;
      const primaryModel =
        configuredModel && !configuredModel.startsWith('sk-ant')
          ? configuredModel
          : 'claude-3-5-sonnet-20241022';
      
      let response: any;
      let attempts = 0;

      while (attempts < 2) {
        attempts++;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);
          apiRequestStart = Date.now();

          try {
            response = await claude.messages.create(
              {
                model: primaryModel,
                max_tokens: 400,
                system: getSystemInstructionForPersona(aiStudentId),
                messages: [{ role: 'user', content: prompt }],
              },
              { signal: controller.signal }
            );
            apiResponseReceived = Date.now();
            break; // Success
          } finally {
            clearTimeout(timeoutId);
          }
        } catch (err: any) {
          // If 429 rate limited on first attempt, retry once after a short wait
          if (err?.status === 429 && attempts === 1) {
            await new Promise((r) => setTimeout(r, 800));
            continue;
          }
          throw err;
        }
      }

      const rawText = response.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => ('text' in block ? block.text : ''))
        .join('')
        .trim();

      let jsonStr = rawText;
      if (jsonStr.includes('{') && jsonStr.includes('}')) {
        const start = jsonStr.indexOf('{');
        const end = jsonStr.lastIndexOf('}');
        jsonStr = jsonStr.substring(start, end + 1);
      }

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        throw new Error('API_INVALID_RESPONSE: Failed to parse JSON');
      }

      const sanitizedReply = sanitizeAiOutput(parsed.reply, persona.name);
      const responseEnd = Date.now();

      return res.json({
        success: true,
        isFallback: false,
        data: {
          reply: sanitizedReply,
          japaneseTranslation: parsed.japaneseTranslation || '',
          mood: parsed.mood || 'speaking',
          culturalNote: parsed.culturalNote || '',
          detectedName: spokenName || undefined,
        },
        _diagnostics: {
          requestId: `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          requestStart,
          apiRequestStart,
          apiResponseReceived,
          responseEnd,
          latencyMs: responseEnd - requestStart,
          pathType: 'NORMAL_AI',
          route: 'anthropic',
        },
      });
    }

    return res.status(503).json({
      success: false,
      error: 'AI service is not configured. No conversation fallback is available.',
      _diagnostics: {
        requestId: `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        requestStart,
        responseEnd: Date.now(),
        pathType: 'AI_UNAVAILABLE',
      },
    });
  } catch (error: any) {
    const responseEnd = Date.now();
    const fallbackReason =
      error?.status === 429
        ? 'RATE_LIMIT'
        : error?.name === 'AbortError' || error?.message?.includes('aborted') || error?.message?.includes('timeout')
          ? 'API_TIMEOUT'
          : error?.message?.includes('API_INVALID_RESPONSE')
            ? 'API_INVALID_RESPONSE'
            : error?.status >= 500
              ? 'API_5XX'
              : 'API_ERROR';

    const statusCode = fallbackReason === 'RATE_LIMIT' ? 429 : fallbackReason === 'API_TIMEOUT' ? 504 : 502;
    return res.status(statusCode).json({
      success: false,
      error: 'AI service is temporarily unavailable. No conversation fallback is available.',
      _diagnostics: {
        requestId: `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        requestStart,
        apiRequestStart,
        apiResponseReceived,
        responseEnd,
        latencyMs: responseEnd - requestStart,
        pathType: 'AI_ERROR',
        fallbackReason,
      },
    });
  }
});


// =====================================================================
// API endpoint for Dialogue Feedback (/api/feedback)
// =====================================================================
app.post('/api/feedback', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ success: false, error: 'Rate limited' });
  }

  const { history, studentName, durationMinutes, turns, totalWords, aiStudentId, encounteredVocab } =
    req.body;
  const persona = getAIStudentById(aiStudentId);

  const rawHistory = Array.isArray(history) ? history : [];
  const childMessages = rawHistory.filter(
    (m: { sender: string; englishText: string }) => m.sender !== 'ai' && m.englishText?.trim()
  );

  // Check if student introduced their name in conversation
  let detectedNameInDialogue: string | null = null;
  for (const m of childMessages) {
    const found = extractSpokenName(m.englishText);
    if (found) {
      detectedNameInDialogue = found;
      break;
    }
  }

  const safeName = detectedNameInDialogue || (studentName && studentName !== '5・6年生' ? sanitizeStudentInput(studentName).slice(0, 12) : '');
  const displayName = safeName || 'あなた';

  // Extract observable English phrases, max 6 phrases, with high-risk PII masked
  const childUtterances = childMessages
    .slice(-8)
    .map((m: { englishText: string }) => maskHighRiskPII(m.englishText.trim()).maskedText.slice(0, 60))
    .filter((t: string) => t.length > 0);

  const childUtteranceList = childUtterances.map((text: string) => `「${text}」`).join('、 ');
  const allSpokenTextLower = childUtterances.join(' ').toLowerCase();

  const feedbackPrompt = `
あなたは静岡大学留学生交流プログラムの指導教員・小学校英語教育の専門家です。
文部科学省の小学校外国語（英語）目標に基づき、小学5・6年生の児童 (${displayName}) に対する対話練習の講評を作成してください。

【厳格な評価指針】:
1. 「今回学んだ英語 (keyPhrases)」:
   - 児童および留学生が「実際の会話で本当に使用した英語フレーズ・語彙」のみを抽出してください。
   - 会話に一度も登場していない架空のフレーズや固定例文（「How about you?」「I like sushi.」など）を勝手に追加することは固く禁止します。
2. 「次へのステップアップ (improvementAdvice)」:
   - 児童の実際の発話（${childUtteranceList || '発話'}）を分析し、児童が「まだ使っていない次の表現」を動的に提案してください。
   - もし児童が既に「How about you?」を使っていた場合、「How about you?を使おう」と提案することは絶対に禁止です。理由を一言付け足す「because it is ～」や、できることを伝える「I can ～」など別の発展表現を提案してください。
3. 児童の名前（${displayName}さん）を自然に温かく用いて励ましてください。

対話実績:
- 留学生: ${persona.name} (${persona.countryJapanese}, ${persona.city})
- 時間: ${durationMinutes || 1}分
- ターン数: ${turns || 0}ターン
- 児童の英語発話例: ${childUtteranceList || '(リスニング中心)'}

以下のJSONフォーマットのみを出力してください:
{
  "goodPoints": [
    "実際に話せた英語表現（${childUtteranceList || '発話'}）を具体的に引用して褒める点",
    "質問に答えられたことや会話を続けられた点を褒める点",
    "意欲的に挑戦できた点を褒める点"
  ],
  "improvementAdvice": {
    "title": "次へのステップアドバイスの見出し",
    "detail": "児童の発話分析に基づき、まだ使っていない次の一歩を優しく促す説明",
    "examplePhrase": "すぐに使える英語フレーズ例"
  },
  "overallComment": "${displayName}さん、${persona.countryJapanese}の留学生 ${persona.name} との対話の温かい講評メッセージ",
  "keyPhrases": [
    { "english": "実際に会話に出たフレーズ", "japanese": "日本語訳", "culturalNote": "ワンポイント" }
  ]
}
`;

  try {
    const claude = getAnthropicClient();
    if (claude) {
      const primaryModel = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
      const response = await claude.messages.create({
        model: primaryModel,
        max_tokens: 1000,
        messages: [{ role: 'user', content: feedbackPrompt }],
      });

      const rawText = response.content
        .filter((block) => block.type === 'text')
        .map((block) => ('text' in block ? block.text : ''))
        .join('')
        .trim();

      let jsonStr = rawText;
      if (jsonStr.includes('{') && jsonStr.includes('}')) {
        const start = jsonStr.indexOf('{');
        const end = jsonStr.lastIndexOf('}');
        jsonStr = jsonStr.substring(start, end + 1);
      }

      const parsed = JSON.parse(jsonStr);
      return res.json({
        success: true,
        isFallback: false,
        data: {
          ...parsed,
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
    }

    // High-quality dynamic fallback feedback
    const fallbackData = generateFallbackFeedback(
      persona,
      displayName,
      turns || 0,
      totalWords || 0,
      (durationMinutes || 1) * 60,
      durationMinutes || 1,
      encounteredVocab || [],
      rawHistory
    );

    return res.json({
      success: true,
      isFallback: true,
      fallbackReason: 'API_KEY_NOT_CONFIGURED',
      data: fallbackData,
    });
  } catch (error: any) {
    let fallbackReason = 'API_ERROR';
    if (error?.name === 'AbortError' || error?.message?.includes('aborted') || error?.message?.includes('timeout')) {
      fallbackReason = 'API_TIMEOUT';
    }

    // High-quality dynamic fallback feedback for resilience
    const fallbackData = generateFallbackFeedback(
      persona,
      displayName,
      turns || 0,
      totalWords || 0,
      (durationMinutes || 1) * 60,
      durationMinutes || 1,
      encounteredVocab || [],
      rawHistory
    );

    return res.json({
      success: true,
      isFallback: true,
      fallbackReason,
      data: fallbackData,
    });
  }
});

// Start server with Vite middleware in dev or static serving in prod
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    // High-level start message without sensitive details
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
