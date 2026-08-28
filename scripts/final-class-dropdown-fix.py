from pathlib import Path
p=Path('src/server/managementPage.ts')
s=p.read_text()
old="function fillSchoolClassSelect(id,allLabel){fillSelect(id,SCHOOL_CLASSES,allLabel)}"
new="function fillSchoolClassSelect(id,allLabel){var e=$(id);if(!e)return;var old=e.value;if(allLabel===null){e.innerHTML=SCHOOL_CLASSES.map(function(v){return '<option value=\\\"'+esc(v)+'\\\">'+esc(v)+'</option>'}).join('')}else{fillSelect(id,SCHOOL_CLASSES,allLabel);return}if(Array.from(e.options||[]).some(function(o){return o.value===old}))e.value=old}"
if old not in s: raise SystemExit('fillSchoolClassSelect marker not found')
s=s.replace(old,new,1)
# center x-axis label for a single data point as well
old2="var x=l+(labels.length<=1?0:(w-l-r)*idx/(labels.length-1));html+='<text"
new2="var x=l+(labels.length<=1?(w-l-r)/2:(w-l-r)*idx/(labels.length-1));html+='<text"
if old2 not in s: raise SystemExit('single label x marker not found')
s=s.replace(old2,new2,1)
p.write_text(s)

q=Path('scripts/qa-management-page.ts')
t=q.read_text()
anchor="for (const cls of ['5-1','5-2','5-3','6-1','6-2','6-3','テスト','予備']) assert.ok(html.includes(cls), `Class option missing: ${cls}`);\n"
if anchor not in t: raise SystemExit('QA class anchor not found')
t=t.replace(anchor,anchor+"assert.ok(html.includes('allLabel===null'), 'R2/T2 exact fixed-class dropdown behavior missing');\n",1)
q.write_text(t)
print('FINAL CLASS DROPDOWN FIX APPLIED')
