import React, { useEffect, useState } from 'react';
import { BarChart3, CalendarDays, CheckCircle2, Clock3, Download, FileText, LogOut, RefreshCw, Search, Users, XCircle } from 'lucide-react';
import {
  teacherDashboard, teacherExportCsv, teacherLogin, teacherLogout, teacherMe, teacherShouldRedirectToApiOrigin, teacherStudentHistory,
  type RatingSchemaVersion, type TeacherClassNumber, type TeacherDashboardResponse, type TeacherDataScope, type TeacherGrade, type TeacherStudentHistoryResponse,
} from './reflectionTeacherApi';

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
const scopeLabel = (scope: string) => ({ main:'本研究', pilot_b:'Pilot B', test:'テスト', reserve:'予備' } as Record<string,string>)[scope] || scope;
const membershipLabel = (value: { dataScope: string; grade: string; classNumber: string }) => {
  const scope = scopeLabel(value.dataScope);
  const school = value.grade ? `${value.grade}年${value.classNumber ? `${value.classNumber}組` : ''}` : '';
  return school ? `${scope}・${school}` : scope;
};
const ratingLabels = (version?: RatingSchemaVersion) => version === 'v2'
  ? { first: 'めあてへの取組', second: '聞く・伝える' }
  : { first: '自分の考え', second: '聞いて分かろう' };

function legacySixPartText(record: TeacherStudentHistoryResponse['history'][number]): string {
  const parts: Array<[string, string]> = [
    ['できたこと', record.achievements], ['使ったことば', record.languageUsed], ['授業中に考えていたこと', record.thinking],
    ['困ったこと・工夫', record.difficultyStrategy], ['言葉や文化について気づいたこと', record.languageCultureAwareness], ['次に頑張りたいこと', record.nextGoal],
  ];
  return parts.filter(([, value]) => value).map(([label, value]) => `【${label}】\n${value}`).join('\n\n');
}

function Login({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await teacherLogin(username, password); onDone(); }
    catch (e: any) { setError(e?.code === 'TEACHER_ONLY' ? '教師用アカウントでログインしてください。' : e?.code === 'TOO_MANY_LOGIN_ATTEMPTS' ? 'ログイン試行回数が多すぎます。時間をおいてください。' : 'ユーザー名またはパスワードを確認してください。'); }
    finally { setBusy(false); }
  };
  return <div className="megt-login-page"><form className="megt-login-card" onSubmit={submit}><div className="megt-logo"><BarChart3 /></div><h1>My English Growth</h1><h2>教師用 振り返り一覧</h2><p>児童の振り返り状況と学びの記録を確認します。</p><label>ユーザー名<input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus /></label><label>パスワード<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>{error && <div className="megt-error">{error}</div>}<button className="megt-primary" disabled={busy}>{busy ? '確認しています…' : 'ログイン'}</button></form></div>;
}

function StatusChip({ status }: { status: 'submitted' | 'draft' | 'missing' }) {
  if (status === 'submitted') return <span className="megt-chip submitted"><CheckCircle2 />提出済み</span>;
  if (status === 'draft') return <span className="megt-chip draft"><Clock3 />下書き</span>;
  return <span className="megt-chip missing"><XCircle />未入力</span>;
}

function StudentPanel({ student, onClose }: { student: TeacherStudentHistoryResponse; onClose: () => void }) {
  return <div className="megt-panel-backdrop" onClick={onClose}><aside className="megt-panel" onClick={(e) => e.stopPropagation()}><button className="megt-close" onClick={onClose} aria-label="閉じる">×</button><div className="megt-panel-head"><div><span>{membershipLabel(student)}</span><h2>{student.learningId}</h2><p>{student.attendanceNumber ? `出席番号 ${student.attendanceNumber}` : '出席番号未設定'}</p></div><BarChart3 /></div>{student.history.length === 0 ? <p className="megt-muted">振り返りはまだありません。</p> : <div className="megt-history">{student.history.map((record) => { const text = record.reflectionText || legacySixPartText(record); const labels = ratingLabels(record.ratingSchemaVersion); return <article key={record.reflectionId}><div className="megt-history-date"><b>{record.localDate}</b><StatusChip status={record.status === 'submitted' ? 'submitted' : 'draft'} /><span>{record.reflectionCharCount}文字</span></div><h3>今日のめあて</h3><p>{record.todayGoal || '—'}</p><div className="megt-rating-summary"><span>{labels.first} {record.goalRating ?? '—'}/5</span><span>{labels.second} {record.selfRegulationRating ?? '—'}/5</span></div><h3>今日の振り返り</h3><p>{text || '—'}</p></article>; })}</div>}</aside></div>;
}

export default function ReflectionTeacherApp() {
  const [mode, setMode] = useState<'checking' | 'login' | 'ready'>('checking');
  const [user, setUser] = useState(''); const [localDate, setLocalDate] = useState(today);
  const [dataScope, setDataScope] = useState<TeacherDataScope>('main'); const [grade, setGrade] = useState<TeacherGrade>('all'); const [classNumber, setClassNumber] = useState<TeacherClassNumber>('all');
  const [data, setData] = useState<TeacherDashboardResponse | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [selected, setSelected] = useState<TeacherStudentHistoryResponse | null>(null); const [search, setSearch] = useState('');

  const checkAuth = async () => { try { const me = await teacherMe(); setUser(me.username); setMode('ready'); } catch { setMode('login'); } };
  const load = async (date = localDate, scope = dataScope, g = grade, room = classNumber) => {
    setLoading(true); setError('');
    try { setData(await teacherDashboard(date, scope, g, room)); }
    catch (e: any) { if (e?.status === 401) setMode('login'); else setError('振り返り一覧を読み込めませんでした。'); }
    finally { setLoading(false); }
  };
  useEffect(() => { const redirect = teacherShouldRedirectToApiOrigin(); if (redirect) { window.location.replace(redirect); return; } void checkAuth(); }, []);
  useEffect(() => { if (mode === 'ready') void load(); }, [mode, localDate, dataScope, grade, classNumber]);

  if (mode === 'checking') return <div className="megt-loading"><BarChart3 /><p>教師画面を読み込んでいます…</p></div>;
  if (mode === 'login') return <Login onDone={() => void checkAuth()} />;

  const filtered = (data?.students || []).filter((row) => !search.trim() || row.learningId.includes(search.trim().toUpperCase()));
  const openStudent = async (learningId: string) => { try { setSelected(await teacherStudentHistory(learningId)); } catch { setError('児童の履歴を読み込めませんでした。'); } };
  const logout = async () => { try { await teacherLogout(); } finally { setUser(''); setData(null); setMode('login'); } };
  const exportCsv = async () => { try { await teacherExportCsv(localDate, dataScope, grade, classNumber); } catch { setError('CSVを書き出せませんでした。'); } };

  return <div className="megt-app"><header className="megt-header"><div className="megt-brand"><div className="megt-logo"><BarChart3 /></div><div><h1>My English Growth</h1><p>教師用 振り返りダッシュボード</p></div></div><div className="megt-user"><span>{user}</span><button onClick={logout}><LogOut />ログアウト</button></div></header>
    <main className="megt-main"><section className="megt-toolbar">
      <label><CalendarDays />日付<input type="date" value={localDate} onChange={(e) => setLocalDate(e.target.value)} /></label>
      <label><FileText />データ区分<select value={dataScope} onChange={(e) => setDataScope(e.target.value as TeacherDataScope)}><option value="main">本研究</option><option value="pilot_b">Pilot B</option><option value="test">テスト</option><option value="reserve">予備</option><option value="all">すべて</option></select></label>
      <label><Users />学年<select value={grade} onChange={(e) => setGrade(e.target.value as TeacherGrade)}><option value="all">すべて</option><option value="5">5年</option><option value="6">6年</option></select></label>
      <label><Users />学級<select value={classNumber} onChange={(e) => setClassNumber(e.target.value as TeacherClassNumber)}><option value="all">すべて</option><option value="1">1組</option><option value="2">2組</option><option value="3">3組</option></select></label>
      <label className="megt-search"><Search />ID検索<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="例：6RSX" maxLength={8} /></label><button className="megt-secondary" onClick={() => void load()} disabled={loading}><RefreshCw />更新</button><button className="megt-export" onClick={exportCsv}><Download />CSV</button></section>
      {error && <div className="megt-error-banner">{error}</div>}
      <section className="megt-counts"><div><Users /><span>対象</span><b>{data?.counts.total ?? 0}</b></div><div className="submitted"><CheckCircle2 /><span>提出済み</span><b>{data?.counts.submitted ?? 0}</b></div><div className="draft"><Clock3 /><span>下書き</span><b>{data?.counts.draft ?? 0}</b></div><div className="missing"><XCircle /><span>未入力</span><b>{data?.counts.missing ?? 0}</b></div></section>
      <section className="megt-table-card"><div className="megt-table-head"><div><FileText /><h2>{data?.localDate || localDate} の振り返り</h2></div><p>文字数とふりかえりポイントは、児童の学びを振り返るための補助情報です。</p></div><div className="megt-table-scroll"><table><thead><tr><th>所属</th><th>出席</th><th>ID</th><th>状況</th><th>文字数</th><th>今日のめあて</th><th>ふりかえりポイント</th><th>今日の振り返り</th></tr></thead><tbody>{filtered.map((row) => { const labels = ratingLabels(row.ratingSchemaVersion); return <tr key={`${row.classId}-${row.learningId}`} onClick={() => void openStudent(row.learningId)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') void openStudent(row.learningId); }}><td>{membershipLabel(row)}</td><td>{row.attendanceNumber || '—'}</td><td><b>{row.learningId}</b></td><td><StatusChip status={row.status} /></td><td>{row.reflectionCharCount || '—'}</td><td>{row.todayGoal || '—'}</td><td>{labels.first} {row.goalRating ?? '—'} / {labels.second} {row.selfRegulationRating ?? '—'}</td><td>{row.reflectionText || '—'}</td></tr>; })}</tbody></table>{!loading && filtered.length === 0 && <div className="megt-empty">該当する児童はいません。</div>}</div></section>
    </main>{selected && <StudentPanel student={selected} onClose={() => setSelected(null)} />}</div>;
}
