import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { SetupScreen } from './components/SetupScreen';
import { AIStudentCard } from './components/AIStudentCard';
import { DialogueView } from './components/DialogueView';
import { SpeechInputBar } from './components/SpeechInputBar';
import { FeedbackScreen } from './components/FeedbackScreen';
import { VisualVocabularyDock } from './components/VisualVocabularyDock';
import {
  ChatMessage,
  CharacterMood,
  FeedbackData,
  StudentProfile,
  AIStudentProfile,
  VisualVocabularyItem,
} from './types';
import { DIALOGUE_TOPICS, getAIStudentById } from './data/curriculum';
import { detectVocabularyInText } from './data/vocabulary';
import {
  generateFallbackFeedback,
} from './utils/feedbackFallback';
import {
  speakStudentVoice,
  speakVocabularyWord,
  stopSpeaking,
  playChime,
  createSpeechRecognitionInstance,
  countEnglishWords,
  getStudentFarewellMessage,
} from './utils/speech';
import { STARTER_PROMPTS_JAPANESE } from './utils/translation';
import { motion, AnimatePresence } from 'motion/react';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

export default function App() {
  // App Phase
  const [phase, setPhase] = useState<'setup' | 'dialogue' | 'feedback'>('setup');

  // Student Profile & Settings
  const [profile, setProfile] = useState<StudentProfile>({
    name: '5・6年生',
    grade: '小学校５・６年生',
    selectedDurationMinutes: 1,
    selectedTopic: 'intro',
    selectedAiStudentId: 'emma_usa',
  });

  // Current selected AI Student Persona
  const currentAiStudent = getAIStudentById(profile.selectedAiStudentId);

  // Conversation Messages
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [turnCount, setTurnCount] = useState<number>(0);
  const [totalChildWords, setTotalChildWords] = useState<number>(0);

  // Visual Vocabulary Builder State
  const [encounteredVocabList, setEncounteredVocabList] = useState<VisualVocabularyItem[]>([]);
  const [latestVocabItem, setLatestVocabItem] = useState<VisualVocabularyItem | null>(null);

  // Timer
  const [remainingSeconds, setRemainingSeconds] = useState<number>(60);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Character States
  const [mood, setMood] = useState<CharacterMood>('greeting');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isAiResponding, setIsAiResponding] = useState<boolean>(false);
  const [latestCulturalNote, setLatestCulturalNote] = useState<string>('');

  // Speech Recognition
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [speechTranscript, setSpeechTranscript] = useState<string>('');
  const liveTranscriptRef = useRef<string>('');
  const [micHintMessage, setMicHintMessage] = useState<string>('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // Farewell banner at dialogue completion
  const [farewellBanner, setFarewellBanner] = useState<{ english: string; japanese: string } | null>(null);
  const farewellTransitionRef = useRef<(() => void) | null>(null);
  const farewellSafetyTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Feedback Data
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState<boolean>(false);

  // Synchronized Mutable Refs to guarantee latest state in all callbacks and timer intervals
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  const profileRef = useRef<StudentProfile>(profile);
  profileRef.current = profile;

  const turnCountRef = useRef<number>(turnCount);
  turnCountRef.current = turnCount;

  const totalChildWordsRef = useRef<number>(totalChildWords);
  totalChildWordsRef.current = totalChildWords;

  const encounteredVocabRef = useRef<VisualVocabularyItem[]>(encounteredVocabList);
  encounteredVocabRef.current = encounteredVocabList;

  const elapsedSecondsRef = useRef<number>(elapsedSeconds);
  elapsedSecondsRef.current = elapsedSeconds;

  const currentAiStudentRef = useRef<AIStudentProfile>(currentAiStudent);
  currentAiStudentRef.current = currentAiStudent;

  const soundEnabledRef = useRef<boolean>(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  const speechRateRef = useRef<number>(speechRate);
  speechRateRef.current = speechRate;

  // A dialogue may finish while an AI request is still in flight.
  // Keep an imperative active flag and AbortController so a late response can never
  // append or speak after the farewell sequence has started.
  const dialogueActiveRef = useRef<boolean>(false);
  const chatAbortControllerRef = useRef<AbortController | null>(null);

  // Speak AI text with selected student's accent and voice
  const playAiVoice = useCallback(
    (text: string) => {
      if (!soundEnabledRef.current) return;
      setIsSpeaking(true);
      setMood('speaking');
      speakStudentVoice(
        text,
        currentAiStudentRef.current,
        speechRateRef.current,
        () => {
          setIsSpeaking(true);
          setMood('speaking');
        },
        () => {
          setIsSpeaking(false);
          setMood('greeting');
        },
        () => {
          setIsSpeaking(false);
          setMood('greeting');
        }
      );
    },
    []
  );

  // Helper to add vocabulary items from text
  const extractAndAddVocab = useCallback((text: string) => {
    const matched = detectVocabularyInText(text);
    if (matched.length > 0) {
      setEncounteredVocabList((prev) => {
        const existingIds = new Set(prev.map((v) => v.id));
        const newItems = matched.filter((m) => !existingIds.has(m.id));
        return [...prev, ...newItems];
      });
      setLatestVocabItem(matched[0]);
    }
  }, []);

  // Start Dialogue from Setup
  const handleStartDialogue = (newProfile: StudentProfile) => {
    chatAbortControllerRef.current?.abort();
    chatAbortControllerRef.current = null;
    dialogueActiveRef.current = true;
    setProfile(newProfile);
    profileRef.current = newProfile;
    const durationSec = newProfile.selectedDurationMinutes * 60;
    setRemainingSeconds(durationSec);
    setElapsedSeconds(0);
    elapsedSecondsRef.current = 0;
    setTurnCount(0);
    turnCountRef.current = 0;
    setTotalChildWords(0);
    totalChildWordsRef.current = 0;
    setFeedback(null);
    setEncounteredVocabList([]);
    encounteredVocabRef.current = [];
    setLatestVocabItem(null);
    setFarewellBanner(null);
    setMicHintMessage('');

    const studentObj = getAIStudentById(newProfile.selectedAiStudentId);
    currentAiStudentRef.current = studentObj;
    const starterPrompt =
      studentObj.topicPrompts[newProfile.selectedTopic] || studentObj.starterPromptDefault;

    // Detect starter vocabulary
    extractAndAddVocab(starterPrompt);

    const starterPromptJapanese =
      STARTER_PROMPTS_JAPANESE[newProfile.selectedAiStudentId]?.[newProfile.selectedTopic] ||
      studentObj.topicPromptsJapanese?.[newProfile.selectedTopic] ||
      `${studentObj.name}との英会話が始まりました！`;

    const starterMessage: ChatMessage = {
      id: `ai-start-${Date.now()}`,
      sender: 'ai',
      englishText: starterPrompt,
      japaneseText: starterPromptJapanese,
      timestamp: Date.now(),
      culturalNote: `${studentObj.countryJapanese}の留学生 ${studentObj.name} です！`,
    };

    const initialHistory = [starterMessage];
    setMessages(initialHistory);
    messagesRef.current = initialHistory;
    setLatestCulturalNote(`${studentObj.countryJapanese}の留学生 ${studentObj.name} です！`);
    setPhase('dialogue');

    // Play starter audio after a brief moment
    setTimeout(() => {
      if (dialogueActiveRef.current && soundEnabledRef.current) {
        setIsSpeaking(true);
        setMood('speaking');
        speakStudentVoice(
          starterPrompt,
          studentObj,
          speechRateRef.current,
          () => setIsSpeaking(true),
          () => {
            setIsSpeaking(false);
            setMood('greeting');
          },
          () => {
            setIsSpeaking(false);
            setMood('greeting');
          }
        );
      }
    }, 600);
  };

  // Timer Effect during Dialogue
  useEffect(() => {
    if (phase !== 'dialogue') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleFinishDialogue();
          return 0;
        }
        return prev - 1;
      });
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        elapsedSecondsRef.current = next;
        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  // Stop recording helper
  const stopRecordingInternal = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn('Recognition stop error', e);
      }
    }
    setIsRecording(false);
    setIsListening(false);
  };

  // Send message to AI Student
  const handleSendMessage = async (text: string) => {
    // 1. Guard: Check phase and active timer
    if (!dialogueActiveRef.current || phase !== 'dialogue' || remainingSeconds <= 0 || !text.trim() || isAiResponding) {
      return;
    }

    if (isRecording) {
      stopRecordingInternal();
    }

    const trimmed = text.trim();

    // 2. Length check (Max 100 characters for Grade 5 dialogue)
    if (trimmed.length > 100) {
      setMicHintMessage('文が少し長いです！もう少し短い英語で話してみてね。');
      setTimeout(() => setMicHintMessage(''), 4000);
      return;
    }

    playChime('pop');
    setMicHintMessage('');

    // Detect spoken name if child introduced themselves
    const spokenNameMatch = trimmed.match(/\b(?:my name is|i'm|i am|call me)\s+([A-Za-z]{2,15})\b/i);
    if (spokenNameMatch) {
      const candidate = spokenNameMatch[1].trim();
      const capitalized = candidate.charAt(0).toUpperCase() + candidate.slice(1).toLowerCase();
      const nonNameWords = [
        'in', 'from', 'ten', 'eleven', 'twelve', 'fine', 'good', 'happy', 'ready',
        'fifth', 'sixth', 'student', 'boy', 'girl', 'japanese', 'japan', 'not', 'very'
      ];
      if (!nonNameWords.includes(candidate.toLowerCase())) {
        setProfile((prev) => ({ ...prev, name: capitalized }));
        profileRef.current = { ...profileRef.current, name: capitalized };
      }
    }

    // Detect vocabulary in child's speech too
    extractAndAddVocab(trimmed);

    const words = countEnglishWords(trimmed);
    const childMsg: ChatMessage = {
      id: `child-${Date.now()}`,
      sender: 'child',
      englishText: trimmed,
      japaneseText: '',
      timestamp: Date.now(),
      wordCount: words,
    };

    const newHistory = [...messagesRef.current, childMsg];
    setMessages(newHistory);
    messagesRef.current = newHistory;

    const nextTurnCount = turnCountRef.current + 1;
    turnCountRef.current = nextTurnCount;
    setTurnCount(nextTurnCount);

    const nextTotalWords = totalChildWordsRef.current + words;
    totalChildWordsRef.current = nextTotalWords;
    setTotalChildWords(nextTotalWords);

    setSpeechTranscript('');
    liveTranscriptRef.current = '';
    setIsAiResponding(true);
    setMood('thinking');

    const controller = new AbortController();
    chatAbortControllerRef.current = controller;

    try {
      const currentProf = profileRef.current;
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: trimmed,
          history: newHistory,
          topic: currentProf.selectedTopic,
          studentName: currentProf.name,
          aiStudentId: currentProf.selectedAiStudentId,
        }),
      });

      const resData = await response.json();

      // The timer/end button may have closed the dialogue while fetch was pending.
      // In that case the response is stale and must never reach history or TTS.
      if (
        !dialogueActiveRef.current ||
        controller.signal.aborted ||
        chatAbortControllerRef.current !== controller
      ) {
        return;
      }

      if (resData.success && resData.data) {
        const {
          reply,
          japaneseTranslation,
          studentJapaneseTranslation,
          studentTranslationStatus,
          mood: aiMood,
          culturalNote,
        } = resData.data;

        // Detect vocabulary in AI's reply
        extractAndAddVocab(reply);

        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          englishText: reply,
          japaneseText: japaneseTranslation,
          timestamp: Date.now(),
          culturalNote: culturalNote || undefined,
        };

        const translatedHistory = messagesRef.current.map((message) => {
          if (message.id !== childMsg.id) return message;
          if (studentTranslationStatus === 'incomplete') {
            return { ...message, japaneseText: '日本語に訳せませんでした。' };
          }
          if (
            typeof studentJapaneseTranslation === 'string' &&
            studentJapaneseTranslation.trim().length > 0
          ) {
            return { ...message, japaneseText: studentJapaneseTranslation.trim() };
          }
          return { ...message, japaneseText: '日本語に訳せませんでした。' };
        });
        const updatedHistory = [...translatedHistory, aiMsg];
        setMessages(updatedHistory);
        messagesRef.current = updatedHistory;

        setMood((aiMood as CharacterMood) || 'speaking');
        if (culturalNote) {
          setLatestCulturalNote(culturalNote);
        }

        // Automatic Text-to-Speech readout in student's voice
        playAiVoice(reply);
      } else {
        throw new Error('API response unsuccessful, switching to local engine');
      }
    } catch (e) {
      const wasAborted = (e as { name?: string })?.name === 'AbortError' || controller.signal.aborted;
      if (!wasAborted && dialogueActiveRef.current) {
        console.error('AI backend unavailable; no conversation fallback will be generated:', e);
        setMood('listening');
        setMicHintMessage('AI留学生に接続できませんでした。もう一度送ってみてね。');
        setTimeout(() => setMicHintMessage(''), 5000);
      }
    } finally {
      if (chatAbortControllerRef.current === controller) {
        chatAbortControllerRef.current = null;
      }
      if (dialogueActiveRef.current) {
        setIsAiResponding(false);
      }
    }
  };

  // Toggle speech recording (1 click: start talking -> 2nd click: finish & send to AI turn)
  const handleToggleRecording = () => {
    if (isRecording) {
      playChime('stop');
      stopRecordingInternal();

      const spokenText = (liveTranscriptRef.current || speechTranscript).trim();
      if (spokenText.length > 0) {
        handleSendMessage(spokenText);
        liveTranscriptRef.current = '';
        setSpeechTranscript('');
      } else {
        setMicHintMessage('英語が聞き取れませんでした。もう1度マイクをクリックしてお話ししてみてね！');
        setTimeout(() => setMicHintMessage(''), 4000);
      }
    } else {
      // Stop any AI audio
      stopSpeaking();
      setIsSpeaking(false);
      setMicHintMessage('');

      playChime('start');
      liveTranscriptRef.current = '';
      setSpeechTranscript('');
      setIsRecording(true);
      setIsListening(true);

      const recognition = createSpeechRecognitionInstance(
        (text, isFinal) => {
          liveTranscriptRef.current = text;
          setSpeechTranscript(text);
        },
        (err) => {
          console.warn('Speech Rec Error:', err);
          setIsRecording(false);
          setIsListening(false);
        },
        () => {
          setIsRecording(false);
          setIsListening(false);
        }
      );

      if (recognition) {
        recognitionRef.current = recognition;
        try {
          recognition.start();
        } catch (e) {
          console.warn('Speech Rec start error:', e);
          setIsRecording(false);
          setIsListening(false);
        }
      } else {
        setMicHintMessage('お使いのブラウザ環境では音声認識が制限されています。下のテキスト入力欄からも発話できます！');
        setIsRecording(false);
        setIsListening(false);
        setTimeout(() => setMicHintMessage(''), 5000);
      }
    }
  };

  // Immediate transition to report screen
  const handleSkipFarewell = useCallback(() => {
    if (farewellTransitionRef.current) {
      farewellTransitionRef.current();
    } else {
      stopSpeaking();
      if (farewellSafetyTimerRef.current) {
        clearTimeout(farewellSafetyTimerRef.current);
        farewellSafetyTimerRef.current = null;
      }
      setFarewellBanner(null);
      playChime('fanfare');
      setPhase('feedback');
    }
  }, []);

  // Finish dialogue, speak cheerful farewell greeting, then fetch feedback advice
  const handleFinishDialogue = async () => {
    if (phase !== 'dialogue' || !dialogueActiveRef.current) return;

    // Close the conversation synchronously before any farewell UI/audio starts.
    // This prevents a late /api/chat response from racing the farewell message.
    dialogueActiveRef.current = false;
    chatAbortControllerRef.current?.abort();
    chatAbortControllerRef.current = null;
    setIsAiResponding(false);
    stopSpeaking();
    stopRecordingInternal();
    if (timerRef.current) clearInterval(timerRef.current);
    if (farewellSafetyTimerRef.current) {
      clearTimeout(farewellSafetyTimerRef.current);
      farewellSafetyTimerRef.current = null;
    }

    // If there is any uncommitted spoken text in buffer, commit it
    const pendingText = (liveTranscriptRef.current || speechTranscript || '').trim();
    let currentHistory = [...messagesRef.current];

    if (
      pendingText.length > 0 &&
      !currentHistory.some((m) => m.sender === 'child' && m.englishText.trim() === pendingText)
    ) {
      extractAndAddVocab(pendingText);
      const words = countEnglishWords(pendingText);
      const pendingChildMsg: ChatMessage = {
        id: `child-${Date.now()}`,
        sender: 'child',
        englishText: pendingText,
        japaneseText: '日本語に訳せませんでした。',
        timestamp: Date.now(),
        wordCount: words,
      };
      currentHistory = [...currentHistory, pendingChildMsg];
      turnCountRef.current += 1;
      totalChildWordsRef.current += words;
      setTurnCount(turnCountRef.current);
      setTotalChildWords(totalChildWordsRef.current);
      setSpeechTranscript('');
      liveTranscriptRef.current = '';
    }

    const currentProf = profileRef.current;
    const studentObj = getAIStudentById(currentProf.selectedAiStudentId);
    const farewell = getStudentFarewellMessage(studentObj.id);
    setFarewellBanner(farewell);

    const farewellMsg: ChatMessage = {
      id: `ai-farewell-${Date.now()}`,
      sender: 'ai',
      englishText: farewell.english,
      japaneseText: farewell.japanese,
      timestamp: Date.now(),
      culturalNote: '時間になりました！お疲れさまでした！',
    };

    const finalMessages = [...currentHistory, farewellMsg];
    setMessages(finalMessages);
    messagesRef.current = finalMessages;

    setIsSpeaking(true);
    setMood('happy');
    setIsLoadingFeedback(true);

    // Fetch feedback in parallel with timeout safety
    const fetchFeedbackData = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20-second timeout

        const response = await fetch(apiUrl('/api/feedback'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            history: finalMessages,
            studentName: currentProf.name,
            durationMinutes: currentProf.selectedDurationMinutes,
            turns: turnCountRef.current,
            totalWords: totalChildWordsRef.current,
            aiStudentId: currentProf.selectedAiStudentId,
            encounteredVocab: encounteredVocabRef.current,
          }),
        });
        clearTimeout(timeoutId);

        const resData = await response.json();
        if (resData.success && resData.data) {
          setFeedback(resData.data);
        } else {
          throw new Error('Invalid feedback response');
        }
      } catch (e) {
        console.warn('Feedback API fetch issue, utilizing local rich fallback:', e);
        setFeedback(
          generateFallbackFeedback(
            studentObj,
            currentProf.name,
            turnCountRef.current,
            totalChildWordsRef.current,
            elapsedSecondsRef.current,
            currentProf.selectedDurationMinutes,
            encounteredVocabRef.current,
            finalMessages
          )
        );
      } finally {
        setIsLoadingFeedback(false);
      }
    };

    fetchFeedbackData();

    // Transition helper to prevent duplicate triggers
    let hasTransitioned = false;
    const executeTransition = () => {
      if (hasTransitioned) return;
      hasTransitioned = true;
      stopSpeaking();
      if (farewellSafetyTimerRef.current) {
        clearTimeout(farewellSafetyTimerRef.current);
        farewellSafetyTimerRef.current = null;
      }
      farewellTransitionRef.current = null;
      setFarewellBanner(null);
      playChime('fanfare');
      setPhase('feedback');
    };

    farewellTransitionRef.current = executeTransition;

    // Auto-advance safety timer (4.5 seconds max for farewell overlay)
    farewellSafetyTimerRef.current = setTimeout(() => {
      executeTransition();
    }, 4500);

    // Speak farewell greeting in persona's voice -> Transition IMMEDIATELY upon speech completion
    speakStudentVoice(
      farewell.english,
      studentObj,
      speechRateRef.current,
      () => {
        setIsSpeaking(true);
        setMood('happy');
      },
      () => {
        // Speech ended normally -> transition to feedback screen immediately
        setIsSpeaking(false);
        executeTransition();
      },
      () => {
        // Error or interrupted -> transition to feedback screen immediately
        setIsSpeaking(false);
        executeTransition();
      }
    );
  };

  const handleRestart = () => {
    dialogueActiveRef.current = false;
    chatAbortControllerRef.current?.abort();
    chatAbortControllerRef.current = null;
    stopSpeaking();
    stopRecordingInternal();
    if (farewellSafetyTimerRef.current) {
      clearTimeout(farewellSafetyTimerRef.current);
      farewellSafetyTimerRef.current = null;
    }
    farewellTransitionRef.current = null;
    setPhase('setup');
    setMessages([]);
    setTurnCount(0);
    setTotalChildWords(0);
    setEncounteredVocabList([]);
    setLatestVocabItem(null);
    setLatestCulturalNote('');
    setFarewellBanner(null);
    setMicHintMessage('');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 flex flex-col">
      {/* 1. Setup Screen */}
      {phase === 'setup' && <SetupScreen onStartDialogue={handleStartDialogue} />}

      {/* 2. Live Dialogue Screen with Bento Grid */}
      {phase === 'dialogue' && (
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          {/* Header Bar */}
          <Header
            studentName={profile.name}
            aiStudentName={currentAiStudent.name}
            aiStudentFlag={currentAiStudent.flag}
            remainingSeconds={remainingSeconds}
            totalDurationSeconds={profile.selectedDurationMinutes * 60}
            turnCount={turnCount}
            wordCount={totalChildWords}
            soundEnabled={soundEnabled}
            onToggleSound={() => {
              if (soundEnabled) stopSpeaking();
              setSoundEnabled(!soundEnabled);
            }}
            onFinishEarly={handleFinishDialogue}
          />

          {/* Main 12-column Bento Grid */}
          <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 lg:p-5 grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-5 overflow-hidden">
            {/* Left Column (3 cols): Student Card & Session Stats */}
            <div className="col-span-12 md:col-span-4 lg:col-span-3 flex flex-col gap-4 overflow-y-auto">
              {/* Bento 1: AI Student Avatar Card */}
              <AIStudentCard
                student={currentAiStudent}
                mood={mood}
                isSpeaking={isSpeaking}
                isListening={isListening}
                speechRate={speechRate}
                latestAiMessage={
                  messages.filter((m) => m.sender === 'ai').slice(-1)[0]?.englishText
                }
                latestCulturalNote={latestCulturalNote}
                onReplayAudio={() => {
                  const lastAi = messages.filter((m) => m.sender === 'ai').slice(-1)[0];
                  if (lastAi) playAiVoice(lastAi.englishText);
                }}
                onChangeSpeechRate={(rate) => setSpeechRate(rate)}
              />

              {/* Bento 2: Dark Session Stats Bento Box */}
              <div className="bg-slate-800 p-5 rounded-3xl text-white flex flex-col justify-between shadow-sm">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Session Stats (対話記録)
                  </p>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-300">Turns (ターン数)</span>
                    <span className="font-mono font-bold text-lg text-white">
                      {turnCount < 10 ? `0${turnCount}` : turnCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-300">Total Words (発話語数)</span>
                    <span className="font-mono font-bold text-lg text-emerald-400">
                      {totalChildWords}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-300">Vocabulary (覚えた単語)</span>
                    <span className="font-mono font-bold text-lg text-amber-400">
                      {encounteredVocabList.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-300">Target Time</span>
                    <span className="font-mono font-bold text-sm text-slate-300">
                      {profile.selectedDurationMinutes} min
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleFinishDialogue}
                  className="mt-4 w-full border border-slate-600 hover:bg-slate-700 py-2.5 rounded-2xl text-xs font-bold text-slate-200 transition-colors cursor-pointer"
                >
                  対話を終了してふりかえり
                </button>
              </div>
            </div>

            {/* Center Column (6 cols): Conversation & Speech Input Stage + Visual Vocab Builder */}
            <div className="col-span-12 md:col-span-8 lg:col-span-6 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden h-full relative">
              {/* Live Visual Vocabulary Dock above dialogue */}
              <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                <VisualVocabularyDock
                  vocabularyList={encounteredVocabList}
                  latestItem={latestVocabItem}
                  onPlayWord={(word) => speakVocabularyWord(word, currentAiStudent.voiceLang)}
                />
              </div>

              {/* Dialogue Transcript Stream */}
              <DialogueView
                messages={messages}
                studentName={profile.name}
                aiStudent={currentAiStudent}
                isAiResponding={isAiResponding}
                onPlayAudio={playAiVoice}
              />

              {/* Mic Hint Banner if recognized empty */}
              <AnimatePresence>
                {micHintMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="mx-4 mb-2 bg-amber-50 border border-amber-300 rounded-xl p-2.5 text-xs font-bold text-amber-900 text-center shadow-xs"
                  >
                    {micHintMessage}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom 2-Click Speech Bar */}
              <SpeechInputBar
                isRecording={isRecording}
                transcript={speechTranscript}
                isAiResponding={isAiResponding}
                onToggleRecording={handleToggleRecording}
                onSendMessage={handleSendMessage}
                onClearTranscript={() => {
                  setSpeechTranscript('');
                  liveTranscriptRef.current = '';
                }}
              />
            </div>

            {/* Right Column (3 cols): Great Job Tips & Student Cultural Bento */}
            <div className="col-span-12 lg:col-span-3 hidden lg:flex flex-col gap-4 overflow-y-auto">
              {/* Bento 4: Great Job & Learning Checkpoints */}
              <div className="bg-emerald-50/80 p-5 rounded-3xl border border-emerald-200/80 shadow-sm flex-1 overflow-y-auto">
                <h3 className="text-sm font-bold text-emerald-900 mb-3 flex items-center gap-1.5">
                  <span className="text-base">🌟</span>
                  <span>Great Job! (今日のめあて)</span>
                </h3>

                <div className="space-y-2.5">
                  <div className="bg-white p-3 rounded-2xl border border-emerald-200/70 shadow-2xs">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-0.5">
                      Point 1: 挨拶しよう
                    </p>
                    <p className="text-xs font-semibold text-slate-800">
                      「Hello!」「Nice to meet you!」と笑顔で挨拶！
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-2xl border border-emerald-200/70 shadow-2xs">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-0.5">
                      Point 2: 好きを伝えよう
                    </p>
                    <p className="text-xs font-semibold text-slate-800">
                      「I like ~」「I can ~」で自分のことを話そう！
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-2xl border border-emerald-200/70 shadow-2xs">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-0.5">
                      Point 3: 聞き返そう
                    </p>
                    <p className="text-xs font-semibold text-slate-800">
                      「How about you?」と相手に質問を返してみよう！
                    </p>
                  </div>

                  <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 shadow-2xs mt-3">
                    <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-0.5">
                      💡 Challenge ({currentAiStudent.name})
                    </p>
                    <p className="text-xs font-semibold text-amber-950">
                      「{currentAiStudent.fillerWords[0]}」を聞き取れたら相槌を打ってみよう！
                    </p>
                  </div>
                </div>
              </div>

              {/* Bento 5: Country & Accent Mode Bento */}
              <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
                <div className="text-3xl mb-1">{currentAiStudent.flag}</div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {currentAiStudent.countryJapanese} ({currentAiStudent.accentName})
                </p>
                <p className="text-xs font-semibold text-blue-700 mt-1">
                  "{currentAiStudent.characteristicPhrases[0]?.phrase}" (
                  {currentAiStudent.characteristicPhrases[0]?.meaning})
                </p>
              </div>
            </div>
          </main>

          {/* Farewell Completion Overlay */}
          <AnimatePresence>
            {farewellBanner && (
              <div
                id="farewell-overlay"
                onClick={handleSkipFarewell}
                className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer select-none"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0, y: 10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSkipFarewell();
                  }}
                  className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl text-center border-4 border-amber-300 relative cursor-pointer hover:shadow-amber-200/50 transition-shadow"
                >
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-3xl sm:text-4xl">🎉</span>
                    <span className="text-3xl">{currentAiStudent.flag}</span>
                  </div>

                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-1">
                    Time is up! (対話終了)
                  </h2>
                  <p className="text-xs sm:text-sm font-bold text-slate-500 mb-4">
                    {currentAiStudent.japaneseName} ({currentAiStudent.countryJapanese}留学生) からのメッセージ
                  </p>

                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50/70 border border-blue-200/80 rounded-2xl p-4 sm:p-5 mb-5 text-left shadow-xs">
                    <div className="flex items-center gap-2 mb-1.5 text-blue-700">
                      <span className="text-sm font-bold animate-pulse">🔊</span>
                      <span className="text-xs font-bold uppercase tracking-wider">Farewell Message</span>
                    </div>
                    <p className="text-base sm:text-lg font-black text-blue-950 leading-snug mb-2">
                      "{farewellBanner.english}"
                    </p>
                    <p className="text-xs sm:text-sm font-bold text-slate-600 bg-white/80 p-2.5 rounded-xl border border-blue-100">
                      {farewellBanner.japanese}
                    </p>
                  </div>

                  {/* Instant Navigation Action Button */}
                  <button
                    id="farewell-next-btn"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSkipFarewell();
                    }}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-98 text-white font-bold py-3.5 px-6 rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer text-sm sm:text-base"
                  >
                    <span>📊</span>
                    <span>レポート・アドバイスを見る</span>
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-md ml-1">クリックで次へ ➔</span>
                  </button>

                  <p className="text-[11px] text-slate-400 font-semibold mt-3">
                    ※ 音声の読み上げ終了、または画面をクリックするとレポートへ移動します
                  </p>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* 3. Post-Dialogue Review & Advice Screen */}
      {phase === 'feedback' && (
        <FeedbackScreen
          profile={profile}
          messages={messages}
          feedback={feedback}
          isLoadingFeedback={isLoadingFeedback}
          totalTurns={turnCount}
          totalWords={totalChildWords}
          elapsedSeconds={elapsedSeconds}
          encounteredVocabList={encounteredVocabList}
          onPlayAudio={playAiVoice}
          onRestart={handleRestart}
        />
      )}
    </div>
  );
}
