from pathlib import Path

# 1/2: learner report UI
p = Path('src/components/FeedbackScreen.tsx')
s = p.read_text()
s = s.replace("import { Award, BarChart3, BookOpen, CheckCircle2, Copy, MessageSquare, Printer, RotateCcw, Sparkles, TrendingUp, Volume2 } from 'lucide-react';", "import { Award, BarChart3, BookOpen, CheckCircle2, MessageSquare, RotateCcw, Sparkles, TrendingUp, Volume2 } from 'lucide-react';")
s = s.replace("import { safePlainTextForClipboard } from '../utils/privacy';\n", "")
s = s.replace("  const [copySuccess, setCopySuccess] = useState(false);\n", "")
start = s.find("  const handleCopyReport = () => {")
end = s.find("\n\n  return (", start)
if start < 0 or end < 0:
    raise SystemExit('copy report function marker not found')
s = s[:start] + s[end:]
copy_button = "            <button type=\"button\" onClick={handleCopyReport} className=\"flex min-h-11 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-xs font-black text-emerald-800\"><Copy className=\"h-4 w-4\" />{copySuccess ? 'コピーしました！' : 'コピー'}</button>\n"
print_button = "            <button type=\"button\" onClick={() => window.print()} className=\"flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700\"><Printer className=\"h-4 w-4\" />印刷</button>\n"
if copy_button not in s or print_button not in s:
    raise SystemExit('copy/print buttons marker not found')
s = s.replace(copy_button, '').replace(print_button, '')
# tighten the feedback two-column area, especially the space below Next Step.
s = s.replace('className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-12"', 'className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start"', 1)
s = s.replace('className="flex flex-col gap-6 lg:col-span-7"', 'className="flex flex-col gap-4 lg:col-span-7"', 1)
s = s.replace('className="flex flex-col gap-6 lg:col-span-5"', 'className="flex flex-col gap-4 lg:col-span-5"', 1)
s = s.replace('className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900"><MessageSquare', 'className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="mb-2 flex items-center gap-2 text-sm font-black text-slate-900"><MessageSquare', 1)
s = s.replace('className="space-y-2">{uniqueKeyPhrases.map', 'className="space-y-1.5">{uniqueKeyPhrases.map', 1)
s = s.replace('className="rounded-xl border border-blue-200 bg-blue-50/60 p-3"><div', 'className="rounded-xl border border-blue-200 bg-blue-50/60 p-2.5"><div', 1)
p.write_text(s)

# 3: wait for the full farewell voice before automatic transition.
p = Path('src/App.tsx')
s = p.read_text()
old = "    farewellTransitionRef.current=executeTransition; farewellSafetyTimerRef.current=setTimeout(executeTransition,4500);\n    speakStudentVoice(farewell.english,studentObj,speechRateRef.current,()=>{setIsSpeaking(true);setMood('happy');},()=>{setIsSpeaking(false);executeTransition();},()=>{setIsSpeaking(false);executeTransition();});"
new = "    farewellTransitionRef.current=executeTransition;\n    // Do not advance on a fixed timer: long farewell audio must finish before the reflection screen opens.\n    speakStudentVoice(farewell.english,studentObj,speechRateRef.current,()=>{setIsSpeaking(true);setMood('happy');},()=>{setIsSpeaking(false);executeTransition();},()=>{setIsSpeaking(false);executeTransition();});"
if old not in s:
    raise SystemExit('farewell transition marker not found')
s = s.replace(old, new, 1)
p.write_text(s)

# 4/5/6: management UI and graph behavior.
p = Path('src/server/managementPage.ts')
s = p.read_text()
# make toolbar adapt to four controls after removing redundant class-picks from T2
s = s.replace('.toolbar{display:grid;grid-template-columns:180px 180px 180px 1fr 220px;', '.toolbar{display:grid;grid-template-columns:180px 180px 180px 1fr;', 1)
old_t2 = '<section id="teacherDashboard" class="screen teacher"><div class="screen-title"><span class="step">T2</span>学級ダッシュボード</div><div class="card toolbar"><div><label>学級</label><select id="teacherClass"></select></div><div><label>期間開始</label><input id="teacherStart" type="date"></div><div><label>期間終了</label><input id="teacherEnd" type="date"></div><div><label>表示する学級</label><div id="teacherClassPicks" class="class-picks"></div></div><div><label>表示項目</label>'
new_t2 = '<section id="teacherDashboard" class="screen teacher"><div class="screen-title"><span class="step">T2</span>学級ダッシュボード</div><div class="card toolbar"><div><label>学級</label><select id="teacherClass"></select></div><div><label>期間開始</label><input id="teacherStart" type="date"></div><div><label>期間終了</label><input id="teacherEnd" type="date"></div><div><label>表示項目</label>'
if old_t2 not in s:
    raise SystemExit('teacher T2 class picks marker not found')
s = s.replace(old_t2, new_t2, 1)
old_r2 = '<div><label>表示する学級</label><div id="researchClassPicks" class="class-picks"></div></div>'
new_r2 = '<div><label>学級</label><select id="researchDashboardClass"></select></div>'
if old_r2 not in s:
    raise SystemExit('research R2 class picks marker not found')
s = s.replace(old_r2, new_r2, 1)
# T4 terminology and total-duration chart
s = s.replace('<div class="metric"><span>対話時間</span><b id="sumDuration">0分</b></div>', '<div class="metric"><span>総対話時間</span><b id="sumDuration">0分</b></div>', 1)
s = s.replace('<div><h2>ターン数の推移</h2><div id="sumTurnsChart" class="chart"></div></div>', '<div><h2>総対話時間の推移</h2><div id="sumDurationChart" class="chart"></div></div>', 1)
# fixed school class choices. Data can still be empty for a class, but every operational class remains selectable.
marker = "function uniqueClasses(source,key){var vals=Array.from(new Set(source.map(function(r){return String(r[key]||'').trim()}).filter(Boolean))).sort();return vals.length?vals:['5-1','5-2','6-1']}"
replacement = "var SCHOOL_CLASSES=['5-1','5-2','5-3','6-1','6-2','6-3','テスト','予備'];\nfunction uniqueClasses(source,key){var vals=Array.from(new Set(source.map(function(r){return String(r[key]||'').trim()}).filter(Boolean)));return SCHOOL_CLASSES.filter(function(c){return vals.indexOf(c)>=0}).concat(vals.filter(function(c){return SCHOOL_CLASSES.indexOf(c)<0}).sort())}\nfunction fillSchoolClassSelect(id,allLabel){fillSelect(id,SCHOOL_CLASSES,allLabel)}"
if marker not in s:
    raise SystemExit('uniqueClasses marker not found')
s = s.replace(marker, replacement, 1)
# make a one-point series visible too and keep individual sessions visible even on the same date.
old_chart_tail = "series.forEach(function(s,si){var pts=labels.map(function(k,idx){var p=s.points.find(function(x){return x.k===k});var x=l+(labels.length<=1?0:(w-l-r)*idx/(labels.length-1));var y=h-b-(h-t-b)*(p?n(p.v):0)/max;return x+','+y}).join(' ');html+='<polyline fill=\"none\" stroke=\"'+palette[si%palette.length]+'\" stroke-width=\"4\" points=\"'+pts+'\"/>';});labels.forEach"
new_chart_tail = "series.forEach(function(s,si){var pts=labels.map(function(k,idx){var p=s.points.find(function(x){return x.k===k});var x=l+(labels.length<=1?(w-l-r)/2:(w-l-r)*idx/(labels.length-1));var y=h-b-(h-t-b)*(p?n(p.v):0)/max;return x+','+y}).join(' ');html+='<polyline fill=\"none\" stroke=\"'+palette[si%palette.length]+'\" stroke-width=\"4\" points=\"'+pts+'\"/>';labels.forEach(function(k,idx){var p=s.points.find(function(x){return x.k===k});if(!p)return;var x=l+(labels.length<=1?(w-l-r)/2:(w-l-r)*idx/(labels.length-1));var y=h-b-(h-t-b)*n(p.v)/max;html+='<circle cx=\"'+x+'\" cy=\"'+y+'\" r=\"5\" fill=\"'+palette[si%palette.length]+'\"/>';});});labels.forEach"
if old_chart_tail not in s:
    raise SystemExit('drawChart series marker not found')
s = s.replace(old_chart_tail, new_chart_tail, 1)
old_update_teacher = "var classes=picked('teacherClassPicks');if(!classes.length)classes=uniqueClasses(teacherSessions,'classId');var metric=$('teacherMetric').value;"
new_update_teacher = "var classes=c==='all'?SCHOOL_CLASSES.slice():[c];var metric=$('teacherMetric').value;"
if old_update_teacher not in s:
    raise SystemExit('teacher chart class marker not found')
s = s.replace(old_update_teacher, new_update_teacher, 1)
# all-period must use this child's actual complete history, not the T3 list filter.
old_open = "function openStudent(tid){currentTeacherStudent=tid;var rec=studentRecords.find(function(r){return r.teacherStudentId===tid});if(!rec)return;setText('summaryCrumb',tid);setText('studentSummaryTitle',tid+'の学習状況');$('summaryStart').value=$('listStart').value;$('summaryEnd').value=$('listEnd').value;show('studentSummary');updateStudentSummary()}\nfunction studentFiltered(){var rec=studentRecords.find(function(r){return r.teacherStudentId===currentTeacherStudent});if(!rec)return[];return teacherSessions.filter(function(r){return r.studentId===rec.studentId&&within(r,$('summaryStart').value,$('summaryEnd').value)}).sort(function(a,b){return dateOf(a).localeCompare(dateOf(b))})}"
new_open = "function studentAllRows(){var rec=studentRecords.find(function(r){return r.teacherStudentId===currentTeacherStudent});if(!rec)return[];return teacherSessions.filter(function(r){return r.studentId===rec.studentId}).sort(function(a,b){return dateOf(a).localeCompare(dateOf(b))})}\nfunction setSummaryQuick(mode){var all=studentAllRows(),b=dateBounds(all);if(!b.max)return;if(mode==='all'){$('summaryStart').value=b.min;$('summaryEnd').value=b.max}else{var d=new Date(b.max+'T00:00:00');d.setMonth(d.getMonth()-(mode==='1m'?1:3));$('summaryStart').value=d.toISOString().slice(0,10);$('summaryEnd').value=b.max}['summary1m','summary3m','summaryAll'].forEach(function(id){$(id).classList.remove('active')});$(mode==='all'?'summaryAll':mode==='1m'?'summary1m':'summary3m').classList.add('active');updateStudentSummary()}\nfunction openStudent(tid){currentTeacherStudent=tid;var rec=studentRecords.find(function(r){return r.teacherStudentId===tid});if(!rec)return;setText('summaryCrumb',tid);setText('studentSummaryTitle',tid+'の学習状況');show('studentSummary');setSummaryQuick('all')}\nfunction studentFiltered(){return studentAllRows().filter(function(r){return within(r,$('summaryStart').value,$('summaryEnd').value)})}"
if old_open not in s:
    raise SystemExit('openStudent/period marker not found')
s = s.replace(old_open, new_open, 1)
old_summary_charts = "drawChart('sumTurnsChart',[{name:'ターン',points:rows.map(function(r){return{k:dateOf(r),v:n(r.totalTurns)}})}]);drawChart('sumWordsChart',[{name:'語数',points:rows.map(function(r){return{k:dateOf(r),v:n(r.totalChildWords)}})}]);"
new_summary_charts = "drawChart('sumDurationChart',[{name:'総対話時間',points:rows.map(function(r,i){return{k:dateOf(r)+'-'+String(i+1).padStart(2,'0'),v:n(r.actualDurationSeconds)}})}]);drawChart('sumWordsChart',[{name:'語数',points:rows.map(function(r,i){return{k:dateOf(r)+'-'+String(i+1).padStart(2,'0'),v:n(r.totalChildWords)}})}]);"
if old_summary_charts not in s:
    raise SystemExit('student chart marker not found')
s = s.replace(old_summary_charts, new_summary_charts, 1)
old_research_dash = "var classes=picked('researchClassPicks');if(!classes.length)classes=uniqueClasses(researchData,'class_id');var metric=$('researchMetric').value;"
new_research_dash = "var selectedClass=$('researchDashboardClass').value;rows=researchFiltered(s,e,selectedClass);var classes=[selectedClass];var metric=$('researchMetric').value;"
if old_research_dash not in s:
    raise SystemExit('research dashboard class marker not found')
s = s.replace(old_research_dash, new_research_dash, 1)
# fixed selects for both teacher and researcher dashboard; remove obsolete checkbox builders.
old_load_teacher = "var classes=uniqueClasses(studentRecords,'classId');['teacherClass','listClass'].forEach(function(id){fillSelect(id,classes,'すべて')});fillSelect('newClass',classes,'');buildPicks('teacherClassPicks',classes,updateTeacherDashboard);"
new_load_teacher = "var classes=uniqueClasses(studentRecords,'classId');fillSchoolClassSelect('teacherClass','すべて');fillSchoolClassSelect('listClass','すべて');fillSchoolClassSelect('newClass','');"
if old_load_teacher not in s:
    raise SystemExit('loadTeacher class marker not found')
s = s.replace(old_load_teacher, new_load_teacher, 1)
old_load_research = "var classes=uniqueClasses(researchData,'class_id');fillSelect('researchClass',classes,'すべて');fillSelect('r6Class',classes,'すべて');buildPicks('researchClassPicks',classes,updateResearchDashboard);"
new_load_research = "var classes=uniqueClasses(researchData,'class_id');fillSchoolClassSelect('researchDashboardClass',null);if(classes.length&&SCHOOL_CLASSES.indexOf(classes[0])>=0)$('researchDashboardClass').value=classes[0];fillSchoolClassSelect('researchClass','すべて');fillSchoolClassSelect('r6Class','すべて');"
if old_load_research not in s:
    raise SystemExit('loadResearch class marker not found')
s = s.replace(old_load_research, new_load_research, 1)
# research dashboard class selector participates in live redraw
s = s.replace("['researchStart','researchEnd','researchMetric'].forEach", "['researchStart','researchEnd','researchDashboardClass','researchMetric'].forEach", 1)
# quick period handlers use one canonical implementation and update active state.
old_quick = "$('summaryAll').addEventListener('click',function(){$('summaryStart').value=$('listStart').value;$('summaryEnd').value=$('listEnd').value;updateStudentSummary()});$('summary1m').addEventListener('click',function(){var e=$('summaryEnd').value||dateBounds(teacherSessions).max;if(e){var d=new Date(e+'T00:00:00');d.setMonth(d.getMonth()-1);$('summaryStart').value=d.toISOString().slice(0,10);updateStudentSummary()}});$('summary3m').addEventListener('click',function(){var e=$('summaryEnd').value||dateBounds(teacherSessions).max;if(e){var d=new Date(e+'T00:00:00');d.setMonth(d.getMonth()-3);$('summaryStart').value=d.toISOString().slice(0,10);updateStudentSummary()}});"
new_quick = "$('summaryAll').addEventListener('click',function(){setSummaryQuick('all')});$('summary1m').addEventListener('click',function(){setSummaryQuick('1m')});$('summary3m').addEventListener('click',function(){setSummaryQuick('3m')});"
if old_quick not in s:
    raise SystemExit('quick period handlers marker not found')
s = s.replace(old_quick, new_quick, 1)
p.write_text(s)

# Strengthen functional QA around the reported regressions.
p = Path('scripts/qa-management-page.ts')
q = p.read_text()
q = q.replace("'summaryStart','summaryEnd','sumTurnsChart','sumWordsChart'", "'summaryStart','summaryEnd','sumDurationChart','sumWordsChart'")
q = q.replace("'researchStart','researchEnd','researchMetric'", "'researchStart','researchEnd','researchDashboardClass','researchMetric'")
extra = "\nassert.ok(!html.includes('id=\"teacherClassPicks\"'), 'T2 redundant display-class selector must be removed');\nassert.ok(!html.includes('id=\"researchClassPicks\"'), 'R2 must use a single class dropdown');\nfor (const cls of ['5-1','5-2','5-3','6-1','6-2','6-3','テスト','予備']) assert.ok(html.includes(cls), `Class option missing: ${cls}`);\nassert.ok(html.includes('総対話時間'));\nassert.ok(html.includes(\"setSummaryQuick('all')\"));\nassert.ok(html.includes(\"actualDurationSeconds\"));\n"
anchor = "console.log('Learner + teacher + researcher functional UI contract QA: PASS');"
if anchor not in q:
    raise SystemExit('management QA anchor not found')
q = q.replace(anchor, extra + "\n" + anchor)
p.write_text(q)

# Add learner-specific regression checks to management QA.
p = Path('scripts/qa-management-page.ts')
q = p.read_text()
anchor = "const feedbackSource = await readFile('src/components/FeedbackScreen.tsx', 'utf8');"
if anchor not in q:
    raise SystemExit('feedback QA anchor missing')
q = q.replace(anchor, anchor + "\nassert.ok(!feedbackSource.includes('handleCopyReport'), 'Feedback report copy action must be removed');\nassert.ok(!feedbackSource.includes('window.print()'), 'Feedback report print action must be removed');")
app_anchor = "const appSource = await readFile('src/App.tsx', 'utf8');"
q = q.replace(app_anchor, app_anchor + "\nassert.ok(!appSource.includes('setTimeout(executeTransition,4500)'), 'Farewell must not auto-advance before audio finishes');")
p.write_text(q)

print('UI fixes applied')
