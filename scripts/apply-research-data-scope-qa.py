from pathlib import Path

p = Path('scripts/qa-dashboard-data-sync.ts')
t = p.read_text()

def repl(old: str, new: str) -> None:
    global t
    if old not in t:
        raise SystemExit(f'QA pattern not found: {old[:140]!r}')
    t = t.replace(old, new, 1)

repl(
"""context.resetFilters();
assert.equal(element('start').value,'');
assert.equal(element('end').value,'');
assert.equal(element('classId').value,'all');
assert.equal(element('completeOnly').checked,false);
element('grade').value='all';
element('classId').value='pilotb';
const pilotParams = context.filterParams();
assert.equal(pilotParams.get('grade'), null, 'Pilot B must not be encoded as a grade');
assert.equal(pilotParams.get('classId'),'pilotb');
assert.ok(context.queryUrl('/api/management/research.dashboard').includes('classId=pilotb'));
""",
"""context.resetFilters();
assert.equal(element('start').value,'');
assert.equal(element('end').value,'');
assert.equal(element('dataScope').value,'main');
assert.equal(element('classId').value,'all');
assert.equal(element('completeOnly').checked,false);
element('grade').value='all';
element('dataScope').value='pilot_b';
element('classId').value='all';
const pilotParams = context.filterParams();
assert.equal(pilotParams.get('grade'), null, 'Pilot B must not be encoded as a grade');
assert.equal(pilotParams.get('classId'), null, 'Pilot B must not be encoded as a class');
assert.equal(pilotParams.get('dataScope'),'pilot_b');
assert.ok(context.queryUrl('/api/management/research.dashboard').includes('dataScope=pilot_b'));
"""
)

repl(
"""const gradeSelectHtml = pageSource.match(/<select id=\\\"grade\\\">([\\s\\S]*?)<\\/select>/)?.[1] || '';
const classSelectHtml = pageSource.match(/<select id=\\\"classId\\\">([\\s\\S]*?)<\\/select>/)?.[1] || '';
assert.equal(gradeSelectHtml.includes('value=\\\"pilotb\\\"'), false, 'Pilot B must not appear in the grade filter');
assert.ok(classSelectHtml.includes('<option value=\\\"pilotb\\\">Pilot B</option>'), 'Pilot B must appear in the class filter');
""",
"""const scopeSelectHtml = pageSource.match(/<select id=\\\"dataScope\\\">([\\s\\S]*?)<\\/select>/)?.[1] || '';
const gradeSelectHtml = pageSource.match(/<select id=\\\"grade\\\">([\\s\\S]*?)<\\/select>/)?.[1] || '';
const classSelectHtml = pageSource.match(/<select id=\\\"classId\\\">([\\s\\S]*?)<\\/select>/)?.[1] || '';
assert.ok(scopeSelectHtml.includes('<option value=\\\"pilot_b\\\">Pilot B</option>'), 'Pilot B must appear in the data-scope filter');
assert.ok(scopeSelectHtml.includes('<option value=\\\"main\\\" selected>本研究</option>'), 'main study must be the default data scope');
assert.equal(gradeSelectHtml.includes('テスト'), false, 'test must not appear in the grade filter');
assert.equal(gradeSelectHtml.includes('予備'), false, 'reserve must not appear in the grade filter');
assert.equal(classSelectHtml.includes('Pilot B'), false, 'Pilot B must not appear in the class filter');
assert.equal(classSelectHtml.includes('テスト'), false, 'test must not appear in the class filter');
assert.equal(classSelectHtml.includes('予備'), false, 'reserve must not appear in the class filter');
"""
)

repl(
"for (const id of ['start','end','grade','classId','personaId','labelCondition','topic','completeOnly']) assert.equal(typeof element(id).onchange,'function',`${id} must auto-refresh`);",
"for (const id of ['start','end','dataScope','grade','classId','personaId','labelCondition','topic','completeOnly']) assert.equal(typeof element(id).onchange,'function',`${id} must auto-refresh`);"
)

p.write_text(t)
print('Dashboard data-scope QA alignment applied')
