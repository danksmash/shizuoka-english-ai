from pathlib import Path

p = Path('src/components/SetupScreen.tsx')
text = p.read_text()
text = text.replace("import { CheckCircle2, KeyRound, MessageCircle, Play, Volume2 } from 'lucide-react';", "import { CheckCircle2, KeyRound, MessageCircle, Play } from 'lucide-react';")
text = text.replace("import { AI_STUDENTS_LIST, DIALOGUE_TOPICS } from '../data/curriculum';", "import { AI_STUDENTS_MASTER_LIST, DIALOGUE_TOPICS, TARGET_20_AI_STUDENT_IDS } from '../data/curriculum';")
text = text.replace("import { speakStudentVoice, stopSpeaking } from '../utils/speech';", "import { stopSpeaking } from '../utils/speech';")
anchor = "const countryLabel = (student: AIStudentProfile) =>\n  student.countryNative ? `${student.country} (${student.countryNative})` : student.country;\n"
insert = anchor + "\nconst TARGET_STUDENTS = TARGET_20_AI_STUDENT_IDS\n  .map((id) => AI_STUDENTS_MASTER_LIST.find((student) => student.id === id))\n  .filter((student): student is AIStudentProfile => Boolean(student));\n"
if anchor not in text: raise SystemExit('countryLabel anchor missing')
text = text.replace(anchor, insert, 1)
old_state = """  const [checkingCode, setCheckingCode] = useState(false);
  const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null);
  const selectedStudent = AI_STUDENTS_LIST.find((s) => s.id === selectedStudentId) || AI_STUDENTS_LIST[0];

  const playPreview = (student: AIStudentProfile, event: React.MouseEvent) => {
    event.stopPropagation();
    stopSpeaking();
    setPreviewPlayingId(student.id);
    speakStudentVoice(student.characterMessage, student, 0.9, undefined, () => setPreviewPlayingId(null), () => setPreviewPlayingId(null));
  };
"""
new_state = """  const [checkingCode, setCheckingCode] = useState(false);
  const selectedStudent = TARGET_STUDENTS.find((student) => student.id === selectedStudentId) || TARGET_STUDENTS[0];
"""
if old_state not in text: raise SystemExit('preview state anchor missing')
text = text.replace(old_state, new_state, 1)
start = text.index('            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">')
end_marker = '            </div>\n          </section>\n\n          <section className="setup-controls'
end = text.index(end_marker, start)
new_block = '''            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-black"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs text-white">1</span>会話するAI留学生をえらぼう（全20名）</h2>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{showLabels ? `${selectedStudent.flag} ${selectedStudent.countryJapanese} 選択中` : `${selectedStudent.name} 選択中`}</span>
            </div>
            <div className="setup-student-grid grid flex-1 auto-rows-fr grid-cols-1 gap-2 min-[520px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {TARGET_STUDENTS.map((student) => {
                const selected = student.id === selectedStudentId;
                return <article
                  key={student.id}
                  onClick={() => setSelectedStudentId(student.id)}
                  className={`setup-student-card-compact relative flex min-h-[88px] cursor-pointer flex-col justify-center rounded-xl border-2 bg-white px-3 py-2 shadow-sm transition ${selected ? 'border-blue-600 ring-2 ring-blue-200' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'}`}
                  aria-label={`${student.countryJapanese} ${student.name} ${student.age}歳 ${student.city}`}
                >
                  {selected && <CheckCircle2 className="absolute right-2 top-2 h-4 w-4 fill-blue-600 text-white" />}
                  <p className="setup-student-country pr-6 text-[11px] font-black leading-tight text-slate-800">{showLabels ? `${student.flag} ${student.country}` : 'AI留学生'}</p>
                  <h3 className="setup-student-name mt-1 text-[13px] font-black leading-tight text-slate-950">{student.name}</h3>
                  <p className="setup-student-origin mt-1 text-[10px] font-semibold leading-tight text-slate-600">{student.age}歳{showLabels ? ` · ${student.city}` : ''}</p>
                </article>;
              })}
'''
text = text[:start] + new_block + text[end:]
p.write_text(text)

# Update the responsive QA contract: the old portrait-card markers are still
# tested when that layout is used, while the new compact selector deliberately
# exposes only country/name/age/hometown on the left.
rp = Path('scripts/qa-responsive-vocabulary.ts')
rtext = rp.read_text()
old = """for (const marker of ['setup-student-country', 'setup-student-info-grid', 'setup-student-avatar', 'setup-student-copy', 'setup-student-name', 'setup-student-japanese', 'setup-student-origin', 'setup-student-accent']) {
  assert.ok(setup.includes(marker), `AI student cards must expose ${marker}`);
}
"""
new = """if (setup.includes('setup-student-card-compact')) {
  for (const marker of ['setup-student-country', 'setup-student-name', 'setup-student-origin']) {
    assert.ok(setup.includes(marker), `Compact AI student cards must expose ${marker}`);
  }
  assert.equal(setup.includes('setup-student-info-grid'), false, 'compact selector must not use the old portrait information grid');
} else {
  for (const marker of ['setup-student-country', 'setup-student-info-grid', 'setup-student-avatar', 'setup-student-copy', 'setup-student-name', 'setup-student-japanese', 'setup-student-origin', 'setup-student-accent']) {
    assert.ok(setup.includes(marker), `AI student cards must expose ${marker}`);
  }
}
"""
if old not in rtext: raise SystemExit('responsive QA marker block missing')
rp.write_text(rtext.replace(old, new, 1))

# Add focused QA for the compact 20-person selector.
q = Path('scripts/qa-20-persona-setup.ts')
q.write_text(r'''import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AI_STUDENTS_MASTER_LIST, TARGET_20_AI_STUDENT_IDS } from '../src/data/curriculum';

const setup = fs.readFileSync('src/components/SetupScreen.tsx', 'utf8');
assert.ok(setup.includes('会話するAI留学生をえらぼう（全20名）'), 'setup heading must show 20 personas');
assert.ok(setup.includes('TARGET_20_AI_STUDENT_IDS'), 'setup must derive visible personas from the research target IDs');
assert.ok(setup.includes('setup-student-card-compact'), 'setup must use compact persona cards');
assert.equal(setup.includes('声を聞く'), false, 'compact left cards must not contain the old voice-preview control');
assert.equal(setup.includes('setup-student-avatar h-[72px]'), false, 'compact left cards must not show portraits');
assert.ok(setup.includes('student.flag') && setup.includes('student.country') && setup.includes('student.name') && setup.includes('student.age') && setup.includes('student.city'), 'compact cards must expose flag/country/name/age/hometown');
assert.equal(TARGET_20_AI_STUDENT_IDS.length, 20);
for (const id of TARGET_20_AI_STUDENT_IDS) assert.ok(AI_STUDENTS_MASTER_LIST.some((p) => p.id === id), `missing target persona ${id}`);
console.log('20-person setup selector QA: PASS');
''')

package = Path('package.json')
pkg = package.read_text()
pkg = pkg.replace('"qa:persona-master": "tsx scripts/qa-persona-master.ts",', '"qa:persona-master": "tsx scripts/qa-persona-master.ts",\n    "qa:20-persona-setup": "tsx scripts/qa-20-persona-setup.ts",')
pkg = pkg.replace('npm run qa:persona-master && npm run lint', 'npm run qa:persona-master && npm run qa:20-persona-setup && npm run lint')
package.write_text(pkg)
print('20-person compact setup UI patch applied')
