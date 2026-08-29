from pathlib import Path
p = Path('scripts/qa-responsive-vocabulary.ts')
text = p.read_text()
old = "assert.ok(feedback.includes('なぜ重要？'), 'key phrases must explain why they are reusable');"
new = "assert.equal(feedback.includes('重要キーフレーズ (Key Expressions)'), false, 'redundant Key Expressions display must stay removed');"
if old not in text:
    raise SystemExit('old key-phrase display assertion not found')
p.write_text(text.replace(old, new, 1))
print('Responsive feedback QA aligned with simplified report UI')
