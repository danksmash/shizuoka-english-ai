import React from 'react';
import { Volume2, VolumeX, Clock, CheckCircle2, MessageCircle, KeyRound } from 'lucide-react';

interface HeaderProps {
  studentName: string;
  learningId?: string;
  aiStudentName?: string;
  aiStudentFlag?: string;
  remainingSeconds: number;
  totalDurationSeconds: number;
  turnCount: number;
  wordCount: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onFinishEarly: () => void;
  labelCondition?: 'shown' | 'hidden';
}

export const Header: React.FC<HeaderProps> = ({
  studentName,
  learningId,
  aiStudentName = 'Oliver',
  aiStudentFlag = '🇬🇧',
  remainingSeconds,
  totalDurationSeconds,
  soundEnabled,
  onToggleSound,
  onFinishEarly,
  labelCondition = 'shown',
}) => {
  const showLabels = labelCondition === 'shown';
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeDisplay = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  const progressPercent = Math.max(0, Math.min(100, (remainingSeconds / totalDurationSeconds) * 100));
  const isTimeLow = remainingSeconds <= 30;

  return (
    <header className="shrink-0 bg-[#F8FAFC] px-2.5 py-2 sm:px-4 sm:pt-4 sm:pb-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex bg-blue-600 p-2.5 rounded-2xl shadow-sm text-white items-center justify-center">
            <MessageCircle className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="hidden sm:flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-800 tracking-tight">English Buddy!</h1>
              <span className="bg-blue-100 text-blue-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full hidden md:inline">小学校５・６年生向け</span>
            </div>
            <p className="text-sm sm:text-xs text-slate-700 sm:text-slate-500 font-bold sm:font-medium truncate">
              <span className="sm:hidden">{showLabels ? aiStudentFlag : ''} {aiStudentName}</span>
              <span className="hidden sm:inline">- Shizuoka University Exchange - <span className="text-slate-700 font-semibold">{studentName || '5・6年生'}</span> × {aiStudentName} {showLabels ? aiStudentFlag : ''}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {learningId && <div className="flex min-h-11 items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 text-[11px] font-black text-blue-800 sm:px-3"><KeyRound className="h-4 w-4" /><span className="hidden sm:inline">学習者ID</span><span className="tracking-widest">{learningId}</span></div>}
          <div className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 sm:py-1.5 rounded-full border shadow-xs font-mono transition-all ${isTimeLow ? 'bg-rose-50 border-rose-300 text-rose-700 animate-pulse' : 'bg-white border-slate-200 text-slate-700'}`}>
            <Clock className={`w-4 h-4 ${isTimeLow ? 'text-rose-600' : 'text-blue-600'}`} />
            <span className="text-sm sm:text-base font-bold text-slate-800">{timeDisplay}</span>
            <div className="w-10 h-1.5 bg-slate-200 rounded-full overflow-hidden ml-1 hidden lg:block">
              <div className={`h-full transition-all duration-1000 ${isTimeLow ? 'bg-rose-500' : 'bg-blue-600'}`} style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          <button type="button" onClick={onToggleSound} aria-label={soundEnabled ? '音声をオフにする' : '音声をオンにする'} className={`min-w-11 min-h-11 p-2 rounded-full border shadow-xs transition-colors cursor-pointer flex items-center justify-center ${soundEnabled ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'}`} title={soundEnabled ? '音声オン' : '音声ミュート中'}>
            {soundEnabled ? <Volume2 className="w-5 h-5 text-emerald-600" /> : <VolumeX className="w-5 h-5" />}
          </button>

          <button type="button" onClick={onFinishEarly} className="min-h-11 bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer">
            <CheckCircle2 className="w-4 h-4" />
            <span className="hidden sm:inline">おわる (ふりかえり)</span>
            <span className="sm:hidden">終了</span>
          </button>
        </div>
      </div>
    </header>
  );
};