const project = process.env.GCP_PROJECT || 'shizuoka-english-ai';
const token = process.env.FIRESTORE_ACCESS_TOKEN || '';
if (!token) throw new Error('FIRESTORE_ACCESS_TOKEN_MISSING');

const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents`;

function decode(value) {
  if (!value || typeof value !== 'object') return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue?.values || []).map(decode);
  if ('mapValue' in value) return decodeFields(value.mapValue?.fields || {});
  return null;
}
function decodeFields(fields) { return Object.fromEntries(Object.entries(fields || {}).map(([k,v]) => [k,decode(v)])); }
function docId(name) { return String(name || '').split('/').pop() || ''; }

async function list(collection) {
  const out = [];
  let pageToken = '';
  do {
    const url = `${base}/${encodeURIComponent(collection)}?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`FIRESTORE_LIST_${collection}_${response.status}:${(await response.text()).slice(0,180)}`);
    const data = await response.json();
    for (const doc of data.documents || []) out.push({ ...decodeFields(doc.fields || {}), _id: docId(doc.name) });
    pageToken = typeof data.nextPageToken === 'string' ? data.nextPageToken : '';
  } while (pageToken);
  return out;
}

const collections = ['students','research_ids','sessions','reflection_devices','lesson_reflections'];
const [students,researchIds,sessions,devices,reflections] = await Promise.all(collections.map(list));
const problems = [];
const note = (kind, count) => { if (count > 0) problems.push({ kind, count }); };

const studentGroups = new Map();
for (const row of students) {
  const sid = String(row.studentId || '');
  if (!sid) continue;
  const list = studentGroups.get(sid) || []; list.push(row); studentGroups.set(sid,list);
}
const missingStudentCore = students.filter(r => !r.studentId || !r.researchId || !r.learningId).length;
note('student_record_missing_core_identity', missingStudentCore);
let multiActiveStudent = 0;
for (const rows of studentGroups.values()) if (rows.filter(r => r.active !== false).length > 1) multiActiveStudent += 1;
note('student_has_multiple_active_codes', multiActiveStudent);
const activeLearning = new Map();
for (const row of students.filter(r => r.active !== false)) {
  const id = String(row.learningId || ''); if (!id) continue;
  const set = activeLearning.get(id) || new Set(); set.add(String(row.studentId || '')); activeLearning.set(id,set);
}
note('active_learning_id_shared_across_students', [...activeLearning.values()].filter(s => s.size > 1).length);

const researchToStudents = new Map();
for (const row of students) {
  const rid = String(row.researchId || ''); const sid = String(row.studentId || ''); if (!rid || !sid) continue;
  const set = researchToStudents.get(rid) || new Set(); set.add(sid); researchToStudents.set(rid,set);
}
note('research_id_shared_across_students', [...researchToStudents.values()].filter(s => s.size > 1).length);
const researchRegistry = new Map(researchIds.map(r => [String(r._id || ''), String(r.studentId || '')]));
let missingResearchRegistry = 0, mismatchedResearchRegistry = 0;
for (const [rid,sids] of researchToStudents.entries()) {
  if (!researchRegistry.has(rid)) missingResearchRegistry += 1;
  else if (!sids.has(researchRegistry.get(rid))) mismatchedResearchRegistry += 1;
}
note('research_id_registry_missing', missingResearchRegistry);
note('research_id_registry_mismatch', mismatchedResearchRegistry);

const studentResearchSet = new Map();
for (const row of students) {
  const sid=String(row.studentId||''), rid=String(row.researchId||''); if(!sid||!rid) continue;
  const set=studentResearchSet.get(sid)||new Set(); set.add(rid); studentResearchSet.set(sid,set);
}
const knownStudentIds = new Set(studentGroups.keys());
const allowedPersonas = new Set(['emma_usa','oliver_uk','liam_australia','bence_hungary','zofia_poland','rahul_bangladesh','linh_vietnam','minji_korea','pavel_belarus','lukas_germany','aina_malaysia','dimas_indonesia','yuting_taiwan','matas_lithuania','ananya_india','xinyi_china','nadeesha_srilanka','suman_nepal','amara_nigeria','andrei_romania']);
const allowedTopics = new Set(['intro','favorites','shizuoka_culture','talents','daily_routine','free']);
let sessionOrphan=0, sessionResearchMismatch=0, sessionIdMismatch=0, invalidPersona=0, invalidTopic=0;
for (const row of sessions) {
  const sid=String(row.studentId||''), rid=String(row.researchId||'');
  if (!knownStudentIds.has(sid)) sessionOrphan += 1;
  if (sid && rid && !(studentResearchSet.get(sid)?.has(rid))) sessionResearchMismatch += 1;
  if (row.sessionId && String(row.sessionId)!==String(row._id)) sessionIdMismatch += 1;
  if (row.aiStudentId && !allowedPersonas.has(String(row.aiStudentId))) invalidPersona += 1;
  if (row.topic && !allowedTopics.has(String(row.topic))) invalidTopic += 1;
}
note('session_orphan_student',sessionOrphan); note('session_research_id_mismatch',sessionResearchMismatch); note('session_document_id_mismatch',sessionIdMismatch); note('session_invalid_persona',invalidPersona); note('session_invalid_topic',invalidTopic);

let reflectionOrphan=0, reflectionResearchMismatch=0, reflectionIdMismatch=0, duplicateStudentDay=0;
const reflectionKeys = new Set();
let sixPartRecords=0, legacyBOnlyRecords=0, emptyContentRecords=0;
for (const row of reflections) {
  const sid=String(row.studentId||''), rid=String(row.researchId||'');
  if (!knownStudentIds.has(sid)) reflectionOrphan += 1;
  if (sid && rid && !(studentResearchSet.get(sid)?.has(rid))) reflectionResearchMismatch += 1;
  if (row.reflectionId && String(row.reflectionId)!==String(row._id)) reflectionIdMismatch += 1;
  const key=`${sid}|${String(row.localDate||'')}`; if (reflectionKeys.has(key)) duplicateStudentDay += 1; else reflectionKeys.add(key);
  const six=[row.achievements,row.languageUsed,row.thinking,row.difficultyStrategy,row.languageCultureAwareness,row.nextGoal].some(v=>String(v||'').trim());
  const b=Boolean(String(row.reflectionText||'').trim());
  if (six) sixPartRecords += 1; else if (b) legacyBOnlyRecords += 1; else emptyContentRecords += 1;
}
note('reflection_orphan_student',reflectionOrphan); note('reflection_research_id_mismatch',reflectionResearchMismatch); note('reflection_document_id_mismatch',reflectionIdMismatch); note('reflection_duplicate_student_day',duplicateStudentDay);

let deviceOrphan=0, deviceResearchMismatch=0, staleActiveDevice=0;
const activeCodeByStudent = new Map();
for (const row of students.filter(r=>r.active!==false)) activeCodeByStudent.set(String(row.studentId||''), String(row.learningId||''));
for (const row of devices.filter(r=>r.active!==false)) {
  const sid=String(row.studentId||''), rid=String(row.researchId||'');
  if (!knownStudentIds.has(sid)) deviceOrphan += 1;
  if (sid && rid && !(studentResearchSet.get(sid)?.has(rid))) deviceResearchMismatch += 1;
  if (sid && activeCodeByStudent.has(sid) && String(row.learningId||'')!==activeCodeByStudent.get(sid)) staleActiveDevice += 1;
}
note('reflection_device_orphan_student',deviceOrphan); note('reflection_device_research_id_mismatch',deviceResearchMismatch);
// Stale active device documents are expected after code reissue: runtime requireIdentity rejects them.

console.log(JSON.stringify({
  audit:'production-data-integrity',
  counts:{ students_documents:students.length, unique_students:studentGroups.size, research_id_documents:researchIds.length, sessions:sessions.length, reflection_devices:devices.length, lesson_reflections:reflections.length, six_part_reflections:sixPartRecords, legacy_b_only_reflections:legacyBOnlyRecords, empty_reflection_records:emptyContentRecords, stale_device_docs_runtime_rejected:staleActiveDevice },
  blocking_problem_count:problems.reduce((sum,p)=>sum+p.count,0),
  problems,
}, null, 2));
if (problems.length) process.exitCode = 2;
