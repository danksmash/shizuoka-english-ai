from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'pattern not found in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1))

# Persistence: store non-content system events and explicit derived session metrics.
replace_once('src/server/persistence.ts',
"import { ReflectionAnswers, calculateCanonicalStats, maskHistoryForStorage } from '../dataContract';",
"import { ReflectionAnswers, ResearchSystemEvent, calculateCanonicalStats, maskHistoryForStorage } from '../dataContract';")
replace_once('src/server/persistence.ts',
"  encounteredVocab: VisualVocabularyItem[]; reflection?: ReflectionAnswers;\n}",
"  encounteredVocab: VisualVocabularyItem[]; reflection?: ReflectionAnswers; systemEvents?: ResearchSystemEvent[];\n}")
replace_once('src/server/persistence.ts', 'schemaVersion: 2, sessionId:', 'schemaVersion: 3, sessionId:')
replace_once('src/server/persistence.ts',
"    uniqueVocabularyCount: stats.uniqueVocabularyCount, history: safeHistory,\n",
"    uniqueVocabularyCount: stats.uniqueVocabularyCount,\n    childUniqueWordTypes: stats.childUniqueWordTypes, meanChildWordsPerTurn: stats.meanChildWordsPerTurn, maxChildWordsPerTurn: stats.maxChildWordsPerTurn,\n    childQuestionCount: stats.childQuestionCount, childReciprocalQuestionCount: stats.childReciprocalQuestionCount, childRepairCount: stats.childRepairCount, childReasonExpressionCount: stats.childReasonExpressionCount,\n    history: safeHistory, systemEvents: (args.systemEvents || []).slice(0, 500),\n")

# Server: use unified Grade 5-6 vocabulary, persist events, and expose four anonymized research datasets.
replace_once('server.ts',
"import { detectVocabularyInText } from './src/data/vocabulary';",
"import { detectVocabularyInText } from './src/data/vocabulary56';")
replace_once('server.ts',
"import { createStudentCode, getAllSessionsForManagement, getTeacherSessionsForManagement, getStudentHistory, getStudentRecordsForManagement, reissueStudentCode, setStudentActive, anonymizeSessionForResearch, persistenceConfigured, resolveStudentByCode, saveCanonicalSession } from './src/server/persistence';",
"import { createStudentCode, getAllSessionsForManagement, getTeacherSessionsForManagement, getStudentHistory, getStudentRecordsForManagement, reissueStudentCode, setStudentActive, persistenceConfigured, resolveStudentByCode, saveCanonicalSession } from './src/server/persistence';\nimport { buildResearchDataSets, type ResearchDatasetName } from './src/server/researchExport';")
replace_once('server.ts',
"endedAt:validated.value.endedAt,history:validated.value.history,encounteredVocab:validated.value.encounteredVocab||[],reflection:validated.value.reflection});",
"endedAt:validated.value.endedAt,history:validated.value.history,encounteredVocab:validated.value.encounteredVocab||[],reflection:validated.value.reflection,systemEvents:validated.value.systemEvents||[]});")
old_route = "app.get('/api/management/research.csv',requireManagementRole(['researcher']),async(_req,res)=>{try{const sessions=await getAllSessionsForManagement();const rows=sessions.map(anonymizeSessionForResearch);const headers=rows.length?Object.keys(rows[0]):['research_id','session_id'];const csv=[headers.map(csvCell).join(','),...rows.map(row=>headers.map(key=>csvCell(row[key])).join(','))].join('\\n');res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename=\"research-export.csv\"');res.setHeader('Cache-Control','no-store');return res.send('\\uFEFF'+csv);}catch(error:any){console.error('Research export failed',{message:error?.message});return res.status(503).json({success:false,error:'RESEARCH_EXPORT_UNAVAILABLE'});}});"
new_route = """app.get('/api/management/research.csv',requireManagementRole(['researcher']),async(req,res)=>{
  try {
    const sessions=await getAllSessionsForManagement();
    const requested=typeof req.query?.dataset==='string'?req.query.dataset:'sessions';
    const dataset:ResearchDatasetName=(['sessions','turns','expressions','system_events'] as string[]).includes(requested)?requested as ResearchDatasetName:'sessions';
    const rows=buildResearchDataSets(sessions)[dataset];
    const defaultHeaders:Record<ResearchDatasetName,string[]>={
      sessions:['research_id','class_id','session_id','local_date','local_start_time','usage_context_inferred'],
      turns:['research_id','class_id','session_id','turn_sequence','speaker','english_text_anonymized'],
      expressions:['research_id','class_id','session_id','turn_sequence','speaker','expression'],
      system_events:['research_id','class_id','session_id','event_sequence','local_timestamp','event_type'],
    };
    const headers=rows.length?Object.keys(rows[0]):defaultHeaders[dataset];
    const csv=[headers.map(csvCell).join(','),...rows.map(row=>headers.map(key=>csvCell(row[key])).join(','))].join('\\n');
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition',`attachment; filename=\"research-${dataset}.csv\"`);
    res.setHeader('Cache-Control','no-store');
    return res.send('\\uFEFF'+csv);
  }catch(error:any){console.error('Research export failed',{message:error?.message});return res.status(503).json({success:false,error:'RESEARCH_EXPORT_UNAVAILABLE'});}
});"""
replace_once('server.ts', old_route, new_route)

# App: record only non-content interaction events that cannot be reconstructed later.
replace_once('src/App.tsx',
"import type { ReflectionAnswers } from './dataContract';",
"import type { ReflectionAnswers, ResearchSystemEvent, ResearchSystemEventType } from './dataContract';")
replace_once('src/App.tsx',
"  const chatAbortControllerRef = useRef<AbortController | null>(null);\n",
"  const chatAbortControllerRef = useRef<AbortController | null>(null);\n  const systemEventsRef = useRef<ResearchSystemEvent[]>([]);\n  const recordResearchEvent = useCallback((type: ResearchSystemEventType, value?: string) => {\n    const event: ResearchSystemEvent = { type, timestamp: Date.now(), ...(value ? { value: value.slice(0, 80) } : {}) };\n    systemEventsRef.current = [...systemEventsRef.current.slice(-499), event];\n  }, []);\n")
replace_once('src/App.tsx',
"    setLearningCode(code); setSessionId(newSessionId()); sessionStartedAtRef.current = Date.now(); sessionEndedAtRef.current = 0;",
"    const startedAt = Date.now();\n    setLearningCode(code); setSessionId(newSessionId()); sessionStartedAtRef.current = startedAt; sessionEndedAtRef.current = 0;\n    systemEventsRef.current = [{ type: 'session_start', timestamp: startedAt }];")
replace_once('src/App.tsx',
"      if (!wasAborted && dialogueActiveRef.current) { console.error('AI backend unavailable:', e); setMood('listening');",
"      if (!wasAborted && dialogueActiveRef.current) { recordResearchEvent('ai_request_failure'); console.error('AI backend unavailable:', e); setMood('listening');")
replace_once('src/App.tsx',
"      const spokenText = liveTranscriptRef.current.trim();\n      stopRecordingInternal();",
"      const spokenText = liveTranscriptRef.current.trim();\n      recordResearchEvent('mic_stop_send', spokenText ? 'with_speech' : 'empty');\n      stopRecordingInternal();")
replace_once('src/App.tsx',
"    } catch {\n      setMicHintMessage('マイクの使用が許可されていません。ブラウザのマイク設定を「許可」にしてください。');",
"    } catch {\n      recordResearchEvent('mic_error', 'permission');\n      setMicHintMessage('マイクの使用が許可されていません。ブラウザのマイク設定を「許可」にしてください。');")
replace_once('src/App.tsx',
"    liveTranscriptRef.current=''; setSpeechTranscript(''); setIsRecording(true); setIsListening(true);",
"    recordResearchEvent('mic_start');\n    liveTranscriptRef.current=''; setSpeechTranscript(''); setIsRecording(true); setIsListening(true);")
replace_once('src/App.tsx',
"      (err) => { console.warn('Speech Rec Error:', err); setMicHintMessage(mapSpeechError(err));",
"      (err) => { recordResearchEvent('mic_error', String(err).slice(0, 40)); console.warn('Speech Rec Error:', err); setMicHintMessage(mapSpeechError(err));")
replace_once('src/App.tsx',
"      catch (e) { console.warn('Speech Rec start error', e);",
"      catch (e) { recordResearchEvent('mic_error', 'start'); console.warn('Speech Rec start error', e);") if False else None
# Actual source uses a colon after 'error'.
replace_once('src/App.tsx',
"      catch (e) { console.warn('Speech Rec start error:', e); setMicHintMessage('マイクを開始できませんでした。もう一度試してください。');",
"      catch (e) { recordResearchEvent('mic_error', 'start'); console.warn('Speech Rec start error:', e); setMicHintMessage('マイクを開始できませんでした。もう一度試してください。');")
replace_once('src/App.tsx',
"    } else {\n      setMicHintMessage('このブラウザでは音声認識が制限されています。文字入力を使ってください。');",
"    } else {\n      recordResearchEvent('mic_error', 'unsupported');\n      setMicHintMessage('このブラウザでは音声認識が制限されています。文字入力を使ってください。');")
replace_once('src/App.tsx',
"    sessionEndedAtRef.current = Date.now();",
"    sessionEndedAtRef.current = Date.now(); recordResearchEvent('session_finish');")
replace_once('src/App.tsx',
"  const handleSubmitReflection = async (answers: ReflectionAnswers) => {\n    setIsSavingReflection(true);",
"  const handleSubmitReflection = async (answers: ReflectionAnswers) => {\n    recordResearchEvent('reflection_submit');\n    setIsSavingReflection(true);")
replace_once('src/App.tsx',
"          endedAt: sessionEndedAtRef.current || Date.now(), history: messagesRef.current, encounteredVocab: encounteredVocabRef.current, reflection: answers,",
"          endedAt: sessionEndedAtRef.current || Date.now(), history: messagesRef.current, encounteredVocab: encounteredVocabRef.current, reflection: answers, systemEvents: systemEventsRef.current,")
replace_once('src/App.tsx',
"<AIStudentCard student={currentAiStudent} mood={mood} isSpeaking={isSpeaking} isListening={isListening} speechRate={speechRate} onReplayAudio={()=>{const lastAi=messages.filter((m)=>m.sender==='ai').slice(-1)[0];if(lastAi)playAiVoice(lastAi.englishText);}} onChangeSpeechRate={setSpeechRate}/>",
"<AIStudentCard student={currentAiStudent} mood={mood} isSpeaking={isSpeaking} isListening={isListening} speechRate={speechRate} onReplayAudio={()=>{recordResearchEvent('ai_replay','profile');const lastAi=messages.filter((m)=>m.sender==='ai').slice(-1)[0];if(lastAi)playAiVoice(lastAi.englishText);}} onChangeSpeechRate={(rate)=>{recordResearchEvent('speech_rate_change',rate.toFixed(2));setSpeechRate(rate);}}/>")
replace_once('src/App.tsx',
"<VisualVocabularyDock vocabularyList={encounteredVocabList} latestItem={latestVocabItem} onPlayWord={(word)=>speakVocabularyWord(word,currentAiStudent.voiceLang)}/>",
"<VisualVocabularyDock vocabularyList={encounteredVocabList} latestItem={latestVocabItem} onPlayWord={(word)=>speakVocabularyWord(word,currentAiStudent.voiceLang)} onResearchEvent={recordResearchEvent}/>")
replace_once('src/App.tsx',
"<DialogueView messages={messages} studentName={profile.name} aiStudent={currentAiStudent} isAiResponding={isAiResponding} onPlayAudio={playAiVoice}/>",
"<DialogueView messages={messages} studentName={profile.name} aiStudent={currentAiStudent} isAiResponding={isAiResponding} onPlayAudio={(text)=>{recordResearchEvent('ai_replay','transcript');playAiVoice(text);}}/>")
old_bar = "<SpeechInputBar isRecording={isRecording} transcript={speechTranscript} isAiResponding={isAiResponding} onToggleRecording={handleToggleRecording} onSendMessage={handleSendMessage} onClearTranscript={()=>{setSpeechTranscript('');liveTranscriptRef.current='';}}/>"
new_bar = "<SpeechInputBar isRecording={isRecording} transcript={speechTranscript} isAiResponding={isAiResponding} onToggleRecording={handleToggleRecording} onSendMessage={handleSendMessage} onClearTranscript={()=>{setSpeechTranscript('');liveTranscriptRef.current='';}} onResearchEvent={recordResearchEvent}/>"
app = Path('src/App.tsx')
text = app.read_text()
if text.count(old_bar) != 1:
    raise SystemExit(f'expected one desktop SpeechInputBar, got {text.count(old_bar)}')
text = text.replace(old_bar, new_bar)
old_mobile = "<SpeechInputBar compact isRecording={isRecording} transcript={speechTranscript} isAiResponding={isAiResponding} onToggleRecording={handleToggleRecording} onSendMessage={handleSendMessage} onClearTranscript={()=>{setSpeechTranscript('');liveTranscriptRef.current='';}}/>"
new_mobile = "<SpeechInputBar compact isRecording={isRecording} transcript={speechTranscript} isAiResponding={isAiResponding} onToggleRecording={handleToggleRecording} onSendMessage={handleSendMessage} onClearTranscript={()=>{setSpeechTranscript('');liveTranscriptRef.current='';}} onResearchEvent={recordResearchEvent}/>"
if old_mobile not in text:
    raise SystemExit('mobile SpeechInputBar not found')
app.write_text(text.replace(old_mobile, new_mobile, 1))

# Researcher UI: four linked CSV datasets, while raw teacher data remains inaccessible.
old_export = "<div class=\"checklist\"><label><input type=\"checkbox\" checked disabled style=\"width:auto\"> 対話時間・ターン数・発話語数</label><label><input type=\"checkbox\" checked disabled style=\"width:auto\"> 振り返り3項目</label><label><input type=\"checkbox\" checked disabled style=\"width:auto\"> research_id・class_id</label></div><p class=\"note\">学習者用コード・氏名・学校名・生の発話本文は出力されません。</p><button id=\"csvBtn\" class=\"primary full\">匿名化CSVを作成</button>"
new_export = "<div class=\"checklist\"><label><input type=\"checkbox\" checked disabled style=\"width:auto\"> sessions.csv：セッション・学校内外推定・発話指標・振り返り</label><label><input type=\"checkbox\" checked disabled style=\"width:auto\"> turns.csv：PIIマスキング済み匿名化発話・turn単位指標</label><label><input type=\"checkbox\" checked disabled style=\"width:auto\"> expressions.csv：5・6年教科書語彙・表現の実出現</label><label><input type=\"checkbox\" checked disabled style=\"width:auto\"> system_events.csv：支援機能の操作イベント</label></div><p class=\"note\">学習者用コード・氏名・学校名は出力しません。turns.csvの発話本文は保存時にPIIマスキング済みの匿名化本文です。研究者画面上には本文を表示しません。</p><button id=\"csvBtn\" class=\"primary full\">sessions.csv を作成</button><button id=\"turnsCsvBtn\" class=\"secondary full\">turns.csv を作成</button><button id=\"expressionsCsvBtn\" class=\"secondary full\">expressions.csv を作成</button><button id=\"eventsCsvBtn\" class=\"secondary full\">system_events.csv を作成</button>"
replace_once('src/server/managementPage.ts', old_export, new_export)
old_history_fn = "function addExportHistory(rows,name){exportHistory.unshift({at:new Date().toLocaleString('ja-JP'),cond:($('r6Class').value||'all')+' / '+($('r6Research').value||'all'),rows:rows.length,name:name});$('exportRows').innerHTML=exportHistory.map(function(x){return '<tr><td>'+esc(x.at)+'</td><td>'+esc(x.cond)+'</td><td>'+x.rows+'</td><td>'+esc(x.name)+'</td></tr>'}).join('')}"
new_history_fn = old_history_fn + "\nasync function downloadResearchDataset(dataset){var sessionRows=renderQuality(),allowed=new Set(sessionRows.map(function(r){return r.session_id})),rows;if(dataset==='sessions'){rows=sessionRows}else{var resp=await fetch('/api/management/research.csv?dataset='+encodeURIComponent(dataset));if(!resp.ok)throw new Error('RESEARCH_DATA_UNAVAILABLE');rows=csvParse(await resp.text()).filter(function(r){return allowed.has(r.session_id)})}var name='research_'+dataset+'_'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'.csv';downloadRows(rows,name);addExportHistory(rows,name)}"
replace_once('src/server/managementPage.ts', old_history_fn, new_history_fn)
old_listener = "$('csvBtn').addEventListener('click',function(){var rows=renderQuality(),name='anon_output_'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'.csv';downloadRows(rows,name);addExportHistory(rows,name)});"
new_listener = "$('csvBtn').addEventListener('click',function(){downloadResearchDataset('sessions').catch(function(e){alert(String(e.message||e))})});$('turnsCsvBtn').addEventListener('click',function(){downloadResearchDataset('turns').catch(function(e){alert(String(e.message||e))})});$('expressionsCsvBtn').addEventListener('click',function(){downloadResearchDataset('expressions').catch(function(e){alert(String(e.message||e))})});$('eventsCsvBtn').addEventListener('click',function(){downloadResearchDataset('system_events').catch(function(e){alert(String(e.message||e))})});"
replace_once('src/server/managementPage.ts', old_listener, new_listener)

# QA contracts.
replace_once('scripts/qa-management-page.ts',
"for (const marker of ['teacherClass','teacherStart','teacherEnd','teacherMetric','teacherWeekly','teacherMonthly','teacherChart','listClass','listStart','listEnd','studentSearch','showUnused','summaryStart','summaryEnd','sumDurationChart','sumWordsChart','newCode','newClass','reissueModal','reissueConfirm','researchStart','researchEnd','researchDashboardClass','researchMetric','researchWeekly','researchMonthly','researchChart','researchClass','researchGrade','researchCompleteOnly','researchSearch','r4TurnChart','r4WordChart','r4ReflectionChart','r5Head','r5Reflection','r6Start','r6End','r6Class','r6Research','qNormal','qMissing','qDuplicate','qReview']) {",
"for (const marker of ['teacherClass','teacherStart','teacherEnd','teacherMetric','teacherWeekly','teacherMonthly','teacherChart','listClass','listStart','listEnd','studentSearch','showUnused','summaryStart','summaryEnd','sumDurationChart','sumWordsChart','newCode','newClass','reissueModal','reissueConfirm','researchStart','researchEnd','researchDashboardClass','researchMetric','researchWeekly','researchMonthly','researchChart','researchClass','researchGrade','researchCompleteOnly','researchSearch','r4TurnChart','r4WordChart','r4ReflectionChart','r5Head','r5Reflection','r6Start','r6End','r6Class','r6Research','qNormal','qMissing','qDuplicate','qReview','turnsCsvBtn','expressionsCsvBtn','eventsCsvBtn']) {")
replace_once('scripts/qa-management-page.ts',
"assert.ok(serverSource.includes('studentMessageは必ず日本語で書いてください'), 'Japanese feedback prompt requirement missing');",
"assert.ok(serverSource.includes('studentMessageは必ず日本語で書いてください'), 'Japanese feedback prompt requirement missing');\nassert.ok(serverSource.includes('buildResearchDataSets'), 'Integrated research dataset builder must be used');\nassert.ok(serverSource.includes(\"dataset==='string'\"), 'Research CSV dataset selector must exist');")

# Add research QA to the standard QA gate.
import json
pkg_path = Path('package.json')
pkg = json.loads(pkg_path.read_text())
pkg['scripts']['qa:research'] = 'tsx scripts/qa-research-integrated.ts'
pkg['scripts']['qa'] = pkg['scripts']['qa'].replace(' && npm run lint', ' && npm run qa:research && npm run lint')
pkg_path.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + '\n')

print('research v3 patch applied')
