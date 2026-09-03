/**
 * Japanese translation utilities for Elementary School English Dialogue
 * Provides warm, age-appropriate Japanese translations for both AI and Child utterances
 */

import { ChatMessage, DialogueTopic } from '../types';

// Topic-based and Persona-based starter prompt translations
const BASE_STARTER_PROMPTS_JAPANESE: Record<string, Record<Exclude<DialogueTopic, 'daily_routine'>, string>> = {
  oliver_uk: {
    intro: 'こんにちは！イギリスから来たオリバーです。あなたのお名前は何ですか？',
    favorites: '僕はサッカーと紅茶が好きです。あなたは何が好きですか？',
    shizuoka_culture: '僕は富士山が好きです。あなたは静岡の何が好きですか？',
    talents: '僕はギターを弾けます。あなたは何ができますか？',
    free: '何についてでも話せます。あなたは何が好きですか？',
  },
  emma_usa: {
    intro: 'やあ！カリフォルニアから来たエマです。あなたのお名前は何ですか？',
    favorites: '私はサーフィンとゲームが好きです。あなたは何が好きですか？',
    shizuoka_culture: '私は静岡が好きです。あなたは静岡のどんなところが好きですか？',
    talents: '私はサーフィンができます。あなたは何ができますか？',
    free: '何についてでも話せます。あなたは何が好きですか？',
  },
  liam_australia: {
    intro: 'こんにちは！シドニーから来たリアムです。あなたのお名前は何ですか？',
    favorites: '僕は水泳とコアラが好きです。あなたは何が好きですか？',
    shizuoka_culture: '僕は駿河湾が好きです。あなたは静岡の何が好きですか？',
    talents: '僕は速く泳げます。あなたは何ができますか？',
    free: '何についてでも話せます。あなたは何が好きですか？',
  },
  bence_hungary: {
    intro: 'こんにちは！ハンガリーから来たベンツェです。あなたのお名前は何ですか？',
    favorites: '僕はパズルとゲームが好きです。あなたは何が好きですか？',
    shizuoka_culture: '僕は緑茶が好きです。あなたは静岡の何が好きですか？',
    talents: '僕はルービックキューブをそろえられます。あなたは何ができますか？',
    free: '何についてでも話せます。あなたは何が好きですか？',
  },
  zofia_poland: {
    intro: 'こんにちは！ポーランドから来たゾフィアです。あなたのお名前は何ですか？',
    favorites: '私はピアノと絵を描くことが好きです。あなたは何が好きですか？',
    shizuoka_culture: '私は公園が好きです。あなたは静岡の何が好きですか？',
    talents: '私はピアノを弾けます。あなたは何ができますか？',
    free: '何についてでも話せます。あなたは何が好きですか？',
  },
  rahul_bangladesh: {
    intro: 'こんにちは！バングラデシュから来たラフルです。あなたのお名前は何ですか？',
    favorites: '僕はクリケットと紅茶が好きです。あなたは何が好きですか？',
    shizuoka_culture: '僕は緑茶が好きです。あなたは静岡の何が好きですか？',
    talents: '僕はクリケットができます。あなたは何ができますか？',
    free: '何についてでも話せます。あなたは何が好きですか？',
  },
  linh_vietnam: {
    intro: 'こんにちは！ベトナムから来たリンです。あなたのお名前は何ですか？',
    favorites: '私はフォーとバドミントンが好きです。あなたは何が好きですか？',
    shizuoka_culture: '私は静岡のみかんが好きです。あなたはどんな果物が好きですか？',
    talents: '私はバドミントンができます。あなたは何ができますか？',
    free: '何についてでも話せます。あなたは何が好きですか？',
  },
  minji_korea: {
    intro: 'こんにちは！韓国から来たミンジです。あなたのお名前は何ですか？',
    favorites: '私は写真とお菓子作りが好きです。あなたは何が好きですか？',
    shizuoka_culture: '私は静岡のいちごが好きです。あなたはどんな食べ物が好きですか？',
    talents: '私はクッキーを焼けます。あなたは何ができますか？',
    free: '何についてでも話せます。あなたは何が好きですか？',
  },
  pavel_belarus: {
    intro: 'こんにちは！ベラルーシから来たパーヴェルです。あなたのお名前は何ですか？',
    favorites: '僕はチェスと星が好きです。あなたは何が好きですか？',
    shizuoka_culture: '僕は富士山が好きです。あなたはどんな場所が好きですか？',
    talents: '僕はチェスができます。あなたは何ができますか？',
    free: '何についてでも話せます。あなたは何が好きですか？',
  },
  lukas_germany: {
    intro: 'こんにちは！ドイツから来たルーカスです。あなたのお名前は何ですか？',
    favorites: '僕はハンドボールと電車が好きです。あなたは何が好きですか？',
    shizuoka_culture: '僕は静岡の公園が好きです。あなたはどんな場所が好きですか？',
    talents: '僕はハンドボールができます。あなたは何ができますか？',
    free: '何についてでも話せます。あなたは何が好きですか？',
  },
  aina_malaysia: {
    intro: 'こんにちは！マレーシアから来たアイナです。あなたのお名前は何ですか？',
    favorites: '私はバドミントンと果物が好きです。あなたは何が好きですか？',
    shizuoka_culture: '私は静岡のみかんが好きです。あなたはどんな果物が好きですか？',
    talents: '私はバドミントンができます。あなたは何ができますか？',
    free: '何についてでも話せます。あなたは何が好きですか？',
  },
  dimas_indonesia: {
    intro: 'こんにちは！インドネシアから来たディマスです。あなたのお名前は何ですか？',
    favorites: '僕はフットサルと音楽が好きです。あなたは何が好きですか？',
    shizuoka_culture: '僕は静岡の食べ物が好きです。あなたはどんな食べ物が好きですか？',
    talents: '僕はフットサルができます。あなたは何ができますか？',
    free: '何についてでも話せます。あなたは何が好きですか？',
  },
  yuting_taiwan: {
    intro: 'こんにちは！台湾から来たユーティンです。あなたのお名前は何ですか？',
    favorites: '私は絵を描くこととサイクリングが好きです。あなたは何が好きですか？',
    shizuoka_culture: '私は静岡のお茶が好きです。あなたはどんな飲み物が好きですか？',
    talents: '私は絵を上手に描けます。あなたは何ができますか？',
    free: '何についてでも話せます。あなたは何が好きですか？',
  },
  matas_lithuania: {
    intro: 'こんにちは！リトアニアから来たマタスです。あなたのお名前は何ですか？',
    favorites: '僕はバスケットボールと森が好きです。あなたは何が好きですか？',
    shizuoka_culture: '僕は富士山が好きです。あなたはどんな場所が好きですか？',
    talents: '僕はバスケットボールができます。あなたは何ができますか？',
    free: '何についてでも話せます。あなたは何が好きですか？',
  },
  ananya_india: {
    intro: 'こんにちは！インドから来たアナニャです。あなたのお名前は何ですか？',
    favorites: '私はコンピュータとクリケットが好きです。あなたは何が好きですか？',
    shizuoka_culture: '私は静岡の緑茶が好きです。あなたはどんな飲み物が好きですか？',
    talents: '私は簡単なゲームを作れます。あなたは何ができますか？',
    free: '何についてでも話せます。あなたは何が好きですか？',
  },
  xinyi_china: {
    intro: 'こんにちは！中国から来たシンイーです。あなたのお名前は何ですか？',
    favorites: '私は卓球と絵を描くことが好きです。あなたは何が好きですか？',
    shizuoka_culture: '私は静岡のいちごが好きです。あなたはどんな果物が好きですか？',
    talents: '私は卓球ができます。あなたは何ができますか？',
    free: '何についてでも話せます。あなたは何が好きですか？',
  },
  nadeesha_srilanka: {
    intro: 'こんにちは！スリランカから来たナディーシャです。あなたのお名前は何ですか？',
    favorites: '私は鳥とお茶が好きです。あなたは何が好きですか？',
    shizuoka_culture: '私は駿河湾が好きです。あなたはどんな場所が好きですか？',
    talents: '私はダンスができます。あなたは何ができますか？',
    free: '何についてでも話せます。あなたは何が好きですか？',
  },
  suman_nepal: {
    intro: 'こんにちは！ネパールから来たスマンです。あなたのお名前は何ですか？',
    favorites: '僕は山とバレーボールが好きです。あなたは何が好きですか？',
    shizuoka_culture: '僕は富士山が好きです。あなたは静岡の何が好きですか？',
    talents: '僕はバレーボールができます。あなたは何ができますか？',
    free: '何についてでも話せます。あなたは何が好きですか？',
  },
  amara_nigeria: {
    intro: 'こんにちは！ナイジェリアから来たアマラです。あなたのお名前は何ですか？',
    favorites: '私は音楽とファッションが好きです。あなたは何が好きですか？',
    shizuoka_culture: '私は静岡のみかんが好きです。あなたはどんな果物が好きですか？',
    talents: '私はダンスができます。あなたは何ができますか？',
    free: '何についてでも話せます。あなたは何が好きですか？',
  },
  andrei_romania: {
    intro: 'こんにちは！ルーマニアから来たアンドレイです。あなたのお名前は何ですか？',
    favorites: '僕は星と音楽が好きです。あなたは何が好きですか？',
    shizuoka_culture: '僕は静岡のお城が好きです。あなたはどんな場所が好きですか？',
    talents: '僕はバイオリンを弾けます。あなたは何ができますか？',
    free: '何についてでも話せます。あなたは何が好きですか？',
  },
};

export const GUIDED_TOPIC_STARTERS_JAPANESE: Record<Exclude<DialogueTopic, 'intro' | 'free'>, string> = {
  favorites: '好きなものについて話しましょう。あなたは何が好きですか？',
  shizuoka_culture: '静岡と文化について話しましょう。あなたは静岡の何が好きですか？',
  talents: 'できることについて話しましょう。あなたは何ができますか？',
  daily_routine: 'ふだんの生活について話しましょう。あなたは朝、何をしますか？',
};

export const DAILY_ROUTINE_STARTER_JAPANESE = GUIDED_TOPIC_STARTERS_JAPANESE.daily_routine;

export const STARTER_PROMPTS_JAPANESE: Record<string, Record<DialogueTopic, string>> = Object.fromEntries(
  Object.entries(BASE_STARTER_PROMPTS_JAPANESE).map(([studentId, prompts]) => [
    studentId,
    {
      ...prompts,
      favorites: GUIDED_TOPIC_STARTERS_JAPANESE.favorites,
      shizuoka_culture: GUIDED_TOPIC_STARTERS_JAPANESE.shizuoka_culture,
      talents: GUIDED_TOPIC_STARTERS_JAPANESE.talents,
      daily_routine: GUIDED_TOPIC_STARTERS_JAPANESE.daily_routine,
    },
  ]),
) as Record<string, Record<DialogueTopic, string>>;

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
