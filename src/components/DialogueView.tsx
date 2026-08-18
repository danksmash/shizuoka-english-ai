import React, { useEffect, useRef } from 'react';
import { Volume2, User, Sparkles } from 'lucide-react';
import { ChatMessage, AIStudentProfile } from '../types';
import { StudentAvatar } from './StudentAvatar';

interface DialogueViewProps {
  messages: ChatMessage[];
  studentName: string;
  aiStudent: AIStudentProfile;
  isAiResponding: boolean;
  onPlayAudio: (text: string) => void;
}

export const DialogueView: React.FC<DialogueViewProps> = ({
  messages,
  studentName,
  aiStudent,
  isAiResponding,
  onPlayAudio,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isAiResponding]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 scroll-smooth"
    >
      {/* Welcome Banner */}
      <div className="text-center py-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-xs font-semibold text-slate-600">
          <span>{aiStudent.flag}</span>
          <span>{aiStudent.name} との英語対話セッション (小学校５・６年生向け)</span>
        </span>
      </div>

      {/* Messages Stream */}
      {messages.map((msg) => {
        const isAi = msg.sender === 'ai';

        return (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${
              isAi ? 'justify-start' : 'justify-end'
            }`}
          >
            {/* AI Avatar */}
            {isAi && (
              <div className="w-10 h-10 rounded-2xl overflow-hidden flex-shrink-0 border border-blue-200 shadow-2xs bg-blue-100">
                <StudentAvatar student={aiStudent} size="sm" className="w-10 h-10" />
              </div>
            )}

            {/* Bubble Container */}
            <div
              className={`max-w-[85%] sm:max-w-[78%] flex flex-col ${
                isAi ? 'items-start' : 'items-end'
              }`}
            >
              {/* Speaker Label */}
              <div className="flex items-center gap-1.5 mb-1 px-1">
                <span className="text-[11px] font-bold text-slate-500">
                  {isAi ? `${aiStudent.name} (${aiStudent.countryJapanese})` : studentName || 'あなた (5・6年生)'}
                </span>
                {!isAi && msg.wordCount && (
                  <span className="text-[10px] bg-slate-100 text-slate-500 font-mono px-1 rounded">
                    {msg.wordCount} words
                  </span>
                )}
              </div>

              {/* Message Bubble - STRICTLY ENGLISH ONLY */}
              <div
                className={`p-3.5 sm:p-4 rounded-3xl text-sm sm:text-base leading-relaxed relative shadow-2xs ${
                  isAi
                    ? 'bg-blue-50/90 text-slate-900 border border-blue-200/90 rounded-tl-sm'
                    : 'bg-emerald-600 text-white rounded-tr-sm font-medium'
                }`}
              >
                {/* English Text Display */}
                <p className="font-medium tracking-wide">
                  {msg.englishText}
                </p>

                {/* Cultural highlight tag if present */}
                {isAi && msg.culturalNote && (
                  <div className="mt-2 pt-2 border-t border-blue-200/70 flex items-center gap-1 text-[11px] text-blue-800 font-medium">
                    <span className="text-xs">💡</span>
                    <span>{msg.culturalNote}</span>
                  </div>
                )}

                {/* Audio replay button for AI messages */}
                {isAi && (
                  <div className="mt-2 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => onPlayAudio(msg.englishText)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-white/80 hover:bg-white px-2 py-1 rounded-xl border border-blue-200/80 transition-all cursor-pointer shadow-2xs active:scale-95"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>もう一度聞く (Listen again)</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Child Avatar */}
            {!isAi && (
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 border-2 border-emerald-300 text-emerald-800 flex items-center justify-center flex-shrink-0 font-bold text-xs shadow-2xs">
                <User className="w-5 h-5" />
              </div>
            )}
          </div>
        );
      })}

      {/* Thinking / AI Responding Indicator */}
      {isAiResponding && (
        <div className="flex items-start gap-3 justify-start animate-pulse">
          <div className="w-10 h-10 rounded-2xl overflow-hidden flex-shrink-0 border border-blue-200 shadow-2xs bg-blue-100">
            <StudentAvatar student={aiStudent} size="sm" className="w-10 h-10" />
          </div>
          <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-3xl rounded-tl-sm text-xs font-bold text-blue-800 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 animate-spin" />
            <span>{aiStudent.name} is thinking... (返事を考えています)</span>
          </div>
        </div>
      )}
    </div>
  );
};
