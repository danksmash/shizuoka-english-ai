from pathlib import Path

p=Path('src/server/researchExport.ts')
text=p.read_text()
old="""    const hasReflection = Boolean(session.reflection && typeof session.reflection === 'object');
    const hasSessionFinish = systemEvents.some((event: any) => event?.type === 'session_finish');
    const schemaVersion = Number(session.schemaVersion || 0);
    const legacyCompletionEvidence = Boolean(session.endedAt) && hasReflection && (systemEvents.length === 0 || schemaVersion < 3);
    const dialogueCompleted = hasSessionFinish || legacyCompletionEvidence;
"""
new="""    const hasReflection = Boolean(session.reflection && typeof session.reflection === 'object');
    const hasSessionFinish = systemEvents.some((event: any) => event?.type === 'session_finish');
    // Reflection is submitted only after the dialogue has ended, so it is valid completion evidence
    // for sessions saved before session_finish event logging was introduced.
    const dialogueCompleted = hasSessionFinish || hasReflection;
"""
if old not in text: raise SystemExit('research completion marker not found')
p.write_text(text.replace(old,new,1))

p=Path('scripts/qa-research-integrated.ts')
text=p.read_text()
marker="assert.equal(legacyComplete.session_completed,1,'legacy completed session must not be reclassified as interrupted');"
insert="""
const legacyWithEvents = buildResearchDataSets([{...clustered[0], schemaVersion:3, sessionId:'legacy_complete_with_events', reflection:{conveyedIdeas:3,understoodPartner:4,noticedLanguageCulture:3}, systemEvents:[{type:'session_start',timestamp:base},{type:'mic_start',timestamp:base+1000}]}]).sessions[0];
assert.equal(legacyWithEvents.data_quality_flag,'complete','reflection must prove dialogue completion even when older event logs lack session_finish');
assert.equal(legacyWithEvents.session_status,'complete');
assert.equal(legacyWithEvents.session_completed,1);
"""
if marker not in text: raise SystemExit('research QA legacy marker not found')
p.write_text(text.replace(marker,marker+insert,1))
print('Legacy completion fix applied')
