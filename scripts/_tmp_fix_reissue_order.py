from pathlib import Path
p=Path('src/server/persistence.ts')
t=p.read_text()
old="""  for (const record of records) {
    const id = documentId(record); if (!id) continue;
    await setDocument(STUDENT_COLLECTION, id, { ...withoutInternal(record), teacherStudentId: tid, active: false, updatedAt: new Date().toISOString() });
  }
  return createStudentCode(newCode, studentId, String(latest.researchId || ''), normalizeClassId(latest.classId), tid);
"""
new="""  const created = await createStudentCode(newCode, studentId, String(latest.researchId || ''), normalizeClassId(latest.classId), tid);
  for (const record of records) {
    const id = documentId(record); if (!id) continue;
    await setDocument(STUDENT_COLLECTION, id, { ...withoutInternal(record), teacherStudentId: tid, active: false, updatedAt: new Date().toISOString() });
  }
  return created;
"""
if old not in t: raise SystemExit('reissue block not found')
p.write_text(t.replace(old,new,1))
q=Path('scripts/qa-research-integrated.ts')
s=q.read_text()
needle="assert.ok(persistenceHardening.includes('updateStudentClass'),'grade/class progression must preserve student and research identity');"
add="""assert.ok(persistenceHardening.includes('updateStudentClass'),'grade/class progression must preserve student and research identity');
assert.ok(persistenceHardening.indexOf('const created = await createStudentCode(newCode') < persistenceHardening.indexOf('teacherStudentId: tid, active: false'),'new learning code must be created successfully before old codes are deactivated');"""
if needle not in s: raise SystemExit('QA insertion point not found')
q.write_text(s.replace(needle,add,1))
