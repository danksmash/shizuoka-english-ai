import React from 'react';
import { Volume2, Sparkles, User, Flag, MessageSquare } from 'lucide-react';
import { CharacterMood, AIStudentProfile } from '../types';
import { StudentAvatar } from './StudentAvatar';

interface AIStudentCardProps {
  student: AIStudentProfile;
  mood: CharacterMood;
  isSpeaking: boolean;
  isListening: boolean;
  speechRate: number;
  latestAiMessage?: string;
  latestCulturalNote?: string;
  onReplayAudio: () => void;
  onChangeSpeechRate: (rate: number) => void;
}

export const AIStudentCard: React.FC<AIStudentCardProps> = ({
  student,
  mood,
  isSpeaking,
  isListening,
  speechRate,
  latestCulturalNote,
  onReplayAudio,
  onChangeSpeechRate,
}) => {
  // Dynamic status badges
  const getStatusBadge = () => {
    if (isSpeaking) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500 text-white animate-pulse shadow-xs">
          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
          <span>英語を話しています...</span>
        </span>
      );
    }
    if (isListening) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white shadow-xs">
          <span className="w-2 h-2 rounded-full bg-white animate-bounce" />
          <span>あなたの声を聞いています</span>
        </span>
      );
    }
    if (mood === 'thinking') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-white shadow-xs">
          <Sparkles className="w-3.5 h-3.5 animate-spin" />
          <span>考えています...</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
        <span>Ready (待機中)</span>
      </span>
    );
  };

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
      {/* Country Flag Tag */}
      <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full text-xs font-bold text-slate-700 shadow-2xs">
        <span className="text-lg leading-none">{student.flag}</span>
        <span>{student.country} ({student.countryNative})</span>
      </div>

      {/* Voice Replay Button */}
      <button
        type="button"
        onClick={onReplayAudio}
        className="absolute top-4 right-4 p-2 bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-700 rounded-full border border-blue-200 transition-all cursor-pointer shadow-2xs"
        title="もう一度音声を聞く"
      >
        <Volume2 className="w-4 h-4" />
      </button>

      {/* Avatar Portrait with dynamic ring */}
      <div className="relative mt-5 mb-3">
        <div
          className={`w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden p-1 transition-all duration-300 ${
            isSpeaking
              ? 'ring-4 ring-blue-400 ring-offset-2 scale-105 shadow-lg'
              : isListening
              ? 'ring-4 ring-emerald-400 ring-offset-2 scale-102 shadow-md'
              : 'ring-2 ring-slate-200 shadow-sm'
          }`}
        >
          <StudentAvatar
            student={student}
            size="custom"
            className="w-full h-full"
            isSpeaking={isSpeaking}
            isListening={isListening}
          />
        </div>

        {/* Emotion / Status Icon overlay */}
        <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1.5 shadow-md border border-slate-200">
          <span className="text-xl">
            {isSpeaking ? '🗣️' : isListening ? '👂' : mood === 'thinking' ? '💭' : '✨'}
          </span>
        </div>
      </div>

      {/* Name and University Bio */}
      <h2 className="text-xl font-black text-slate-900 leading-tight">
        {student.name}
      </h2>
      <p className="text-xs font-bold text-blue-700 mt-0.5 mb-1">
        {student.japaneseName} ({student.age}歳・{student.city})
      </p>
      <p className="text-xs text-slate-600 font-medium leading-relaxed max-w-xs mb-3">
        {student.role}
      </p>

      {/* Status Badge */}
      <div className="mb-4">{getStatusBadge()}</div>

      {/* Accent & Signature Phrase Banner */}
      <div className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5 text-left mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Flag className="w-3 h-3 text-blue-600" />
            <span>{student.accentName}</span>
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs font-bold text-slate-800">
          <MessageSquare className="w-3 h-3 text-amber-500 flex-shrink-0" />
          <span className="truncate">
            {student.fillerWords.slice(0, 2).join(' ')}
          </span>
        </div>
        {latestCulturalNote && (
          <p className="text-[10px] text-blue-800 bg-blue-50/80 p-1.5 rounded-lg mt-1.5 font-medium border border-blue-200/60">
            💡 {latestCulturalNote}
          </p>
        )}
      </div>

      {/* Speech Rate Controller */}
      <div className="w-full bg-slate-50/60 border border-slate-200/60 rounded-2xl p-2.5">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1">
          <span>話すスピード (Voice Speed)</span>
          <span className="font-mono font-bold text-blue-700">{speechRate}x</span>
        </div>
        <input
          type="range"
          min="0.7"
          max="1.1"
          step="0.05"
          value={speechRate}
          onChange={(e) => onChangeSpeechRate(parseFloat(e.target.value))}
          className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
        />
        <div className="flex justify-between text-[9px] text-slate-400 font-medium px-0.5 mt-0.5">
          <span>ゆっくり (Slow)</span>
          <span>ふつう (Normal)</span>
          <span>はやい (Fast)</span>
        </div>
      </div>
    </div>
  );
};
