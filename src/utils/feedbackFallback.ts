import { AIStudentProfile, FeedbackData, VisualVocabularyItem, ChatMessage, DialogueTopic } from '../types';

export interface LocalDialogueResponse {
  reply: string;
  japaneseTranslation: string;
  mood: 'greeting' | 'speaking' | 'listening' | 'thinking' | 'happy' | 'encouraging';
  culturalNote?: string;
}

// Country & Persona specific food / culture details
const PERSONA_CULTURE_MAP: Record<string, {
  foodEnglish: string;
  foodJapanese: string;
  sportEnglish: string;
  animalEnglish: string;
  cultureFact: string;
}> = {
  oliver_uk: {
    foodEnglish: 'fish and chips and afternoon tea',
    foodJapanese: 'フィッシュアンドチップスと紅茶',
    sportEnglish: 'football (soccer)',
    animalEnglish: 'dogs and horses',
    cultureFact: 'イギリスではアフタヌーンティーやフットボール（サッカー）が大人気だよ！',
  },
  emma_usa: {
    foodEnglish: 'burgers and pizza',
    foodJapanese: 'ハンバーガーとピザ',
    sportEnglish: 'baseball and basketball',
    animalEnglish: 'dogs and dolphins',
    cultureFact: 'アメリカではハンバーガーや野球、バスケットボールが親しまれているよ！',
  },
  liam_aus: {
    foodEnglish: 'meat pies and Aussie BBQ',
    foodJapanese: 'ミートパイとバーベキュー',
    sportEnglish: 'surfing and rugby',
    animalEnglish: 'koalas and kangaroos',
    cultureFact: 'オーストラリアにはコアラやカンガルーなどユニークな動物がいっぱい！',
  },
  liam_australia: {
    foodEnglish: 'meat pies and Aussie BBQ',
    foodJapanese: 'ミートパイとバーベキュー',
    sportEnglish: 'surfing and rugby',
    animalEnglish: 'koalas and kangaroos',
    cultureFact: 'オーストラリアにはコアラやカンガルーなどユニークな動物がいっぱい！',
  },
  chloe_can: {
    foodEnglish: 'pancakes with maple syrup and poutine',
    foodJapanese: 'メープルシロップのパンケーキとプーティン',
    sportEnglish: 'ice hockey',
    animalEnglish: 'bears and dogs',
    cultureFact: 'カナダはメープルシロップとアイスホッケーがとても有名だよ！',
  },
  chloe_canada: {
    foodEnglish: 'pancakes with maple syrup and poutine',
    foodJapanese: 'メープルシロップのパンケーキとプーティン',
    sportEnglish: 'ice hockey',
    animalEnglish: 'bears and dogs',
    cultureFact: 'カナダはメープルシロップとアイスホッケーがとても有名だよ！',
  },
  bence_hun: {
    foodEnglish: 'goulash soup (traditional beef soup)',
    foodJapanese: 'グヤーシュ（伝統的な牛肉とお野菜のスープ）',
    sportEnglish: 'football and swimming',
    animalEnglish: 'dogs and horses',
    cultureFact: 'ハンガリーのグヤーシュは温かいパプリカ風味の美味しいスープだよ！',
  },
  bence_hungary: {
    foodEnglish: 'goulash soup (traditional beef soup)',
    foodJapanese: 'グヤーシュ（伝統的な牛肉とお野菜のスープ）',
    sportEnglish: 'football and swimming',
    animalEnglish: 'dogs and horses',
    cultureFact: 'ハンガリーのグヤーシュは温かいパプリカ風味の美味しいスープだよ！',
  },
  zofia_pol: {
    foodEnglish: 'pierogi dumplings',
    foodJapanese: 'ピエロギ（ポーランド風の水餃子）',
    sportEnglish: 'volleyball and dancing',
    animalEnglish: 'cats and birds',
    cultureFact: 'ポーランドのピエロギはもちもちの生地で包んだ伝統料理だよ！',
  },
  zofia_poland: {
    foodEnglish: 'pierogi dumplings',
    foodJapanese: 'ピエロギ（ポーランド風の水餃子）',
    sportEnglish: 'volleyball and dancing',
    animalEnglish: 'cats and birds',
    cultureFact: 'ポーランドのピエロギはもちもちの生地で包んだ伝統料理だよ！',
  },
  rahul_ban: {
    foodEnglish: 'chicken biryani and curry',
    foodJapanese: 'ビリヤニ（スパイス香る炊き込みご飯）とカレー',
    sportEnglish: 'cricket',
    animalEnglish: 'Bengal tigers and birds',
    cultureFact: 'バングラデシュでは美味しいビリヤニやクリケットが大人気だよ！',
  },
  rahul_bangladesh: {
    foodEnglish: 'chicken biryani and curry',
    foodJapanese: 'ビリヤニ（スパイス香る炊き込みご飯）とカレー',
    sportEnglish: 'cricket',
    animalEnglish: 'Bengal tigers and birds',
    cultureFact: 'バングラデシュでは美味しいビリヤニやクリケットが大人気だよ！',
  },
  linh_vie: {
    foodEnglish: 'pho noodle soup and spring rolls',
    foodJapanese: 'フォー（お米の麺のスープ）と生春巻き',
    sportEnglish: 'badminton and football',
    animalEnglish: 'cats and dogs',
    cultureFact: 'ベトナムのフォーはお米からできた優しい味のヌードルスープだよ！',
  },
  linh_vietnam: {
    foodEnglish: 'pho noodle soup and spring rolls',
    foodJapanese: 'フォー（お米の麺のスープ）と生春巻き',
    sportEnglish: 'badminton and football',
    animalEnglish: 'cats and dogs',
    cultureFact: 'ベトナムのフォーはお米からできた優しい味のヌードルスープだよ！',
  },
  aung_mya: {
    foodEnglish: 'mohinga noodles',
    foodJapanese: 'モヒンガー（魚だしの伝統的な米粉麺）',
    sportEnglish: 'football and chinlone',
    animalEnglish: 'elephants and dogs',
    cultureFact: 'ミャンマーのモヒンガーは朝ごはんにも大人気の伝統的な麺料理だよ！',
  },
  aung_myanmar: {
    foodEnglish: 'mohinga noodles',
    foodJapanese: 'モヒンガー（魚だしの伝統的な米粉麺）',
    sportEnglish: 'football and chinlone',
    animalEnglish: 'elephants and dogs',
    cultureFact: 'ミャンマーのモヒンガーは朝ごはんにも大人気の伝統的な麺料理だよ！',
  },
};

function getCultureForPersona(persona: AIStudentProfile) {
  if (PERSONA_CULTURE_MAP[persona.id]) return PERSONA_CULTURE_MAP[persona.id];
  const countryKey = Object.keys(PERSONA_CULTURE_MAP).find(
    (k) => persona.country.toLowerCase().includes(k.split('_')[1] || '') || persona.id.startsWith(k.split('_')[0])
  );
  if (countryKey && PERSONA_CULTURE_MAP[countryKey]) return PERSONA_CULTURE_MAP[countryKey];
  return {
    foodEnglish: 'delicious local cuisine',
    foodJapanese: '美味しい郷土料理',
    sportEnglish: 'soccer',
    animalEnglish: 'dogs and cats',
    cultureFact: `${persona.countryJapanese}の素敵な文化を一緒に楽しもう！`,
  };
}

/**
 * Intelligent context-aware local fallback reply generator
 */
export function generateLocalStudentDialogueReply(
  persona: AIStudentProfile,
  topic: DialogueTopic,
  studentText: string,
  turnNumber: number,
  studentName: string,
  history?: ChatMessage[]
): LocalDialogueResponse {
  const shortName = persona.name.split(' ')[0] || persona.name;
  const culture = getCultureForPersona(persona);

  const rawLower = studentText.toLowerCase().trim();
  const lower = rawLower.replace(/[.,?!]/g, ' ').trim();

  // 1. Check for Goodbye / Farewell / Thank you (No forced question on farewell)
  if (lower === 'goodbye' || lower === 'bye' || lower === 'bye bye' || lower === 'see you' || lower.includes('see you later') || lower.includes('have a nice day')) {
    return {
      reply: `Goodbye, ${studentName || 'friend'}! I had so much fun talking with you today! See you next time!`,
      japaneseTranslation: `さようなら、${studentName ? studentName + 'さん' : 'お友達'}！今日はいっぱいお話しできて楽しかったよ！またね！`,
      mood: 'happy',
      culturalNote: `笑顔でバイバイの挨拶ができたね！`,
    };
  }

  // 2. Check for Pardon / Clarification request
  const isPardon =
    lower === 'pardon' ||
    lower === 'pardon me' ||
    lower === 'sorry' ||
    lower === 'what' ||
    lower === 'what did you say' ||
    lower === 'what did you mean' ||
    lower.includes('say that again') ||
    lower.includes("don't understand") ||
    lower.includes('dont understand') ||
    lower.includes('repeat') ||
    lower.includes('once more') ||
    lower.includes('one more time');

  if (isPardon) {
    const lastAiMsg = (history || [])
      .slice()
      .reverse()
      .find((m) => m.sender === 'ai' && !m.englishText.toLowerCase().includes('pardon'));

    if (lastAiMsg) {
      const prev = lastAiMsg.englishText.toLowerCase();
      if (prev.includes('tea') || prev.includes('drink')) {
        return {
          reply: `I said, I love British black tea! What do you like to drink?`,
          japaneseTranslation: `イギリスの紅茶が大好きだと言ったよ！何を飲むのが好き？`,
          mood: 'encouraging',
          culturalNote: `ゆっくり話すから安心してね！`,
        };
      }
      if (prev.includes('goulash') || prev.includes('food') || prev.includes('eat') || prev.includes('pie') || prev.includes('pho') || prev.includes('biryani') || prev.includes('burger')) {
        return {
          reply: `I said, I like ${culture.foodEnglish}. What food do you like?`,
          japaneseTranslation: `私は${culture.foodJapanese}が好きだと言ったよ。何が好き？`,
          mood: 'encouraging',
          culturalNote: `もう一度わかりやすく伝えたよ！`,
        };
      }
      if (prev.includes('sport') || prev.includes('football') || prev.includes('soccer') || prev.includes('surf') || prev.includes('hockey')) {
        return {
          reply: `I said, I like ${culture.sportEnglish}. Do you like sports?`,
          japaneseTranslation: `私は${culture.sportEnglish}が好きだと言ったよ。スポーツは好き？`,
          mood: 'encouraging',
          culturalNote: `ゆっくり話すから大丈夫だよ！`,
        };
      }
      if (prev.includes('animal') || prev.includes('dog') || prev.includes('cat') || prev.includes('koala')) {
        return {
          reply: `I said, I like ${culture.animalEnglish}. What animal do you like?`,
          japaneseTranslation: `私は${culture.animalEnglish}が好きだと言ったよ。どんな動物が好き？`,
          mood: 'encouraging',
          culturalNote: `好きな動物を教えてね！`,
        };
      }
      if (prev.includes('shizuoka') || prev.includes('fuji') || prev.includes('beach')) {
        return {
          reply: `I said, Shizuoka is very beautiful! Do you like Mt. Fuji?`,
          japaneseTranslation: `静岡はとても綺麗だと言ったよ！富士山は好き？`,
          mood: 'encouraging',
        };
      }
    }

    return {
      reply: `I said, I love chatting with you! What is your favorite thing?`,
      japaneseTranslation: `あなたとお話しできて嬉しいと言ったよ！何が好きですか？`,
      mood: 'encouraging',
      culturalNote: `わからない時は「Pardon?」と聞き返すのはとても良いことだよ！`,
    };
  }

  // 3. "How are you?" / "How are you doing?" Direct Answer First
  if (lower.includes('how are you') || lower.includes('how are you doing') || lower.includes('how do you do')) {
    return {
      reply: `I am doing great today, thanks! How are you?`,
      japaneseTranslation: `今日はとても元気だよ、ありがとう！調子はどうですか？`,
      mood: 'happy',
      culturalNote: `「How are you?」と聞かれたら元気に気分を伝えてみよう！`,
    };
  }

  // 4. Direct Student Questions (Highest Priority)
  // 4-a. Animal question
  if (lower.includes('what animal') || lower.includes('favorite animal') || lower.includes('favourite animal')) {
    return {
      reply: `I like ${culture.animalEnglish}. They are so cute! What animal do you like?`,
      japaneseTranslation: `私は${culture.animalEnglish}が好きです。とても可愛いよ！どんな動物が好き？`,
      mood: 'happy',
      culturalNote: `${persona.countryJapanese}でも動物は大人気だよ！`,
    };
  }

  // 4-b. Food question
  if (
    lower.includes('what food') ||
    lower.includes('favorite food') ||
    lower.includes('favourite food') ||
    lower.includes('what do you eat') ||
    lower.includes('what do you like to eat')
  ) {
    return {
      reply: `I like ${culture.foodEnglish}. It is delicious! What food do you like?`,
      japaneseTranslation: `私は${culture.foodJapanese}が好きです。とても美味しいよ！好きな食べ物は何ですか？`,
      mood: 'happy',
      culturalNote: culture.cultureFact,
    };
  }

  // 4-c. Sport question: "What sport do you like?", "What's your favorite sport?"
  if (lower.includes('what sport') || lower.includes('favorite sport') || lower.includes('favourite sport')) {
    return {
      reply: `I like ${culture.sportEnglish}. It is very exciting! Do you play sports?`,
      japaneseTranslation: `私は${culture.sportEnglish}が好きです。すごくワクワクするよ！スポーツはする？`,
      mood: 'happy',
      culturalNote: `スポーツの話題は留学生と仲良くなる最高の方法だよ！`,
    };
  }

  // 4-d. Color question: "What color do you like?"
  if (lower.includes('what color') || lower.includes('what colour') || lower.includes('favorite color')) {
    return {
      reply: `I like blue and green! They look like nature. What color do you like?`,
      japaneseTranslation: `私は青と緑が好きです！自然の色みたいだからね。何色が好き？`,
      mood: 'happy',
    };
  }

  // 4-e. Origin question: "Where are you from?"
  if (lower.includes('where are you from') || lower.includes('where do you come from') || lower.includes('what country')) {
    return {
      reply: `I am from ${persona.country} (${persona.city}). Have you ever been there?`,
      japaneseTranslation: `私は${persona.countryJapanese}の${persona.city}出身です。行ったことはある？`,
      mood: 'happy',
      culturalNote: `${persona.name} は${persona.countryJapanese}から静岡大学に留学しているよ！`,
    };
  }

  // 4-f. Age question: "How old are you?"
  if (lower.includes('how old')) {
    return {
      reply: `I am ${persona.age} years old. I am a university student! How old are you?`,
      japaneseTranslation: `私は${persona.age}歳です。大学生だよ！あなたは何歳ですか？`,
      mood: 'happy',
    };
  }

  // 4-g. Ability question: "What can you do?", "Can you ...?"
  if (lower.startsWith('can you') || lower.includes('can you play') || lower.includes('can you swim') || lower.includes('can you speak')) {
    if (lower.includes('swim')) {
      return {
        reply: `Yes, I can swim! How about you?`,
        japaneseTranslation: `はい、泳げるよ！あなたはどう？`,
        mood: 'happy',
      };
    }
    if (lower.includes('soccer') || lower.includes('football')) {
      return {
        reply: `Yes, I can play soccer! It is so fun. Can you play soccer?`,
        japaneseTranslation: `はい、サッカーができるよ！とても楽しいよね。サッカーはできる？`,
        mood: 'happy',
      };
    }
    return {
      reply: `Yes, I can! I can also speak English and study Japanese. What can you do?`,
      japaneseTranslation: `うん、できるよ！英語を話して日本語も勉強しているよ。あなたは何ができる？`,
      mood: 'happy',
    };
  }

  if (lower.includes('what can you do')) {
    return {
      reply: `I can play the guitar and speak English. What can you do?`,
      japaneseTranslation: `ギターを弾いたり英語を話したりできるよ。あなたは何ができる？`,
      mood: 'encouraging',
    };
  }

  // 4-h. General "Do you like ...?" questions
  if (lower.startsWith('do you like')) {
    if (lower.includes('sushi') || lower.includes('japanese food') || lower.includes('ramen')) {
      return {
        reply: `Yes, I love Japanese food! Sushi and green tea are wonderful. What Japanese food do you like?`,
        japaneseTranslation: `はい、日本食が大好きです！お寿司と緑茶は素晴らしいね。どんな日本食が好き？`,
        mood: 'happy',
        culturalNote: `日本の食文化は留学生に大人気です！`,
      };
    }
    if (lower.includes('soccer') || lower.includes('baseball') || lower.includes('tennis')) {
      return {
        reply: `Yes, I like it very much! It is great fun. Do you play often?`,
        japaneseTranslation: `はい、大好きだよ！とても楽しいよね。よくやるの？`,
        mood: 'happy',
      };
    }
    if (lower.includes('dog') || lower.includes('cat') || lower.includes('animal')) {
      return {
        reply: `Yes, I love animals! They are so friendly. What animal do you like?`,
        japaneseTranslation: `はい、動物が大好きです！とても人懐っこいよね。どんな動物が好き？`,
        mood: 'happy',
      };
    }
    return {
      reply: `Yes, I like it! Talking with you is so nice. What else do you like?`,
      japaneseTranslation: `うん、好きだよ！あなたとお話しできて嬉しいな。他には何が好き？`,
      mood: 'happy',
    };
  }

  // 4-i. "How about you?" / "And you?"
  if (lower.includes('how about you') || lower.includes('and you') || lower.includes('what about you')) {
    if (topic === 'favorites') {
      return {
        reply: `I like ${culture.foodEnglish} and ${culture.sportEnglish}! They make me happy. What do you like?`,
        japaneseTranslation: `私は${culture.foodJapanese}と${culture.sportEnglish}が好きだよ！元気が出るんだ。あなたは何が好き？`,
        mood: 'happy',
        culturalNote: `質問を聞き返してくれてありがとう！`,
      };
    }
    if (topic === 'talents') {
      return {
        reply: `I can play music and cook delicious food! What can you do?`,
        japaneseTranslation: `私は音楽を演奏したり美味しい料理を作ったりできるよ！あなたは何ができる？`,
        mood: 'happy',
      };
    }
    return {
      reply: `I love studying at Shizuoka University and meeting nice friends like you! What do you like to do?`,
      japaneseTranslation: `静岡大学で勉強して、あなたのような優しいお友達に出会えて嬉しいよ！何をするのが好き？`,
      mood: 'happy',
    };
  }

  // 5. Name introduction by child
  if (lower.includes('my name is') || lower.includes('i am ') || lower.includes("i'm ") || turnNumber <= 1) {
    let nameFromText = '';
    const match = lower.match(/(?:my name is|i am|i'm)\s+([a-zA-Z]+)/);
    if (match && match[1]) {
      nameFromText = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    }
    const finalName = nameFromText || studentName || 'friend';

    if (topic === 'favorites') {
      return {
        reply: `Nice to meet you, ${finalName}! What is your favorite food?`,
        japaneseTranslation: `はじめまして、${finalName}！好きな食べ物は何ですか？`,
        mood: 'happy',
      };
    }
    if (topic === 'shizuoka_culture') {
      return {
        reply: `Nice to meet you, ${finalName}! What is your favorite place in Shizuoka?`,
        japaneseTranslation: `はじめまして、${finalName}！静岡で好きな場所はどこですか？`,
        mood: 'happy',
      };
    }
    if (topic === 'talents') {
      return {
        reply: `Nice to meet you, ${finalName}! What can you do?`,
        japaneseTranslation: `はじめまして、${finalName}！あなたは何ができますか？`,
        mood: 'happy',
      };
    }
    return {
      reply: `Nice to meet you, ${finalName}! How are you today?`,
      japaneseTranslation: `はじめまして、${finalName}！今日の調子はどうですか？`,
      mood: 'happy',
    };
  }

  // 6. Context-based unasked question helper
  const aiHistoryText = (history || [])
    .filter((m) => m.sender === 'ai')
    .map((m) => m.englishText.toLowerCase())
    .join(' ');

  const getNextUnaskedQuestion = (): { english: string; japanese: string } => {
    if (!aiHistoryText.includes('food') && !aiHistoryText.includes('eat')) {
      return { english: 'What food do you like?', japanese: 'どんな食べ物が好きですか？' };
    }
    if (!aiHistoryText.includes('sport') && !aiHistoryText.includes('game') && !aiHistoryText.includes('play')) {
      return { english: 'What sport or game do you like?', japanese: 'どんなスポーツやゲームが好きですか？' };
    }
    if (!aiHistoryText.includes('animal') && !aiHistoryText.includes('dog') && !aiHistoryText.includes('cat')) {
      return { english: 'What animal do you like?', japanese: 'どんな動物が好きですか？' };
    }
    if (!aiHistoryText.includes('color') && !aiHistoryText.includes('colour')) {
      return { english: 'What color do you like?', japanese: '何色が好きですか？' };
    }
    if (!aiHistoryText.includes('can you') && !aiHistoryText.includes('what can you')) {
      return { english: 'What can you do well?', japanese: '何が得意ですか？' };
    }
    if (!aiHistoryText.includes('shizuoka') && !aiHistoryText.includes('place') && !aiHistoryText.includes('fuji')) {
      return { english: 'What is your favorite place in Shizuoka?', japanese: '静岡で好きな場所はどこですか？' };
    }
    if (!aiHistoryText.includes('season') && !aiHistoryText.includes('summer') && !aiHistoryText.includes('winter')) {
      return { english: 'What season do you like?', japanese: 'どの季節が好きですか？' };
    }
    return { english: 'What do you like to do in your free time?', japanese: '自由な時間には何をするのが好きですか？' };
  };

  const nextQ = getNextUnaskedQuestion();

  // 7. Reactions to Student's Statements with dynamic follow-ups
  if (lower.includes('sushi') || lower.includes('ramen') || lower.includes('curry') || lower.includes('pizza') || lower.includes('hamburger') || lower.includes('cake') || lower.includes('apple') || lower.includes('fruit')) {
    return {
      reply: `Yum! Delicious food makes everyone smile. ${nextQ.english}`,
      japaneseTranslation: `美味しそう！美味しい食べ物はみんなを笑顔にするね。${nextQ.japanese}`,
      mood: 'happy',
      culturalNote: culture.cultureFact,
    };
  }

  if (lower.includes('soccer') || lower.includes('football') || lower.includes('baseball') || lower.includes('basketball') || lower.includes('swimming') || lower.includes('tennis')) {
    return {
      reply: `That is awesome! Playing sports is so much fun. ${nextQ.english}`,
      japaneseTranslation: `素晴らしいね！体を動かすのはとても楽しいよね。${nextQ.japanese}`,
      mood: 'encouraging',
    };
  }

  if (lower.includes('dog') || lower.includes('cat') || lower.includes('rabbit') || lower.includes('hamster') || lower.includes('bird')) {
    return {
      reply: `Animals are so cute and friendly! ${nextQ.english}`,
      japaneseTranslation: `動物はとても可愛くて癒やされるね！${nextQ.japanese}`,
      mood: 'happy',
    };
  }

  if (lower.includes('fuji') || lower.includes('shizuoka') || lower.includes('green tea') || lower.includes('castle') || lower.includes('hamamatsu') || lower.includes('beach')) {
    return {
      reply: `Shizuoka is wonderful! Mt. Fuji and the ocean are beautiful. ${nextQ.english}`,
      japaneseTranslation: `静岡は素晴らしいところだね！富士山や海がとても綺麗です。${nextQ.japanese}`,
      mood: 'happy',
      culturalNote: `静岡の魅力をたくさん教えてくれてありがとう！`,
    };
  }

  if (lower.startsWith('i can') || lower.includes('i can play') || lower.includes('i can draw') || lower.includes('i can sing') || lower.includes('run fast')) {
    return {
      reply: `That is a wonderful talent! You are very cool. ${nextQ.english}`,
      japaneseTranslation: `素晴らしい特技だね！とてもかっこいいよ。${nextQ.japanese}`,
      mood: 'encouraging',
    };
  }

  if (lower.includes('thank you') || lower.includes('thanks')) {
    return {
      reply: `You are very welcome, ${studentName || 'friend'}! I loved talking with you!`,
      japaneseTranslation: `どういたしまして！${studentName ? studentName + 'さん' : 'あなた'}とお話しできてとても楽しかったよ！`,
      mood: 'happy',
      culturalNote: `最後までたくさん英語でお話しできたね！`,
    };
  }

  if (lower.includes('good') || lower.includes('fine') || lower.includes('happy') || lower.includes('great')) {
    return {
      reply: `I am glad to hear that! ${nextQ.english}`,
      japaneseTranslation: `それを聞けて嬉しいよ！${nextQ.japanese}`,
      mood: 'happy',
    };
  }

  // 8. General natural reply
  return {
    reply: `That sounds fun! ${nextQ.english}`,
    japaneseTranslation: `楽しそうだね！${nextQ.japanese}`,
    mood: 'happy',
  };
}


/**
 * Generates dynamic feedback strictly based on real conversation history
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
  const history = messages || [];

  const childMsgs = history.filter(
    (m) => m.sender !== 'ai' && m.englishText && m.englishText.trim().length > 0
  );

  const childTexts = childMsgs.map((m) => m.englishText.trim());
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
          culturalNote: '相手の好きなスポーツを尋ねる上手な質問表現！',
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
    // Child is already advanced enough to ask "How about you?". Advise adding reasons!
    adviceTitle = '理由を一言付け足してみよう！ (because it is ～)';
    adviceDetail = `好きなものを答えたあとに「because it is delicious (美味しいから)」や「because it is fun (楽しいから)」と理由を伝えると、もっと気持ちが伝わりますよ！`;
    adviceExample = `I like sushi because it is delicious.`;
  } else if (!hasAskedQuestion && !hasUsedHowAboutYou) {
    // Child hasn't asked questions yet. Advise asking!
    adviceTitle = '留学生に質問を聞き返してみよう！';
    adviceDetail = `自分のことを答えたあとに「What food do you like?」や「How about you?」と ${shortName} に聞き返してみると、会話のキャッチボールがさらに弾みますよ！`;
    adviceExample = `What animal do you like, ${shortName}?`;
  } else if (hasAskedQuestion && !hasUsedICan) {
    // Child asked questions! Next, try talking about abilities (I can)
    adviceTitle = 'できること・特技を伝えてみよう！ (I can ～)';
    adviceDetail = `「I can play soccer (サッカーができます)」や「I can swim (泳げます)」のように、自分の得意なことを ${shortName} に伝えてみましょう！`;
    adviceExample = `I can play soccer. Can you play soccer, ${shortName}?`;
  } else {
    // General high-level progression
    adviceTitle = '相槌や感想を一言プラスしてみよう！';
    adviceDetail = `相手の答えを聞いたあとに「Nice! (いいね！)」や「Sounds good! (いいね！)」とリアクションすると、もっと自然な英会話になりますよ！`;
    adviceExample = `Sounds good! I like it too!`;
  }

  // 3. Dynamic Good Points based on actual utterances
  const firstChildText = childTexts[0] || '';
  const secondChildText = childTexts[1] || '';

  const goodPoint1 = firstChildText
    ? `「${firstChildText}」のように、自分の思いや答えを堂々と英語で伝えようとする姿勢がとても素晴らしかったです！`
    : `${studentName || 'あなた'}の思いを、前向きに英語で伝えようとする姿勢がとても素敵でした！`;

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

  const overallComment = `${studentName || '児童'}さん、${persona.countryJapanese}の留学生 ${persona.name} と${topicSummary}について楽しく対話練習ができましたね！本番の静岡大学留学生交流会でも、笑顔でたくさん話しかけてみてくださいね！`;

  return {
    goodPoints: [goodPoint1, goodPoint2, goodPoint3],
    improvementAdvice: {
      title: adviceTitle,
      detail: adviceDetail,
      examplePhrase: adviceExample,
    },
    overallComment,
    keyPhrases: extractedPhrases,
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
