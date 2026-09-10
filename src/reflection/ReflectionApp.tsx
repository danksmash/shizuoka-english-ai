import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CircleHelp,
  Flag,
  Flower2,
  HelpCircle,
  Lightbulb,
  MessageCircle,
  Pencil,
  Search,
  Send,
  Sprout,
  Star,
  UserRound,
  Users,
} from 'lucide-react';
import { isValidLearningCode, normalizeLearningCode } from '../dataContract';
import {
  bootstrapReflection,
  loadClassReflections,
  loadReflectionHistory,
  registerReflectionDevice,
  saveReflection,
  saveReflectionGoal,
  type BootstrapResponse,
  type ClassReflectionDto,
  type ReflectionRecordDto,
} from './reflectionApi';

const TOKEN_KEY = 'my-english-growth-device-token';
const tokyoDate = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
const GOAL_MAX_CHARS = 150;
const REFLECTION_MAX_CHARS = 600;
const draftKey = (token: string) => `my-english-growth-draft-goal150-reflection600-${tokyoDate()}-${token.slice(0, 16)}`;
const limitCharacters = (value: string, max: number) => [...value].slice(0, max).join('');

type View = 'entry' | 'history' | 'class';
type Draft = {
  todayGoal: string;
  goalRating: number | null;
  communicationRating: number | null;
  reflectionText: string;
};
type LocalDraftPayload = { draft: Draft; savedAt: number };

const emptyDraft: Draft = { todayGoal: '', goalRating: null, communicationRating: null, reflectionText: '' };
const HINTS = [
  { label: 'できたこと', icon: Star, tone: 'mint' },
  { label: 'わかったこと', icon: BookOpen, tone: 'blue' },
  { label: 'つたえられたこと', icon: MessageCircle, tone: 'pink' },
  { label: '聞けたこと', icon: CircleHelp, tone: 'purple' },
  { label: '学び方を工夫した', icon: Pencil, tone: 'blue' },
  { label: '考えていたこと', icon: Lightbulb, tone: 'pink' },
  { label: 'くふうしたこと', icon: Flower2, tone: 'amber' },
  { label: '気づいたこと', icon: Search, tone: 'green' },
  { label: '次にがんばりたいこと', icon: Flag, tone: 'violet' },
] as const;

function readToken(): string { try { return window.localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } }
function saveToken(token: string) { try { window.localStorage.setItem(TOKEN_KEY, token); } catch {} }
function clearToken() { try { window.localStorage.removeItem(TOKEN_KEY); } catch {} }

function normalizeDraft(value: unknown): Draft | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const rating = (candidate: unknown) => Number.isInteger(candidate) && Number(candidate) >= 1 && Number(candidate) <= 4 ? Number(candidate) : null;
  return {
    todayGoal: typeof row.todayGoal === 'string' ? limitCharacters(row.todayGoal, GOAL_MAX_CHARS) : '',
    goalRating: rating(row.goalRating),
    communicationRating: rating(row.communicationRating),
    reflectionText: typeof row.reflectionText === 'string' ? limitCharacters(row.reflectionText, REFLECTION_MAX_CHARS) : '',
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

function displayReflectionText(record: ReflectionRecordDto | ClassReflectionDto | null): string {
  return record?.reflectionText || '';
}

function recordToDraft(record: ReflectionRecordDto | null): Draft {
  if (!record) return emptyDraft;
  return {
    todayGoal: record.todayGoal || '',
    goalRating: record.goalRating,
    communicationRating: record.communicationRating,
    reflectionText: record.reflectionText || '',
  };
}

const formatDate = (value: string) => {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' });
};

function AutoFitPreviousReflection({ text }: { text: string }) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const fitText = useCallback(() => {
    const element = textRef.current;
    if (!element) return;
    element.style.removeProperty('font-size');
    element.style.removeProperty('line-height');
    const computed = window.getComputedStyle(element);
    const maxFontSize = Number.parseFloat(computed.fontSize) || 16;
    const lineHeight = Number.parseFloat(computed.lineHeight);
    const lineHeightRatio = Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight / maxFontSize : 1.55;
    const apply = (fontSize: number) => {
      element.style.setProperty('font-size', `${fontSize}px`, 'important');
      element.style.setProperty('line-height', String(lineHeightRatio), 'important');
      return element.scrollHeight <= element.clientHeight + 1;
    };
    if (apply(maxFontSize)) return;
    let low = 9;
    let high = maxFontSize;
    let best = low;
    apply(low);
    for (let index = 0; index < 12; index += 1) {
      const middle = (low + high) / 2;
      if (apply(middle)) { best = middle; low = middle; }
      else high = middle;
    }
    apply(best);
  }, [text]);

  useLayoutEffect(() => {
    const element = textRef.current;
    if (!element) return;
    let frame = window.requestAnimationFrame(fitText);
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(fitText);
    });
    observer.observe(element.parentElement || element);
    return () => { window.cancelAnimationFrame(frame); observer.disconnect(); };
  }, [fitText]);

  return <p ref={textRef} className="meg-previous-summary" data-auto-fit="true">{text}</p>;
}

function FirstUse({ onRegistered }: { onRegistered: (token: string) => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    const normalized = normalizeLearningCode(code);
    if (!isValidLearningCode(normalized)) { setError('先生から配られた4文字の学習者IDを入力してください。'); return; }
    setBusy(true); setError('');
    try { const token = await registerReflectionDevice(normalized); saveToken(token); onRegistered(token); }
    catch (e: any) {
      setError(e?.code === 'TOO_MANY_FAILED_CODE_ATTEMPTS'
        ? '入力の確認回数が多くなっています。少し時間をおいて先生に確認してください。'
        : e?.code === 'REFLECTION_CLASS_NOT_ASSIGNED'
          ? 'この学習者IDには学級が設定されていません。先生に確認してください。'
          : '学習者IDを確認できませんでした。先生に確認してください。');
    } finally { setBusy(false); }
  };
  return <div className="meg-first-use"><div className="meg-first-card">
    <div className="meg-logo"><BarChart3 /></div><h1>My English Growth</h1><p>今日の英語の学びをふりかえろう</p>
    <div className="meg-first-note">はじめて使うときだけ、AI対話アプリと同じ4文字の学習者IDを入力します。次回からはこのChromebookで自動的に開きます。</div>
    <label>学習者ID</label><input value={code} onChange={(e) => { setCode(normalizeLearningCode(e.target.value)); setError(''); }} onKeyDown={(e) => { if (e.key === 'Enter' && !busy) void submit(); }} maxLength={4} autoCapitalize="characters" autoFocus />
    {error && <p className="meg-error">{error}</p>}<button type="button" className="meg-primary" onClick={submit} disabled={busy}>{busy ? '確認しています…' : 'はじめる'}</button>
  </div></div>;
}

function Header({ learningId, view, setView }: { learningId: string; view: View; setView: (view: View) => void }) {
  const dateLabel = tokyoDate().replaceAll('-', '/');
  return <header className="meg-header meg-reference-header">
    <div className="meg-brand meg-reference-brand">
      <div className="meg-brand-sprout" aria-hidden="true"><Sprout /></div>
      <h1>My English Growth <span>— わたしの英語の学び</span></h1>
    </div>
    <div className="meg-header-meta" aria-label="今日の日付と学習者ID">
      <span><CalendarDays />{dateLabel}</span><i aria-hidden="true" /><span><UserRound />ID: {learningId}</span>
    </div>
    <nav className="meg-nav" aria-label="ページ切り替え">
      <button type="button" className={view === 'entry' ? 'active' : ''} onClick={() => setView('entry')}><Pencil />振り返り</button>
      <button type="button" className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}><BarChart3 />私の成長</button>
      <button type="button" className={view === 'class' ? 'active' : ''} onClick={() => setView('class')}><Users />みんなの振り返り</button>
    </nav>
  </header>;
}

function RatingScale({ title, value, onChange }: { title: string; value: number | null; onChange: (value: number) => void }) {
  return <div className="meg-rating-block">
    <h3>{title}</h3>
    <div className="meg-rating-row" role="group" aria-label={title}>
      {[1, 2, 3, 4].map((number) => <button key={number} type="button" aria-pressed={value === number} className={value === number ? 'selected' : ''} onClick={() => onChange(number)}>
        <span className="meg-rating-dot" aria-hidden="true" /><span className="meg-rating-number">{number}</span>
      </button>)}
    </div>
  </div>;
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
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const firstRender = useRef(true);
  const timerRef = useRef<number | null>(null);
  const skipAutosaveOnce = useRef(false);
  const latestGoalRef = useRef(draft.todayGoal);
  const lastGoalSavedRef = useRef(bootstrap.today?.todayGoal || '');
  const goalChars = useMemo(() => [...draft.todayGoal].length, [draft.todayGoal]);
  const reflectionChars = useMemo(() => [...draft.reflectionText].length, [draft.reflectionText]);

  useEffect(() => { latestGoalRef.current = draft.todayGoal; }, [draft.todayGoal]);

  const flushGoalAutosave = useCallback(async () => {
    const goal = latestGoalRef.current;
    if (goal === lastGoalSavedRef.current) return;
    if (timerRef.current !== null) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    setSaveState('saving');
    try {
      const saved = await saveReflectionGoal(token, goal);
      lastGoalSavedRef.current = saved.todayGoal;
      onRecordSaved(saved);
      setSaveState('saved');
    } catch { setSaveState('error'); }
  }, [token, onRecordSaved]);

  useEffect(() => {
    const flushBeforeLeave = () => {
      const goal = latestGoalRef.current;
      if (goal === lastGoalSavedRef.current) return;
      void saveReflectionGoal(token, goal).then((saved) => {
        lastGoalSavedRef.current = saved.todayGoal;
      }).catch(() => undefined);
    };
    window.addEventListener('pagehide', flushBeforeLeave);
    return () => window.removeEventListener('pagehide', flushBeforeLeave);
  }, [token]);

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
    }, 1000);
    return () => { if (timerRef.current !== null) { window.clearTimeout(timerRef.current); timerRef.current = null; } };
  }, [draft, status, token, onRecordSaved]);

  const submit = async () => {
    if (!draft.todayGoal.trim()) { setMessage('今日のめあてを書いてください。'); return; }
    if (draft.goalRating === null) { setMessage('「めあてに向かって取り組めた」を選んでください。'); return; }
    if (draft.communicationRating === null) { setMessage('「相手の話を聞いて分かろうとしたり，自分の気持ちを伝えようとしたりした」を選んでください。'); return; }
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
  const previousChars = [...previousFull].length;

  return <>
    <main className="meg-main-grid meg-entry-grid">
      <section className="meg-left meg-entry-left">
        <div className="meg-previous-card meg-entry-previous">
          <div className="meg-section-title"><BookOpen /><h2>前回のふりかえり</h2>{previous && <span>{formatDate(previous.localDate)}</span>}</div>
          <div className="meg-previous-body">
            {previousFull ? <AutoFitPreviousReflection text={previousFull} /> : <p className="meg-muted">前回の振り返りはまだありません。</p>}
            {previousFull && <div className="meg-field-count">{previousChars} / {REFLECTION_MAX_CHARS}</div>}
          </div>
        </div>

        <div className="meg-card meg-hints-card meg-entry-hints">
          <div className="meg-hints-head"><Lightbulb /><div><h2>今日のふりかえりのヒント</h2></div></div>
          <div className="meg-hint-list">{HINTS.map((hint) => {
            const HintIcon = hint.icon;
            return <div key={hint.label} className={`meg-hint-chip ${hint.tone}`}><HintIcon /><b>{hint.label}</b></div>;
          })}</div>
          <p className="meg-hints-guidance"><HelpCircle />全部を書く必要はありません。</p>
        </div>

        <div className="meg-submit-panel">
          {message && <p className={saveState === 'error' ? 'meg-error' : 'meg-message'}>{message}</p>}
          <button type="button" className="meg-primary meg-submit" onClick={submit} disabled={saveState === 'saving'}><Send />{status === 'submitted' ? '更新して送信する' : '送信する'}</button>
          <div className={saveState === 'error' ? 'meg-submit-status error' : 'meg-submit-status'}>{saveState === 'saving' ? '保存しています…' : saveState === 'saved' ? '✓ 自動保存済み' : saveState === 'error' ? '自動保存できませんでした' : ''}</div>
        </div>
      </section>

      <section className="meg-right meg-entry-right">
        <div className="meg-card meg-goal-card meg-entry-goal">
          <div className="meg-section-title"><Pencil /><h2>今日のめあて</h2></div>
          <div className="meg-goal-input">
            <textarea rows={3} maxLength={GOAL_MAX_CHARS} value={draft.todayGoal} onChange={(e) => setDraft((current) => ({ ...current, todayGoal: limitCharacters(e.target.value, GOAL_MAX_CHARS) }))} onBlur={() => void flushGoalAutosave()} placeholder="前回の振り返りも思い出して、今日のめあてを自分の言葉で書きましょう。" />
            <div className="meg-field-count">{goalChars} / {GOAL_MAX_CHARS}</div>
          </div>
        </div>

        <div className="meg-card meg-entry-ratings">
          <div className="meg-rating-title-row">
            <div className="meg-section-title"><BarChart3 /><h2>ふりかえりポイント</h2></div>
            <div className="meg-rating-scale-labels" aria-label="1はできなかった、4はよくできた">
              <span className="meg-scale-one">できなかった</span><span aria-hidden="true" /><span aria-hidden="true" /><span className="meg-scale-four">よくできた</span>
            </div>
          </div>
          <div className="meg-ratings-grid">
            <RatingScale title="めあてに向かって取り組めた" value={draft.goalRating} onChange={(value) => setDraft((current) => ({ ...current, goalRating: value }))} />
            <RatingScale title="相手の話を聞いて分かろうとしたり，自分の気持ちを伝えようとしたりした" value={draft.communicationRating} onChange={(value) => setDraft((current) => ({ ...current, communicationRating: value }))} />
          </div>
        </div>

        <div className="meg-card meg-reflection-card meg-entry-reflection">
          <div className="meg-section-title"><Pencil /><h2>今日のふりかえり</h2></div>
          <div className="meg-main-reflection">
            <textarea maxLength={REFLECTION_MAX_CHARS} value={draft.reflectionText} onChange={(e) => setDraft((current) => ({ ...current, reflectionText: limitCharacters(e.target.value, REFLECTION_MAX_CHARS) }))} placeholder="今日の学習を振り返って、できたこと、わかったこと、つたえられたこと、聞けたこと、学び方を工夫したこと、考えていたこと、くふうしたこと、気づいたこと、次にがんばりたいことなどから、自分が大切だと思うことを書きましょう。" />
            <div className="meg-field-count">{reflectionChars} / {REFLECTION_MAX_CHARS}</div>
          </div>
          <div className="meg-save-meta"><span>文字数は振り返りのよさを表す点数ではありません。</span></div>
        </div>
      </section>
    </main>
    <footer className="meg-entry-footer"><span><Sprout />小さなふりかえりが、大きな成長につながります。</span><span className="meg-footer-motto">Better English. A Brighter You! <b aria-hidden="true">☀</b></span></footer>
  </>;
}

function HistoryView({ token }: { token: string }) {
  const [rows, setRows] = useState<ReflectionRecordDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { setLoading(true); setError(''); loadReflectionHistory(token).then(setRows).catch(() => setError('学習履歴を読み込めませんでした。')).finally(() => setLoading(false)); }, [token]);
  return <main className="meg-wide-page"><div className="meg-card"><div className="meg-page-heading"><BarChart3 /><div><h2>わたしの成長</h2><p>前の自分が考えていたことと、今の自分を比べてみよう。</p></div></div>
    {loading ? <p>読み込んでいます…</p> : error ? <p className="meg-error">{error}</p> : rows.length === 0 ? <p className="meg-muted">保存された振り返りはまだありません。</p> : <div className="meg-history-list">{rows.map((row) => <article key={row.reflectionId} className="meg-history-item"><div className="meg-history-meta"><b>{formatDate(row.localDate)}</b><span>{row.reflectionCharCount}文字</span></div><h3>今日のめあて</h3><p>{row.todayGoal || '—'}</p><div className="meg-history-ratings"><span>めあてへの取組 {row.goalRating ?? '—'}/4</span><span>聞く・伝える {row.communicationRating ?? '—'}/4</span></div><h3>今日の振り返り</h3><p>{row.reflectionText || '—'}</p></article>)}</div>}
  </div></main>;
}

function ClassCard({ row, index }: { key?: React.Key; row: ClassReflectionDto; index: number }) {
  return <article className="meg-class-card"><span>クラスメイト {index + 1}</span>{row.todayGoal && <><h3>今日のめあて</h3><p>{row.todayGoal}</p></>}<h3>今日の振り返り</h3><p>{row.reflectionText || '—'}</p></article>;
}

function ClassView({ token, submitted }: { token: string; submitted: boolean }) {
  const [rows, setRows] = useState<ClassReflectionDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (!submitted) return; setLoading(true); setError(''); loadClassReflections(token).then(setRows).catch((e: any) => setError(e?.code === 'SUBMIT_FIRST' ? '自分の振り返りを書いたあとに見られます。' : '読み込めませんでした。')).finally(() => setLoading(false)); }, [token, submitted]);
  return <main className="meg-wide-page"><div className="meg-card"><div className="meg-page-heading"><Users /><div><h2>みんなのふりかえり</h2><p>友達の考え方や学び方から、新しい見方を見つけよう。</p></div></div>{!submitted ? <div className="meg-lock-message">自分の今日の振り返りを保存すると、今日のみんなの振り返りを読むことができます。</div> : loading ? <p>読み込んでいます…</p> : error ? <p className="meg-error">{error}</p> : rows.length === 0 ? <p className="meg-muted">今日、公開されている友達の振り返りはまだありません。</p> : <div className="meg-class-grid">{rows.map((row, index) => <ClassCard key={row.reflectionId} row={row} index={index} />)}</div>}</div></main>;
}

export default function ReflectionApp() {
  const [token, setToken] = useState(readToken);
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState<View>('entry');
  const [submitted, setSubmitted] = useState(false);
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
