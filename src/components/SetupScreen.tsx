import React, { useState } from 'react';
import { CheckCircle2, KeyRound, MessageCircle, Play, Volume2 } from 'lucide-react';
import { DialogueTopic, StudentProfile, AIStudentProfile } from '../types';
import { AI_STUDENTS_LIST, DIALOGUE_TOPICS } from '../data/curriculum';
import { speakStudentVoice, stopSpeaking } from '../utils/speech';
import { StudentAvatar } from './StudentAvatar';
import { normalizeLearningCode, isValidLearningCode } from '../dataContract';

interface SetupScreenProps {
  onStartDialogue: (profile: StudentProfile, learningCode: string) => void;
  learningDataEnabled: boolean;
  onValidateLearningCode: (learningCode: string) => Promise<boolean>;
}

const countryLabel = (student: AIStudentProfile) =>
  student.countryNative ? `${student.country} (${student.countryNative})` : student.country;

export const SetupScreen: React.FC<SetupScreenProps> = ({ onStartDialogue, learningDataEnabled, onValidateLearningCode }) => {
  const [selectedStudentId, setSelectedStudentId] = useState('emma_usa');
  const [selectedTopic, setSelectedTopic] = useState<DialogueTopic>('intro');
  const [durationMinutes, setDurationMinutes] = useState<1 | 2 | 3 | 5>(1);
  const [learningCode, setLearningCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [checkingCode, setCheckingCode] = useState(false);
  const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null);
  const selectedStudent = AI_STUDENTS_LIST.find((s) => s.id === selectedStudentId) || AI_STUDENTS_LIST[0];

  const playPreview = (student: AIStudentProfile, event: React.MouseEvent) => {
    event.stopPropagation();
    stopSpeaking();
    setPreviewPlayingId(student.id);
    speakStudentVoice(student.characterMessage, student, 0.9, undefined, () => setPreviewPlayingId(null), () => setPreviewPlayingId(null));
  };

  const handleStart = async () => {
    stopSpeaking();
    const normalized = normalizeLearningCode(learningCode);
    if (learningDataEnabled) {
      if (!isValidLearningCode(normalized)) {
        setCodeError('先生から配られた4文字のコードを入力してね');
        return;
      }
      setCheckingCode(true);
      setCodeError('');
      const ok = await onValidateLearningCode(normalized);
      setCheckingCode(false);
      if (!ok) {
        setCodeError('学習者用コードを確認できませんでした。先生に確認してください。');
        return;
      }
    }
    onStartDialogue(
      {
        name: '5・6年生',
        grade: '小学校５・６年生',
        selectedDurationMinutes: durationMinutes,
        selectedTopic,
        selectedAiStudentId: selectedStudentId as StudentProfile['selectedAiStudentId'],
      },
      learningDataEnabled ? normalized : '',
    );
  };

  return (
    <div className="setup-screen min-h-screen bg-gradient-to-b from-white via-slate-50 to-blue-50/40 p-2 text-slate-900">
      <div className="setup-shell mx-auto w-full max-w-[1720px] gap-2">
        <header className="setup-header rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm sm:px-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xl text-white">◎</div>
              <div className="min-w-0">
                <div className="mb-0.5 flex flex-wrap gap-1.5 text-[10px] font-black sm:gap-2">
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-800">静岡大学 留学生交流プログラム</span>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">小学校5・6年生向け English</span>
                </div>
                <h1 className="truncate text-lg font-black tracking-tight sm:text-xl">AI留学生 1対1 えいご対話プラクティス</h1>
              </div>
            </div>
            {learningDataEnabled && <div className="flex items-center justify-end gap-2">
              <p className="hidden max-w-32 text-[10px] font-bold leading-tight text-slate-600 sm:block">先生から配られた<br />4文字のコードを入力してね</p>
              <div className="relative">
                <div className={`flex items-center gap-2 rounded-xl border-2 bg-white px-3 py-1.5 shadow-sm ${codeError ? 'border-rose-400' : 'border-blue-500'}`}>
                  <KeyRound className="h-4 w-4 text-blue-700" />
                  <span className="text-sm font-black text-slate-700">学習者用コード</span>
                  <input value={learningCode} onChange={(e) => { setLearningCode(normalizeLearningCode(e.target.value)); setCodeError(''); }} maxLength={4} autoCapitalize="characters" placeholder="A7M4" className="w-20 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-center text-sm font-black tracking-widest outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                {codeError && <p className="absolute right-0 top-full z-20 mt-1 w-72 max-w-[85vw] rounded-lg bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700 shadow">{codeError}</p>}
              </div>
            </div>}
          </div>
        </header>

        <main className="setup-main grid min-h-0 items-stretch gap-2 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
          <section className="setup-student-section flex min-w-0 flex-col">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-black"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs text-white">1</span>会話するAI留学生をえらぼう（全9名）</h2>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{selectedStudent.flag} {selectedStudent.countryJapanese} 選択中</span>
            </div>
            <div className="setup-student-grid grid flex-1 auto-rows-fr grid-cols-1 gap-2 min-[520px]:grid-cols-2 lg:grid-cols-3">
              {AI_STUDENTS_LIST.map((student) => {
                const selected = student.id === selectedStudentId;
                return <article key={student.id} onClick={() => setSelectedStudentId(student.id)} className={`setup-student-card relative flex min-h-[174px] cursor-pointer flex-col rounded-2xl border-2 bg-white p-2.5 shadow-sm transition sm:min-h-[184px] ${selected ? 'border-blue-600 ring-2 ring-blue-200' : 'border-slate-200 hover:border-blue-300'}`}>
                  {selected && <CheckCircle2 className="absolute right-2 top-2 h-5 w-5 fill-blue-600 text-white" />}
                  <div className="mb-1.5 truncate pr-7 text-[12px] font-black" title={countryLabel(student)}>{student.flag} {countryLabel(student)}</div>
                  <div className="grid flex-1 grid-cols-[72px_minmax(0,1fr)] items-center gap-2.5 sm:grid-cols-[76px_minmax(0,1fr)]">
                    <StudentAvatar student={student} size="custom" className="h-[72px] w-[72px] rounded-xl border border-slate-200 object-cover sm:h-[76px] sm:w-[76px]" />
                    <div className="min-w-0">
                      <h3 className="truncate text-[13px] font-black">{student.name}</h3>
                      <p className="truncate text-[11px] font-black text-blue-700">{student.japaneseName}</p>
                      <p className="truncate text-[10px] font-semibold text-slate-600">{student.age}歳 · {student.city}</p>
                      <p className="mt-1 line-clamp-2 rounded-md bg-slate-100 px-2 py-1 text-[9px] font-bold leading-tight text-slate-600">🗣 {student.accentName}</p>
                    </div>
                  </div>
                  <button type="button" onClick={(e) => playPreview(student, e)} className={`mt-2 flex min-h-8 items-center justify-center gap-1 rounded-lg border text-[11px] font-black ${previewPlayingId === student.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-blue-200 bg-white text-blue-700 hover:bg-blue-50'}`}><Volume2 className="h-3.5 w-3.5" />{previewPlayingId === student.id ? '再生中...' : '声を聞く'}</button>
                </article>;
              })}
            </div>
          </section>

          <section className="setup-controls flex min-w-0 flex-col gap-2">
            <div className="setup-profile rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_clamp(132px,16vw,170px)] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-xl">{selectedStudent.flag}</span>
                    <p className="text-sm font-black">{selectedStudent.countryJapanese} ({countryLabel(selectedStudent)})</p>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-baseline gap-2"><h3 className="text-lg font-black">{selectedStudent.name}</h3><span className="text-sm font-black text-blue-700">{selectedStudent.japaneseName}</span></div>
                  <p className="text-sm font-bold text-blue-700">{selectedStudent.age}歳 · {selectedStudent.city}</p>
                  <p className="mt-2 rounded-xl border border-blue-100 bg-blue-50/70 p-2 text-[11px] font-semibold leading-relaxed text-slate-700">{selectedStudent.japaneseBio}</p>
                  <div className="mt-2 grid gap-1 text-[10px] font-semibold text-slate-700">
                    <p><b>❤️ 好き:</b> {selectedStudent.likes.join('、')}</p>
                    <p><b>🎓 専攻:</b> {selectedStudent.major}</p>
                    <p><b>🏛 名所:</b> {selectedStudent.heritageLandmark}</p>
                  </div>
                </div>
                <StudentAvatar student={selectedStudent} size="custom" className="mx-auto aspect-[4/5] w-full max-w-[170px] rounded-xl border border-blue-200 object-cover shadow-sm" />
              </div>
            </div>

            <div className="setup-topic rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
              <h2 className="mb-1.5 flex items-center gap-2 text-sm font-black"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs text-white">2</span><MessageCircle className="h-4 w-4 text-blue-600" />対話テーマをえらぶ</h2>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {DIALOGUE_TOPICS.map((topic) => {
                  const selected = selectedTopic === topic.id;
                  return <button key={topic.id} type="button" onClick={() => setSelectedTopic(topic.id)} className={`min-h-10 rounded-xl border px-3 py-1.5 text-left ${selected ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}><span className="block text-xs font-black">{topic.title}</span><span className="block text-[9px] font-semibold text-slate-500">{topic.subTitle}</span></button>;
                })}
              </div>
            </div>

            <div className="setup-duration rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
              <h2 className="mb-1.5 flex items-center gap-2 text-sm font-black"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs text-white">3</span>対話時間をえらぶ</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{([1, 2, 3, 5] as const).map((minutes) => <button key={minutes} type="button" onClick={() => setDurationMinutes(minutes)} className={`rounded-xl border py-1.5 text-center ${durationMinutes === minutes ? 'border-blue-600 bg-blue-600 text-white shadow' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-blue-50'}`}><span className="block text-sm font-black">{minutes}分</span><span className="block text-[9px] font-bold opacity-80">{minutes * 60}秒</span></button>)}</div>
            </div>

            <button type="button" onClick={handleStart} disabled={checkingCode} className="setup-start mt-auto flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 text-base font-black text-white shadow-md disabled:opacity-60"><Play className="h-5 w-5 fill-white" />{checkingCode ? 'コードを確認しています…' : '対話をスタートする！（Start）'}</button>
          </section>
        </main>
        <p className="setup-footer pb-0.5 text-center text-[9px] font-semibold text-slate-500">本アプリは学校での英語学習を目的として設計されています。AI（Anthropic API）を利用した英語対話練習を行います。</p>
      </div>
    </div>
  );
};
