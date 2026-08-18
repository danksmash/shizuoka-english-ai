import React, { useState, useEffect } from 'react';
import { Mic, Send, Keyboard, Sparkles, ChevronUp, ChevronDown, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { COMMON_HELP_PHRASES } from '../data/curriculum';

interface SpeechInputBarProps {
  isRecording: boolean;
  transcript: string;
  isAiResponding: boolean;
  onToggleRecording: () => void;
  onSendMessage: (text: string) => void;
  onClearTranscript: () => void;
}

export const SpeechInputBar: React.FC<SpeechInputBarProps> = ({
  isRecording,
  transcript,
  isAiResponding,
  onToggleRecording,
  onSendMessage,
  onClearTranscript,
}) => {
  const [manualText, setManualText] = useState('');
  const [showKeyboardInput, setShowKeyboardInput] = useState(false);
  const [showPhrases, setShowPhrases] = useState(false);

  // Sync manual input when speech transcript changes
  useEffect(() => {
    if (transcript) {
      setManualText(transcript);
    }
  }, [transcript]);

  const handleSend = () => {
    const textToSend = manualText.trim();
    if (!textToSend || isAiResponding) return;
    onSendMessage(textToSend);
    setManualText('');
    onClearTranscript();
  };

  const handleSelectPhrase = (phraseText: string) => {
    setManualText(phraseText);
    setShowKeyboardInput(true);
  };

  return (
    <div className="p-3 sm:p-4 bg-white border-t border-slate-100 space-y-2.5">
      {/* Help Chips Toggle & Keyboard Toggle */}
      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={() => setShowPhrases(!showPhrases)}
          className="flex items-center gap-1.5 font-bold text-slate-700 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 px-3 py-1 rounded-full transition-colors cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>お助けフレーズ (困ったとき)</span>
          {showPhrases ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        <button
          type="button"
          onClick={() => setShowKeyboardInput(!showKeyboardInput)}
          className="font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <Keyboard className="w-3.5 h-3.5 text-slate-600" />
          <span>{showKeyboardInput ? 'キーボードをとじる' : '文字で入力する'}</span>
        </button>
      </div>

      {/* Expandable Helpful Phrase Chips */}
      <AnimatePresence>
        {showPhrases && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {COMMON_HELP_PHRASES.map((phrase, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectPhrase(phrase.text)}
                  className="whitespace-nowrap flex-shrink-0 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 border border-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-full transition-all shadow-2xs text-left cursor-pointer"
                >
                  <span className="font-bold text-slate-900">{phrase.text}</span>
                  <span className="ml-1 text-[11px] text-slate-500">({phrase.tip})</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Speaking Preview Box while recording */}
      {isRecording && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-3 flex flex-col gap-1 shadow-xs"
        >
          <div className="flex items-center justify-between text-xs font-bold text-rose-700">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
              音声を聞き取り中…
            </span>
            <span className="text-[11px] text-rose-600 font-semibold">
              話し終えたら下のボタンをもう1度クリック！
            </span>
          </div>
          <div className="text-sm sm:text-base font-bold text-slate-900 min-h-[1.5rem] py-0.5">
            {transcript ? (
              <span className="text-blue-700 font-extrabold">{transcript}</span>
            ) : (
              <span className="text-slate-400 italic font-normal">
                マイクに向かって英語でお話ししてね… (例: I like soccer.)
              </span>
            )}
          </div>
        </motion.div>
      )}

      {/* Optional Manual Keyboard Input Box */}
      {showKeyboardInput && !isRecording && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-50 border border-slate-200 rounded-2xl p-2 flex items-center gap-2"
        >
          <div className="flex-1">
            <input
              type="text"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              placeholder="英語を入力してください..."
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <button
            type="button"
            onClick={handleSend}
            disabled={!manualText.trim() || isAiResponding}
            className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-xs transition-all cursor-pointer ${
              !manualText.trim() || isAiResponding
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>送信</span>
          </button>
        </motion.div>
      )}

      {/* Main 2-Click Speaking Action Button */}
      <div>
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={onToggleRecording}
          disabled={isAiResponding}
          className={`w-full py-3.5 sm:py-4 px-4 rounded-2xl font-black text-base sm:text-lg flex flex-col items-center justify-center gap-0.5 shadow-md transition-all cursor-pointer ${
            isAiResponding
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : isRecording
              ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200 ring-4 ring-rose-200 animate-pulse'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-200'
          }`}
        >
          {isRecording ? (
            <>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 bg-white rounded-full animate-ping" />
                <span>お話し中… 話し終えたらクリック！</span>
              </div>
              <span className="text-xs font-semibold text-rose-100">
                クリックすると話した英語が確定してAIに送信されます
              </span>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Mic className="w-5 h-5 sm:w-6 sm:h-6" />
                <span>Click to Speak (1回クリックして話す)</span>
              </div>
              <span className="text-xs font-semibold text-blue-100">
                話し終えたら、もう1度クリックしてください
              </span>
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
};
