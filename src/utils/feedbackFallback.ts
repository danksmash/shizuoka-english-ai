import { AIStudentProfile, FeedbackData, VisualVocabularyItem, ChatMessage } from '../types';
import { maskHighRiskPII } from './security';

/**
 * Generates dynamic feedback strictly based on real conversation history.
 * Any child-provided text is masked before it can be copied into feedback UI.
 */
export function generateFallbackFeedback(
  persona: AIStudentProfile,
  studentName: string,
  totalTurns: number,
  totalWords: number,
  durationSeconds: number,
  targetDurationMinutes: number,
  encounteredVocab: VisualVocabularyItem[],
  messages?: ChatMessage[]
): FeedbackData {
  const shortName = persona.name.split(' ')[0] || persona.name;
  const safeStudentName = maskHighRiskPII(String(studentName || '')).maskedText.slice(0, 12) || 'あなた';
  const history = messages || [];

  const childMsgs = history.filter(
    (m) => m.sender !== 'ai' && m.englishText && m.englishText.trim().length > 0
  );

  // Never carry raw child text into fallback feedback. This protects the feedback
  // screen as well as later HTML export when the local/API fallback is used.
  const childTexts = childMsgs
    .map((m) => maskHighRiskPII(m.englishText.trim()).maskedText.slice(0, 100))
    .filter((text) => text.length > 0);
  const allChildTextLower = childTexts.join(' ').toLowerCase();

  // 1. Dynamic Key Phrases Extraction (ONLY phrases that actually occurred in this session!)
  const extractedPhrases: Array<{ english: string; japanese: string; culturalNote: string }> = [];

  // Inspect each message for authentic phrases
  for (const text of childTexts) {
    const tLower = text.toLowerCase();
    if (tLower.includes('my name is')) {
      if (!extractedPhrases.some((p) => p.english === 'My name is ...')) {
        extractedPhrases.push({
          english: text,
          japanese: '私の名前は〜です',
          culturalNote: '自分の名前を堂々と自己紹介できた素敵なフレーズ！',
        });
      }
    } else if (tLower.startsWith('what animal') || tLower.includes('what animal')) {
      if (!extractedPhrases.some((p) => p.english.toLowerCase().includes('what animal'))) {
        extractedPhrases.push({
          english: text,
          japanese: 'どんな動物が好きですか？',
          culturalNote: '相手の好きな動物を尋ねる上手な質問表現！',
        });
      }
    } else if (tLower.startsWith('what food') || tLower.includes('what food')) {
      if (!extractedPhrases.some((p) => p.english.toLowerCase().includes('what food'))) {
        extractedPhrases.push({
          english: text,
          japanese: 'どんな食べ物が好きですか？',
          culturalNote: '相手の好きな食べ物を尋ねる上手な質問表現！',
        });
      }
    } else if (tLower.startsWith('what sport') || tLower.includes('what sport')) {
      if (!extractedPhrases.some((p) => p.english.toLowerCase().includes('what sport'))) {
        extractedPhrases.push({
          english: text,
          japanese: 'どんなスポーツが好きですか？',
          culturalNote: 'どんなスポーツが好きですか？と尋ねる上手な質問表現！',
        });
      }
    } else if (tLower.startsWith('i like') || tLower.includes('i like')) {
      if (!extractedPhrases.some((p) => p.english.toLowerCase().includes('i like'))) {
        extractedPhrases.push({
          english: text,
          japanese: '私は〜が好きです',
          culturalNote: '自分の好きなものをしっかりと伝えられた表現！',
        });
      }
    } else if (tLower.startsWith('i can') || tLower.includes('i can')) {
      if (!extractedPhrases.some((p) => p.english.toLowerCase().includes('i can'))) {
        extractedPhrases.push({
          english: text,
          japanese: '私は〜ができます',
          culturalNote: '自分の特技やできることを伝えられた表現！',
        });
      }
    } else if (tLower.includes('how about you') || tLower.includes('and you')) {
      if (!extractedPhrases.some((p) => p.english.toLowerCase().includes('how about you'))) {
        extractedPhrases.push({
          english: text,
          japanese: 'あなたはどうですか？',
          culturalNote: '相手に質問を聞き返して会話を広げられた表現！',
        });
      }
    } else if (tLower === 'pardon' || tLower.includes('pardon')) {
      if (!extractedPhrases.some((p) => p.english.toLowerCase().includes('pardon'))) {
        extractedPhrases.push({
          english: 'Pardon?',
          japanese: 'もう一度言ってくれますか？',
          culturalNote: '聞き取れなかった時に自然に聞き返すスマートな表現！',
        });
      }
    } else if (extractedPhrases.length < 3 && text.length > 2) {
      extractedPhrases.push({
        english: text,
        japanese: '対話で使った表現',
        culturalNote: '実際の会話の中で自信を持って使えた英語です！',
      });
    }
  }

  // If child didn't speak much, extract authentic expressions from AI messages that were shared
  if (extractedPhrases.length === 0) {
    const aiMsgs = history.filter((m) => m.sender === 'ai' && m.englishText);
    for (const aiM of aiMsgs.slice(0, 3)) {
      extractedPhrases.push({
        english: aiM.englishText.slice(0, 40),
        japanese: aiM.japaneseText?.slice(0, 30) || '留学生の英語表現',
        culturalNote: `${persona.countryJapanese}留学生 ${shortName} が対話で使った表現です`,
      });
    }
  }

  // Guaranteed fallback phrases if session was 0 turns
  if (extractedPhrases.length === 0) {
    extractedPhrases.push({
      english: `Hello! I'm ${shortName}.`,
      japanese: `こんにちは！${shortName}です。`,
      culturalNote: `${persona.countryJapanese}からの挨拶表現です。`,
    });
    extractedPhrases.push({
      english: 'Nice to meet you!',
      japanese: 'はじめまして！よろしくね！',
      culturalNote: '初めて会った時に笑顔で使える基本フレーズ！',
    });
  }

  // 2. Dynamic Next-Step Advice (Strictly tailored to what student did NOT do yet)
  const hasUsedHowAboutYou = allChildTextLower.includes('how about you') || allChildTextLower.includes('and you');
  const hasAskedQuestion = allChildTextLower.includes('what') || allChildTextLower.includes('where') || allChildTextLower.includes('can you') || allChildTextLower.includes('do you') || allChildTextLower.includes('?');
  const hasUsedILike = allChildTextLower.includes('i like');
  const hasUsedBecause = allChildTextLower.includes('because');
  const hasUsedICan = allChildTextLower.includes('i can');

  let adviceTitle = '';
  let adviceDetail = '';
  let adviceExample = '';

  if (hasUsedHowAboutYou && hasUsedILike && !hasUsedBecause) {
    adviceTitle = '理由を一言付け足してみよう！ (because it is ～)';
    adviceDetail = `好きなものを答えたあとに「because it is delicious (美味しいから)」や「because it is fun (楽しいから)」と理由を伝えると、もっと気持ちが伝わりますよ！`;
    adviceExample = `I like sushi because it is delicious.`;
  } else if (!hasAskedQuestion && !hasUsedHowAboutYou) {
    adviceTitle = '留学生に質問を聞き返してみよう！';
    adviceDetail = `自分のことを答えたあとに「What food do you like?」や「How about you?」と ${shortName} に聞き返してみると、会話のキャッチボールがさらに弾みますよ！`;
    adviceExample = `What animal do you like, ${shortName}?`;
  } else if (hasAskedQuestion && !hasUsedICan) {
    adviceTitle = 'できること・特技を伝えてみよう！ (I can ～)';
    adviceDetail = `「I can play soccer (サッカーができます)」や「I can swim (泳げます)」のように、自分の得意なことを ${shortName} に伝えてみましょう！`;
    adviceExample = `I can play soccer. Can you play soccer, ${shortName}?`;
  } else {
    adviceTitle = '相槌や感想を一言プラスしてみよう！';
    adviceDetail = `相手の答えを聞いたあとに「Nice! (いいね！)」や「Sounds good! (いいね！)」とリアクションすると、もっと自然な英会話になりますよ！`;
    adviceExample = `Sounds good! I like it too!`;
  }

  // 3. Dynamic Good Points based on actual utterances
  const firstChildText = childTexts[0] || '';
  const secondChildText = childTexts[1] || '';

  const goodPoint1 = firstChildText
    ? `「${firstChildText}」のように、自分の思いや答えを堂々と英語で伝えようとする姿勢がとても素晴らしかったです！`
    : `${safeStudentName}さんの思いを、前向きに英語で伝えようとする姿勢がとても素敵でした！`;

  const goodPoint2 = secondChildText
    ? `${persona.name} (${persona.countryJapanese}留学生) の言葉をよく聞き、「${secondChildText}」とスムーズに会話のキャッチボールを続けられました！`
    : `${persona.name} (${persona.countryJapanese}留学生) からの質問にしっかりと耳を傾け、英語でのやり取りに挑戦できました！`;

  const goodPoint3 = totalWords > 0
    ? `合計 ${totalWords} 語の英語を発話し、最後まで集中して対話練習をやり遂げることができました！`
    : `最後まで諦めずに留学生との英会話に挑戦できました！大きな自信にしてくださいね。`;

  // 4. Dynamic Overall Comment reflecting persona culture and conversation
  let topicSummary = 'お互いのこと';
  if (allChildTextLower.includes('sushi') || allChildTextLower.includes('food') || allChildTextLower.includes('ramen')) {
    topicSummary = '美味しい食べ物のこと';
  } else if (allChildTextLower.includes('soccer') || allChildTextLower.includes('sport') || allChildTextLower.includes('baseball')) {
    topicSummary = '楽しいスポーツのこと';
  } else if (allChildTextLower.includes('dog') || allChildTextLower.includes('animal') || allChildTextLower.includes('cat')) {
    topicSummary = '可愛い動物のこと';
  } else if (allChildTextLower.includes('fuji') || allChildTextLower.includes('shizuoka')) {
    topicSummary = '素敵な静岡のこと';
  }

  const overallComment = `${safeStudentName}さん、${persona.countryJapanese}の留学生 ${persona.name} と${topicSummary}について楽しく対話練習ができましたね！本番の静岡大学留学生交流会でも、笑顔でたくさん話しかけてみてくださいね！`;
  const studentMessage = `${topicSummary}について一緒に話せて楽しかったよ！また英語でお話ししようね！`;


  const childLearningItems: FeedbackData['childLearningItems'] = childMsgs.slice(0, 1).map((message) => ({
    english: maskHighRiskPII(message.englishText.trim()).maskedText.slice(0, 100),
    japanese: message.japaneseText?.trim() || '自分が対話で実際に使った表現',
    reason: '今回の対話で自分から実際に使えた英語です。',
    evidenceText: maskHighRiskPII(message.englishText.trim()).maskedText.slice(0, 180),
    speaker: 'child',
    messageId: message.id,
  }));

  const aiLearningItems: FeedbackData['aiLearningItems'] = history
    .filter((message) => message.sender === 'ai' && message.englishText?.trim())
    .slice(0, 2)
    .map((message) => ({
      english: message.englishText.trim().slice(0, 100),
      japanese: message.japaneseText?.trim() || 'AI留学生が対話で実際に使った表現',
      reason: 'AI留学生が今回の対話で実際に使った、次の会話でも参考になる英語です。',
      evidenceText: message.englishText.trim().slice(0, 180),
      speaker: 'ai',
      messageId: message.id,
    }));

  const fallbackKeyPhrases: FeedbackData['keyPhrases'] = extractedPhrases
    .map((phrase) => {
      const phraseLower = phrase.english.trim().toLowerCase();
      const source = history.find((message) => message.englishText?.toLowerCase().includes(phraseLower));
      if (!source) return null;
      return {
        english: phrase.english,
        japanese: phrase.japanese,
        reason: phrase.culturalNote || '別の英会話でも使いやすい表現です。',
        evidenceText: source.sender === 'child'
          ? maskHighRiskPII(source.englishText.trim()).maskedText.slice(0, 180)
          : source.englishText.trim().slice(0, 180),
        speaker: source.sender as 'child' | 'ai',
        messageId: source.id,
        culturalNote: phrase.culturalNote,
      };
    })
    .filter((item) => item !== null)
    .slice(0, 3) as FeedbackData['keyPhrases'];

  return {
    goodPoints: [goodPoint1, goodPoint2, goodPoint3],
    improvementAdvice: {
      title: adviceTitle,
      detail: adviceDetail,
      examplePhrase: adviceExample,
    },
    overallComment,
    studentMessage,
    childLearningItems,
    aiLearningItems,
    keyPhrases: fallbackKeyPhrases,
    encounteredVocab: encounteredVocab || [],
    aiStudent: persona,
    stats: {
      totalTurns,
      totalChildWords: totalWords,
      durationSeconds,
      targetDurationMinutes,
    },
  };
}
