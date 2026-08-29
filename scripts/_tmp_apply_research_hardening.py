from pathlib import Path


def replace(path, old, new, count=1):
    p = Path(path)
    text = p.read_text()
    found = text.count(old)
    if found < count:
        raise SystemExit(f'{path}: expected at least {count} occurrence(s), found {found}: {old[:100]!r}')
    text = text.replace(old, new, count)
    p.write_text(text)

# 1) Larger but still bounded JSON payloads; add class update + atomic research ID plumbing + snapshot ZIP.
replace('server.ts', "import { createStudentCode, getAllSessionsForManagement, getTeacherSessionsForManagement, getStudentHistory, getStudentRecordsForManagement, reissueStudentCode, setStudentActive, persistenceConfigured, resolveStudentByCode, saveCanonicalSession } from './src/server/persistence';", "import { createStudentCode, getAllSessionsForManagement, getTeacherSessionsForManagement, getStudentHistory, getStudentRecordsForManagement, reissueStudentCode, setStudentActive, updateStudentClass, persistenceConfigured, resolveStudentByCode, saveCanonicalSession } from './src/server/persistence';")
replace('server.ts', "app.use(express.json({ limit: '10kb' }));", "app.use(express.json({ limit: '512kb' }));")
replace('server.ts', "    if(action==='create'){const code=normalizeLearningCode(req.body?.learningCode);if(!isValidLearningCode(req.body?.learningCode))return res.status(400).json({success:false,error:'INVALID_LEARNING_CODE'});const created=await createStudentCode(code,undefined,undefined,req.body?.classId);return res.json({success:true,studentId:created.studentId,teacherStudentId:created.teacherStudentId,classId:created.classId});}\n    if(action==='reissue'){const studentId=typeof req.body?.studentId==='string'?req.body.studentId:'';if(!studentId||!isValidLearningCode(req.body?.learningCode))return res.status(400).json({success:false,error:'INVALID_REISSUE_REQUEST'});const created=await reissueStudentCode(studentId,normalizeLearningCode(req.body.learningCode));return res.json({success:true,studentId:created.studentId,teacherStudentId:created.teacherStudentId,classId:created.classId});}\n    if(action==='set-active'){const studentId=typeof req.body?.studentId==='string'?req.body.studentId:'';if(!studentId||typeof req.body?.active!=='boolean')return res.status(400).json({success:false,error:'INVALID_ACTIVE_REQUEST'});await setStudentActive(studentId,req.body.active);return res.json({success:true});}", "    if(action==='create'){const code=normalizeLearningCode(req.body?.learningCode);const classId=typeof req.body?.classId==='string'?req.body.classId.trim():'';if(!isValidLearningCode(req.body?.learningCode))return res.status(400).json({success:false,error:'INVALID_LEARNING_CODE'});if(!/^(?:5-[123]|6-[123]|テスト|予備)$/.test(classId))return res.status(400).json({success:false,error:'CLASS_ID_REQUIRED'});const created=await createStudentCode(code,undefined,undefined,classId);return res.json({success:true,studentId:created.studentId,teacherStudentId:created.teacherStudentId,classId:created.classId});}\n    if(action==='reissue'){const studentId=typeof req.body?.studentId==='string'?req.body.studentId:'';if(!studentId||!isValidLearningCode(req.body?.learningCode))return res.status(400).json({success:false,error:'INVALID_REISSUE_REQUEST'});const created=await reissueStudentCode(studentId,normalizeLearningCode(req.body.learningCode));return res.json({success:true,studentId:created.studentId,teacherStudentId:created.teacherStudentId,classId:created.classId});}\n    if(action==='update-class'){const studentId=typeof req.body?.studentId==='string'?req.body.studentId:'';const classId=typeof req.body?.classId==='string'?req.body.classId.trim():'';if(!studentId||!/^(?:5-[123]|6-[123]|テスト|予備)$/.test(classId))return res.status(400).json({success:false,error:'INVALID_CLASS_UPDATE'});await updateStudentClass(studentId,classId);return res.json({success:true,classId});}\n    if(action==='set-active'){const studentId=typeof req.body?.studentId==='string'?req.body.studentId:'';if(!studentId||typeof req.body?.active!=='boolean')return res.status(400).json({success:false,error:'INVALID_ACTIVE_REQUEST'});await setStudentActive(studentId,req.body.active);return res.json({success:true});}")

zip_helpers = r'''
const RESEARCH_DEFAULT_HEADERS:Record<ResearchDatasetName,string[]>={
  sessions:['research_id','class_id','session_id','local_date','local_start_time','usage_context_inferred'],
  turns:['research_id','class_id','session_id','turn_sequence','speaker','english_text_anonymized'],
  expressions:['research_id','class_id','session_id','turn_sequence','speaker','expression'],
  system_events:['research_id','class_id','session_id','event_sequence','local_timestamp','event_type'],
};
function researchCsvString(rows:Record<string,unknown>[],dataset:ResearchDatasetName):string{
  const headers=rows.length?Object.keys(rows[0]):RESEARCH_DEFAULT_HEADERS[dataset];
  return '\uFEFF'+[headers.map(csvCell).join(','),...rows.map(row=>headers.map(key=>csvCell(row[key])).join(','))].join('\n');
}
function crc32(buffer:Buffer):number{
  let crc=0xffffffff;
  for(const byte of buffer){crc^=byte;for(let bit=0;bit<8;bit+=1)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
function buildStoredZip(files:Array<{name:string;content:string}>):Buffer{
  const localParts:Buffer[]=[];const centralParts:Buffer[]=[];let offset=0;
  for(const file of files){
    const name=Buffer.from(file.name,'utf8');const data=Buffer.from(file.content,'utf8');const crc=crc32(data);
    const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0,6);local.writeUInt16LE(0,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(name.length,26);local.writeUInt16LE(0,28);
    localParts.push(local,name,data);
    const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0,8);central.writeUInt16LE(0,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(name.length,28);central.writeUInt16LE(0,30);central.writeUInt16LE(0,32);central.writeUInt16LE(0,34);central.writeUInt16LE(0,36);central.writeUInt32LE(0,38);central.writeUInt32LE(offset,42);
    centralParts.push(central,name);offset+=local.length+name.length+data.length;
  }
  const centralSize=centralParts.reduce((sum,part)=>sum+part.length,0);const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(centralSize,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...localParts,...centralParts,end]);
}
app.get('/api/management/research.bundle.zip',requireManagementRole(['researcher']),async(req,res)=>{
  try{
    const raw=buildResearchDataSets(await getAllSessionsForManagement());
    const start=typeof req.query?.start==='string'?req.query.start:'';const end=typeof req.query?.end==='string'?req.query.end:'';const classId=typeof req.query?.classId==='string'?req.query.classId:'';const researchId=typeof req.query?.researchId==='string'?req.query.researchId:'';const completeOnly=req.query?.completeOnly==='1';
    const sessions=raw.sessions.filter(row=>{const date=String(row.local_date||'');return(!start||date>=start)&&(!end||date<=end)&&(!classId||classId==='all'||String(row.class_id||'')===classId)&&(!researchId||researchId==='all'||String(row.research_id||'')===researchId)&&(!completeOnly||String(row.data_quality_flag||'')==='complete');});
    const allowed=new Set(sessions.map(row=>String(row.session_id||'')));const datasets={sessions,turns:raw.turns.filter(row=>allowed.has(String(row.session_id||''))),expressions:raw.expressions.filter(row=>allowed.has(String(row.session_id||''))),system_events:raw.system_events.filter(row=>allowed.has(String(row.session_id||'')))};
    const exportedAt=new Date().toISOString();const manifest={export_id:`export_${Date.now()}`,exported_at:exportedAt,schema_version:3,classification_rule_version:String(sessions[0]?.classification_rule_version||'time-cluster-v1'),filters:{start,end,class_id:classId||'all',research_id:researchId||'all',complete_only:completeOnly},row_counts:{sessions:datasets.sessions.length,turns:datasets.turns.length,expressions:datasets.expressions.length,system_events:datasets.system_events.length}};
    const zip=buildStoredZip([{name:'sessions.csv',content:researchCsvString(datasets.sessions,'sessions')},{name:'turns.csv',content:researchCsvString(datasets.turns,'turns')},{name:'expressions.csv',content:researchCsvString(datasets.expressions,'expressions')},{name:'system_events.csv',content:researchCsvString(datasets.system_events,'system_events')},{name:'manifest.json',content:JSON.stringify(manifest,null,2)}]);
    res.setHeader('Content-Type','application/zip');res.setHeader('Content-Disposition',`attachment; filename="research-bundle-${exportedAt.slice(0,10).replace(/-/g,'')}.zip"`);res.setHeader('Cache-Control','no-store');return res.send(zip);
  }catch(error:any){console.error('Research bundle export failed',{message:error?.message});return res.status(503).json({success:false,error:'RESEARCH_BUNDLE_UNAVAILABLE'});}
});
'''
replace('server.ts', "function csvCell(value:unknown):string{const text=String(value??'');return `\"${text.replace(/\"/g,'\"\"')}\"`;}", "function csvCell(value:unknown):string{const text=String(value??'');return `\"${text.replace(/\"/g,'\"\"')}\"`;}\n" + zip_helpers)
replace('server.ts', "    const defaultHeaders:Record<ResearchDatasetName,string[]>={\n      sessions:['research_id','class_id','session_id','local_date','local_start_time','usage_context_inferred'],\n      turns:['research_id','class_id','session_id','turn_sequence','speaker','english_text_anonymized'],\n      expressions:['research_id','class_id','session_id','turn_sequence','speaker','expression'],\n      system_events:['research_id','class_id','session_id','event_sequence','local_timestamp','event_type'],\n    };\n    const headers=rows.length?Object.keys(rows[0]):defaultHeaders[dataset];\n    const csv=[headers.map(csvCell).join(','),...rows.map(row=>headers.map(key=>csvCell(row[key])).join(','))].join('\\n');", "    const csv=researchCsvString(rows,dataset);")
replace('server.ts', "    return res.send('\\uFEFF'+csv);", "    return res.send(csv);")

# 2) Firestore full pagination + atomic create-if-absent.
p='src/server/firestore.ts'; text=Path(p).read_text()
old="""export async function listCollection(collection: string, pageSize = 200): Promise<Record<string, any>[]> {\n  const response = await firestoreFetch(`/${encodeURIComponent(collection)}?pageSize=${Math.max(1, Math.min(1000, pageSize))}`);\n  if (!response.ok) throw new Error(`FIRESTORE_LIST_${response.status}:${(await response.text()).slice(0, 500)}`);\n  const data = await response.json() as { documents?: Array<{ fields?: Record<string, any>; name?: string }> };\n  return (data.documents || []).map((doc) => ({ ...fromFirestoreFields(doc.fields || {}), _name: doc.name }));\n}\n"""
new="""export async function listCollection(collection: string, pageSize = 200): Promise<Record<string, any>[]> {\n  const safePageSize = Math.max(1, Math.min(1000, pageSize));\n  const rows: Record<string, any>[] = [];\n  let pageToken = '';\n  do {\n    const suffix = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';\n    const response = await firestoreFetch(`/${encodeURIComponent(collection)}?pageSize=${safePageSize}${suffix}`);\n    if (!response.ok) throw new Error(`FIRESTORE_LIST_${response.status}:${(await response.text()).slice(0, 500)}`);\n    const data = await response.json() as { documents?: Array<{ fields?: Record<string, any>; name?: string }>; nextPageToken?: string };\n    rows.push(...(data.documents || []).map((doc) => ({ ...fromFirestoreFields(doc.fields || {}), _name: doc.name })));\n    pageToken = typeof data.nextPageToken === 'string' ? data.nextPageToken : '';\n  } while (pageToken);\n  return rows;\n}\n\nexport async function createDocumentIfAbsent(collection: string, id: string, data: Record<string, unknown>): Promise<boolean> {\n  const fields = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined).map(([key, value]) => [key, toFirestoreValue(value)]));\n  const response = await firestoreFetch(`/${encodeURIComponent(collection)}?documentId=${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify({ fields }) });\n  if (response.status === 409) return false;\n  if (!response.ok) throw new Error(`FIRESTORE_CREATE_${response.status}:${(await response.text()).slice(0, 500)}`);\n  return true;\n}\n"""
if old not in text: raise SystemExit('firestore listCollection block not found')
Path(p).write_text(text.replace(old,new,1))

# 3) Persistence: atomically reserve research IDs, support class progression without changing identity.
replace('src/server/persistence.ts', "import { getDocument, listCollection, queryCollection, setDocument } from './firestore';", "import { createDocumentIfAbsent, getDocument, listCollection, queryCollection, setDocument } from './firestore';")
replace('src/server/persistence.ts', "const SESSION_COLLECTION = 'sessions';\nconst TEACHER_ID_ALPHABET", "const SESSION_COLLECTION = 'sessions';\nconst RESEARCH_ID_COLLECTION = 'research_ids';\nconst RESEARCH_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';\nconst TEACHER_ID_ALPHABET")
insert_after="""function randomTeacherStudentId(): string {\n  let out = '';\n  for (let i = 0; i < 4; i += 1) out += TEACHER_ID_ALPHABET[crypto.randomInt(0, TEACHER_ID_ALPHABET.length)];\n  return out;\n}\n"""
research_fn="""function randomResearchId(): string {\n  let out = 'R-';\n  for (let i = 0; i < 12; i += 1) out += RESEARCH_ID_ALPHABET[crypto.randomInt(0, RESEARCH_ID_ALPHABET.length)];\n  return out;\n}\nasync function generateUniqueResearchId(studentId: string): Promise<string> {\n  for (let attempt = 0; attempt < 100; attempt += 1) {\n    const candidate = randomResearchId();\n    if (await createDocumentIfAbsent(RESEARCH_ID_COLLECTION, candidate, { studentId, createdAt: new Date().toISOString() })) return candidate;\n  }\n  throw new Error('RESEARCH_ID_EXHAUSTED');\n}\n"""
replace('src/server/persistence.ts', insert_after, insert_after+research_fn)
replace('src/server/persistence.ts', "  const sid = studentId || crypto.randomUUID();\n  const rid = researchId || `R${crypto.randomInt(100000, 999999)}`;", "  const sid = studentId || crypto.randomUUID();\n  const rid = researchId || await generateUniqueResearchId(sid);")
class_fn="""\nexport async function updateStudentClass(studentId: string, classId: string): Promise<void> {\n  const cid = normalizeClassId(classId);\n  if (!/^(?:5-[123]|6-[123]|テスト|予備)$/.test(cid)) throw new Error('INVALID_CLASS_ID');\n  const records = (await listCollection(STUDENT_COLLECTION, 1000)).filter((row) => row.studentId === studentId);\n  if (!records.length) throw new Error('STUDENT_NOT_FOUND');\n  const now = new Date().toISOString();\n  for (const record of records) {\n    const id = documentId(record);\n    if (!id) continue;\n    await setDocument(STUDENT_COLLECTION, id, { ...withoutInternal(record), classId: cid, updatedAt: now });\n  }\n}\n"""
replace('src/server/persistence.ts', "export async function reissueStudentCode(studentId: string, newCode: string): Promise<{ studentId: string; researchId: string; classId: string; teacherStudentId: string }> {", class_fn+"\nexport async function reissueStudentCode(studentId: string, newCode: string): Promise<{ studentId: string; researchId: string; classId: string; teacherStudentId: string }> {")

# 4) Auth permits the researcher-only one-snapshot ZIP.
replace('src/server/auth.ts', "  if (path === '/api/management/research.csv') return true;", "  if (path === '/api/management/research.csv') return true;\n  if (path === '/api/management/research.bundle.zip') return true;")

# 5) Research export: unassigned class is unknown; recompute sequence numbers from timestamps.
p='src/server/researchExport.ts'; text=Path(p).read_text()
text=text.replace("      } else if (same5 >= CLASS_CLUSTER_5_MIN) {", "      } else if (!item.classId) {\n        usageContext = 'unknown';\n        confidence = 'low';\n      } else if (same5 >= CLASS_CLUSTER_5_MIN) {",1)
marker="""function commonFields(session: Record<string, any>, meta: ContextMeta) {"""
seq_fn="""function sessionSequenceNumbers(sessions: Record<string, any>[]): Map<string, { lifetime: number; daily: number }> {\n  const byResearch = new Map<string, Record<string, any>[]>();\n  for (const session of sessions) {\n    const rid = String(session.researchId || '');\n    if (!rid) continue;\n    const list = byResearch.get(rid) || []; list.push(session); byResearch.set(rid, list);\n  }\n  const result = new Map<string, { lifetime: number; daily: number }>();\n  for (const list of byResearch.values()) {\n    list.sort((a, b) => (timestampMs(a.startedAt) - timestampMs(b.startedAt)) || String(a.sessionId || '').localeCompare(String(b.sessionId || '')));\n    const dailyCounts = new Map<string, number>();\n    list.forEach((session, index) => {\n      const date = tokyoParts(session.startedAt || session.endedAt).date;\n      const daily = (dailyCounts.get(date) || 0) + 1; dailyCounts.set(date, daily);\n      result.set(String(session.sessionId || ''), { lifetime: index + 1, daily });\n    });\n  }\n  return result;\n}\n\n"""
if marker not in text: raise SystemExit('researchExport marker not found')
text=text.replace(marker,seq_fn+marker,1)
text=text.replace("  const previousDays = previousSessionDays(sessions);", "  const previousDays = previousSessionDays(sessions);\n  const sequenceNumbers = sessionSequenceNumbers(sessions);",1)
text=text.replace("    const dataQuality = !sessionId || !session.researchId || history.length === 0\n      ? 'missing_core'\n      : !hasReflection ? 'missing_reflection' : 'complete';", "    const dataQuality = !sessionId || !session.researchId || history.length === 0 || childMessages.length === 0 || !session.endedAt\n      ? 'missing_core'\n      : !hasReflection ? 'missing_reflection' : 'complete';",1)
text=text.replace("      lifetime_session_number: session.lifetimeSessionNumber || 0,\n      daily_session_number: session.dailySessionNumber || 0,", "      lifetime_session_number: sequenceNumbers.get(sessionId)?.lifetime || 0,\n      daily_session_number: sequenceNumbers.get(sessionId)?.daily || 0,\n      source_lifetime_session_number: session.lifetimeSessionNumber || 0,\n      source_daily_session_number: session.dailySessionNumber || 0,",1)
Path(p).write_text(text)

# 6) Stronger research-only name anonymization without destroying common self-description language.
p='src/utils/privacy.ts'; text=Path(p).read_text()
needle="""  masked = masked.replace(/(私の名前は|ぼくの名前は|僕の名前は|わたしの名前は)\\s*[^。！？,.]{1,40}?(です|だよ|。|$)/g, '$1 [name omitted] $2');\n\n  // Exact age is not needed because grade/class are retained as research variables.\n"""
insert="""  masked = masked.replace(/(私の名前は|ぼくの名前は|僕の名前は|わたしの名前は)\\s*[^。！？,.]{1,40}?(です|だよ|。|$)/g, '$1 [name omitted] $2');\n\n  // Speech recognition may produce a bare self-introduction (\"I'm Taro.\") even\n  // when the learner did not say \"My name is\". Mask likely single-token names,\n  // while preserving common grade-appropriate descriptions such as \"I'm good.\".\n  const commonSelfWords = new Set(['good','fine','happy','sad','tired','ready','hungry','thirsty','japanese','american','canadian','british','australian','eleven','twelve','ten','fifth','sixth','student']);\n  masked = masked.replace(/\\b(i(?:'|’)m|i am)\\s+([a-z][a-z'’-]{1,24})(?=[,.!?]|$)/gi, (full, prefix, value) => commonSelfWords.has(String(value).toLowerCase()) ? full : `${prefix} [name omitted]`);\n  const commonJapaneseSelfWords = new Set(['元気','げんき','日本人','にほんじん','小学生','しょうがくせい','五年生','六年生','5年生','6年生']);\n  masked = masked.replace(/(私は|わたしは|僕は|ぼくは)\\s*([ぁ-んァ-ヶ一-龯々ー]{1,12})\\s*(です|だよ)(?=[。！？,.]|$)/g, (full, prefix, value, ending) => commonJapaneseSelfWords.has(String(value)) ? full : `${prefix} [name omitted] ${ending}`);\n\n  // Exact age is not needed because grade/class are retained as research variables.\n"""
if needle not in text: raise SystemExit('privacy insertion point not found')
Path(p).write_text(text.replace(needle,insert,1))

# 7) Client-side queued checkpoints: session start, each completed AI turn, final dialogue, reflection.
p='src/App.tsx'; text=Path(p).read_text()
text=text.replace("  const initialSessionSaveRef = useRef<Promise<void> | null>(null);", "  const initialSessionSaveRef = useRef<Promise<void> | null>(null);\n  const sessionSaveQueueRef = useRef<Promise<void>>(Promise.resolve());",1)
needle="""  const handleStartDialogue = (newProfile: StudentProfile, code: string) => {"""
helper="""  const enqueueSessionSnapshot = useCallback((payload: Record<string, unknown>): Promise<void> => {\n    const task = sessionSaveQueueRef.current.catch(() => undefined).then(async () => {\n      const response = await fetch(apiUrl('/api/sessions'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });\n      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data?.error || 'SESSION_CHECKPOINT_FAILED'); }\n    });\n    sessionSaveQueueRef.current = task.catch((error) => { console.warn('Research session checkpoint unavailable:', error); });\n    return task;\n  }, []);\n\n"""
if needle not in text: raise SystemExit('App start marker not found')
text=text.replace(needle,helper+needle,1)
text=text.replace("    setLearningCode(code); setSessionId(newSessionId()); sessionStartedAtRef.current = startedAt; sessionEndedAtRef.current = 0;\n    initialSessionSaveRef.current = null;", "    const nextSessionId = newSessionId();\n    setLearningCode(code); setSessionId(nextSessionId); sessionStartedAtRef.current = startedAt; sessionEndedAtRef.current = 0;\n    initialSessionSaveRef.current = null; sessionSaveQueueRef.current = Promise.resolve();",1)
needle="""    setMessages(initialHistory); messagesRef.current = initialHistory; setPhase('dialogue');\n    setTimeout(() => {"""
insert="""    setMessages(initialHistory); messagesRef.current = initialHistory; setPhase('dialogue');\n    if (learningDataEnabled && code && nextSessionId) {\n      void enqueueSessionSnapshot({ sessionId: nextSessionId, learningCode: code, aiStudentId: newProfile.selectedAiStudentId, topic: newProfile.selectedTopic, targetDurationMinutes: newProfile.selectedDurationMinutes, startedAt, endedAt: startedAt, history: initialHistory, encounteredVocab: [], systemEvents: systemEventsRef.current });\n    }\n    setTimeout(() => {"""
if needle not in text: raise SystemExit('App initial history marker not found')
text=text.replace(needle,insert,1)
needle="""        const updatedHistory = [...translatedHistory, aiMsg]; setMessages(updatedHistory); messagesRef.current=updatedHistory;\n        setMood((aiMood as CharacterMood) || 'speaking'); playAiVoice(reply);"""
insert="""        const updatedHistory = [...translatedHistory, aiMsg]; setMessages(updatedHistory); messagesRef.current=updatedHistory;\n        if (learningDataEnabled && learningCode && sessionId) {\n          void enqueueSessionSnapshot({ sessionId, learningCode, aiStudentId: currentProf.selectedAiStudentId, topic: currentProf.selectedTopic, targetDurationMinutes: currentProf.selectedDurationMinutes, startedAt: sessionStartedAtRef.current, endedAt: Date.now(), history: updatedHistory, encounteredVocab: encounteredVocabRef.current, systemEvents: systemEventsRef.current });\n        }\n        setMood((aiMood as CharacterMood) || 'speaking'); playAiVoice(reply);"""
if needle not in text: raise SystemExit('App updatedHistory marker not found')
text=text.replace(needle,insert,1)
old="""      initialSessionSaveRef.current = fetch(apiUrl('/api/sessions'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshotPayload) })\n        .then(async (response) => { if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data?.error || 'SNAPSHOT_SAVE_FAILED'); } })\n        .catch((error) => { console.warn('Initial research session snapshot unavailable:', error); });"""
new="""      initialSessionSaveRef.current = enqueueSessionSnapshot(snapshotPayload)\n        .catch((error) => { console.warn('Initial research session snapshot unavailable:', error); });"""
if old not in text: raise SystemExit('App final initial save block not found')
text=text.replace(old,new,1)
old="""        const response = await fetch(apiUrl('/api/sessions'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({\n          sessionId, learningCode, aiStudentId: profileRef.current.selectedAiStudentId, topic: profileRef.current.selectedTopic,\n          targetDurationMinutes: profileRef.current.selectedDurationMinutes, startedAt: sessionStartedAtRef.current,\n          endedAt: sessionEndedAtRef.current || Date.now(), history: messagesRef.current, encounteredVocab: encounteredVocabRef.current, reflection: answers, systemEvents: systemEventsRef.current,\n        }) });\n        const data = await response.json();\n        if (!response.ok || !data?.success) throw new Error(data?.error || 'SAVE_FAILED');"""
new="""        await enqueueSessionSnapshot({\n          sessionId, learningCode, aiStudentId: profileRef.current.selectedAiStudentId, topic: profileRef.current.selectedTopic,\n          targetDurationMinutes: profileRef.current.selectedDurationMinutes, startedAt: sessionStartedAtRef.current,\n          endedAt: sessionEndedAtRef.current || Date.now(), history: messagesRef.current, encounteredVocab: encounteredVocabRef.current, reflection: answers, systemEvents: systemEventsRef.current,\n        });"""
if old not in text: raise SystemExit('App reflection save block not found')
text=text.replace(old,new,1)
text=text.replace("setLearningCode('');setSessionId('');initialSessionSaveRef.current=null;", "setLearningCode('');setSessionId('');initialSessionSaveRef.current=null;sessionSaveQueueRef.current=Promise.resolve();",1)
Path(p).write_text(text)

# 8) Management UI: complete-case correctness, class progression, one-snapshot ZIP download.
p='src/server/managementPage.ts'; text=Path(p).read_text()
text=text.replace("function researchMissingRow(r){return !r.research_id||!r.session_id||!r.local_date||r.total_turns===''||r.total_child_words===''||r.actual_duration_seconds==='' }", "function researchMissingRow(r){return String(r.data_quality_flag||'')!=='complete'||!r.research_id||!r.session_id||!r.local_date||r.total_turns===''||r.total_child_words===''||r.actual_duration_seconds===''}") if "function researchMissingRow(r){return !r.research_id||!r.session_id||!r.local_date||r.total_turns===''||r.total_child_words===''||r.actual_duration_seconds==='' }" in text else text
# exact source has no space before }
text=text.replace("function researchMissingRow(r){return !r.research_id||!r.session_id||!r.local_date||r.total_turns===''||r.total_child_words===''||r.actual_duration_seconds===''}", "function researchMissingRow(r){return String(r.data_quality_flag||'')!=='complete'||!r.research_id||!r.session_id||!r.local_date||r.total_turns===''||r.total_child_words===''||r.actual_duration_seconds===''}",1)
text=text.replace("<button id=\"eventsCsvBtn\" class=\"secondary full\">system_events.csv を作成</button>", "<button id=\"eventsCsvBtn\" class=\"secondary full\">system_events.csv を作成</button><button id=\"bundleCsvBtn\" class=\"primary full\">4CSV＋manifestを一括ZIP出力</button>",1)
# class column becomes editable; options are generated from the canonical class list.
old="""function renderCodes(){var lastMap={};teacherSessions.forEach(function(s){var d=dateOf(s);if(!lastMap[s.studentId]||d>lastMap[s.studentId])lastMap[s.studentId]=d});$('codeRows').innerHTML=studentRecords.map(function(r){return '<tr><td>'+esc(r.teacherStudentId)+'</td><td>'+esc(r.classId||'未設定')+'</td><td><span class=\"status '+(r.active?'':'off')+'\">'+(r.active?'利用中':'利用停止')+'</span></td><td>'+esc(String(r.createdAt||'').slice(0,10)||'—')+'</td><td>'+esc(lastMap[r.studentId]||'—')+'</td><td><button class=\"secondary reissue\" data-id=\"'+esc(r.studentId)+'\">再発行</button> <button class=\"'+(r.active?'danger':'secondary')+' active-toggle\" data-id=\"'+esc(r.studentId)+'\" data-active=\"'+(r.active?'0':'1')+'\">'+(r.active?'利用停止':'再開')+'</button></td></tr>'}).join('');document.querySelectorAll('.reissue').forEach(function(b){b.addEventListener('click',function(){window.pendingReissue=b.dataset.id;$('reissueCode').value='';$('reissueModal').classList.add('show')})});document.querySelectorAll('.active-toggle').forEach(function(b){b.addEventListener('click',async function(){try{await mutateCode({action:'set-active',studentId:b.dataset.id,active:b.dataset.active==='1'});await loadTeacher()}catch(e){alert(String(e.message||e))}})})}"""
new="""function renderCodes(){var lastMap={};teacherSessions.forEach(function(s){var d=dateOf(s);if(!lastMap[s.studentId]||d>lastMap[s.studentId])lastMap[s.studentId]=d});$('codeRows').innerHTML=studentRecords.map(function(r){var opts=['<option value=\"\">学級未設定</option>'].concat(SCHOOL_CLASSES.map(function(c){return '<option value=\"'+esc(c)+'\" '+(canonClass(r.classId)===c?'selected':'')+'>'+esc(c)+'</option>'})).join('');return '<tr><td>'+esc(r.teacherStudentId)+'</td><td><select class=\"class-update\" data-id=\"'+esc(r.studentId)+'\">'+opts+'</select></td><td><span class=\"status '+(r.active?'':'off')+'\">'+(r.active?'利用中':'利用停止')+'</span></td><td>'+esc(String(r.createdAt||'').slice(0,10)||'—')+'</td><td>'+esc(lastMap[r.studentId]||'—')+'</td><td><button class=\"secondary reissue\" data-id=\"'+esc(r.studentId)+'\">再発行</button> <button class=\"'+(r.active?'danger':'secondary')+' active-toggle\" data-id=\"'+esc(r.studentId)+'\" data-active=\"'+(r.active?'0':'1')+'\">'+(r.active?'利用停止':'再開')+'</button></td></tr>'}).join('');document.querySelectorAll('.class-update').forEach(function(s){s.addEventListener('change',async function(){if(!s.value){alert('学級を選択してください。');await loadTeacher();return}try{await mutateCode({action:'update-class',studentId:s.dataset.id,classId:s.value});await loadTeacher()}catch(e){alert(String(e.message||e));await loadTeacher()}})});document.querySelectorAll('.reissue').forEach(function(b){b.addEventListener('click',function(){window.pendingReissue=b.dataset.id;$('reissueCode').value='';$('reissueModal').classList.add('show')})});document.querySelectorAll('.active-toggle').forEach(function(b){b.addEventListener('click',async function(){try{await mutateCode({action:'set-active',studentId:b.dataset.id,active:b.dataset.active==='1'});await loadTeacher()}catch(e){alert(String(e.message||e))}})})}"""
if old not in text: raise SystemExit('management renderCodes block not found')
text=text.replace(old,new,1)
text=text.replace("$('issueCodeBtn').addEventListener('click',async function(){var code=$('newCode').value.trim().toUpperCase();if(!/^[A-Z0-9]{4}$/.test(code)){setText('codeMessage','英数字4文字で入力してください。');return}try{var d=await mutateCode({action:'create',learningCode:code,classId:$('newClass').value});", "$('issueCodeBtn').addEventListener('click',async function(){var code=$('newCode').value.trim().toUpperCase(),cls=$('newClass').value;if(!/^[A-Z0-9]{4}$/.test(code)){setText('codeMessage','英数字4文字で入力してください。');return}if(!cls){setText('codeMessage','学級を選択してください。');return}try{var d=await mutateCode({action:'create',learningCode:code,classId:cls});",1)
# Add bundle downloader after individual dataset function.
needle="""async function loadTeacher(){"""
bundle_fn="""async function downloadResearchBundle(){var q=new URLSearchParams();if($('r6Start').value)q.set('start',$('r6Start').value);if($('r6End').value)q.set('end',$('r6End').value);if($('r6Class').value&&$('r6Class').value!=='all')q.set('classId',$('r6Class').value);if($('r6Research').value&&$('r6Research').value!=='all')q.set('researchId',$('r6Research').value);if($('r6CompleteOnly').checked)q.set('completeOnly','1');var r=await fetch('/api/management/research.bundle.zip?'+q.toString());if(!r.ok)throw new Error('RESEARCH_BUNDLE_UNAVAILABLE');var blob=await r.blob(),a=document.createElement('a'),name='research_bundle_'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'.zip';a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href)},500);addExportHistory(renderQuality(),name)}\n"""
if needle not in text: raise SystemExit('management loadTeacher marker missing')
text=text.replace(needle,bundle_fn+needle,1)
text=text.replace("$('eventsCsvBtn').addEventListener('click',function(){downloadResearchDataset('system_events').catch(function(e){alert(String(e.message||e))})});", "$('eventsCsvBtn').addEventListener('click',function(){downloadResearchDataset('system_events').catch(function(e){alert(String(e.message||e))})});$('bundleCsvBtn').addEventListener('click',function(){downloadResearchBundle().catch(function(e){alert(String(e.message||e))})});",1)
Path(p).write_text(text)

# 9) README now reflects actual Firestore persistence instead of the old non-persistent design.
p='README.md'; text=Path(p).read_text()
old="""   - **会話ログの非永続化**: アプリケーションコード上、サーバーDB、Cookie、localStorage、sessionStorage、IndexedDB等へ児童の対話履歴を永続保存する処理は確認されていません。なお、AIサービスへのリクエスト処理中には会話データが一時的にメモリ上で扱われます。"""
new="""   - **学習履歴のサーバー保存**: 有効な学習者用コードで利用した対話は、研究・学習履歴機能のためCloud Run経由でFirestoreへ保存します。学習者用コードそのものはHMAC化して照合し、研究者Exportではresearch_idを使用して氏名・学習者用コード等を出力しません。端末のlocalStorage等を学習履歴の正本には使用しません。"""
if old not in text: raise SystemExit('README old persistence paragraph missing')
Path(p).write_text(text.replace(old,new,1))

# 10) Permanent QA for hardening contracts and longitudinal correctness.
p='scripts/qa-research-integrated.ts'; text=Path(p).read_text()
append=r'''

// Research-data hardening regression checks.
const unordered = buildResearchDataSets([
  {...clustered[0], sessionId:'seq_b', researchId:'RSEQ', lifetimeSessionNumber:99, dailySessionNumber:99, startedAt:'2026-09-02T01:00:00.000Z', endedAt:'2026-09-02T01:03:00.000Z'},
  {...clustered[0], sessionId:'seq_a', researchId:'RSEQ', lifetimeSessionNumber:42, dailySessionNumber:42, startedAt:'2026-09-01T01:00:00.000Z', endedAt:'2026-09-01T01:03:00.000Z'},
]);
assert.equal(unordered.sessions.find((r)=>r.session_id==='seq_a')?.lifetime_session_number,1,'research lifetime sequence must be recalculated from timestamps');
assert.equal(unordered.sessions.find((r)=>r.session_id==='seq_b')?.lifetime_session_number,2,'research lifetime sequence must not trust stored count+1 values');
const unassigned = buildResearchDataSets([{...clustered[0],sessionId:'unassigned_class',classId:''}]).sessions[0];
assert.equal(unassigned.usage_context_inferred,'unknown','school-hours sessions without class_id must not be classified as out-of-class');
assert.equal(maskTextForResearchExport("I'm Taro."),"I'm [name omitted].",'bare self-introduction names must be masked');
assert.equal(maskTextForResearchExport("I'm good."),"I'm good.",'common self-description must remain analyzable');
const serverHardening=fs.readFileSync('server.ts','utf8');
const firestoreHardening=fs.readFileSync('src/server/firestore.ts','utf8');
const persistenceHardening=fs.readFileSync('src/server/persistence.ts','utf8');
const authHardening=fs.readFileSync('src/server/auth.ts','utf8');
const managementHardening=fs.readFileSync('src/server/managementPage.ts','utf8');
assert.ok(serverHardening.includes("express.json({ limit: '512kb' })"),'session payload limit must support complete five-minute histories');
assert.ok(firestoreHardening.includes('nextPageToken'),'Firestore management reads must paginate beyond 1000 documents');
assert.ok(firestoreHardening.includes('createDocumentIfAbsent'),'atomic create-if-absent helper must exist');
assert.ok(persistenceHardening.includes("RESEARCH_ID_COLLECTION = 'research_ids'"),'research IDs must have an atomic uniqueness index');
assert.ok(persistenceHardening.includes('updateStudentClass'),'grade/class progression must preserve student and research identity');
assert.ok(authHardening.includes('/api/management/research.bundle.zip'),'researcher must be allowed to download the protected one-snapshot bundle');
assert.ok(serverHardening.includes('/api/management/research.bundle.zip'),'one-snapshot ZIP export endpoint must exist');
assert.ok(managementHardening.includes("data_quality_flag||'')!=='complete"),'complete-case filters must include reflection/data-quality status');
assert.ok(managementHardening.includes('bundleCsvBtn'),'research management UI must expose the same-snapshot ZIP export');
assert.ok(appSource.includes('sessionSaveQueueRef'),'checkpoint writes must be serialized to avoid stale overwrite races');
assert.ok(appSource.includes('Research session checkpoint unavailable'),'in-progress session checkpoints must be attempted');
'''
# insert before existing final console.log to keep PASS last
text=text.replace("\nconsole.log('Integrated research dataset QA: PASS');", append+"\nconsole.log('Integrated research dataset QA: PASS');",1)
Path(p).write_text(text)

# 11) Production deployment permanently checks that a ~50KB session reaches validation/Firestore lookup rather than 413.
p='.github/workflows/cloud-run-deploy.yml'; text=Path(p).read_text()
needle="""          echo \"$chat\" | grep -q '\"route\":\"anthropic-resilient\"'\n"""
insert="""          echo \"$chat\" | grep -q '\"route\":\"anthropic-resilient\"'\n\n          # A realistic five-minute research payload must pass Express JSON parsing.\n          python3 - <<'PY'\n          import json,time\n          now=int(time.time()*1000); history=[]\n          for i in range(80):\n              history.append({'id':f'm{i}','sender':'child' if i%2 else 'ai','englishText':'I like soccer because it is fun. How about you?','japaneseText':'私はサッカーが好きです。楽しいからです。あなたはどうですか？','timestamp':now+i*1000})\n          payload={'sessionId':'production_payload_probe_12345678','learningCode':'Z9Q7','aiStudentId':'emma_usa','topic':'favorites','targetDurationMinutes':5,'startedAt':now,'endedAt':now+300000,'history':history}\n          open('/tmp/session-payload.json','w').write(json.dumps(payload,ensure_ascii=False))\n          PY\n          payload_status=$(curl --silent --show-error --max-time 20 -o /tmp/session-payload-response.json -w '%{http_code}' -X POST \"$API_URL/api/sessions\" -H 'Content-Type: application/json' --data-binary @/tmp/session-payload.json)\n          test \"$payload_status\" = '401'\n          grep -q 'LEARNING_CODE_NOT_FOUND' /tmp/session-payload-response.json\n"""
if needle not in text: raise SystemExit('cloud run smoke insertion marker missing')
Path(p).write_text(text.replace(needle,insert,1))

print('Research data hardening patch applied.')
