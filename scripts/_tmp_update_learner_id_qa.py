from pathlib import Path

# Update data-contract QA to the current responsibility split: persistence stores IDs/sessions,
# researchExport owns anonymized research columns.
p=Path('scripts/qa-data-contract.ts')
s=p.read_text()
start=s.index("const persistenceSource = await readFile('src/server/persistence.ts', 'utf8');")
end=s.index("\nconsole.log('DATA CONTRACT QA PASS');", start)
block="""const persistenceSource = await readFile('src/server/persistence.ts', 'utf8');
assert.ok(persistenceSource.includes('learningId: normalized'), 'Teacher-facing learner ID must be the distributed four-character ID');
assert.ok(persistenceSource.includes('attendanceNumber'), 'Attendance number must be stored separately from names');
assert.ok(persistenceSource.includes('learnerTeacherVisibleSession'), 'Learner/teacher ordinary views must exclude checkpoint-only sessions');
assert.equal(persistenceSource.includes('child_utterances:'), false, 'Persistence must not create a raw research-export field');
const researchExportSource = await readFile('src/server/researchExport.ts', 'utf8');
assert.ok(researchExportSource.includes('reflection_conveyed_ideas'));
assert.ok(researchExportSource.includes('reflection_understood_partner'));
assert.ok(researchExportSource.includes('reflection_noticed_language_culture'));
assert.ok(!researchExportSource.includes('learningId'), 'Research export must not expose learner IDs');
const serverSource = await readFile('server.ts', 'utf8');
assert.ok(serverSource.includes('learningId:created.learningId'));
assert.ok(serverSource.includes("requireManagementRole(['teacher'])"));
assert.ok(serverSource.includes("requireManagementRole(['researcher'])"));
const managementSource = await readFile('src/server/managementPage.ts', 'utf8');
assert.ok(managementSource.includes('learningId'));
assert.ok(managementSource.includes('/api/management/research.csv'));
assert.ok(managementSource.includes('児童の生の発話本文を表示しません'));
"""
p.write_text(s[:start]+block+s[end:])

p=Path('scripts/qa-dashboard-data-sync.ts')
s=p.read_text()
s=s.replace("assert.equal(context.periodKey('2026-08-28', 'week'), '2026-08-24', 'Friday in JST week must start Monday without UTC day shift');", "assert.equal(context.periodKey('2026-08-28', 'week'), '2026-08-24~2026-08-30', 'Weekly key must display the full Monday-Sunday range');")
p.write_text(s)

print('Legacy QA expectations updated for learner-ID architecture')
