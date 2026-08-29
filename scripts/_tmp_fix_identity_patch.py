from pathlib import Path

p = Path('scripts/_tmp_apply_learner_id_sync.py')
s = p.read_text()

# Earlier iterations already incorporated the fragile-target fixes directly into the
# implementation patch. Keep this preflight idempotent so PR reruns do not fail merely
# because the patch is already in its corrected form.
required = [
    "t=sub(t,r\"(export async function updateStudentClass",
    "# renderCodes is updated by a separate focused patch.",
    "issue_start=t.index(\"$('issueCodeBtn').addEventListener\")",
]
missing = [needle for needle in required if needle not in s]
if missing:
    raise SystemExit('learner ID implementation patch is missing expected corrected targets')

print('identity patch script already corrected; no changes needed')
