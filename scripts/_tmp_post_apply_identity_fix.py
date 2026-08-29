from pathlib import Path

p=Path('src/server/managementPage.ts')
s=p.read_text()

for fragment in [
    "$('researchListShortcut').addEventListener('click',function(){show('researchList');renderResearchList()});",
    "$('researchQualityShortcut').addEventListener('click',function(){show('researchQuality');renderQuality()});",
    "$('researchExportShortcut').addEventListener('click',function(){show('researchQuality');renderQuality()});",
]:
    s=s.replace(fragment,'')

s=s.replace('<th>学習者ID</th><th>回数</th><th>総対話時間</th>', '<th>学習者ID</th><th>学級・番号</th><th>回数</th><th>総対話時間</th>')
s=s.replace('学習者用コードの管理','学習者IDの管理')
s=s.replace('学習者IDはコード再発行後も変わりません。','学習者IDを再発行しても、これまでの対話履歴は同じ学習者として引き継がれます。')
s=s.replace('＋ 新しいコードを発行','＋ 新しい学習者IDを発行')
s=s.replace('新しい4文字コード','新しい学習者ID')
s=s.replace('コードを再発行・利用停止しても、これまでの対話データは削除されません。','学習者IDを再発行・利用停止しても、これまでの対話データは削除されません。')
s=s.replace("setText('detailStudentCrumb',currentTeacherStudent);", "var currentRec=studentRecords.find(function(x){return x.studentId===currentTeacherStudent});setText('detailStudentCrumb',currentRec&&currentRec.learningId||'—');")

start=s.index('function renderCodes(){')
end=s.index('\n\nfunction researchFiltered', start)
renderer="""function renderCodes(){var lastMap={};teacherSessions.forEach(function(sess){var d=dateOf(sess);if(!lastMap[sess.studentId]||d>lastMap[sess.studentId])lastMap[sess.studentId]=d});$('codeRows').innerHTML=studentRecords.map(function(r){var opts=['<option value=\"\">学級未設定</option>'].concat(SCHOOL_CLASSES.map(function(c){return '<option value=\"'+esc(c)+'\" '+(canonClass(r.classId)===c?'selected':'')+'>'+esc(c)+'</option>'})).join('');return '<tr><td><b>'+esc(r.learningId||'未登録')+'</b></td><td><select class=\"class-update\" data-id=\"'+esc(r.studentId)+'\">'+opts+'</select></td><td><input class=\"attendance-update\" data-id=\"'+esc(r.studentId)+'\" type=\"number\" min=\"1\" max=\"99\" value=\"'+esc(r.attendanceNumber||'')+'\" style=\"width:72px\"></td><td><span class=\"status '+(r.active?'':'off')+'\">'+(r.active?'利用中':'利用停止')+'</span></td><td>'+esc(String(r.createdAt||'').slice(0,10)||'—')+'</td><td>'+esc(lastMap[r.studentId]||'—')+'</td><td><button class=\"secondary reissue\" data-id=\"'+esc(r.studentId)+'\">ID再発行</button> <button class=\"'+(r.active?'danger':'secondary')+' active-toggle\" data-id=\"'+esc(r.studentId)+'\" data-active=\"'+(r.active?'0':'1')+'\">'+(r.active?'利用停止':'再開')+'</button></td></tr>'}).join('');document.querySelectorAll('.class-update').forEach(function(sel){sel.addEventListener('change',async function(){if(!sel.value){alert('学級を選択してください。');await loadTeacher();return}var att=document.querySelector('.attendance-update[data-id=\"'+sel.dataset.id+'\"]');try{await mutateCode({action:'update-class',studentId:sel.dataset.id,classId:sel.value,attendanceNumber:att&&att.value});await loadTeacher()}catch(e){alert(String(e.message||e));await loadTeacher()}})});document.querySelectorAll('.attendance-update').forEach(function(inp){inp.addEventListener('change',async function(){var rec=studentRecords.find(function(x){return x.studentId===inp.dataset.id});if(!rec||!rec.classId)return;try{await mutateCode({action:'update-class',studentId:inp.dataset.id,classId:rec.classId,attendanceNumber:inp.value});await loadTeacher()}catch(e){alert(String(e.message||e));await loadTeacher()}})});document.querySelectorAll('.reissue').forEach(function(b){b.addEventListener('click',function(){window.pendingReissue=b.dataset.id;$('reissueCode').value='';$('reissueModal').classList.add('show')})});document.querySelectorAll('.active-toggle').forEach(function(b){b.addEventListener('click',async function(){try{await mutateCode({action:'set-active',studentId:b.dataset.id,active:b.dataset.active==='1'});await loadTeacher()}catch(e){alert(String(e.message||e))}})})}"""
s=s[:start]+renderer+s[end:]
p.write_text(s)

# Opaque teacher-only IDs are legacy data only. Stop carrying dead generators into new code.
p=Path('src/server/persistence.ts')
s=p.read_text()
s=s.replace("const TEACHER_ID_COLLECTION = 'teacher_ids';\n",'')
s=s.replace("const TEACHER_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';\n",'')
start=s.index('function randomTeacherStudentId(): string {')
end=s.index('function randomResearchId(): string {', start)
s=s[:start]+s[end:]
start=s.index('async function generateUniqueTeacherStudentId(')
end=s.index('\n\nexport async function resolveStudentByCode', start)
s=s[:start]+s[end:]
p.write_text(s)

print('Focused teacher/research identity UI fixes applied')
