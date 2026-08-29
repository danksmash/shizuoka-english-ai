from pathlib import Path

p=Path('src/server/researchExport.ts')
t=p.read_text()
old="""    const systemEvents = Array.isArray(session.systemEvents) ? session.systemEvents : [];
    const hasReflection = Boolean(session.reflection && typeof session.reflection === 'object');
    const dataQuality = !sessionId || !session.researchId || history.length === 0 || childMessages.length === 0 || !session.endedAt
      ? 'missing_core'
      : !hasReflection ? 'missing_reflection' : 'complete';
"""
new="""    const systemEvents = Array.isArray(session.systemEvents) ? session.systemEvents : [];
    const hasReflection = Boolean(session.reflection && typeof session.reflection === 'object');
    const hasSessionFinish = systemEvents.some((event: any) => event?.type === 'session_finish');
    const dataQuality = !sessionId || !session.researchId || history.length === 0 || childMessages.length === 0
      ? 'missing_core'
      : !hasSessionFinish ? 'interrupted'
      : !hasReflection ? 'missing_reflection' : 'complete';
    const sessionStatus = hasSessionFinish ? (hasReflection ? 'complete' : 'dialogue_complete') : 'in_progress_or_interrupted';
"""
if old not in t: raise SystemExit('research data-quality block not found')
t=t.replace(old,new,1)
t=t.replace("      session_completed: childMessages.length > 0 && session.endedAt ? 1 : 0,\n      data_quality_flag: dataQuality,", "      session_completed: hasSessionFinish ? 1 : 0,\n      session_status: sessionStatus,\n      data_quality_flag: dataQuality,",1)
p.write_text(t)

q=Path('scripts/qa-research-integrated.ts')
s=q.read_text()
old="""    { type: 'vocab_bank_open', timestamp: base + index * 15_000 + 40_000, value: 'bank' },
  ],
}));
"""
new="""    { type: 'vocab_bank_open', timestamp: base + index * 15_000 + 40_000, value: 'bank' },
    { type: 'session_finish', timestamp: base + index * 15_000 + 179_000 },
  ],
}));
"""
if old not in s: raise SystemExit('fixture systemEvents block not found')
s=s.replace(old,new,1)
needle="""assert.equal(eveningRow.data_quality_flag, 'missing_reflection');
const weekendRow = data.sessions.find((row) => row.session_id === 'session_weekend')!;
"""
insert="""assert.equal(eveningRow.data_quality_flag, 'missing_reflection');
assert.equal(eveningRow.session_status, 'dialogue_complete');
const interruptedData = buildResearchDataSets([{...clustered[0], sessionId:'session_interrupted', reflection:null, systemEvents:[
  { type:'session_start', timestamp:base },
  { type:'mic_start', timestamp:base+20_000 },
]}]);
assert.equal(interruptedData.sessions[0].data_quality_flag, 'interrupted', 'checkpoint without session_finish must be distinguishable from reflection missing');
assert.equal(interruptedData.sessions[0].session_status, 'in_progress_or_interrupted');
assert.equal(interruptedData.sessions[0].session_completed, 0);
const weekendRow = data.sessions.find((row) => row.session_id === 'session_weekend')!;
"""
if needle not in s: raise SystemExit('QA interrupted insertion point missing')
s=s.replace(needle,insert,1)
q.write_text(s)
