from pathlib import Path
p=Path('src/components/FeedbackScreen.tsx')
s=p.read_text()
old="  totalTurns,\n  totalWords,\n  elapsedSeconds,\n"
if old not in s:
    raise SystemExit('unused feedback props marker not found')
s=s.replace(old,'',1)
p.write_text(s)
print('UNUSED FEEDBACK PROPS REMOVED')
