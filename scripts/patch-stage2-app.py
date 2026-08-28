from pathlib import Path
p=Path('src/App.tsx')
s=p.read_text()
s=s.replace("    setIsSavingReflection(false); setPhase('feedback');", "    setIsSavingReflection(false);")
old="{phase==='reflection'&&<ReflectionScreen aiStudent={currentAiStudent} onSubmit={handleSubmitReflection} isSaving={isSavingReflection} saveMessage={reflectionSaveMessage}/>}"
new="{phase==='reflection'&&<ReflectionScreen aiStudent={currentAiStudent} profile={profile} learningCode={learningCode} totalTurns={turnCount} totalWords={totalChildWords} elapsedSeconds={elapsedSeconds} vocabCount={encounteredVocabList.length} onSubmit={handleSubmitReflection} isSaving={isSavingReflection} saveMessage={reflectionSaveMessage} onOpenHistory={learningDataEnabled && learningCode ? handleOpenHistory : undefined} onRestart={handleRestart}/>}"
assert old in s
s=s.replace(old,new)
s=s.replace("{phase==='history'&&<LearningHistoryScreen rows={historyRows} loading={historyLoading} error={historyError} onBack={()=>setPhase('feedback')}/>} ", "{phase==='history'&&<LearningHistoryScreen rows={historyRows} loading={historyLoading} error={historyError} onBack={()=>setPhase('reflection')}/>} ")
p.write_text(s)
print('stage2 app patch applied')
