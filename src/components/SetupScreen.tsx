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

export const SetupScreen: React.FC<SetupScreenProps> = ({ onStartDialogue }) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>('emma_usa');
  const [name, setName] = useState<string>('5・6年生');
  const [selectedTopic, setSelectedTopic] = useState<DialogueTopic>('intro');
  const [durationMinutes, setDurationMinutes] = useState<number>(1);
  const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null);

  const selectedStudent =
    AI_STUDENTS_LIST.find((s) => s.id === selectedStudentId) || AI_STUDENTS_LIST[0];

  const handlePlayVoicePreview = (student: AIStudentProfile, e: React.MouseEvent) => {
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

  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/20 to-slate-100 p-2 sm:p-4 md:p-5 flex flex-col justify-between max-w-7xl mx-auto overflow-y-auto">
      {/* Top Hero Banner */}
      <div className="bg-white rounded-2xl sm:rounded-3xl py-2.5 px-3.5 sm:py-3 sm:px-5 border border-slate-200 shadow-xs mb-3 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs flex-shrink-0">
            <Globe2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                静岡大学 留学生交流プログラム
              </span>
              <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                小学校５・６年生向け English
              </span>
            </div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight">
              AI留学生 1対1 英会話プラクティス
            </h1>
          </div>
        </div>

        {/* Student Name Input */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 px-3.5 py-1.5 rounded-2xl w-full sm:w-auto shadow-2xs flex-shrink-0">
          <User className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500 flex-shrink-0" />
          <span className="text-xs sm:text-sm font-bold text-slate-700 whitespace-nowrap">お名前:</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: たろう"
            className="bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 w-28 sm:w-32"
          />
        </div>
      </div>

      {/* Main Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 flex-1 mb-3.5">
        {/* Left Section: 9 Exchange Students Grid (All 9 Visible) */}
        <div className="lg:col-span-8 flex flex-col">
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-black shadow-2xs">
                1
              </span>
              <span>会話するAI留学生をえらぼう（全9名・9カ国）</span>
            </h2>
            <span className="text-xs sm:text-sm font-bold text-blue-700 bg-blue-50 px-3 py-0.5 rounded-full border border-blue-200">
              全9名から選択中
            </span>
          </div>

          {/* 3x3 Grid for 9 Students */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {AI_STUDENTS_LIST.map((student) => {
              const isSelected = student.id === selectedStudentId;
              const isPlaying = previewPlayingId === student.id;

              return (
                <div
                  key={student.id}
                  onClick={() => setSelectedStudentId(student.id)}
                  className={`relative p-2.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-50/95 border-blue-600 shadow-md ring-2 ring-blue-400/40'
                      : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50/90 shadow-2xs'
                  }`}
                >
                  {/* Selection Checkmark */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 text-blue-600 z-10">
                      <CheckCircle2 className="w-5 h-5 fill-blue-600 text-white" />
                    </div>
                  )}

                  <div className="flex flex-col h-full justify-between gap-1.5">
                    {/* Country & Flag Header */}
                    <div className="flex items-center gap-1.5 pr-5 min-w-0">
                      <span className="text-2xl sm:text-3xl leading-none flex-shrink-0">{student.flag}</span>
                      <span className="text-xs sm:text-sm font-black text-slate-900 truncate tracking-tight">
                        {student.country} ({student.countryNative})
                      </span>
                    </div>

                    {/* Avatar Portrait & Essential Info (Illustration, Name, Age, Accent) */}
                    <div className="flex items-center gap-2.5 my-1 min-w-0">
                      <div className="w-20 h-20 sm:w-22 sm:h-22 border border-slate-200 shadow-2xs bg-slate-100 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center">
                        <StudentAvatar student={student} size="custom" className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1 flex flex-col justify-center">
                        <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight truncate">
                          {student.name}
                        </h3>
                        <p className="text-xs sm:text-sm font-extrabold text-blue-700 truncate leading-tight mt-0.5">
                          {student.japaneseName}
                        </p>
                        <p className="text-xs sm:text-sm font-bold text-slate-600 truncate mt-0.5">
                          {student.age}歳・{student.city.split(' ')[0]}
                        </p>
                        {/* Accent Badge */}
                        <div className="mt-1">
                          <span className="inline-block text-[11px] sm:text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md truncate max-w-full">
                            🗣️ {student.accentName.split(' ')[0]}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Voice Preview Button */}
                    <button
                      type="button"
                      onClick={(e) => handlePlayVoicePreview(student, e)}
                      className={`w-full py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                        isPlaying
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs animate-pulse'
                          : 'bg-white hover:bg-blue-50 text-blue-700 border-blue-200 hover:border-blue-300 shadow-2xs'
                      }`}
                    >
                      <Volume2 className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{isPlaying ? '再生中...' : '声を聞いてみる'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Section: Selected Student Profile & Topic & Time */}
        <div className="lg:col-span-4 flex flex-col justify-between gap-3 min-h-0">
          {/* Selected Student Detail Card */}
          <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 border-blue-500 shadow-2xs flex-shrink-0 overflow-hidden">
                <StudentAvatar student={selectedStudent} size="custom" className="w-full h-full" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xl leading-none">{selectedStudent.flag}</span>
                  <span className="text-xs sm:text-sm font-extrabold text-slate-800">
                    {selectedStudent.country} ({selectedStudent.countryNative})
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 truncate">
                  {selectedStudent.name}
                </h3>
                <p className="text-xs sm:text-sm font-bold text-blue-700 truncate">
                  {selectedStudent.japaneseName} ({selectedStudent.age}歳・{selectedStudent.city})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-snug bg-blue-50/70 p-2.5 rounded-xl border border-blue-200/70 mb-2 font-medium">
              {selectedStudent.japaneseBio}
            </p>

            <div className="space-y-1.5 text-xs font-medium text-slate-700">
              <p className="flex items-center gap-1.5 truncate">
                <span className="font-bold text-slate-900 flex-shrink-0">🎓 専攻:</span>
                <span className="truncate">{selectedStudent.major}</span>
              </p>
              <p className="flex items-center gap-1.5 truncate">
                <span className="font-bold text-slate-900 flex-shrink-0">❤️ 好き:</span>
                <span className="truncate">{selectedStudent.likes.slice(0, 2).join(', ')}</span>
              </p>
            </div>
          </div>

          {/* Time Duration Selector */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-2xs">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5 mb-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-black">
                2
              </span>
              <Clock className="w-4 h-4 text-blue-600" />
              <span>対話時間をえらぶ (1〜10分)</span>
            </h2>

            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 5, 10].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDurationMinutes(mins)}
                  className={`py-2 rounded-xl font-bold text-xs sm:text-sm flex flex-col items-center justify-center transition-all cursor-pointer border ${
                    durationMinutes === mins
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs ring-2 ring-blue-400/30'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <span className="font-extrabold">{mins}分</span>
                  <span className="text-[9px] opacity-80">{mins * 60}秒</span>
                </button>
              ))}
            </div>
          </div>

          {/* Topic Selector */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-2xs">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5 mb-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-black">
                3
              </span>
              <MessageCircle className="w-4 h-4 text-blue-600" />
              <span>対話テーマをえらぶ</span>
            </h2>

            <div className="space-y-1.5">
              {DIALOGUE_TOPICS.map((topic) => {
                const isSelected = selectedTopic === topic.id;
                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => setSelectedTopic(topic.id)}
                    className={`w-full py-1.5 px-2.5 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between border ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-950 ring-2 ring-emerald-400/30 font-bold shadow-2xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">{topic.title}</p>
                      <p className="text-[10px] sm:text-[11px] text-slate-600 truncate">{topic.subTitle}</p>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Start Button Footer */}
      <div className="bg-white rounded-2xl sm:rounded-3xl py-2.5 px-3.5 sm:py-3 sm:px-5 border border-slate-200 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold shadow-2xs flex-shrink-0">
            <Sparkles className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs sm:text-sm md:text-base font-bold text-slate-900">
              {name}さん × {selectedStudent.name} ({selectedStudent.countryJapanese} {selectedStudent.flag})
            </p>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
              対話時間: {durationMinutes}分 ({durationMinutes * 60}秒) | テーマ: {DIALOGUE_TOPICS.find((t) => t.id === selectedTopic)?.title}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleStart}
          className="w-full sm:w-auto px-6 sm:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl sm:rounded-2xl font-black text-sm sm:text-base md:text-lg shadow-md flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer flex-shrink-0"
        >
          <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-white" />
          <span>対話をスタートする！ (Start)</span>
        </button>
      </div>
    </div>
  );
};

