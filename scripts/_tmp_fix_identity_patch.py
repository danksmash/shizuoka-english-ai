from pathlib import Path
p=Path('scripts/_tmp_apply_learner_id_sync.py')
s=p.read_text()
old="""t=rep(t,\"  const records = (await listCollection(STUDENT_COLLECTION, 1000)).filter((row) => row.studentId === studentId);\\n\", \"  const records = (await listCollection(STUDENT_COLLECTION, 1000)).filter((row) => row.studentId === studentId);\\n  const attendance = normalizeAttendanceNumber(attendanceNumber);\\n\", 'update class attendance local')"""
new="""t=sub(t,r\"(export async function updateStudentClass\\(studentId: string, classId: string, attendanceNumber\\?: unknown\\): Promise<void> \\{\\n  const cid = normalizeClassId\\(classId\\);\\n  if \\(!/\\^\\(\\?:5-\\[123\\]\\|6-\\[123\\]\\|テスト\\|予備\\)\\$/.test\\(cid\\)\\) throw new Error\\('INVALID_CLASS_ID'\\);\\n  const records = \\(await listCollection\\(STUDENT_COLLECTION, 1000\\)\\).filter\\(\\(row\\) => row.studentId === studentId\\);\\n)\", r\"\\1  const attendance = normalizeAttendanceNumber(attendanceNumber);\\n\", 'update class attendance local')"""
if old not in s:
    raise SystemExit('target line not found in identity patch script')
p.write_text(s.replace(old,new))
print('identity patch script corrected')
