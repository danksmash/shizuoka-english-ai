from pathlib import Path

def rep(path, old, new, count=1):
    p=Path(path); t=p.read_text(); n=t.count(old)
    if n!=count: raise SystemExit(f'{path}: expected {count}, found {n}: {old[:100]!r}')
    p.write_text(t.replace(old,new,count))

# SetupScreen: learning code replaces name field only when persistence is configured.
rep('src/components/SetupScreen.tsx',
"interface SetupScreenProps {\n  onStartDialogue: (profile: StudentProfile) => void;\n}",
"interface SetupScreenProps {\n  onStartDialogue: (profile: StudentProfile, learningCode: string) => void;\n  learningDataEnabled: boolean;\n  onValidateLearningCode: (learningCode: string) => Promise<boolean>;\n}")
rep('src/components/SetupScreen.tsx',
"export const SetupScreen: React.FC<SetupScreenProps> = ({ onStartDialogue }) => {\n  const [selectedStudentId, setSelectedStudentId] = useState<string>('emma_usa');\n  const [name, setName] = useState<string>('5・6年生');",
"export const SetupScreen: React.FC<SetupScreenProps> = ({ onStartDialogue, learningDataEnabled, onValidateLearningCode }) => {\n  const [selectedStudentId, setSelectedStudentId] = useState<string>('emma_usa');\n  const [learningCode, setLearningCode] = useState<string>('');\n  const [codeError, setCodeError] = useState<string>('');\n  const [checkingCode, setCheckingCode] = useState(false);")
rep('src/components/SetupScreen.tsx',
"  const handleStart = () => {\n    stopSpeaking();\n    onStartDialogue({\n      name: name.trim() || '5・6年生',\n      grade: '小学校５・６年生',\n      selectedDurationMinutes: durationMinutes,\n      selectedTopic,\n      selectedAiStudentId: selectedStudentId,\n    });\n  };",
"  const handleStart = async () => {\n    stopSpeaking();\n    const normalizedCode = learningCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);\n    if (learningDataEnabled) {\n      if (!/^[A-Z0-9]{4,8}$/.test(normalizedCode)) { setCodeError('4〜8文字の学習コードを入力してください。'); return; }\n      setCheckingCode(true); setCodeError('');\n      const ok = await onValidateLearningCode(normalizedCode);\n      setCheckingCode(false);\n      if (!ok) { setCodeError('学習コードを確認できませんでした。先生に確認してください。'); return; }\n    }\n    onStartDialogue({\n      name: '5・6年生',\n      grade: '小学校５・６年生',\n      selectedDurationMinutes: durationMinutes as 1 | 2 | 3 | 5,\n      selectedTopic,\n      selectedAiStudentId: selectedStudentId as any,\n    }, learningDataEnabled ? normalizedCode : '');\n  };")
old_header='''        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 px-3 py-1 rounded-xl shadow-2xs flex-shrink-0 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-1.5">
            <User className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <span className="text-xs sm:text-sm font-bold text-slate-700 whitespace-nowrap">お名前:</span>
          </div>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="ニックネーム等"
            className="bg-white border border-slate-300 rounded-lg px-2 py-0.5 text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 w-32 sm:w-36"
          />
        </div>'''
new_header='''        <div className="flex flex-col items-stretch gap-1 bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-xl shadow-2xs flex-shrink-0 w-full sm:w-auto">
          <div className="flex items-center gap-1.5">
            <User className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <span className="text-xs sm:text-sm font-bold text-slate-700 whitespace-nowrap">{learningDataEnabled ? '学習コード:' : '利用者:'}</span>
            {learningDataEnabled ? <input type="text" value={learningCode} onChange={(event) => { setLearningCode(event.target.value.toUpperCase()); setCodeError(''); }} placeholder="例 A7M4" autoCapitalize="characters" maxLength={8} className="bg-white border border-slate-300 rounded-lg px-2 py-0.5 text-xs sm:text-sm font-bold text-slate-900 tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 w-32 sm:w-36" /> : <span className="text-xs sm:text-sm font-black text-slate-800">5・6年生</span>}
          </div>
          {codeError && <p className="text-[10px] font-bold text-rose-700 max-w-56">{codeError}</p>}
        </div>'''
rep('src/components/SetupScreen.tsx', old_header, new_header)
rep('src/components/SetupScreen.tsx', "onClick={handleStart}", "onClick={() => void handleStart()}")
rep('src/components/SetupScreen.tsx', "<span>えいご対話をはじめる</span>", "<span>{checkingCode ? '学習コードを確認中…' : 'えいご対話をはじめる'}</span>")

# App flow and persistence integration.
rep('src/App.tsx', "import { FeedbackScreen } from './components/FeedbackScreen';", "import { FeedbackScreen } from './components/FeedbackScreen';\nimport { ReflectionScreen } from './components/ReflectionScreen';\nimport { LearningHistoryScreen, type StudentHistoryRow } from './components/LearningHistoryScreen';")
rep('src/App.tsx', "import { motion, AnimatePresence } from 'motion/react';", "import { motion, AnimatePresence } from 'motion/react';\nimport type { ReflectionAnswers } from './dataContract';")
rep('src/App.tsx', "  const [phase, setPhase] = useState<'setup' | 'dialogue' | 'feedback'>('setup');", "  const [phase, setPhase] = useState<'setup' | 'dialogue' | 'reflection' | 'feedback' | 'history'>('setup');")
anchor="  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);"
insert="""  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [learningDataEnabled, setLearningDataEnabled] = useState(false);
  const [learningCode, setLearningCode] = useState('');
  const [sessionId, setSessionId] = useState('');
  const sessionStartedAtRef = useRef(0);
  const sessionEndedAtRef = useRef(0);
  const [isSavingReflection, setIsSavingReflection] = useState(false);
  const [reflectionSaveMessage, setReflectionSaveMessage] = useState('');
  const [historyRows, setHistoryRows] = useState<StudentHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
"""
rep('src/App.tsx', anchor, insert)
marker="  const playAiVoice = useCallback((text: string) => {"
helpers="""  useEffect(() => {
    fetch(apiUrl('/api/health')).then((response) => response.json()).then((data) => {
      setLearningDataEnabled(Boolean(data?.learningDataConfigured));
    }).catch(() => setLearningDataEnabled(false));
  }, []);

  const validateLearningCode = useCallback(async (code: string): Promise<boolean> => {
    try {
      const response = await fetch(apiUrl('/api/student/resolve'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ learningCode: code }) });
      const data = await response.json();
      return response.ok && data?.success === true;
    } catch { return false; }
  }, []);

  const newSessionId = () => {
    const id = globalThis.crypto?.randomUUID?.();
    return id ? `session_${id.replace(/-/g, '')}` : `session_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  };

"""
rep('src/App.tsx', marker, helpers+marker)
rep('src/App.tsx', "  const handleStartDialogue = (newProfile: StudentProfile) => {", "  const handleStartDialogue = (newProfile: StudentProfile, code: string) => {")
rep('src/App.tsx', "    setProfile(newProfile); profileRef.current = newProfile;", "    setProfile(newProfile); profileRef.current = newProfile;\n    setLearningCode(code); setSessionId(newSessionId()); sessionStartedAtRef.current = Date.now(); sessionEndedAtRef.current = 0;\n    setReflectionSaveMessage('');")
rep('src/App.tsx', "setFarewellBanner(null); setPhase('feedback');", "setFarewellBanner(null); setPhase('reflection');")
# There are two transition-to-feedback strings: fallback branch and executeTransition.
rep('src/App.tsx', "setFarewellBanner(null);setPhase('feedback');", "setFarewellBanner(null);setPhase('reflection');")
rep('src/App.tsx', "    const currentProf=profileRef.current; const studentObj=getAIStudentById(currentProf.selectedAiStudentId);", "    sessionEndedAtRef.current = Date.now();\n    const currentProf=profileRef.current; const studentObj=getAIStudentById(currentProf.selectedAiStudentId);")
# Insert reflection/history handlers before restart.
restart_marker="  const handleRestart=()=>{"
handlers="""  const handleSubmitReflection = async (answers: ReflectionAnswers) => {
    setIsSavingReflection(true); setReflectionSaveMessage('');
    if (learningDataEnabled && learningCode && sessionId) {
      try {
        const response = await fetch(apiUrl('/api/sessions'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          sessionId, learningCode, aiStudentId: profileRef.current.selectedAiStudentId, topic: profileRef.current.selectedTopic,
          targetDurationMinutes: profileRef.current.selectedDurationMinutes, startedAt: sessionStartedAtRef.current,
          endedAt: sessionEndedAtRef.current || Date.now(), history: messagesRef.current, encounteredVocab: encounteredVocabRef.current, reflection: answers,
        }) });
        const data = await response.json();
        if (!response.ok || !data?.success) throw new Error(data?.error || 'SAVE_FAILED');
        setReflectionSaveMessage('学習履歴に保存しました。');
      } catch (error) {
        console.warn('Session persistence unavailable:', error);
        setReflectionSaveMessage('今回は学習履歴に保存できませんでした。レポートはそのまま見ることができます。');
      }
    }
    setIsSavingReflection(false); setPhase('feedback');
  };

  const handleOpenHistory = async () => {
    setPhase('history'); setHistoryRows([]); setHistoryError('');
    if (!learningDataEnabled || !learningCode) { setHistoryError('学習履歴機能は現在準備中です。'); return; }
    setHistoryLoading(true);
    try {
      const response = await fetch(apiUrl('/api/student/history'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ learningCode }) });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.error || 'HISTORY_FAILED');
      setHistoryRows(Array.isArray(data.history) ? data.history : []);
    } catch (error) { console.warn('History unavailable:', error); setHistoryError('学習履歴を読み込めませんでした。もう一度試してください。'); }
    finally { setHistoryLoading(false); }
  };

"""
rep('src/App.tsx', restart_marker, handlers+restart_marker)
rep('src/App.tsx', "setFarewellBanner(null);setMicHintMessage('');};", "setFarewellBanner(null);setMicHintMessage('');setLearningCode('');setSessionId('');setReflectionSaveMessage('');};")
rep('src/App.tsx', "      {phase==='setup' && <SetupScreen onStartDialogue={handleStartDialogue}/>} ", "      {phase==='setup' && <SetupScreen onStartDialogue={handleStartDialogue} learningDataEnabled={learningDataEnabled} onValidateLearningCode={validateLearningCode}/>} ")
old_feedback="      {phase==='feedback'&&<FeedbackScreen profile={profile} messages={messages} feedback={feedback} isLoadingFeedback={isLoadingFeedback} totalTurns={turnCount} totalWords={totalChildWords} elapsedSeconds={elapsedSeconds} encounteredVocabList={encounteredVocabList} onPlayAudio={playAiVoice} onRestart={handleRestart}/>} "
new_feedback="      {phase==='reflection'&&<ReflectionScreen aiStudent={currentAiStudent} onSubmit={handleSubmitReflection} isSaving={isSavingReflection} saveMessage={reflectionSaveMessage}/>}\n      {phase==='feedback'&&<FeedbackScreen profile={profile} messages={messages} feedback={feedback} isLoadingFeedback={isLoadingFeedback} totalTurns={turnCount} totalWords={totalChildWords} elapsedSeconds={elapsedSeconds} encounteredVocabList={encounteredVocabList} onPlayAudio={playAiVoice} onRestart={handleRestart} onOpenHistory={learningDataEnabled && learningCode ? handleOpenHistory : undefined}/>}\n      {phase==='history'&&<LearningHistoryScreen rows={historyRows} loading={historyLoading} error={historyError} onBack={()=>setPhase('feedback')}/>} "
rep('src/App.tsx', old_feedback, new_feedback)

# FeedbackScreen: optional history button.
rep('src/components/FeedbackScreen.tsx', "  Copy,\n} from 'lucide-react';", "  Copy,\n  BarChart3,\n} from 'lucide-react';")
rep('src/components/FeedbackScreen.tsx', "  onRestart: () => void;\n}", "  onRestart: () => void;\n  onOpenHistory?: () => void;\n}")
rep('src/components/FeedbackScreen.tsx', "  onRestart,\n}) => {", "  onRestart,\n  onOpenHistory,\n}) => {")
button_marker='''          <button
            type="button"
            onClick={handlePrint}'''
history_button='''          {onOpenHistory && <button type="button" onClick={onOpenHistory} className="flex-1 md:flex-none px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-blue-200"><BarChart3 className="w-4 h-4" /><span>わたしの学習履歴</span></button>}

          <button
            type="button"
            onClick={handlePrint}'''
rep('src/components/FeedbackScreen.tsx', button_marker, history_button)

# Health capability and code provisioning API.
rep('server.ts', "import { getAllSessionsForManagement, getStudentHistory, anonymizeSessionForResearch, persistenceConfigured, resolveStudentByCode, saveCanonicalSession } from './src/server/persistence';", "import { createStudentCode, getAllSessionsForManagement, getStudentHistory, anonymizeSessionForResearch, persistenceConfigured, resolveStudentByCode, saveCanonicalSession } from './src/server/persistence';")
rep('server.ts', "    ttsProvider: 'google-chirp3-hd',", "    ttsProvider: 'google-chirp3-hd',\n    learningDataConfigured: persistenceConfigured(),\n    managementConfigured: managementAuthConfigured(),")
mgmt_marker="app.get('/api/management/sessions',requireManagementRole(['teacher','researcher']),async(_req,res)=>{"
mgmt_route="""app.post('/api/management/student-codes', requireManagementRole(['teacher','researcher']), async (req,res) => {
  const code = normalizeLearningCode(req.body?.learningCode);
  if (!isValidLearningCode(code)) return res.status(400).json({success:false,error:'INVALID_LEARNING_CODE'});
  try { const created = await createStudentCode(code); return res.json({success:true,studentId:created.studentId,researchId:created.researchId}); }
  catch(error:any) { console.error('Student code creation failed',{message:error?.message}); return res.status(503).json({success:false,error:'CODE_CREATE_UNAVAILABLE'}); }
});
"""
rep('server.ts', mgmt_marker, mgmt_route+mgmt_marker)

# QA for the new student flow guardrails.
Path('scripts/qa-stage3b.ts').write_text("""import assert from 'node:assert/strict';
import { isValidLearningCode, parseReflectionAnswers } from '../src/dataContract';
assert.equal(isValidLearningCode('A7M4'), true);
assert.equal(isValidLearningCode('bad!'), false);
assert.equal(parseReflectionAnswers({conveyedIdeas:1,understoodPartner:2,continuedConversation:3,noticedLanguageCulture:5})?.noticedLanguageCulture,5);
const setup=(await import('node:fs/promises')).readFile('src/components/SetupScreen.tsx','utf8');
assert.ok((await setup).includes('学習コード'));
const app=(await import('node:fs/promises')).readFile('src/App.tsx','utf8');
assert.ok((await app).includes("setPhase('reflection')"));
assert.ok((await app).includes("/api/sessions"));
console.log('STAGE 3B QA PASS');
""")
