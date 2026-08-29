from pathlib import Path
import re

p=Path('scripts/_tmp_apply_learner_id_sync.py')
s=p.read_text()

old="""t=rep(t,\"  const records = (await listCollection(STUDENT_COLLECTION, 1000)).filter((row) => row.studentId === studentId);\\n\", \"  const records = (await listCollection(STUDENT_COLLECTION, 1000)).filter((row) => row.studentId === studentId);\\n  const attendance = normalizeAttendanceNumber(attendanceNumber);\\n\", 'update class attendance local')"""
new="""t=sub(t,r\"(export async function updateStudentClass\\(studentId: string, classId: string, attendanceNumber\\?: unknown\\): Promise<void> \\{\\n  const cid = normalizeClassId\\(classId\\);\\n  if \\(!/\\^\\(\\?:5-\\[123\\]\\|6-\\[123\\]\\|テスト\\|予備\\)\\$/.test\\(cid\\)\\) throw new Error\\('INVALID_CLASS_ID'\\);\\n  const records = \\(await listCollection\\(STUDENT_COLLECTION, 1000\\)\\).filter\\(\\(row\\) => row.studentId === studentId\\);\\n)\", r\"\\1  const attendance = normalizeAttendanceNumber(attendanceNumber);\\n\", 'update class attendance local')"""
if old not in s:
    raise SystemExit('update-class target line not found in identity patch script')
s=s.replace(old,new)

replacement=r'''# renderCodes function: replace opaque id with learner ID + attendance.
t=sub(t,r"function renderCodes\(\)\{.*?\}\n\nfunction researchFiltered",''' + "'''" + r'''function renderCodes(){var lastMap={};teacherSessions.forEach(function(s){var d=dateOf(s);if(!lastMap[s.studentId]||d>lastMap[s.studentId])lastMap[s.studentId]=d});$('codeRows').innerHTML=studentRecords.map(function(r){var opts=['<option value=\"\">学級未設定</option>'].concat(SCHOOL_CLASSES.map(function(c){return '<option value=\"'+esc(c)+'\" '+(canonClass(r.classId)===c?'selected':'')+'>'+esc(c)+'</option>'})).join('');return '<tr><td><b>'+esc(r.learningId||'未登録')+'</b></td><td><select class=\"class-update\" data-id=\"'+esc(r.studentId)+'\">'+opts+'</select></td><td><input class=\"attendance-update\" data-id=\"'+esc(r.studentId)+'\" type=\"number\" min=\"1\" max=\"99\" value=\"'+esc(r.attendanceNumber||'')+'\" style=\"width:72px\"></td><td><span class=\"status '+(r.active?'':'off')+'\">'+(r.active?'利用中':'利用停止')+'</span></td><td>'+esc(String(r.createdAt||'').slice(0,10)||'—')+'</td><td>'+esc(lastMap[r.studentId]||'—')+'</td><td><button class=\"secondary reissue\" data-id=\"'+esc(r.studentId)+'\">ID再発行</button> <button class=\"'+(r.active?'danger':'secondary')+' active-toggle\" data-id=\"'+esc(r.studentId)+'\" data-active=\"'+(r.active?'0':'1')+'\">'+(r.active?'利用停止':'再開')+'</button></td></tr>'}).join('');document.querySelectorAll('.class-update').forEach(function(sel){sel.addEventListener('change',async function(){if(!sel.value){alert('学級を選択してください。');await loadTeacher();return}var att=document.querySelector('.attendance-update[data-id=\"'+sel.dataset.id+'\"]');try{await mutateCode({action:'update-class',studentId:sel.dataset.id,classId:sel.value,attendanceNumber:att&&att.value});await loadTeacher()}catch(e){alert(String(e.message||e));await loadTeacher()}})});document.querySelectorAll('.attendance-update').forEach(function(inp){inp.addEventListener('change',async function(){var rec=studentRecords.find(function(x){return x.studentId===inp.dataset.id});if(!rec||!rec.classId)return;try{await mutateCode({action:'update-class',studentId:inp.dataset.id,classId:rec.classId,attendanceNumber:inp.value});await loadTeacher()}catch(e){alert(String(e.message||e));await loadTeacher()}})});document.querySelectorAll('.reissue').forEach(function(b){b.addEventListener('click',function(){window.pendingReissue=b.dataset.id;$('reissueCode').value='';$('reissueModal').classList.add('show')})});document.querySelectorAll('.active-toggle').forEach(function(b){b.addEventListener('click',async function(){try{await mutateCode({action:'set-active',studentId:b.dataset.id,active:b.dataset.active==='1'});await loadTeacher()}catch(e){alert(String(e.message||e))}})})}

function researchFiltered''' + "'''" + r''','render codes',flags=re.S)
'''
pattern=r"# renderCodes function: replace opaque id with learner ID \+ attendance\.\n.*?# Create-code handler includes attendance and displays learner ID\.\n"
s2,count=re.subn(pattern,replacement+"# Create-code handler includes attendance and displays learner ID.\n",s,count=1,flags=re.S)
if count!=1:
    raise SystemExit(f'renderCodes patch block replacement failed: {count}')

p.write_text(s2)
print('identity patch script corrected')
