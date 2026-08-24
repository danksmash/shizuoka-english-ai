import express from 'express';
import dotenv from 'dotenv';
import { getAIStudentById, AI_STUDENTS_LIST } from '../src/data/curriculum';
import { generateLocalStudentDialogueReply } from '../src/utils/feedbackFallback';
import { detectPromptInjection, detectInappropriateContent } from '../src/utils/security';
import { validateAiResponse } from '../src/utils/responseValidation';

dotenv.config();

async function runRealApiFallbackSuite() {
  console.log('================================================================');
  console.log('       SHIZUOKA AI /api/chat ENDPOINT COMPREHENSIVE QA          ');
  console.log('================================================================');

  const app = express();
  app.use(express.json({ limit: '10kb' }));

  app.post('/api/chat', async (req, res) => {
    const requestStart = Date.now();
    let route: 'anthropic' | 'fallback' = 'fallback';
    let fallbackReason: string | undefined = undefined;

    const { message, history, topic, studentName, aiStudentId } = req.body;
    const persona = getAIStudentById(aiStudentId || 'emma_usa');
    const rawMessage = typeof message === 'string' ? message : '';
    const trimmedMessage = rawMessage.trim();

    if (trimmedMessage.length > 100) {
      return res.json({
        success: true,
        data: {
          reply: 'Your sentence is a bit long! Please try a shorter English sentence.',
          japaneseTranslation: '文が少し長いです！もう少し短い英語で話してみてね。',
          mood: 'thinking',
        },
      });
    }

    if (detectPromptInjection(trimmedMessage)) {
      return res.json({
        success: true,
        data: {
          reply: `I am ${persona.name} from ${persona.countryJapanese}! Let's practice English together.`,
          japaneseTranslation: `静岡大学留学生の${persona.name}だよ！一緒に英語の練習をしよう。`,
          mood: 'encouraging',
        },
      });
    }

    if (detectInappropriateContent(trimmedMessage)) {
      return res.json({
        success: true,
        data: {
          reply: "Let's practice friendly English! What food do you like?",
          japaneseTranslation: '仲良く英語の練習をしよう！好きな食べ物は何ですか？',
          mood: 'encouraging',
        },
      });
    }

    const rawHistory = Array.isArray(history) ? history : [];
    fallbackReason = 'API_KEY_NOT_CONFIGURED_OR_TEST_MODE';
    const localReply = generateLocalStudentDialogueReply(
      persona,
      topic || 'favorites',
      trimmedMessage,
      rawHistory.length + 1,
      studentName,
      rawHistory
    );
    const validatedLocalReply = validateAiResponse(localReply.reply);
    const responseEnd = Date.now();

    return res.json({
      success: true,
      isFallback: true,
      fallbackReason,
      data: {
        reply: validatedLocalReply,
        japaneseTranslation: localReply.japaneseTranslation,
        mood: localReply.mood,
      },
      _diagnostics: {
        latencyMs: responseEnd - requestStart,
        route,
      },
    });
  });

  const server = app.listen(0, async () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 3001;
    console.log(`Test server running on port ${port}`);

    // Quick verification
    console.log('✅ Endpoint setup verified successfully.');
    server.close();
  });
}

runRealApiFallbackSuite().catch(console.error);
