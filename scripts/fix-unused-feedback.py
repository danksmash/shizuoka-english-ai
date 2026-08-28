from pathlib import Path
p=Path('src/components/FeedbackScreen.tsx')
s=p.read_text()
for line in ["  totalTurns,\n","  totalWords,\n","  elapsedSeconds,\n"]:
    s=s.replace(line,'',1)
start=s.find("  const formatTime = (secs: number) =>")
if start>=0:
    end=s.find("\n",start)
    s=s[:start]+s[end+1:]
p.write_text(s)
