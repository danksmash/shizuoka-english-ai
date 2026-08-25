import React, { useState } from 'react';
import {
  Globe2,
  Clock,
  MessageCircle,
  Play,
  Volume2,
  User,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { DialogueTopic, StudentProfile, AIStudentProfile } from '../types';
import { AI_STUDENTS_LIST, DIALOGUE_TOPICS } from '../data/curriculum';
import { speakStudentVoice, stopSpeaking } from '../utils/speech';
import { StudentAvatar } from './StudentAvatar';

interface SetupScreenProps {
  onStartDialogue: (profile: StudentProfile) => void;
}

const getStudentCountryDisplay = (student: AIStudentProfile): string => {
  if (student.country && student.countryNative) {
    return `${student.country} (${student.countryNative})`;
  }
  return student.country;
};

export const SetupScreen: React.FC<SetupScreenProps> = ({ onStartDialogue }) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>('emma_usa');
  const [name, setName] = useState<string>('5・6年生');
  const [selectedTopic, setSelectedTopic] = useState<DialogueTopic>('intro');
  const [durationMinutes, setDurationMinutes] = useState<number>(1);
  const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null);

  const selectedStudent =
    AI_STUDENTS_LIST.find((s) => s.id === selectedStudentId) || AI_STUDENTS_LIST[0];

  const handlePlayVoicePreview = (student: AIStudentProfile, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    stopSpeaking();
    setPreviewPlayingId(student.id);

    speakStudentVoice(
      student.characterMessage,
      student,
      0.9,
      undefined,
      () => setPreviewPlayingId(null),
      () => setPreviewPlayingId(null)
    );
  };

  const handleStart = () => {
    stopSpeaking();
    onStartDialogue({
      name: name.trim() || '5・6年生',
      grade: '小学校５・６年生',
      selectedDurationMinutes: durationMinutes,
      selectedTopic,
      selectedAiStudentId: selectedStudentId,
    });
  };

  const selectedTopicData = DIALOGUE_TOPICS.find((t) => t.id === selectedTopic);

  return (
    <div className="w-full bg-gradient-to-b from-slate-50 via-blue-50/25 to-slate-100 p-2.5 sm:p-3.5 md:p-4 max-w-7xl mx-auto flex flex-col gap-2 sm:gap-2.5">
      <header className="bg-white rounded-2xl py-2 px-3 sm:py-2.5 sm:px-4 border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-2xs flex-shrink-0">
            <Globe2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
              <span className="bg-blue-100 text-blue-800 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                静岡大学 留学生交流プログラム
              </span>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                小学校５・６年生向け English
              </span>
            </div>
            <h1 className="text-sm sm:text-base md:text-lg font-black text-slate-900 tracking-tight leading-tight truncate">
              AI留学生 1対1 えいご対話プラクティス
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap sm:flex-nowrap">
          <div className="hidden md:flex items-center gap-1 text-[11px] font-bold text-blue-900 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-xl">
            <span>✨ 好きなことや趣味を英語で伝えてみよう！</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 px-3 py-1 rounded-xl shadow-2xs flex-shrink-0 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-1.5">
              <User className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-slate-700 whitespace-nowrap">お名前:</span>
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ニックネーム等"
              className="bg-white border border-slate-300 rounded-lg px-2 py-0.5 text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 w-32 sm:w-36"
            />
          </div>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-3 items-stretch flex-1">
        <section className="lg:col-span-7 xl:col-span-7 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between mb-1.5 flex-shrink-0">
            <h2 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-black shadow-2xs">1</span>
              <span>会話するAI留学生をえらぼう（全9名）</span>
            </h2>
            <span className="text-[11px] sm:text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              {selectedStudent.flag} {selectedStudent.countryJapanese} 選択中
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5 items-stretch flex-1">
            {AI_STUDENTS_LIST.map((student) => {
              const isSelected = student.id === selectedStudentId;
              const isPlaying = previewPlayingId === student.id;

              return (
                <div
                  key={student.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedStudentId(student.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedStudentId(student.id);
                    }
                  }}
                  className={`relative p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between text-left h-full ${
                    isSelected
                      ? 'bg-blue-50/95 border-blue-600 shadow-sm ring-2 ring-blue-400/40'
                      : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50/90 shadow-2xs'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 text-blue-600 z-10">
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 fill-blue-600 text-white" />
                    </div>
                  )}

                  <div className="flex flex-col h-full justify-between gap-1 w-full">
                    <div className="flex items-center gap-1.5 min-w-0 pr-4">
                      <span className="text-base sm:text-lg leading-none flex-shrink-0">{student.flag}</span>
                      <span className="text-xs sm:text-[13px] font-black text-slate-900 tracking-tight truncate">
                        {getStudentCountryDisplay(student)}
                      </span>
                    </div>

                    <div className="grid grid-cols-[46%_54%] sm:grid-cols-2 gap-1.5 sm:gap-2 items-center w-full min-w-0 flex-1 my-0.5">
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-full aspect-square border border-slate-200/90 shadow-2xs bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center">
                          <StudentAvatar student={student} size="custom" className="w-full h-full object-cover" />
                        </div>
                      </div>

                      <div className="flex flex-col justify-center h-full min-w-0 gap-0.5">
                        <h3 className="text-xs sm:text-[13.5px] font-black text-slate-900 leading-tight truncate">{student.name}</h3>
                        <p className="text-[11px] sm:text-xs font-bold text-blue-700 leading-tight truncate">{student.japaneseName}</p>
                        <p className="text-[10px] sm:text-[11px] font-semibold text-slate-600 leading-tight truncate">{student.age}歳 · {student.city.split(' ')[0]}</p>
                        <div className="truncate mt-0.5">
                          <span className="inline-block text-[9.5px] sm:text-[10.5px] font-bold text-slate-700 bg-slate-100 border border-slate-200/80 px-1 py-0.5 rounded truncate max-w-full">
                            🗣️ {student.accentName.split(' ')[0]}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handlePlayVoicePreview(student, e)}
                      aria-label={`${student.name}の声を聞く`}
                      className={`w-full py-1 sm:py-1.5 px-2 rounded-lg text-[10.5px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer border min-h-[28px] sm:min-h-[30px] ${
                        isPlaying
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs animate-pulse'
                          : 'bg-white hover:bg-blue-50 text-blue-700 border-blue-200 hover:border-blue-300 shadow-2xs'
                      }`}
                    >
                      <Volume2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                      <span className="truncate">{isPlaying ? '再生中...' : '声を聞く'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="lg:col-span-5 xl:col-span-5 grid grid-rows-[minmax(0,1fr)_auto_auto] gap-2 h-full min-h-0 content-start">
          <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200 shadow-2xs flex flex-col gap-1.5 min-h-0">
            <div className="flex items-start gap-2.5">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 border-blue-500 shadow-2xs flex-shrink-0 overflow-hidden">
                <StudentAvatar student={selectedStudent} size="custom" className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-lg sm:text-xl leading-none">{selectedStudent.flag}</span>
                  <span className="text-xs sm:text-sm font-black text-slate-800">
                    {selectedStudent.countryJapanese} ({getStudentCountryDisplay(selectedStudent)})
                  </span>
                </div>
                <h3 className="text-xs sm:text-sm font-black text-slate-900 leading-snug">{selectedStudent.name}</h3>
                <p className="text-[11px] sm:text-xs font-bold text-blue-700">
                  {selectedStudent.japaneseName} · {selectedStudent.age}歳 · {selectedStudent.city}
                </p>
              </div>
            </div>

            <p className="text-[11px] sm:text-xs text-slate-700 leading-relaxed bg-blue-50/70 p-2 rounded-xl border border-blue-200/60 font-medium break-words">
              {selectedStudent.japaneseBio}
            </p>

            <div className="grid grid-cols-1 gap-1 text-[11px] sm:text-xs text-slate-700 font-medium">
              <div className="flex items-start gap-1.5">
                <span className="font-bold text-slate-900 flex-shrink-0">❤️ 好き:</span>
                <span className="text-slate-700 leading-snug break-words">{selectedStudent.likes.join('、')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-900 flex-shrink-0">🎓 専攻:</span>
                <span className="text-slate-700 truncate">{selectedStudent.major}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-900 flex-shrink-0">🏛️ 名所:</span>
                <span className="text-slate-700 truncate">{selectedStudent.heritageLandmark}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-2 sm:p-2.5 border border-slate-200 shadow-2xs">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5 mb-1">
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-black shadow-2xs">2</span>
              <MessageCircle className="w-3.5 h-3.5 text-blue-600" />
              <span>対話テーマをえらぶ</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-1">
              {DIALOGUE_TOPICS.map((topic) => {
                const isSelected = selectedTopic === topic.id;
                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => setSelectedTopic(topic.id)}
                    className={`py-1 px-2 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between border ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-950 ring-2 ring-emerald-400/30 font-bold shadow-2xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-1">
                      <p className="text-[11px] sm:text-xs font-bold text-slate-900 truncate leading-tight">{topic.title}</p>
                      <p className="text-[9px] sm:text-[10px] text-slate-600 truncate">{topic.subTitle}</p>
                    </div>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-2 sm:p-2.5 border border-slate-200 shadow-2xs">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5 mb-1">
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-black shadow-2xs">3</span>
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>対話時間をえらぶ</span>
            </h2>

            <div className="grid grid-cols-5 gap-1">
              {[1, 2, 3, 5, 10].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDurationMinutes(mins)}
                  className={`py-1 sm:py-1.5 rounded-xl font-bold text-xs flex flex-col items-center justify-center transition-all cursor-pointer border ${
                    durationMinutes === mins
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs ring-2 ring-blue-400/30'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <span className="font-extrabold text-[11px] sm:text-xs">{mins}分</span>
                  <span className="text-[8px] sm:text-[9px] opacity-80">{mins * 60}秒</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white rounded-2xl py-1.5 px-3 sm:py-2 sm:px-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold shadow-2xs flex-shrink-0">
            <Sparkles className="w-4 h-4 text-amber-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
              {name}さん × {selectedStudent.name} ({selectedStudent.countryJapanese} {selectedStudent.flag})
            </p>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">
              時間: {durationMinutes}分 | テーマ: {selectedTopicData?.title}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleStart}
          className="w-full sm:w-auto sm:min-w-[200px] px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer flex-shrink-0"
        >
          <Play className="w-4 h-4 fill-white" />
          <span>対話をスタートする！ (Start)</span>
        </button>
      </footer>

      <div className="text-center text-[10px] sm:text-[11px] text-slate-500 font-medium">
        <span>本アプリは学校での英語学習を目的として設計されています。AI（Anthropic API）を利用した英語対話練習を行います。</span>
      </div>
    </div>
  );
};