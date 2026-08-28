from pathlib import Path

exec(compile(Path('scripts/patch-information-density-v3.py').read_text(), 'patch-information-density-v3.py', 'exec'))
qa_path = Path('scripts/qa-management-page.ts')
qa = qa_path.read_text()
old = "assert.ok(html.includes('allLabel===null'), 'R2/T2 exact fixed-class dropdown behavior missing');\n"
if old not in qa:
    raise SystemExit('old class dropdown QA assertion not found')
qa = qa.replace(old, "assert.ok(html.includes('fillResearchScopeSelect'), 'R2 scoped class selector missing');\n", 1)
qa_path.write_text(qa)
