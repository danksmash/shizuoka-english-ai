from pathlib import Path
p=Path('scripts/stage3b_apply.py')
t=p.read_text()
old='rep(\'src/components/SetupScreen.tsx\', "<span>えいご対話をはじめる</span>", "<span>{checkingCode ? \'学習コードを確認中…\' : \'えいご対話をはじめる\'}</span>")'
new='rep(\'src/components/SetupScreen.tsx\', "<span>対話をスタートする！ (Start)</span>", "<span>{checkingCode ? \'学習コードを確認中…\' : \'対話をスタートする！ (Start)\'}</span>")'
if old not in t: raise SystemExit('stage3b span patch marker missing')
p.write_text(t.replace(old,new,1))
