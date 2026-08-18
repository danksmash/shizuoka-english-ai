import { AIStudentProfile, FeedbackData, VisualVocabularyItem, ChatMessage, DialogueTopic } from '../types';

export interface LocalDialogueResponse {
  reply: string;
  japaneseTranslation: string;
  mood: 'greeting' | 'speaking' | 'listening' | 'thinking' | 'happy' | 'encouraging';
  culturalNote?: string;
}

export function generateLocalStudentDialogueReply(
  persona: AIStudentProfile,
  topic: DialogueTopic,
  studentText: string,
  turnNumber: number,
  studentName: string
): LocalDialogueResponse {
  const filler = persona.fillerWords[Math.floor(Math.random() * persona.fillerWords.length)] || 'Great!';
  const lower = studentText.toLowerCase();
  const shortName = persona.name.split(' ')[0] || persona.name;

  // Topic & Keyword-based intelligent interactive responses
  if (lower.includes('name') || lower.includes('i am') || lower.includes("i'm") || turnNumber <= 1) {
    return {
      reply: `${filler} Nice to meet you, ${studentName || 'friend'}! I love studying at Shizuoka University. What food or sport do you like?`,
      japaneseTranslation: `はじめまして、${studentName || 'お友達'}！静岡大学で勉強できて嬉しいよ。好きな食べ物やスポーツは何ですか？`,
      mood: 'happy',
      culturalNote: `${filler} は${persona.countryJapanese}で親しい友達にかける挨拶だよ！`,
    };
  }

  if (lower.includes('sushi') || lower.includes('tea') || lower.includes('green tea') || lower.includes('food') || lower.includes('ramen') || lower.includes('pizza') || lower.includes('curry')) {
    return {
      reply: `${filler} Yum! I love delicious food too. In ${persona.country}, we enjoy great meals. What is your favorite place in Shizuoka?`,
      japaneseTranslation: `美味しそう！私も美味しい食べ物が大好きです。${persona.countryJapanese}でも素敵な料理を食べるよ。静岡で一番好きな場所はどこ？`,
      mood: 'encouraging',
      culturalNote: `留学生 ${shortName} と一緒に食べ物の話を広げてみよう！`,
    };
  }

  if (lower.includes('soccer') || lower.includes('football') || lower.includes('baseball') || lower.includes('swimming') || lower.includes('sports') || lower.includes('run')) {
    return {
      reply: `${filler} That is so cool! Sports make us energetic and happy. What can you do after school?`,
      japaneseTranslation: `すごくいいね！スポーツをすると元気になれるよね。放課後はどんなことができる？`,
      mood: 'encouraging',
      culturalNote: `スポーツの話題は世界中の留学生と仲良くなれる最高の話題です！`,
    };
  }

  if (lower.includes('fuji') || lower.includes('shizuoka') || lower.includes('japan') || lower.includes('park') || lower.includes('sea') || lower.includes('beach')) {
    return {
      reply: `${filler} Mt. Fuji in Shizuoka is breathtaking! I took many photos. What other places do you recommend?`,
      japaneseTranslation: `静岡の富士山は息をのむほど綺麗だね！たくさん写真を撮ったよ。他にオススメの場所はある？`,
      mood: 'happy',
      culturalNote: `地元の魅力を英語で伝えると留学生はとても喜びます！`,
    };
  }

  if (lower.includes('can') || lower.includes('play') || lower.includes('draw') || lower.includes('sing') || lower.includes('guitar') || lower.includes('piano')) {
    return {
      reply: `${filler} Wow, you are so talented! I can speak my native language and English. What else can you do?`,
      japaneseTranslation: `わあ、素晴らしい特技だね！私は母国語と英語を話せるよ。他にどんなことができる？`,
      mood: 'encouraging',
      culturalNote: `できること（特技）を「I can 〜」で伝えてみよう！`,
    };
  }

  // Topic based fallback rotation
  const topicResponses: Record<DialogueTopic, LocalDialogueResponse> = {
    intro: {
      reply: `${filler} Thank you for telling me! I love meeting new friends in Japan. What is your favorite subject in school?`,
      japaneseTranslation: `教えてくれてありがとう！日本で新しい友達に出会えて嬉しいよ。学校で一番好きな教科は何？`,
      mood: 'encouraging',
      culturalNote: `「My favorite subject is 〜」と答えてみよう！`,
    },
    favorites: {
      reply: `${filler} That sounds wonderful! I like Japanese anime and delicious green tea. What do you like?`,
      japaneseTranslation: `素晴らしいね！私は日本のアニメと美味しいお茶が好きだよ。あなたは何が好き？`,
      mood: 'encouraging',
      culturalNote: `好きなものを理由と一緒に伝えてみよう！`,
    },
    shizuoka_culture: {
      reply: `${filler} Shizuoka is full of wonderful culture and kind people! What do you like most about Shizuoka?`,
      japaneseTranslation: `静岡は素晴らしい文化と優しい人々でいっぱいだね！静岡のどんなところが一番好き？`,
      mood: 'happy',
      culturalNote: `静岡のいいところをたくさん教えてあげよう！`,
    },
    talents: {
      reply: `${filler} That is fantastic! Practice makes progress. What do you want to try next?`,
      japaneseTranslation: `素晴らしいね！練習すればもっと上手になるよ。次はどんなことに挑戦してみたい？`,
      mood: 'encouraging',
      culturalNote: `前向きなチャレンジの気持ちを英語で伝えてみよう！`,
    },
    free: {
      reply: `${filler} That is really interesting! Talking with you is so much fun. Tell me more!`,
      japaneseTranslation: `とても興味深いね！あなたとおしゃべりできてすごく楽しいよ。もっと教えて！`,
      mood: 'happy',
      culturalNote: `自分の言葉で自由に英語の会話を楽しもう！`,
    },
  };

  return topicResponses[topic] || topicResponses.free;
}

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
  const childMsgs = (messages || []).filter(
    (m) => m.sender !== 'ai' && m.englishText && m.englishText.trim().length > 0
  );

  // Extract key words or phrases spoken by child
  const spokenHighlights = childMsgs.map((m) => m.englishText.trim());
  const samplePhrase = spokenHighlights[0] || '';

  const praisePoint1 = samplePhrase
    ? `「${samplePhrase}」のように、自分の好きなことや思いをしっかりと英語で伝えようとする積極的な姿勢がとても素晴らしかったです！`
    : `${studentName || 'あなた'}の思いを、堂々と英語で伝えようとする前向きな姿勢がとても素敵でした！`;

  const praisePoint2 =
    spokenHighlights.length > 1
      ? `${persona.name} (${persona.countryJapanese}留学生) からの質問をよく聞き、「${spokenHighlights[1]}」とスムーズに会話のキャッチボールを続けられました！`
      : `${persona.name} (${persona.countryJapanese}留学生) の質問に耳を傾け、しっかりと言葉を返せました！`;

  const praisePoint3 =
    totalWords > 0
      ? `合計 ${totalWords} 語の英語を使って、最後まで諦めずにやり遂げることができました！大きな自信にしてくださいね。`
      : '英語の対話を最後まで諦めずにやり遂げることができました！大きな自信にしてくださいね。';

  const adviceDetail = samplePhrase
    ? `「${samplePhrase}」と答えたあとに、「How about you? (あなたはどうですか？)」や「And you?」と ${shortName} に聞き返すと、さらに会話のキャッチボールが弾みますよ！`
    : `自分のことを答えたあとに「How about you? (あなたはどうですか？)」と ${shortName} に聞き返すと、さらに会話が弾みますよ！`;

  const examplePhrase = samplePhrase
    ? `${samplePhrase}. How about you, ${shortName}?`
    : `I like sushi. How about you, ${shortName}?`;

  return {
    goodPoints: [praisePoint1, praisePoint2, praisePoint3],
    improvementAdvice: {
      title: '質問を聞き返してみよう！ (How about you?)',
      detail: adviceDetail,
      examplePhrase: examplePhrase,
    },
    overallComment: `${studentName || '児童'}さん、${persona.countryJapanese}の留学生 ${persona.name} との対話練習お疲れ様でした！本番の静岡大学国際交流会でも、その素敵な笑顔でたくさん話しかけてみてくださいね！`,
    keyPhrases: [
      {
        english: persona.fillerWords[0] || 'Awesome!',
        japanese: '最高！ / 素晴らしい！',
        culturalNote: `${persona.countryJapanese}でよく使われる親しみやすい相槌です`,
      },
      {
        english: 'I like ~',
        japanese: '私は〜が好きです',
        culturalNote: '好きなものを相手に伝える基本のフレーズ',
      },
      {
        english: 'How about you?',
        japanese: 'あなたはどうですか？',
        culturalNote: '相手に質問を投げかける便利な表現',
      },
    ],
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

