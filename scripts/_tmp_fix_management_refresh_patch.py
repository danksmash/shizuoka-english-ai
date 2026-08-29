from pathlib import Path
p=Path('scripts/_tmp_apply_management_refresh.py')
s=p.read_text()
s=s.replace('new="async function loadTeacher(options){var preserve=', 'new="async function loadTeacher(){var options=arguments[0],preserve=')
s=s.replace('new="async function loadResearch(options){var preserve=', 'new="async function loadResearch(){var options=arguments[0],preserve=')
p.write_text(s)
print('management refresh patch signatures corrected')
