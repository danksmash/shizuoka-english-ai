import React from 'react';
import { Volume2, Sparkles, Flag } from 'lucide-react';
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
  const updateSpeechRate = (rawValue: string) => {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.min(1.25, Math.max(0.75, parsed));
    const stepped = Math.round(clamped * 20) / 20;
    onChangeSpeechRate(stepped);
  };

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
      <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full text-xs font-bold text-slate-700 shadow-2xs">
        <span className="text-lg leading-none">{student.flag}</span>
        <span>{student.country} ({student.countryNative})</span>
      </div>

      <button
        type="button"
        onClick={onReplayAudio}
        className="absolute top-4 right-4 p-2 bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-700 rounded-full border border-blue-200 transition-all cursor-pointer shadow-2xs"
        title="もう一度音声を聞く"
      >
        <Volume2 className="w-4 h-4" />
      </button>

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

        <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1.5 shadow-md border border-slate-200">
          <span className="text-xl">
            {isSpeaking ? '🗣️' : isListening ? '👂' : mood === 'thinking' ? '💭' : '✨'}
          </span>
        </div>
      </div>

      <h2 className="text-xl font-black text-slate-900 leading-tight">{student.name}</h2>
      <p className="text-xs font-bold text-blue-700 mt-0.5 mb-1">
        {student.japaneseName} ({student.age}歳・{student.city})
      </p>
      <p className="text-xs text-slate-600 font-medium leading-relaxed max-w-xs mb-3">
        {student.role}
      </p>

      <div className="mb-3">{getStatusBadge()}</div>

      <div className="w-full bg-blue-50/70 border border-blue-200 rounded-2xl p-3 mb-3">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-2">
          <span>🔊 AIが話す速さ</span>
          <span className="font-mono text-blue-700 bg-white border border-blue-200 px-2 py-0.5 rounded-lg" aria-live="polite">
            {speechRate.toFixed(2)}x
          </span>
        </div>
        <input
          aria-label="AIが話す速さ"
          type="range"
          min="0.75"
          max="1.25"
          step="0.05"
          value={speechRate}
          onInput={(e) => updateSpeechRate(e.currentTarget.value)}
          onChange={(e) => updateSpeechRate(e.currentTarget.value)}
          className="w-full h-8 accent-blue-600 cursor-pointer touch-pan-y select-none"
        />
        <div className="flex justify-between text-[9px] text-slate-500 font-bold mt-1">
          <span>0.75 ゆっくり</span>
          <span>1.00 ふつう</span>
          <span>1.25 はやい</span>
        </div>
        <p className="text-[9px] text-slate-500 font-semibold mt-1.5">
          スライダーを動かすと、次のAI音声と「もう一度聞く」に反映されます。
        </p>
      </div>

      <div className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5 text-left">
        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          <Flag className="w-3 h-3 text-blue-600" />
          <span>{student.accentName}</span>
        </div>
        {latestCulturalNote && (
          <p className="text-[10px] text-blue-800 bg-blue-50/80 p-1.5 rounded-lg mt-1.5 font-medium border border-blue-200/60">
            💡 {latestCulturalNote}
          </p>
        )}
      </div>
    </div>
  );
};
