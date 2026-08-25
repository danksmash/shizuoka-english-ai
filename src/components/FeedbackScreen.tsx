import React, { useState } from 'react';
import {
  Award,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  Volume2,
  RotateCcw,
  BookOpen,
  MessageSquare,
  Printer,
  ChevronRight,
  Copy,
} from 'lucide-react';
import { ChatMessage, FeedbackData, StudentProfile, VisualVocabularyItem } from '../types';
import { getAIStudentById } from '../data/curriculum';
import { speakVocabularyWord } from '../utils/speech';
import { getJapaneseTranslationForMessage } from '../utils/translation';
import { downloadDialogueLogHTML } from '../utils/exportLog';
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
}) => {
  const [playingWordId, setPlayingWordId] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const aiStudent = getAIStudentById(profile.selectedAiStudentId);
  const uniqueKeyPhrases = (feedback?.keyPhrases || []).filter((phrase, index, all) => {
    const key = phrase.english.trim().toLowerCase();
    return key.length > 0 && all.findIndex((candidate) => candidate.english.trim().toLowerCase() === key) === index;
  });

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins}分${rem < 10 ? '0' : ''}${rem}秒`;
  };

  const handlePlayVocab = (item: VisualVocabularyItem) => {
    setPlayingWordId(item.id);
    speakVocabularyWord(item.word, aiStudent.voiceLang, () => {
      setPlayingWordId(null);
    });
  };

  const handleCopyReport = () => {
    const transcriptText = messages
      .map((m) => `${m.sender === 'ai' ? aiStudent.name : (profile.name || 'Student')}: ${m.englishText} (${m.japaneseText || ''})`)
      .join('\n');
    const feedbackText = feedback
      ? `【よい点】\n${feedback.goodPoints.join('\n')}\n\n【次へのアドバイス】\n${feedback.improvementAdvice.title}: ${feedback.improvementAdvice.detail}\n\n【総合コメント】\n${feedback.overallComment}`
      : '';
    const fullText = `--- AI留学生えいご対話レポート ---\n生徒: ${profile.name}\n留学生: ${aiStudent.name} (${aiStudent.countryJapanese})\n対話時間: ${formatTime(elapsedSeconds)} | ターン数: ${totalTurns} | 発話語数: ${totalWords}\n\n【対話トランスクリプト】\n${transcriptText}\n\n${feedbackText}`;

    navigator.clipboard
      .writeText(fullText)
      .then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2500);
      })
      .catch(() => {});
  };

  const handlePrint = () => {
    try {
      window.print();
    } catch (e) {
      console.warn('Print not supported in this frame:', e);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-emerald-50/20 to-slate-100 p-3 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md flex-shrink-0">
            <Award className="w-9 h-9" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                Great Job! 対話ふりかえり
              </span>
              <span className="text-xs font-semibold text-slate-500">
                {formatTime(elapsedSeconds)} 達成
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              {profile.name}さんの英会話レポート
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">
              {aiStudent.flag} {aiStudent.name} ({aiStudent.country} ({aiStudent.countryNative}) 留学生) との対話練習記録
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={handleCopyReport}
            className="flex-1 md:flex-none px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-emerald-200"
            title="レポートをクリップボードにコピー"
          >
            <Copy className="w-4 h-4" />
            <span>{copySuccess ? 'コピーしました！' : 'コピー'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 md:flex-none px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
          >
            <Printer className="w-4 h-4" />
            <span>印刷</span>
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="flex-1 md:flex-none px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>もう一度練習する</span>
          </button>
        </div>
      </div>

      {/* Metrics Row (Bento Grid) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs text-center">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            対話時間 (Time)
          </p>
          <p className="text-xl sm:text-2xl font-black text-slate-900">
            {formatTime(elapsedSeconds)}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            目標: {profile.selectedDurationMinutes}分
          </p>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs text-center">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            ターン数 (Turns)
          </p>
          <p className="text-xl sm:text-2xl font-black text-blue-600">
            {totalTurns} <span className="text-xs text-slate-500 font-normal">往復</span>
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">会話のキャッチボール</p>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs text-center">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            発話語数 (Words)
          </p>
          <p className="text-xl sm:text-2xl font-black text-emerald-600">
            {totalWords} <span className="text-xs text-slate-500 font-normal">words</span>
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">あなたの英語発話量</p>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs text-center">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            出会った語彙 (Vocab)
          </p>
          <p className="text-xl sm:text-2xl font-black text-amber-600">
            {encounteredVocabList.length} <span className="text-xs text-slate-500 font-normal">語</span>
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">語彙コレクション</p>
        </div>
      </div>

      {/* Main Feedback Sections */}
      {isLoadingFeedback ? (
        <div className="bg-white rounded-3xl p-10 border border-slate-200 shadow-sm text-center my-6 flex flex-col items-center justify-center">
          <Sparkles className="w-8 h-8 text-blue-600 animate-spin mb-3" />
          <h3 className="text-base font-bold text-slate-900">
            {aiStudent.name} との対話を分析中...
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            静岡大学留学生交流の指導教員がアドバイスを作成しています
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
          {/* Left Column (7 cols): Good Points & Improvement Advice */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* 3 Good Points */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm">
              <h2 className="text-base font-bold text-emerald-900 flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>よくできたところ (Good Points)</span>
              </h2>

              <div className="space-y-3">
                {feedback?.goodPoints?.map((point, idx) => (
                  <div
                    key={idx}
                    className="bg-emerald-50/70 border border-emerald-200/70 p-3.5 rounded-2xl flex items-start gap-3"
                  >
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed">
                      {point}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Improvement Advice */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm">
              <h2 className="text-base font-bold text-amber-900 flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-amber-600" />
                <span>次へのステップアップ (Next Step Advice)</span>
              </h2>

              <div className="bg-amber-50/80 border border-amber-200 p-4 rounded-2xl">
                <h3 className="text-sm font-black text-amber-950 mb-1">
                  💡 {feedback?.improvementAdvice?.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-800 leading-relaxed mb-3">
                  {feedback?.improvementAdvice?.detail}
                </p>

                {feedback?.improvementAdvice?.examplePhrase && (
                  <div className="bg-white p-3 rounded-xl border border-amber-200/80">
                    <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-0.5">
                      使ってみよう！ (Practice Phrase)
                    </p>
                    <div className="flex items-center justify-between">
                      <p className="text-xs sm:text-sm font-bold text-slate-900">
                        "{feedback.improvementAdvice.examplePhrase}"
                      </p>
                      <button
                        type="button"
                        onClick={() => onPlayAudio(feedback.improvementAdvice.examplePhrase!)}
                        className="p-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg cursor-pointer"
                        title="発音を聞く"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Overall Teacher/Student Comment */}
            <div className="bg-blue-50/80 rounded-3xl p-5 border border-blue-200 shadow-sm flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl overflow-hidden border border-blue-400 flex-shrink-0">
                <StudentAvatar student={aiStudent} size="sm" className="w-12 h-12" />
              </div>
              <div>
                <p className="text-xs font-bold text-blue-900 mb-0.5">
                  {aiStudent.name} からのメッセージ:
                </p>
                <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                  "{feedback?.studentMessage || feedback?.overallComment}"
                </p>
              </div>
            </div>
          </div>

          {/* Right Column (5 cols): Visual Vocabulary Collection & Key Phrases */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Visual Vocabulary Collection */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-amber-600" />
                  <span>今回学んだ単語 (Vocab Collection)</span>
                </h2>
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  {encounteredVocabList.length} 語
                </span>
              </div>

              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {encounteredVocabList.length > 0 ? (
                  encounteredVocabList.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 bg-slate-50 hover:bg-amber-50/60 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-2 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{item.emoji}</span>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{item.word}</p>
                          <p className="text-[11px] font-semibold text-slate-600">
                            {item.japanese}
                          </p>
                          {item.mitsumuraUnit && (
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                              {item.mitsumuraUnit}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handlePlayVocab(item)}
                        className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                          playingWordId === item.id
                            ? 'bg-amber-500 text-white animate-bounce'
                            : 'bg-white hover:bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span className="text-[10px]">発音</span>
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    会話の中でたくさんの英単語にチャレンジしてみよう！
                  </p>
                )}
              </div>
            </div>

            {/* Key Expressions Learned */}
            {uniqueKeyPhrases.length > 0 && (
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                  <span>重要キーフレーズ (Key Expressions)</span>
                </h2>

                <div className="space-y-2">
                  {uniqueKeyPhrases.map((phrase, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-blue-50/60 rounded-xl border border-blue-200/70"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-950">
                          {phrase.english}
                        </span>
                        <button
                          type="button"
                          onClick={() => onPlayAudio(phrase.english)}
                          className="p-1 text-blue-700 hover:text-blue-900 cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-600 font-medium">{phrase.japanese}</p>
                      {phrase.culturalNote && (
                        <p className="text-[10px] text-blue-700 mt-0.5">
                          💡 {phrase.culturalNote}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conversation Transcript Log with Japanese Translations */}
      <div id="transcript-section" className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>📝</span>
            <span>対話の文字起こしと日本語訳 (Dialogue Transcript & Japanese Translation)</span>
          </h2>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
            全 {messages.length} 発話
          </span>
        </div>

        <div className="space-y-4 divide-y divide-slate-100">
          {messages.map((msg, i) => {
            const isAi = msg.sender === 'ai';
            const translation = getJapaneseTranslationForMessage(
              msg,
              profile.selectedAiStudentId,
              profile.selectedTopic
            );

            return (
              <div key={msg.id || i} className="pt-4 first:pt-0 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg mt-0.5 whitespace-nowrap flex-shrink-0 ${
                      isAi
                        ? 'bg-blue-100 text-blue-800 border border-blue-200/60'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200/60'
                    }`}
                  >
                    {isAi ? `${aiStudent.flag} ${aiStudent.name}` : `🧒 ${profile.name || 'じどう'}`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 leading-relaxed break-words">
                      {msg.englishText}
                    </p>

                    {/* 日本語訳 (Japanese Translation) */}
                    {translation && (
                      <div className="mt-1.5 p-2 bg-slate-50/90 rounded-xl border border-slate-200/70 text-xs sm:text-[13px] text-slate-700 leading-relaxed flex items-start gap-1.5">
                        <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded-md flex-shrink-0 mt-0.5">
                          日本語訳
                        </span>
                        <span className="font-medium text-slate-700">{translation}</span>
                      </div>
                    )}

                    {msg.culturalNote && (
                      <p className="text-[11px] text-blue-700 mt-1.5 flex items-center gap-1 font-medium">
                        <span>💡</span>
                        <span>{msg.culturalNote}</span>
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onPlayAudio(msg.englishText)}
                  className="p-2 text-slate-400 hover:text-blue-600 rounded-xl hover:bg-blue-50 transition-colors cursor-pointer flex-shrink-0"
                  title="音声を再生"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Restart Footer */}
      <div className="text-center py-4">
        <button
          type="button"
          onClick={onRestart}
          className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-black text-base shadow-md inline-flex items-center gap-2 cursor-pointer transition-all active:scale-98"
        >
          <RotateCcw className="w-5 h-5" />
          <span>別の留学生と練習する (Choose Another Student)</span>
        </button>
      </div>
    </div>
  );
};
