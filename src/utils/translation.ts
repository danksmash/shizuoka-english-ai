/**
 * Japanese translation utilities for Elementary School English Dialogue
 * Provides warm, age-appropriate Japanese translations for both AI and Child utterances
 */

import { ChatMessage, DialogueTopic } from '../types';

// Topic-based and Persona-based starter prompt translations
export const STARTER_PROMPTS_JAPANESE: Record<string, Record<DialogueTopic, string>> = {
  oliver_uk: {
    intro: 'こんにちは！イギリスから来たオリバーです。お互いの自己紹介をしよう！あなたのお名前は何ですか？',
    favorites: '最高だね！好きなことについて話そう！僕はサッカーとアフタヌーンティーが大好きだよ。君はどんなスポーツや食べ物が好き？',
    shizuoka_culture: '素晴らしいね！素敵な静岡について話そう！静岡には美味しい緑茶や富士山があるね。君の一番好きな場所はどこ？',
    talents: 'よし、できること（特技）について話そう！僕はギターが弾けるよ。君はどんなことができる？',
    free: 'こんにちは！好きなこと何でも自由にお話ししよう！今日は何についてお話しする？',
  },
  emma_usa: {
    intro: 'やあ！カリフォルニアから来たエマだよ！自己紹介し合おう！お名前を教えてね！',
    favorites: '最高！好きなものについて話そう！私はマリブでのサーフィンとゲームが大好き！君はどんなゲームやスポーツが好き？',
    shizuoka_culture: 'めっちゃいいね！素敵な静岡について話そう！静岡の海やビーチはサーフィンにぴったり！君のお気に入りのスポットはどこ？',
    talents: 'もちろん！できることについて話そう！私は大きな波でサーフィンしたりゲームが得意だよ。君は何ができる？',
    free: 'やあ友だち！楽しい話題を一緒にお話ししよう！今日はどんなことでワクワクしてる？',
  },
  liam_australia: {
    intro: 'こんにちは、友だち！シドニーから来たリアムだよ！お互いの出身や自己紹介をしよう！お名前は何？',
    favorites: '大丈夫、気軽にいこう！大好きなことについて話そう！僕は水泳と可愛いコアラを見るのが大好き。君はどんな動物やスポーツが好き？',
    shizuoka_culture: 'さすがだね！素晴らしい静岡について話そう！駿河湾には美味しい魚がたくさんいるね。静岡のどんなところが好き？',
    talents: 'バッチリ！できることについて話そう！僕は海でとても速く泳げるよ。君は何ができる？',
    free: 'こんにちは！楽しい冒険について話そう！今日はどんなことをおしゃべりしようか？',
  },
  chloe_canada: {
    intro: 'こんにちは！カナダ・バンクーバーから来たクロエです。お互いのことをお話ししましょう！あなたのお名前は何ですか？',
    favorites: 'すごくいいね！好きなものについて話そう！私はスキーとメープルシロップのパンケーキが大好き。君はどんな食べ物が好きかな？',
    shizuoka_culture: 'すばらしい！素敵な静岡について話そう！富士山はカナダのロッキー山脈に似ているね。富士山を見たことはある？',
    talents: 'すてき！できることについて話そう！私はアイススケートとクッキー作りができるよ。君のとっておきの特技は何かな？',
    free: 'こんにちは！楽しい思い出について話そう！今日、私に教えてくれることは何かな？',
  },
  bence_hungary: {
    intro: 'スィア（こんにちは）！ハンガリー・ブダペストから来たベンツェです。お互いの名前を教え合おう！君の名前は何ですか？',
    favorites: 'ファンタスティック！好きなことについて話そう！僕はパズルを解くこととビデオゲームが大好き。君はどんなゲームや教科が好き？',
    shizuoka_culture: 'いいね！素晴らしい静岡について話そう！静岡には美味しいお茶や進んだテクノロジーがあるね。君の好きな場所はどこ？',
    talents: 'とてもいいね！できることについて話そう！僕はルービックキューブを30秒で揃えられるよ。君はどんなことができる？',
    free: 'スィア！ワクワクする話題について話そう！今日は何についてお話ししようか？',
  },
  zofia_poland: {
    intro: 'チェシチ（こんにちは）！ポーランド・ワルシャワから来たゾフィアです。自己紹介しましょう！お名前は何ですか？',
    favorites: 'すばらしいわ！好きなことについて話そう！私はショパンのピアノ音楽と絵を描くことが大好き。君はどんな音楽やアートが好き？',
    shizuoka_culture: 'とっても素敵！素晴らしい静岡について話そう！静岡にはきれいなお城や公園があるね。お城は好き？',
    talents: 'ブラボー！できることについて話そう！私はピアノでショパンの曲を演奏できるわ。君はどんなことができる？',
    free: 'チェシチ！クリエイティブで楽しいお話をしましょう！今日はどんなことを教えてくれる？',
  },
  rahul_bangladesh: {
    intro: 'やあ友だち！バングラデシュから来たラフルです。友だちになりましょう！お名前を教えてください！',
    favorites: '素晴らしい！大好きなことについて話そう！僕はクリケットをすることと淹れたてのお茶を飲むのが大好き。君はどんなスポーツや飲み物が好き？',
    shizuoka_culture: 'とてもいいね！素晴らしい静岡について話そう！バングラデシュも静岡もお茶の有名な名産地だね！緑茶は好きですか？',
    talents: '嬉しいな！できることについて話そう！僕はクリケットとスパイシーなカレーが作れるよ。君は何ができる？',
    free: 'ようこそ！興味深い話題について一緒にお話ししよう！今日はどんなことを探求してみる？',
  },
  linh_vietnam: {
    intro: 'シンチャオ（こんにちは）！ベトナム・ハノイから来たリンです。自己紹介しましょう！あなたのお名前は何ですか？',
    favorites: 'すごいね！大好きなことについて話そう！私は温かいフォー（麺料理）を食べることとバドミントンが大好き。君の一番好きな食べ物は何？',
    shizuoka_culture: 'とっても素敵！素晴らしい静岡について話そう！静岡のみかんはとっても甘くて美味しいね！君はどんなフルーツが好き？',
    talents: 'すばらしいわ！できることについて話そう！私はバドミントンができて2つの言語が話せるよ。君は何ができるかな？',
    free: 'シンチャオ！楽しい話題について一緒にお話ししましょう！今日はどんなことを考えてる？',
  },
  aung_myanmar: {
    intro: 'ミンガラバー（こんにちは）！ミャンマーから来たアウンです。自己紹介をしよう！お名前は何ですか？',
    favorites: '素晴らしいね！好きなことについて話そう！僕はサッカーとお寺巡り、美味しいパン作りが好きだよ。君は何が好き？',
    shizuoka_culture: '心温まるね！素晴らしい静岡について話そう！静岡のお茶や山々はとても穏やかで綺麗だね。静岡の好きなところはどこ？',
    talents: 'よくできたね！できることについて話そう！僕は美味しいパンを焼くことができるよ。君はどんなことができる？',
    free: 'ミンガラバー！穏やかで楽しいお話をしましょう！今日は何についてお話ししたい？',
  },
};

// Common vocabulary translation dictionary for elementary school 5th/6th grade
const VOCAB_MAP: Record<string, string> = {
  // Foods
  sushi: 'お寿司',
  ramen: 'ラーメン',
  curry: 'カレーライス',
  pizza: 'ピザ',
  hamburger: 'ハンバーガー',
  hamburgers: 'ハンバーガー',
  pasta: 'パスタ',
  noodle: '麺',
  noodles: '麺類',
  bread: 'パン',
  rice: 'ごはん',
  meat: 'お肉',
  fish: 'お魚',
  cake: 'ケーキ',
  icecream: 'アイスクリーム',
  chocolate: 'チョコレート',
  fruit: 'フルーツ・果物',
  fruits: 'フルーツ・果物',
  apple: 'りんご',
  apples: 'りんご',
  banana: 'バナナ',
  bananas: 'バナナ',
  orange: 'オレンジ・みかん',
  oranges: 'みかん',
  strawberry: 'いちご',
  strawberries: 'いちご',
  melon: 'メロン',
  tea: 'お茶',
  greentea: '緑茶・静岡茶',
  water: 'お水',
  milk: '牛乳',
  juice: 'ジュース',
  coffee: 'コーヒー',

  // Sports & Activities
  soccer: 'サッカー',
  football: 'サッカー',
  baseball: '野球',
  basketball: 'バスケットボール',
  tennis: 'テニス',
  badminton: 'バドミントン',
  swimming: '水泳・泳ぐこと',
  running: '走ること',
  skating: 'スケート',
  skiing: 'スキー',
  surfing: 'サーフィン',
  dance: 'ダンス',
  dancing: 'ダンス',
  singing: '歌うこと',
  drawing: '絵を描くこと',
  cooking: '料理をすること',
  reading: '読書・本を読むこと',
  gaming: 'ゲーム',
  games: 'ゲーム',
  music: '音楽',
  piano: 'ピアノ',
  guitar: 'ギター',

  // Animals
  dog: '犬',
  dogs: '犬',
  cat: '猫',
  cats: '猫',
  panda: 'パンダ',
  pandas: 'パンダ',
  koala: 'コアラ',
  koalas: 'コアラ',
  rabbit: 'うさぎ',
  rabbits: 'うさぎ',
  bird: '鳥',
  birds: '鳥',
  hamster: 'ハムスター',
  tiger: 'トラ',
  lion: 'ライオン',

  // Subjects & Places
  math: '算数・数学',
  science: '理科',
  english: '英語',
  japanese: '国語・日本語',
  history: '歴史',
  art: '図工・美術',
  pe: '体育',
  school: '学校',
  park: '公園',
  beach: '海・ビーチ',
  mountain: '山',
  castle: 'お城',
  shizuoka: '静岡',
  japan: '日本',
  fuji: '富士山',
};

/**
 * Intelligent pattern-based translator for elementary school child utterances
 */
export function translateChildUtterance(text: string): string {
  if (!text || typeof text !== 'string') return '';
  const clean = text.trim();
  const lower = clean.toLowerCase().replace(/[.!?,]/g, '').trim();

  // 1. Exact greetings & one-word answers
  if (lower === 'hello' || lower === 'hi' || lower === 'hey') {
    return 'こんにちは！';
  }
  if (lower === 'good morning') return 'おはようございます！';
  if (lower === 'good afternoon') return 'こんにちは！';
  if (lower === 'good evening') return 'こんばんは！';
  if (lower === 'goodbye' || lower === 'bye' || lower === 'bye bye' || lower === 'see you') {
    return 'さようなら！またね！';
  }
  if (lower === 'thank you' || lower === 'thanks' || lower === 'thank you very much') {
    return 'ありがとう！';
  }
  if (lower === 'yes' || lower === 'yeah' || lower === 'yep' || lower === 'sure') {
    return 'はい、そうです！';
  }
  if (lower === 'no' || lower === 'nope') {
    return 'いいえ、ちがいます。';
  }
  if (lower === 'yes i do' || lower === 'yes i can' || lower === 'yes i am') {
    return 'はい、そうです！ / はい、できます！';
  }
  if (lower === 'no i dont' || lower === "no i don't" || lower === 'no i cant' || lower === "no i can't") {
    return 'いいえ、ちがいます / できません。';
  }
  if (lower === 'nice to meet you' || lower === 'nice to meet you too') {
    return 'はじめまして！よろしくね！';
  }
  if (lower === 'me too') {
    return '私もです！';
  }
  if (lower === 'how about you' || lower === 'and you') {
    return 'あなたはどうですか？';
  }
  if (lower === 'i see' || lower === 'okay' || lower === 'ok' || lower === 'great' || lower === 'cool') {
    return 'なるほど！ / いいね！';
  }

  // 2. Name & Self Introduction patterns
  const myNameMatch = clean.match(/^(?:my name is|i am|i'm)\s+([A-Za-z0-9\sぁ-んァ-ヶー一-龠]+)$/i);
  if (myNameMatch) {
    const rawName = myNameMatch[1].trim();
    return `私の名前は ${rawName} です。よろしくね！`;
  }

  // 3. "I like ~" / "I love ~"
  const likeMatch = clean.match(/^(?:i like|i love|i really like)\s+(.+)$/i);
  if (likeMatch) {
    const target = likeMatch[1].trim();
    const translatedTarget = translatePhraseObjects(target);
    return `私は ${translatedTarget} が好き（大好き）です。`;
  }

  // 4. "My favorite ... is ~"
  const favMatch = clean.match(/^my favorite\s+(?:food|sport|subject|color|animal|thing)?\s*(?:is)?\s+(.+)$/i);
  if (favMatch) {
    const target = favMatch[1].trim();
    const translatedTarget = translatePhraseObjects(target);
    return `私のお気に入りは ${translatedTarget} です。`;
  }

  // 5. "I can ~" (Talents/Abilities)
  const canMatch = clean.match(/^(?:i can|i can play|i can do)\s+(.+)$/i);
  if (canMatch) {
    const target = canMatch[1].trim();
    const translatedTarget = translatePhraseObjects(target);
    return `私は ${translatedTarget} ができます。`;
  }

  // 6. "I play ~" (Sports/Games)
  const playMatch = clean.match(/^(?:i play)\s+(.+)$/i);
  if (playMatch) {
    const target = playMatch[1].trim();
    const translatedTarget = translatePhraseObjects(target);
    return `私は ${translatedTarget} をします / プレイします。`;
  }

  // 7. "I want to ~" / "I want ~"
  const wantMatch = clean.match(/^(?:i want to|i want)\s+(.+)$/i);
  if (wantMatch) {
    const target = wantMatch[1].trim();
    const translatedTarget = translatePhraseObjects(target);
    return `私は ${translatedTarget} したい（がほしい）です。`;
  }

  // 8. "I live in ~" / "I go to ~"
  const liveMatch = clean.match(/^(?:i live in|i am from|i'm from)\s+(.+)$/i);
  if (liveMatch) {
    const target = liveMatch[1].trim();
    return `私は ${target} に住んでいます / 出身です。`;
  }

  // 9. Multi-word or connected utterance translation by vocabulary tokens
  const translatedWords = translatePhraseObjects(clean);
  if (translatedWords !== clean) {
    return `${translatedWords} （${clean}）`;
  }

  // Fallback: Return a friendly English acknowledgment
  return `「${clean}」`;
}

/**
 * Helper to replace known vocabulary words within an English phrase with Japanese
 */
function translatePhraseObjects(text: string): string {
  let result = text;

  // Replace common connectors
  result = result.replace(/\band\b/gi, 'と');
  result = result.replace(/\bvery much\b/gi, 'とても');
  result = result.replace(/\ba lot\b/gi, 'たくさん');
  result = result.replace(/\bthe\b/gi, '');
  result = result.replace(/\ba\b/gi, '');
  result = result.replace(/\ban\b/gi, '');
  result = result.replace(/\bvery\b/gi, 'とても');

  // Replace words from dictionary
  const words = result.split(/\s+/);
  const mapped = words.map((w) => {
    const cleanWord = w.toLowerCase().replace(/[^a-z]/g, '');
    if (VOCAB_MAP[cleanWord]) {
      return VOCAB_MAP[cleanWord];
    }
    return w;
  });

  return mapped.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Main translation getter for any ChatMessage in the transcript
 */
export function getJapaneseTranslationForMessage(
  msg: ChatMessage,
  currentAiStudentId?: string,
  selectedTopic?: DialogueTopic
): string {
  // If message already has an explicit Japanese translation attached, use it
  if (msg.japaneseText && msg.japaneseText.trim().length > 0) {
    return msg.japaneseText.trim();
  }

  // If this is the initial AI starter message
  if (msg.sender === 'ai' && currentAiStudentId && selectedTopic) {
    const studentPrompts = STARTER_PROMPTS_JAPANESE[currentAiStudentId];
    if (studentPrompts && studentPrompts[selectedTopic]) {
      return studentPrompts[selectedTopic];
    }
  }

  // If child message, use our elementary translator
  if (msg.sender === 'child') {
    const translated = translateChildUtterance(msg.englishText);
    return /[ぁ-んァ-ヶ一-龠]/.test(translated)
      ? translated
      : '日本語に訳せませんでした。';
  }

  // If AI message without translation, attempt to clean up or provide guidance
  return msg.englishText;
}
