from pathlib import Path
import json


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor not found in {path}: {old[:120]!r}')
    text = text.replace(old, new, 1)
    p.write_text(text)

# 1) Extend the stable type unions while retaining the two legacy personas for old sessions.
replace_once(
    'src/types.ts',
    "  | 'Myanmar';",
    "  | 'Myanmar'\n  | 'South Korea'\n  | 'Belarus'\n  | 'Germany'\n  | 'Malaysia'\n  | 'Indonesia'\n  | 'Taiwan'\n  | 'Lithuania'\n  | 'India'\n  | 'China'\n  | 'Sri Lanka'\n  | 'Nepal'\n  | 'Nigeria'\n  | 'Romania';",
)
replace_once(
    'src/types.ts',
    "  | 'aung_myanmar';",
    "  | 'aung_myanmar'\n  | 'minji_korea'\n  | 'pavel_belarus'\n  | 'lukas_germany'\n  | 'aina_malaysia'\n  | 'dimas_indonesia'\n  | 'yuting_taiwan'\n  | 'matas_lithuania'\n  | 'ananya_india'\n  | 'xinyi_china'\n  | 'nadeesha_srilanka'\n  | 'suman_nepal'\n  | 'amara_nigeria'\n  | 'andrei_romania';",
)

# 2) Add the 13 new personas without changing the existing nine-object display list.
new_personas = r'''

export const NEW_AI_STUDENTS_13: AIStudentProfile[] = [
  {
    id: 'minji_korea', name: 'Minji Kim', japaneseName: 'ミンジ・キム', gender: 'female', age: 21,
    country: 'South Korea', countryJapanese: '韓国', countryNative: '대한민국', countryCode: 'South Korea',
    flag: '🇰🇷', city: 'Busan (釜山)', role: '静岡大学 交換留学生 (大学3年生)',
    major: '教育学・児童発達', avatarImage: './images/minji_kor.jpg',
    heritageLandmark: '🏖️ Haeundae Beach (海雲台ビーチ)',
    accentName: '韓国英語 (Korean English)', worldEnglishesCircle: 'Expanding', voiceLang: 'en-US', voiceGender: 'female', voicePitch: 1.18, voiceRate: 0.90,
    fillerWords: [], characteristicPhrases: [],
    likes: ['Photography 📷 (写真)', 'Baking 🧁 (お菓子作り)', 'Webtoons 📚 (ウェブ漫画)', 'Baseball ⚾ (野球)'],
    japaneseBio: '韓国・釜山出身。写真を撮ることやお菓子作りが好きで、子どもの学びについて勉強している留学生です。',
    characterMessage: "Hi! I am Minji from Korea. Let's talk in English!",
    starterPromptDefault: "Hi! I'm Minji from Korea. What's your name?",
    topicPrompts: topicPrompts(
      "Hi! I'm Minji from Korea. What's your name?",
      "I like photos and baking. What do you like?",
      "I like Shizuoka strawberries. What food do you like?",
      "I can bake cookies. What can you do?",
      "We can talk about anything. What do you like?"
    ),
  },
  {
    id: 'pavel_belarus', name: 'Pavel Ivanov', japaneseName: 'パーヴェル・イワノフ', gender: 'male', age: 22,
    country: 'Belarus', countryJapanese: 'ベラルーシ', countryNative: 'Беларусь', countryCode: 'Belarus',
    flag: '🇧🇾', city: 'Minsk (ミンスク)', role: '静岡大学 交換留学生 (大学3年生)',
    major: '数理・データ科学', avatarImage: './images/pavel_blr.jpg',
    heritageLandmark: '🏰 Mir Castle (ミール城)',
    accentName: '東ヨーロッパ英語 (Belarusian English)', worldEnglishesCircle: 'Expanding', voiceLang: 'en-GB', voiceGender: 'male', voicePitch: 0.96, voiceRate: 0.88,
    fillerWords: [], characteristicPhrases: [],
    likes: ['Chess ♟️ (チェス)', 'Ice Hockey 🏒 (アイスホッケー)', 'Stargazing 🔭 (星を見ること)', 'Draniki 🥔 (ドラニキ)'],
    japaneseBio: 'ベラルーシ・ミンスク出身。チェスや星を見ることが好きで、データやコンピュータについて学んでいる留学生です。',
    characterMessage: "Hello! I am Pavel from Belarus. Let's talk in English!",
    starterPromptDefault: "Hello! I'm Pavel from Belarus. What's your name?",
    topicPrompts: topicPrompts(
      "Hello! I'm Pavel from Belarus. What's your name?",
      "I like chess and stars. What do you like?",
      "I like Mt. Fuji. What place do you like?",
      "I can play chess. What can you do?",
      "We can talk about anything. What do you like?"
    ),
  },
  {
    id: 'lukas_germany', name: 'Lukas Müller', japaneseName: 'ルーカス・ミュラー', gender: 'male', age: 21,
    country: 'Germany', countryJapanese: 'ドイツ', countryNative: 'Deutschland', countryCode: 'Germany',
    flag: '🇩🇪', city: 'Hamburg (ハンブルク)', role: '静岡大学 交換留学生 (大学3年生)',
    major: '機械工学', avatarImage: './images/lukas_deu.jpg',
    heritageLandmark: '🎼 Elbphilharmonie (エルプフィルハーモニー)',
    accentName: '中央ヨーロッパ英語 (German English)', worldEnglishesCircle: 'Expanding', voiceLang: 'en-GB', voiceGender: 'male', voicePitch: 1.00, voiceRate: 0.90,
    fillerWords: [], characteristicPhrases: [],
    likes: ['Handball 🤾 (ハンドボール)', 'Model Trains 🚆 (鉄道模型)', 'Bread Baking 🥨 (パン作り)', 'Forest Hiking 🌲 (森のハイキング)'],
    japaneseBio: 'ドイツ・ハンブルク出身。模型やハンドボールが好きで、ものづくりや機械について学んでいる留学生です。',
    characterMessage: "Hello! I am Lukas from Germany. Let's talk in English!",
    starterPromptDefault: "Hello! I'm Lukas from Germany. What's your name?",
    topicPrompts: topicPrompts(
      "Hello! I'm Lukas from Germany. What's your name?",
      "I like handball and trains. What do you like?",
      "I like Shizuoka parks. What place do you like?",
      "I can play handball. What can you do?",
      "We can talk about anything. What do you like?"
    ),
  },
  {
    id: 'aina_malaysia', name: 'Aina Rahman', japaneseName: 'アイナ・ラーマン', gender: 'female', age: 20,
    country: 'Malaysia', countryJapanese: 'マレーシア', countryNative: 'Malaysia', countryCode: 'Malaysia',
    flag: '🇲🇾', city: 'Penang (ペナン)', role: '静岡大学 交換留学生 (大学2年生)',
    major: '環境デザイン', avatarImage: './images/aina_mys.jpg',
    heritageLandmark: '🏘️ George Town (ジョージタウン)',
    accentName: 'マレーシア英語 (Malaysian English)', worldEnglishesCircle: 'Outer', voiceLang: 'en-US', voiceGender: 'female', voicePitch: 1.22, voiceRate: 0.90,
    fillerWords: [], characteristicPhrases: [],
    likes: ['Batik 🎨 (バティック)', 'Tropical Fruits 🥭 (南国の果物)', 'Badminton 🏸 (バドミントン)', 'Night Markets 🌙 (夜市)'],
    japaneseBio: 'マレーシア・ペナン出身。色やデザイン、さまざまな食文化に興味があり、環境にやさしい空間づくりを学んでいます。',
    characterMessage: "Hi! I am Aina from Malaysia. Let's talk in English!",
    starterPromptDefault: "Hi! I'm Aina from Malaysia. What's your name?",
    topicPrompts: topicPrompts(
      "Hi! I'm Aina from Malaysia. What's your name?",
      "I like badminton and fruit. What do you like?",
      "I like Shizuoka oranges. What fruit do you like?",
      "I can play badminton. What can you do?",
      "We can talk about anything. What do you like?"
    ),
  },
  {
    id: 'dimas_indonesia', name: 'Dimas Pratama', japaneseName: 'ディマス・プラタマ', gender: 'male', age: 22,
    country: 'Indonesia', countryJapanese: 'インドネシア', countryNative: 'Indonesia', countryCode: 'Indonesia',
    flag: '🇮🇩', city: 'Yogyakarta (ジョグジャカルタ)', role: '静岡大学 交換留学生 (大学3年生)',
    major: '観光・文化遺産学', avatarImage: './images/dimas_idn.jpg',
    heritageLandmark: '🛕 Borobudur (ボロブドゥール寺院)',
    accentName: '東南アジア英語 (Indonesian English)', worldEnglishesCircle: 'Expanding', voiceLang: 'en-US', voiceGender: 'male', voicePitch: 0.98, voiceRate: 0.89,
    fillerWords: [], characteristicPhrases: [],
    likes: ['Gamelan 🎵 (ガムラン音楽)', 'Futsal ⚽ (フットサル)', 'Nasi Goreng 🍳 (ナシゴレン)', 'Volcanoes 🌋 (火山)'],
    japaneseBio: 'インドネシア・ジョグジャカルタ出身。音楽やスポーツが好きで、文化や歴史を生かした観光について勉強しています。',
    characterMessage: "Hello! I am Dimas from Indonesia. Let's talk in English!",
    starterPromptDefault: "Hello! I'm Dimas from Indonesia. What's your name?",
    topicPrompts: topicPrompts(
      "Hello! I'm Dimas from Indonesia. What's your name?",
      "I like futsal and music. What do you like?",
      "I like Shizuoka food. What food do you like?",
      "I can play futsal. What can you do?",
      "We can talk about anything. What do you like?"
    ),
  },
  {
    id: 'yuting_taiwan', name: 'Yu-Ting Lin', japaneseName: 'ユーティン・リン', gender: 'female', age: 21,
    country: 'Taiwan', countryJapanese: '台湾', countryNative: '臺灣', countryCode: 'Taiwan',
    flag: '🇹🇼', city: 'Taipei (台北)', role: '静岡大学 交換留学生 (大学3年生)',
    major: 'ビジュアル・コミュニケーションデザイン', avatarImage: './images/yuting_twn.jpg',
    heritageLandmark: '🏙️ Taipei 101 (台北101)',
    accentName: '台湾英語 (Taiwan English)', worldEnglishesCircle: 'Expanding', voiceLang: 'en-US', voiceGender: 'female', voicePitch: 1.26, voiceRate: 0.91,
    fillerWords: [], characteristicPhrases: [],
    likes: ['Bubble Tea 🧋 (タピオカミルクティー)', 'Calligraphy 🖌️ (書道)', 'Cycling 🚲 (サイクリング)', 'Night Markets 🏮 (夜市)'],
    japaneseBio: '台湾・台北出身。絵や文字のデザインが好きで、人に分かりやすく伝えるデザインについて学んでいます。',
    characterMessage: "Hi! I am Yu-Ting from Taiwan. Let's talk in English!",
    starterPromptDefault: "Hi! I'm Yu-Ting from Taiwan. What's your name?",
    topicPrompts: topicPrompts(
      "Hi! I'm Yu-Ting from Taiwan. What's your name?",
      "I like drawing and cycling. What do you like?",
      "I like Shizuoka tea. What drink do you like?",
      "I can draw well. What can you do?",
      "We can talk about anything. What do you like?"
    ),
  },
  {
    id: 'matas_lithuania', name: 'Matas Jankauskas', japaneseName: 'マタス・ヤンカウスカス', gender: 'male', age: 20,
    country: 'Lithuania', countryJapanese: 'リトアニア', countryNative: 'Lietuva', countryCode: 'Lithuania',
    flag: '🇱🇹', city: 'Kaunas (カウナス)', role: '静岡大学 交換留学生 (大学2年生)',
    major: 'スポーツ科学・健康', avatarImage: './images/matas_ltu.jpg',
    heritageLandmark: '🏰 Trakai Island Castle (トラカイ島城)',
    accentName: 'バルト地域英語 (Lithuanian English)', worldEnglishesCircle: 'Expanding', voiceLang: 'en-GB', voiceGender: 'male', voicePitch: 0.96, voiceRate: 0.90,
    fillerWords: [], characteristicPhrases: [],
    likes: ['Basketball 🏀 (バスケットボール)', 'Amber Crafts 🟠 (琥珀工芸)', 'Forest Walks 🌳 (森の散歩)', 'Board Games 🎲 (ボードゲーム)'],
    japaneseBio: 'リトアニア・カウナス出身。バスケットボールや森を歩くことが好きで、運動と健康について勉強しています。',
    characterMessage: "Hello! I am Matas from Lithuania. Let's talk in English!",
    starterPromptDefault: "Hello! I'm Matas from Lithuania. What's your name?",
    topicPrompts: topicPrompts(
      "Hello! I'm Matas from Lithuania. What's your name?",
      "I like basketball and forests. What do you like?",
      "I like Mt. Fuji. What place do you like?",
      "I can play basketball. What can you do?",
      "We can talk about anything. What do you like?"
    ),
  },
  {
    id: 'ananya_india', name: 'Ananya Sharma', japaneseName: 'アナニャ・シャルマ', gender: 'female', age: 22,
    country: 'India', countryJapanese: 'インド', countryNative: 'भारत', countryCode: 'India',
    flag: '🇮🇳', city: 'Bengaluru (ベンガルール)', role: '静岡大学 交換留学生 (大学3年生)',
    major: 'コンピュータ科学', avatarImage: './images/ananya_ind.jpg',
    heritageLandmark: '🏛️ Vidhana Soudha (ヴィダーナ・サウダ)',
    accentName: 'インド英語 (Indian English)', worldEnglishesCircle: 'Outer', voiceLang: 'en-IN', voiceGender: 'female', voicePitch: 1.16, voiceRate: 0.90,
    fillerWords: [], characteristicPhrases: [],
    likes: ['Coding 💻 (プログラミング)', 'Cricket 🏏 (クリケット)', 'Dosa 🥞 (ドーサ)', 'Space Science 🚀 (宇宙科学)'],
    japaneseBio: 'インド・ベンガルール出身。コンピュータや宇宙に興味があり、プログラミングを学んでいる留学生です。',
    characterMessage: "Hi! I am Ananya from India. Let's talk in English!",
    starterPromptDefault: "Hi! I'm Ananya from India. What's your name?",
    topicPrompts: topicPrompts(
      "Hi! I'm Ananya from India. What's your name?",
      "I like computers and cricket. What do you like?",
      "I like Shizuoka green tea. What drink do you like?",
      "I can make a simple game. What can you do?",
      "We can talk about anything. What do you like?"
    ),
  },
  {
    id: 'xinyi_china', name: 'Xinyi Zhang', japaneseName: 'シンイー・ジャン', gender: 'female', age: 21,
    country: 'China', countryJapanese: '中国', countryNative: '中国', countryCode: 'China',
    flag: '🇨🇳', city: 'Shanghai (上海)', role: '静岡大学 交換留学生 (大学3年生)',
    major: '経済・国際ビジネス', avatarImage: './images/xinyi_chn.jpg',
    heritageLandmark: '🌆 The Bund (外灘)',
    accentName: '中国英語 (Chinese English)', worldEnglishesCircle: 'Expanding', voiceLang: 'en-US', voiceGender: 'female', voicePitch: 1.20, voiceRate: 0.90,
    fillerWords: [], characteristicPhrases: [],
    likes: ['Table Tennis 🏓 (卓球)', 'Calligraphy 🖌️ (書道)', 'Dumplings 🥟 (餃子)', 'City Walks 🚶 (街歩き)'],
    japaneseBio: '中国・上海出身。卓球や書道が好きで、都市や人々の生活と経済について学んでいる留学生です。',
    characterMessage: "Hi! I am Xinyi from China. Let's talk in English!",
    starterPromptDefault: "Hi! I'm Xinyi from China. What's your name?",
    topicPrompts: topicPrompts(
      "Hi! I'm Xinyi from China. What's your name?",
      "I like table tennis and drawing. What do you like?",
      "I like Shizuoka strawberries. What fruit do you like?",
      "I can play table tennis. What can you do?",
      "We can talk about anything. What do you like?"
    ),
  },
  {
    id: 'nadeesha_srilanka', name: 'Nadeesha Perera', japaneseName: 'ナディーシャ・ペレラ', gender: 'female', age: 20,
    country: 'Sri Lanka', countryJapanese: 'スリランカ', countryNative: 'ශ්‍රී ලංකාව', countryCode: 'Sri Lanka',
    flag: '🇱🇰', city: 'Kandy (キャンディ)', role: '静岡大学 交換留学生 (大学2年生)',
    major: '環境科学・生物多様性', avatarImage: './images/nadeesha_lka.jpg',
    heritageLandmark: '🪨 Sigiriya (シーギリヤ・ロック)',
    accentName: 'スリランカ英語 (Sri Lankan English)', worldEnglishesCircle: 'Outer', voiceLang: 'en-IN', voiceGender: 'female', voicePitch: 1.18, voiceRate: 0.89,
    fillerWords: [], characteristicPhrases: [],
    likes: ['Birdwatching 🐦 (野鳥観察)', 'Tea Gardens 🍃 (茶畑)', 'Kandyan Dance 💃 (キャンディアンダンス)', 'Beaches 🏖️ (海辺)'],
    japaneseBio: 'スリランカ・キャンディ出身。自然や鳥を見ることが好きで、人と自然が共に暮らす環境について学んでいます。',
    characterMessage: "Hi! I am Nadeesha from Sri Lanka. Let's talk in English!",
    starterPromptDefault: "Hi! I'm Nadeesha from Sri Lanka. What's your name?",
    topicPrompts: topicPrompts(
      "Hi! I'm Nadeesha from Sri Lanka. What's your name?",
      "I like birds and tea. What do you like?",
      "I like Suruga Bay. What place do you like?",
      "I can dance. What can you do?",
      "We can talk about anything. What do you like?"
    ),
  },
  {
    id: 'suman_nepal', name: 'Suman Gurung', japaneseName: 'スマン・グルン', gender: 'male', age: 21,
    country: 'Nepal', countryJapanese: 'ネパール', countryNative: 'नेपाल', countryCode: 'Nepal',
    flag: '🇳🇵', city: 'Pokhara (ポカラ)', role: '静岡大学 交換留学生 (大学3年生)',
    major: '地理学・防災', avatarImage: './images/suman_npl.jpg',
    heritageLandmark: '🏞️ Phewa Lake (フェワ湖)',
    accentName: '南アジア英語 (Nepali English)', worldEnglishesCircle: 'Expanding', voiceLang: 'en-IN', voiceGender: 'male', voicePitch: 0.98, voiceRate: 0.88,
    fillerWords: [], characteristicPhrases: [],
    likes: ['Trekking 🥾 (トレッキング)', 'Momo 🥟 (モモ)', 'Volleyball 🏐 (バレーボール)', 'Mountain Photography 🏔️ (山の写真)'],
    japaneseBio: 'ネパール・ポカラ出身。山や自然が好きで、地形や自然災害について学んでいる留学生です。',
    characterMessage: "Hello! I am Suman from Nepal. Let's talk in English!",
    starterPromptDefault: "Hello! I'm Suman from Nepal. What's your name?",
    topicPrompts: topicPrompts(
      "Hello! I'm Suman from Nepal. What's your name?",
      "I like mountains and volleyball. What do you like?",
      "I like Mt. Fuji. What do you like in Shizuoka?",
      "I can play volleyball. What can you do?",
      "We can talk about anything. What do you like?"
    ),
  },
  {
    id: 'amara_nigeria', name: 'Amara Okafor', japaneseName: 'アマラ・オカフォー', gender: 'female', age: 22,
    country: 'Nigeria', countryJapanese: 'ナイジェリア', countryNative: 'Nigeria', countryCode: 'Nigeria',
    flag: '🇳🇬', city: 'Lagos (ラゴス)', role: '静岡大学 交換留学生 (大学3年生)',
    major: '国際関係学', avatarImage: './images/amara_nga.jpg',
    heritageLandmark: '🌉 Lekki-Ikoyi Link Bridge (レッキ・イコイ橋)',
    accentName: 'ナイジェリア英語 (Nigerian English)', worldEnglishesCircle: 'Outer', voiceLang: 'en-GB', voiceGender: 'female', voicePitch: 1.20, voiceRate: 0.92,
    fillerWords: [], characteristicPhrases: [],
    likes: ['Afrobeats 🎧 (アフロビーツ)', 'Fashion Design 👗 (ファッションデザイン)', 'Jollof Rice 🍚 (ジョロフライス)', 'Basketball 🏀 (バスケットボール)'],
    japaneseBio: 'ナイジェリア・ラゴス出身。音楽やファッションが好きで、国や文化の違いを越えた交流について学んでいます。',
    characterMessage: "Hi! I am Amara from Nigeria. Let's talk in English!",
    starterPromptDefault: "Hi! I'm Amara from Nigeria. What's your name?",
    topicPrompts: topicPrompts(
      "Hi! I'm Amara from Nigeria. What's your name?",
      "I like music and fashion. What do you like?",
      "I like Shizuoka oranges. What fruit do you like?",
      "I can dance. What can you do?",
      "We can talk about anything. What do you like?"
    ),
  },
  {
    id: 'andrei_romania', name: 'Andrei Popescu', japaneseName: 'アンドレイ・ポペスク', gender: 'male', age: 20,
    country: 'Romania', countryJapanese: 'ルーマニア', countryNative: 'România', countryCode: 'Romania',
    flag: '🇷🇴', city: 'Cluj-Napoca (クルジュ＝ナポカ)', role: '静岡大学 交換留学生 (大学2年生)',
    major: '建築・都市デザイン', avatarImage: './images/andrei_rou.jpg',
    heritageLandmark: '⛏️ Salina Turda (サリーナ・トゥルダ)',
    accentName: '東ヨーロッパ英語 (Romanian English)', worldEnglishesCircle: 'Expanding', voiceLang: 'en-GB', voiceGender: 'male', voicePitch: 0.96, voiceRate: 0.89,
    fillerWords: [], characteristicPhrases: [],
    likes: ['Astronomy 🔭 (天文学)', 'Board Games 🎲 (ボードゲーム)', 'Folk Music 🎻 (民族音楽)', 'Papanasi 🍩 (パパナシ)'],
    japaneseBio: 'ルーマニア・クルジュ＝ナポカ出身。星や建物を見ることが好きで、人が暮らしやすい街のデザインを学んでいます。',
    characterMessage: "Hello! I am Andrei from Romania. Let's talk in English!",
    starterPromptDefault: "Hello! I'm Andrei from Romania. What's your name?",
    topicPrompts: topicPrompts(
      "Hello! I'm Andrei from Romania. What's your name?",
      "I like stars and music. What do you like?",
      "I like Shizuoka castles. What place do you like?",
      "I can play violin. What can you do?",
      "We can talk about anything. What do you like?"
    ),
  },
];

export const AI_STUDENTS_MASTER_LIST: AIStudentProfile[] = [...AI_STUDENTS_LIST, ...NEW_AI_STUDENTS_13];

export const TARGET_20_AI_STUDENT_IDS: AIStudentProfile['id'][] = [
  'emma_usa', 'oliver_uk', 'liam_australia',
  'minji_korea', 'pavel_belarus', 'lukas_germany', 'aina_malaysia', 'dimas_indonesia',
  'bence_hungary', 'yuting_taiwan', 'zofia_poland', 'matas_lithuania', 'ananya_india',
  'xinyi_china', 'linh_vietnam', 'rahul_bangladesh', 'nadeesha_srilanka', 'suman_nepal',
  'amara_nigeria', 'andrei_romania',
];
'''
replace_once(
    'src/data/curriculum.ts',
    "\nexport function getAIStudentById(id: string): AIStudentProfile {\n  const exact = AI_STUDENTS_LIST.find((s) => s.id === id);\n  if (exact) return exact;\n  const prefix = id.split('_')[0];\n  return AI_STUDENTS_LIST.find((s) => s.id.startsWith(prefix)) || AI_STUDENTS_LIST[0];\n}\n",
    new_personas + "\nexport function getAIStudentById(id: string): AIStudentProfile {\n  const exact = AI_STUDENTS_MASTER_LIST.find((s) => s.id === id);\n  if (exact) return exact;\n  const prefix = id.split('_')[0];\n  return AI_STUDENTS_MASTER_LIST.find((s) => s.id.startsWith(prefix)) || AI_STUDENTS_MASTER_LIST[0];\n}\n",
)

# 3) Accept the new IDs in persistence/server validation while retaining legacy IDs.
replace_once(
    'src/dataContract.ts',
    "  'emma_usa','oliver_uk','liam_australia','chloe_canada','bence_hungary','zofia_poland','rahul_bangladesh','linh_vietnam','aung_myanmar',",
    "  'emma_usa','oliver_uk','liam_australia','chloe_canada','bence_hungary','zofia_poland','rahul_bangladesh','linh_vietnam','aung_myanmar',\n  'minji_korea','pavel_belarus','lukas_germany','aina_malaysia','dimas_indonesia','yuting_taiwan','matas_lithuania',\n  'ananya_india','xinyi_china','nadeesha_srilanka','suman_nepal','amara_nigeria','andrei_romania',",
)

# 4) Research metadata/TTS/dictionary v2.
replace_once('src/data/personaResearch.ts', "import { AI_STUDENTS_LIST } from './curriculum';", "import { AI_STUDENTS_MASTER_LIST } from './curriculum';")
replace_once('src/data/personaResearch.ts', "export const PERSONA_DICTIONARY_VERSION = 'persona-profile-v1';", "export const PERSONA_DICTIONARY_VERSION = 'persona-profile-v2';")
replace_once(
    'src/data/personaResearch.ts',
    "  aung_myanmar: { languageCode: 'en-IN', name: 'en-IN-Chirp3-HD-Puck' },\n};",
    "  aung_myanmar: { languageCode: 'en-IN', name: 'en-IN-Chirp3-HD-Puck' },\n  minji_korea: { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Kore' },\n  pavel_belarus: { languageCode: 'en-GB', name: 'en-GB-Chirp3-HD-Orus' },\n  lukas_germany: { languageCode: 'en-GB', name: 'en-GB-Chirp3-HD-Iapetus' },\n  aina_malaysia: { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Aoede' },\n  dimas_indonesia: { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Puck' },\n  yuting_taiwan: { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Leda' },\n  matas_lithuania: { languageCode: 'en-GB', name: 'en-GB-Chirp3-HD-Puck' },\n  ananya_india: { languageCode: 'en-IN', name: 'en-IN-Chirp3-HD-Aoede' },\n  xinyi_china: { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Gacrux' },\n  nadeesha_srilanka: { languageCode: 'en-IN', name: 'en-IN-Chirp3-HD-Gacrux' },\n  suman_nepal: { languageCode: 'en-IN', name: 'en-IN-Chirp3-HD-Puck' },\n  amara_nigeria: { languageCode: 'en-GB', name: 'en-GB-Chirp3-HD-Pulcherrima' },\n  andrei_romania: { languageCode: 'en-GB', name: 'en-GB-Chirp3-HD-Schedar' },\n};",
)
replace_once(
    'src/data/personaResearch.ts',
    "  aung_myanmar: { expression: 'history and Asian exchange studies', keywords: ['history', 'asian exchange', 'asian studies'] },\n};",
    "  aung_myanmar: { expression: 'history and Asian exchange studies', keywords: ['history', 'asian exchange', 'asian studies'] },\n  minji_korea: { expression: 'education and child development', keywords: ['education', 'child development'] },\n  pavel_belarus: { expression: 'mathematics and data science', keywords: ['mathematics', 'math', 'data science'] },\n  lukas_germany: { expression: 'mechanical engineering', keywords: ['mechanical engineering', 'engineering'] },\n  aina_malaysia: { expression: 'environmental design', keywords: ['environmental design', 'design'] },\n  dimas_indonesia: { expression: 'tourism and cultural heritage', keywords: ['tourism', 'cultural heritage'] },\n  yuting_taiwan: { expression: 'visual communication design', keywords: ['visual communication design', 'communication design', 'design'] },\n  matas_lithuania: { expression: 'sports science and health', keywords: ['sports science', 'health'] },\n  ananya_india: { expression: 'computer science', keywords: ['computer science', 'computing'] },\n  xinyi_china: { expression: 'economics and international business', keywords: ['economics', 'international business', 'business'] },\n  nadeesha_srilanka: { expression: 'environmental science and biodiversity', keywords: ['environmental science', 'biodiversity'] },\n  suman_nepal: { expression: 'geography and disaster prevention', keywords: ['geography', 'disaster prevention'] },\n  amara_nigeria: { expression: 'international relations', keywords: ['international relations'] },\n  andrei_romania: { expression: 'architecture and urban design', keywords: ['architecture', 'urban design'] },\n};",
)
replace_once(
    'src/data/personaResearch.ts',
    "export type PersonaProfileField = 'likes' | 'major';",
    "export type PersonaProfileField = 'likes' | 'major' | 'city' | 'landmark';",
)
replace_once(
    'src/data/personaResearch.ts',
    "  category: 'interest' | 'major';",
    "  category: 'interest' | 'major' | 'place';",
)
replace_once(
    'src/data/personaResearch.ts',
    "export const PERSONA_PROFILE_DICTIONARY: PersonaDictionaryEntry[] = AI_STUDENTS_LIST.flatMap((persona) => {",
    "export const PERSONA_PROFILE_DICTIONARY: PersonaDictionaryEntry[] = AI_STUDENTS_MASTER_LIST.flatMap((persona) => {",
)
old_return = """  const major = MAJOR_ENGLISH[persona.id];
  return likes.concat({
    id: `persona-${persona.id}-major`,
    personaId: persona.id,
    profileField: 'major',
    category: 'major',
    expression: major.expression,
    japanese: persona.major,
    keywords: major.keywords,
  });
});"""
new_return = """  const major = MAJOR_ENGLISH[persona.id];
  const entries: PersonaDictionaryEntry[] = likes.concat({
    id: `persona-${persona.id}-major`,
    personaId: persona.id,
    profileField: 'major',
    category: 'major',
    expression: major.expression,
    japanese: persona.major,
    keywords: major.keywords,
  });
  const cityExpression = asciiLabel(persona.city);
  if (cityExpression) entries.push({
    id: `persona-${persona.id}-city`, personaId: persona.id, profileField: 'city', category: 'place',
    expression: cityExpression, japanese: japaneseLabel(persona.city), keywords: keywordVariants(cityExpression),
  });
  const landmarkExpression = asciiLabel(persona.heritageLandmark || '');
  if (landmarkExpression) entries.push({
    id: `persona-${persona.id}-landmark`, personaId: persona.id, profileField: 'landmark', category: 'place',
    expression: landmarkExpression, japanese: japaneseLabel(persona.heritageLandmark || ''), keywords: keywordVariants(landmarkExpression),
  });
  return entries;
});"""
replace_once('src/data/personaResearch.ts', old_return, new_return)
replace_once(
    'src/data/personaResearch.ts',
    "  const persona = AI_STUDENTS_LIST.find((item) => item.id === personaId) || AI_STUDENTS_LIST[0];",
    "  const persona = AI_STUDENTS_MASTER_LIST.find((item) => item.id === personaId) || AI_STUDENTS_MASTER_LIST[0];",
)

# 5) Add Japanese starter translations for the 13 new personas.
translations = r'''  minji_korea: {
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
'''
replace_once('src/utils/translation.ts', "  aung_myanmar: {", translations + "  aung_myanmar: {")

# 6) Add a targeted QA that protects the 20-country study master while keeping legacy compatibility.
qa = r'''import { AI_STUDENTS_LIST, AI_STUDENTS_MASTER_LIST, NEW_AI_STUDENTS_13, TARGET_20_AI_STUDENT_IDS } from '../src/data/curriculum';
import { AI_STUDENT_IDS } from '../src/dataContract';
import { GOOGLE_TTS_VOICES, PERSONA_DICTIONARY_VERSION, PERSONA_PROFILE_DICTIONARY } from '../src/data/personaResearch';
import { STARTER_PROMPTS_JAPANESE } from '../src/utils/translation';

const fail = (message: string): never => { throw new Error(message); };
const unique = (items: readonly string[]) => new Set(items).size === items.length;

if (AI_STUDENTS_LIST.length !== 9) fail(`Existing visible list must stay 9 during stage 1; got ${AI_STUDENTS_LIST.length}`);
if (NEW_AI_STUDENTS_13.length !== 13) fail(`Expected 13 new personas; got ${NEW_AI_STUDENTS_13.length}`);
if (AI_STUDENTS_MASTER_LIST.length !== 22) fail(`Expected 22 master personas including 2 legacy hidden personas; got ${AI_STUDENTS_MASTER_LIST.length}`);
if (TARGET_20_AI_STUDENT_IDS.length !== 20 || !unique(TARGET_20_AI_STUDENT_IDS)) fail('Target 20 IDs must be unique and length 20');
if (!unique(AI_STUDENTS_MASTER_LIST.map((p) => p.id))) fail('Master persona IDs must be unique');
if (!unique(AI_STUDENTS_MASTER_LIST.map((p) => p.country))) fail('Master persona countries must be unique');
if (!TARGET_20_AI_STUDENT_IDS.every((id) => AI_STUDENTS_MASTER_LIST.some((p) => p.id === id))) fail('Every target persona must exist in master');
if (TARGET_20_AI_STUDENT_IDS.includes('chloe_canada') || TARGET_20_AI_STUDENT_IDS.includes('aung_myanmar')) fail('Canada/Myanmar must remain legacy-only, not target 20');
if (AI_STUDENT_IDS.length !== 22 || !unique(AI_STUDENT_IDS)) fail('Data contract must accept all 22 master IDs');
if (PERSONA_DICTIONARY_VERSION !== 'persona-profile-v2') fail('Persona dictionary must be v2');

const target = TARGET_20_AI_STUDENT_IDS.map((id) => AI_STUDENTS_MASTER_LIST.find((p) => p.id === id)!).filter(Boolean);
const femaleCount = target.filter((p) => p.gender === 'female').length;
const maleCount = target.filter((p) => p.gender === 'male').length;
if (femaleCount !== 10 || maleCount !== 10) fail(`Target gender balance must be 10/10; got ${femaleCount}/${maleCount}`);
const ageCounts = new Map<number, number>();
for (const p of target) ageCounts.set(p.age, (ageCounts.get(p.age) || 0) + 1);
if (ageCounts.get(20) !== 7 || ageCounts.get(21) !== 7 || ageCounts.get(22) !== 6) fail(`Target age balance changed: ${JSON.stringify([...ageCounts])}`);

const topics = ['intro','favorites','shizuoka_culture','talents','free'] as const;
for (const p of AI_STUDENTS_MASTER_LIST) {
  if (!GOOGLE_TTS_VOICES[p.id]) fail(`Missing Google TTS voice for ${p.id}`);
  const ja = STARTER_PROMPTS_JAPANESE[p.id];
  if (!ja) fail(`Missing Japanese starters for ${p.id}`);
  for (const topic of topics) {
    if (!p.topicPrompts[topic]?.trim()) fail(`Missing English starter ${p.id}/${topic}`);
    if (!ja[topic]?.trim()) fail(`Missing Japanese starter ${p.id}/${topic}`);
  }
  const entries = PERSONA_PROFILE_DICTIONARY.filter((entry) => entry.personaId === p.id);
  for (const field of ['likes','major','city','landmark'] as const) {
    if (!entries.some((entry) => entry.profileField === field)) fail(`Missing ${field} dictionary entry for ${p.id}`);
  }
}

const preserved: Record<string, string[]> = {
  emma_usa: ['Surfing', 'Burgers', 'Video Games', 'Strawberries'],
  oliver_uk: ['Football', 'Afternoon Tea', 'Mount Fuji', 'Shizuoka Green Tea'],
  liam_australia: ['Swimming', 'Koalas', 'Suruga Bay', 'BBQ'],
  bence_hungary: ['Puzzles', 'Math', 'Goulash Soup', 'Green Tea'],
  zofia_poland: ['Piano', 'Drawing', 'Pierogi', 'Sushi'],
  linh_vietnam: ['Pho', 'Badminton', 'Lotus Flowers', 'Shizuoka Mikan'],
  rahul_bangladesh: ['Cricket', 'Tea Gardens', 'Curry', 'Cycling'],
};
for (const [id, expected] of Object.entries(preserved)) {
  const p = AI_STUDENTS_MASTER_LIST.find((item) => item.id === id) || fail(`Missing preserved persona ${id}`);
  const actual = p.likes.map((like) => like.split(' ')[0]);
  if (expected.some((term) => !p.likes.some((like) => like.startsWith(term)))) fail(`Preserved persona changed unexpectedly: ${id} -> ${actual.join(', ')}`);
}

console.log(`Persona master QA: PASS (${target.length} target countries, ${AI_STUDENTS_MASTER_LIST.length} backward-compatible master personas, dictionary ${PERSONA_DICTIONARY_VERSION})`);
'''
Path('scripts/qa-persona-master.ts').write_text(qa)

replace_once(
    'package.json',
    '"qa:version": "tsx scripts/qa-version-ui.ts",',
    '"qa:version": "tsx scripts/qa-version-ui.ts",\n    "qa:persona-master": "tsx scripts/qa-persona-master.ts",',
)
replace_once(
    'package.json',
    'npm run qa:research-export && npm run qa:version && npm run lint && npm run qa:load',
    'npm run qa:research-export && npm run qa:version && npm run qa:persona-master && npm run lint && npm run qa:load',
)

# 7) Production TTS smoke list: validate every master persona, including the two legacy profiles.
replace_once(
    '.github/workflows/cloud-run-deploy.yml',
    "            aung_myanmar; do",
    "            aung_myanmar \\\n            minji_korea \\\n            pavel_belarus \\\n            lukas_germany \\\n            aina_malaysia \\\n            dimas_indonesia \\\n            yuting_taiwan \\\n            matas_lithuania \\\n            ananya_india \\\n            xinyi_china \\\n            nadeesha_srilanka \\\n            suman_nepal \\\n            amara_nigeria \\\n            andrei_romania; do",
)

print('20-country persona data patch applied')
