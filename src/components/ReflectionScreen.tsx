import React, { useMemo, useState } from 'react';
import { CheckCircle2, MessageCircleHeart, Send } from 'lucide-react';
import type { AIStudentProfile } from '../types';
import type { ReflectionAnswers } from '../dataContract';
import { StudentAvatar } from './StudentAvatar';

interface ReflectionScreenProps {
  aiStudent: AIStudentProfile;
  onSubmit: (answers: ReflectionAnswers) => Promise<void> | void;
  isSaving: boolean;
  saveMessage?: string;
}

const QUESTIONS = [
  { key: 'conveyedIdeas', title: '伝える', text: '自分の考えや気持ちを英語で伝えられた' },
  { key: 'understoodPartner', title: 'わかり合う', text: '相手の話を聞いて、相手のことが分かった' },
  { key: 'continuedConversation', title: '会話を続ける', text: '質問・聞き返し・言いかえなどで会話を続けられた' },
  { key: 'noticedLanguageCulture', title: 'ことば・文化に気づく', text: '英語の表現や文化について新しい発見があった' },
] as const;

export const ReflectionScreen: React.FC<ReflectionScreenProps> = ({ aiStudent, onSubmit, isSaving, saveMessage }) => {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [freeComment, setFreeComment] = useState('');
  const complete = useMemo(() => QUESTIONS.every((q) => Number.isInteger(ratings[q.key])), [ratings]);

  const submit = async () => {
    if (!complete || isSaving) return;
    await onSubmit({
      conveyedIdeas: ratings.conveyedIdeas,
      understoodPartner: ratings.understoodPartner,
      continuedConversation: ratings.continuedConversation,
      noticedLanguageCulture: ratings.noticedLanguageCulture,
      freeComment: freeComment.trim() || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <header className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm flex items-center gap-4">
          <StudentAvatar student={aiStudent} size="sm" className="w-14 h-14" />
          <div>
            <div className="flex items-center gap-2 text-emerald-700 font-black text-sm"><MessageCircleHeart className="w-5 h-5" />対話のふりかえり</div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">今日の会話をふりかえろう</h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">正解はありません。自分が感じたことを選んでください。</p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {QUESTIONS.map((q) => (
            <section key={q.key} className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-2xs">
              <h2 className="font-black text-slate-900 text-base">{q.title}</h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 min-h-10">{q.text}</p>
              <div className="grid grid-cols-5 gap-1.5 mt-4" aria-label={`${q.title}の自己評価`}>
                {[1,2,3,4,5].map((value) => {
                  const selected = ratings[q.key] === value;
                  return <button key={value} type="button" onClick={() => setRatings((prev) => ({ ...prev, [q.key]: value }))} className={`min-h-11 rounded-xl border font-black text-sm transition ${selected ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50'}`} aria-pressed={selected}>{value}</button>;
                })}
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 mt-1"><span>まだこれから</span><span>よくできた</span></div>
            </section>
          ))}
        </div>

        <section className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-2xs">
          <label className="font-black text-slate-900 text-sm" htmlFor="reflection-comment">今日の発見・次にやってみたいこと（書ける人だけ）</label>
          <textarea id="reflection-comment" value={freeComment} onChange={(e) => setFreeComment(e.target.value.slice(0, 300))} rows={3} className="mt-2 w-full rounded-2xl border border-slate-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="例：次は自分から質問してみたい。" />
        </section>

        {saveMessage && <p className="text-center text-xs font-bold text-slate-600">{saveMessage}</p>}
        <button type="button" disabled={!complete || isSaving} onClick={submit} className="w-full min-h-14 rounded-2xl bg-blue-600 disabled:bg-slate-300 text-white font-black text-base flex items-center justify-center gap-2 shadow-sm">
          {isSaving ? '保存しています…' : <><CheckCircle2 className="w-5 h-5" />ふりかえりを決定してレポートを見る<Send className="w-4 h-4" /></>}
        </button>
      </div>
    </div>
  );
};
