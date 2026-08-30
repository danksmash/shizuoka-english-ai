from pathlib import Path

p=Path('src/server/managementPage.ts')
s=p.read_text(encoding='utf-8')
changes=[
(".card{background:#fff;border:1px solid #d7e2f1;border-radius:14px;padding:14px;box-shadow:0 4px 14px rgba(32,73,128,.05)}",".card{min-width:0;max-width:100%;background:#fff;border:1px solid #d7e2f1;border-radius:14px;padding:14px;box-shadow:0 4px 14px rgba(32,73,128,.05)}"),
(".table-wrap{overflow:auto}",".table-wrap{overflow:auto;max-width:100%;min-width:0}"),
(".lower{display:grid;grid-template-columns:.85fr 1fr 1.8fr;gap:10px;margin-top:10px}",".lower{display:grid;grid-template-columns:.85fr 1fr 1.8fr;gap:10px;margin-top:10px}.lower>*{min-width:0}"),
]
for old,new in changes:
    if old not in s: raise SystemExit('mobile overflow CSS anchor not found: '+old)
    s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
print('researcher narrow-layout min-width fix applied')
