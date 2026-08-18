import React from 'react';
import { Volume2, VolumeX, Clock, MessageSquare, Award, CheckCircle2, MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface HeaderProps {
  studentName: string;
  aiStudentName?: string;
  aiStudentFlag?: string;
  remainingSeconds: number;
  totalDurationSeconds: number;
  turnCount: number;
  wordCount: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onFinishEarly: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  studentName,
  aiStudentName = 'Oliver',
  aiStudentFlag = '🇬🇧',
  remainingSeconds,
  totalDurationSeconds,
  turnCount,
  wordCount,
  soundEnabled,
  onToggleSound,
  onFinishEarly,
}) => {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeDisplay = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const progressPercent = Math.max(0, Math.min(100, (remainingSeconds / totalDurationSeconds) * 100));
  const isTimeLow = remainingSeconds <= 30;

  return (
    <header className="px-4 sm:px-6 pt-4 pb-2 bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Bento Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-2xl shadow-sm text-white flex items-center justify-center">
            <MessageCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-800 tracking-tight">
                English Buddy!
              </h1>
              <span className="bg-blue-100 text-blue-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full hidden sm:inline">
                小学校５・６年生向け
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              - Shizuoka University Exchange - <span className="text-slate-700 font-semibold">{studentName || '5・6年生'}</span> × {aiStudentName} {aiStudentFlag}
            </p>
          </div>
        </div>

        {/* Right: Header Bento Capsules (Timer, Sound, Finish) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Time Bento Capsule */}
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border shadow-xs font-mono transition-all ${
              isTimeLow
                ? 'bg-rose-50 border-rose-300 text-rose-700 animate-pulse'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <Clock className={`w-4 h-4 ${isTimeLow ? 'text-rose-600' : 'text-blue-600'}`} />
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-sans font-semibold">Time:</span>
              <span className="text-sm sm:text-base font-bold text-slate-800">{timeDisplay}</span>
            </div>
            {/* Progress bar dot */}
            <div className="w-10 h-1.5 bg-slate-200 rounded-full overflow-hidden ml-1 hidden md:block">
              <div
                className={`h-full transition-all duration-1000 ${
                  isTimeLow ? 'bg-rose-500' : 'bg-blue-600'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={onToggleSound}
            aria-label={soundEnabled ? '音声をオフにする' : '音声をオンにする'}
            className={`p-2 rounded-full border shadow-xs transition-colors cursor-pointer ${
              soundEnabled
                ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                : 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
            }`}
            title={soundEnabled ? '音声オン' : '音声ミュート中'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Finish Early Button */}
          <button
            type="button"
            onClick={onFinishEarly}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-5 py-1.5 rounded-full text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>おわる (ふりかえり)</span>
          </button>
        </div>
      </div>
    </header>
  );
};
