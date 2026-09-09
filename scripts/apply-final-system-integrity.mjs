import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const repoRef = '9af551de4b579188d9d2c2b6ff1a1bebb61f17ca';
const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);
const show = (path) => execFileSync('git', ['show', `${repoRef}:${path}`], { encoding: 'utf8' });
const restore = (path) => write(path, show(path));
function replaceOne(path, from, to) {
  const source = read(path);
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one match, got ${count}: ${from.slice(0, 120)}`);
  write(path, source.replace(from, to));
}
function replaceRegexOne(path, regex, to) {
  const source = read(path);
  const matches = source.match(regex);
  if (!matches || matches.length !== 1) throw new Error(`${path}: regex expected one match: ${regex}`);
  write(path, source.replace(regex, to));
}

// Restore the approved six-part pupil/teacher contract from the last known-good
// six-part release, then reapply the later integrity hardening below.
for (const path of [
  'src/reflection/ReflectionApp.tsx',
  'src/reflection/ReflectionTeacherApp.tsx',
  'src/reflection/reflectionApi.ts',
  'src/reflection/reflectionTeacherApi.ts',
  'src/server/reflectionTeacherModel.ts',
  'scripts/qa-reflection-teacher.ts',
  'scripts/qa-reflection-module.ts',
]) restore(path);

// Keep the current exact Firestore query / stale-token / monotonic-submit server
// architecture. Only make six-part writing canonical again and B-design legacy.
replaceOne(
  'src/server/reflectionPersistence.ts',
  "  // Compatibility only: records created during the temporary six-part UI are retained.\n  achievements: string;\n  languageUsed: string;\n  thinking: string;\n  difficultyStrategy: string;\n  languageCultureAwareness: string;\n  nextGoal: string;",
  "  // Canonical six-part pupil reflection fields.\n  achievements: string;\n  languageUsed: string;\n  thinking: string;\n  difficultyStrategy: string;\n  languageCultureAwareness: string;\n  nextGoal: string;"
);
replaceOne(
  'src/server/reflectionPersistence.ts',
  "function canonicalCharCount(record: Pick<ReflectionRecord, 'reflectionText' | 'achievements' | 'languageUsed' | 'thinking' | 'difficultyStrategy' | 'languageCultureAwareness' | 'nextGoal'>): number {\n  return record.reflectionText ? [...record.reflectionText].length : sixPartCharCount(record);\n}",
  "function canonicalCharCount(record: Pick<ReflectionRecord, 'reflectionText' | 'achievements' | 'languageUsed' | 'thinking' | 'difficultyStrategy' | 'languageCultureAwareness' | 'nextGoal'>): number {\n  const sixPartCount = sixPartCharCount(record);\n  return sixPartCount > 0 ? sixPartCount : [...record.reflectionText].length;\n}"
);
replaceOne(
  'src/server/reflectionPersistence.ts',
  "    // Accepted only for backward compatibility with the briefly deployed six-part client.\n    achievements?: unknown;\n    languageUsed?: unknown;\n    thinking?: unknown;\n    difficultyStrategy?: unknown;\n    languageCultureAwareness?: unknown;\n    nextGoal?: unknown;",
  "    // Canonical six-part fields. B-design fields above remain accepted only so\n    // records written during that deployment can be preserved without data loss.\n    achievements?: unknown;\n    languageUsed?: unknown;\n    thinking?: unknown;\n    difficultyStrategy?: unknown;\n    languageCultureAwareness?: unknown;\n    nextGoal?: unknown;"
);

// Public APIs expose an explicit legacy alias while the six fields remain canonical.
replaceOne(
  'src/server/reflectionRoutes.ts',
  "    nextGoal: record.nextGoal,\n  };",
  "    nextGoal: record.nextGoal,\n    legacyReflectionText: record.reflectionText,\n  };"
);
replaceOne(
  'src/server/reflectionRoutes.ts',
  "    nextGoal: record.nextGoal,\n  };\n}\n\nasync function requireIdentity",
  "    nextGoal: record.nextGoal,\n    legacyReflectionText: record.reflectionText,\n  };\n}\n\nasync function requireIdentity"
);
replaceOne(
  'src/server/reflectionRoutes.ts',
  "      // Backward-compatible request fields from the temporary six-part client.\n      achievements: req.body?.achievements,",
  "      // Canonical six-part request fields.\n      achievements: req.body?.achievements,"
);

// Six-part client API, with current richer HTTP error metadata preserved.
replaceOne(
  'src/reflection/reflectionApi.ts',
  "    const error = new Error(data?.error || `HTTP_${response.status}`) as Error & { code?: string };\n    error.code = data?.error;",
  "    const error = new Error(data?.error || `HTTP_${response.status}`) as Error & { code?: string; status?: number };\n    error.code = data?.error;\n    error.status = response.status;"
);

// Restore the six-field UI while retaining the later draft freshness, Tokyo-day,
// transient-error, and autosave-race protections.
replaceOne(
  'src/reflection/ReflectionApp.tsx',
  "import React, { useEffect, useMemo, useRef, useState } from 'react';",
  "import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';"
);
replaceOne(
  'src/reflection/ReflectionApp.tsx',
  "const localDate = () => new Date().toLocaleDateString('sv-SE');\nconst draftKey = () => `my-english-growth-draft-${localDate()}`;",
  "const tokyoDate = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });\nconst draftKey = (token: string) => `my-english-growth-draft-${tokyoDate()}-${token.slice(0, 16)}`;\ntype LocalDraftPayload = { draft: Draft; savedAt: number };"
);
replaceOne(
  'src/reflection/ReflectionApp.tsx',
  `function readLocalDraft(): Draft | null {\n  try {\n    const raw = window.localStorage.getItem(draftKey());\n    if (!raw) return null;\n    const parsed = JSON.parse(raw);\n    return Object.fromEntries(Object.keys(emptyDraft).map((key) => [key, typeof parsed[key] === 'string' ? parsed[key] : ''])) as Draft;\n  } catch { return null; }\n}\nfunction persistLocalDraft(draft: Draft) { try { window.localStorage.setItem(draftKey(), JSON.stringify(draft)); } catch {} }`,
  `function normalizeDraft(value: unknown): Draft | null {\n  if (!value || typeof value !== 'object') return null;\n  const row = value as Record<string, unknown>;\n  return Object.fromEntries(Object.keys(emptyDraft).map((key) => [key, typeof row[key] === 'string' ? row[key] : ''])) as Draft;\n}\nfunction readLocalDraft(token: string): LocalDraftPayload | null {\n  try {\n    const raw = window.localStorage.getItem(draftKey(token));\n    if (!raw) return null;\n    const parsed = JSON.parse(raw) as { draft?: unknown; savedAt?: unknown };\n    const draft = normalizeDraft(parsed.draft);\n    const savedAt = Number(parsed.savedAt || 0);\n    return draft && Number.isFinite(savedAt) ? { draft, savedAt } : null;\n  } catch { return null; }\n}\nfunction persistLocalDraft(token: string, draft: Draft) {\n  try { window.localStorage.setItem(draftKey(token), JSON.stringify({ draft, savedAt: Date.now() })); } catch {}\n}`
);
replaceOne(
  'src/reflection/ReflectionApp.tsx',
  "    try { const token = await registerReflectionDevice(normalized); saveToken(token); onRegistered(token); }\n    catch { setError('学習者IDを確認できませんでした。先生に確認してください。'); }",
  "    try { const token = await registerReflectionDevice(normalized); saveToken(token); onRegistered(token); }\n    catch (e: any) { setError(e?.code === 'TOO_MANY_FAILED_CODE_ATTEMPTS' ? '入力の確認回数が多くなっています。少し時間をおいて先生に確認してください。' : '学習者IDを確認できませんでした。先生に確認してください。'); }"
);
replaceOne(
  'src/reflection/ReflectionApp.tsx',
  `function EntryView({ bootstrap, token, onSubmittedChange }: { bootstrap: BootstrapResponse; token: string; onSubmittedChange: (submitted: boolean) => void }) {\n  const initial = bootstrap.today ? recordToDraft(bootstrap.today) : (readLocalDraft() || emptyDraft);\n  const [draft, setDraft] = useState<Draft>(initial);\n  const [status, setStatus] = useState<'draft' | 'submitted'>(bootstrap.today?.status === 'submitted' ? 'submitted' : 'draft');\n  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle'); const [message, setMessage] = useState('');\n  const firstRender = useRef(true);`,
  `function EntryView({ bootstrap, token, onSubmittedChange, onRecordSaved }: { bootstrap: BootstrapResponse; token: string; onSubmittedChange: (submitted: boolean) => void; onRecordSaved: (record: ReflectionRecordDto) => void }) {\n  const [draft, setDraft] = useState<Draft>(() => {\n    const serverDraft = recordToDraft(bootstrap.today);\n    const local = readLocalDraft(token);\n    const serverUpdatedAt = Date.parse(bootstrap.today?.updatedAt || '') || 0;\n    if (local && (!bootstrap.today || local.savedAt > serverUpdatedAt)) return local.draft;\n    return serverDraft;\n  });\n  const [status, setStatus] = useState<'draft' | 'submitted'>(bootstrap.today?.status === 'submitted' ? 'submitted' : 'draft');\n  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle'); const [message, setMessage] = useState('');\n  const firstRender = useRef(true); const timerRef = useRef<number | null>(null); const skipAutosaveOnce = useRef(false);`
);
replaceOne(
  'src/reflection/ReflectionApp.tsx',
  `  useEffect(() => {\n    persistLocalDraft(draft); if (firstRender.current) { firstRender.current = false; return; }\n    const timer = window.setTimeout(async () => { setSaveState('saving'); try { await saveReflection(token, { ...draft, status }); setSaveState('saved'); } catch { setSaveState('error'); } }, 1500);\n    return () => window.clearTimeout(timer);\n  }, [draft, status, token]);`,
  `  useEffect(() => {\n    persistLocalDraft(token, draft);\n    if (firstRender.current) { firstRender.current = false; return; }\n    if (skipAutosaveOnce.current) { skipAutosaveOnce.current = false; return; }\n    if (timerRef.current !== null) window.clearTimeout(timerRef.current);\n    timerRef.current = window.setTimeout(async () => {\n      setSaveState('saving');\n      try { const saved = await saveReflection(token, { ...draft, status }); onRecordSaved(saved); setSaveState('saved'); }\n      catch { setSaveState('error'); }\n      finally { timerRef.current = null; }\n    }, 1500);\n    return () => { if (timerRef.current !== null) { window.clearTimeout(timerRef.current); timerRef.current = null; } };\n  }, [draft, status, token, onRecordSaved]);`
);
replaceOne(
  'src/reflection/ReflectionApp.tsx',
  `    setSaveState('saving'); setMessage('');\n    try { await saveReflection(token, { ...draft, status: 'submitted' }); setStatus('submitted'); setSaveState('saved'); setMessage('今日の学びを記録しました。あとから書き足すこともできます。'); }\n    catch { setSaveState('error'); setMessage('保存できませんでした。通信状態を確認してもう一度押してください。'); }`,
  `    if (timerRef.current !== null) { window.clearTimeout(timerRef.current); timerRef.current = null; }\n    setSaveState('saving'); setMessage('');\n    try {\n      const saved = await saveReflection(token, { ...draft, status: 'submitted' });\n      skipAutosaveOnce.current = true; setStatus('submitted'); onRecordSaved(saved); setSaveState('saved');\n      setMessage('今日の学びを記録しました。あとから書き足すこともできます。');\n    }\n    catch { setSaveState('error'); setMessage('保存できませんでした。通信状態を確認してもう一度押してください。'); }`
);
replaceRegexOne(
  'src/reflection/ReflectionApp.tsx',
  /export default function ReflectionApp\(\) \{[\s\S]*?\n\}/,
  `export default function ReflectionApp() {\n  const [token, setToken] = useState(readToken); const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null); const [loading, setLoading] = useState(Boolean(token)); const [loadError, setLoadError] = useState(''); const [view, setView] = useState<View>('entry'); const [submitted, setSubmitted] = useState(false);\n  const load = useCallback(async (deviceToken: string) => {\n    setLoading(true); setLoadError('');\n    try { const data = await bootstrapReflection(deviceToken); setBootstrap(data); setSubmitted(data.today?.status === 'submitted'); }\n    catch (e: any) {\n      if (e?.code === 'INVALID_REFLECTION_DEVICE' || e?.code === 'REFLECTION_DEVICE_REBIND_REQUIRED') { clearToken(); setToken(''); setBootstrap(null); }\n      else setLoadError('振り返りを読み込めませんでした。通信状態を確認して、もう一度読み込んでください。');\n    } finally { setLoading(false); }\n  }, []);\n  const handleRecordSaved = useCallback((record: ReflectionRecordDto) => {\n    setBootstrap((current) => current ? { ...current, today: record } : current);\n    setSubmitted(record.status === 'submitted');\n  }, []);\n  useEffect(() => { if (token) void load(token); }, [token, load]);\n  if (!token) return <FirstUse onRegistered={(registeredToken) => { setLoadError(''); setToken(registeredToken); }} />;\n  if (loading) return <div className=\"meg-loading\"><div className=\"meg-logo\"><BarChart3 /></div><p>振り返りを読み込んでいます…</p></div>;\n  if (!bootstrap) return <div className=\"meg-first-use\"><div className=\"meg-first-card\"><div className=\"meg-logo\"><HelpCircle /></div><h1>My English Growth</h1><p>{loadError || '振り返りを読み込めませんでした。'}</p><button type=\"button\" className=\"meg-primary\" onClick={() => void load(token)}>もう一度読み込む</button></div></div>;\n  return <div className=\"meg-app\"><div className=\"meg-shell\"><Header learningId={bootstrap.learningId} view={view} setView={setView} />{view === 'entry' && <EntryView bootstrap={bootstrap} token={token} onSubmittedChange={setSubmitted} onRecordSaved={handleRecordSaved} />}{view === 'history' && <HistoryView token={token} />}{view === 'class' && <ClassView token={token} submitted={submitted} />}</div></div>;\n}`
);

// Six-part teacher model with current spreadsheet formula protection.
replaceOne(
  'src/server/reflectionTeacherModel.ts',
  `function csvCell(value: unknown): string {\n  const text = String(value ?? '').replace(/\\r\\n/g, '\\n').replace(/\\r/g, '\\n');\n  return \`\"\${text.replace(/\"/g, '\"\"')}\"\`;\n}`,
  `function csvCell(value: unknown): string {\n  let text = String(value ?? '').replace(/\\r\\n/g, '\\n').replace(/\\r/g, '\\n');\n  if (/^\\s*[=+\\-@]/.test(text)) text = \`'\${text}\`;\n  return \`\"\${text.replace(/\"/g, '\"\"')}\"\`;\n}`
);

// B-design stylesheet was an override that caused the regression to remain easy
// to reintroduce. The approved six-field styling already lives in reflection.css.
replaceOne('src/main.tsx', "import './reflection/reflection-b.css';\n", '');
if (fs.existsSync('src/reflection/reflection-b.css')) fs.unlinkSync('src/reflection/reflection-b.css');

// Formal research CSV: expose ASR observability as counts only. Raw ASR event
// values/candidate strings remain out of the formal five-file export.
replaceOne('src/server/researchDashboard.ts', "export const RESEARCH_EXPORT_SCHEMA_VERSION = 'research-2026-v3';", "export const RESEARCH_EXPORT_SCHEMA_VERSION = 'research-2026-v4';");
replaceOne(
  'src/server/researchDashboard.ts',
  "    'speech_rate_change_count','student_selected_speech_rate',\n    'tts_telemetry_version'",
  "    'speech_rate_change_count','student_selected_speech_rate',\n    'asr_bias_applied_count','asr_bias_unavailable_count','asr_contextual_correction_count',\n    'tts_telemetry_version'"
);
replaceOne(
  'src/server/researchDashboard.ts',
  "  student_selected_speech_rate:'児童が選択したAI音声の再生速度',\n  tts_telemetry_version:",
  "  student_selected_speech_rate:'児童が選択したAI音声の再生速度',\n  asr_bias_applied_count:'ブラウザのcontextual ASR phrase biasを適用できた音声認識開始回数',\n  asr_bias_unavailable_count:'候補語はあったがブラウザがcontextual ASR phrase biasに非対応だった音声認識開始回数',\n  asr_contextual_correction_count:'強い会話文脈と高い音韻類似度に基づくアプリ側ASR補正回数',\n  tts_telemetry_version:"
);
replaceOne(
  'src/server/researchDashboard.ts',
  "  'speech_rate_change_count','student_selected_speech_rate','tts_provider_observed'",
  "  'speech_rate_change_count','student_selected_speech_rate','asr_bias_applied_count','asr_bias_unavailable_count','asr_contextual_correction_count','tts_provider_observed'"
);
replaceOne(
  'src/server/researchDashboard.ts',
  `function eventCountMap(rows: Row[]): Map<string, Map<string, number>> {\n  const out = new Map<string, Map<string, number>>();\n  for (const row of rows) {\n    const sessionId = String(row.session_id || '');\n    if (!sessionId) continue;\n    const map = out.get(sessionId) || new Map<string, number>();\n    const type = String(row.event_type || '');\n    map.set(type, (map.get(type) || 0) + 1);\n    out.set(sessionId, map);\n  }\n  return out;\n}`,
  `function eventCountMap(rows: Row[]): Map<string, Map<string, number>> {\n  const out = new Map<string, Map<string, number>>();\n  for (const row of rows) {\n    const sessionId = String(row.session_id || '');\n    if (!sessionId) continue;\n    const map = out.get(sessionId) || new Map<string, number>();\n    const type = String(row.event_type || '');\n    map.set(type, (map.get(type) || 0) + 1);\n    out.set(sessionId, map);\n  }\n  return out;\n}\n\nfunction asrBiasStatusMap(rows: Row[]): Map<string, { applied: number; unavailable: number }> {\n  const out = new Map<string, { applied: number; unavailable: number }>();\n  for (const row of rows) {\n    if (String(row.event_type || '') !== 'asr_bias_status') continue;\n    const sessionId = String(row.session_id || '');\n    if (!sessionId) continue;\n    const counts = out.get(sessionId) || { applied: 0, unavailable: 0 };\n    const value = String(row.event_value || '');\n    if (value.startsWith('applied:')) counts.applied += 1;\n    else if (value.startsWith('unavailable:')) counts.unavailable += 1;\n    out.set(sessionId, counts);\n  }\n  return out;\n}`
);
replaceOne(
  'src/server/researchDashboard.ts',
  "  const eventCounts = eventCountMap(raw.system_events);\n  const turnCounts",
  "  const eventCounts = eventCountMap(raw.system_events);\n  const asrBiasCounts = asrBiasStatusMap(raw.system_events);\n  const turnCounts"
);
replaceOne(
  'src/server/researchDashboard.ts',
  "      speech_rate_change_count: events.get('speech_rate_change') || 0,\n    };",
  "      speech_rate_change_count: events.get('speech_rate_change') || 0,\n      asr_bias_applied_count: asrBiasCounts.get(sessionId)?.applied || 0,\n      asr_bias_unavailable_count: asrBiasCounts.get(sessionId)?.unavailable || 0,\n      asr_contextual_correction_count: events.get('asr_contextual_correction') || 0,\n    };"
);

// Research export QA exercises the new counts and proves candidate text does not
// leak into the formal sessions CSV.
replaceOne(
  'scripts/qa-research-export-complete.ts',
  "systemEvents:[{type:'session_start',timestamp:started},{type:'help_open',timestamp:started+1000},{type:'vocab_bank_open',timestamp:started+2000},{type:'session_finish',timestamp:started+119000}],",
  "systemEvents:[{type:'session_start',timestamp:started},{type:'help_open',timestamp:started+1000},{type:'vocab_bank_open',timestamp:started+2000},{type:'asr_bias_status',timestamp:started+2500,value:'applied:37'},{type:'asr_contextual_correction',timestamp:started+3000,value:'food:karaage'},{type:'session_finish',timestamp:started+119000}],"
);
replaceOne(
  'scripts/qa-research-export-complete.ts',
  "for(const required of ['assigned_partner_id','assigned_partner_country','assignment_announced_at','same_class_starts_5min','same_class_starts_10min','usage_context_inferred','tts_telemetry_version'",
  "for(const required of ['assigned_partner_id','assigned_partner_country','assignment_announced_at','same_class_starts_5min','same_class_starts_10min','usage_context_inferred','asr_bias_applied_count','asr_bias_unavailable_count','asr_contextual_correction_count','tts_telemetry_version'"
);
replaceOne(
  'scripts/qa-research-export-complete.ts',
  "assert.equal(beforeRow.help_open_count,1);assert.equal(beforeRow.vocab_bank_open_count,1);assert.equal(beforeRow.tts_telemetry_version",
  "assert.equal(beforeRow.help_open_count,1);assert.equal(beforeRow.vocab_bank_open_count,1);assert.equal(beforeRow.asr_bias_applied_count,1);assert.equal(beforeRow.asr_bias_unavailable_count,0);assert.equal(beforeRow.asr_contextual_correction_count,1);assert.equal(beforeRow.tts_telemetry_version"
);
replaceOne(
  'scripts/qa-research-export-complete.ts',
  "const formula=serializeResearchCsv([{english_text_anonymized:'=1+1'}] as any,'utterances');assert.ok(formula.includes(\"\\\"'=1+1\\\"\"));",
  "const formula=serializeResearchCsv([{english_text_anonymized:'=1+1'}] as any,'utterances');assert.ok(formula.includes(\"\\\"'=1+1\\\"\"));const sessionsCsv=serializeResearchCsv(data.sessions,'sessions');assert.equal(sessionsCsv.includes('food:karaage'),false,'raw ASR candidate event values must not leak into formal sessions CSV');"
);

// Replace reflection module QA with six-part canonical + all later hardening guards.
write('scripts/qa-reflection-module.ts', `import fs from 'node:fs';\n\nconst read = (path: string) => fs.readFileSync(path, 'utf8');\nconst fail = (message: string): never => { throw new Error('[qa:reflection] ' + message); };\nconst requireText = (source: string, needle: string, label: string) => { if (!source.includes(needle)) fail(label + ' missing: ' + needle); };\nconst forbidText = (source: string, needle: string, label: string) => { if (source.includes(needle)) fail(label + ' must not contain: ' + needle); };\nconst main=read('src/main.tsx'), reflection=read('src/reflection/ReflectionApp.tsx'), css=read('src/reflection/reflection.css'), routes=read('src/server/reflectionRoutes.ts'), persistence=read('src/server/reflectionPersistence.ts'), firestore=read('src/server/firestore.ts'), teacher=read('src/reflection/ReflectionTeacherApp.tsx'), teacherModel=read('src/server/reflectionTeacherModel.ts'), serverEntry=read('server-entry.ts'), app=read('src/App.tsx'), dataContract=read('src/dataContract.ts'), vite=read('vite.config.ts'), pkg=read('package.json');\nrequireText(main, \"endsWith('/reflection')\", 'pupil route'); requireText(main, \"endsWith('/reflection/teacher')\", 'teacher route'); requireText(main,'ReflectionTeacherApp','teacher route'); forbidText(main,'reflection-b.css','obsolete B stylesheet'); requireText(serverEntry,\"this.use('/api/reflection'\",'server route mount');\nfor (const label of ['できたこと','使ったことば','授業中に考えていたこと','困ったこと・工夫','言葉や文化について気づいたこと','次に頑張りたいこと']) requireText(reflection,label,'six-part UI');\nfor (const field of ['achievements','languageUsed','thinking','difficultyStrategy','languageCultureAwareness','nextGoal']) { requireText(reflection,field,'six-part state'); requireText(routes,field,'six-part API'); requireText(persistence,field,'six-part persistence'); }\nrequireText(reflection,'6項目 合計','six-part char count'); requireText(reflection,'前回の「次に頑張りたいこと」','next-lesson bridge'); requireText(css,'min-height:145px','large writing fields'); forbidText(reflection,'今日のめあてに向かって学ぶことができましたか？','obsolete B rating'); forbidText(reflection,'自分で考えたり、工夫したりしながら学ぶことができましたか？','obsolete B rating');\nrequireText(reflection,'draftKey = (token: string)','device-scoped draft'); requireText(reflection,\"timeZone: 'Asia/Tokyo'\",'Tokyo boundary'); requireText(reflection,'local.savedAt > serverUpdatedAt','draft freshness'); requireText(reflection,'window.clearTimeout(timerRef.current)','autosave race'); requireText(reflection,'onRecordSaved','server-state refresh'); requireText(reflection,'REFLECTION_DEVICE_REBIND_REQUIRED','rebind handling'); requireText(reflection,'もう一度読み込む','transient retry');\nfor (const route of [\"router.post('/register'\",\"router.post('/bootstrap'\",\"router.post('/save'\",\"router.post('/history'\",\"router.post('/class'\",\"router.post('/teacher/login'\",\"router.post('/teacher/dashboard'\",\"router.post('/teacher/student'\",\"router.post('/teacher/export.csv'\"]) requireText(routes,route,'route'); requireText(routes,\"requireManagementRole(['teacher'])\",'teacher auth'); requireText(routes,'resolveStudentByCode(registered.learningId)','live identity recheck'); requireText(routes,'REFLECTION_DEVICE_REBIND_REQUIRED','stale token guard'); requireText(routes,'TOO_MANY_FAILED_CODE_ATTEMPTS','code rate limit'); forbidText(routes,'researchId: record.researchId','pupil response');\nrequireText(persistence,\"const DEVICE_COLLECTION = 'reflection_devices'\",'reflection device collection'); requireText(persistence,\"const REFLECTION_COLLECTION = 'lesson_reflections'\",'reflection collection'); requireText(persistence,\"input.status === 'submitted' || existing?.status === 'submitted'\",'monotonic submit'); requireText(persistence,'queryCollectionByEqualities','exact peer query'); requireText(persistence,'sixPartCount > 0 ? sixPartCount','six-part canonical char count'); requireText(firestore,'compositeFilter','multi-field query');\nrequireText(teacher,'できたこと','teacher six fields'); requireText(teacher,'次に頑張りたいこと','teacher next goal'); requireText(teacherModel,\"'achievements'\",'teacher CSV six fields'); requireText(teacherModel,\"'next_goal'\",'teacher CSV six fields'); requireText(teacherModel,\"if (/^\\\\s*[=+\\\\-@]/.test(text))\",'CSV injection guard'); forbidText(teacherModel,\"'research_id'\",'teacher CSV internal id'); forbidText(teacherModel,\"'student_id'\",'teacher CSV internal id');\nforbidText(app,'lesson_reflections','AI App isolation'); forbidText(app,'ReflectionApp','AI App isolation'); forbidText(dataContract,'lesson_reflections','AI data contract isolation'); forbidText(reflection,'静岡大学','standalone reflection'); forbidText(reflection,'留学生','standalone reflection'); forbidText(reflection,'Unit','standalone reflection');\nrequireText(vite,\"process.env.VITE_DEPLOY_TARGET === 'pages'\",'deployment base'); requireText(vite,\"'/shizuoka-english-ai/'\",'Pages base'); requireText(pkg,'VITE_DEPLOY_TARGET=pages vite build','Pages target'); requireText(pkg,'dist/reflection/teacher','teacher static route'); requireText(pkg,'\"build\": \"vite build && npm run build:server\"','Cloud Run build isolation');\nconsole.log('[qa:reflection] PASS: six-part canonical schema + identity, autosave, privacy, teacher, route and deployment hardening verified.');\n`);

// Replace teacher QA with six-part canonical data plus legacy B compatibility and CSV safety.
write('scripts/qa-reflection-teacher.ts', `import { buildTeacherReflectionDashboard, buildTeacherStudentHistory, serializeTeacherReflectionCsv, type TeacherRosterStudent } from '../src/server/reflectionTeacherModel';\nimport type { ReflectionRecord } from '../src/server/reflectionPersistence';\nconst fail=(m:string):never=>{throw new Error('[qa:reflection-teacher] '+m)}; const assert=(c:unknown,m:string)=>{if(!c)fail(m)};\nconst roster:TeacherRosterStudent[]=[{studentId:'synthetic-student-1',learningId:'T5A2',classId:'5-1',attendanceNumber:1,active:true},{studentId:'synthetic-student-2',learningId:'T5B3',classId:'5-1',attendanceNumber:2,active:true},{studentId:'synthetic-student-3',learningId:'T5C4',classId:'5-1',attendanceNumber:3,active:true},{studentId:'synthetic-student-4',learningId:'T6D5',classId:'6-1',attendanceNumber:1,active:true}];\nconst base={researchId:'R-SYNTHETIC-ONLY',localDate:'2026-09-09',todayGoal:'相手の答えを聞いて質問を続ける',achievements:'相手の答えを聞いて、もう一つ質問できた。',languageUsed:'Really? / How about you?',thinking:'相手の答えから次の質問を考えた。',difficultyStrategy:'聞き取れないときにもう一度言ってもらった。',languageCultureAwareness:'食べ方の違いに気づいた。',nextGoal:'次は理由まで聞きたい。',reflectionCharCount:96,revision:2,createdAt:'2026-09-09T01:00:00.000Z',updatedAt:'2026-09-09T01:10:00.000Z',submittedAt:'2026-09-09T01:10:00.000Z',reflectionText:'',goalRating:null,selfRegulationRating:null} satisfies Omit<ReflectionRecord,'reflectionId'|'studentId'|'classId'|'learningId'|'status'>;\nconst records:ReflectionRecord[]=[{...base,reflectionId:'r1',studentId:'synthetic-student-1',classId:'5-1',learningId:'T5A2',status:'submitted'},{...base,reflectionId:'r2',studentId:'synthetic-student-2',classId:'5-1',learningId:'T5B3',status:'draft',submittedAt:'',achievements:'=HYPERLINK(\"https://example.invalid\",\"x\")'},{...base,reflectionId:'r4',studentId:'synthetic-student-4',classId:'6-1',learningId:'T6D5',status:'submitted'},{...base,reflectionId:'legacy-b',studentId:'synthetic-student-1',classId:'5-1',learningId:'T5A2',localDate:'2026-09-02',status:'submitted',achievements:'',languageUsed:'',thinking:'',difficultyStrategy:'',languageCultureAwareness:'',nextGoal:'',reflectionText:'B設計期間の旧形式振り返り',goalRating:4,selfRegulationRating:3,reflectionCharCount:14}];\nconst d=buildTeacherReflectionDashboard(roster,records,'2026-09-09','5-1','2026-09-09'); assert(d.counts.total===3,'total');assert(d.counts.submitted===1,'submitted');assert(d.counts.draft===1,'draft');assert(d.counts.missing===1,'missing');assert(d.students[0]?.achievements.includes('もう一つ質問'),'six-part dashboard');assert(d.students[0]?.nextGoal==='次は理由まで聞きたい。','next goal dashboard');\nconst h=buildTeacherStudentHistory(roster,records,'t5a2');assert(h?.history.length===2,'history');const hs=JSON.stringify(h);assert(!hs.includes('R-SYNTHETIC-ONLY'),'researchId redaction');assert(!hs.includes('synthetic-student-1'),'studentId redaction');\nconst csv=serializeTeacherReflectionCsv(roster,records,'2026-09-09','5-1');assert(csv.startsWith('\\uFEFF'),'BOM');for(const x of ['achievements','language_used','thinking','difficulty_strategy','language_culture_awareness','next_goal'])assert(csv.includes('"'+x+'"'),'missing '+x);assert(csv.includes('"T5A2"'),'learning id');assert(csv.includes(\"\\\"'=HYPERLINK(\"\"\"),'formula guard');assert(!csv.includes('research_id'),'no research id');assert(!csv.includes('student_id'),'no student id');assert(!csv.includes('T5C4'),'no fabricated missing row');const legacy=serializeTeacherReflectionCsv(roster,records,'2026-09-02','5-1');assert(legacy.includes('B設計期間の旧形式振り返り'),'legacy B preserved');\nconsole.log('[qa:reflection-teacher] PASS: six-part canonical teacher data, redaction, legacy B preservation and CSV safety verified.');\n`);

// Cross-module final integrity QA: joins, namespaces, roles, IDs and formal exports.
write('scripts/qa-final-system-integrity.ts', `import assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport { AI_STUDENT_IDS, RESEARCH_SYSTEM_EVENT_TYPES } from '../src/dataContract';\nimport { TARGET_20_AI_STUDENT_IDS } from '../src/data/curriculum';\nimport { RESEARCH_EXPORT_HEADERS, RESEARCH_EXPORT_SCHEMA_VERSION } from '../src/server/researchDashboard';\nconst read=(p:string)=>fs.readFileSync(p,'utf8'); const persistence=read('src/server/persistence.ts'), reflection=read('src/server/reflectionPersistence.ts'), routes=read('src/server/reflectionRoutes.ts'), server=read('server.ts'), entry=read('server-entry.ts'), research=read('src/server/researchDashboard.ts'), main=read('src/main.tsx'), pkg=read('package.json');\nassert.equal(new Set(AI_STUDENT_IDS).size,20,'AI student IDs must be unique');assert.equal(new Set(TARGET_20_AI_STUDENT_IDS).size,20,'research persona IDs must be unique');assert.deepEqual(new Set(AI_STUDENT_IDS),new Set(TARGET_20_AI_STUDENT_IDS),'runtime and formal research persona sets must match');\nfor(const pair of [[\"const STUDENT_COLLECTION = 'students'\",persistence],[\"const SESSION_COLLECTION = 'sessions'\",persistence],[\"const RESEARCH_ID_COLLECTION = 'research_ids'\",persistence],[\"const DEVICE_COLLECTION = 'reflection_devices'\",reflection],[\"const REFLECTION_COLLECTION = 'lesson_reflections'\",reflection]] as const)assert.ok(pair[1].includes(pair[0]),'collection namespace missing '+pair[0]);\nassert.ok(persistence.includes("existing.studentId !== args.studentId")&&persistence.includes('SESSION_ID_CONFLICT'),'session ownership conflict guard');assert.ok(persistence.includes('researchId || await generateUniqueResearchId'),'research ID generation');assert.ok(persistence.includes('studentId,\\n    String(latest.researchId'),'code reissue must retain researchId');assert.ok(routes.includes('current.studentId !== registered.studentId || current.researchId !== registered.researchId'),'reflection token must rebind after identity change');\nassert.ok(server.includes("result.role!=='researcher'")&&server.includes("requireManagementRole(['researcher'])"),'researcher role isolation');assert.ok(routes.includes("result.role !== 'teacher'")&&routes.includes("requireManagementRole(['teacher'])"),'teacher role isolation');assert.ok(entry.includes("this.use('/api/reflection'"),'reflection route namespace');assert.ok(main.includes("endsWith('/reflection/teacher')")&&main.includes("endsWith('/reflection')"),'client route separation');\nassert.deepEqual(Object.keys(RESEARCH_EXPORT_HEADERS).sort(),['codebook','expressions','personas','sessions','utterances'].sort(),'formal export stays five-file');assert.equal(RESEARCH_EXPORT_SCHEMA_VERSION,'research-2026-v4','formal schema version');for(const forbidden of ['student_id','learning_id','device_token'])assert.equal(RESEARCH_EXPORT_HEADERS.sessions.includes(forbidden),false,'formal sessions must exclude '+forbidden);for(const key of ['research_id','session_id','persona_id'])assert.ok(RESEARCH_EXPORT_HEADERS.sessions.includes(key),'session join key missing '+key);for(const key of ['session_id','utterance_id'])assert.ok(RESEARCH_EXPORT_HEADERS.utterances.includes(key),'utterance join key missing '+key);for(const key of ['session_id','utterance_id','persona_id'])assert.ok(RESEARCH_EXPORT_HEADERS.expressions.includes(key),'expression join key missing '+key);for(const key of ['asr_bias_applied_count','asr_bias_unavailable_count','asr_contextual_correction_count'])assert.ok(RESEARCH_EXPORT_HEADERS.sessions.includes(key),'ASR formal count missing '+key);assert.ok(research.includes("utterance_id: `u_\\${String(row.session_id || '')}_\\${String(row.turn_sequence || '')}`"),'stable utterance join key');\nfor(const e of ['asr_bias_status','asr_contextual_correction'])assert.ok((RESEARCH_SYSTEM_EVENT_TYPES as readonly string[]).includes(e),'ASR event contract missing '+e);assert.ok(!research.includes('asr_contextual_correction_value'),'raw ASR correction value must not become formal column');\nassert.ok(pkg.includes('qa:final-integrity'),'final audit must stay in regression suite');\nconsole.log('FINAL SYSTEM INTEGRITY QA PASS: routes, collections, identities, joins, roles, personas, reflection separation and ASR formal counts.');\n`);

// Add final integrity QA permanently to the standard suite.
const packageData = JSON.parse(read('package.json'));
packageData.scripts['qa:final-integrity'] = 'tsx scripts/qa-final-system-integrity.ts';
if (!packageData.scripts.qa.includes('qa:final-integrity')) packageData.scripts.qa = packageData.scripts.qa.replace(' && npm run lint', ' && npm run qa:final-integrity && npm run lint');
write('package.json', JSON.stringify(packageData, null, 2) + '\n');

console.log('Final system integrity patch applied.');
