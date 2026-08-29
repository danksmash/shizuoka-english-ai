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
s2,count=re.subn(pattern,"# renderCodes is updated by a separate focused patch.\n# Create-code handler includes attendance and displays learner ID.\n",s,count=1,flags=re.S)
if count!=1:
    raise SystemExit(f'renderCodes patch block removal failed: {count}')

p.write_text(s2)
print('identity patch script corrected')
