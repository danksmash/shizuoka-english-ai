from pathlib import Path

server=Path('server.ts')
s=server.read_text()
s=s.replace("return res.json({success:true,studentId:created.studentId,classId:created.classId});", "return res.json({success:true,studentId:created.studentId,teacherStudentId:created.teacherStudentId,classId:created.classId});")
server.write_text(s)

page=Path('src/server/managementPage.ts')
p=page.read_text()
old="$('codeMessage').textContent='発行しました: '+code+' / 児童ID '+String(d.studentId||'').replace(/[^A-Za-z0-9]/g,'').slice(0,4).toUpperCase();"
new="$('codeMessage').textContent='発行しました: '+code+' / 児童ID '+String(d.teacherStudentId||'----');"
assert old in p
page.write_text(p.replace(old,new))
print('teacher id response patched')
