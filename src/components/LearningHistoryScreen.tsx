import React, { useMemo } from 'react';
import { ArrowLeft, BarChart3, CalendarDays, Clock3, MessageCircle, Sparkles } from 'lucide-react';
import { AI_STUDENTS_LIST, DIALOGUE_TOPICS, getAIStudentById } from '../data/curriculum';

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
  ['noticedLanguageCulture', 'ことば・文化'],
] as const;

const formatDuration = (seconds: number) => {
  const sec = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(sec / 60);
  const remain = sec % 60;
  return `${minutes}分${String(remain).padStart(2, '0')}秒`;
};

const topicLabel = (topicId: string) => DIALOGUE_TOPICS.find((topic) => topic.id === topicId)?.title || topicId || '—';

export const LearningHistoryScreen: React.FC<LearningHistoryScreenProps> = ({ rows, loading, error, onBack }) => {
  const averages = useMemo(() => reflectionKeys.map(([key, label]) => {
    const values = rows.map((r) => Number(r.reflection?.[key])).filter((v) => Number.isFinite(v) && v >= 1 && v <= 5);
    return { label, value: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null };
  }), [rows]);

  const recent = useMemo(() => [...rows].sort((a, b) => String(b.endedAt).localeCompare(String(a.endedAt))).slice(0, 20), [rows]);
  const totalTurns = rows.reduce((sum, r) => sum + Number(r.totalTurns || 0), 0);
  const totalWords = rows.reduce((sum, r) => sum + Number(r.totalChildWords || 0), 0);
  const totalDurationSeconds = rows.reduce((sum, r) => sum + Number(r.actualDurationSeconds || 0), 0);
  const totalVocab = rows.reduce((sum, r) => sum + Number(r.uniqueVocabularyCount || 0), 0);

  const mostFrequentTopic = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => counts.set(row.topic, (counts.get(row.topic) || 0) + 1));
    const entry = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return entry ? { label: topicLabel(entry[0]), count: entry[1] } : null;
  }, [rows]);

  const mostFrequentPartner = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => counts.set(row.aiStudentId, (counts.get(row.aiStudentId) || 0) + 1));
    const entry = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!entry) return null;
    const student = AI_STUDENTS_LIST.find((item) => item.id === entry[0]);
    return { label: student?.name || entry[0], count: entry[1] };
  }, [rows]);

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm font-bold text-blue-700"><ArrowLeft className="h-4 w-4" />レポートにもどる</button>
          <div className="mt-3 flex items-center gap-3"><BarChart3 className="h-8 w-8 text-blue-600" /><div><h1 className="text-xl font-black text-slate-900 sm:text-2xl">わたしの学習履歴</h1><p className="text-xs text-slate-600 sm:text-sm">これまでの自分の対話をふりかえります。ほかの人との比較はしません。</p></div></div>
        </header>

        {loading ? <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center font-bold text-slate-600">学習履歴を読み込んでいます…</div> : error ? <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 font-bold text-rose-800">{error}</div> : <>
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-black text-slate-900"><Sparkles className="h-5 w-5 text-amber-500" />わたしのコミュニケーション</h2>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">{averages.map((item) => <div key={item.label} className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-center"><p className="text-xs font-bold text-slate-700">{item.label}</p><p className="mt-1 text-2xl font-black text-blue-700">{item.value === null ? '—' : item.value.toFixed(1)}</p><p className="text-[10px] text-slate-500">ふりかえり平均</p></div>)}</div>
          </section>

          <section className="grid grid-cols-2 gap-2 lg:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center"><p className="text-[10px] text-slate-500">これまでの対話</p><p className="text-xl font-black text-slate-900">{rows.length}回</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center"><p className="text-[10px] text-slate-500">累計対話時間</p><p className="text-xl font-black text-violet-700">{formatDuration(totalDurationSeconds)}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center"><p className="text-[10px] text-slate-500">合計ターン</p><p className="text-xl font-black text-blue-700">{totalTurns}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center"><p className="text-[10px] text-slate-500">合計発話語数</p><p className="text-xl font-black text-emerald-700">{totalWords}</p></div>
            <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-3 text-center lg:col-span-1"><p className="text-[10px] text-slate-500">出会った語彙（各回合計）</p><p className="text-xl font-black text-amber-700">{totalVocab}語</p></div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4"><p className="text-[11px] font-bold text-emerald-800">よく話したテーマ</p><p className="mt-1 text-base font-black text-slate-900">{mostFrequentTopic?.label || '—'}</p><p className="text-xs text-slate-600">{mostFrequentTopic ? `${mostFrequentTopic.count}回` : 'まだ記録がありません'}</p></div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4"><p className="text-[11px] font-bold text-blue-800">よく話したAI留学生</p><p className="mt-1 text-base font-black text-slate-900">{mostFrequentPartner?.label || '—'}</p><p className="text-xs text-slate-600">{mostFrequentPartner ? `${mostFrequentPartner.count}回` : 'まだ記録がありません'}</p></div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="flex items-center gap-2 font-black text-slate-900"><CalendarDays className="h-5 w-5 text-slate-600" />最近の対話</h2>
              <p className="text-[11px] text-slate-500">テーマ・時間・発話量まで、最近の記録をまとめて確認できます。</p>
            </div>
            {recent.length === 0 ? <p className="mt-4 text-sm text-slate-500">保存された対話はまだありません。</p> : <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <div className="hidden grid-cols-[70px_92px_150px_minmax(180px,1fr)_92px_80px_90px] gap-3 bg-slate-50 px-4 py-2 text-[10px] font-black text-slate-500 lg:grid"><span>回</span><span>日付</span><span>AI留学生</span><span>テーマ</span><span>対話時間</span><span>ターン</span><span>発話語数</span></div>
              <div className="divide-y divide-slate-100">{recent.map((row) => {
                let name = row.aiStudentId;
                try { name = getAIStudentById(row.aiStudentId as any).name; } catch {}
                const date = row.endedAt ? new Date(row.endedAt).toLocaleDateString('ja-JP') : '';
                return <div key={row.sessionId} className="grid gap-2 px-4 py-3 lg:grid-cols-[70px_92px_150px_minmax(180px,1fr)_92px_80px_90px] lg:items-center lg:gap-3">
                  <span className="font-black text-slate-900">第{row.lifetimeSessionNumber || '?'}回</span>
                  <span className="text-xs text-slate-600">{date}</span>
                  <span className="truncate text-xs font-bold text-blue-700">{name}</span>
                  <span className="truncate text-xs font-semibold text-slate-700">{topicLabel(row.topic)}</span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-violet-700"><Clock3 className="h-3.5 w-3.5" />{formatDuration(row.actualDurationSeconds)}</span>
                  <span className="flex items-center gap-1 text-xs text-slate-600"><MessageCircle className="h-3.5 w-3.5" />{row.totalTurns}</span>
                  <span className="text-xs font-semibold text-emerald-700">{row.totalChildWords} words</span>
                </div>;
              })}</div>
            </div>}
          </section>
        </>}
      </div>
    </div>
  );
};
