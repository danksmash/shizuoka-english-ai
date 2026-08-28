import React, { useState } from 'react';
import { Award, BarChart3, BookOpen, CheckCircle2, Copy, MessageSquare, Printer, RotateCcw, Sparkles, TrendingUp, Volume2 } from 'lucide-react';
import { ChatMessage, FeedbackData, StudentProfile, VisualVocabularyItem } from '../types';
import { getAIStudentById } from '../data/curriculum';
import { speakVocabularyWord } from '../utils/speech';
import { getJapaneseTranslationForMessage } from '../utils/translation';
import { safePlainTextForClipboard } from '../utils/privacy';
import { StudentAvatar } from './StudentAvatar';

interface FeedbackScreenProps {
  profile: StudentProfile;
  messages: ChatMessage[];
  feedback: FeedbackData | null;
  isLoadingFeedback: boolean;
  totalTurns: number;
  totalWords: number;
  elapsedSeconds: number;
  encounteredVocabList: VisualVocabularyItem[];
  onPlayAudio: (text: string) => void;
  onRestart: () => void;
  onOpenHistory?: () => void;
}

export const FeedbackScreen: React.FC<FeedbackScreenProps> = ({
  profile,
  messages,
  feedback,
  isLoadingFeedback,
  totalTurns,
  totalWords,
  elapsedSeconds,
  encounteredVocabList,
  onPlayAudio,
  onRestart,
  onOpenHistory,
}) => {
  const [playingWordId, setPlayingWordId] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const aiStudent = getAIStudentById(profile.selectedAiStudentId);
  const uniqueKeyPhrases = (feedback?.keyPhrases || []).filter((phrase, index, all) => {
    const key = phrase.english.trim().toLowerCase();
    return key.length > 0 && all.findIndex((candidate) => candidate.english.trim().toLowerCase() === key) === index;
  });

  const formatTime = (secs: number) => `${Math.floor(secs / 60)}分${String(secs % 60).padStart(2, '0')}秒`;

  const handlePlayVocab = (item: VisualVocabularyItem) => {
    setPlayingWordId(item.id);
    speakVocabularyWord(item.word, aiStudent.voiceLang, () => setPlayingWordId(null));
  };

  const handleCopyReport = () => {
    const transcript = messages.map((m) => `${m.sender === 'ai' ? aiStudent.name : (profile.name || 'Student')}: ${m.englishText}\n日本語訳: ${getJapaneseTranslationForMessage(m, profile.selectedAiStudentId, profile.selectedTopic) || ''}`).join('\n\n');
    const report = `--- AI留学生えいご対話レポート ---\n生徒: ${profile.name}\n留学生: ${aiStudent.name} (${aiStudent.countryJapanese})\n対話時間: ${formatTime(elapsedSeconds)} / ターン: ${totalTurns} / 発話語数: ${totalWords}\n\n【留学生からのメッセージ】\n${feedback?.studentMessage || feedback?.overallComment || ''}\n\n【よくできたところ】\n${(feedback?.goodPoints || []).join('\n')}\n\n【次へのアドバイス】\n${feedback?.improvementAdvice?.title || ''}\n${feedback?.improvementAdvice?.detail || ''}\n\n【対話ログと日本語訳】\n${transcript}`;
    navigator.clipboard.writeText(safePlainTextForClipboard(report)).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    }).catch(() => {});
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/20 to-slate-100 p-3 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1420px]">
        <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between sm:p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md"><Award className="h-9 w-9" /></div>
            <div>
              <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-800">Great Job! 対話ふりかえり</span></div>
              <h1 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">{profile.name || '5・6年生'}さんの英会話レポート</h1>
              <p className="text-xs font-semibold text-slate-600 sm:text-sm">{aiStudent.flag} {aiStudent.name} ({aiStudent.countryJapanese}) 留学生との対話練習記録</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handleCopyReport} className="flex min-h-11 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-xs font-black text-emerald-800"><Copy className="h-4 w-4" />{copySuccess ? 'コピーしました！' : 'コピー'}</button>
            {onOpenHistory && <button type="button" onClick={onOpenHistory} className="flex min-h-11 items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 text-xs font-black text-blue-800"><BarChart3 className="h-4 w-4" />わたしの学習履歴</button>}
            <button type="button" onClick={() => window.print()} className="flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700"><Printer className="h-4 w-4" />印刷</button>
            <button type="button" onClick={onRestart} className="flex min-h-11 items-center gap-2 rounded-2xl bg-blue-600 px-5 text-xs font-black text-white shadow"><RotateCcw className="h-4 w-4" />もう一度練習する</button>
          </div>
        </div>

        {isLoadingFeedback ? (
          <div className="my-6 flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm"><Sparkles className="mb-3 h-8 w-8 animate-spin text-blue-600" /><h3 className="font-black text-slate-900">{aiStudent.name} との対話を分析中...</h3><p className="mt-1 text-xs text-slate-500">AI評価と留学生からのメッセージを作成しています</p></div>
        ) : (
          <>
            <div className="mb-6 flex items-start gap-4 rounded-3xl border border-blue-200 bg-blue-50/80 p-5 shadow-sm sm:p-6">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-blue-300"><StudentAvatar student={aiStudent} size="sm" className="h-14 w-14" /></div>
              <div><p className="mb-1 text-sm font-black text-blue-900">{aiStudent.name} からのメッセージ</p><p className="text-sm font-semibold leading-relaxed text-slate-800">“{feedback?.studentMessage || feedback?.overallComment || '話してくれてありがとう！また一緒に英語で話そうね。'}”</p></div>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="flex flex-col gap-6 lg:col-span-7">
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="mb-4 flex items-center gap-2 text-base font-black text-emerald-900"><CheckCircle2 className="h-5 w-5 text-emerald-600" />よくできたところ (Good Points)</h2>
                  <div className="space-y-3">{(feedback?.goodPoints || []).map((point, idx) => <div key={idx} className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-black text-white">{idx + 1}</span><p className="text-xs font-semibold leading-relaxed text-slate-800 sm:text-sm">{point}</p></div>)}</div>
                </section>
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="mb-4 flex items-center gap-2 text-base font-black text-amber-900"><TrendingUp className="h-5 w-5 text-amber-600" />次へのステップアップ (Next Step Advice)</h2>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4"><h3 className="mb-1 text-sm font-black text-amber-950">💡 {feedback?.improvementAdvice?.title}</h3><p className="mb-3 text-xs leading-relaxed text-slate-800 sm:text-sm">{feedback?.improvementAdvice?.detail}</p>{feedback?.improvementAdvice?.examplePhrase && <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-white p-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-amber-800">使ってみよう！ (Practice Phrase)</p><p className="text-sm font-black text-slate-900">“{feedback.improvementAdvice.examplePhrase}”</p></div><button type="button" onClick={() => onPlayAudio(feedback.improvementAdvice.examplePhrase!)} className="rounded-lg bg-amber-100 p-2 text-amber-800"><Volume2 className="h-4 w-4" /></button></div>}</div>
                </section>
              </div>

              <div className="flex flex-col gap-6 lg:col-span-5">
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-base font-black text-slate-900"><BookOpen className="h-5 w-5 text-amber-600" />今回学んだ単語 (Vocab Collection)</h2><span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">{encounteredVocabList.length}語</span></div><div className="space-y-2.5">{encounteredVocabList.map((item) => <div key={item.id} className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center gap-3"><span className="text-2xl">{item.emoji}</span><div><p className="text-xs font-black text-slate-900">{item.word}</p><p className="text-[11px] font-semibold text-slate-600">{item.japanese}</p>{item.mitsumuraUnit && <span className="text-[9px] font-black text-emerald-700">{item.mitsumuraUnit}</span>}</div></div><button type="button" onClick={() => handlePlayVocab(item)} className={`flex items-center gap-1 rounded-xl border border-amber-200 bg-white px-2 py-2 text-[10px] font-black text-amber-800 ${playingWordId === item.id ? 'animate-pulse' : ''}`}><Volume2 className="h-3.5 w-3.5" />発音</button></div>)}</div></section>
                {uniqueKeyPhrases.length > 0 && <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900"><MessageSquare className="h-4 w-4 text-blue-600" />重要キーフレーズ (Key Expressions)</h2><div className="space-y-2">{uniqueKeyPhrases.map((phrase, idx) => <div key={idx} className="rounded-xl border border-blue-200 bg-blue-50/60 p-3"><div className="flex items-center justify-between"><span className="text-xs font-black text-blue-950">{phrase.english}</span><button type="button" onClick={() => onPlayAudio(phrase.english)} className="p-1 text-blue-700"><Volume2 className="h-4 w-4" /></button></div><p className="text-[11px] font-semibold text-slate-600">{phrase.japanese}</p>{phrase.culturalNote && <p className="mt-1 text-[10px] text-blue-700">💡 {phrase.culturalNote}</p>}</div>)}</div></section>}
              </div>
            </div>
          </>
        )}

        <section id="transcript-section" className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-base font-black text-slate-900"><span>📝</span>対話の文字起こしと日本語訳 (Dialogue Transcript & Japanese Translation)</h2><span className="whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-500">全 {messages.length} 発話</span></div>
          <div className="divide-y divide-slate-100">
            {messages.map((msg, i) => {
              const isAi = msg.sender === 'ai';
              const translation = getJapaneseTranslationForMessage(msg, profile.selectedAiStudentId, profile.selectedTopic);
              return <div key={msg.id || i} className="flex items-start justify-between gap-3 py-4 first:pt-0"><div className="flex min-w-0 flex-1 items-start gap-3"><span className={`mt-0.5 shrink-0 whitespace-nowrap rounded-lg border px-2.5 py-1 text-[10px] font-black ${isAi ? 'border-blue-200 bg-blue-100 text-blue-800' : 'border-emerald-200 bg-emerald-100 text-emerald-800'}`}>{isAi ? `${aiStudent.flag} ${aiStudent.name}` : `🧒 ${profile.name || 'じどう'}`}</span><div className="min-w-0 flex-1"><p className="break-words text-sm font-black leading-relaxed text-slate-900">{msg.englishText}</p>{translation && <div className="mt-1.5 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/90 p-2 text-xs leading-relaxed text-slate-700"><span className="mt-0.5 shrink-0 rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-black text-indigo-700">日本語訳</span><span className="font-semibold">{translation}</span></div>}{msg.culturalNote && <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-blue-700">💡 {msg.culturalNote}</p>}</div></div><button type="button" onClick={() => onPlayAudio(msg.englishText)} className="shrink-0 rounded-xl p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600" title="音声を再生"><Volume2 className="h-4 w-4" /></button></div>;
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
