import React, { useMemo } from 'react';
import { ArrowLeft, BarChart3, CalendarDays, MessageCircle, Sparkles } from 'lucide-react';
import { getAIStudentById } from '../data/curriculum';

export interface StudentHistoryRow {
  sessionId: string;
  aiStudentId: string;
  topic: string;
  targetDurationMinutes: number;
  actualDurationSeconds: number;
  endedAt: string;
  lifetimeSessionNumber: number;
  totalTurns: number;
  totalChildWords: number;
  uniqueVocabularyCount: number;
  reflection?: {
    conveyedIdeas?: number;
    understoodPartner?: number;
    continuedConversation?: number;
    noticedLanguageCulture?: number;
  } | null;
}

interface LearningHistoryScreenProps {
  rows: StudentHistoryRow[];
  loading: boolean;
  error?: string;
  onBack: () => void;
}

const reflectionKeys = [
  ['conveyedIdeas', '伝える'],
  ['understoodPartner', 'わかり合う'],
  ['continuedConversation', '会話を続ける'],
  ['noticedLanguageCulture', 'ことば・文化'],
] as const;

export const LearningHistoryScreen: React.FC<LearningHistoryScreenProps> = ({ rows, loading, error, onBack }) => {
  const averages = useMemo(() => reflectionKeys.map(([key, label]) => {
    const values = rows.map((r) => Number(r.reflection?.[key])).filter((v) => Number.isFinite(v) && v >= 1 && v <= 5);
    return { label, value: values.length ? values.reduce((a,b) => a+b, 0) / values.length : null };
  }), [rows]);
  const recent = [...rows].sort((a,b) => String(b.endedAt).localeCompare(String(a.endedAt))).slice(0, 20);
  const totalTurns = rows.reduce((sum, r) => sum + Number(r.totalTurns || 0), 0);
  const totalWords = rows.reduce((sum, r) => sum + Number(r.totalChildWords || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <header className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
          <button type="button" onClick={onBack} className="text-sm font-bold text-blue-700 flex items-center gap-1"><ArrowLeft className="w-4 h-4" />レポートにもどる</button>
          <div className="mt-3 flex items-center gap-3"><BarChart3 className="w-8 h-8 text-blue-600" /><div><h1 className="text-xl sm:text-2xl font-black text-slate-900">わたしの学習履歴</h1><p className="text-xs sm:text-sm text-slate-600">これまでの自分の対話をふりかえります。ほかの人との比較はしません。</p></div></div>
        </header>

        {loading ? <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center font-bold text-slate-600">学習履歴を読み込んでいます…</div> : error ? <div className="bg-rose-50 rounded-3xl border border-rose-200 p-5 text-rose-800 font-bold">{error}</div> : <>
          <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-2xs">
            <h2 className="font-black text-slate-900 flex items-center gap-2"><Sparkles className="w-5 h-5 text-amber-500" />わたしのコミュニケーション</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">{averages.map((item) => <div key={item.label} className="rounded-2xl bg-blue-50 border border-blue-100 p-3 text-center"><p className="text-xs font-bold text-slate-700">{item.label}</p><p className="text-2xl font-black text-blue-700 mt-1">{item.value === null ? '—' : item.value.toFixed(1)}</p><p className="text-[10px] text-slate-500">5段階の平均</p></div>)}</div>
          </section>

          <section className="grid grid-cols-3 gap-2">
            <div className="bg-white border border-slate-200 rounded-2xl p-3 text-center"><p className="text-[10px] text-slate-500">これまでの対話</p><p className="text-xl font-black text-slate-900">{rows.length}回</p></div>
            <div className="bg-white border border-slate-200 rounded-2xl p-3 text-center"><p className="text-[10px] text-slate-500">合計ターン</p><p className="text-xl font-black text-blue-700">{totalTurns}</p></div>
            <div className="bg-white border border-slate-200 rounded-2xl p-3 text-center"><p className="text-[10px] text-slate-500">合計発話語数</p><p className="text-xl font-black text-emerald-700">{totalWords}</p></div>
          </section>

          <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-2xs">
            <h2 className="font-black text-slate-900 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-slate-600" />最近の対話</h2>
            {recent.length === 0 ? <p className="text-sm text-slate-500 mt-4">保存された対話はまだありません。</p> : <div className="space-y-2 mt-4">{recent.map((row) => {
              let name = row.aiStudentId;
              try { name = getAIStudentById(row.aiStudentId as any).name; } catch {}
              const date = row.endedAt ? new Date(row.endedAt).toLocaleDateString('ja-JP') : '';
              return <div key={row.sessionId} className="border border-slate-200 rounded-2xl p-3 flex flex-wrap items-center gap-x-4 gap-y-1"><span className="font-black text-slate-900">第{row.lifetimeSessionNumber || '?'}回</span><span className="text-xs text-slate-600">{date}</span><span className="text-xs font-bold text-blue-700">{name}</span><span className="text-xs text-slate-600 flex items-center gap-1"><MessageCircle className="w-3 h-3" />{row.totalTurns}ターン</span><span className="text-xs text-slate-600">{row.totalChildWords} words</span></div>;
            })}</div>}
          </section>
        </>}
      </div>
    </div>
  );
};
