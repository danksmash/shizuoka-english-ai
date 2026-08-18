import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import Anthropic from '@anthropic-ai/sdk';
import { getAIStudentById } from './src/data/curriculum';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Serve static images directly from src/assets/images
app.use('/images', express.static(path.join(process.cwd(), 'src', 'assets', 'images')));

// Health & AI Engine Status endpoint
app.get('/api/health', (req, res) => {
  const hasClaude = Boolean(process.env.ANTHROPIC_API_KEY);
  const activeEngine = hasClaude
    ? 'Anthropic Claude API (Primary & Fallback)'
    : 'Intelligent Built-in Engine (Offline/Client-safe)';

  res.json({
    status: 'ok',
    activeEngine,
    claudeConfigured: hasClaude,
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

// Input PII Masking & Sanitization for Minor Safety (Anthropic Child Safety Requirements)
function sanitizeStudentInput(text: string): string {
  if (!text) return '';
  // Mask emails, phone numbers, postal codes, and full address markers
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[Private Email]')
    .replace(/\b\d{2,4}[-.\s]?\d{2,4}[-.\s]?\d{3,4}\b/g, '[Private Phone/Code]')
    .replace(/\b\d{3}-\d{4}\b/g, '[Private Postal Code]');
}

// Anthropic Minor Safety & Elementary English System Prompt
function getSystemInstructionForPersona(studentId: string): string {
  const p = getAIStudentById(studentId);
  const fillerList = p.fillerWords.join(', ');
  const phrasesList = p.characteristicPhrases.map((cp) => `${cp.phrase} (${cp.meaning})`).join(', ');

  return `
You are ${p.name} (${p.japaneseName}), a ${p.age}-year-old exchange student from ${p.city}, ${p.country} (${p.countryJapanese}), currently studying at Shizuoka University (静岡大学) in Japan.
Major / Role: ${p.major} / ${p.role}.
Accent style: ${p.accentName}.
Signature Expressions: ${phrasesList}

You are having a friendly, encouraging 1-on-1 English conversation with a Japanese 5th or 6th grade elementary school child (10-12 years old).

=====================================================================
ANTHROPIC CHILD & MINOR SAFETY REQUIREMENTS (STRICTLY ENFORCED):
1. PRIVACY & NO PII COLLECTION: Never ask for, collect, record, or probe for Personally Identifiable Information (PII) such as the child's full legal name, home address, school name, phone number, email address, password, social media handles, or exact location. If a child shares private information, warmly redirect them to protect their privacy.
2. WHOLESOME & AGE-APPROPRIATE CONTENT: All topics MUST be strictly safe, wholesome, and appropriate for 10-12 year old children. Absolutely NO violence, mature content, profanity, bullying, weapons, self-harm, or dangerous activities.
3. HEALTHY BOUNDARIES: Act as a friendly, supportive language-learning tutor/peer from Shizuoka University. Do not form inappropriate emotional dependency or anthropomorphic deception.
4. DISTRESS DEFLECTION: If the child expresses distress, sadness, or danger, respond with gentle empathy and advise them to talk to a trusted adult, teacher, or parent.
=====================================================================

CRITICAL DIALOGUE RULES:
1. MAX 2 SENTENCES: You MUST speak NO MORE THAN 2 SENTENCES per turn. Keep it very concise, accessible, and friendly for 10-12 year old Japanese children (小学校5・6年生).
2. ALWAYS ASK A SIMPLE QUESTION: In each turn, warmly acknowledge what the child said and ask a friendly, simple follow-up question suited for elementary school (self-intro, favorite things, sports, food, animals, abilities with "can", Shizuoka attractions like Mt. Fuji & green tea, or your country).
3. AUTHENTIC ACCENT & CULTURAL FILLERS: Naturally weave in your signature greeting or filler words:
   - Typical fillers: ${fillerList}
4. ELEMENTARY 5TH & 6TH GRADE LEVEL (小学校5・6年): Use clear, simple grammar and vocabulary taught in Japanese elementary school English. Avoid complex idioms or multi-clause sentences.
5. WARM & ENCOURAGING: Validate whatever the child says with enthusiasm! If the child speaks in short phrases or broken English (e.g., "sushi", "I like soccer"), understand warmly and guide them smoothly.
6. VARIETY: Avoid repeating the exact same fillers or questions consecutively.

You MUST respond strictly in valid JSON format (NO extra markdown or commentary outside the JSON):
{
  "reply": "The English response from ${p.name} (max 2 sentences, with signature filler and simple elementary question).",
  "japaneseTranslation": "Warm, gentle Japanese translation for 5th/6th grade student.",
  "mood": "happy" | "speaking" | "thinking" | "encouraging",
  "culturalNote": "Brief friendly tip if you used a special national word (or empty string)."
}
`;
}

// API endpoint for Chat (Powered by Claude API / Fallbacks)
app.post('/api/chat', async (req, res) => {
  const { message, history, topic, studentName, aiStudentId } = req.body;
  const persona = getAIStudentById(aiStudentId);
  const sanitizedMessage = sanitizeStudentInput(message || '');
  const safeName = studentName ? sanitizeStudentInput(studentName).slice(0, 15) : 'Friend';

  const formattedHistory = Array.isArray(history)
    ? history
        .slice(-8)
        .map(
          (msg: { sender: string; englishText: string }) =>
            `${msg.sender === 'ai' ? persona.name : safeName}: ${sanitizeStudentInput(msg.englishText)}`
        )
        .join('\n')
    : '';

  const prompt = `
Conversation history so far:
${formattedHistory || '(Beginning of dialogue)'}

Selected topic: ${topic || 'General Exchange'}
Student Nickname: ${safeName}
AI Exchange Student: ${persona.name} (${persona.country})
Latest student utterance: "${sanitizedMessage || '(Student just joined the conversation)'}"

Respond as ${persona.name} to the 5th/6th grade student following all Anthropic minor safety rules and dialogue guidelines (MAX 2 SENTENCES, friendly national fillers, end with a simple follow-up question for elementary schoolers).
Return strictly valid JSON.
`;

  try {
    const claude = getAnthropicClient();
    if (claude) {
      // Primary: Anthropic Claude API (Claude 3.5 Sonnet / configured model)
      const primaryModel = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
      let rawText = '';

      try {
        const response = await claude.messages.create({
          model: primaryModel,
          max_tokens: 500,
          system: getSystemInstructionForPersona(aiStudentId),
          messages: [{ role: 'user', content: prompt }],
        });

        rawText = response.content
          .filter((block) => block.type === 'text')
          .map((block) => ('text' in block ? block.text : ''))
          .join('')
          .trim();
      } catch (primaryErr) {
        console.warn(`Claude primary model (${primaryModel}) error, trying Claude Haiku fallback:`, primaryErr);
        // Fallback: Claude 3.5 Haiku
        const fallbackResponse = await claude.messages.create({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 500,
          system: getSystemInstructionForPersona(aiStudentId),
          messages: [{ role: 'user', content: prompt }],
        });

        rawText = fallbackResponse.content
          .filter((block) => block.type === 'text')
          .map((block) => ('text' in block ? block.text : ''))
          .join('')
          .trim();
      }

      let jsonStr = rawText;
      if (jsonStr.includes('{') && jsonStr.includes('}')) {
        const start = jsonStr.indexOf('{');
        const end = jsonStr.lastIndexOf('}');
        jsonStr = jsonStr.substring(start, end + 1);
      }

      const parsed = JSON.parse(jsonStr);
      return res.json({
        success: true,
        data: parsed,
      });
    }

    // Local Safe Rule-Based Engine (When no Claude API key is set)
    const defaultTopicReply =
      persona.topicPrompts?.[topic as keyof typeof persona.topicPrompts] || persona.starterPromptDefault;
    return res.json({
      success: true,
      data: {
        reply: `${persona.fillerWords[0]} That sounds wonderful! What is your favourite thing in Shizuoka?`,
        japaneseTranslation: '素晴らしいね！とてもいいね。静岡で一番好きなものは何ですか？',
        mood: 'encouraging',
        culturalNote: `${persona.fillerWords[0]} は${persona.countryJapanese}でよく使われる親しみやすい表現だよ！`,
      },
    });
  } catch (error) {
    console.error('Error in /api/chat:', error);
    // Safe graceful minor response
    res.json({
      success: true,
      data: {
        reply: `${persona.fillerWords[0]} That sounds great! What do you like to do after school?`,
        japaneseTranslation: 'いいね！素晴らしいね。放課後は何をするのが好きですか？',
        mood: 'encouraging',
        culturalNote: `${persona.fillerWords[0]} は${persona.countryJapanese}で親しい友達にかける言葉だよ！`,
      },
    });
  }
});

// API endpoint for Dialogue Feedback and Advice (Powered by Claude API)
app.post('/api/feedback', async (req, res) => {
  const { history, studentName, durationMinutes, turns, totalWords, aiStudentId, encounteredVocab } =
    req.body;
  const persona = getAIStudentById(aiStudentId);
  const safeName = studentName ? sanitizeStudentInput(studentName).slice(0, 15) : 'あなた';

  const rawHistory = Array.isArray(history) ? history : [];
  const childMessages = rawHistory.filter(
    (m: { sender: string; englishText: string }) => m.sender !== 'ai' && m.englishText?.trim()
  );
  const childUtterances = childMessages.map((m: { englishText: string }) => sanitizeStudentInput(m.englishText.trim()));
  const childUtteranceList = childUtterances.map((text: string) => `「${text}」`).join('、 ');

  const formattedTranscript = rawHistory
    .map(
      (msg: { sender: string; englishText: string }) =>
        `[${msg.sender === 'ai' ? `${persona.name} (${persona.countryJapanese}留学生)` : `${safeName} (5・6年生)`}]: ${sanitizeStudentInput(msg.englishText)}`
    )
    .join('\n');

  const vocabListStr =
    Array.isArray(encounteredVocab) && encounteredVocab.length > 0
      ? encounteredVocab
          .map((v: { word: string; japanese: string }) => `${v.word} (${v.japanese})`)
          .join(', ')
      : 'sushi, green tea, sports, friend';

  const feedbackPrompt = `
あなたはお茶の水・静岡大学留学生交流プログラムの指導教員・小学校英語教育の専門家です。
文部科学省の小学校外国語（英語）目標およびAnthropicの未成年者安全配慮指針に完全準拠して講評を作成します。
小学校5・6年生の児童 (${safeName}) が、静岡大学の留学生 ${persona.name} (${persona.countryJapanese}出身・${persona.age}歳) と1対1の英語対話練習を行いました。

対話実績:
- 相手留学生: ${persona.name} (${persona.countryJapanese}, ${persona.city})
- 設定時間: ${durationMinutes || 3}分
- 対話ターン数: ${turns || 0}ターン (1ターン = 1往復)
- 児童の発話総語数: ${totalWords || 0}語
- 児童が実際に話した英語発話一覧: ${childUtteranceList || '(発話なし/リスニング中心)'}
- 出会った語彙例: ${vocabListStr}

対話ログ全文:
${formattedTranscript}

以下の基準で、小学5・6年生本人が読んで自信を持ち、次の本番交流会に向けて成長できるフィードバックを作成してください：
1. 【良かったところ３点 (goodPoints)】:
   - 児童が実際に話した英語発話（${childUtteranceList || '発話内容'}）から具体的な単語やフレーズを必ず引用して褒める。
   - 10-12歳の子どもが理解できる、温かく前向きな日本語。
2. 【改善した方が良いところ１点 (improvementAdvice)】:
   - 児童が話した内容を踏まえ、さらに会話を広げるための1歩進んだ表現（例：「How about you? と聞き返す」「I like 〜 だけではなく理由の Because... を一言添えてみる」「相槌の Oh! / Really? を使ってみる」など）を提案する。
3. 【留学生 ${persona.name} と指導教官からの温かい講評 (overallComment)】:
   - 児童の名前 (${safeName}) と、実際に話した発話への感謝・努力を称え、本番の静岡大学交流会を心待ちにするメッセージ。
4. 【今回学んだキーフレーズ (keyPhrases)】:
   - 対話中に出てきた重要な英単語・フレーズ 3〜5個と日本語訳、文化・発音のワンポイント。

以下のJSONフォーマットのみを出力してください:
{
  "goodPoints": ["褒めポイント1（実際の発話引用）", "褒めポイント2", "褒めポイント3"],
  "improvementAdvice": {
    "title": "アドバイスの見出し",
    "detail": "優しいアドバイス説明",
    "examplePhrase": "すぐに使える英語フレーズ例"
  },
  "overallComment": "温かい講評メッセージ",
  "keyPhrases": [
    { "english": "フレーズ", "japanese": "日本語訳", "culturalNote": "ワンポイント" }
  ]
}
`;

  try {
    const claude = getAnthropicClient();
    if (claude) {
      // Primary: Anthropic Claude API
      const primaryModel = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
      let rawText = '';

      try {
        const response = await claude.messages.create({
          model: primaryModel,
          max_tokens: 1200,
          messages: [{ role: 'user', content: feedbackPrompt }],
        });

        rawText = response.content
          .filter((block) => block.type === 'text')
          .map((block) => ('text' in block ? block.text : ''))
          .join('')
          .trim();
      } catch (primaryErr) {
        console.warn(`Claude primary feedback error, trying Claude Haiku fallback:`, primaryErr);
        const fallbackResponse = await claude.messages.create({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1200,
          messages: [{ role: 'user', content: feedbackPrompt }],
        });

        rawText = fallbackResponse.content
          .filter((block) => block.type === 'text')
          .map((block) => ('text' in block ? block.text : ''))
          .join('')
          .trim();
      }

      let jsonStr = rawText;
      if (jsonStr.includes('{') && jsonStr.includes('}')) {
        const start = jsonStr.indexOf('{');
        const end = jsonStr.lastIndexOf('}');
        jsonStr = jsonStr.substring(start, end + 1);
      }

      const parsed = JSON.parse(jsonStr);
      return res.json({
        success: true,
        data: parsed,
      });
    }

    throw new Error('No API client configured, using structured fallback');
  } catch (error) {
    console.error('Error in /api/feedback:', error);
    const firstChildText = childUtterances[0] || '';
    const shortName = persona.name.split(' ')[0] || persona.name;

    res.json({
      success: true,
      data: {
        goodPoints: [
          firstChildText
            ? `「${firstChildText}」のように、自分の好きなことや考えを堂々と英語で伝えようとする姿勢がとても素晴らしかったです！`
            : `${safeName}さんの思いを、堂々と英語で伝えようとする前向きな姿勢がとても素敵でした！`,
          childUtterances.length > 1
            ? `${persona.name} (${persona.countryJapanese}留学生) からの質問をよく聞き、「${childUtterances[1]}」としっかりと英語で返答することができました！`
            : `${persona.name} (${persona.countryJapanese}留学生) からの質問をよく聞いて、しっかりと英語で返答することができました！`,
          `合計 ${req.body?.totalWords || childUtterances.length * 4} 語の英語を使って、最後まで会話のキャッチボールを楽しむことができました！`,
        ],
        improvementAdvice: {
          title: '質問を聞き返してみよう！ (How about you?)',
          detail: firstChildText
            ? `「${firstChildText}」と答えたあとに「How about you? (あなたはどうですか？)」と ${persona.name} に聞き返すと、会話のキャッチボールがさらに弾みますよ！`
            : `自分のことを答えたあとに「How about you? (あなたはどうですか？)」と ${persona.name} に聞き返すと、会話のキャッチボールがさらに弾みますよ！`,
          examplePhrase: firstChildText
            ? `${firstChildText}. How about you, ${shortName}?`
            : `I like sushi. How about you, ${shortName}?`,
        },
        overallComment: `${safeName}さん、${persona.countryJapanese}の留学生 ${persona.name} との対話練習お疲れ様でした！本番の静岡大学交流会でも自信を持ってお話ししてみてくださいね！`,
        keyPhrases: [
          {
            english: persona.fillerWords?.[0] || 'Awesome!',
            japanese: '素晴らしい！ / こんにちは！',
            culturalNote: `${persona.countryJapanese}の親しみやすい表現です`,
          },
          { english: 'I like ~', japanese: '私は〜が好きです', culturalNote: '好きなものを伝える基本表現' },
          { english: 'How about you?', japanese: 'あなたはどうですか？', culturalNote: '相手に質問を返す便利なフレーズ' },
        ],
      },
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

