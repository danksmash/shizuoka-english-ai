import React, { useMemo, useState } from 'react';
import { Award, CheckCircle2, Ear, Lightbulb, MessageCircle, Send } from 'lucide-react';
import type { AIStudentProfile } from '../types';
import type { ReflectionAnswers } from '../dataContract';

interface ReflectionScreenProps {
  aiStudent: AIStudentProfile;
  onSubmit: (answers: ReflectionAnswers) => Promise<void> | void;
  isSaving: boolean;
  saveMessage?: string;
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

export const ReflectionScreen: React.FC<ReflectionScreenProps> = ({ aiStudent, onSubmit, isSaving, saveMessage }) => {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const complete = useMemo(() => ITEMS.every((item) => Number.isInteger(ratings[item.key])), [ratings]);

  const submit = async () => {
    if (!complete || isSaving) return;
    await onSubmit({
      conveyedIdeas: ratings.conveyedIdeas,
      understoodPartner: ratings.understoodPartner,
      noticedLanguageCulture: ratings.noticedLanguageCulture,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-blue-50/30 p-3 sm:p-5">
      <div className="mx-auto max-w-[1460px] space-y-4">
        <header className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">◎</div>
              <div>
                <div className="mb-1 flex flex-wrap gap-2 text-[11px] font-black">
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-800">静岡大学 留学生交流プログラム</span>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">小学校5・6年生向け English</span>
                </div>
                <h1 className="text-lg font-black sm:text-xl">AI留学生 1対1 えいご対話プラクティス</h1>
              </div>
            </div>
            <div className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-black">お名前：5・6年生</div>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white shadow"><Award className="h-9 w-9" /></div>
              <div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">Great Job! 対話ふりかえり</span>
                <h2 className="mt-2 text-2xl font-black text-slate-900">5・6年生さんの英会話レポート</h2>
                <p className="mt-1 text-sm font-semibold text-slate-600">{aiStudent.flag} {aiStudent.name} ({aiStudent.countryJapanese}) 留学生との対話練習記録</p>
              </div>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-800">自分の対話をふりかえろう</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
            <h3 className="mb-3 text-lg font-black text-emerald-700">自分の対話をふりかえろう</h3>
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              {ITEMS.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={item.key} className={`grid gap-3 p-3 sm:grid-cols-[minmax(240px,1fr)_2.3fr] sm:items-center ${index ? 'border-t border-slate-200' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white ${item.iconClass}`}><Icon className="h-6 w-6" /></div>
                      <span className="text-base font-black text-slate-800">{item.label}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:gap-4">
                      {CHOICES.map((choice) => {
                        const selected = ratings[item.key] === choice.value;
                        return <button key={choice.value} type="button" aria-pressed={selected} onClick={() => setRatings((prev) => ({ ...prev, [item.key]: choice.value }))} className={`min-h-12 rounded-xl border-2 px-2 text-sm font-black transition ${selected ? `${choice.className} ring-2 ring-offset-1` : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>{choice.label}</button>;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-center text-xs font-semibold text-slate-600">正解はありません。今日の自分にいちばん近いものを選んでください。</div>
          {saveMessage && <p className="mt-3 text-center text-xs font-bold text-slate-600">{saveMessage}</p>}
          <button type="button" disabled={!complete || isSaving} onClick={submit} className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 text-base font-black text-white shadow disabled:bg-slate-300">
            {isSaving ? '保存しています…' : <><CheckCircle2 className="h-5 w-5" />ふりかえりを決定してレポートを見る<Send className="h-4 w-4" /></>}
          </button>
        </section>
      </div>
    </div>
  );
};
