import React, { useState } from 'react';
import { CheckCircle2, KeyRound, MessageCircle, Play } from 'lucide-react';
import { DialogueTopic, StudentProfile, AIStudentProfile } from '../types';
import { AI_STUDENTS_MASTER_LIST, DIALOGUE_TOPICS, TARGET_20_AI_STUDENT_IDS } from '../data/curriculum';
import { stopSpeaking } from '../utils/speech';
import { StudentAvatar } from './StudentAvatar';
import { normalizeLearningCode, isValidLearningCode } from '../dataContract';

interface SetupScreenProps {
  onStartDialogue: (profile: StudentProfile, learningCode: string) => void;
  learningDataEnabled: boolean;
  onValidateLearningCode: (learningCode: string) => Promise<boolean>;
  labelCondition?: 'shown' | 'hidden';
}

const LEARNING_ID_SESSION_KEY = 'ai-exchange-learning-id';

const readRetainedLearningId = () => {
  try {
    return normalizeLearningCode(window.sessionStorage.getItem(LEARNING_ID_SESSION_KEY) || '');
  } catch {
    return '';
  }
};

const retainLearningId = (learningId: string) => {
  try {
    window.sessionStorage.setItem(LEARNING_ID_SESSION_KEY, learningId);
  } catch {
    // Session storage can be unavailable in restricted browser modes; the dialogue still works normally.
  }
};

const countryLabel = (student: AIStudentProfile) =>
  student.countryNative ? `${student.country} (${student.countryNative})` : student.country;

const TARGET_STUDENTS = TARGET_20_AI_STUDENT_IDS
  .map((id) => AI_STUDENTS_MASTER_LIST.find((student) => student.id === id))
  .filter((student): student is AIStudentProfile => Boolean(student));

export const SetupScreen: React.FC<SetupScreenProps> = ({ onStartDialogue, learningDataEnabled, onValidateLearningCode, labelCondition = 'shown' }) => {
  const showLabels = labelCondition === 'shown';
  const [selectedStudentId, setSelectedStudentId] = useState('emma_usa');
  const [selectedTopic, setSelectedTopic] = useState<DialogueTopic>('intro');
  const [durationMinutes, setDurationMinutes] = useState<1 | 2 | 3 | 5>(1);
  const [learningCode, setLearningCode] = useState(readRetainedLearningId);
  const [codeError, setCodeError] = useState('');
  const [checkingCode, setCheckingCode] = useState(false);
  const selectedStudent = TARGET_STUDENTS.find((student) => student.id === selectedStudentId) || TARGET_STUDENTS[0];

  const handleStart = async () => {
    stopSpeaking();
    const normalized = normalizeLearningCode(learningCode);
    if (learningDataEnabled) {
      if (!isValidLearningCode(normalized)) {
        setCodeError('先生から配られた4文字の学習者IDを入力してね');
        return;
      }
      setCheckingCode(true);
      setCodeError('');
      const ok = await onValidateLearningCode(normalized);
      setCheckingCode(false);
      if (!ok) {
        setCodeError('学習者IDを確認できませんでした。先生に確認してください。');
        return;
      }
      retainLearningId(normalized);
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
              <p className="hidden max-w-32 text-[10px] font-bold leading-tight text-slate-600 sm:block">先生から配られた<br />4文字の学習者IDを入力してね</p>
              <div className="relative">
                <div className={`flex items-center gap-2 rounded-xl border-2 bg-white px-3 py-1.5 shadow-sm ${codeError ? 'border-rose-400' : 'border-blue-500'}`}>
                  <KeyRound className="h-4 w-4 text-blue-700" />
                  <span className="text-sm font-black text-slate-700">学習者ID</span>
                  <input value={learningCode} onChange={(e) => { setLearningCode(normalizeLearningCode(e.target.value)); setCodeError(''); }} maxLength={4} autoCapitalize="characters" className="w-20 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-center text-sm font-black tracking-widest outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                {codeError && <p className="absolute right-0 top-full z-20 mt-1 w-72 max-w-[85vw] rounded-lg bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700 shadow">{codeError}</p>}
              </div>
            </div>}
          </div>
        </header>

        <main className="setup-main grid min-h-0 items-stretch gap-2 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
          <section className="setup-student-section flex min-w-0 flex-col">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-black"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs text-white">1</span>会話するAI留学生をえらぼう（全20名）</h2>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{showLabels ? `${selectedStudent.flag} ${selectedStudent.countryJapanese} 選択中` : `${selectedStudent.name} 選択中`}</span>
            </div>
            <div className="setup-student-grid grid flex-1 auto-rows-fr grid-cols-1 gap-2 min-[520px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {TARGET_STUDENTS.map((student) => {
                const selected = student.id === selectedStudentId;
                return <article
                  key={student.id}
                  onClick={() => setSelectedStudentId(student.id)}
                  className={`setup-student-card-compact relative flex min-h-[88px] cursor-pointer flex-col justify-center rounded-xl border-2 bg-white px-3 py-2 shadow-sm transition ${selected ? 'border-blue-600 ring-2 ring-blue-200' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'}`}
                  aria-label={`${student.countryJapanese} ${student.name} ${student.age}歳 ${student.city}`}
                >
                  {selected && <CheckCircle2 className="absolute right-2 top-2 h-4 w-4 fill-blue-600 text-white" />}
                  <p className="setup-student-country pr-6 text-[11px] font-black leading-tight text-slate-800">{showLabels ? `${student.flag} ${student.country}` : 'AI留学生'}</p>
                  <h3 className="setup-student-name mt-1 text-[13px] font-black leading-tight text-slate-950">{student.name}</h3>
                  <p className="setup-student-origin mt-1 text-[10px] font-semibold leading-tight text-slate-600">{student.age}歳{showLabels ? ` · ${student.city}` : ''}</p>
                </article>;
              })}
            </div>
          </section>

          <section className="setup-controls flex min-w-0 flex-col gap-2">
            <div className="setup-profile rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_clamp(132px,16vw,170px)] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {showLabels && <><span className="text-xl">{selectedStudent.flag}</span><p className="text-sm font-black">{selectedStudent.countryJapanese} ({countryLabel(selectedStudent)})</p></>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-baseline gap-2"><h3 className="text-lg font-black">{selectedStudent.name}</h3><span className="text-sm font-black text-blue-700">{selectedStudent.japaneseName}</span></div>
                  <p className="text-sm font-bold text-blue-700">{selectedStudent.age}歳{showLabels ? ` · ${selectedStudent.city}` : ''}</p>
                  <p className="mt-2 rounded-xl border border-blue-100 bg-blue-50/70 p-2 text-[11px] font-semibold leading-relaxed text-slate-700">{showLabels ? selectedStudent.japaneseBio : '好きなものや専攻について英語で話せるAI留学生です。'}</p>
                  <div className="mt-2 grid gap-1 text-[10px] font-semibold text-slate-700">
                    <p><b>❤️ 好き:</b> {selectedStudent.likes.join('、')}</p>
                    <p><b>🎓 専攻:</b> {selectedStudent.major}</p>
                    {showLabels && <p><b>🏛 名所:</b> {selectedStudent.heritageLandmark}</p>}
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

            <button type="button" onClick={handleStart} disabled={checkingCode} className="setup-start flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 text-base font-black text-white shadow-md disabled:opacity-60"><Play className="h-5 w-5 fill-white" />{checkingCode ? 'コードを確認しています…' : '対話をスタートする！（Start）'}</button>
          </section>
        </main>
        <p className="setup-footer pb-0.5 text-center text-[9px] font-semibold text-slate-500">本アプリは学校での英語学習を目的として設計されています。AI（Anthropic API）を利用した英語対話練習を行います。</p>
      </div>
    </div>
  );
};
