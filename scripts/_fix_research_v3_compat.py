from pathlib import Path

def repl(path, old, new):
    p=Path(path); text=p.read_text()
    if old not in text: raise SystemExit(f'pattern missing: {path}: {old}')
    p.write_text(text.replace(old,new,1))

repl('src/server/researchExport.ts',
"      child_turn_count: communication.totalTurns,\n      child_total_words: communication.totalChildWords,",
"      child_turn_count: communication.totalTurns,\n      child_total_words: communication.totalChildWords,\n      total_turns: communication.totalTurns,\n      total_child_words: communication.totalChildWords,")
repl('src/server/researchExport.ts',
"      encountered_curriculum_vocab_count: curriculum.all.size,\n      legacy_unique_vocabulary_count: session.uniqueVocabularyCount ?? '',",
"      encountered_curriculum_vocab_count: curriculum.all.size,\n      unique_vocabulary_count: curriculum.all.size,\n      legacy_unique_vocabulary_count: session.uniqueVocabularyCount ?? '',")
repl('src/server/persistence.ts',
"  const localDate = new Date(args.endedAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });",
"  const localDate = new Date(args.startedAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });")
repl('scripts/qa-research-integrated.ts',
"assert.equal(inClass.child_question_count, 1);",
"assert.equal(inClass.total_turns, inClass.child_turn_count);\nassert.equal(inClass.total_child_words, inClass.child_total_words);\nassert.equal(inClass.unique_vocabulary_count, inClass.encountered_curriculum_vocab_count);\nassert.equal(inClass.child_question_count, 1);")
print('compatibility fix applied')
