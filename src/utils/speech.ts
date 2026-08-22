/**
 * Web Speech API and Audio Synthesizer utilities
 * Multi-accent TTS (UK, USA, Australia, Canada, Europe, Asia) and Speech Recognition tailored for Grade 5 Elementary School
 */

import { AIStudentProfile } from '../types';

// Sound effect generator using Web Audio API
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx && typeof window !== 'undefined') {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch (e) {
    return null;
  }
}

export function playChime(type: 'start' | 'stop' | 'success' | 'fanfare' | 'pop' | 'card') {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  if (type === 'start') {
    // Gentle high ascending chime
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === 'stop') {
    // Gentle descending chime
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(784, now);
    osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.18);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  } else if (type === 'pop') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === 'card') {
    // Quick bright sparkle chime for vocabulary card tap
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, now);
    osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.12);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  } else if (type === 'fanfare') {
    // Celebratory 4-note fanfare (C5 -> E5 -> G5 -> C6)
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      gain.gain.setValueAtTime(0.15, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.4);
    });
  }
}

/**
 * Persona-specific voice keywords and pitch/rate tuning to ensure:
 * 1. Gender strictly matches student's illustration (male vs female)
 * 2. Accent highlights national traits (British RP, General American, Aussie, Canadian, European, South Asian, Southeast Asian)
 * 3. All 9 students sound bright, youthful (college students), energetic, and unmistakably distinct from each other
 */
interface PersonaVoiceConfig {
  preferredNames: string[];
  fallbackLang: string;
  defaultPitch: number;
  defaultRate: number;
}

const PERSONA_VOICE_MAP: Record<string, PersonaVoiceConfig> = {
  oliver_uk: {
    // Male, 21 - Crisp, polite British RP
    preferredNames: ['daniel', 'oliver', 'george', 'arthur', 'ryan', 'uk english male', 'en-gb'],
    fallbackLang: 'en-GB',
    defaultPitch: 1.06,
    defaultRate: 0.90,
  },
  emma_usa: {
    // Female, 20 - Bright, upbeat, energetic Californian
    preferredNames: ['samantha', 'eva', 'victoria', 'jenny', 'ava', 'zira', 'us english female', 'en-us'],
    fallbackLang: 'en-US',
    defaultPitch: 1.26,
    defaultRate: 0.96,
  },
  liam_australia: {
    // Male, 22 - Sunny, relaxed, warm Aussie
    preferredNames: ['lee', 'russell', 'australian', 'au male', 'en-au'],
    fallbackLang: 'en-AU',
    defaultPitch: 0.98,
    defaultRate: 0.92,
  },
  chloe_canada: {
    // Female, 21 - Sweet, gentle, friendly Canadian
    preferredNames: ['clara', 'linda', 'karen', 'canadian', 'en-ca'],
    fallbackLang: 'en-CA',
    defaultPitch: 1.20,
    defaultRate: 0.88,
  },
  bence_hungary: {
    // Male, 21 - Articulate, intelligent, crisp Central European
    preferredNames: ['alex', 'fred', 'tom', 'guy', 'brian'],
    fallbackLang: 'en-US',
    defaultPitch: 0.94,
    defaultRate: 0.86,
  },
  zofia_poland: {
    // Female, 20 - Lively, artistic, high-energy Eastern European
    preferredNames: ['moira', 'fiona', 'tessa', 'serena', 'stephanie'],
    fallbackLang: 'en-GB',
    defaultPitch: 1.30,
    defaultRate: 0.94,
  },
  rahul_bangladesh: {
    // Male, 22 - Melodic, enthusiastic, polite South Asian
    preferredNames: ['rishi', 'veena', 'neerja', 'prabhat', 'en-in'],
    fallbackLang: 'en-IN',
    defaultPitch: 1.10,
    defaultRate: 0.92,
  },
  linh_vietnam: {
    // Female, 20 - Sweet, cheerful, gentle Southeast Asian
    preferredNames: ['karen', 'sangeeta', 'allison', 'kathy', 'anna'],
    fallbackLang: 'en-US',
    defaultPitch: 1.36,
    defaultRate: 0.90,
  },
  aung_myanmar: {
    // Male, 21 - Calm, courteous, resonant Southeast Asian
    preferredNames: ['david', 'george', 'richard', 'alan', 'en-gb'],
    fallbackLang: 'en-GB',
    defaultPitch: 0.92,
    defaultRate: 0.85,
  },
};

/**
 * Text to Speech with customizable Accent & Persona (UK, USA, Australia, Canada, etc.)
 */
export function speakStudentVoice(
  text: string,
  student: AIStudentProfile,
  customRate?: number,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (e: unknown) => void
): SpeechSynthesisUtterance | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('SpeechSynthesis not supported');
    onEnd?.();
    return null;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const config = PERSONA_VOICE_MAP[student.id] || {
    preferredNames: [],
    fallbackLang: student.voiceLang || 'en-US',
    defaultPitch: student.gender === 'female' ? 1.25 : 1.0,
    defaultRate: 0.9,
  };

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = customRate || student.voiceRate || config.defaultRate;
  utterance.pitch = student.voicePitch || config.defaultPitch;

  const targetLang = student.voiceLang || config.fallbackLang;
  const voices = window.speechSynthesis.getVoices();

  // Smart Gender & Accent Filter
  const isFemale = student.gender === 'female';
  const femaleKeywords = ['female', 'woman', 'girl', 'samantha', 'victoria', 'karen', 'zira', 'moira', 'fiona', 'eva', 'susan', 'jenny', 'ava', 'clara', 'tessa', 'anna', 'linda'];
  const maleKeywords = ['male', 'man', 'boy', 'daniel', 'oliver', 'george', 'david', 'alex', 'tom', 'fred', 'russell', 'lee', 'guy', 'brian', 'rishi', 'richard'];

  const matchesGender = (voiceName: string) => {
    const vName = voiceName.toLowerCase();
    if (isFemale) {
      if (femaleKeywords.some((k) => vName.includes(k))) return true;
      if (maleKeywords.some((k) => vName.includes(k))) return false;
      return true;
    } else {
      if (maleKeywords.some((k) => vName.includes(k))) return true;
      if (femaleKeywords.some((k) => vName.includes(k))) return false;
      return true;
    }
  };

  // 1. Try matching preferred voice names for this specific persona
  let selectedVoice: SpeechSynthesisVoice | null = null;

  for (const pref of config.preferredNames) {
    const found = voices.find((v) => v.name.toLowerCase().includes(pref) && matchesGender(v.name));
    if (found) {
      selectedVoice = found;
      break;
    }
  }

  // 2. Try matching target language + gender
  if (!selectedVoice) {
    selectedVoice =
      voices.find((v) => {
        const langMatch = v.lang.replace('_', '-').toLowerCase().startsWith(targetLang.toLowerCase());
        return langMatch && matchesGender(v.name);
      }) || null;
  }

  // 3. Try matching any English voice with correct gender
  if (!selectedVoice) {
    selectedVoice =
      voices.find((v) => v.lang.toLowerCase().startsWith('en') && matchesGender(v.name)) || null;
  }

  // 4. Final fallback to any English voice
  if (!selectedVoice) {
    selectedVoice = voices.find((v) => v.lang.toLowerCase().startsWith('en')) || null;
  }

  if (selectedVoice) {
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang;
  } else {
    utterance.lang = targetLang;
  }

  utterance.onstart = () => {
    onStart?.();
  };

  utterance.onend = () => {
    onEnd?.();
  };

  utterance.onerror = (err) => {
    console.warn('TTS error:', err);
    onError?.(err);
    onEnd?.();
  };

  try {
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('Error initiating TTS speak:', e);
    onEnd?.();
  }

  return utterance;
}

/**
 * Dedicated pronunciation player for Vocabulary Builder cards
 */
export function speakVocabularyWord(
  word: string,
  lang = 'en-US',
  onEnd?: () => void
): SpeechSynthesisUtterance | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onEnd?.();
    return null;
  }

  window.speechSynthesis.cancel();
  playChime('card');

  const utterance = new SpeechSynthesisUtterance(word);
  utterance.rate = 0.82; // slightly slower, very clear for elementary kids
  utterance.pitch = 1.08;

  const voices = window.speechSynthesis.getVoices();
  const voice =
    voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(lang.toLowerCase())) ||
    voices.find((v) => v.lang.toLowerCase().startsWith('en')) ||
    null;

  if (voice) {
    utterance.voice = voice;
  }

  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();

  try {
    window.speechSynthesis.speak(utterance);
  } catch {
    onEnd?.();
  }

  return utterance;
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Return warm, cheerful farewell message for each student when time is up
 */
export function getStudentFarewellMessage(studentId: string): { english: string; japanese: string } {
  switch (studentId) {
    case 'oliver_uk':
      return {
        english: "Time is up! Thank you for the wonderful talk! Cheers and see you again!",
        japanese: "時間になりました！素晴らしいお話をありがとう！またね、Cheers！",
      };
    case 'emma_usa':
      return {
        english: "Time is up! Awesome job talking with me today! See you soon!",
        japanese: "時間になりました！今日はいっぱいお話しできて最高だったよ！またね！",
      };
    case 'liam_australia':
      return {
        english: "Time is up! Good on ya mate, thank you for the great chat! See ya!",
        japanese: "時間になりました！素晴らしいお話をありがとう！また会おうね！",
      };
    case 'chloe_canada':
      return {
        english: "Time is up! Thank you so much for the lovely conversation! Have a wonderful day!",
        japanese: "時間になりました！とっても楽しいお話をありがとう！良い一日をね！",
      };
    case 'bence_hungary':
      return {
        english: "Time is up! Fantastic job today! Szia and see you next time!",
        japanese: "時間になりました！素晴らしい頑張りでした！Szia、また次回！",
      };
    case 'zofia_poland':
      return {
        english: "Time is up! Bravo! Thank you for the beautiful talk! Cześć!",
        japanese: "時間になりました！ブラボー！素敵な対話をありがとう！Cześć！",
      };
    case 'rahul_bangladesh':
      return {
        english: "Time is up! Thank you very much my friend! Have a wonderful day!",
        japanese: "時間になりました！友だち、本当にありがとう！素敵な日を過ごしてね！",
      };
    case 'linh_vietnam':
      return {
        english: "Time is up! You did amazing today! Xin chào and see you soon!",
        japanese: "時間になりました！今日とても上手に話せたね！Xin chào、またね！",
      };
    case 'aung_myanmar':
      return {
        english: "Time is up! Thank you for the peaceful chat! Mingalaba and see you!",
        japanese: "時間になりました！心温まるお話をありがとう！Mingalaba、またね！",
      };
    default:
      return {
        english: "Time is up! Thank you for talking with me today! See you next time!",
        japanese: "時間になりました！今日はお話ししてくれてありがとう！またね！",
      };
  }
}

/**
 * Pre-authorizes hardware microphone access seamlessly for the app session
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    ) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
      if (stream) {
        // Stop tracks immediately so browser doesn't keep mic indicator on when not actively recording
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // Ignore
          }
        });
        return true;
      }
    }
  } catch {
    // Graceful fallback for restricted iframes or missing devices
  }
  return false;
}

/**
 * Speech-to-Text Recognition interface
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

export function createSpeechRecognitionInstance(
  onResult: (text: string, isFinal: boolean) => void,
  onError: (error: string) => void,
  onEnd: () => void
) {
  if (!isSpeechRecognitionSupported()) {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return null;
    const recognition = new SpeechRec();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US'; // Broadest accuracy for elementary English speech

    // Store accumulated final transcripts across speech events
    let accumulatedFinal = '';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      try {
        let currentInterim = '';
        let currentFinal = '';

        for (let i = 0; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item && item[0]) {
            if (item.isFinal) {
              currentFinal += item[0].transcript + ' ';
            } else {
              currentInterim += item[0].transcript;
            }
          }
        }

        const rawCombined = (currentFinal + currentInterim).trim();
        const formatted = formatSpeechText(rawCombined);
        const hasFinal = Boolean(currentFinal.trim());
        onResult(formatted || rawCombined, hasFinal);
      } catch (e) {
        console.warn('Speech onresult error:', e);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      onError(event.error || '音声認識エラーが発生しました');
    };

    recognition.onend = () => {
      onEnd();
    };

    return recognition;
  } catch (err) {
    console.warn('SpeechRecognition instantiation error:', err);
    return null;
  }
}

/**
 * Count words in an English sentence
 */
export function countEnglishWords(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  const cleaned = text.trim().replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, '');
  const words = cleaned.split(/\s+/).filter((w) => w.length > 0);
  return words.length;
}

/**
 * Format speech recognition text: capitalization, contractions, proper nouns, sentence boundaries, and punctuation
 */
export function formatSpeechText(text: string): string {
  if (!text) return '';
  let trimmed = text.trim();
  if (trimmed.length === 0) return '';

  // Expand / fix common contractions
  trimmed = trimmed.replace(/\bi\s*m\b/gi, "I'm");
  trimmed = trimmed.replace(/\bi\s*d\b/gi, "I'd");
  trimmed = trimmed.replace(/\bi\s*ll\b/gi, "I'll");
  trimmed = trimmed.replace(/\bi\s*ve\b/gi, "I've");
  trimmed = trimmed.replace(/\bi\b/g, 'I');

  // Insert periods or question marks before new sentence starters if no punctuation exists
  // e.g. "I like sushi what food do you like" -> "I like sushi. What food do you like"
  const sentenceStarters = [
    'what', 'where', 'who', 'how', 'when', 'why',
    'do you', 'can you', 'are you', 'is it',
    'my name is', 'my favorite', 'my favourite',
    'i like', 'i love', 'i can', 'i play', 'i want', "i'm", 'i am',
    'nice to meet you', 'hello', 'hi'
  ];

  // Tokenize or separate sentences intelligently
  for (const starter of sentenceStarters) {
    const regex = new RegExp(`(?<=[a-zA-Z0-9])\\s+(${starter})\\b`, 'gi');
    trimmed = trimmed.replace(regex, (match, p1, offset, fullStr) => {
      // Check if previous character before space was already punctuation
      const beforeMatch = fullStr.slice(0, offset).trim();
      const lastC = beforeMatch.slice(-1);
      if (lastC === '.' || lastC === '?' || lastC === '!' || lastC === ',') {
        return ` ${p1}`;
      }
      const lowerBefore = beforeMatch.toLowerCase();
      if (
        lowerBefore.startsWith('what') ||
        lowerBefore.startsWith('where') ||
        lowerBefore.startsWith('how') ||
        lowerBefore.startsWith('do you') ||
        lowerBefore.startsWith('can you')
      ) {
        return `? ${p1}`;
      }
      return `. ${p1}`;
    });
  }

  // Capitalize after every sentence boundary (. or ? or !)
  trimmed = trimmed.replace(/(?:^|[.?!]\s+)([a-z])/g, (match, letter) => match.toUpperCase());

  // Capitalize common proper nouns, country names, city names
  const properNouns = [
    'japan', 'shizuoka', 'hamamatsu', 'tokyo', 'mt. fuji', 'fuji',
    'oliver', 'emma', 'liam', 'chloe', 'bence', 'zofia', 'rahul', 'linh', 'aung', 'ken', 'yuki', 'taro', 'hanako',
    'uk', 'usa', 'australia', 'canada', 'hungary', 'poland', 'bangladesh', 'vietnam', 'myanmar',
    'oxford', 'california', 'sydney', 'toronto', 'budapest', 'warsaw', 'dhaka', 'hanoi', 'yangon'
  ];
  properNouns.forEach((noun) => {
    const regex = new RegExp(`\\b${noun}\\b`, 'gi');
    trimmed = trimmed.replace(regex, (match) => {
      if (match.toLowerCase() === 'uk' || match.toLowerCase() === 'usa') return match.toUpperCase();
      if (match.toLowerCase() === 'mt. fuji') return 'Mt. Fuji';
      return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
    });
  });

  // Ensure overall final end punctuation (. or ?)
  const lastChar = trimmed.slice(-1);
  if (lastChar !== '.' && lastChar !== '?' && lastChar !== '!') {
    const sentences = trimmed.split(/[.?!]\s+/);
    const lastSentence = sentences[sentences.length - 1].toLowerCase().trim();
    if (
      lastSentence.startsWith('what') ||
      lastSentence.startsWith('where') ||
      lastSentence.startsWith('who') ||
      lastSentence.startsWith('how') ||
      lastSentence.startsWith('do you') ||
      lastSentence.startsWith('can you') ||
      lastSentence.startsWith('is') ||
      lastSentence.startsWith('are') ||
      lastSentence.startsWith('what is') ||
      lastSentence.endsWith('how about you') ||
      lastSentence.endsWith('and you')
    ) {
      trimmed += '?';
    } else {
      trimmed += '.';
    }
  }

  return trimmed;
}


