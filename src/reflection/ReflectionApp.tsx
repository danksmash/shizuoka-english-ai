import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Flag,
  HelpCircle,
  Lightbulb,
  MessageCircle,
  Pencil,
  Save,
  Sparkles,
  Star,
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
  type ClassReflectionDto,
  type ReflectionRecordDto,
} from './reflectionApi';

const TOKEN_KEY = 'my-english-growth-device-token';
const tokyoDate = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
const draftKey = (token: string) => `my-english-growth-draft-${tokyoDate()}-${token.slice(0, 16)}`;

type View = 'entry' | 'history' | 'class';
type Draft = {
  todayGoal: string;
  goalRating: number | null;
  selfRegulationRating: number | null;
  reflectionText: string;
};
type LocalDraftPayload = { draft: Draft; savedAt: number };

const emptyDraft: Draft = { todayGoal: '', goalRating: null, selfRegulationRating: null, reflectionText: '' };
const HINTS = [
  'できたこと',
  'よかった学び方',
  '授業中に考えていたこと',
  '気づいたこと',
  '友達のよかったところ',
  '疑問に思ったこと',
  '次に頑張りたいこと',
];

function readToken(): string { try { return window.localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } }
function saveToken(token: string) { try { window.localStorage.setItem(TOKEN_KEY, token); } catch {} }
function clearToken() { try { window.localStorage.removeItem(TOKEN_KEY); } catch {} }

function normalizeDraft(value: unknown): Draft | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const rating = (candidate: unknown) => Number.isInteger(candidate) && Number(candidate) >= 1 && Number(candidate) <= 5 ? Number(candidate) : null;
  return {
    todayGoal: typeof row.todayGoal === 'string' ? row.todayGoal : '',
    goalRating: rating(row.goalRating),
    selfRegulationRating: rating(row.selfRegulationRating),
    reflectionText: typeof row.reflectionText === 'string' ? row.reflectionText : '',
  };
}

function readLocalDraft(token: string): LocalDraftPayload | null {
  try {
    const raw = window.localStorage.getItem(draftKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { draft?: unknown; savedAt?: unknown };
    const draft = normalizeDraft(parsed.draft);
    const savedAt = Number(parsed.savedAt || 0);
    return draft && Number.isFinite(savedAt) ? { draft, savedAt } : null;
  } catch { return null; }
}
function persistLocalDraft(token: string, draft: Draft) {
  try { window.localStorage.setItem(draftKey(token), JSON.stringify({ draft, savedAt: Date.now() })); } catch {}
}

function legacySixPartText(record: Pick<ReflectionRecordDto, 'achievements' | 'languageUsed' | 'thinking' | 'difficultyStrategy' | 'languageCultureAwareness' | 'nextGoal'> | ClassReflectionDto): string {
  const parts: Array<[string, string]> = [
    ['できたこと', record.achievements || ''],
    ['使ったことば', record.languageUsed || ''],
    ['授業中に考えていたこと', record.thinking || ''],
    ['困ったこと・工夫', record.difficultyStrategy || ''],
    ['言葉や文化について気づいたこと', record.languageCultureAwareness || ''],
    ['次に頑張りたいこと', record.nextGoal || ''],
  ];
  return parts.filter(([, value]) => value.trim()).map(([label, value]) => `【${label}】\n${value}`).join('\n\n');
}

function displayReflectionText(record: ReflectionRecordDto | ClassReflectionDto | null): string {
  if (!record) return '';
  return record.reflectionText || legacySixPartText(record);
}

function recordToDraft(record: ReflectionRecordDto | null): Draft {
  if (!record) return emptyDraft;
  return {
    todayGoal: record.todayGoal || '',
    goalRating: record.goalRating,
    selfRegulationRating: record.selfRegulationRating,
    reflectionText: displayReflectionText(record),
  };
}

const formatDate = (value: string) => {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' });
};

function FirstUse({ onRegistered }: { onRegistered: (token: string) => void }) {
  const [code, setCode] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const submit = async () => {
    const normalized = normalizeLearningCode(code);
    if (!isValidLearningCode(normalized)) { setError('先生から配られた4文字の学習者IDを入力してください。'); return; }
    setBusy(true); setError('');
    try { const token = await registerReflectionDevice(normalized); saveToken(token); onRegistered(token); }
    catch (e: any) {
      setError(e?.code === 'TOO_MANY_FAILED_CODE_ATTEMPTS'
        ? '入力の確認回数が多くなっています。少し時間をおいて先生に確認してください。'
        : '学習者IDを確認できませんでした。先生に確認してください。');
    }
    finally { setBusy(false); }
  };
  return <div className="meg-first-use"><div className="meg-first-card">
    <div className="meg-logo"><BarChart3 /></div><h1>My English Growth</h1><p>今日の英語の学びをふりかえろう</p>
    <div className="meg-first-note">はじめて使うときだけ、AI対話アプリと同じ4文字の学習者IDを入力します。次回からはこのChromebookで自動的に開きます。</div>
    <label>学習者ID</label><input value={code} onChange={(e) => { setCode(normalizeLearningCode(e.target.value)); setError(''); }} onKeyDown={(e) => { if (e.key === 'Enter' && !busy) void submit(); }} maxLength={4} autoCapitalize="characters" autoFocus />
    {error && <p className="meg-error">{error}</p>}<button type="button" className="meg-primary" onClick={submit} disabled={busy}>{busy ? '確認しています…' : 'はじめる'}</button>
  </div></div>;
}

function Header({ learningId, view, setView }: { learningId: string; view: View; setView: (view: View) => void }) {
  return <header className="meg-header"><div className="meg-brand"><div className="meg-logo"><BarChart3 /></div><div><h1>My English Growth</h1><p>今日の英語の学びをふりかえろう</p></div></div>
    <nav className="meg-nav" aria-label="ページ切り替え"><button type="button" className={view === 'entry' ? 'active' : ''} onClick={() => setView('entry')}><Pencil />ふりかえり</button><button type="button" className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}><BarChart3 />わたしの成長</button><button type="button" className={view === 'class' ? 'active' : ''} onClick={() => setView('class')}><Users />みんな</button></nav>
    <div className="meg-id-pill">{learningId}</div></header>;
}

function RatingScale({ title, value, onChange }: { title: string; value: number | null; onChange: (value: number) => void }) {
  return <div className="meg-rating-block"><h3>{title}</h3><div className="meg-rating-row" role="group" aria-label={title}>
    {[1, 2, 3, 4, 5].map((number) => <button key={number} type="button" aria-pressed={value === number} className={value === number ? 'selected' : ''} onClick={() => onChange(number)}>{number}</button>)}
  </div><div className="meg-rating-labels"><span>まだ十分ではなかった</span><span>よくできた</span></div></div>;
}

function EntryView({ bootstrap, token, onSubmittedChange, onRecordSaved }: { bootstrap: BootstrapResponse; token: string; onSubmittedChange: (submitted: boolean) => void; onRecordSaved: (record: ReflectionRecordDto) => void }) {
  const [draft, setDraft] = useState<Draft>(() => {
    const serverDraft = recordToDraft(bootstrap.today);
    const local = readLocalDraft(token);
    const serverUpdatedAt = Date.parse(bootstrap.today?.updatedAt || '') || 0;
    if (local && (!bootstrap.today || local.savedAt > serverUpdatedAt)) return local.draft;
    return serverDraft;
  });
  const [status, setStatus] = useState<'draft' | 'submitted'>(bootstrap.today?.status === 'submitted' ? 'submitted' : 'draft');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle'); const [message, setMessage] = useState('');
  const firstRender = useRef(true); const timerRef = useRef<number | null>(null); const skipAutosaveOnce = useRef(false);
  const reflectionChars = useMemo(() => [...draft.reflectionText].length, [draft.reflectionText]);

  useEffect(() => { onSubmittedChange(status === 'submitted'); }, [status, onSubmittedChange]);
  useEffect(() => {
    persistLocalDraft(token, draft);
    if (firstRender.current) { firstRender.current = false; return; }
    if (skipAutosaveOnce.current) { skipAutosaveOnce.current = false; return; }
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      setSaveState('saving');
      try {
        const saved = await saveReflection(token, { ...draft, status });
        onRecordSaved(saved);
        setSaveState('saved');
      } catch { setSaveState('error'); }
      finally { timerRef.current = null; }
    }, 1500);
    return () => { if (timerRef.current !== null) { window.clearTimeout(timerRef.current); timerRef.current = null; } };
  }, [draft, status, token, onRecordSaved]);

  const submit = async () => {
    if (!draft.todayGoal.trim()) { setMessage('今日のめあてを書いてください。'); return; }
    if (draft.goalRating === null) { setMessage('「今日のめあてに向かって学べたか」を選んでください。'); return; }
    if (draft.selfRegulationRating === null) { setMessage('「自分で考えたり工夫したりして学べたか」を選んでください。'); return; }
    if (!draft.reflectionText.trim()) { setMessage('今日の振り返りを書いてください。'); return; }
    if (timerRef.current !== null) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    setSaveState('saving'); setMessage('');
    try {
      const saved = await saveReflection(token, { ...draft, status: 'submitted' });
      skipAutosaveOnce.current = true;
      setStatus('submitted'); onRecordSaved(saved); setSaveState('saved');
      setMessage('今日の学びを記録しました。あとから書き足すこともできます。');
    } catch { setSaveState('error'); setMessage('保存できませんでした。通信状態を確認してもう一度押してください。'); }
  };

  const previous = bootstrap.previous;
  const previousFull = displayReflectionText(previous);
  const previousSummary = previousFull.length > 260 ? `${previousFull.slice(0, 260)}…` : previousFull;
  return <main className="meg-main-grid"><section className="meg-left">
    <div className="meg-previous-card"><div className="meg-section-title"><MessageCircle /><h2>前回のふりかえり</h2>{previous && <span>{formatDate(previous.localDate)}</span>}</div>
      {previous ? <>{previous.todayGoal && <p className="meg-previous-goal"><b>前回のめあて：</b>{previous.todayGoal}</p>}{previousSummary && <p className="meg-previous-summary">{previousSummary}</p>}</> : <p className="meg-muted">前回の振り返りはまだありません。</p>}
    </div>
    <div className="meg-card meg-goal-card"><div className="meg-section-title"><Flag /><h2>Today's Goal</h2><strong>今日のめあて</strong></div><textarea value={draft.todayGoal} onChange={(e) => setDraft((current) => ({ ...current, todayGoal: e.target.value.slice(0, 1000) }))} placeholder="前回の振り返りも思い出して、今日のめあてを自分の言葉で書きましょう。" /></div>
    <div className="meg-card meg-reflection-card"><div className="meg-section-title"><Pencil /><h2>Today's Reflection</h2><strong>今日の振り返り</strong></div>
      <div className="meg-ratings-grid"><RatingScale title="今日のめあてに向かって学ぶことができましたか？" value={draft.goalRating} onChange={(value) => setDraft((current) => ({ ...current, goalRating: value }))} /><RatingScale title="自分で考えたり、工夫したりしながら学ぶことができましたか？" value={draft.selfRegulationRating} onChange={(value) => setDraft((current) => ({ ...current, selfRegulationRating: value }))} /></div>
      <div className="meg-main-reflection"><h3>今日の学習を振り返って、考えたことを詳しく書こう。</h3><textarea value={draft.reflectionText} onChange={(e) => setDraft((current) => ({ ...current, reflectionText: e.target.value.slice(0, 12000) }))} placeholder="できたこと、学び方、考えていたこと、気づいたこと、友達から学んだこと、疑問、次に頑張りたいことなどから、自分が大切だと思うことを書きましょう。" /><div className="meg-field-count">{reflectionChars}文字</div></div>
      <div className="meg-save-meta"><span>文字数は振り返りのよさを表す点数ではありません。</span><span className={saveState === 'error' ? 'error' : ''}>{saveState === 'saving' ? '保存しています…' : saveState === 'saved' ? '✓ 自動保存済み' : saveState === 'error' ? '自動保存できませんでした' : ''}</span></div>
      {message && <p className={saveState === 'error' ? 'meg-error' : 'meg-message'}>{message}</p>}<button type="button" className="meg-primary meg-save" onClick={submit} disabled={saveState === 'saving'}><Save />{status === 'submitted' ? '更新して保存する' : '今日の振り返りを保存する'}</button>
    </div></section>
    <aside className="meg-right"><div className="meg-card meg-hints-card"><div className="meg-hints-head"><Lightbulb /><div><h2>振り返りのヒント</h2><p>全部を書く必要はありません。自分が大切だと思うことを選ぼう。</p></div></div><div className="meg-hint-list">{HINTS.map((hint, index) => <div key={hint}><span>{index + 1}</span><b>{hint}</b></div>)}</div><p className="meg-privacy-note">名前・住所・電話番号など、自分や友達の個人情報は書かないようにしましょう。</p></div>
      <div className="meg-card meg-side-note"><TrendingUp /><div><b>次の授業につなげよう</b><p>前回の振り返りを読み返しながら、次の自分のめあてを考えていこう。</p></div></div></aside>
  </main>;
}

function HistoryView({ token }: { token: string }) {
  const [rows, setRows] = useState<ReflectionRecordDto[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { setLoading(true); setError(''); loadReflectionHistory(token).then(setRows).catch(() => setError('学習履歴を読み込めませんでした。')).finally(() => setLoading(false)); }, [token]);
  return <main className="meg-wide-page"><div className="meg-card"><div className="meg-page-heading"><BarChart3 /><div><h2>わたしの成長</h2><p>前の自分が考えていたことと、今の自分を比べてみよう。</p></div></div>
    {loading ? <p>読み込んでいます…</p> : error ? <p className="meg-error">{error}</p> : rows.length === 0 ? <p className="meg-muted">保存された振り返りはまだありません。</p> : <div className="meg-history-list">{rows.map((row) => <article key={row.reflectionId} className="meg-history-item"><div className="meg-history-meta"><b>{formatDate(row.localDate)}</b><span>{row.reflectionCharCount}文字</span></div><h3>今日のめあて</h3><p>{row.todayGoal || '—'}</p><div className="meg-history-ratings"><span>めあて {row.goalRating ?? '—'}/5</span><span>考え・工夫 {row.selfRegulationRating ?? '—'}/5</span></div><h3>今日の振り返り</h3><p>{displayReflectionText(row) || '—'}</p></article>)}</div>}
  </div></main>;
}

function ClassCard({ row, index }: { key?: React.Key; row: ClassReflectionDto; index: number }) {
  return <article className="meg-class-card"><span>クラスメイト {index + 1}</span>{row.todayGoal && <><h3>今日のめあて</h3><p>{row.todayGoal}</p></>}<h3>今日の振り返り</h3><p>{displayReflectionText(row) || '—'}</p></article>;
}

function ClassView({ token, submitted }: { token: string; submitted: boolean }) {
  const [rows, setRows] = useState<ClassReflectionDto[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (!submitted) return; setLoading(true); setError(''); loadClassReflections(token).then(setRows).catch((e: any) => setError(e?.code === 'SUBMIT_FIRST' ? '自分の振り返りを書いたあとに見られます。' : '読み込めませんでした。')).finally(() => setLoading(false)); }, [token, submitted]);
  return <main className="meg-wide-page"><div className="meg-card"><div className="meg-page-heading"><Users /><div><h2>みんなのふりかえり</h2><p>友達の考え方や学び方から、新しい見方を見つけよう。</p></div></div>{!submitted ? <div className="meg-lock-message">自分の今日の振り返りを保存すると、今日のみんなの振り返りを読むことができます。</div> : loading ? <p>読み込んでいます…</p> : error ? <p className="meg-error">{error}</p> : rows.length === 0 ? <p className="meg-muted">今日、公開されている友達の振り返りはまだありません。</p> : <div className="meg-class-grid">{rows.map((row, index) => <ClassCard key={row.reflectionId} row={row} index={index} />)}</div>}</div></main>;
}

export default function ReflectionApp() {
  const [token, setToken] = useState(readToken); const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null); const [loading, setLoading] = useState(Boolean(token)); const [loadError, setLoadError] = useState(''); const [view, setView] = useState<View>('entry'); const [submitted, setSubmitted] = useState(false);
  const load = useCallback(async (deviceToken: string) => {
    setLoading(true); setLoadError('');
    try { const data = await bootstrapReflection(deviceToken); setBootstrap(data); setSubmitted(data.today?.status === 'submitted'); }
    catch (e: any) {
      if (e?.code === 'INVALID_REFLECTION_DEVICE' || e?.code === 'REFLECTION_DEVICE_REBIND_REQUIRED') {
        clearToken(); setToken(''); setBootstrap(null);
      } else {
        setLoadError('振り返りを読み込めませんでした。通信状態を確認して、もう一度読み込んでください。');
      }
    } finally { setLoading(false); }
  }, []);
  const handleRecordSaved = useCallback((record: ReflectionRecordDto) => {
    setBootstrap((current) => current ? { ...current, today: record } : current);
    setSubmitted(record.status === 'submitted');
  }, []);
  useEffect(() => { if (token) void load(token); }, [token, load]);
  if (!token) return <FirstUse onRegistered={(registeredToken) => { setLoadError(''); setToken(registeredToken); }} />;
  if (loading) return <div className="meg-loading"><div className="meg-logo"><BarChart3 /></div><p>振り返りを読み込んでいます…</p></div>;
  if (!bootstrap) return <div className="meg-first-use"><div className="meg-first-card"><div className="meg-logo"><HelpCircle /></div><h1>My English Growth</h1><p>{loadError || '振り返りを読み込めませんでした。'}</p><button type="button" className="meg-primary" onClick={() => void load(token)}>もう一度読み込む</button></div></div>;
  return <div className="meg-app"><div className="meg-shell"><Header learningId={bootstrap.learningId} view={view} setView={setView} />{view === 'entry' && <EntryView bootstrap={bootstrap} token={token} onSubmittedChange={setSubmitted} onRecordSaved={handleRecordSaved} />}{view === 'history' && <HistoryView token={token} />}{view === 'class' && <ClassView token={token} submitted={submitted} />}</div></div>;
}
