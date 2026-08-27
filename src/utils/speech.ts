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

interface PersonaVoiceConfig {
  preferredNames: string[];
  fallbackLang: string;
  defaultPitch: number;
  defaultRate: number;
}

const PERSONA_VOICE_MAP: Record<string, PersonaVoiceConfig> = {
  oliver_uk: { preferredNames: ['daniel', 'oliver', 'george', 'arthur', 'ryan', 'uk english male', 'en-gb'], fallbackLang: 'en-GB', defaultPitch: 1.06, defaultRate: 0.90 },
  emma_usa: { preferredNames: ['samantha', 'eva', 'victoria', 'jenny', 'ava', 'zira', 'us english female', 'en-us'], fallbackLang: 'en-US', defaultPitch: 1.26, defaultRate: 0.96 },
  liam_australia: { preferredNames: ['lee', 'russell', 'australian', 'au male', 'en-au'], fallbackLang: 'en-AU', defaultPitch: 0.98, defaultRate: 0.92 },
  chloe_canada: { preferredNames: ['clara', 'linda', 'karen', 'canadian', 'en-ca'], fallbackLang: 'en-CA', defaultPitch: 1.20, defaultRate: 0.88 },
  bence_hungary: { preferredNames: ['alex', 'fred', 'tom', 'guy', 'brian'], fallbackLang: 'en-US', defaultPitch: 0.94, defaultRate: 0.86 },
  zofia_poland: { preferredNames: ['moira', 'fiona', 'tessa', 'serena', 'stephanie'], fallbackLang: 'en-GB', defaultPitch: 1.30, defaultRate: 0.94 },
  rahul_bangladesh: { preferredNames: ['rishi', 'veena', 'neerja', 'prabhat', 'en-in'], fallbackLang: 'en-IN', defaultPitch: 1.10, defaultRate: 0.92 },
  linh_vietnam: { preferredNames: ['karen', 'sangeeta', 'allison', 'kathy', 'anna'], fallbackLang: 'en-US', defaultPitch: 1.36, defaultRate: 0.90 },
  aung_myanmar: { preferredNames: ['david', 'george', 'richard', 'alan', 'en-gb'], fallbackLang: 'en-GB', defaultPitch: 0.92, defaultRate: 0.85 },
};

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
  const isFemale = student.gender === 'female';
  const femaleKeywords = ['female', 'woman', 'girl', 'samantha', 'victoria', 'karen', 'zira', 'moira', 'fiona', 'eva', 'susan', 'jenny', 'ava', 'clara', 'tessa', 'anna', 'linda'];
  const maleKeywords = ['male', 'man', 'boy', 'daniel', 'oliver', 'george', 'david', 'alex', 'tom', 'fred', 'russell', 'lee', 'guy', 'brian', 'rishi', 'richard'];

  const matchesGender = (voiceName: string) => {
    const vName = voiceName.toLowerCase();
    if (isFemale) {
      if (femaleKeywords.some((k) => vName.includes(k))) return true;
      if (maleKeywords.some((k) => vName.includes(k))) return false;
      return true;
    }
    if (maleKeywords.some((k) => vName.includes(k))) return true;
    if (femaleKeywords.some((k) => vName.includes(k))) return false;
    return true;
  };

  let selectedVoice: SpeechSynthesisVoice | null = null;
  for (const pref of config.preferredNames) {
    const found = voices.find((v) => v.name.toLowerCase().includes(pref) && matchesGender(v.name));
    if (found) { selectedVoice = found; break; }
  }
  if (!selectedVoice) {
    selectedVoice = voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(targetLang.toLowerCase()) && matchesGender(v.name)) || null;
  }
  if (!selectedVoice) selectedVoice = voices.find((v) => v.lang.toLowerCase().startsWith('en') && matchesGender(v.name)) || null;
  if (!selectedVoice) selectedVoice = voices.find((v) => v.lang.toLowerCase().startsWith('en')) || null;

  if (selectedVoice) {
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang;
  } else {
    utterance.lang = targetLang;
  }

  utterance.onstart = () => onStart?.();
  utterance.onend = () => onEnd?.();
  utterance.onerror = (err) => { console.warn('TTS error:', err); onError?.(err); onEnd?.(); };
  try { window.speechSynthesis.speak(utterance); }
  catch (e) { console.warn('Error initiating TTS speak:', e); onEnd?.(); }
  return utterance;
}

export function speakVocabularyWord(word: string, lang = 'en-US', onEnd?: () => void): SpeechSynthesisUtterance | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) { onEnd?.(); return null; }
  window.speechSynthesis.cancel();
  playChime('card');
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.rate = 0.82;
  utterance.pitch = 1.08;
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(lang.toLowerCase())) || voices.find((v) => v.lang.toLowerCase().startsWith('en')) || null;
  if (voice) utterance.voice = voice;
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  try { window.speechSynthesis.speak(utterance); } catch { onEnd?.(); }
  return utterance;
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

export function getStudentFarewellMessage(studentId: string): { english: string; japanese: string } {
  switch (studentId) {
    case 'oliver_uk': return { english: "Time is up! I was very happy to talk with you. Thank you, and see you again!", japanese: '時間になりました！あなたとお話しできてとても嬉しかったよ。ありがとう！またね！' };
    case 'emma_usa': return { english: "Time is up! I was so happy to talk with you today. Thank you, and see you soon!", japanese: '時間になりました！今日はあなたとお話しできてとても嬉しかったよ。ありがとう！またね！' };
    case 'liam_australia': return { english: "Time is up! I was really happy to chat with you. Thanks a lot, and see ya!", japanese: '時間になりました！あなたとお話しできて本当に嬉しかったよ。ありがとう！またね！' };
    case 'chloe_canada': return { english: "Time is up! I was very happy to talk with you. Thank you so much, and have a wonderful day!", japanese: '時間になりました！あなたとお話しできてとても嬉しかったです。ありがとう！素敵な一日をね！' };
    case 'bence_hungary': return { english: "Time is up! I was happy to talk with you today. Thank you! Szia, and see you next time!", japanese: '時間になりました！今日はあなたとお話しできて嬉しかったよ。ありがとう！Szia、またね！' };
    case 'zofia_poland': return { english: "Time is up! I was so happy to talk with you. Thank you! Cześć, and see you again!", japanese: '時間になりました！あなたとお話しできてとても嬉しかったよ。ありがとう！Cześć、またね！' };
    case 'rahul_bangladesh': return { english: "Time is up! I was very happy to talk with you, my friend. Thank you, and have a wonderful day!", japanese: '時間になりました！友だちとしてあなたとお話しできてとても嬉しかったよ。ありがとう！素敵な一日を！' };
    case 'linh_vietnam': return { english: "Time is up! I was really happy to talk with you today. Thank you! See you soon!", japanese: '時間になりました！今日はあなたとお話しできて本当に嬉しかったよ。ありがとう！またね！' };
    case 'aung_myanmar': return { english: "Time is up! I was very happy to talk with you. Thank you for our lovely chat. See you!", japanese: '時間になりました！あなたとお話しできてとても嬉しかったよ。楽しいお話をありがとう！またね！' };
    default: return { english: "Time is up! I was very happy to talk with you today. Thank you, and see you next time!", japanese: '時間になりました！今日はあなたとお話しできてとても嬉しかったよ。ありがとう！またね！' };
  }
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

export function accumulateSpeechResults(
  results: Array<{ transcript: string; isFinal: boolean }>,
  baseAccumulated: string = ''
): { combinedRaw: string; formatted: string; hasFinal: boolean } {
  let sessionFinal = '';
  let sessionInterim = '';
  for (const item of results) {
    if (item.isFinal) sessionFinal += (sessionFinal ? ' ' : '') + item.transcript.trim();
    else sessionInterim += (sessionInterim ? ' ' : '') + item.transcript.trim();
  }
  let fullCombined = baseAccumulated.trim();
  if (sessionFinal) fullCombined = (fullCombined ? fullCombined + ' ' : '') + sessionFinal;
  if (sessionInterim) fullCombined = (fullCombined ? fullCombined + ' ' : '') + sessionInterim;
  const formatted = formatSpeechText(fullCombined);
  return { combinedRaw: fullCombined, formatted, hasFinal: Boolean(sessionFinal.trim()) };
}

export function rebuildSpeechRecognitionSnapshot(
  results: Array<{ transcript: string; isFinal: boolean }>
): { combinedRaw: string; formatted: string; hasFinal: boolean } {
  const pieces = results
    .map((item) => ({ transcript: String(item.transcript || '').trim(), isFinal: Boolean(item.isFinal) }))
    .filter((item) => item.transcript.length > 0);

  let combinedRaw = '';
  for (const item of pieces) {
    const piece = item.transcript;
    if (!combinedRaw) { combinedRaw = piece; continue; }
    const combinedLower = combinedRaw.toLowerCase();
    const pieceLower = piece.toLowerCase();
    if (pieceLower === combinedLower || pieceLower.startsWith(`${combinedLower} `)) { combinedRaw = piece; continue; }
    if (combinedLower.endsWith(pieceLower)) continue;

    const combinedWords = combinedRaw.split(/\s+/);
    const pieceWords = piece.split(/\s+/);
    let overlap = 0;
    for (let size = Math.min(combinedWords.length, pieceWords.length); size >= 1; size -= 1) {
      if (combinedWords.slice(-size).join(' ').toLowerCase() === pieceWords.slice(0, size).join(' ').toLowerCase()) { overlap = size; break; }
    }
    combinedRaw = [combinedRaw, pieceWords.slice(overlap).join(' ')].filter(Boolean).join(' ');
  }

  const formatted = formatSpeechText(combinedRaw);
  return { combinedRaw, formatted, hasFinal: pieces.some((item) => item.isFinal) };
}

export function createSpeechRecognitionInstance(
  onResult: (text: string, isFinal: boolean) => void,
  onError: (error: string) => void,
  onEnd: () => void
) {
  if (!isSpeechRecognitionSupported()) return null;

  try {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return null;
    const recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    const isAndroidDevice = /Android/i.test(window.navigator?.userAgent || '');
    let stopRequested = false;
    let hasRecognizedText = false;
    const nativeStop = recognition.stop.bind(recognition);
    recognition.stop = () => {
      stopRequested = true;
      return nativeStop();
    };

    recognition.onresult = (event: any) => {
      try {
        const resultsArray: Array<{ transcript: string; isFinal: boolean }> = [];
        for (let i = 0; i < event.results.length; ++i) {
          const item = event.results[i];
          if (!item || !item[0]) continue;
          resultsArray.push({ transcript: String(item[0].transcript || ''), isFinal: Boolean(item.isFinal) });
        }
        const { formatted, combinedRaw, hasFinal } = rebuildSpeechRecognitionSnapshot(resultsArray);
        const currentText = formatted || combinedRaw;
        if (currentText.trim()) hasRecognizedText = true;
        onResult(currentText, hasFinal);
      } catch (e) {
        console.warn('Speech onresult error:', e);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      onError(event.error || '音声認識エラーが発生しました');
    };

    recognition.onend = () => {
      if (isAndroidDevice && !stopRequested && hasRecognizedText) {
        // Android Chrome may close recognition after a short pause. Do not tell
        // App.tsx that recording ended: keeping the existing recording state
        // preserves the visible transcript, and the next tap uses the normal
        // stop/send path. Other browsers and intentional stops remain unchanged.
        return;
      }
      onEnd();
    };

    return recognition;
  } catch (err) {
    console.warn('SpeechRecognition instantiation error:', err);
    return null;
  }
}

export function countEnglishWords(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  const cleaned = text.trim().replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, '');
  return cleaned.split(/\s+/).filter((w) => w.length > 0).length;
}

export function formatSpeechText(text: string): string {
  if (!text) return '';
  let trimmed = text.trim();
  if (trimmed.length === 0) return '';
  trimmed = trimmed.replace(/\bi\s*m\b/gi, "I'm");
  trimmed = trimmed.replace(/\bi\s*d\b/gi, "I'd");
  trimmed = trimmed.replace(/\bi\s*ll\b/gi, "I'll");
  trimmed = trimmed.replace(/\bi\s*ve\b/gi, "I've");
  trimmed = trimmed.replace(/\bi\b/g, 'I');

  const sentenceStarters = ['what', 'where', 'who', 'how', 'when', 'why', 'my name is', 'my favorite', 'my favourite', 'i like', 'i love', 'i can', 'i play', 'i want', "i'm", 'i am', 'nice to meet you', 'hello', 'hi'];
  for (const starter of sentenceStarters) {
    const regex = new RegExp(`(?<=[a-zA-Z0-9])\\s+(${starter})\\b`, 'gi');
    trimmed = trimmed.replace(regex, (match, p1, offset, fullStr) => {
      const beforeMatch = fullStr.slice(0, offset).trim();
      const lastC = beforeMatch.slice(-1);
      if (lastC === '.' || lastC === '?' || lastC === '!' || lastC === ',') return ` ${p1}`;
      const lowerBefore = beforeMatch.toLowerCase();
      if (lowerBefore.startsWith('what') || lowerBefore.startsWith('where') || lowerBefore.startsWith('who') || lowerBefore.startsWith('how') || lowerBefore.startsWith('when') || lowerBefore.startsWith('why') || lowerBefore.startsWith('do you') || lowerBefore.startsWith('can you') || lowerBefore.startsWith('are you')) return `? ${p1}`;
      return `. ${p1}`;
    });
  }

  trimmed = trimmed.replace(/(?:^|[.?!]\s+)([a-z])/g, (match) => match.toUpperCase());
  trimmed = trimmed.replace(/\bmt\.?\s*fuji\b/gi, 'Mt. Fuji');
  trimmed = trimmed.replace(/\buk\b/gi, 'UK');
  trimmed = trimmed.replace(/\busa\b/gi, 'USA');

  const properNouns = ['japan', 'shizuoka', 'hamamatsu', 'tokyo', 'fuji', 'oliver', 'emma', 'liam', 'chloe', 'bence', 'zofia', 'rahul', 'linh', 'aung', 'ken', 'yuki', 'taro', 'hanako', 'australia', 'canada', 'hungary', 'poland', 'bangladesh', 'vietnam', 'myanmar', 'oxford', 'california', 'sydney', 'toronto', 'budapest', 'warsaw', 'dhaka', 'hanoi', 'yangon'];
  properNouns.forEach((noun) => {
    const regex = new RegExp(`\\b${noun}\\b`, 'gi');
    trimmed = trimmed.replace(regex, (match) => match.charAt(0).toUpperCase() + match.slice(1).toLowerCase());
  });

  const lastChar = trimmed.slice(-1);
  if (lastChar !== '.' && lastChar !== '?' && lastChar !== '!') {
    const sentences = trimmed.split(/[.?!]\s+/);
    const lastSentence = sentences[sentences.length - 1].toLowerCase().trim();
    if (lastSentence.startsWith('what') || lastSentence.startsWith('where') || lastSentence.startsWith('who') || lastSentence.startsWith('how') || lastSentence.startsWith('do you') || lastSentence.startsWith('can you') || lastSentence.startsWith('is') || lastSentence.startsWith('are') || lastSentence.startsWith('what is') || lastSentence.endsWith('how about you') || lastSentence.endsWith('and you')) trimmed += '?';
    else trimmed += '.';
  }
  return trimmed;
}
