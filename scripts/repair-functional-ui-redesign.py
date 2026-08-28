from pathlib import Path
import ast
import re

# Reuse the already-staged management-page payload from the previous patch file,
# but parse only that single literal so unrelated quoting cannot affect execution.
staged = Path('scripts/apply-functional-ui-redesign.py').read_text(encoding='utf-8')
start = "    'src/server/managementPage.ts': "
end = ",\n    'scripts/qa-management-page.ts':"
if start not in staged or end not in staged:
    raise SystemExit('staged management payload markers not found')
literal = staged.split(start, 1)[1].split(end, 1)[0]
management = ast.literal_eval(literal)
Path('src/server/managementPage.ts').write_text(management, encoding='utf-8')

# Learner flow: reflection autosave -> AI report; history returns to the report.
app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')
old_reflection = "onOpenHistory={learningDataEnabled && learningCode ? handleOpenHistory : undefined} onRestart={handleRestart}/> }".replace('/> }','/>}')
new_reflection = "onOpenHistory={learningDataEnabled && learningCode ? handleOpenHistory : undefined}/> }".replace('/> }','/>}')
if old_reflection not in app:
    raise SystemExit('App reflection render marker not found')
app = app.replace(old_reflection, new_reflection, 1)
old_end = "    setIsSavingReflection(false);\n  };\n\n  const handleOpenHistory"
new_end = "    setIsSavingReflection(false);\n    setPhase('feedback');\n  };\n\n  const handleOpenHistory"
if old_end not in app:
    raise SystemExit('Reflection completion marker not found')
app = app.replace(old_end, new_end, 1)
old_history = "onBack={()=>setPhase('reflection')}"
if old_history not in app:
    raise SystemExit('History back marker not found')
app = app.replace(old_history, "onBack={()=>setPhase('feedback')}", 1)
app_path.write_text(app, encoding='utf-8')

# AI report: remove metrics duplicated from the reflection page, move the student
# message to the top, and deliberately leave the original transcript component intact.
feedback_path = Path('src/components/FeedbackScreen.tsx')
feedback = feedback_path.read_text(encoding='utf-8')
metrics = re.compile(r"\n\s*\{/\* Metrics Row \(Bento Grid\) \*/\}.*?\n\s*\{/\* Main Feedback Sections \*/\}", re.S)
if not metrics.search(feedback):
    raise SystemExit('Feedback metrics block marker not found')
message = r'''

      {/* Exchange Student Message */}
      <div className="bg-blue-50/80 rounded-3xl p-5 sm:p-6 border border-blue-200 shadow-sm mb-6 flex flex-col sm:flex-row items-start gap-4">
        <div className="w-16 h-16 rounded-2xl overflow-hidden border border-blue-300 flex-shrink-0 bg-white">
          <StudentAvatar student={aiStudent} size="md" className="w-16 h-16" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-black text-blue-900 flex items-center gap-2 mb-1">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            <span>留学生からのメッセージ</span>
          </h2>
          <p className="text-xs font-black text-blue-700 mb-2">{aiStudent.name}（{aiStudent.countryJapanese}）</p>
          <p className="text-sm sm:text-base text-slate-800 leading-relaxed font-semibold">
            {feedback?.studentMessage || feedback?.overallComment || `今日は話してくれてありがとう！またいっしょに英語で話そうね。`}
          </p>
        </div>
      </div>

      {/* Main Feedback Sections */}'''
feedback = metrics.sub(message, feedback, count=1)
old_message_class = 'className="bg-blue-50/80 rounded-3xl p-5 border border-blue-200 shadow-sm flex items-start gap-4"'
if old_message_class in feedback:
    feedback = feedback.replace(old_message_class, 'className="hidden"', 1)
feedback_path.write_text(feedback, encoding='utf-8')

print('Functional UI repair applied')
