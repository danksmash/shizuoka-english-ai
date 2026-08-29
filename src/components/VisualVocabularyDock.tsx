import React, { useState } from 'react';
import { Volume2, Sparkles, BookOpen, ChevronRight, X } from 'lucide-react';
import { VisualVocabularyItem } from '../types';
import { speakVocabularyWord } from '../utils/speech';

interface VisualVocabularyDockProps {
  vocabularyList: VisualVocabularyItem[];
  latestItem?: VisualVocabularyItem | null;
  onPlayWord?: (word: string) => void;
}

export const VisualVocabularyDock: React.FC<VisualVocabularyDockProps> = ({
  vocabularyList,
  latestItem,
  onPlayWord,
}) => {
  const [playingWordId, setPlayingWordId] = useState<string | null>(null);
  const [isBankOpen, setIsBankOpen] = useState<boolean>(false);

  const handlePlayAudio = (item: VisualVocabularyItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPlayingWordId(item.id);
    if (onPlayWord) {
      onPlayWord(item.word);
      setTimeout(() => setPlayingWordId(null), 1000);
    } else {
      speakVocabularyWord(item.word, 'en-US', () => {
        setPlayingWordId(null);
      });
    }
  };

  if (vocabularyList.length === 0) {
    return (
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3 flex items-center gap-2.5 text-amber-900 text-xs">
        <span className="text-lg">💡</span>
        <div>
          <span className="font-bold text-amber-950">Visual Vocabulary Builder</span>
          <p className="text-[11px] text-amber-800">
            対話に出てきた大切な英単語や表現（5・6年生の学習内容など）がここにカードで表示されます！
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-amber-50/90 via-orange-50/80 to-amber-50/90 border border-amber-200 rounded-2xl p-3 shadow-2xs">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-600 animate-pulse" />
          <span className="text-xs font-bold text-slate-800">
            Vocabulary Builder (語彙カード)
          </span>
          <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {vocabularyList.length} words
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsBankOpen(true)}
          className="text-[11px] font-bold text-amber-800 hover:text-amber-950 flex items-center gap-0.5 transition-colors cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>単語帳を開く</span>
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
        {vocabularyList.slice(-6).map((item) => {
          const isLatest = latestItem?.id === item.id;
          const isPlaying = playingWordId === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handlePlayAudio(item)}
              className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all transform active:scale-95 cursor-pointer border ${
                isLatest
                  ? 'bg-amber-400/20 border-amber-400 ring-2 ring-amber-400/40 shadow-sm'
                  : 'bg-white hover:bg-amber-50 border-amber-200/90 shadow-2xs'
              }`}
              title="タップして発音を聞く"
            >
              <span className="text-xl leading-none">{item.emoji}</span>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-900 leading-tight">
                  {item.word}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {item.japanese}
                </span>
              </div>
              <span
                className={`p-1 rounded-full transition-colors ${
                  isPlaying
                    ? 'bg-amber-500 text-white animate-bounce'
                    : 'bg-slate-100 text-slate-600 hover:bg-amber-200'
                }`}
              >
                <Volume2 className="w-3 h-3" />
              </span>
            </button>
          );
        })}
      </div>

      {isBankOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                <div>
                  <h3 className="font-bold text-base">今回の単語帳 (Vocabulary Bank)</h3>
                  <p className="text-xs text-amber-100">
                    対話で出てきた単語をタップして発音を確認しよう！
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBankOpen(false)}
                className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2.5 flex-1 divide-y divide-slate-100">
              {vocabularyList.map((item) => (
                <div
                  key={item.id}
                  className="pt-2.5 flex items-center justify-between gap-3 hover:bg-amber-50/50 p-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{item.emoji}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{item.word}</span>
                        {item.reading && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-mono">
                            {item.reading}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-amber-900">{item.japanese}</p>
                      {item.exampleSentence && (
                        <p className="text-[11px] text-slate-500 mt-0.5 italic">
                          "{item.exampleSentence}"
                        </p>
                      )}
                      {item.mitsumuraUnit && (
                        <span className="inline-block text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded mt-1 border border-emerald-200/60">
                          {item.mitsumuraUnit}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePlayAudio(item)}
                    className="p-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl flex items-center gap-1 text-xs font-bold shadow-xs cursor-pointer flex-shrink-0"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>発音</span>
                  </button>
                </div>
              ))}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={() => setIsBankOpen(false)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                対話に戻る
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};