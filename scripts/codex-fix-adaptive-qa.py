from pathlib import Path

path = Path('scripts/qa-management-page.ts')
text = path.read_text()
old = "for (const marker of ['setup-screen','setup-shell','setup-main','setup-student-grid','setup-controls','items-stretch','flex-1 auto-rows-fr','mt-auto flex min-h-12 w-full']) assert.ok(setupSource.includes(marker), `Responsive Setup marker missing: ${marker}`);"
new = "for (const marker of ['setup-screen','setup-shell','setup-main','setup-student-grid','setup-controls','items-stretch','flex-1 auto-rows-fr','setup-start flex min-h-12 w-full']) assert.ok(setupSource.includes(marker), `Responsive Setup marker missing: ${marker}`);\nassert.ok(!setupSource.includes('setup-start mt-auto'), 'Start button must not create an artificial vertical spacer');"
if old not in text:
    raise SystemExit('old responsive setup QA marker not found')
path.write_text(text.replace(old, new, 1))
print('Adaptive setup management QA aligned.')
