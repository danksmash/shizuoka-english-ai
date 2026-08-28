from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing patch target: {label}')
    return text.replace(old, new, 1)


def replace_section(text: str, section_id: str, new_section: str) -> str:
    pattern = rf'<section id="{re.escape(section_id)}"[\s\S]*?</section>'
    updated, count = re.subn(pattern, new_section, text, count=1)
    if count != 1:
        raise SystemExit(f'failed to replace section: {section_id} ({count})')
    return updated


# App: reflection screen should not receive a history action.
app_path = Path('src/App.tsx')
app = app_path.read_text()
app = replace_once(
    app,
    " saveMessage={reflectionSaveMessage} onOpenHistory={learningDataEnabled && learningCode ? handleOpenHistory : undefined}/>",
    " saveMessage={reflectionSaveMessage}/>",
    'reflection history prop',
)
app_path.write_text(app)


page_path = Path('src/server/managementPage.ts')
page = page_path.read_text()

# Denser dashboard styles.
page = replace_once(
    page,
    ".metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:14px 0}.metric{padding:18px;text-align:center}",
    ".metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:14px 0}.metrics6{grid-template-columns:repeat(6,1fr)}.metrics-secondary{margin-top:0}.metric{padding:18px;text-align:center}.metric.compact{padding:13px}.condition-summary{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0 12px;padding:10px 12px;border-radius:10px;background:#f5f8fd;border:1px solid #dbe5f2;color:#526581;font-size:11px;font-weight:800}",
    'dashboard density css',
)
page = replace_once(
    page,
    "@media(max-width:1050px){.toolbar,.filters{grid-template-columns:repeat(2,1fr)}.grid2,.export-box{grid-template-columns:1fr}.metrics,.detail-grid,.quality{grid-template-columns:repeat(2,1fr)}}",
    "@media(max-width:1050px){.toolbar,.filters{grid-template-columns:repeat(2,1fr)}.grid2,.export-box{grid-template-columns:1fr}.metrics,.metrics6,.detail-grid,.quality{grid-template-columns:repeat(2,1fr)}}",
    'responsive metrics css',
)
page = replace_once(
    page,
    "@media(max-width:620px){.wrap{padding:10px}.top{align-items:flex-start;flex-direction:column}.toolbar,.filters{grid-template-columns:1fr}.metrics,.detail-grid,.cards3,.mini-grid,.quality{grid-template-columns:1fr}.title{font-size:19px}}",
    "@media(max-width:620px){.wrap{padding:10px}.top{align-items:flex-start;flex-direction:column}.toolbar,.filters{grid-template-columns:1fr}.metrics,.metrics6,.detail-grid,.cards3,.mini-grid,.quality{grid-template-columns:1fr}.title{font-size:19px}}",
    'mobile metrics css',
)

teacher_dashboard = '''<section id="teacherDashboard" class="screen teacher"><div class="screen-title"><span class="step">T2</span>学級ダッシュボード</div><div class="card toolbar"><div><label>学級</label><select id="teacherClass"></select></div><div><label>期間開始</label><input id="teacherStart" type="date"></div><div><label>期間終了</label><input id="teacherEnd" type="date"></div><div><label>表示項目</label><select id="teacherMetric"><option value="words">平均発話語数</option><option value="turns">平均ターン数</option><option value="duration">平均対話時間</option><option value="sessions">セッション回数</option></select><div class="toggle" style="margin-top:7px"><button id="teacherWeekly" class="active">週別</button><button id="teacherMonthly">月別</button></div></div></div><div class="metrics"><div class="card metric"><span>児童数</span><b id="teacherStudents">0人</b></div><div class="card metric"><span>セッション</span><b id="teacherSessions">0回</b></div><div class="card metric"><span>平均実施</span><b id="teacherAvgSessions">0回</b></div><div class="card metric"><span>未実施</span><b id="teacherNotUsed">0人</b></div></div><div class="metrics metrics6 metrics-secondary"><div class="card metric compact"><span>総対話時間</span><b id="teacherTotalDuration">0分</b></div><div class="card metric compact"><span>平均対話時間</span><b id="teacherAvgDuration">0秒</b></div><div class="card metric compact"><span>平均ターン</span><b id="teacherAvgTurns">0</b></div><div class="card metric compact"><span>平均発話語数</span><b id="teacherAvgWords">0</b></div><div class="card metric compact"><span>実施テーマ数</span><b id="teacherThemeCount">0</b></div><div class="card metric compact"><span>利用AI留学生数</span><b id="teacherPartnerCount">0</b></div></div><div class="card section"><h2 id="teacherChartTitle">学級別・平均発話語数の推移</h2><div id="teacherConditionSummary" class="condition-summary"></div><div id="teacherLegend" class="legend"></div><div id="teacherChart" class="chart"></div><button id="dashToListBtn" class="secondary full">この条件で児童別一覧を見る</button></div></section>'''
page = replace_section(page, 'teacherDashboard', teacher_dashboard)

student_list = '''<section id="studentList" class="screen teacher"><div class="screen-title"><span class="step">T3</span>期間別・児童一覧</div><div class="card section"><div class="filters"><div><label>学級</label><select id="listClass"></select></div><div><label>期間開始</label><input id="listStart" type="date"></div><div><label>期間終了</label><input id="listEnd" type="date"></div><div><label>児童ID</label><input id="studentSearch" placeholder="児童IDで検索"></div><div><label>表示</label><label class="class-pick"><input id="showUnused" type="checkbox" style="width:auto">未実施を表示</label></div></div><div class="table-wrap"><table><thead><tr><th>児童ID</th><th>セッション回数</th><th>総対話時間</th><th>平均対話時間</th><th>平均ターン</th><th>平均発話語数</th><th>最近のテーマ</th><th>最終利用</th><th>状態</th></tr></thead><tbody id="studentRows"></tbody></table></div><button id="listBackBtn" class="secondary back">← 学級ダッシュボードにもどる</button></div></section>'''
page = replace_section(page, 'studentList', student_list)

student_summary = '''<section id="studentSummary" class="screen teacher"><div class="screen-title"><span class="step">T4</span>児童個別・期間サマリー</div><div class="breadcrumbs">学級ダッシュボード ＞ 児童一覧 ＞ <span id="summaryCrumb">----</span></div><div class="card section"><div class="filters"><div><label>期間開始</label><input id="summaryStart" type="date"></div><div><label>期間終了</label><input id="summaryEnd" type="date"></div><div><label>クイック期間</label><div class="toggle"><button id="summary1m">1か月</button><button id="summary3m">3か月</button><button id="summaryAll" class="active">期間全体</button></div></div></div><h2 id="studentSummaryTitle">児童の学習状況</h2><div class="metrics metrics6"><div class="metric"><span>セッション</span><b id="sumSessions">0</b></div><div class="metric"><span>総対話時間</span><b id="sumDuration">0分</b></div><div class="metric"><span>平均対話時間</span><b id="sumAvgDuration">0秒</b></div><div class="metric"><span>平均ターン</span><b id="sumTurns">0</b></div><div class="metric"><span>総発話語数</span><b id="sumTotalWords">0</b></div><div class="metric"><span>平均発話語数</span><b id="sumWords">0</b></div></div><div class="grid2"><div><h2>総対話時間の推移（累積・分）</h2><div id="sumDurationChart" class="chart"></div></div><div><h2>発話語数の推移</h2><div id="sumWordsChart" class="chart"></div></div></div><h2 style="margin-top:18px">振り返りの推移</h2><div class="cards3"><div class="small-card">自分の考えを伝える<b id="r1avg">—</b></div><div class="small-card">相手の話を聞いて分かる<b id="r2avg">—</b></div><div class="small-card">新しい言葉や文化に気づいた<b id="r3avg">—</b></div></div><h2 style="margin-top:18px">セッション一覧</h2><div class="table-wrap"><table><thead><tr><th>セッションID</th><th>日付</th><th>テーマ</th><th>対話時間</th><th>ターン</th><th>発話語数</th><th>詳細</th></tr></thead><tbody id="summaryRows"></tbody></table></div><button id="summaryBackBtn" class="secondary back">← 児童一覧にもどる</button></div></section>'''
page = replace_section(page, 'studentSummary', student_summary)

research_dashboard = '''<section id="researchDashboard" class="screen research"><div class="screen-title"><span class="step">R2</span>研究ダッシュボード</div><p class="note">研究者はresearch_idとclass_idを中心とした匿名化データだけを扱います。学習者用コード・氏名・学校名は表示されません。</p><div class="card toolbar"><div><label>期間開始</label><input id="researchStart" type="date"></div><div><label>期間終了</label><input id="researchEnd" type="date"></div><div><label>集計単位</label><div class="toggle"><button id="researchWeekly">週別</button><button id="researchMonthly" class="active">月別</button></div></div><div><label>学級・学年</label><select id="researchDashboardClass"></select></div><div><label>表示項目</label><select id="researchMetric"><option value="words">平均発話語数</option><option value="turns">平均ターン数</option><option value="duration">平均対話時間</option><option value="sessions">セッション回数</option></select></div></div><div class="metrics metrics6"><div class="card metric"><span>対象児童</span><b id="researchStudents">0人</b></div><div class="card metric"><span>セッション</span><b id="researchSessions">0件</b></div><div class="card metric"><span>総対話時間</span><b id="researchTotalDuration">0分</b></div><div class="card metric"><span>平均ターン</span><b id="researchAvgTurns">0</b></div><div class="card metric"><span>平均発話語数</span><b id="researchAvgWords">0</b></div><div class="card metric"><span>欠損</span><b id="researchMissing">0件</b></div></div><div class="card section"><h2 id="researchChartTitle">期間別・学級別の平均発話語数</h2><div id="researchConditionSummary" class="condition-summary">収集期間：<b id="researchPeriod">—</b></div><div id="researchLegend" class="legend"></div><div id="researchChart" class="chart"></div><div class="cards3" style="margin-top:14px"><button id="researchExportShortcut" class="small-card secondary">匿名化CSVを作成</button><button id="researchListShortcut" class="small-card secondary">匿名化個別データを見る</button><button id="researchQualityShortcut" class="small-card secondary">データ品質を確認</button></div></div></section>'''
page = replace_section(page, 'researchDashboard', research_dashboard)

research_list = '''<section id="researchList" class="screen research"><div class="screen-title"><span class="step">R3</span>匿名化個別データ一覧</div><div class="card section"><div class="filters"><div><label>期間開始</label><input id="r3Start" type="date"></div><div><label>期間終了</label><input id="r3End" type="date"></div><div><label>class_id</label><select id="researchClass"></select></div><div><label>学年</label><select id="researchGrade"><option value="all">すべて</option><option value="5">5年</option><option value="6">6年</option></select></div><div><label>完全なケースのみ</label><label class="class-pick"><input id="researchCompleteOnly" type="checkbox" style="width:auto">はい</label></div></div><input id="researchSearch" placeholder="research_idで検索" style="margin-bottom:12px"><div class="table-wrap"><table><thead><tr><th>research_id</th><th>class_id</th><th>セッション</th><th>総対話時間</th><th>平均対話時間</th><th>平均ターン</th><th>平均発話語数</th><th>テーマ数</th><th>欠損</th><th>最終記録</th></tr></thead><tbody id="researchRows"></tbody></table></div><button id="researchListBackBtn" class="secondary back">← 研究ダッシュボードにもどる</button></div></section>'''
page = replace_section(page, 'researchList', research_list)

research_summary = '''<section id="researchSummary" class="screen research"><div class="screen-title"><span class="step">R4</span>匿名化個人・縦断データ</div><div class="breadcrumbs">研究ダッシュボード ＞ 匿名化個別データ ＞ <span id="researchSummaryCrumb">----</span></div><div class="card section"><div class="filters"><div><label>期間開始</label><input id="r4Start" type="date"></div><div><label>期間終了</label><input id="r4End" type="date"></div></div><h2 id="researchSummaryTitle">縦断データ</h2><div class="metrics metrics6"><div class="metric"><span>セッション</span><b id="r4Sessions">0件</b></div><div class="metric"><span>総対話時間</span><b id="r4TotalDuration">0分</b></div><div class="metric"><span>平均対話時間</span><b id="r4Duration">0秒</b></div><div class="metric"><span>平均ターン</span><b id="r4Turns">0</b></div><div class="metric"><span>平均発話語数</span><b id="r4Words">0</b></div><div class="metric"><span>実施テーマ数</span><b id="r4Themes">0</b></div></div><div class="mini-grid"><div><b>ターン数の推移</b><div id="r4TurnChart" class="mini-chart"></div></div><div><b>発話語数の推移</b><div id="r4WordChart" class="mini-chart"></div></div><div><b>振り返り3項目の推移</b><div id="r4ReflectionChart" class="mini-chart"></div></div></div><div class="table-wrap" style="margin-top:16px"><table><thead><tr><th>session_id</th><th>通算回</th><th>記録日</th><th>テーマ</th><th>対話時間</th><th>ターン</th><th>発話語数</th><th>欠損</th><th>詳細</th></tr></thead><tbody id="r4Rows"></tbody></table></div><p class="note" style="margin-top:14px">個人を特定できる情報は表示されません。</p><button id="r4BackBtn" class="secondary back">← 匿名化個別データにもどる</button></div></section>'''
page = replace_section(page, 'researchSummary', research_summary)

# Class/scope helpers and normalized labels.
old_helpers = "var SCHOOL_CLASSES=['5-1','5-2','5-3','6-1','6-2','6-3','テスト','予備'];\nfunction uniqueClasses(source,key){var vals=Array.from(new Set(source.map(function(r){return String(r[key]||'').trim()}).filter(Boolean)));return SCHOOL_CLASSES.filter(function(c){return vals.indexOf(c)>=0}).concat(vals.filter(function(c){return SCHOOL_CLASSES.indexOf(c)<0}).sort())}\nfunction fillSchoolClassSelect(id,allLabel){fillSelect(id,SCHOOL_CLASSES,allLabel)}"
new_helpers = "var SCHOOL_CLASSES=['5-1','5-2','5-3','6-1','6-2','6-3','テスト','予備'];\nfunction canonClass(v){var s=String(v||'').trim().replace(/[−－–—]/g,'-').replace(/\\s+/g,'');var m=s.match(/^([56])年?[-]?([123])組?$/);if(m)return m[1]+'-'+m[2];if(s==='test'||s==='TEST')return 'テスト';return s}\nfunction classMatches(value,scope){var c=canonClass(value);if(scope==='all'||!scope)return true;if(scope==='grade5')return c.indexOf('5-')===0;if(scope==='grade6')return c.indexOf('6-')===0;return c===canonClass(scope)}\nfunction uniqueClasses(source,key){var vals=Array.from(new Set(source.map(function(r){return canonClass(r[key]||'')}).filter(Boolean)));return SCHOOL_CLASSES.filter(function(c){return vals.indexOf(c)>=0}).concat(vals.filter(function(c){return SCHOOL_CLASSES.indexOf(c)<0}).sort())}\nfunction fillSchoolClassSelect(id,allLabel){fillSelect(id,SCHOOL_CLASSES,allLabel)}\nfunction fillResearchScopeSelect(id){var e=$(id);if(!e)return;e.innerHTML='<option value=\"all\">すべて</option><option value=\"grade5\">5年</option><option value=\"grade6\">6年</option>'+SCHOOL_CLASSES.map(function(v){return '<option value=\"'+esc(v)+'\">'+esc(v)+'</option>'}).join('')}\nfunction scopeClasses(scope,rows){var available=Array.from(new Set(rows.map(function(r){return canonClass(r.class_id||r.classId||'')}).filter(function(c){return SCHOOL_CLASSES.indexOf(c)>=0})));var expected=scope==='grade5'?['5-1','5-2','5-3']:scope==='grade6'?['6-1','6-2','6-3']:scope==='all'?SCHOOL_CLASSES.slice():[canonClass(scope)];var found=expected.filter(function(c){return available.indexOf(c)>=0});return found.length?found:expected}\nfunction topicText(v){var map={intro:'じこしょうかい＆あいさつ',favorites:'すきなもの・すきなこと',culture:'静岡のじまん＆世界の文化',abilities:'できること・得意なこと',free:'じゆうトーク・おしゃべり'};return map[String(v||'')]||String(v||'—')}"
page = replace_once(page, old_helpers, new_helpers, 'class helpers')

page = replace_once(
    page,
    "function metricValue(row,metric){if(metric==='turns')return n(row.totalTurns||row.total_turns);if(metric==='duration')return n(row.actualDurationSeconds||row.actual_duration_seconds);if(metric==='sessions')return 1;return n(row.totalChildWords||row.total_child_words)}",
    "function metricValue(row,metric){if(metric==='turns')return n(row.totalTurns||row.total_turns);if(metric==='duration')return n(row.actualDurationSeconds||row.actual_duration_seconds)/60;if(metric==='sessions')return 1;return n(row.totalChildWords||row.total_child_words)}",
    'duration metric minutes',
)
page = replace_once(
    page,
    "function aggregate(rows,classes,metric,mode){return classes.map(function(c){var m={};rows.filter(function(r){return String(r.classId||r.class_id||'')===c}).forEach(function(r){var k=periodKey(dateOf(r),mode);if(!k)return;(m[k]||(m[k]=[])).push(metricValue(r,metric))});return{name:c,points:Object.keys(m).sort().map(function(k){return{k:k,v:metric==='sessions'?m[k].length:avg(m[k])}})}})}",
    "function aggregate(rows,classes,metric,mode){return classes.map(function(c){var m={};rows.filter(function(r){return canonClass(r.classId||r.class_id||'')===c}).forEach(function(r){var k=periodKey(dateOf(r),mode);if(!k)return;(m[k]||(m[k]=[])).push(metricValue(r,metric))});return{name:c,points:Object.keys(m).sort().map(function(k){return{k:k,v:metric==='sessions'?m[k].length:avg(m[k])}})}})}",
    'aggregate normalized classes',
)

teacher_fn = "function updateTeacherDashboard(){var c=$('teacherClass').value,s=$('teacherStart').value,e=$('teacherEnd').value;var rows=teacherSessions.filter(function(r){return within(r,s,e)&&classMatches(r.classId,c)});var studentSet=new Set(rows.map(function(r){return r.studentId}));var recs=studentRecords.filter(function(r){return classMatches(r.classId,c)});setText('teacherStudents',recs.length+'人');setText('teacherSessions',rows.length+'回');setText('teacherAvgSessions',(recs.length?(rows.length/recs.length):0).toFixed(1)+'回');setText('teacherNotUsed',recs.filter(function(r){return !studentSet.has(r.studentId)}).length+'人');setText('teacherTotalDuration',secText(rows.reduce(function(a,r){return a+n(r.actualDurationSeconds)},0)));setText('teacherAvgDuration',secText(avg(rows.map(function(r){return r.actualDurationSeconds}))));setText('teacherAvgTurns',avg(rows.map(function(r){return r.totalTurns})).toFixed(1));setText('teacherAvgWords',avg(rows.map(function(r){return r.totalChildWords})).toFixed(1));setText('teacherThemeCount',new Set(rows.map(function(r){return r.topic}).filter(Boolean)).size+'種');setText('teacherPartnerCount',new Set(rows.map(function(r){return r.aiStudentId}).filter(Boolean)).size+'人');var classes=c==='all'?scopeClasses('all',rows):[canonClass(c)];var metric=$('teacherMetric').value;var label=metric==='turns'?'平均ターン数':metric==='duration'?'平均対話時間（分）':metric==='sessions'?'セッション回数':'平均発話語数';setText('teacherChartTitle','学級別・'+label+'の推移');setText('teacherConditionSummary','学級: '+(c==='all'?'すべて':c)+' ／ 期間: '+(s||'—')+'〜'+(e||'—')+' ／ '+(teacherAgg==='week'?'週別':'月別')+' ／ '+label);$('teacherLegend').innerHTML=classes.map(function(x,i){return '<span style=\"color:'+palette[i%palette.length]+'\">'+esc(x)+'</span>'}).join('');drawChart('teacherChart',aggregate(rows,classes,metric,teacherAgg));}"
page = re.sub(r"function updateTeacherDashboard\(\)\{[\s\S]*?\}\nfunction teacherStudentRows", teacher_fn + "\nfunction teacherStudentRows", page, count=1)

teacher_rows_fn = "function teacherStudentRows(){var c=$('listClass').value,s=$('listStart').value,e=$('listEnd').value,q=$('studentSearch').value.trim().toUpperCase(),showUnused=$('showUnused').checked;var out=[];studentRecords.forEach(function(rec){if(!classMatches(rec.classId,c))return;if(q&&String(rec.teacherStudentId||'').toUpperCase().indexOf(q)<0)return;var rows=teacherSessions.filter(function(x){return x.studentId===rec.studentId&&within(x,s,e)}).sort(function(a,b){return dateOf(a).localeCompare(dateOf(b))});if(!rows.length&&!showUnused)return;out.push({rec:rec,rows:rows})});$('studentRows').innerHTML=out.map(function(x){var rows=x.rows,lastRow=rows[rows.length-1],last=lastRow?dateOf(lastRow):'—',totalDuration=rows.reduce(function(a,r){return a+n(r.actualDurationSeconds)},0);return '<tr><td><button class=\"link student-open\" data-id=\"'+esc(x.rec.teacherStudentId)+'\">'+esc(x.rec.teacherStudentId)+'</button></td><td>'+rows.length+'回</td><td>'+secText(totalDuration)+'</td><td>'+secText(avg(rows.map(function(r){return r.actualDurationSeconds})))+'</td><td>'+avg(rows.map(function(r){return r.totalTurns})).toFixed(1)+'</td><td>'+avg(rows.map(function(r){return r.totalChildWords})).toFixed(1)+'</td><td>'+esc(lastRow?topicText(lastRow.topic):'—')+'</td><td>'+esc(last)+'</td><td><span class=\"status '+(x.rec.active?'':'off')+'\">'+(rows.length?(x.rec.active?'利用中':'利用停止'):'未実施')+'</span></td></tr>'}).join('');document.querySelectorAll('.student-open').forEach(function(b){b.addEventListener('click',function(){openStudent(b.dataset.id)})})}"
page = re.sub(r"function teacherStudentRows\(\)\{[\s\S]*?\}\nfunction studentAllRows", teacher_rows_fn + "\nfunction studentAllRows", page, count=1)

student_summary_fn = "function updateStudentSummary(){var rows=studentFiltered();var totalDuration=rows.reduce(function(a,r){return a+n(r.actualDurationSeconds)},0),totalWords=rows.reduce(function(a,r){return a+n(r.totalChildWords)},0);setText('sumSessions',rows.length);setText('sumDuration',secText(totalDuration));setText('sumAvgDuration',secText(avg(rows.map(function(r){return r.actualDurationSeconds}))));setText('sumTurns',avg(rows.map(function(r){return r.totalTurns})).toFixed(1));setText('sumTotalWords',totalWords);setText('sumWords',avg(rows.map(function(r){return r.totalChildWords})).toFixed(1));function pct(k){var vals=rows.map(function(r){return r.reflection&&r.reflection[k]}).filter(function(x){return x!==undefined&&x!==null});return vals.length?Math.round(avg(vals)/5*100)+'%':'—'}setText('r1avg',pct('conveyedIdeas'));setText('r2avg',pct('understoodPartner'));setText('r3avg',pct('noticedLanguageCulture'));var cumulative=0;drawChart('sumDurationChart',[{name:'累積対話時間（分）',points:rows.map(function(r,i){cumulative+=n(r.actualDurationSeconds)/60;return{k:dateOf(r)+'-'+String(i+1).padStart(2,'0'),v:Math.round(cumulative*10)/10}})}]);drawChart('sumWordsChart',[{name:'語数',points:rows.map(function(r,i){return{k:dateOf(r)+'-'+String(i+1).padStart(2,'0'),v:n(r.totalChildWords)}})}]);$('summaryRows').innerHTML=rows.map(function(r){return '<tr><td>'+esc(r.sessionId)+'</td><td>'+esc(fmtDate(r))+'</td><td>'+esc(topicText(r.topic||''))+'</td><td>'+secText(r.actualDurationSeconds)+'</td><td>'+n(r.totalTurns)+'</td><td>'+n(r.totalChildWords)+'</td><td><button class=\"link session-open\" data-id=\"'+esc(r.sessionId)+'\">詳細を見る</button></td></tr>'}).join('');document.querySelectorAll('.session-open').forEach(function(b){b.addEventListener('click',function(){openSession(b.dataset.id)})})}"
page = re.sub(r"function updateStudentSummary\(\)\{[\s\S]*?\}\nfunction openSession", student_summary_fn + "\nfunction openSession", page, count=1)

research_filter_fn = "function researchFiltered(start,end,scope){return researchData.filter(function(r){return within(r,start,end)&&classMatches(r.class_id,scope)})}"
page = re.sub(r"function researchFiltered\(start,end,cls\)\{[\s\S]*?\}\nfunction researchMissingRow", research_filter_fn + "\nfunction researchMissingRow", page, count=1)

research_dash_fn = "function updateResearchDashboard(){var s=$('researchStart').value,e=$('researchEnd').value,scope=$('researchDashboardClass').value;var rows=researchFiltered(s,e,scope);var ids=new Set(rows.map(function(r){return r.research_id}).filter(Boolean));setText('researchStudents',ids.size+'人');setText('researchSessions',rows.length+'件');setText('researchTotalDuration',secText(rows.reduce(function(a,r){return a+n(r.actual_duration_seconds)},0)));setText('researchAvgTurns',avg(rows.map(function(r){return r.total_turns})).toFixed(1));setText('researchAvgWords',avg(rows.map(function(r){return r.total_child_words})).toFixed(1));var ds=rows.map(dateOf).filter(Boolean).sort();setText('researchPeriod',ds.length?ds[0]+'〜'+ds[ds.length-1]:'—');setText('researchMissing',rows.filter(researchMissingRow).length+'件');var classes=scopeClasses(scope,rows),metric=$('researchMetric').value;var lab=metric==='turns'?'平均ターン数':metric==='duration'?'平均対話時間（分）':metric==='sessions'?'セッション回数':'平均発話語数';setText('researchChartTitle','期間別・学級別の'+lab);setText('researchConditionSummary','収集期間: '+(ds.length?ds[0]+'〜'+ds[ds.length-1]:'—')+' ／ 対象: '+(scope==='all'?'すべて':scope==='grade5'?'5年':scope==='grade6'?'6年':scope)+' ／ '+(researchAgg==='week'?'週別':'月別')+' ／ '+lab);$('researchLegend').innerHTML=classes.map(function(x,i){return '<span style=\"color:'+palette[i%palette.length]+'\">'+esc(x)+'</span>'}).join('');drawChart('researchChart',aggregate(rows,classes,metric,researchAgg))}"
page = re.sub(r"function updateResearchDashboard\(\)\{[\s\S]*?\}\nfunction researchGroups", research_dash_fn + "\nfunction researchGroups", page, count=1)

research_list_fn = "function renderResearchList(){var map=researchGroups();$('researchRows').innerHTML=Object.keys(map).sort().map(function(id){var rows=map[id],miss=rows.filter(researchMissingRow).length,last=rows.map(dateOf).sort().pop()||'—',totalDuration=rows.reduce(function(a,r){return a+n(r.actual_duration_seconds)},0),themes=new Set(rows.map(function(r){return r.topic}).filter(Boolean)).size;return '<tr><td><button class=\"link research-open\" data-id=\"'+esc(id)+'\">'+esc(id)+'</button></td><td>'+esc(canonClass(rows[0].class_id||''))+'</td><td>'+rows.length+'</td><td>'+secText(totalDuration)+'</td><td>'+secText(avg(rows.map(function(r){return r.actual_duration_seconds})))+'</td><td>'+avg(rows.map(function(r){return r.total_turns})).toFixed(1)+'</td><td>'+avg(rows.map(function(r){return r.total_child_words})).toFixed(1)+'</td><td>'+themes+'</td><td>'+miss+'件</td><td>'+esc(last)+'</td></tr>'}).join('');document.querySelectorAll('.research-open').forEach(function(b){b.addEventListener('click',function(){openResearch(b.dataset.id)})})}"
page = re.sub(r"function renderResearchList\(\)\{[\s\S]*?\}\nfunction openResearch", research_list_fn + "\nfunction openResearch", page, count=1)

research_summary_fn = "function updateResearchSummary(){var rows=currentResearchRows(),totalDuration=rows.reduce(function(a,r){return a+n(r.actual_duration_seconds)},0);setText('r4Sessions',rows.length+'件');setText('r4TotalDuration',secText(totalDuration));setText('r4Duration',secText(avg(rows.map(function(r){return r.actual_duration_seconds}))));setText('r4Turns',avg(rows.map(function(r){return r.total_turns})).toFixed(1));setText('r4Words',avg(rows.map(function(r){return r.total_child_words})).toFixed(1));setText('r4Themes',new Set(rows.map(function(r){return r.topic}).filter(Boolean)).size+'種');drawChart('r4TurnChart',[{name:'ターン',points:rows.map(function(r,i){return{k:dateOf(r)+'-'+String(i+1).padStart(2,'0'),v:n(r.total_turns)}})}]);drawChart('r4WordChart',[{name:'語数',points:rows.map(function(r,i){return{k:dateOf(r)+'-'+String(i+1).padStart(2,'0'),v:n(r.total_child_words)}})}]);drawChart('r4ReflectionChart',[{name:'振り返り',points:rows.map(function(r,i){return{k:dateOf(r)+'-'+String(i+1).padStart(2,'0'),v:avg([r.reflection_conveyed_ideas,r.reflection_understood_partner,r.reflection_noticed_language_culture])}})}]);$('r4Rows').innerHTML=rows.map(function(r){return '<tr><td>'+esc(r.session_id)+'</td><td>'+n(r.lifetime_session_number)+'</td><td>'+esc(dateOf(r))+'</td><td>'+esc(topicText(r.topic||''))+'</td><td>'+secText(r.actual_duration_seconds)+'</td><td>'+n(r.total_turns)+'</td><td>'+n(r.total_child_words)+'</td><td>'+(researchMissingRow(r)?'あり':'なし')+'</td><td><button class=\"link r5-open\" data-id=\"'+esc(r.session_id)+'\">'+esc(r.session_id)+'</button></td></tr>'}).join('');document.querySelectorAll('.r5-open').forEach(function(b){b.addEventListener('click',function(){openResearchSession(b.dataset.id)})})}"
page = re.sub(r"function updateResearchSummary\(\)\{[\s\S]*?\}\nfunction openResearchSession", research_summary_fn + "\nfunction openResearchSession", page, count=1)

# Load teacher: normalize class ids and backfill historical sessions from the student-code record.
old_load_teacher = "teacherSessions=Array.isArray(sd.sessions)?sd.sessions:[];studentRecords=Array.isArray(cd.students)?cd.students:[];var classes=uniqueClasses(studentRecords,'classId');"
new_load_teacher = "studentRecords=(Array.isArray(cd.students)?cd.students:[]).map(function(rec){rec.classId=canonClass(rec.classId||'');return rec});var classByStudent={};studentRecords.forEach(function(rec){classByStudent[rec.studentId]=rec.classId});teacherSessions=(Array.isArray(sd.sessions)?sd.sessions:[]).map(function(row){row.classId=canonClass(row.classId||classByStudent[row.studentId]||'');return row});var classes=uniqueClasses(studentRecords,'classId');"
page = replace_once(page, old_load_teacher, new_load_teacher, 'teacher class backfill')

old_load_research = "fillSchoolClassSelect('researchDashboardClass',null);if(classes.length&&SCHOOL_CLASSES.indexOf(classes[0])>=0)$('researchDashboardClass').value=classes[0];"
new_load_research = "fillResearchScopeSelect('researchDashboardClass');$('researchDashboardClass').value='all';"
page = replace_once(page, old_load_research, new_load_research, 'research scope select')

# Keep R3 class values canonical where possible.
page = replace_once(
    page,
    "if(grade!=='all'&&String(r.class_id||'').charAt(0)!==grade)return;",
    "if(grade!=='all'&&canonClass(r.class_id||'').charAt(0)!==grade)return;",
    'research grade normalization',
)

# Preserve dashboard filters when opening the teacher list.
page = replace_once(
    page,
    "$('dashToListBtn').addEventListener('click',function(){show('studentList');teacherStudentRows()});",
    "$('dashToListBtn').addEventListener('click',function(){$('listClass').value=$('teacherClass').value;$('listStart').value=$('teacherStart').value;$('listEnd').value=$('teacherEnd').value;show('studentList');teacherStudentRows()});",
    'teacher filter handoff',
)

page_path.write_text(page)


# QA contracts for the newly specified behavior.
qa_path = Path('scripts/qa-management-page.ts')
qa = qa_path.read_text()
qa = qa.replace("'自分の考えを伝える','相手の話を聞いて分かる','新しい言葉や文化に気づいた','わたしの学習履歴','対話時間 (TIME)'", "'自分の考えを伝える','相手の話を聞いて分かる','新しい言葉や文化に気づいた','対話時間 (TIME)'")
qa = replace_once(
    qa,
    "assert.ok(!reflectionSource.includes('もう一度練習する'), 'Retry button must not be on reflection screen');",
    "assert.ok(!reflectionSource.includes('もう一度練習する'), 'Retry button must not be on reflection screen');\nassert.ok(!reflectionSource.includes('わたしの学習履歴'), 'History button must not be on reflection screen');",
    'reflection history qa',
)
qa = replace_once(
    qa,
    "assert.ok(!appSource.includes('onOpenHistory={learningDataEnabled && learningCode ? handleOpenHistory : undefined} onRestart={handleRestart}/>}'), 'Reflection must not receive retry action');",
    "assert.ok(!appSource.includes('onOpenHistory={learningDataEnabled && learningCode ? handleOpenHistory : undefined} onRestart={handleRestart}/>}'), 'Reflection must not receive retry action');\nassert.ok(!appSource.includes('saveMessage={reflectionSaveMessage} onOpenHistory='), 'Reflection must not receive history action');",
    'app reflection history qa',
)
qa = replace_once(
    qa,
    "assert.ok(html.includes(\"actualDurationSeconds\"));",
    "assert.ok(html.includes(\"actualDurationSeconds\"));\nfor (const marker of ['teacherTotalDuration','teacherAvgDuration','teacherAvgTurns','teacherAvgWords','researchTotalDuration','researchAvgTurns','researchAvgWords','sumAvgDuration','sumTotalWords','r4TotalDuration','r4Themes']) assert.ok(html.includes(`id=\"${marker}\"`), `Information-density metric missing: ${marker}`);\nfor (const marker of ['grade5','grade6','canonClass','classMatches','scopeClasses','fillResearchScopeSelect','topicText']) assert.ok(html.includes(marker), `Linked dashboard logic missing: ${marker}`);\nassert.ok(html.includes('累積対話時間（分）'));\nconst historySource = await readFile('src/components/LearningHistoryScreen.tsx', 'utf8');\nfor (const marker of ['累計対話時間','よく話したテーマ','よく話したAI留学生','テーマ・時間・発話量','actualDurationSeconds']) assert.ok(historySource.includes(marker), `Learning history detail missing: ${marker}`);\nconst setupSource = await readFile('src/components/SetupScreen.tsx', 'utf8');\nassert.ok(setupSource.includes('min-h-[198px]'));\nassert.ok(setupSource.includes('grid-cols-[84px_minmax(0,1fr)]'));",
    'new dashboard qa',
)
qa_path.write_text(qa)

print('information-density patch applied')
