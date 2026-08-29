from pathlib import Path
import re

p=Path('scripts/_tmp_apply_learner_id_sync.py')
s=p.read_text()

old="""t=rep(t,\"  const records = (await listCollection(STUDENT_COLLECTION, 1000)).filter((row) => row.studentId === studentId);\\n\", \"  const records = (await listCollection(STUDENT_COLLECTION, 1000)).filter((row) => row.studentId === studentId);\\n  const attendance = normalizeAttendanceNumber(attendanceNumber);\\n\", 'update class attendance local')"""
new="""t=sub(t,r\"(export async function updateStudentClass\\(studentId: string, classId: string, attendanceNumber\\?: unknown\\): Promise<void> \\{\\n  const cid = normalizeClassId\\(classId\\);\\n  if \\(!/\\^\\(\\?:5-\\[123\\]\\|6-\\[123\\]\\|テスト\\|予備\\)\\$/.test\\(cid\\)\\) throw new Error\\('INVALID_CLASS_ID'\\);\\n  const records = \\(await listCollection\\(STUDENT_COLLECTION, 1000\\)\\).filter\\(\\(row\\) => row.studentId === studentId\\);\\n)\", r\"\\1  const attendance = normalizeAttendanceNumber(attendanceNumber);\\n\", 'update class attendance local')"""
if old not in s:
    raise SystemExit('update-class target line not found in identity patch script')
s=s.replace(old,new)

# renderCodes is patched in a separate focused step; remove the fragile block here.
pattern=r"# renderCodes function: replace opaque id with learner ID \+ attendance\.\n.*?# Create-code handler includes attendance and displays learner ID\.\n"
s,count=re.subn(pattern,"# renderCodes is updated by a separate focused patch.\n# Create-code handler includes attendance and displays learner ID.\n",s,count=1,flags=re.S)
if count!=1:
    raise SystemExit(f'renderCodes patch block removal failed: {count}')

# Replace the issue-code patch itself with a boundary-based replacement so the old handler cannot leave a tail behind.
pattern=r"# Create-code handler includes attendance and displays learner ID\.\n.*?# Refresh retains filters and reports actual reload time\.\n"
replacement="""# Create-code handler includes attendance and displays learner ID.
issue_handler = \"$('issueCodeBtn').addEventListener('click',async function(){var code=$('newCode').value.trim().toUpperCase(),cls=$('newClass').value,no=Number($('newAttendance').value);if(!/^[A-Z0-9]{4}$/.test(code)){setText('codeMessage','英数字4文字の学習者IDを入力してください。');return}if(!cls){setText('codeMessage','学級を選択してください。');return}if(!Number.isInteger(no)||no<1||no>99){setText('codeMessage','出席番号を入力してください。');return}try{var d=await mutateCode({action:'create',learningCode:code,classId:cls,attendanceNumber:no});setText('codeMessage','発行しました。学習者ID: '+d.learningId);$('newCode').value='';$('newAttendance').value='';await loadTeacher()}catch(e){setText('codeMessage',String(e.message||e))}});\"
issue_start=t.index(\"$('issueCodeBtn').addEventListener\")
issue_end=t.index(\"$('reissueCancel').addEventListener\", issue_start)
t=t[:issue_start]+issue_handler+t[issue_end:]
# Refresh retains filters and reports actual reload time.
"""
s,count=re.subn(pattern,replacement,s,count=1,flags=re.S)
if count!=1:
    raise SystemExit(f'issue handler patch replacement failed: {count}')

p.write_text(s)
print('identity patch script corrected')
