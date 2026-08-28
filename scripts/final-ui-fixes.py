from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'marker not found: {label}')
    return text.replace(old, new, 1)

# 1,2: learner report cleanup and spacing
p = Path('src/components/FeedbackScreen.tsx')
s = p.read_text()
s = s.replace('Copy, ', '').replace('Printer, ', '')
s = s.replace("import { safePlainTextForClipboard } from '../utils/privacy';\n", '')
s = s.replace("  const [copySuccess, setCopySuccess] = useState(false);\n", '')
s = s.replace("  const formatTime = (secs: number) => `${Math.floor(secs / 60)}分${String(secs % 60).padStart(2, '0')}秒`;\n\n", '')
start = s.find('  const handleCopyReport = () => {')
end = s.find('\n\n  return (', start)
if start < 0 or end < 0:
    raise SystemExit('copy handler block not found')
s = s[:start] + s[end:]
import re
s, n1 = re.subn(r'\n\s*<button type="button" onClick=\{handleCopyReport\}[^\n]*</button>', '', s, count=1)
s, n2 = re.subn(r'\n\s*<button type="button" onClick=\{\(\) => window\.print\(\)\}[^\n]*</button>', '', s, count=1)
if n1 != 1 or n2 != 1:
    raise SystemExit(f'report action buttons not found: copy={n1} print={n2}')
s = replace_once(
    s,
    '                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">\n                  <h2 className="mb-4 flex items-center gap-2 text-base font-black text-amber-900">',
    '                <section className="flex-1 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">\n                  <h2 className="mb-4 flex items-center gap-2 text-base font-black text-amber-900">',
    'next-step balance',
)
p.write_text(s)

# 3: never auto-advance before farewell audio completion
p = Path('src/App.tsx')
s = p.read_text()
s = replace_once(
    s,
    "    farewellTransitionRef.current=executeTransition; farewellSafetyTimerRef.current=setTimeout(executeTransition,4500);",
    "    farewellTransitionRef.current=executeTransition;",
    'farewell auto transition timer',
)
p.write_text(s)

# 4,5,6: teacher/research dashboards and longitudinal summary
p = Path('src/server/managementPage.ts')
s = p.read_text()

s = replace_once(
    s,
    '<section id="teacherDashboard" class="screen teacher"><div class="screen-title"><span class="step">T2</span>学級ダッシュボード</div><div class="card toolbar"><div><label>学級</label><select id="teacherClass"></select></div><div><label>期間開始</label><input id="teacherStart" type="date"></div><div><label>期間終了</label><input id="teacherEnd" type="date"></div><div><label>表示する学級</label><div id="teacherClassPicks" class="class-picks"></div></div><div><label>表示項目</label>',
    '<section id="teacherDashboard" class="screen teacher"><div class="screen-title"><span class="step">T2</span>学級ダッシュボード</div><div class="card toolbar" style="grid-template-columns:180px 180px 180px 1fr"><div><label>学級</label><select id="teacherClass"></select></div><div><label>期間開始</label><input id="teacherStart" type="date"></div><div><label>期間終了</label><input id="teacherEnd" type="date"></div><div><label>表示項目</label>',
    'teacher display class removal',
)

s = replace_once(
    s,
    '<div><label>表示する学級</label><div id="researchClassPicks" class="class-picks"></div></div><div><label>表示項目</label>',
    '<div><label>学級</label><select id="researchDashboardClass"></select></div><div><label>表示項目</label>',
    'research dashboard class dropdown',
)

s = replace_once(
    s,
    '<div class="metrics"><div class="metric"><span>セッション</span><b id="sumSessions">0</b></div><div class="metric"><span>対話時間</span><b id="sumDuration">0分</b></div><div class="metric"><span>平均ターン</span><b id="sumTurns">0</b></div><div class="metric"><span>平均発話語数</span><b id="sumWords">0</b></div></div><div class="grid2"><div><h2>ターン数の推移</h2><div id="sumTurnsChart" class="chart"></div></div><div><h2>発話語数の推移</h2><div id="sumWordsChart" class="chart"></div></div></div>',
    '<div class="metrics"><div class="metric"><span>セッション</span><b id="sumSessions">0</b></div><div class="metric"><span>総対話時間</span><b id="sumDuration">0分</b></div><div class="metric"><span>平均ターン</span><b id="sumTurns">0</b></div><div class="metric"><span>平均発話語数</span><b id="sumWords">0</b></div></div><div class="grid2"><div><h2>総対話時間の推移（分）</h2><div id="sumDurationChart" class="chart"></div></div><div><h2>発話語数の推移</h2><div id="sumWordsChart" class="chart"></div></div></div>',
    'student summary duration chart',
)

s = replace_once(
    s,
    "function fillSelect(id,values,allLabel){var e=$(id);if(!e)return;var old=e.value;e.innerHTML=(allLabel?'<option value=\"all\">'+allLabel+'</option>':'<option value=\"\">学級未設定</option>')+values.map(function(v){return '<option value=\"'+esc(v)+'\">'+esc(v)+'</option>'}).join('');if(Array.from(e.options||[]).some(function(o){return o.value===old}))e.value=old}",
    "function fillSelect(id,values,allLabel){var e=$(id);if(!e)return;var old=e.value;e.innerHTML=(allLabel?'<option value=\"all\">'+allLabel+'</option>':'<option value=\"\">学級未設定</option>')+values.map(function(v){return '<option value=\"'+esc(v)+'\">'+esc(v)+'</option>'}).join('');if(Array.from(e.options||[]).some(function(o){return o.value===old}))e.value=old}\nvar managedClasses=['5-1','5-2','5-3','6-1','6-2','6-3','テスト','予備'];\nfunction fillManagedClassSelect(id,includeAll){var e=$(id);if(!e)return;var old=e.value;e.innerHTML=(includeAll?'<option value=\"all\">すべて</option>':'')+managedClasses.map(function(v){return '<option value=\"'+esc(v)+'\">'+esc(v)+'</option>'}).join('');if(Array.from(e.options||[]).some(function(o){return o.value===old}))e.value=old}",
    'managed class options',
)

old_chart = "series.forEach(function(s,si){var pts=labels.map(function(k,idx){var p=s.points.find(function(x){return x.k===k});var x=l+(labels.length<=1?0:(w-l-r)*idx/(labels.length-1));var y=h-b-(h-t-b)*(p?n(p.v):0)/max;return x+','+y}).join(' ');html+='<polyline fill=\"none\" stroke=\"'+palette[si%palette.length]+'\" stroke-width=\"4\" points=\"'+pts+'\"/>';});labels.forEach(function(k,idx){var x=l+(labels.length<=1?0:(w-l-r)*idx/(labels.length-1));html+='<text x=\"'+x+'\" y=\"'+(h-10)+'\" text-anchor=\"middle\" font-size=\"10\" fill=\"#64748b\">'+esc(k.slice(5))+'</text>'});"
new_chart = "series.forEach(function(s,si){var pts=labels.map(function(k,idx){var p=s.points.find(function(x){return x.k===k});var x=l+(labels.length<=1?(w-l-r)/2:(w-l-r)*idx/(labels.length-1));var y=h-b-(h-t-b)*(p?n(p.v):0)/max;return x+','+y}).join(' ');html+='<polyline fill=\"none\" stroke=\"'+palette[si%palette.length]+'\" stroke-width=\"4\" points=\"'+pts+'\"/>';labels.forEach(function(k,idx){var p=s.points.find(function(x){return x.k===k});if(!p)return;var x=l+(labels.length<=1?(w-l-r)/2:(w-l-r)*idx/(labels.length-1));var y=h-b-(h-t-b)*n(p.v)/max;html+='<circle cx=\"'+x+'\" cy=\"'+y+'\" r=\"5\" fill=\"'+palette[si%palette.length]+'\" stroke=\"#fff\" stroke-width=\"2\"/>';});});labels.forEach(function(k,idx){var x=l+(labels.length<=1?(w-l-r)/2:(w-l-r)*idx/(labels.length-1));html+='<text x=\"'+x+'\" y=\"'+(h-10)+'\" text-anchor=\"middle\" font-size=\"10\" fill=\"#64748b\">'+esc(k.slice(5))+'</text>'});"
s = replace_once(s, old_chart, new_chart, 'single point chart markers')

old_teacher = "function updateTeacherDashboard(){var c=$('teacherClass').value,s=$('teacherStart').value,e=$('teacherEnd').value;var rows=teacherSessions.filter(function(r){return within(r,s,e)&&(c==='all'||String(r.classId||'')===c)});var studentSet=new Set(rows.map(function(r){return r.studentId}));var recs=studentRecords.filter(function(r){return c==='all'||String(r.classId||'')===c});setText('teacherStudents',recs.length+'人');setText('teacherSessions',rows.length+'回');setText('teacherAvgSessions',(recs.length?(rows.length/recs.length):0).toFixed(1)+'回');setText('teacherNotUsed',recs.filter(function(r){return !studentSet.has(r.studentId)}).length+'人');var classes=picked('teacherClassPicks');if(!classes.length)classes=uniqueClasses(teacherSessions,'classId');var metric=$('teacherMetric').value;var label=metric==='turns'?'平均ターン数':metric==='sessions'?'セッション回数':'平均発話語数';setText('teacherChartTitle','学級別・'+label+'の推移');$('teacherLegend').innerHTML=classes.map(function(x,i){return '<span style=\"color:'+palette[i%palette.length]+'\">'+esc(x)+'</span>'}).join('');drawChart('teacherChart',aggregate(teacherSessions.filter(function(r){return within(r,s,e)}),classes,metric,teacherAgg));}"
new_teacher = "function updateTeacherDashboard(){var c=$('teacherClass').value,s=$('teacherStart').value,e=$('teacherEnd').value;var rows=teacherSessions.filter(function(r){return within(r,s,e)&&String(r.classId||'')===c});var studentSet=new Set(rows.map(function(r){return r.studentId}));var recs=studentRecords.filter(function(r){return String(r.classId||'')===c});setText('teacherStudents',recs.length+'人');setText('teacherSessions',rows.length+'回');setText('teacherAvgSessions',(recs.length?(rows.length/recs.length):0).toFixed(1)+'回');setText('teacherNotUsed',recs.filter(function(r){return !studentSet.has(r.studentId)}).length+'人');var classes=[c];var metric=$('teacherMetric').value;var label=metric==='turns'?'平均ターン数':metric==='sessions'?'セッション回数':'平均発話語数';setText('teacherChartTitle',c+'・'+label+'の推移');$('teacherLegend').innerHTML=classes.map(function(x,i){return '<span style=\"color:'+palette[i%palette.length]+'\">'+esc(x)+'</span>'}).join('');drawChart('teacherChart',aggregate(rows,classes,metric,teacherAgg));}"
s = replace_once(s, old_teacher, new_teacher, 'teacher dashboard selected class')

old_summary = "function updateStudentSummary(){var rows=studentFiltered();setText('sumSessions',rows.length);setText('sumDuration',secText(rows.reduce(function(a,r){return a+n(r.actualDurationSeconds)},0)));setText('sumTurns',avg(rows.map(function(r){return r.totalTurns})).toFixed(1));setText('sumWords',avg(rows.map(function(r){return r.totalChildWords})).toFixed(1));function pct(k){var vals=rows.map(function(r){return r.reflection&&r.reflection[k]}).filter(function(x){return x!==undefined&&x!==null});return vals.length?Math.round(avg(vals)/5*100)+'%':'—'}setText('r1avg',pct('conveyedIdeas'));setText('r2avg',pct('understoodPartner'));setText('r3avg',pct('noticedLanguageCulture'));drawChart('sumTurnsChart',[{name:'ターン',points:rows.map(function(r){return{k:dateOf(r),v:n(r.totalTurns)}})}]);drawChart('sumWordsChart',[{name:'語数',points:rows.map(function(r){return{k:dateOf(r),v:n(r.totalChildWords)}})}]);$('summaryRows').innerHTML=rows.map(function(r){return '<tr><td>'+esc(r.sessionId)+'</td><td>'+esc(fmtDate(r))+'</td><td>'+esc(r.topic||'')+'</td><td>'+secText(r.actualDurationSeconds)+'</td><td>'+n(r.totalTurns)+'</td><td>'+n(r.totalChildWords)+'</td><td><button class=\"link session-open\" data-id=\"'+esc(r.sessionId)+'\">詳細を見る</button></td></tr>'}).join('');document.querySelectorAll('.session-open').forEach(function(b){b.addEventListener('click',function(){openSession(b.dataset.id)})})}"
new_summary = "function updateStudentSummary(){var rows=studentFiltered();setText('sumSessions',rows.length);setText('sumDuration',secText(rows.reduce(function(a,r){return a+n(r.actualDurationSeconds)},0)));setText('sumTurns',avg(rows.map(function(r){return r.totalTurns})).toFixed(1));setText('sumWords',avg(rows.map(function(r){return r.totalChildWords})).toFixed(1));function pct(k){var vals=rows.map(function(r){return r.reflection&&r.reflection[k]}).filter(function(x){return x!==undefined&&x!==null});return vals.length?Math.round(avg(vals)/5*100)+'%':'—'}setText('r1avg',pct('conveyedIdeas'));setText('r2avg',pct('understoodPartner'));setText('r3avg',pct('noticedLanguageCulture'));var cumulative=0;drawChart('sumDurationChart',[{name:'総対話時間（分）',points:rows.map(function(r){cumulative+=n(r.actualDurationSeconds);return{k:dateOf(r),v:Math.round(cumulative/6)/10}})}]);drawChart('sumWordsChart',[{name:'語数',points:rows.map(function(r){return{k:dateOf(r),v:n(r.totalChildWords)}})}]);$('summaryRows').innerHTML=rows.map(function(r){return '<tr><td>'+esc(r.sessionId)+'</td><td>'+esc(fmtDate(r))+'</td><td>'+esc(r.topic||'')+'</td><td>'+secText(r.actualDurationSeconds)+'</td><td>'+n(r.totalTurns)+'</td><td>'+n(r.totalChildWords)+'</td><td><button class=\"link session-open\" data-id=\"'+esc(r.sessionId)+'\">詳細を見る</button></td></tr>'}).join('');document.querySelectorAll('.session-open').forEach(function(b){b.addEventListener('click',function(){openSession(b.dataset.id)})})}"
s = replace_once(s, old_summary, new_summary, 'student summary chart logic')

old_research = "function updateResearchDashboard(){var s=$('researchStart').value,e=$('researchEnd').value;var rows=researchFiltered(s,e,'all');var ids=new Set(rows.map(function(r){return r.research_id}).filter(Boolean));setText('researchStudents',ids.size+'人');setText('researchSessions',rows.length+'件');var ds=rows.map(dateOf).filter(Boolean).sort();setText('researchPeriod',ds.length?ds[0]+'–'+ds[ds.length-1]:'—');setText('researchMissing',rows.filter(researchMissingRow).length+'件');var classes=picked('researchClassPicks');if(!classes.length)classes=uniqueClasses(researchData,'class_id');var metric=$('researchMetric').value;var lab=metric==='turns'?'平均ターン数':metric==='duration'?'平均対話時間':metric==='sessions'?'セッション回数':'平均発話語数';setText('researchChartTitle','期間別・学級別の'+lab);$('researchLegend').innerHTML=classes.map(function(x,i){return '<span style=\"color:'+palette[i%palette.length]+'\">'+esc(x)+'</span>'}).join('');drawChart('researchChart',aggregate(rows,classes,metric,researchAgg))}"
new_research = "function updateResearchDashboard(){var s=$('researchStart').value,e=$('researchEnd').value,cls=$('researchDashboardClass').value;var rows=researchFiltered(s,e,cls);var ids=new Set(rows.map(function(r){return r.research_id}).filter(Boolean));setText('researchStudents',ids.size+'人');setText('researchSessions',rows.length+'件');var ds=rows.map(dateOf).filter(Boolean).sort();setText('researchPeriod',ds.length?ds[0]+'–'+ds[ds.length-1]:'—');setText('researchMissing',rows.filter(researchMissingRow).length+'件');var classes=[cls];var metric=$('researchMetric').value;var lab=metric==='turns'?'平均ターン数':metric==='duration'?'平均対話時間':metric==='sessions'?'セッション回数':'平均発話語数';setText('researchChartTitle','期間別・'+cls+'・'+lab);$('researchLegend').innerHTML=classes.map(function(x,i){return '<span style=\"color:'+palette[i%palette.length]+'\">'+esc(x)+'</span>'}).join('');drawChart('researchChart',aggregate(rows,classes,metric,researchAgg))}"
s = replace_once(s, old_research, new_research, 'research dashboard selected class')

old_load_teacher = "async function loadTeacher(){var a=await Promise.all([fetch('/api/management/sessions'),fetch('/api/management/student-codes')]);var sd=await a[0].json(),cd=await a[1].json();if(!a[0].ok||!sd.success)throw new Error(sd.error||'DATA_ERROR');if(!a[1].ok||!cd.success)throw new Error(cd.error||'CODE_ERROR');teacherSessions=Array.isArray(sd.sessions)?sd.sessions:[];studentRecords=Array.isArray(cd.students)?cd.students:[];var classes=uniqueClasses(studentRecords,'classId');['teacherClass','listClass'].forEach(function(id){fillSelect(id,classes,'すべて')});fillSelect('newClass',classes,'');buildPicks('teacherClassPicks',classes,updateTeacherDashboard);initDates('teacher',teacherSessions);initDates('list',teacherSessions);$('listStart').value=$('teacherStart').value;$('listEnd').value=$('teacherEnd').value;updateTeacherDashboard();teacherStudentRows();renderCodes()}"
new_load_teacher = "async function loadTeacher(){var a=await Promise.all([fetch('/api/management/sessions'),fetch('/api/management/student-codes')]);var sd=await a[0].json(),cd=await a[1].json();if(!a[0].ok||!sd.success)throw new Error(sd.error||'DATA_ERROR');if(!a[1].ok||!cd.success)throw new Error(cd.error||'CODE_ERROR');teacherSessions=Array.isArray(sd.sessions)?sd.sessions:[];studentRecords=Array.isArray(cd.students)?cd.students:[];fillManagedClassSelect('teacherClass',false);fillManagedClassSelect('listClass',true);fillManagedClassSelect('newClass',false);initDates('teacher',teacherSessions);initDates('list',teacherSessions);$('listStart').value=$('teacherStart').value;$('listEnd').value=$('teacherEnd').value;updateTeacherDashboard();teacherStudentRows();renderCodes()}"
s = replace_once(s, old_load_teacher, new_load_teacher, 'teacher fixed classes')

old_load_research = "async function loadResearch(){var r=await fetch('/api/management/research.csv');if(!r.ok)throw new Error('RESEARCH_DATA_UNAVAILABLE');researchData=csvParse(await r.text());var classes=uniqueClasses(researchData,'class_id');fillSelect('researchClass',classes,'すべて');fillSelect('r6Class',classes,'すべて');buildPicks('researchClassPicks',classes,updateResearchDashboard);initDates('research',researchData);initDates('r3',researchData);initDates('r6',researchData);$('r3Start').value=$('researchStart').value;$('r3End').value=$('researchEnd').value;$('r6Start').value=$('researchStart').value;$('r6End').value=$('researchEnd').value;var ids=Array.from(new Set(researchData.map(function(x){return x.research_id}).filter(Boolean))).sort();fillSelect('r6Research',ids,'すべて');updateResearchDashboard();renderResearchList();renderQuality()}"
new_load_research = "async function loadResearch(){var r=await fetch('/api/management/research.csv');if(!r.ok)throw new Error('RESEARCH_DATA_UNAVAILABLE');researchData=csvParse(await r.text());fillManagedClassSelect('researchDashboardClass',false);fillManagedClassSelect('researchClass',true);fillManagedClassSelect('r6Class',true);initDates('research',researchData);initDates('r3',researchData);initDates('r6',researchData);$('r3Start').value=$('researchStart').value;$('r3End').value=$('researchEnd').value;$('r6Start').value=$('researchStart').value;$('r6End').value=$('researchEnd').value;var ids=Array.from(new Set(researchData.map(function(x){return x.research_id}).filter(Boolean))).sort();fillSelect('r6Research',ids,'すべて');updateResearchDashboard();renderResearchList();renderQuality()}"
s = replace_once(s, old_load_research, new_load_research, 'research fixed classes')

s = replace_once(
    s,
    "['researchStart','researchEnd','researchMetric'].forEach(function(id){$(id).addEventListener('change',updateResearchDashboard)});",
    "['researchStart','researchEnd','researchDashboardClass','researchMetric'].forEach(function(id){$(id).addEventListener('change',updateResearchDashboard)});",
    'research class event',
)

old_quick = "$('summaryAll').addEventListener('click',function(){$('summaryStart').value=$('listStart').value;$('summaryEnd').value=$('listEnd').value;updateStudentSummary()});$('summary1m').addEventListener('click',function(){var e=$('summaryEnd').value||dateBounds(teacherSessions).max;if(e){var d=new Date(e+'T00:00:00');d.setMonth(d.getMonth()-1);$('summaryStart').value=d.toISOString().slice(0,10);updateStudentSummary()}});$('summary3m').addEventListener('click',function(){var e=$('summaryEnd').value||dateBounds(teacherSessions).max;if(e){var d=new Date(e+'T00:00:00');d.setMonth(d.getMonth()-3);$('summaryStart').value=d.toISOString().slice(0,10);updateStudentSummary()}});"
new_quick = "function setSummaryQuickActive(id){['summary1m','summary3m','summaryAll'].forEach(function(x){$(x).classList.toggle('active',x===id)})}function allCurrentStudentRows(){var rec=studentRecords.find(function(r){return r.teacherStudentId===currentTeacherStudent});if(!rec)return[];return teacherSessions.filter(function(r){return r.studentId===rec.studentId}).sort(function(a,b){return dateOf(a).localeCompare(dateOf(b))})}$('summaryAll').addEventListener('click',function(){var allRows=allCurrentStudentRows(),b=dateBounds(allRows);$('summaryStart').value=b.min;$('summaryEnd').value=b.max;setSummaryQuickActive('summaryAll');updateStudentSummary()});$('summary1m').addEventListener('click',function(){var allRows=allCurrentStudentRows(),b=dateBounds(allRows),e=b.max;if(e){var d=new Date(e+'T00:00:00');d.setMonth(d.getMonth()-1);$('summaryEnd').value=e;$('summaryStart').value=d.toISOString().slice(0,10);setSummaryQuickActive('summary1m');updateStudentSummary()}});$('summary3m').addEventListener('click',function(){var allRows=allCurrentStudentRows(),b=dateBounds(allRows),e=b.max;if(e){var d=new Date(e+'T00:00:00');d.setMonth(d.getMonth()-3);$('summaryEnd').value=e;$('summaryStart').value=d.toISOString().slice(0,10);setSummaryQuickActive('summary3m');updateStudentSummary()}});"
s = replace_once(s, old_quick, new_quick, 'student quick periods')

p.write_text(s)

# QA: enforce the six requested fixes
p = Path('scripts/qa-management-page.ts')
s = p.read_text()
s = s.replace("'summaryStart','summaryEnd','sumTurnsChart','sumWordsChart'", "'summaryStart','summaryEnd','sumDurationChart','sumWordsChart'")
s = s.replace("'researchStart','researchEnd','researchMetric'", "'researchStart','researchEnd','researchDashboardClass','researchMetric'")
insert = """
assert.ok(!html.includes('id=\"teacherClassPicks\"'), 'Teacher dashboard must not show duplicate class picks');
assert.ok(!html.includes('id=\"researchClassPicks\"'), 'Research dashboard must use one class dropdown');
for (const cls of ['5-1','5-2','5-3','6-1','6-2','6-3','テスト','予備']) assert.ok(html.includes(cls), `Managed class option missing: ${cls}`);
assert.ok(html.includes('総対話時間'));
assert.ok(html.includes('sumDurationChart'));
assert.ok(scriptMatch[1].includes('allCurrentStudentRows'));
assert.ok(scriptMatch[1].includes("dateBounds(allRows)"), '期間全体 must use all sessions for the selected child');
"""
anchor = "assert.ok(html.includes('renderQuality'));\n"
s = replace_once(s, anchor, anchor + insert, 'qa management assertions')
feedback_anchor = "assert.ok(!feedbackSource.includes('Metrics Row'), 'Feedback report must not render duplicated metric cards');\n"
s = replace_once(s, feedback_anchor, feedback_anchor + "assert.ok(!feedbackSource.includes('handleCopyReport'), 'Copy button must be removed from report');\nassert.ok(!feedbackSource.includes('window.print()'), 'Print button must be removed from report');\n", 'qa report buttons')
app_anchor = "assert.ok(!appSource.includes('onOpenHistory={learningDataEnabled && learningCode ? handleOpenHistory : undefined} onRestart={handleRestart}/>}'), 'Reflection must not receive retry action');\n"
s = replace_once(s, app_anchor, app_anchor + "assert.ok(!appSource.includes('setTimeout(executeTransition,4500)'), 'Farewell must not auto-transition before audio completion');\n", 'qa farewell')
p.write_text(s)

print('FINAL UI FIX PATCH APPLIED')
