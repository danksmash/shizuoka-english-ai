from pathlib import Path

def rep(path, old, new, count=1):
    p=Path(path); t=p.read_text()
    if t.count(old)<count:
        raise SystemExit(f'{path}: missing replacement target: {old[:100]!r}')
    p.write_text(t.replace(old,new,count))

# Avoid unhandled rejections for best-effort in-progress checkpoints.
rep('src/App.tsx', "      void enqueueSessionSnapshot({ sessionId: nextSessionId, learningCode: code, aiStudentId: newProfile.selectedAiStudentId, topic: newProfile.selectedTopic, targetDurationMinutes: newProfile.selectedDurationMinutes, startedAt, endedAt: startedAt, history: initialHistory, encounteredVocab: [], systemEvents: systemEventsRef.current });", "      void enqueueSessionSnapshot({ sessionId: nextSessionId, learningCode: code, aiStudentId: newProfile.selectedAiStudentId, topic: newProfile.selectedTopic, targetDurationMinutes: newProfile.selectedDurationMinutes, startedAt, endedAt: startedAt, history: initialHistory, encounteredVocab: [], systemEvents: systemEventsRef.current }).catch(() => undefined);")
rep('src/App.tsx', "          void enqueueSessionSnapshot({ sessionId, learningCode, aiStudentId: currentProf.selectedAiStudentId, topic: currentProf.selectedTopic, targetDurationMinutes: currentProf.selectedDurationMinutes, startedAt: sessionStartedAtRef.current, endedAt: Date.now(), history: updatedHistory, encounteredVocab: encounteredVocabRef.current, systemEvents: systemEventsRef.current });", "          void enqueueSessionSnapshot({ sessionId, learningCode, aiStudentId: currentProf.selectedAiStudentId, topic: currentProf.selectedTopic, targetDurationMinutes: currentProf.selectedDurationMinutes, startedAt: sessionStartedAtRef.current, endedAt: Date.now(), history: updatedHistory, encounteredVocab: encounteredVocabRef.current, systemEvents: systemEventsRef.current }).catch(() => undefined);")

# Student/teacher IDs are also atomically reserved; student documents are create-only on issuance.
rep('src/server/persistence.ts', "const RESEARCH_ID_COLLECTION = 'research_ids';\nconst RESEARCH_ID_ALPHABET", "const RESEARCH_ID_COLLECTION = 'research_ids';\nconst TEACHER_ID_COLLECTION = 'teacher_ids';\nconst RESEARCH_ID_ALPHABET")
old="""async function generateUniqueTeacherStudentId(records?: Record<string, any>[]): Promise<string> {
  const source = records || await listCollection(STUDENT_COLLECTION, 1000);
  const used = new Set(source.map((row) => validTeacherStudentId(row.teacherStudentId)).filter(Boolean));
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = randomTeacherStudentId();
    if (!used.has(candidate)) return candidate;
  }
  throw new Error('TEACHER_STUDENT_ID_EXHAUSTED');
}
"""
new="""async function generateUniqueTeacherStudentId(studentId: string, records?: Record<string, any>[]): Promise<string> {
  const source = records || await listCollection(STUDENT_COLLECTION, 1000);
  const used = new Set(source.map((row) => validTeacherStudentId(row.teacherStudentId)).filter(Boolean));
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = randomTeacherStudentId();
    if (used.has(candidate)) continue;
    if (await createDocumentIfAbsent(TEACHER_ID_COLLECTION, candidate, { studentId, createdAt: new Date().toISOString() })) return candidate;
  }
  throw new Error('TEACHER_STUDENT_ID_EXHAUSTED');
}
"""
rep('src/server/persistence.ts',old,new)
rep('src/server/persistence.ts', "  const tid = validTeacherStudentId(teacherId) || await generateUniqueTeacherStudentId();", "  const tid = validTeacherStudentId(teacherId) || await generateUniqueTeacherStudentId(sid);")
old="""      for (let attempt = 0; attempt < 100 && !tid; attempt += 1) {
        const candidate = randomTeacherStudentId();
        if (!used.has(candidate)) { tid = candidate; used.add(candidate); }
      }
      if (!tid) throw new Error('TEACHER_STUDENT_ID_EXHAUSTED');
"""
new="""      tid = await generateUniqueTeacherStudentId(studentId, records);
      used.add(tid);
"""
rep('src/server/persistence.ts',old,new)
rep('src/server/persistence.ts', "  const tid = validTeacherStudentId(latest.teacherStudentId) || await generateUniqueTeacherStudentId(await listCollection(STUDENT_COLLECTION, 1000));", "  const tid = validTeacherStudentId(latest.teacherStudentId) || await generateUniqueTeacherStudentId(studentId, await listCollection(STUDENT_COLLECTION, 1000));")
old="""  await setDocument(STUDENT_COLLECTION, key, {
    studentId: sid,
    researchId: rid,
    teacherStudentId: tid,
    classId: cid,
    active: true,
    createdAt: now,
    updatedAt: now,
  });
"""
new="""  const created = await createDocumentIfAbsent(STUDENT_COLLECTION, key, {
    studentId: sid,
    researchId: rid,
    teacherStudentId: tid,
    classId: cid,
    active: true,
    createdAt: now,
    updatedAt: now,
  });
  if (!created) throw new Error('LEARNING_CODE_ALREADY_EXISTS');
"""
rep('src/server/persistence.ts',old,new)

# Preserve academic-year / grade context and allow long-term history retrieval.
marker="export interface SaveCanonicalSessionArgs {"
helper="""function academicYearForLocalDate(localDate: string): number {
  const [yearText, monthText] = localDate.split('-');
  const year = Number(yearText); const month = Number(monthText);
  return Number.isInteger(year) && Number.isInteger(month) ? (month >= 4 ? year : year - 1) : 0;
}
function gradeLevelForClassId(classId: string): number | '' {
  return classId.startsWith('5-') ? 5 : classId.startsWith('6-') ? 6 : '';
}

"""
rep('src/server/persistence.ts',marker,helper+marker)
rep('src/server/persistence.ts', "  const studentSessions = await queryCollection(SESSION_COLLECTION, 'studentId', args.studentId, 1000);", "  const studentSessions = await queryCollection(SESSION_COLLECTION, 'studentId', args.studentId, 5000);")
rep('src/server/persistence.ts', "  const document = {\n    schemaVersion: 3, sessionId: args.sessionId, studentId: args.studentId, researchId: args.researchId,\n    classId: normalizeClassId(args.classId), aiStudentId: args.aiStudentId, topic: args.topic,", "  const currentClassId = normalizeClassId(args.classId);\n  const document = {\n    schemaVersion: 3, sessionId: args.sessionId, studentId: args.studentId, researchId: args.researchId,\n    classId: currentClassId, academicYear: academicYearForLocalDate(localDate), gradeLevel: gradeLevelForClassId(currentClassId), aiStudentId: args.aiStudentId, topic: args.topic,")
rep('src/server/persistence.ts', "  const rows = await queryCollection(SESSION_COLLECTION, 'studentId', studentId, 500);", "  const rows = await queryCollection(SESSION_COLLECTION, 'studentId', studentId, 5000);")

# Academic-year and grade are exported on all linked datasets, including legacy sessions.
marker="function commonFields(session: Record<string, any>, meta: ContextMeta) {"
helper="""function academicYearFromDate(localDate: string): number | '' {
  const [yearText, monthText] = localDate.split('-'); const year = Number(yearText); const month = Number(monthText);
  return Number.isInteger(year) && Number.isInteger(month) ? (month >= 4 ? year : year - 1) : '';
}
function gradeFromClassId(classId: unknown): number | '' {
  const value = String(classId || ''); return value.startsWith('5-') ? 5 : value.startsWith('6-') ? 6 : '';
}

"""
rep('src/server/researchExport.ts',marker,helper+marker)
rep('src/server/researchExport.ts', "    session_id: session.sessionId || '',\n    local_date: meta.localDate,", "    session_id: session.sessionId || '',\n    academic_year: session.academicYear || academicYearFromDate(meta.localDate),\n    grade_level: session.gradeLevel || gradeFromClassId(session.classId),\n    local_date: meta.localDate,",1)
rep('src/server/researchExport.ts', "      session_id: sessionId,\n      schema_version: session.schemaVersion || 2,", "      session_id: sessionId,\n      schema_version: session.schemaVersion || 2,\n      academic_year: session.academicYear || academicYearFromDate(meta.localDate),\n      grade_level: session.gradeLevel || gradeFromClassId(session.classId),",1)

# Permanent QA expands to atomic teacher IDs, create-only code issuance, history horizon, and year/grade columns.
p=Path('scripts/qa-research-integrated.ts'); t=p.read_text()
needle="assert.ok(persistenceHardening.includes(\"RESEARCH_ID_COLLECTION = 'research_ids'\"),'research IDs must have an atomic uniqueness index');"
add="""assert.ok(persistenceHardening.includes(\"RESEARCH_ID_COLLECTION = 'research_ids'\"),'research IDs must have an atomic uniqueness index');
assert.ok(persistenceHardening.includes(\"TEACHER_ID_COLLECTION = 'teacher_ids'\"),'teacher-facing student IDs must also be atomically reserved');
assert.ok(persistenceHardening.includes('createDocumentIfAbsent(STUDENT_COLLECTION, key'),'learning-code documents must not overwrite concurrent issuance');
assert.ok(persistenceHardening.includes("queryCollection(SESSION_COLLECTION, 'studentId', studentId, 5000)"),'student longitudinal history must exceed the old 500-session ceiling');"""
if needle not in t: raise SystemExit('research QA persistence marker missing')
t=t.replace(needle,add,1)
needle="assert.equal(unassigned.usage_context_inferred,'unknown','school-hours sessions without class_id must not be classified as out-of-class');"
add="""assert.equal(unassigned.usage_context_inferred,'unknown','school-hours sessions without class_id must not be classified as out-of-class');
assert.equal(inClass.academic_year,2026,'Japanese academic year must be available for longitudinal analysis');
assert.equal(inClass.grade_level,5,'grade level must be derived from class_id for legacy-compatible export');"""
if needle not in t: raise SystemExit('research QA context marker missing')
t=t.replace(needle,add,1)
p.write_text(t)

print('Final integrity patch applied.')
