import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Flag,
  HelpCircle,
  Languages,
  Lightbulb,
  MessageCircle,
  Pencil,
  Save,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Users,
  Wrench,
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
const localDate = () => new Date().toLocaleDateString('sv-SE');
const draftKey = () => `my-english-growth-draft-${localDate()}`;

type View = 'entry' | 'history' | 'class';
type ReflectionField = 'achievements' | 'languageUsed' | 'thinking' | 'difficultyStrategy' | 'languageCultureAwareness' | 'nextGoal';

type Draft = {
  todayGoal: string;
  achievements: string;
  languageUsed: string;
  thinking: string;
  difficultyStrategy: string;
  languageCultureAwareness: string;
  nextGoal: string;
};

const emptyDraft: Draft = {
  todayGoal: '', achievements: '', languageUsed: '', thinking: '', difficultyStrategy: '', languageCultureAwareness: '', nextGoal: '',
};

const REFLECTION_FIELDS: Array<{
  key: ReflectionField;
  title: string;
  prompt: string;
  placeholder: string;
  icon: React.ComponentType<{ className?: string }>;
  large?: boolean;
}> = [
  { key: 'achievements', title: '1. できたこと', prompt: '今日、できたことは何ですか？', placeholder: '例：相手の好きなスポーツを聞いて、そのあとにいつするのか質問することができた。', icon: Star, large: true },
  { key: 'languageUsed', title: '2. 使ったことば', prompt: '今日、使った英語や新しく使えるようになったことばはありますか？', placeholder: '例：「When do you play soccer?」を使った。「Really?」も会話の中で使うことができた。', icon: Languages },
  { key: 'thinking', title: '3. 授業中に考えていたこと', prompt: '授業中、どんなことを考えながら学習していましたか？', placeholder: '例：相手が答えたことを聞いて、次に何を聞けば会話が続くのか考えていた。', icon: BookOpen, large: true },
  { key: 'difficultyStrategy', title: '4. 困ったこと・工夫', prompt: '困ったことはありましたか？ そのとき、どんな工夫をしましたか？', placeholder: '例：英語が聞き取れなかったので、「One more time, please.」と言ってもう一度聞いた。困らなかった人は、うまくいくために工夫したことを書こう。', icon: Wrench, large: true },
  { key: 'languageCultureAwareness', title: '5. 言葉や文化について気づいたこと', prompt: '英語のことばや文化について、気づいたこと・初めて知ったことはありますか？', placeholder: '例：国によって朝ごはんに食べるものが違うことに気づいた。「like」は食べ物にもスポーツにも使えることが分かった。', icon: Lightbulb, large: true },
  { key: 'nextGoal', title: '6. 次に頑張りたいこと', prompt: '次の授業では、どんなことを頑張りたいですか？', placeholder: '例：次は、相手の答えに「Really?」や「Me too.」と反応してから質問したい。', icon: TrendingUp },
];

function readToken(): string { try { return window.localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } }
function saveToken(token: string) { try { window.localStorage.setItem(TOKEN_KEY, token); } catch {} }
function clearToken() { try { window.localStorage.removeItem(TOKEN_KEY); } catch {} }

function readLocalDraft(): Draft | null {
  try {
    const raw = window.localStorage.getItem(draftKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Object.fromEntries(Object.keys(emptyDraft).map((key) => [key, typeof parsed[key] === 'string' ? parsed[key] : ''])) as Draft;
  } catch { return null; }
}
function persistLocalDraft(draft: Draft) { try { window.localStorage.setItem(draftKey(), JSON.stringify(draft)); } catch {} }

function recordToDraft(record: ReflectionRecordDto | null): Draft {
  if (!record) return emptyDraft;
  return {
    todayGoal: record.todayGoal || '', achievements: record.achievements || '', languageUsed: record.languageUsed || '',
    thinking: record.thinking || '', difficultyStrategy: record.difficultyStrategy || '',
    languageCultureAwareness: record.languageCultureAwareness || '', nextGoal: record.nextGoal || '',
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
    catch { setError('学習者IDを確認できませんでした。先生に確認してください。'); }
    finally { setBusy(false); }
  };
  return <div className="meg-first-use"><div className="meg-first-card">
    <div className="meg-logo"><BarChart3 /></div><h1>My English Growth</h1><p>今日の英語の学びをふりかえろう</p>
    <div className="meg-first-note">はじめて使うときだけ、AI対話アプリと同じ4文字の学習者IDを入力します。次回からはこのChromebookで自動的に開きます。</div>
    <label>学習者ID</label><input value={code} onChange={(e) => { setCode(normalizeLearningCode(e.target.value)); setError(''); }} maxLength={4} autoCapitalize="characters" autoFocus />
    {error && <p className="meg-error">{error}</p>}<button type="button" className="meg-primary" onClick={submit} disabled={busy}>{busy ? '確認しています…' : 'はじめる'}</button>
  </div></div>;
}

function Header({ learningId, view, setView }: { learningId: string; view: View; setView: (view: View) => void }) {
  return <header className="meg-header"><div className="meg-brand"><div className="meg-logo"><BarChart3 /></div><div><h1>My English Growth</h1><p>今日の英語の学びをふりかえろう</p></div></div>
    <nav className="meg-nav" aria-label="ページ切り替え"><button type="button" className={view === 'entry' ? 'active' : ''} onClick={() => setView('entry')}><Pencil />ふりかえり</button><button type="button" className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}><BarChart3 />わたしの成長</button><button type="button" className={view === 'class' ? 'active' : ''} onClick={() => setView('class')}><Users />みんな</button></nav>
    <div className="meg-id-pill">{learningId}</div></header>;
}

function ReflectionTextarea({ field, draft, setDraft }: { key?: React.Key; field: (typeof REFLECTION_FIELDS)[number]; draft: Draft; setDraft: React.Dispatch<React.SetStateAction<Draft>> }) {
  const Icon = field.icon;
  return <div className={`meg-reflection-field ${field.large ? 'meg-reflection-field-large' : ''}`}><div className="meg-field-heading"><Icon /><div><h3>{field.title}</h3><p>{field.prompt}</p></div></div>
    <textarea value={draft[field.key]} onChange={(e) => setDraft((current) => ({ ...current, [field.key]: e.target.value.slice(0, 5000) }))} placeholder={field.placeholder} />
    <div className="meg-field-count">{[...draft[field.key]].length}文字</div></div>;
}

function EntryView({ bootstrap, token, onSubmittedChange }: { bootstrap: BootstrapResponse; token: string; onSubmittedChange: (submitted: boolean) => void }) {
  const initial = bootstrap.today ? recordToDraft(bootstrap.today) : (readLocalDraft() || emptyDraft);
  const [draft, setDraft] = useState<Draft>(initial);
  const [status, setStatus] = useState<'draft' | 'submitted'>(bootstrap.today?.status === 'submitted' ? 'submitted' : 'draft');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle'); const [message, setMessage] = useState('');
  const firstRender = useRef(true);
  const totalChars = useMemo(() => REFLECTION_FIELDS.reduce((sum, field) => sum + [...draft[field.key]].length, 0), [draft]);
  useEffect(() => { onSubmittedChange(status === 'submitted'); }, [status, onSubmittedChange]);
  useEffect(() => {
    persistLocalDraft(draft); if (firstRender.current) { firstRender.current = false; return; }
    const timer = window.setTimeout(async () => { setSaveState('saving'); try { await saveReflection(token, { ...draft, status }); setSaveState('saved'); } catch { setSaveState('error'); } }, 1500);
    return () => window.clearTimeout(timer);
  }, [draft, status, token]);
  const submit = async () => {
    if (!draft.todayGoal.trim()) { setMessage('今日のめあてを書いてください。'); return; }
    const missing = REFLECTION_FIELDS.find((field) => !draft[field.key].trim());
    if (missing) { setMessage(`「${missing.title.replace(/^\d+\.\s*/, '')}」を書いてください。`); return; }
    setSaveState('saving'); setMessage('');
    try { await saveReflection(token, { ...draft, status: 'submitted' }); setStatus('submitted'); setSaveState('saved'); setMessage('今日の学びを記録しました。あとから書き足すこともできます。'); }
    catch { setSaveState('error'); setMessage('保存できませんでした。通信状態を確認してもう一度押してください。'); }
  };
  const previous = bootstrap.previous; const previousSummary = previous?.nextGoal || previous?.legacyReflectionText || previous?.achievements || '';
  return <main className="meg-main-grid"><section className="meg-left">
    <div className="meg-previous-card"><div className="meg-section-title"><MessageCircle /><h2>前回のふりかえり</h2>{previous && <span>{formatDate(previous.localDate)}</span>}</div>
      {previous ? <>{previous.nextGoal ? <div className="meg-next-goal-callout"><Target /><div><b>前回の「次に頑張りたいこと」</b><p>{previous.nextGoal}</p></div></div> : null}{!previous.nextGoal && previousSummary ? <p>{previousSummary}</p> : null}{previous.todayGoal && <p className="meg-previous-goal"><b>前回のめあて：</b>{previous.todayGoal}</p>}</> : <p className="meg-muted">前回の振り返りはまだありません。</p>}
    </div>
    <div className="meg-card meg-goal-card"><div className="meg-section-title"><Flag /><h2>Today's Goal</h2><strong>今日のめあて</strong></div><textarea value={draft.todayGoal} onChange={(e) => setDraft((current) => ({ ...current, todayGoal: e.target.value.slice(0, 1000) }))} placeholder="前回の『次に頑張りたいこと』も思い出して、今日のめあてを自分の言葉で書きましょう。" /></div>
    <div className="meg-card meg-reflection-card"><div className="meg-section-title"><Pencil /><h2>Today's Reflection</h2><strong>今日の振り返り</strong></div><p className="meg-reflection-intro">今日の自分の学びを、できるだけくわしく残しましょう。英語と日本語をまぜて書いてもかまいません。</p>
      <div className="meg-fields-stack">{REFLECTION_FIELDS.map((field) => <ReflectionTextarea key={field.key} field={field} draft={draft} setDraft={setDraft} />)}</div>
      <div className="meg-save-meta"><span>6項目 合計 {totalChars}文字</span><span className={saveState === 'error' ? 'error' : ''}>{saveState === 'saving' ? '保存しています…' : saveState === 'saved' ? '✓ 自動保存済み' : saveState === 'error' ? '自動保存できませんでした' : ''}</span></div>
      {message && <p className={saveState === 'error' ? 'meg-error' : 'meg-message'}>{message}</p>}<button type="button" className="meg-primary meg-save" onClick={submit} disabled={saveState === 'saving'}><Save />{status === 'submitted' ? '更新して保存する' : '今日の振り返りを保存する'}</button>
    </div></section>
    <aside className="meg-right"><div className="meg-card meg-hints-card"><div className="meg-hints-head"><Lightbulb /><div><h2>書くときのポイント</h2><p>「何をしたか」だけでなく「どう考えたか」も残そう</p></div></div><div className="meg-writing-tips"><div><Star /><span><b>具体的に</b>「できた」だけでなく、何ができたかを書く。</span></div><div><HelpCircle /><span><b>途中の考えも</b>迷ったことや考え直したことも大切な学び。</span></div><div><Sparkles /><span><b>自分の言葉で</b>友達と違っていても大丈夫。正解は一つではありません。</span></div></div><p className="meg-privacy-note">名前・住所・電話番号など、自分や友達の個人情報は書かないようにしましょう。</p></div>
      <div className="meg-card meg-side-note"><TrendingUp /><div><b>次の授業につなげよう</b><p>最後に書いた「次に頑張りたいこと」は、次の授業の最初にもう一度表示されます。</p></div></div></aside>
  </main>;
}

const HISTORY_LABELS: Array<[ReflectionField, string]> = [['achievements', 'できたこと'], ['languageUsed', '使ったことば'], ['thinking', '授業中に考えていたこと'], ['difficultyStrategy', '困ったこと・工夫'], ['languageCultureAwareness', '言葉や文化について気づいたこと'], ['nextGoal', '次に頑張りたいこと']];

function HistoryView({ token }: { token: string }) {
  const [rows, setRows] = useState<ReflectionRecordDto[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { loadReflectionHistory(token).then(setRows).finally(() => setLoading(false)); }, [token]);
  return <main className="meg-wide-page"><div className="meg-card"><div className="meg-page-heading"><BarChart3 /><div><h2>わたしの成長</h2><p>前の自分が考えていたことと、今の自分を比べてみよう。</p></div></div>
    {loading ? <p>読み込んでいます…</p> : rows.length === 0 ? <p className="meg-muted">保存された振り返りはまだありません。</p> : <div className="meg-history-list">{rows.map((row) => <article key={row.reflectionId} className="meg-history-item"><div className="meg-history-meta"><b>{formatDate(row.localDate)}</b><span>{row.reflectionCharCount}文字</span></div><h3>今日のめあて</h3><p>{row.todayGoal || '—'}</p>{HISTORY_LABELS.map(([key, label]) => row[key] ? <div key={key}><h3>{label}</h3><p>{row[key]}</p></div> : null)}{row.legacyReflectionText && !row.achievements && <div><h3>旧形式の振り返り</h3><p>{row.legacyReflectionText}</p></div>}</article>)}</div>}
  </div></main>;
}

function ClassCard({ row, index }: { key?: React.Key; row: ClassReflectionDto; index: number }) {
  return <article className="meg-class-card"><span>クラスメイト {index + 1}</span>{row.todayGoal && <><h3>今日のめあて</h3><p>{row.todayGoal}</p></>}{HISTORY_LABELS.map(([key, label]) => row[key] ? <div key={key}><h3>{label}</h3><p>{row[key]}</p></div> : null)}{row.legacyReflectionText && !row.achievements && <><h3>振り返り</h3><p>{row.legacyReflectionText}</p></>}</article>;
}

function ClassView({ token, submitted }: { token: string; submitted: boolean }) {
  const [rows, setRows] = useState<ClassReflectionDto[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (!submitted) return; setLoading(true); setError(''); loadClassReflections(token).then(setRows).catch((e: any) => setError(e?.code === 'SUBMIT_FIRST' ? '自分の振り返りを書いたあとに見られます。' : '読み込めませんでした。')).finally(() => setLoading(false)); }, [token, submitted]);
  return <main className="meg-wide-page"><div className="meg-card"><div className="meg-page-heading"><Users /><div><h2>みんなのふりかえり</h2><p>友達の考え方や学び方から、新しい見方を見つけよう。</p></div></div>{!submitted ? <div className="meg-lock-message">自分の今日の振り返りを保存すると、今日のみんなの振り返りを読むことができます。</div> : loading ? <p>読み込んでいます…</p> : error ? <p className="meg-error">{error}</p> : rows.length === 0 ? <p className="meg-muted">今日、公開されている友達の振り返りはまだありません。</p> : <div className="meg-class-grid">{rows.map((row, index) => <ClassCard key={row.reflectionId} row={row} index={index} />)}</div>}</div></main>;
}

export default function ReflectionApp() {
  const [token, setToken] = useState(readToken); const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null); const [loading, setLoading] = useState(Boolean(token)); const [view, setView] = useState<View>('entry'); const [submitted, setSubmitted] = useState(false);
  const load = async (deviceToken: string) => { setLoading(true); try { const data = await bootstrapReflection(deviceToken); setBootstrap(data); setSubmitted(data.today?.status === 'submitted'); } catch { clearToken(); setToken(''); setBootstrap(null); } finally { setLoading(false); } };
  useEffect(() => { if (token) void load(token); }, [token]);
  if (!token) return <FirstUse onRegistered={setToken} />;
  if (loading || !bootstrap) return <div className="meg-loading"><div className="meg-logo"><BarChart3 /></div><p>振り返りを読み込んでいます…</p></div>;
  return <div className="meg-app"><div className="meg-shell"><Header learningId={bootstrap.learningId} view={view} setView={setView} />{view === 'entry' && <EntryView bootstrap={bootstrap} token={token} onSubmittedChange={setSubmitted} />}{view === 'history' && <HistoryView token={token} />}{view === 'class' && <ClassView token={token} submitted={submitted} />}</div></div>;
}
