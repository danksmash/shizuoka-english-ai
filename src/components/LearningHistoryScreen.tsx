import React, { useMemo, useState } from 'react';
import { ArrowLeft, BarChart3, CalendarDays, ChevronDown, ChevronUp, MessageCircle, Sparkles } from 'lucide-react';
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

const TOPIC_LABELS: Record<string, string> = {
  intro: '自己紹介・あいさつ',
  favorites: '好きなもの・好きなこと',
  culture: '静岡・世界の文化',
  abilities: 'できること',
  free: '自由トーク',
};

type RangeKey = '1m' | '3m' | '6m' | 'all';
type MetricKey = 'words' | 'turns' | 'duration' | 'vocab';

function ratingLabel(value?: number) {
  if (!Number.isFinite(value)) return '—';
  if ((value || 0) >= 5) return 'できた';
  if ((value || 0) >= 3) return '少しできた';
  return '次はがんばる';
}

export const LearningHistoryScreen: React.FC<LearningHistoryScreenProps> = ({ rows, loading, error, onBack }) => {
  const [range, setRange] = useState<RangeKey>('all');
  const [metric, setMetric] = useState<MetricKey>('words');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const sorted = [...rows].sort((a, b) => String(a.endedAt).localeCompare(String(b.endedAt)));
    if (range === 'all' || sorted.length === 0) return sorted;
    const latest = new Date(sorted[sorted.length - 1].endedAt).getTime();
    const days = range === '1m' ? 31 : range === '3m' ? 93 : 186;
    const from = latest - days * 24 * 60 * 60 * 1000;
    return sorted.filter((row) => new Date(row.endedAt).getTime() >= from);
  }, [rows, range]);

  const averages = useMemo(() => reflectionKeys.map(([key, label]) => {
    const values = filtered.map((r) => Number(r.reflection?.[key])).filter((v) => Number.isFinite(v) && v >= 1 && v <= 5);
    return { label, value: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null };
  }), [filtered]);

  const metrics = useMemo(() => ({
    words: { label: '発話語数', suffix: '語', values: filtered.map((r) => Number(r.totalChildWords || 0)) },
    turns: { label: 'ターン数', suffix: '回', values: filtered.map((r) => Number(r.totalTurns || 0)) },
    duration: { label: '対話時間', suffix: '秒', values: filtered.map((r) => Number(r.actualDurationSeconds || 0)) },
    vocab: { label: '出会った語彙', suffix: '語', values: filtered.map((r) => Number(r.uniqueVocabularyCount || 0)) },
  }), [filtered]);
  const activeMetric = metrics[metric];
  const max = Math.max(1, ...activeMetric.values);
  const pointValues = activeMetric.values.map((value, index) => {
    const x = activeMetric.values.length <= 1 ? 350 : 34 + (632 * index) / (activeMetric.values.length - 1);
    const y = 178 - (value / max) * 138;
    return { x, y, value };
  });
  const points = pointValues.map((point) => `${point.x},${point.y}`).join(' ');

  const totalTurns = filtered.reduce((sum, r) => sum + Number(r.totalTurns || 0), 0);
  const totalWords = filtered.reduce((sum, r) => sum + Number(r.totalChildWords || 0), 0);
  const totalSeconds = filtered.reduce((sum, r) => sum + Number(r.actualDurationSeconds || 0), 0);
  const recent = [...filtered].reverse();

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm font-bold text-blue-700"><ArrowLeft className="h-4 w-4" />対話レポートにもどる</button>
          <div className="mt-3 flex items-center gap-3"><BarChart3 className="h-8 w-8 text-blue-600" /><div><h1 className="text-xl font-black text-slate-900 sm:text-2xl">わたしの学習履歴</h1><p className="text-xs text-slate-600 sm:text-sm">これまでの自分自身の変化を見ます。ほかの人との比較やランキングは表示しません。</p></div></div>
        </header>

        {loading ? <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center font-bold text-slate-600">学習履歴を読み込んでいます…</div> : error ? <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 font-bold text-rose-800">{error}</div> : <>
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div><h2 className="font-black text-slate-900">表示する期間</h2><div className="mt-2 flex flex-wrap gap-2">{([['1m','1か月'],['3m','3か月'],['6m','6か月'],['all','全期間']] as const).map(([key,label]) => <button key={key} type="button" onClick={() => setRange(key)} className={`rounded-xl border px-4 py-2 text-xs font-black ${range === key ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>{label}</button>)}</div></div>
              <label className="text-xs font-black text-slate-600">表示項目<select value={metric} onChange={(e) => setMetric(e.target.value as MetricKey)} className="ml-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"><option value="words">発話語数</option><option value="turns">ターン数</option><option value="duration">対話時間</option><option value="vocab">出会った語彙</option></select></label>
            </div>
            <h3 className="mt-5 flex items-center gap-2 font-black text-slate-900"><Sparkles className="h-5 w-5 text-amber-500" />わたしの推移：{activeMetric.label}</h3>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <svg viewBox="0 0 700 205" className="min-w-[620px] w-full" aria-label={`${activeMetric.label}の推移`}>
                {[40,86,132,178].map((y) => <line key={y} x1="34" x2="666" y1={y} y2={y} stroke="#dbe5f2" />)}
                {points && <polyline points={points} fill="none" stroke="#1260ef" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
                {pointValues.map((point, index) => <g key={index}><circle cx={point.x} cy={point.y} r="5" fill="white" stroke="#1260ef" strokeWidth="3"/><text x={point.x} y={point.y - 10} textAnchor="middle" fontSize="11" fill="#1546a0">{point.value}{activeMetric.suffix}</text></g>)}
              </svg>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-black text-slate-900"><Sparkles className="h-5 w-5 text-amber-500" />わたしのコミュニケーション</h2>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">{averages.map((item) => <div key={item.label} className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-center"><p className="text-xs font-bold text-slate-700">{item.label}</p><p className="mt-1 text-2xl font-black text-blue-700">{item.value === null ? '—' : item.value.toFixed(1)}</p><p className="text-[10px] text-slate-500">ふりかえり平均</p></div>)}</div>
          </section>

          <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center"><p className="text-[10px] text-slate-500">これまでの対話</p><p className="text-xl font-black text-slate-900">{filtered.length}回</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center"><p className="text-[10px] text-slate-500">合計対話時間</p><p className="text-xl font-black text-slate-900">{Math.round(totalSeconds / 60)}分</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center"><p className="text-[10px] text-slate-500">合計ターン</p><p className="text-xl font-black text-blue-700">{totalTurns}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center"><p className="text-[10px] text-slate-500">合計発話語数</p><p className="text-xl font-black text-emerald-700">{totalWords}</p></div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-black text-slate-900"><CalendarDays className="h-5 w-5 text-slate-600" />これまでの対話一覧</h2>
            {recent.length === 0 ? <p className="mt-4 text-sm text-slate-500">保存された対話はまだありません。</p> : <div className="mt-4 space-y-2">{recent.map((row) => {
              let name = row.aiStudentId; try { name = getAIStudentById(row.aiStudentId as any).name; } catch {}
              const date = row.endedAt ? new Date(row.endedAt).toLocaleDateString('ja-JP') : '';
              const open = expanded === row.sessionId;
              return <div key={row.sessionId} className="overflow-hidden rounded-2xl border border-slate-200">
                <button type="button" onClick={() => setExpanded(open ? null : row.sessionId)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 bg-white p-3 text-left hover:bg-slate-50"><span className="font-black text-slate-900">第{row.lifetimeSessionNumber || '?'}回</span><span className="text-xs text-slate-600">{date}</span><span className="text-xs font-bold text-blue-700">{name}</span><span className="flex items-center gap-1 text-xs text-slate-600"><MessageCircle className="h-3 w-3" />{row.totalTurns}ターン</span><span className="text-xs text-slate-600">{row.totalChildWords} words</span><span className="ml-auto">{open ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}</span></button>
                {open && <div className="grid gap-2 border-t border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-2 lg:grid-cols-4"><div><b>テーマ</b><br/>{TOPIC_LABELS[row.topic] || row.topic}</div><div><b>対話時間</b><br/>{Math.round(row.actualDurationSeconds || 0)}秒</div><div><b>出会った語彙</b><br/>{row.uniqueVocabularyCount || 0}語</div><div><b>ふりかえり</b><br/>{reflectionKeys.map(([key,label]) => `${label}: ${ratingLabel(row.reflection?.[key])}`).join(' / ')}</div></div>}
              </div>;
            })}</div>}
          </section>
        </>}
      </div>
    </div>
  );
};
