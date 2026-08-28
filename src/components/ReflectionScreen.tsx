import React, { useState } from 'react';
import { Award, BarChart3, Ear, KeyRound, Lightbulb, MessageCircle } from 'lucide-react';
import type { AIStudentProfile, StudentProfile } from '../types';
import type { ReflectionAnswers } from '../dataContract';

interface ReflectionScreenProps {
  aiStudent: AIStudentProfile;
  profile: StudentProfile;
  learningCode?: string;
  totalTurns: number;
  totalWords: number;
  elapsedSeconds: number;
  vocabCount: number;
  onSubmit: (answers: ReflectionAnswers) => Promise<void> | void;
  isSaving: boolean;
  saveMessage?: string;
  onOpenHistory?: () => void;
}

const ITEMS = [
  { key: 'conveyedIdeas', label: '自分の考えを伝える', icon: MessageCircle, iconClass: 'bg-emerald-600' },
  { key: 'understoodPartner', label: '相手の話を聞いて分かる', icon: Ear, iconClass: 'bg-blue-600' },
  { key: 'noticedLanguageCulture', label: '新しい言葉や文化に気づいた', icon: Lightbulb, iconClass: 'bg-amber-600' },
] as const;

const CHOICES = [
  { value: 5, label: 'できた', className: 'border-emerald-400 text-emerald-700 bg-emerald-50' },
  { value: 3, label: '少しできた', className: 'border-blue-400 text-blue-700 bg-blue-50' },
  { value: 1, label: '次はがんばる', className: 'border-orange-400 text-orange-700 bg-orange-50' },
] as const;

type RatingKey = typeof ITEMS[number]['key'];

export const ReflectionScreen: React.FC<ReflectionScreenProps> = ({
  aiStudent,
  profile,
  learningCode,
  totalTurns,
  totalWords,
  elapsedSeconds,
  vocabCount,
  onSubmit,
  isSaving,
  saveMessage,
  onOpenHistory,
}) => {
  const [ratings, setRatings] = useState<Partial<Record<RatingKey, number>>>({});
  const [submitted, setSubmitted] = useState(false);

  const formatTime = (seconds: number) => {
    const safe = Math.max(0, Math.round(seconds));
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${mins}分${String(secs).padStart(2, '0')}秒`;
  };

  const choose = (key: RatingKey, value: number) => {
    if (submitted || isSaving) return;
    const next = { ...ratings, [key]: value };
    setRatings(next);
    if (ITEMS.every((item) => Number.isInteger(next[item.key]))) {
      setSubmitted(true);
      void onSubmit({
        conveyedIdeas: next.conveyedIdeas!,
        understoodPartner: next.understoodPartner!,
        noticedLanguageCulture: next.noticedLanguageCulture!,
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-blue-50/30 p-3 sm:p-5 text-slate-900">
      <div className="mx-auto max-w-[1480px] space-y-4">
        <header className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-2xl font-black text-white">◎</div>
              <div>
                <div className="mb-1 flex flex-wrap gap-2 text-[11px] font-black">
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-800">静岡大学 留学生交流プログラム</span>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">小学校5・6年生向け English</span>
                </div>
                <h1 className="text-lg font-black sm:text-xl">AI留学生 1対1 えいご対話プラクティス</h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-black">お名前：{profile.name || '5・6年生'}</div>
              {learningCode && <div className="flex items-center gap-2 rounded-xl border-2 border-blue-500 bg-white px-4 py-2 text-sm font-black"><KeyRound className="h-4 w-4 text-blue-700"/>学習者用コード <span className="rounded-lg bg-blue-50 px-2 py-1 tracking-widest text-blue-800">{learningCode}</span></div>}
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white shadow"><Award className="h-9 w-9" /></div>
              <div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">Great Job! 対話ふりかえり</span>
                <h2 className="mt-2 text-2xl font-black text-slate-900">{profile.name || '5・6年生'}さんの英会話レポート</h2>
                <p className="mt-1 text-sm font-semibold text-slate-600">{aiStudent.flag} {aiStudent.name} ({aiStudent.countryJapanese}) 留学生との対話練習記録</p>
              </div>
            </div>
            {onOpenHistory && <button type="button" disabled={!submitted || isSaving} onClick={onOpenHistory} className="flex min-h-12 items-center gap-2 rounded-xl border border-blue-200 bg-white px-5 text-sm font-black text-slate-800 shadow-sm disabled:opacity-40"><BarChart3 className="h-5 w-5 text-blue-600"/>わたしの学習履歴</button>}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
            <h3 className="mb-3 text-lg font-black text-emerald-700">自分の対話をふりかえろう</h3>
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              {ITEMS.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={item.key} className={`grid gap-3 p-3 sm:grid-cols-[minmax(260px,1fr)_2.3fr] sm:items-center ${index ? 'border-t border-slate-200' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white ${item.iconClass}`}><Icon className="h-6 w-6" /></div>
                      <span className="text-base font-black text-slate-800">{item.label}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:gap-4">
                      {CHOICES.map((choice) => {
                        const selected = ratings[item.key] === choice.value;
                        return <button key={choice.value} type="button" aria-pressed={selected} disabled={submitted || isSaving} onClick={() => choose(item.key, choice.value)} className={`min-h-12 rounded-xl border-2 px-2 text-sm font-black transition disabled:cursor-default ${selected ? `${choice.className} ring-2 ring-offset-1` : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>{choice.label}</button>;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-center text-xs font-semibold text-slate-500">3つすべて選ぶと、自動で学習履歴に保存し、次のAI対話レポートを表示します。</p>
            {(isSaving || saveMessage) && <p className="mt-2 text-center text-xs font-black text-slate-600">{isSaving ? '保存しています…' : saveMessage}</p>}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center"><p className="text-xs font-black text-slate-500">対話時間 (TIME)</p><p className="mt-3 text-3xl font-black text-slate-900">{formatTime(elapsedSeconds)}</p><p className="mt-2 text-xs font-bold text-slate-500">目標: {profile.selectedDurationMinutes}分</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center"><p className="text-xs font-black text-slate-500">ターン数 (TURNS)</p><p className="mt-3 text-4xl font-black text-blue-600">{totalTurns}</p><p className="mt-2 text-xs font-bold text-slate-500">往復・会話のキャッチボール</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center"><p className="text-xs font-black text-slate-500">発話語数 (WORDS)</p><p className="mt-3 text-4xl font-black text-emerald-600">{totalWords}</p><p className="mt-2 text-xs font-bold text-slate-500">words・あなたの英語発話量</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center"><p className="text-xs font-black text-slate-500">出会った語彙 (VOCAB)</p><p className="mt-3 text-4xl font-black text-amber-600">{vocabCount}</p><p className="mt-2 text-xs font-bold text-slate-500">語・語彙コレクション</p></div>
          </div>
        </section>
      </div>
    </div>
  );
};
