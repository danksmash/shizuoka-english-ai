from pathlib import Path

def rep(path, old, new, count=1):
    p = Path(path)
    t = p.read_text()
    n = t.count(old)
    if n != count:
        raise SystemExit(f'{path}: expected {count}, found {n}: {old[:80]!r}')
    p.write_text(t.replace(old, new, count))

rep('src/components/SetupScreen.tsx', '[1, 2, 3, 5, 10].map((mins) => (', '[1, 2, 3, 5].map((mins) => (')
rep('src/components/SetupScreen.tsx', 'grid grid-cols-5 gap-1', 'grid grid-cols-4 gap-1')
rep('src/dataContract.ts', "      reflection: source.reflection && typeof source.reflection === 'object' ? (source.reflection as ReflectionAnswers) : undefined,", "      reflection: parseReflectionAnswers(source.reflection),")
insert = '''export function parseReflectionAnswers(value: unknown): ReflectionAnswers | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const source = value as Record<string, unknown>;
  const rating = (key: string) => {
    const number = Number(source[key]);
    return Number.isInteger(number) && number >= 1 && number <= 5 ? number : null;
  };
  const conveyedIdeas = rating('conveyedIdeas');
  const understoodPartner = rating('understoodPartner');
  const continuedConversation = rating('continuedConversation');
  const noticedLanguageCulture = rating('noticedLanguageCulture');
  if ([conveyedIdeas, understoodPartner, continuedConversation, noticedLanguageCulture].some((v) => v === null)) return undefined;
  return { conveyedIdeas: conveyedIdeas!, understoodPartner: understoodPartner!, continuedConversation: continuedConversation!, noticedLanguageCulture: noticedLanguageCulture!, freeComment: typeof source.freeComment === 'string' ? source.freeComment.trim().slice(0, 500) : undefined };
}

'''
marker='export function validateSessionSaveInput(body: unknown):'
p=Path('src/dataContract.ts'); t=p.read_text();
if marker not in t: raise SystemExit('dataContract marker missing')
p.write_text(t.replace(marker,insert+marker,1))
rep('src/server/persistence.ts', "const SESSION_COLLECTION = 'sessions';", "const SESSION_COLLECTION = 'sessions';\n\nfunction retentionDays(): number {\n  const value = Number(process.env.SESSION_RETENTION_DAYS || 1095);\n  return Number.isFinite(value) ? Math.max(30, Math.min(3650, Math.round(value))) : 1095;\n}")
rep('src/server/persistence.ts', "    updatedAt: new Date().toISOString(),\n    createdAt: existing?.createdAt || new Date().toISOString(),", "    updatedAt: new Date().toISOString(),\n    createdAt: existing?.createdAt || new Date().toISOString(),\n    retentionExpiresAt: new Date(args.endedAt + retentionDays() * 24 * 60 * 60 * 1000).toISOString(),")
rep('server.ts', "import { calculateCanonicalStats, canonicalizeHistory, isAIStudentId, isDialogueDuration, isDialogueTopic } from './src/dataContract';", "import { calculateCanonicalStats, canonicalizeHistory, isAIStudentId, isDialogueDuration, isDialogueTopic, isValidLearningCode, normalizeLearningCode, validateSessionSaveInput } from './src/dataContract';")
rep('server.ts', "import { validateAiResponse, inspectAiResponse, buildAlignedReply } from './src/utils/responseValidation';", "import { validateAiResponse, inspectAiResponse, buildAlignedReply } from './src/utils/responseValidation';\nimport { getAllSessionsForManagement, getStudentHistory, anonymizeSessionForResearch, persistenceConfigured, resolveStudentByCode, saveCanonicalSession } from './src/server/persistence';\nimport { authenticateManagement, clearManagementCookie, managementAuthConfigured, requireManagementRole, setManagementCookie, type AuthenticatedRequest } from './src/server/auth';\nimport { managementPageHtml } from './src/server/managementPage';")
endpoints = r'''const sensitiveAttemptMap = new Map<string, { count: number; resetTime: number }>();
function checkSensitiveLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now(); const record = sensitiveAttemptMap.get(key);
  if (!record || now > record.resetTime) { sensitiveAttemptMap.set(key, { count: 1, resetTime: now + windowMs }); return true; }
  if (record.count >= maxRequests) return false; record.count += 1; return true;
}
app.get('/management', (_req, res) => { res.setHeader('Cache-Control', 'no-store'); res.type('html').send(managementPageHtml()); });
app.post('/api/student/resolve', async (req, res) => {
  const ip=req.ip||req.socket.remoteAddress||'unknown'; if(!checkSensitiveLimit(`student:${ip}`,15,10*60_000))return res.status(429).json({success:false,error:'TOO_MANY_CODE_ATTEMPTS'});
  if(!persistenceConfigured())return res.status(503).json({success:false,error:'PERSISTENCE_NOT_CONFIGURED'}); const learningCode=normalizeLearningCode(req.body?.learningCode);
  if(!isValidLearningCode(learningCode))return res.status(400).json({success:false,error:'INVALID_LEARNING_CODE'});
  try{const student=await resolveStudentByCode(learningCode);if(!student)return res.status(401).json({success:false,error:'LEARNING_CODE_NOT_FOUND'});res.setHeader('Cache-Control','no-store');return res.json({success:true});}
  catch(error:any){console.error('Student code resolve failed',{message:error?.message});return res.status(503).json({success:false,error:'STUDENT_LOOKUP_UNAVAILABLE'});}
});
app.post('/api/student/history', async (req,res)=>{
  const ip=req.ip||req.socket.remoteAddress||'unknown';if(!checkSensitiveLimit(`history:${ip}`,30,10*60_000))return res.status(429).json({success:false,error:'RATE_LIMITED'});const learningCode=normalizeLearningCode(req.body?.learningCode);
  if(!isValidLearningCode(learningCode))return res.status(400).json({success:false,error:'INVALID_LEARNING_CODE'});
  try{const student=await resolveStudentByCode(learningCode);if(!student)return res.status(401).json({success:false,error:'LEARNING_CODE_NOT_FOUND'});const history=await getStudentHistory(student.studentId);res.setHeader('Cache-Control','no-store');return res.json({success:true,history});}
  catch(error:any){console.error('Student history failed',{message:error?.message});return res.status(503).json({success:false,error:'HISTORY_UNAVAILABLE'});}
});
app.post('/api/sessions', async (req,res)=>{
  const validated=validateSessionSaveInput(req.body);if('error' in validated)return res.status(400).json({success:false,error:validated.error});
  try{const student=await resolveStudentByCode(validated.value.learningCode);if(!student)return res.status(401).json({success:false,error:'LEARNING_CODE_NOT_FOUND'});const saved=await saveCanonicalSession({sessionId:validated.value.sessionId,studentId:student.studentId,researchId:student.researchId,aiStudentId:validated.value.aiStudentId,topic:validated.value.topic,targetDurationMinutes:validated.value.targetDurationMinutes,startedAt:validated.value.startedAt,endedAt:validated.value.endedAt,history:validated.value.history,encounteredVocab:validated.value.encounteredVocab||[],reflection:validated.value.reflection});res.setHeader('Cache-Control','no-store');return res.json({success:true,session:{sessionId:saved.sessionId,lifetimeSessionNumber:saved.lifetimeSessionNumber}});}
  catch(error:any){console.error('Session save failed',{message:error?.message});const conflict=error?.message==='SESSION_ID_CONFLICT';return res.status(conflict?409:503).json({success:false,error:conflict?'SESSION_ID_CONFLICT':'SESSION_SAVE_UNAVAILABLE'});}
});
app.post('/api/management/login',(req,res)=>{const ip=req.ip||req.socket.remoteAddress||'unknown';if(!checkSensitiveLimit(`mgmt:${ip}`,10,15*60_000))return res.status(429).json({success:false,error:'TOO_MANY_LOGIN_ATTEMPTS'});const username=typeof req.body?.username==='string'?req.body.username.slice(0,100):'';const password=typeof req.body?.password==='string'?req.body.password.slice(0,300):'';const result=authenticateManagement(username,password);if(!result)return res.status(managementAuthConfigured()?401:503).json({success:false,error:managementAuthConfigured()?'INVALID_CREDENTIALS':'MANAGEMENT_AUTH_NOT_CONFIGURED'});setManagementCookie(res,result.token);return res.json({success:true,role:result.role});});
app.post('/api/management/logout',(_req,res)=>{clearManagementCookie(res);return res.json({success:true});});
app.get('/api/management/me',requireManagementRole(['teacher','researcher']),(req:AuthenticatedRequest,res)=>{res.setHeader('Cache-Control','no-store');return res.json({success:true,user:req.managementUser});});
app.get('/api/management/sessions',requireManagementRole(['teacher','researcher']),async(_req,res)=>{try{const sessions=await getAllSessionsForManagement();res.setHeader('Cache-Control','no-store');return res.json({success:true,sessions});}catch(error:any){console.error('Management sessions failed',{message:error?.message});return res.status(503).json({success:false,error:'MANAGEMENT_DATA_UNAVAILABLE'});}});
function csvCell(value:unknown):string{const text=String(value??'');return `"${text.replace(/"/g,'""')}"`;}
app.get('/api/management/research.csv',requireManagementRole(['researcher']),async(_req,res)=>{try{const sessions=await getAllSessionsForManagement();const rows=sessions.map(anonymizeSessionForResearch);const headers=rows.length?Object.keys(rows[0]):['research_id','session_id'];const csv=[headers.map(csvCell).join(','),...rows.map(row=>headers.map(key=>csvCell(row[key])).join(','))].join('\n');res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="research-export.csv"');res.setHeader('Cache-Control','no-store');return res.send('\uFEFF'+csv);}catch(error:any){console.error('Research export failed',{message:error?.message});return res.status(503).json({success:false,error:'RESEARCH_EXPORT_UNAVAILABLE'});}});

'''
marker='async function startServer() {'
p=Path('server.ts');t=p.read_text();
if marker not in t:raise SystemExit('server start marker missing')
p.write_text(t.replace(marker,endpoints+marker,1))
Path('scripts/qa-stage3a.ts').write_text("""import assert from 'node:assert/strict';
import { isDialogueDuration, parseReflectionAnswers, validateSessionSaveInput } from '../src/dataContract';
assert.equal(isDialogueDuration(10), false); assert.equal(isDialogueDuration(5), true);
assert.equal(parseReflectionAnswers({ conveyedIdeas:5, understoodPartner:4, continuedConversation:3, noticedLanguageCulture:2 })?.conveyedIdeas,5);
assert.equal(parseReflectionAnswers({ conveyedIdeas:6, understoodPartner:4, continuedConversation:3, noticedLanguageCulture:2 }),undefined);
const valid=validateSessionSaveInput({sessionId:'session_12345',learningCode:'A7M4',aiStudentId:'emma_usa',topic:'intro',targetDurationMinutes:1,startedAt:1000,endedAt:61000,history:[{id:'c1',sender:'child',englishText:'Hello',timestamp:2000}],reflection:{conveyedIdeas:5,understoodPartner:4,continuedConversation:3,noticedLanguageCulture:2}}); assert.equal(valid.ok,true); console.log('STAGE 3A QA PASS');
""")
