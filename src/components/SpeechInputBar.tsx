import React from 'react';
import { Mic } from 'lucide-react';
import { motion } from 'motion/react';

interface SpeechInputBarProps {
  isRecording: boolean;
  transcript: string;
  isAiResponding: boolean;
  onToggleRecording: () => void;
  compact?: boolean;
}

export const SpeechInputBar: React.FC<SpeechInputBarProps> = ({
  isRecording,
  transcript,
  isAiResponding,
  onToggleRecording,
  compact = false,
}) => {
  return (
    <div className={`${compact ? 'p-2.5' : 'p-3 sm:p-4'} bg-white space-y-2.5`}>
      {isRecording && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-2 bg-rose-50 border-2 border-rose-300 rounded-2xl"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 mb-1">
            <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
            音声を聞き取り中…
          </div>
          <div className="text-sm sm:text-base font-bold min-h-6">
            {transcript ? (
              <span className="text-blue-700">{transcript}</span>
            ) : (
              <span className="text-slate-400 italic font-normal">英語で話してね…</span>
            )}
          </div>
        </motion.div>
      )}

      <motion.button
        whileTap={{ scale: 0.98 }}
        type="button"
        onClick={onToggleRecording}
        disabled={isAiResponding}
        className={`w-full min-h-16 py-3 px-4 rounded-2xl font-black text-base sm:text-lg flex flex-col items-center justify-center shadow-md ${
          isAiResponding
            ? 'bg-slate-200 text-slate-400'
            : isRecording
              ? 'bg-rose-500 text-white ring-4 ring-rose-200 animate-pulse'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
        }`}
      >
        {isRecording ? (
          <>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 bg-white rounded-full animate-ping" />
              <span>話し終えたら、もう1度タップ</span>
            </div>
            <span className="text-xs text-rose-100">タップするとAIに送ります</span>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Mic className="w-6 h-6" />
              <span>タップして話す</span>
            </div>
            <span className="text-xs text-blue-100">Speak English</span>
          </>
        )}
      </motion.button>
    </div>
  );
};
