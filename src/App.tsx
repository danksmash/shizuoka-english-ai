import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { SetupScreen } from './components/SetupScreen';
import { AIStudentCard } from './components/AIStudentCard';
import { DialogueView } from './components/DialogueView';
import { SpeechInputBar } from './components/SpeechInputBar';
import { FeedbackScreen } from './components/FeedbackScreen';
import { ReflectionScreen } from './components/ReflectionScreen';
import { LearningHistoryScreen, type StudentHistoryRow } from './components/LearningHistoryScreen';
import { VisualVocabularyDock } from './components/VisualVocabularyDock';
import {
  ChatMessage,
  CharacterMood,
  FeedbackData,
  StudentProfile,
  AIStudentProfile,
  VisualVocabularyItem,
} from './types';
import { getAIStudentById } from './data/curriculum';
import { detectVocabularyInText } from './data/vocabulary';
import { generateFallbackFeedback } from './utils/feedbackFallback';
import {
  speakStudentVoice,
  speakVocabularyWord,
  stopSpeaking,
  createSpeechRecognitionInstance,
  countEnglishWords,
  getStudentFarewellMessage,
} from './utils/speech';
import { STARTER_PROMPTS_JAPANESE } from './utils/translation';
import { motion, AnimatePresence } from 'motion/react';
import type { ReflectionAnswers } from './dataContract';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

export default function App() {
  const [phase, setPhase] = useState<'setup' | 'dialogue' | 'reflection' | 'feedback' | 'history'>('setup');
  const [profile, setProfile] = useState<StudentProfile>({
    name: '5・6年生',
    grade: '小学校５・６年生',
    selectedDurationMinutes: 1,
    selectedTopic: 'intro',
    selectedAiStudentId: 'emma_usa',
  });
  const currentAiStudent = getAIStudentById(profile.selectedAiStudentId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [turnCount, setTurnCount] = useState(0);
  const [totalChildWords, setTotalChildWords] = useState(0);
  const [encounteredVocabList, setEncounteredVocabList] = useState<VisualVocabularyItem[]>([]);
  const [latestVocabItem, setLatestVocabItem] = useState<VisualVocabularyItem | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(60);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [mood, setMood] = useState<CharacterMood>('greeting');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState('');
  const liveTranscriptRef = useRef('');
  const [micHintMessage, setMicHintMessage] = useState('');
  const recognitionRef = useRef<any>(null);
  const [farewellBanner, setFarewellBanner] = useState<{ english: string; japanese: string } | null>(null);
  const farewellTransitionRef = useRef<(() => void) | null>(null);
  const farewellSafetyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [learningDataEnabled, setLearningDataEnabled] = useState(false);
  const [learningCode, setLearningCode] = useState('');
  const [sessionId, setSessionId] = useState('');
  const sessionStartedAtRef = useRef(0);
  const sessionEndedAtRef = useRef(0);
  const [isSavingReflection, setIsSavingReflection] = useState(false);
  const [reflectionSaveMessage, setReflectionSaveMessage] = useState('');
  const [historyRows, setHistoryRows] = useState<StudentHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');


  const messagesRef = useRef(messages); messagesRef.current = messages;
  const profileRef = useRef(profile); profileRef.current = profile;
  const turnCountRef = useRef(turnCount); turnCountRef.current = turnCount;
  const totalChildWordsRef = useRef(totalChildWords); totalChildWordsRef.current = totalChildWords;
  const encounteredVocabRef = useRef(encounteredVocabList); encounteredVocabRef.current = encounteredVocabList;
  const elapsedSecondsRef = useRef(elapsedSeconds); elapsedSecondsRef.current = elapsedSeconds;
  const currentAiStudentRef = useRef<AIStudentProfile>(currentAiStudent); currentAiStudentRef.current = currentAiStudent;
  const soundEnabledRef = useRef(soundEnabled); soundEnabledRef.current = soundEnabled;
  const speechRateRef = useRef(speechRate); speechRateRef.current = speechRate;
  const dialogueActiveRef = useRef(false);
  const chatAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch(apiUrl('/api/health')).then((response) => response.json()).then((data) => {
      setLearningDataEnabled(Boolean(data?.learningDataConfigured));
    }).catch(() => setLearningDataEnabled(false));
  }, []);

  const validateLearningCode = useCallback(async (code: string): Promise<boolean> => {
    try {
      const response = await fetch(apiUrl('/api/student/resolve'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ learningCode: code }) });
      const data = await response.json();
      return response.ok && data?.success === true;
    } catch { return false; }
  }, []);

  const newSessionId = () => {
    const id = globalThis.crypto?.randomUUID?.();
    return id ? `session_${id.replace(/-/g, '')}` : `session_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  };

  const playAiVoice = useCallback((text: string) => {
    if (!soundEnabledRef.current) return;
    setIsSpeaking(true); setMood('speaking');
    speakStudentVoice(text, currentAiStudentRef.current, speechRateRef.current,
      () => { setIsSpeaking(true); setMood('speaking'); },
      () => { setIsSpeaking(false); setMood('greeting'); },
      () => { setIsSpeaking(false); setMood('greeting'); });
  }, []);

  const extractAndAddVocab = useCallback((text: string) => {
    const matched = detectVocabularyInText(text);
    if (matched.length > 0) {
      setEncounteredVocabList((prev) => {
        const existingIds = new Set(prev.map((v) => v.id));
        return [...prev, ...matched.filter((m) => !existingIds.has(m.id))];
      });
      setLatestVocabItem(matched[0]);
    }
  }, []);

  const handleStartDialogue = (newProfile: StudentProfile, code: string) => {
    chatAbortControllerRef.current?.abort();
    chatAbortControllerRef.current = null;
    dialogueActiveRef.current = true;
    setProfile(newProfile); profileRef.current = newProfile;
    setLearningCode(code); setSessionId(newSessionId()); sessionStartedAtRef.current = Date.now(); sessionEndedAtRef.current = 0;
    setReflectionSaveMessage('');
    const durationSec = newProfile.selectedDurationMinutes * 60;
    setRemainingSeconds(durationSec); setElapsedSeconds(0); elapsedSecondsRef.current = 0;
    setTurnCount(0); turnCountRef.current = 0;
    setTotalChildWords(0); totalChildWordsRef.current = 0;
    setFeedback(null); setEncounteredVocabList([]); encounteredVocabRef.current = [];
    setLatestVocabItem(null); setFarewellBanner(null); setMicHintMessage('');
    const studentObj = getAIStudentById(newProfile.selectedAiStudentId);
    currentAiStudentRef.current = studentObj;
    const starterPrompt = studentObj.topicPrompts[newProfile.selectedTopic] || studentObj.starterPromptDefault;
    extractAndAddVocab(starterPrompt);
    const starterPromptJapanese = STARTER_PROMPTS_JAPANESE[newProfile.selectedAiStudentId]?.[newProfile.selectedTopic] || studentObj.topicPromptsJapanese?.[newProfile.selectedTopic] || `${studentObj.name}との英会話が始まりました！`;
    const starterMessage: ChatMessage = { id: `ai-start-${Date.now()}`, sender: 'ai', englishText: starterPrompt, japaneseText: starterPromptJapanese, timestamp: Date.now(), culturalNote: `${studentObj.countryJapanese}の留学生 ${studentObj.name} です！` };
    const initialHistory = [starterMessage];
    setMessages(initialHistory); messagesRef.current = initialHistory; setPhase('dialogue');
    setTimeout(() => {
      if (dialogueActiveRef.current && soundEnabledRef.current) {
        setIsSpeaking(true); setMood('speaking');
        speakStudentVoice(starterPrompt, studentObj, speechRateRef.current,
          () => setIsSpeaking(true),
          () => { setIsSpeaking(false); setMood('greeting'); },
          () => { setIsSpeaking(false); setMood('greeting'); });
      }
    }, 600);
  };

  useEffect(() => {
    if (phase !== 'dialogue') { if (timerRef.current) clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current!); handleFinishDialogue(); return 0; }
        return prev - 1;
      });
      setElapsedSeconds((prev) => { const next = prev + 1; elapsedSecondsRef.current = next; return next; });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  const stopRecordingInternal = () => {
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (e) { console.warn('Recognition stop error', e); } }
    recognitionRef.current = null;
    setIsRecording(false); setIsListening(false);
  };

  const handleSendMessage = async (text: string) => {
    if (!dialogueActiveRef.current || phase !== 'dialogue' || remainingSeconds <= 0 || !text.trim() || isAiResponding) return;
    if (isRecording) stopRecordingInternal();
    const trimmed = text.trim();
    if (trimmed.length > 100) { setMicHintMessage('文が少し長いです！もう少し短い英語で話してみてね。'); setTimeout(() => setMicHintMessage(''), 4000); return; }
    setMicHintMessage('');
    const spokenNameMatch = trimmed.match(/\b(?:my name is|i'm|i am|call me)\s+([A-Za-z]{2,15})\b/i);
    if (spokenNameMatch) {
      const candidate = spokenNameMatch[1].trim();
      const capitalized = candidate.charAt(0).toUpperCase() + candidate.slice(1).toLowerCase();
      const nonNameWords = ['in','from','ten','eleven','twelve','fine','good','happy','ready','fifth','sixth','student','boy','girl','japanese','japan','not','very'];
      if (!nonNameWords.includes(candidate.toLowerCase())) { setProfile((prev) => ({ ...prev, name: capitalized })); profileRef.current = { ...profileRef.current, name: capitalized }; }
    }
    extractAndAddVocab(trimmed);
    const words = countEnglishWords(trimmed);
    const childMsg: ChatMessage = { id: `child-${Date.now()}`, sender: 'child', englishText: trimmed, japaneseText: '', timestamp: Date.now(), wordCount: words };
    const newHistory = [...messagesRef.current, childMsg]; setMessages(newHistory); messagesRef.current = newHistory;
    const nextTurnCount = turnCountRef.current + 1; turnCountRef.current = nextTurnCount; setTurnCount(nextTurnCount);
    const nextTotalWords = totalChildWordsRef.current + words; totalChildWordsRef.current = nextTotalWords; setTotalChildWords(nextTotalWords);
    setSpeechTranscript(''); liveTranscriptRef.current = ''; setIsAiResponding(true); setMood('thinking');
    const controller = new AbortController(); chatAbortControllerRef.current = controller;
    try {
      const currentProf = profileRef.current;
      const response = await fetch(apiUrl('/api/chat'), { method:'POST', headers:{'Content-Type':'application/json'}, signal:controller.signal, body:JSON.stringify({ message:trimmed, history:newHistory, topic:currentProf.selectedTopic, studentName:currentProf.name, aiStudentId:currentProf.selectedAiStudentId }) });
      const resData = await response.json();
      if (!dialogueActiveRef.current || controller.signal.aborted || chatAbortControllerRef.current !== controller) return;
      if (resData.success && resData.data) {
        const { reply, japaneseTranslation, studentJapaneseTranslation, studentTranslationStatus, mood: aiMood, culturalNote } = resData.data;
        extractAndAddVocab(reply);
        const aiMsg: ChatMessage = { id:`ai-${Date.now()}`, sender:'ai', englishText:reply, japaneseText:japaneseTranslation, timestamp:Date.now(), culturalNote:culturalNote || undefined };
        const translatedHistory = messagesRef.current.map((message) => {
          if (message.id !== childMsg.id) return message;
          if (studentTranslationStatus === 'incomplete') return { ...message, japaneseText:'日本語に訳せませんでした。' };
          if (typeof studentJapaneseTranslation === 'string' && studentJapaneseTranslation.trim()) return { ...message, japaneseText:studentJapaneseTranslation.trim() };
          return { ...message, japaneseText:'日本語に訳せませんでした。' };
        });
        const updatedHistory = [...translatedHistory, aiMsg]; setMessages(updatedHistory); messagesRef.current = updatedHistory;
        setMood((aiMood as CharacterMood) || 'speaking'); playAiVoice(reply);
      } else throw new Error('API response unsuccessful');
    } catch (e) {
      const wasAborted = (e as {name?:string})?.name === 'AbortError' || controller.signal.aborted;
      if (!wasAborted && dialogueActiveRef.current) { console.error('AI backend unavailable:', e); setMood('listening'); setMicHintMessage('AI留学生に接続できませんでした。もう一度送ってみてね。'); setTimeout(() => setMicHintMessage(''), 5000); }
    } finally {
      if (chatAbortControllerRef.current === controller) chatAbortControllerRef.current = null;
      if (dialogueActiveRef.current) setIsAiResponding(false);
    }
  };

  const mapSpeechError = (err: string) => {
    switch (err) {
      case 'not-allowed':
      case 'service-not-allowed': return 'マイクの使用が許可されていません。ブラウザのマイク設定を「許可」にしてください。';
      case 'no-speech': return '声が聞こえなかったよ。もう一度マイクを押して話してみよう！';
      case 'audio-capture': return 'マイクを使えません。ほかのアプリがマイクを使っていないか確認してください。';
      case 'network': return '音声認識サービスにつながりませんでした。通信状態を確認してください。';
      default: return '音声認識を開始できませんでした。もう一度試すか、文字入力を使ってください。';
    }
  };

  const handleToggleRecording = async () => {
    if (isAiResponding) return;
    if (isRecording) {
      const spokenText = liveTranscriptRef.current.trim();
      stopRecordingInternal();
      if (spokenText) { await handleSendMessage(spokenText); liveTranscriptRef.current=''; setSpeechTranscript(''); }
      else { setMicHintMessage('英語が聞き取れませんでした。もう1度マイクを押して話してみてね！'); setTimeout(() => setMicHintMessage(''), 4000); }
      return;
    }

    stopSpeaking(); setIsSpeaking(false); setMicHintMessage('');
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      }
    } catch {
      setMicHintMessage('マイクの使用が許可されていません。ブラウザのマイク設定を「許可」にしてください。');
      setTimeout(() => setMicHintMessage(''), 6000);
      return;
    }

    liveTranscriptRef.current=''; setSpeechTranscript(''); setIsRecording(true); setIsListening(true);
    await new Promise((resolve) => setTimeout(resolve, 180));
    const recognition = createSpeechRecognitionInstance(
      (text) => { liveTranscriptRef.current=text; setSpeechTranscript(text); },
      (err) => { console.warn('Speech Rec Error:', err); setMicHintMessage(mapSpeechError(err)); setIsRecording(false); setIsListening(false); setTimeout(() => setMicHintMessage(''), 6000); },
      () => { setIsRecording(false); setIsListening(false); }
    );
    if (recognition) {
      recognitionRef.current = recognition;
      try { recognition.start(); }
      catch (e) { console.warn('Speech Rec start error:', e); setMicHintMessage('マイクを開始できませんでした。もう一度試してください。'); setIsRecording(false); setIsListening(false); }
    } else {
      setMicHintMessage('このブラウザでは音声認識が制限されています。文字入力を使ってください。'); setIsRecording(false); setIsListening(false); setTimeout(() => setMicHintMessage(''), 5000);
    }
  };

  const handleSkipFarewell = useCallback(() => {
    if (farewellTransitionRef.current) farewellTransitionRef.current();
    else { stopSpeaking(); if (farewellSafetyTimerRef.current) { clearTimeout(farewellSafetyTimerRef.current); farewellSafetyTimerRef.current=null; } setFarewellBanner(null); setPhase('reflection'); }
  }, []);

  const handleFinishDialogue = async () => {
    if (phase !== 'dialogue' || !dialogueActiveRef.current) return;
    dialogueActiveRef.current=false; chatAbortControllerRef.current?.abort(); chatAbortControllerRef.current=null; setIsAiResponding(false); stopSpeaking(); stopRecordingInternal();
    if (timerRef.current) clearInterval(timerRef.current);
    if (farewellSafetyTimerRef.current) { clearTimeout(farewellSafetyTimerRef.current); farewellSafetyTimerRef.current=null; }
    const pendingText=(liveTranscriptRef.current || speechTranscript || '').trim();
    let currentHistory=[...messagesRef.current];
    if (pendingText && !currentHistory.some((m) => m.sender==='child' && m.englishText.trim()===pendingText)) {
      extractAndAddVocab(pendingText); const words=countEnglishWords(pendingText);
      const pendingChildMsg:ChatMessage={id:`child-${Date.now()}`,sender:'child',englishText:pendingText,japaneseText:'日本語に訳せませんでした。',timestamp:Date.now(),wordCount:words};
      currentHistory=[...currentHistory,pendingChildMsg]; turnCountRef.current+=1; totalChildWordsRef.current+=words; setTurnCount(turnCountRef.current); setTotalChildWords(totalChildWordsRef.current); setSpeechTranscript(''); liveTranscriptRef.current='';
    }
    sessionEndedAtRef.current = Date.now();
    const currentProf=profileRef.current; const studentObj=getAIStudentById(currentProf.selectedAiStudentId); const farewell=getStudentFarewellMessage(studentObj.id); setFarewellBanner(farewell);
    const farewellMsg:ChatMessage={id:`ai-farewell-${Date.now()}`,sender:'ai',englishText:farewell.english,japaneseText:farewell.japanese,timestamp:Date.now(),culturalNote:'時間になりました！お疲れさまでした！'};
    const finalMessages=[...currentHistory,farewellMsg]; setMessages(finalMessages); messagesRef.current=finalMessages; setIsSpeaking(true); setMood('happy'); setIsLoadingFeedback(true);
    (async()=>{ try { const controller=new AbortController(); const timeoutId=setTimeout(()=>controller.abort(),20000); const response=await fetch(apiUrl('/api/feedback'),{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({history:finalMessages,studentName:currentProf.name,durationMinutes:currentProf.selectedDurationMinutes,turns:turnCountRef.current,totalWords:totalChildWordsRef.current,aiStudentId:currentProf.selectedAiStudentId,encounteredVocab:encounteredVocabRef.current})}); clearTimeout(timeoutId); const resData=await response.json(); if(resData.success&&resData.data)setFeedback(resData.data); else throw new Error('Invalid feedback response'); } catch(e){ console.warn('Feedback API fetch issue:',e); setFeedback(generateFallbackFeedback(studentObj,currentProf.name,turnCountRef.current,totalChildWordsRef.current,elapsedSecondsRef.current,currentProf.selectedDurationMinutes,encounteredVocabRef.current,finalMessages)); } finally { setIsLoadingFeedback(false); } })();
    let hasTransitioned=false; const executeTransition=()=>{if(hasTransitioned)return;hasTransitioned=true;stopSpeaking();if(farewellSafetyTimerRef.current){clearTimeout(farewellSafetyTimerRef.current);farewellSafetyTimerRef.current=null;}farewellTransitionRef.current=null;setFarewellBanner(null);setPhase('reflection');};
    farewellTransitionRef.current=executeTransition; farewellSafetyTimerRef.current=setTimeout(executeTransition,4500);
    speakStudentVoice(farewell.english,studentObj,speechRateRef.current,()=>{setIsSpeaking(true);setMood('happy');},()=>{setIsSpeaking(false);executeTransition();},()=>{setIsSpeaking(false);executeTransition();});
  };

  const handleSubmitReflection = async (answers: ReflectionAnswers) => {
    setIsSavingReflection(true); setReflectionSaveMessage('');
    if (learningDataEnabled && learningCode && sessionId) {
      try {
        const response = await fetch(apiUrl('/api/sessions'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          sessionId, learningCode, aiStudentId: profileRef.current.selectedAiStudentId, topic: profileRef.current.selectedTopic,
          targetDurationMinutes: profileRef.current.selectedDurationMinutes, startedAt: sessionStartedAtRef.current,
          endedAt: sessionEndedAtRef.current || Date.now(), history: messagesRef.current, encounteredVocab: encounteredVocabRef.current, reflection: answers,
        }) });
        const data = await response.json();
        if (!response.ok || !data?.success) throw new Error(data?.error || 'SAVE_FAILED');
        setReflectionSaveMessage('学習履歴に保存しました。');
      } catch (error) {
        console.warn('Session persistence unavailable:', error);
        setReflectionSaveMessage('今回は学習履歴に保存できませんでした。レポートはそのまま見ることができます。');
      }
    }
    setIsSavingReflection(false);
    setPhase('feedback');
  };

  const handleOpenHistory = async () => {
    setPhase('history'); setHistoryRows([]); setHistoryError('');
    if (!learningDataEnabled || !learningCode) { setHistoryError('学習履歴機能は現在準備中です。'); return; }
    setHistoryLoading(true);
    try {
      const response = await fetch(apiUrl('/api/student/history'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ learningCode }) });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.error || 'HISTORY_FAILED');
      setHistoryRows(Array.isArray(data.history) ? data.history : []);
    } catch (error) { console.warn('History unavailable:', error); setHistoryError('学習履歴を読み込めませんでした。もう一度試してください。'); }
    finally { setHistoryLoading(false); }
  };

  const handleRestart=()=>{dialogueActiveRef.current=false;chatAbortControllerRef.current?.abort();chatAbortControllerRef.current=null;stopSpeaking();stopRecordingInternal();if(farewellSafetyTimerRef.current){clearTimeout(farewellSafetyTimerRef.current);farewellSafetyTimerRef.current=null;}farewellTransitionRef.current=null;setPhase('setup');setMessages([]);setTurnCount(0);setTotalChildWords(0);setEncounteredVocabList([]);setLatestVocabItem(null);setFarewellBanner(null);setMicHintMessage('');setLearningCode('');setSessionId('');setReflectionSaveMessage('');};

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 flex flex-col">
      {phase==='setup' && <SetupScreen onStartDialogue={handleStartDialogue} learningDataEnabled={learningDataEnabled} onValidateLearningCode={validateLearningCode}/>} 
      {phase==='dialogue' && (
        <div className="flex-1 flex flex-col min-h-[100dvh] lg:h-screen lg:overflow-hidden">
          <Header studentName={profile.name} aiStudentName={currentAiStudent.name} aiStudentFlag={currentAiStudent.flag} remainingSeconds={remainingSeconds} totalDurationSeconds={profile.selectedDurationMinutes*60} turnCount={turnCount} wordCount={totalChildWords} soundEnabled={soundEnabled} onToggleSound={()=>{if(soundEnabled)stopSpeaking();setSoundEnabled(!soundEnabled);}} onFinishEarly={handleFinishDialogue}/>
          <main className="flex-1 max-w-7xl w-full mx-auto p-2.5 sm:p-4 lg:p-5 grid grid-cols-1 md:grid-cols-12 gap-3 lg:gap-5 min-h-0 lg:overflow-hidden pb-[calc(7.5rem+env(safe-area-inset-bottom))] lg:pb-5">
            <div className="hidden md:flex col-span-12 md:col-span-4 lg:col-span-3 flex-col gap-4 overflow-y-auto min-h-0">
              <AIStudentCard student={currentAiStudent} mood={mood} isSpeaking={isSpeaking} isListening={isListening} speechRate={speechRate} onReplayAudio={()=>{const lastAi=messages.filter((m)=>m.sender==='ai').slice(-1)[0];if(lastAi)playAiVoice(lastAi.englishText);}} onChangeSpeechRate={setSpeechRate}/>
              <div className="bg-slate-800 p-5 rounded-3xl text-white shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Session Stats (対話記録)</p>
                <div className="flex items-center justify-between mb-2"><span className="text-xs text-slate-300">Turns</span><span className="font-mono font-bold text-lg">{turnCount}</span></div>
                <div className="flex items-center justify-between mb-2"><span className="text-xs text-slate-300">Words</span><span className="font-mono font-bold text-lg text-emerald-400">{totalChildWords}</span></div>
                <div className="flex items-center justify-between"><span className="text-xs text-slate-300">Vocabulary</span><span className="font-mono font-bold text-lg text-amber-400">{encounteredVocabList.length}</span></div>
                <button type="button" onClick={handleFinishDialogue} className="mt-4 w-full min-h-11 border border-slate-600 hover:bg-slate-700 py-2.5 rounded-2xl text-xs font-bold text-slate-200">対話を終了してふりかえり</button>
              </div>
            </div>

            <div className="col-span-12 md:col-span-8 lg:col-span-6 flex flex-col bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[65dvh] md:min-h-0 md:h-full relative">
              <div className="hidden sm:block p-2.5 sm:p-3 border-b border-slate-100 bg-slate-50/50"><VisualVocabularyDock vocabularyList={encounteredVocabList} latestItem={latestVocabItem} onPlayWord={(word)=>speakVocabularyWord(word,currentAiStudent.voiceLang)}/></div>
              <div className="sm:hidden flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50 text-xs font-bold text-slate-700"><span className="text-xl">{currentAiStudent.flag}</span><span>{currentAiStudent.name}</span><span className="ml-auto text-slate-500">Turns {turnCount} · Words {totalChildWords}</span></div>
              <DialogueView messages={messages} studentName={profile.name} aiStudent={currentAiStudent} isAiResponding={isAiResponding} onPlayAudio={playAiVoice}/>
              <AnimatePresence>{micHintMessage&&<motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:10}} className="mx-3 sm:mx-4 mb-2 bg-amber-50 border border-amber-300 rounded-xl p-2.5 text-xs font-bold text-amber-900 text-center shadow-xs">{micHintMessage}</motion.div>}</AnimatePresence>
              <div className="hidden lg:block"><SpeechInputBar isRecording={isRecording} transcript={speechTranscript} isAiResponding={isAiResponding} onToggleRecording={handleToggleRecording} onSendMessage={handleSendMessage} onClearTranscript={()=>{setSpeechTranscript('');liveTranscriptRef.current='';}}/></div>
            </div>

            <div className="col-span-12 lg:col-span-3 hidden lg:flex flex-col gap-4 overflow-y-auto min-h-0">
              <div className="bg-emerald-50/80 p-5 rounded-3xl border border-emerald-200/80 shadow-sm flex-1 overflow-y-auto">
                <h3 className="text-sm font-bold text-emerald-900 mb-3">🌟 Great Job! (今日のめあて)</h3>
                <div className="space-y-2.5 text-xs font-semibold text-slate-800"><div className="bg-white p-3 rounded-2xl border border-emerald-200/70">Hello! / Nice to meet you! と挨拶しよう</div><div className="bg-white p-3 rounded-2xl border border-emerald-200/70">I like ~ / I can ~ で伝えよう</div><div className="bg-white p-3 rounded-2xl border border-emerald-200/70">How about you? と質問を返そう</div></div>
              </div>
            </div>
          </main>

          <div className="lg:hidden fixed left-0 right-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md shadow-[0_-8px_24px_rgba(15,23,42,0.10)] pb-[env(safe-area-inset-bottom)]">
            <SpeechInputBar compact isRecording={isRecording} transcript={speechTranscript} isAiResponding={isAiResponding} onToggleRecording={handleToggleRecording} onSendMessage={handleSendMessage} onClearTranscript={()=>{setSpeechTranscript('');liveTranscriptRef.current='';}}/>
          </div>

          <AnimatePresence>{farewellBanner&&<div id="farewell-overlay" onClick={handleSkipFarewell} className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer select-none"><motion.div initial={{scale:.9,opacity:0,y:10}} animate={{scale:1,opacity:1,y:0}} exit={{scale:.95,opacity:0}} onClick={(e)=>{e.stopPropagation();handleSkipFarewell();}} className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl text-center border-4 border-amber-300"><div className="text-3xl mb-2">🎉 {currentAiStudent.flag}</div><h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-1">Time is up! (対話終了)</h2><div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 my-4 text-left"><p className="text-base sm:text-lg font-black text-blue-950">“{farewellBanner.english}”</p><p className="text-xs sm:text-sm font-bold text-slate-600 mt-2">{farewellBanner.japanese}</p></div><button id="farewell-next-btn" type="button" onClick={(e)=>{e.stopPropagation();handleSkipFarewell();}} className="w-full min-h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-2xl">📊 レポート・アドバイスを見る</button></motion.div></div>}</AnimatePresence>
        </div>
      )}
      {phase==='reflection'&&<ReflectionScreen aiStudent={currentAiStudent} profile={profile} learningCode={learningCode} totalTurns={turnCount} totalWords={totalChildWords} elapsedSeconds={elapsedSeconds} vocabCount={encounteredVocabList.length} onSubmit={handleSubmitReflection} isSaving={isSavingReflection} saveMessage={reflectionSaveMessage} onOpenHistory={learningDataEnabled && learningCode ? handleOpenHistory : undefined}/>}
      {phase==='feedback'&&<FeedbackScreen profile={profile} messages={messages} feedback={feedback} isLoadingFeedback={isLoadingFeedback} totalTurns={turnCount} totalWords={totalChildWords} elapsedSeconds={elapsedSeconds} encounteredVocabList={encounteredVocabList} onPlayAudio={playAiVoice} onRestart={handleRestart} onOpenHistory={learningDataEnabled && learningCode ? handleOpenHistory : undefined}/>}
      {phase==='history'&&<LearningHistoryScreen rows={historyRows} loading={historyLoading} error={historyError} onBack={()=>setPhase('feedback')}/>} 
    </div>
  );
}
