import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Flag,
  HelpCircle,
  Lightbulb,
  MessageCircle,
  Pencil,
  Save,
  Sparkles,
  Star,
  ThumbsUp,
  TrendingUp,
  Users,
} from 'lucide-react';
import { isValidLearningCode, normalizeLearningCode } from '../dataContract';
import {
  bootstrapReflection,
  loadClassReflections,
  loadReflectionHistory,
  registerReflectionDevice,
  saveReflection,
  type BootstrapResponse,
  type ReflectionRecordDto,
} from './reflectionApi';

const TOKEN_KEY = 'my-english-growth-device-token';
const localDate = () => new Date().toLocaleDateString('sv-SE');
const draftKey = () => `my-english-growth-draft-${localDate()}`;

type View = 'entry' | 'history' | 'class';

type Draft = {
  todayGoal: string;
  goalRating: number | null;
  selfRegulationRating: number | null;
  reflectionText: string;
};

const emptyDraft: Draft = { todayGoal: '', goalRating: null, selfRegulationRating: null, reflectionText: '' };

const HINTS = [
  { label: 'できたこと', icon: Star, className: 'meg-hint-purple' },
  { label: 'よかった学び方', icon: ThumbsUp, className: 'meg-hint-blue' },
  { label: '授業中に考えていたこと', icon: BookOpen, className: 'meg-hint-green' },
  { label: '気づいたこと', icon: Lightbulb, className: 'meg-hint-yellow' },
  { label: '友達のよかったところ', icon: Users, className: 'meg-hint-pink' },
  { label: '疑問に思ったこと', icon: HelpCircle, className: 'meg-hint-purple' },
  { label: '次に頑張りたいこと', icon: TrendingUp, className: 'meg-hint-blue' },
] as const;

function readToken(): string {
  try { return window.localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}

function saveToken(token: string) {
  try { window.localStorage.setItem(TOKEN_KEY, token); } catch {}
}

function clearToken() {
  try { window.localStorage.removeItem(TOKEN_KEY); } catch {}
}

function readLocalDraft(): Draft | null {
  try {
    const raw = window.localStorage.getItem(draftKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      todayGoal: typeof parsed.todayGoal === 'string' ? parsed.todayGoal : '',
      goalRating: Number.isInteger(parsed.goalRating) ? parsed.goalRating : null,
      selfRegulationRating: Number.isInteger(parsed.selfRegulationRating) ? parsed.selfRegulationRating : null,
      reflectionText: typeof parsed.reflectionText === 'string' ? parsed.reflectionText : '',
    };
  } catch { return null; }
}

function persistLocalDraft(draft: Draft) {
  try { window.localStorage.setItem(draftKey(), JSON.stringify(draft)); } catch {}
}

function recordToDraft(record: ReflectionRecordDto | null): Draft {
  if (!record) return emptyDraft;
  return {
    todayGoal: record.todayGoal || '',
    goalRating: record.goalRating || null,
    selfRegulationRating: record.selfRegulationRating || null,
    reflectionText: record.reflectionText || '',
  };
}

const formatDate = (value: string) => {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' });
};

function Rating({ value, onChange, label }: { value: number | null; onChange: (value: number) => void; label: string }) {
  return <div className="meg-rating-block">
    <p>{label}</p>
    <div className="meg-rating-row">
      {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" aria-pressed={value === n} onClick={() => onChange(n)} className={value === n ? 'meg-rating-selected' : ''}>{n}</button>)}
    </div>
    <div className="meg-rating-caption"><span>まだ十分ではなかった</span><span>よくできた</span></div>
  </div>;
}

function FirstUse({ onRegistered }: { onRegistered: (token: string) => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    const normalized = normalizeLearningCode(code);
    if (!isValidLearningCode(normalized)) { setError('先生から配られた4文字の学習者IDを入力してください。'); return; }
    setBusy(true); setError('');
    try {
      const token = await registerReflectionDevice(normalized);
      saveToken(token);
      onRegistered(token);
    } catch {
      setError('学習者IDを確認できませんでした。先生に確認してください。');
    } finally { setBusy(false); }
  };
  return <div className="meg-first-use">
    <div className="meg-first-card">
      <div className="meg-logo"><BarChart3 /></div>
      <h1>My English Growth</h1>
      <p>今日の英語の学びをふりかえろう</p>
      <div className="meg-first-note">はじめて使うときだけ、AI対話アプリと同じ4文字の学習者IDを入力します。次回からはこのChromebookで自動的に開きます。</div>
      <label>学習者ID</label>
      <input value={code} onChange={(e) => { setCode(normalizeLearningCode(e.target.value)); setError(''); }} maxLength={4} autoCapitalize="characters" autoFocus />
      {error && <p className="meg-error">{error}</p>}
      <button type="button" className="meg-primary" onClick={submit} disabled={busy}>{busy ? '確認しています…' : 'はじめる'}</button>
    </div>
  </div>;
}

function Header({ learningId, view, setView }: { learningId: string; view: View; setView: (view: View) => void }) {
  return <header className="meg-header">
    <div className="meg-brand">
      <div className="meg-logo"><BarChart3 /></div>
      <div><h1>My English Growth</h1><p>今日の英語の学びをふりかえろう</p></div>
    </div>
    <nav className="meg-nav" aria-label="ページ切り替え">
      <button type="button" className={view === 'entry' ? 'active' : ''} onClick={() => setView('entry')}><Pencil />ふりかえり</button>
      <button type="button" className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}><BarChart3 />わたしの成長</button>
      <button type="button" className={view === 'class' ? 'active' : ''} onClick={() => setView('class')}><Users />みんな</button>
    </nav>
    <div className="meg-id-pill">{learningId}</div>
  </header>;
}

function EntryView({ bootstrap, token, onSubmittedChange }: { bootstrap: BootstrapResponse; token: string; onSubmittedChange: (submitted: boolean) => void }) {
  const initial = bootstrap.today ? recordToDraft(bootstrap.today) : (readLocalDraft() || emptyDraft);
  const [draft, setDraft] = useState<Draft>(initial);
  const [status, setStatus] = useState<'draft' | 'submitted'>(bootstrap.today?.status === 'submitted' ? 'submitted' : 'draft');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [showPreviousFull, setShowPreviousFull] = useState(false);
  const firstRender = useRef(true);

  useEffect(() => { onSubmittedChange(status === 'submitted'); }, [status, onSubmittedChange]);

  useEffect(() => {
    persistLocalDraft(draft);
    if (firstRender.current) { firstRender.current = false; return; }
    const timer = window.setTimeout(async () => {
      setSaveState('saving');
      try {
        await saveReflection(token, { ...draft, status });
        setSaveState('saved');
      } catch { setSaveState('error'); }
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [draft, status, token]);

  const submit = async () => {
    if (!draft.todayGoal.trim()) { setMessage('今日のめあてを書いてください。'); return; }
    if (!draft.goalRating || !draft.selfRegulationRating) { setMessage('2つの振り返りを1〜5から選んでください。'); return; }
    if (!draft.reflectionText.trim()) { setMessage('今日の学習を振り返って書いてください。'); return; }
    setSaveState('saving'); setMessage('');
    try {
      await saveReflection(token, { ...draft, status: 'submitted' });
      setStatus('submitted'); setSaveState('saved'); setMessage('今日の学びを記録しました。あとから書き足すこともできます。');
    } catch { setSaveState('error'); setMessage('保存できませんでした。通信状態を確認してもう一度押してください。'); }
  };

  const previous = bootstrap.previous;
  const previousText = previous?.reflectionText || '';
  const excerpt = previousText.length > 150 ? `${previousText.slice(0, 150)}…` : previousText;

  return <main className="meg-main-grid">
    <section className="meg-left">
      <div className="meg-previous-card">
        <div className="meg-section-title"><MessageCircle /><h2>前回のふりかえり</h2>{previous && <span>{formatDate(previous.localDate)}</span>}</div>
        {previous ? <>
          {previous.todayGoal && <p className="meg-previous-goal"><b>めあて：</b>{previous.todayGoal}</p>}
          <p>{showPreviousFull ? previousText : excerpt}</p>
          {previousText.length > 150 && <button type="button" className="meg-text-button" onClick={() => setShowPreviousFull((v) => !v)}>{showPreviousFull ? '短く表示' : '前回の全文を見る'}</button>}
        </> : <p className="meg-muted">前回の振り返りはまだありません。</p>}
      </div>

      <div className="meg-card meg-goal-card">
        <div className="meg-section-title"><Flag /><h2>Today's Goal</h2><strong>今日のめあて</strong></div>
        <textarea value={draft.todayGoal} onChange={(e) => setDraft((d) => ({ ...d, todayGoal: e.target.value.slice(0, 1000) }))} placeholder="今日のめあてを自由に書きましょう。" />
      </div>

      <div className="meg-card meg-reflection-card">
        <div className="meg-section-title"><Pencil /><h2>Today's Reflection</h2><strong>今日の振り返り</strong></div>
        <div className="meg-ratings-grid">
          <Rating value={draft.goalRating} onChange={(goalRating) => setDraft((d) => ({ ...d, goalRating }))} label="① めあてに向かって学ぶことができましたか？" />
          <Rating value={draft.selfRegulationRating} onChange={(selfRegulationRating) => setDraft((d) => ({ ...d, selfRegulationRating }))} label="② 考えたり工夫したりして学ぶことができましたか？" />
        </div>
        <label className="meg-writing-label" htmlFor="reflection-text">今日の学習を振り返って書きましょう。</label>
        <textarea id="reflection-text" className="meg-reflection-textarea" value={draft.reflectionText} onChange={(e) => setDraft((d) => ({ ...d, reflectionText: e.target.value.slice(0, 5000) }))} placeholder="今日の学習をふりかえって、思ったこと、感じたこと、気づいたことなどを自由に書きましょう。" />
        <div className="meg-save-meta"><span>{[...draft.reflectionText].length}文字</span><span className={saveState === 'error' ? 'error' : ''}>{saveState === 'saving' ? '保存しています…' : saveState === 'saved' ? '✓ 自動保存済み' : saveState === 'error' ? '自動保存できませんでした' : ''}</span></div>
        {message && <p className={saveState === 'error' ? 'meg-error' : 'meg-message'}>{message}</p>}
        <button type="button" className="meg-primary meg-save" onClick={submit} disabled={saveState === 'saving'}><Save />{status === 'submitted' ? '更新して保存する' : '保存する'}</button>
      </div>
    </section>

    <aside className="meg-right">
      <div className="meg-card meg-hints-card">
        <div className="meg-hints-head"><Lightbulb /><div><h2>書くヒント</h2><p>こんなことを書いてみよう！</p></div></div>
        <div className="meg-hints-grid">{HINTS.map(({ label, icon: Icon, className }) => <div key={label} className={`meg-hint ${className}`}><Icon /><span>{label}</span></div>)}</div>
        <p className="meg-privacy-note">名前・住所・電話番号など、自分や友達の個人情報は書かないようにしましょう。</p>
      </div>
      <div className="meg-card meg-side-note"><Sparkles /><div><b>大切なのは「正解」を書くことではありません。</b><p>今日の自分が考えたことを、自分の言葉で残してみよう。</p></div></div>
    </aside>
  </main>;
}

function HistoryView({ token }: { token: string }) {
  const [rows, setRows] = useState<ReflectionRecordDto[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { loadReflectionHistory(token).then(setRows).finally(() => setLoading(false)); }, [token]);
  const chronological = useMemo(() => [...rows].reverse().slice(-12), [rows]);
  const width = 760, height = 180, padX = 42, padY = 24;
  const point = (value: number, index: number) => ({
    x: chronological.length <= 1 ? width / 2 : padX + index * ((width - padX * 2) / (chronological.length - 1)),
    y: height - padY - ((value - 1) / 4) * (height - padY * 2),
  });
  const pathFor = (key: 'goalRating' | 'selfRegulationRating') => chronological
    .map((row, i) => row[key] ? point(row[key]!, i) : null)
    .filter(Boolean)
    .map((p: any, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`)
    .join(' ');
  return <main className="meg-wide-page">
    <div className="meg-card"><div className="meg-page-heading"><BarChart3 /><div><h2>わたしの成長</h2><p>前の自分と今の自分を比べてみよう。</p></div></div>
      {loading ? <p>読み込んでいます…</p> : rows.length === 0 ? <p className="meg-muted">保存された振り返りはまだありません。</p> : <>
        <div className="meg-chart-wrap"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="自己評価の変化">
          {[1,2,3,4,5].map((n) => { const y = point(n,0).y; return <g key={n}><line x1={padX} x2={width-padX} y1={y} y2={y} className="meg-grid-line"/><text x="12" y={y+4}>{n}</text></g>; })}
          <path d={pathFor('goalRating')} className="meg-line meg-line-one"/><path d={pathFor('selfRegulationRating')} className="meg-line meg-line-two"/>
          {chronological.map((row,i) => <text key={row.reflectionId} x={point(1,i).x} y={height-3} textAnchor="middle" className="meg-chart-date">{row.localDate.slice(5).replace('-','/')}</text>)}
        </svg></div>
        <div className="meg-chart-legend"><span><i className="one"/>めあてに向かって学べた</span><span><i className="two"/>考えたり工夫したりできた</span></div>
      </>}
    </div>
    <div className="meg-history-list">{rows.map((row) => <article key={row.reflectionId} className="meg-card meg-history-item"><div><b>{formatDate(row.localDate)}</b><span>{row.reflectionCharCount}文字</span></div><h3>Today's Goal</h3><p>{row.todayGoal || '—'}</p><h3>Today's Reflection</h3><p>{row.reflectionText}</p></article>)}</div>
  </main>;
}

function ClassView({ token, submitted }: { token: string; submitted: boolean }) {
  const [rows, setRows] = useState<Array<{ reflectionId: string; localDate: string; todayGoal: string; reflectionText: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!submitted) return;
    setLoading(true); setError('');
    loadClassReflections(token).then(setRows).catch((e: any) => setError(e?.code === 'SUBMIT_FIRST' ? '自分の振り返りを書いたあとに見られます。' : '読み込めませんでした。')).finally(() => setLoading(false));
  }, [token, submitted]);
  return <main className="meg-wide-page"><div className="meg-card"><div className="meg-page-heading"><Users /><div><h2>みんなのふりかえり</h2><p>友達の考え方や学び方から、新しい見方を見つけよう。</p></div></div>
    {!submitted ? <div className="meg-lock-message">自分の今日の振り返りを保存すると、今日のみんなの振り返りを読むことができます。</div> : loading ? <p>読み込んでいます…</p> : error ? <p className="meg-error">{error}</p> : rows.length === 0 ? <p className="meg-muted">今日、公開されている友達の振り返りはまだありません。</p> : <div className="meg-class-grid">{rows.map((row, index) => <article key={row.reflectionId} className="meg-class-card"><span>クラスメイト {index + 1}</span>{row.todayGoal && <><h3>今日のめあて</h3><p>{row.todayGoal}</p></>}<h3>今日の振り返り</h3><p>{row.reflectionText}</p></article>)}</div>}
  </div></main>;
}

export default function ReflectionApp() {
  const [token, setToken] = useState(readToken);
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [view, setView] = useState<View>('entry');
  const [submitted, setSubmitted] = useState(false);

  const load = async (deviceToken: string) => {
    setLoading(true);
    try {
      const data = await bootstrapReflection(deviceToken);
      setBootstrap(data); setSubmitted(data.today?.status === 'submitted');
    } catch {
      clearToken(); setToken(''); setBootstrap(null);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (token) void load(token); }, [token]);

  if (!token) return <FirstUse onRegistered={setToken} />;
  if (loading || !bootstrap) return <div className="meg-loading"><div className="meg-logo"><BarChart3 /></div><p>振り返りを読み込んでいます…</p></div>;

  return <div className="meg-app">
    <div className="meg-shell">
      <Header learningId={bootstrap.learningId} view={view} setView={setView} />
      {view === 'entry' && <EntryView bootstrap={bootstrap} token={token} onSubmittedChange={setSubmitted} />}
      {view === 'history' && <HistoryView token={token} />}
      {view === 'class' && <ClassView token={token} submitted={submitted} />}
    </div>
  </div>;
}
