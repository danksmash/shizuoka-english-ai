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


# 1) Feedback: studentMessage must be Japanese, with a deterministic fallback guard.
server_path = Path('server.ts')
server = server_path.read_text()
server = replace_once(
    server,
    'function sanitizeStudentInput(text: string): string {\n  return text ? maskHighRiskPII(text).maskedText : \'\';\n}\n',
    "function sanitizeStudentInput(text: string): string {\n  return text ? maskHighRiskPII(text).maskedText : '';\n}\n\nfunction isPredominantlyJapanese(text: unknown): text is string {\n  if (typeof text !== 'string') return false;\n  const compact = text.trim().replace(/\\s+/g, '');\n  if (!compact) return false;\n  const japaneseCount = (compact.match(/[ぁ-んァ-ヶ一-龯々ー]/g) || []).length;\n  const latinCount = (compact.match(/[A-Za-z]/g) || []).length;\n  return japaneseCount >= 8 && japaneseCount >= latinCount;\n}\n",
    'Japanese feedback guard helper',
)
server = replace_once(
    server,
    '"studentMessage":"選択された留学生本人が、実際の対話内容に触れながら児童へ直接話す自然な短いメッセージ",',
    '"studentMessage":"選択された留学生本人が、実際の対話内容に触れながら児童へ直接話す自然な短い日本語メッセージ。必ず日本語で書き、英語文は書かない",',
    'feedback JSON schema language',
)
server = replace_once(
    server,
    'studentMessageだけは${persona.name}本人が児童に直接話しかける自然な一人称メッセージにしてください。',
    'studentMessageだけは${persona.name}本人が児童に直接話しかける自然な一人称メッセージにしてください。studentMessageは必ず日本語で書いてください。英語の文章は禁止です。児童が使った英語に触れる場合も、日本語で内容を要約してください。',
    'feedback system instruction language',
)
pattern = re.compile(r"studentMessage:\n\s+typeof parsed\.studentMessage === 'string' && parsed\.studentMessage\.trim\(\)\n\s+\? parsed\.studentMessage\.trim\(\)\n\s+: fallbackFeedback\.studentMessage,")
server, count = pattern.subn(
    "studentMessage:\n          isPredominantlyJapanese(parsed.studentMessage)\n            ? parsed.studentMessage.trim()\n            : fallbackFeedback.studentMessage,",
    server,
    count=1,
)
if count != 1:
    raise SystemExit('failed to patch feedback studentMessage guard')
server_path.write_text(server)


# 2) Teacher/research dashboards: make missing class visible and use whitespace for useful summaries.
page_path = Path('src/server/managementPage.ts')
page = page_path.read_text()
page = replace_once(page, '.toolbar{display:grid;grid-template-columns:180px 180px 180px 1fr;gap:10px;padding:14px}', '.toolbar{display:grid;grid-template-columns:180px 180px 180px 1fr;gap:10px;padding:14px}.toolbar5{grid-template-columns:170px 170px 180px minmax(260px,1fr) 210px}', 'toolbar5 css')
page = replace_once(page, '.metric b{display:block;font-size:27px;margin-top:5px}', '.metric b{display:block;font-size:30px;margin-top:4px}', 'metric font size')
page = replace_once(page, '.chart{height:270px;', '.chart{height:230px;', 'chart height')
legend_css = '.legend{display:flex;gap:12px;flex-wrap:wrap;margin:5px 0 10px;font-size:11px;font-weight:800}'
extra_css = legend_css + '.dashboard-grid{display:grid;grid-template-columns:minmax(0,1.8fr) minmax(300px,.7fr);gap:12px;align-items:stretch}.insight-stack{display:grid;grid-template-rows:1fr 1fr;gap:10px}.insight-card{border:1px solid #dbe5f2;border-radius:12px;background:#fbfdff;padding:12px;min-height:0}.insight-card h3{font-size:13px;margin:0 0 8px}.summary-list{display:grid;gap:6px}.summary-row{display:grid;grid-template-columns:minmax(86px,1fr) auto;gap:8px;align-items:center;border-bottom:1px solid #edf1f7;padding:5px 0;font-size:11px}.summary-row:last-child{border-bottom:0}.summary-row b{font-size:12px}.bar-row{display:grid;grid-template-columns:minmax(90px,1fr) minmax(70px,1.2fr) 30px;gap:6px;align-items:center;font-size:10px;margin:7px 0}.bar-track{height:7px;border-radius:999px;background:#e5edf8;overflow:hidden}.bar-fill{display:block;height:100%;border-radius:999px;background:#1260ef}.empty-note{display:grid;place-items:center;min-height:110px;color:#64748b;font-size:12px;font-weight:800;text-align:center;padding:12px}'
page = replace_once(page, legend_css, extra_css, 'dashboard insight css')
page = replace_once(page, '@media(max-width:1050px){.toolbar,.filters{grid-template-columns:repeat(2,1fr)}.grid2,.export-box{grid-template-columns:1fr}', '@media(max-width:1050px){.toolbar,.toolbar5,.filters{grid-template-columns:repeat(2,1fr)}.grid2,.export-box,.dashboard-grid{grid-template-columns:1fr}', 'responsive dashboard css')
page = replace_once(page, '@media(max-width:620px){.wrap{padding:10px}.top{align-items:flex-start;flex-direction:column}.toolbar,.filters{grid-template-columns:1fr}', '@media(max-width:620px){.wrap{padding:10px}.top{align-items:flex-start;flex-direction:column}.toolbar,.toolbar5,.filters{grid-template-columns:1fr}', 'mobile dashboard css')

teacher_section = '''<section id="teacherDashboard" class="screen teacher"><div class="screen-title"><span class="step">T2</span>学級ダッシュボード</div><div class="card toolbar"><div><label>学級</label><select id="teacherClass"></select></div><div><label>期間開始</label><input id="teacherStart" type="date"></div><div><label>期間終了</label><input id="teacherEnd" type="date"></div><div><label>表示項目</label><select id="teacherMetric"><option value="words">平均発話語数</option><option value="turns">平均ターン数</option><option value="duration">平均対話時間</option><option value="sessions">セッション回数</option></select><div class="toggle" style="margin-top:7px"><button id="teacherWeekly" class="active">週別</button><button id="teacherMonthly">月別</button></div></div></div><div class="metrics"><div class="card metric"><span>児童数</span><b id="teacherStudents">0人</b></div><div class="card metric"><span>セッション</span><b id="teacherSessions">0回</b></div><div class="card metric"><span>平均実施</span><b id="teacherAvgSessions">0回</b></div><div class="card metric"><span>未実施</span><b id="teacherNotUsed">0人</b></div></div><div class="metrics metrics6 metrics-secondary"><div class="card metric compact"><span>総対話時間</span><b id="teacherTotalDuration">0分</b></div><div class="card metric compact"><span>平均対話時間</span><b id="teacherAvgDuration">0秒</b></div><div class="card metric compact"><span>平均ターン</span><b id="teacherAvgTurns">0</b></div><div class="card metric compact"><span>平均発話語数</span><b id="teacherAvgWords">0</b></div><div class="card metric compact"><span>実施テーマ数</span><b id="teacherThemeCount">0</b></div><div class="card metric compact"><span>利用AI留学生数</span><b id="teacherPartnerCount">0</b></div></div><div class="card section"><h2 id="teacherChartTitle">学級別・平均発話語数の推移</h2><div id="teacherConditionSummary" class="condition-summary"></div><div class="dashboard-grid"><div><div id="teacherLegend" class="legend"></div><div id="teacherChart" class="chart"></div></div><div class="insight-stack"><div class="insight-card"><h3>学級別サマリー</h3><div id="teacherClassSummary" class="summary-list"></div></div><div class="insight-card"><h3>テーマ別セッション</h3><div id="teacherUsageSummary"></div></div></div></div><button id="dashToListBtn" class="secondary full">この条件で児童別一覧を見る</button></div></section>'''
page = replace_section(page, 'teacherDashboard', teacher_section)

research_section = '''<section id="researchDashboard" class="screen research"><div class="screen-title"><span class="step">R2</span>研究ダッシュボード</div><p class="note">研究者はresearch_idとclass_idを中心とした匿名化データだけを扱います。学習者用コード・氏名・学校名は表示されません。</p><div class="card toolbar toolbar5"><div><label>期間開始</label><input id="researchStart" type="date"></div><div><label>期間終了</label><input id="researchEnd" type="date"></div><div><label>集計単位</label><div class="toggle"><button id="researchWeekly">週別</button><button id="researchMonthly" class="active">月別</button></div></div><div><label>学級・学年</label><select id="researchDashboardClass"></select></div><div><label>表示項目</label><select id="researchMetric"><option value="words">平均発話語数</option><option value="turns">平均ターン数</option><option value="duration">平均対話時間</option><option value="sessions">セッション回数</option></select></div></div><div class="metrics metrics6"><div class="card metric"><span>対象児童</span><b id="researchStudents">0人</b></div><div class="card metric"><span>セッション</span><b id="researchSessions">0件</b></div><div class="card metric"><span>総対話時間</span><b id="researchTotalDuration">0分</b></div><div class="card metric"><span>平均ターン</span><b id="researchAvgTurns">0</b></div><div class="card metric"><span>平均発話語数</span><b id="researchAvgWords">0</b></div><div class="card metric"><span>欠損</span><b id="researchMissing">0件</b></div></div><div class="card section"><h2 id="researchChartTitle">期間別・学級別の平均発話語数</h2><div id="researchConditionSummary" class="condition-summary"><span>収集期間 <b id="researchPeriod">—</b></span></div><div class="dashboard-grid"><div><div id="researchLegend" class="legend"></div><div id="researchChart" class="chart"></div></div><div class="insight-stack"><div class="insight-card"><h3>学級別サマリー</h3><div id="researchClassSummary" class="summary-list"></div></div><div class="insight-card"><h3>テーマ別セッション</h3><div id="researchUsageSummary"></div></div></div></div><div class="cards3" style="margin-top:12px"><button id="researchExportShortcut" class="small-card secondary">匿名化CSVを作成</button><button id="researchListShortcut" class="small-card secondary">匿名化個別データを見る</button><button id="researchQualityShortcut" class="small-card secondary">データ品質を確認</button></div></div></section>'''
page = replace_section(page, 'researchDashboard', research_section)

page = replace_once(
    page,
    "var SCHOOL_CLASSES=['5-1','5-2','5-3','6-1','6-2','6-3','テスト','予備'];",
    "var SCHOOL_CLASSES=['5-1','5-2','5-3','6-1','6-2','6-3','テスト','予備'];var UNASSIGNED_CLASS='学級未設定';",
    'unassigned class constant',
)
old_helpers = """function classMatches(value,scope){var c=canonClass(value);if(scope==='all'||!scope)return true;if(scope==='grade5')return c.indexOf('5-')===0;if(scope==='grade6')return c.indexOf('6-')===0;return c===canonClass(scope)}
function uniqueClasses(source,key){var vals=Array.from(new Set(source.map(function(r){return canonClass(r[key]||'')}).filter(Boolean)));return SCHOOL_CLASSES.filter(function(c){return vals.indexOf(c)>=0}).concat(vals.filter(function(c){return SCHOOL_CLASSES.indexOf(c)<0}).sort())}
function fillSchoolClassSelect(id,allLabel){fillSelect(id,SCHOOL_CLASSES,allLabel)}
function fillResearchScopeSelect(id){var e=$(id);if(!e)return;e.innerHTML='<option value=\"all\">すべて</option><option value=\"grade5\">5年</option><option value=\"grade6\">6年</option>'+SCHOOL_CLASSES.map(function(v){return '<option value=\"'+esc(v)+'\">'+esc(v)+'</option>'}).join('')}
function scopeClasses(scope,rows){var available=Array.from(new Set(rows.map(function(r){return canonClass(r.class_id||r.classId||'')}).filter(function(c){return SCHOOL_CLASSES.indexOf(c)>=0})));var expected=scope==='grade5'?['5-1','5-2','5-3']:scope==='grade6'?['6-1','6-2','6-3']:scope==='all'?SCHOOL_CLASSES.slice():[canonClass(scope)];var found=expected.filter(function(c){return available.indexOf(c)>=0});return found.length?found:expected}
"""
new_helpers = """function rowClass(r){return canonClass((r&&((r.classId!==undefined?r.classId:r.class_id)))||'')||UNASSIGNED_CLASS}
function classMatches(value,scope){var c=canonClass(value)||UNASSIGNED_CLASS;if(scope==='all'||!scope)return true;if(scope==='grade5')return c.indexOf('5-')===0;if(scope==='grade6')return c.indexOf('6-')===0;if(scope===UNASSIGNED_CLASS)return c===UNASSIGNED_CLASS;return c===canonClass(scope)}
function uniqueClasses(source,key){var vals=Array.from(new Set(source.map(function(r){return canonClass(r[key]||'')}).filter(Boolean)));return SCHOOL_CLASSES.filter(function(c){return vals.indexOf(c)>=0}).concat(vals.filter(function(c){return SCHOOL_CLASSES.indexOf(c)<0}).sort())}
function fillSchoolClassSelect(id,allLabel){fillSelect(id,allLabel?SCHOOL_CLASSES.concat([UNASSIGNED_CLASS]):SCHOOL_CLASSES,allLabel)}
function fillResearchScopeSelect(id){var e=$(id);if(!e)return;e.innerHTML='<option value=\"all\">すべて</option><option value=\"grade5\">5年</option><option value=\"grade6\">6年</option>'+SCHOOL_CLASSES.concat([UNASSIGNED_CLASS]).map(function(v){return '<option value=\"'+esc(v)+'\">'+esc(v)+'</option>'}).join('')}
function scopeClasses(scope,rows){var available=Array.from(new Set(rows.map(rowClass)));var expected=scope==='grade5'?['5-1','5-2','5-3']:scope==='grade6'?['6-1','6-2','6-3']:scope==='all'?SCHOOL_CLASSES.concat([UNASSIGNED_CLASS]):[scope===UNASSIGNED_CLASS?UNASSIGNED_CLASS:canonClass(scope)];return expected.filter(function(c){return available.indexOf(c)>=0})}
"""
page = replace_once(page, old_helpers, new_helpers, 'class helper logic')

aggregate_pattern = re.compile(r"function aggregate\(rows,classes,metric,mode\)\{[\s\S]*?\}\nfunction updateTeacherDashboard")
aggregate_replacement = """function aggregate(rows,classes,metric,mode){return classes.map(function(c){var m={};rows.filter(function(r){return rowClass(r)===c}).forEach(function(r){var k=periodKey(dateOf(r),mode);if(!k)return;(m[k]||(m[k]=[])).push(metricValue(r,metric))});return{name:c,points:Object.keys(m).sort().map(function(k){return{k:k,v:metric==='sessions'?m[k].length:avg(m[k])}})}})}
function classSummaryHtml(rows,kind){if(!rows.length)return '<div class=\"empty-note\">対象データがありません</div>';var classes=scopeClasses('all',rows);return classes.map(function(c){var rs=rows.filter(function(r){return rowClass(r)===c});var ids=new Set(rs.map(function(r){return kind==='research'?r.research_id:r.studentId}).filter(Boolean));return '<div class=\"summary-row\"><span><b>'+esc(c)+'</b><br><span class=\"muted\">'+ids.size+'人・'+rs.length+'回</span></span><b>'+avg(rs.map(function(r){return r.totalChildWords||r.total_child_words})).toFixed(1)+'語</b></div>'}).join('')}
function usageSummaryHtml(rows){if(!rows.length)return '<div class=\"empty-note\">対象データがありません</div>';var counts={};rows.forEach(function(r){var k=topicText(r.topic||'');counts[k]=(counts[k]||0)+1});var items=Object.keys(counts).map(function(k){return{k:k,v:counts[k]}}).sort(function(a,b){return b.v-a.v}).slice(0,5);var max=Math.max.apply(null,items.map(function(x){return x.v}).concat([1]));var bars=items.map(function(x){return '<div class=\"bar-row\"><span>'+esc(x.k)+'</span><span class=\"bar-track\"><span class=\"bar-fill\" style=\"width:'+Math.round(x.v/max*100)+'%\"></span></span><b>'+x.v+'</b></div>'}).join('');var partners=new Set(rows.map(function(r){return r.aiStudentId||r.ai_student_id}).filter(Boolean)).size;return bars+'<div class=\"muted\" style=\"margin-top:8px;font-weight:800\">利用AI留学生 '+partners+'人 ／ テーマ '+items.length+'種</div>'}
function updateTeacherDashboard"""
page, count = aggregate_pattern.subn(aggregate_replacement, page, count=1)
if count != 1:
    raise SystemExit('failed to replace aggregate block')

teacher_pattern = re.compile(r"function updateTeacherDashboard\(\)\{[\s\S]*?\}\nfunction teacherStudentRows")
teacher_fn = """function updateTeacherDashboard(){var c=$('teacherClass').value,s=$('teacherStart').value,e=$('teacherEnd').value;var rows=teacherSessions.filter(function(r){return within(r,s,e)&&classMatches(r.classId,c)});var studentSet=new Set(rows.map(function(r){return r.studentId}));var recs=studentRecords.filter(function(r){return classMatches(r.classId,c)});setText('teacherStudents',recs.length+'人');setText('teacherSessions',rows.length+'回');setText('teacherAvgSessions',(recs.length?(rows.length/recs.length):0).toFixed(1)+'回');setText('teacherNotUsed',recs.filter(function(r){return !studentSet.has(r.studentId)}).length+'人');setText('teacherTotalDuration',secText(rows.reduce(function(a,r){return a+n(r.actualDurationSeconds)},0)));setText('teacherAvgDuration',secText(avg(rows.map(function(r){return r.actualDurationSeconds}))));setText('teacherAvgTurns',avg(rows.map(function(r){return r.totalTurns})).toFixed(1));setText('teacherAvgWords',avg(rows.map(function(r){return r.totalChildWords})).toFixed(1));setText('teacherThemeCount',new Set(rows.map(function(r){return r.topic}).filter(Boolean)).size+'種');setText('teacherPartnerCount',new Set(rows.map(function(r){return r.aiStudentId}).filter(Boolean)).size+'人');var classes=c==='all'?scopeClasses('all',rows):scopeClasses(c,rows);var metric=$('teacherMetric').value;var label=metric==='turns'?'平均ターン数':metric==='duration'?'平均対話時間（分）':metric==='sessions'?'セッション回数':'平均発話語数';setText('teacherChartTitle','学級別・'+label+'の推移');setText('teacherConditionSummary','学級: '+(c==='all'?'すべて':c)+' ／ 期間: '+(s||'—')+'〜'+(e||'—')+' ／ '+(teacherAgg==='week'?'週別':'月別')+' ／ '+label);$('teacherLegend').innerHTML=classes.map(function(x,i){return '<span style=\"color:'+palette[i%palette.length]+'\">'+esc(x)+'</span>'}).join('');drawChart('teacherChart',aggregate(rows,classes,metric,teacherAgg));$('teacherClassSummary').innerHTML=classSummaryHtml(rows,'teacher');$('teacherUsageSummary').innerHTML=usageSummaryHtml(rows)}
function teacherStudentRows"""
page, count = teacher_pattern.subn(teacher_fn, page, count=1)
if count != 1:
    raise SystemExit('failed to replace teacher dashboard function')

research_pattern = re.compile(r"function updateResearchDashboard\(\)\{[\s\S]*?\}\nfunction researchGroups")
research_fn = """function updateResearchDashboard(){var s=$('researchStart').value,e=$('researchEnd').value,scope=$('researchDashboardClass').value;var rows=researchFiltered(s,e,scope);var ids=new Set(rows.map(function(r){return r.research_id}).filter(Boolean));setText('researchStudents',ids.size+'人');setText('researchSessions',rows.length+'件');setText('researchTotalDuration',secText(rows.reduce(function(a,r){return a+n(r.actual_duration_seconds)},0)));setText('researchAvgTurns',avg(rows.map(function(r){return r.total_turns})).toFixed(1));setText('researchAvgWords',avg(rows.map(function(r){return r.total_child_words})).toFixed(1));var ds=rows.map(dateOf).filter(Boolean).sort();setText('researchPeriod',ds.length?ds[0]+'〜'+ds[ds.length-1]:'—');setText('researchMissing',rows.filter(researchMissingRow).length+'件');var classes=scopeClasses(scope,rows),metric=$('researchMetric').value;var lab=metric==='turns'?'平均ターン数':metric==='duration'?'平均対話時間（分）':metric==='sessions'?'セッション回数':'平均発話語数';setText('researchChartTitle','期間別・学級別の'+lab);setText('researchConditionSummary','収集期間: '+(ds.length?ds[0]+'〜'+ds[ds.length-1]:'—')+' ／ 対象: '+(scope==='all'?'すべて':scope==='grade5'?'5年':scope==='grade6'?'6年':scope)+' ／ '+(researchAgg==='week'?'週別':'月別')+' ／ '+lab);$('researchLegend').innerHTML=classes.map(function(x,i){return '<span style=\"color:'+palette[i%palette.length]+'\">'+esc(x)+'</span>'}).join('');drawChart('researchChart',aggregate(rows,classes,metric,researchAgg));$('researchClassSummary').innerHTML=classSummaryHtml(rows,'research');$('researchUsageSummary').innerHTML=usageSummaryHtml(rows)}
function researchGroups"""
page, count = research_pattern.subn(research_fn, page, count=1)
if count != 1:
    raise SystemExit('failed to replace research dashboard function')

page = page.replace("esc(canonClass(rows[0].class_id||''))", "esc(rowClass(rows[0]))", 1)
page_path.write_text(page)


# 3) QA contract updates.
qa_path = Path('scripts/qa-management-page.ts')
qa = qa_path.read_text()
qa = replace_once(qa, "assert.ok(setupSource.includes('min-h-[198px]'));\nassert.ok(setupSource.includes('grid-cols-[84px_minmax(0,1fr)]'));", "assert.ok(setupSource.includes('min-h-[174px]'));\nassert.ok(setupSource.includes('grid-cols-[72px_minmax(0,1fr)]'));\nassert.ok(setupSource.includes('max-w-[170px]'));", 'setup compact QA')
qa = replace_once(qa, "assert.ok(serverSource.includes(\"requireManagementRole(['researcher'])\"));", "assert.ok(serverSource.includes(\"requireManagementRole(['researcher'])\"));\nassert.ok(serverSource.includes('isPredominantlyJapanese'), 'Japanese feedback guard missing');\nassert.ok(serverSource.includes('studentMessageは必ず日本語で書いてください'), 'Japanese feedback prompt requirement missing');", 'server Japanese QA')
qa = replace_once(qa, "for (const marker of ['teacherTotalDuration','teacherAvgDuration','teacherAvgTurns','teacherAvgWords','researchTotalDuration','researchAvgTurns','researchAvgWords','sumAvgDuration','sumTotalWords','r4TotalDuration','r4Themes'])", "for (const marker of ['teacherTotalDuration','teacherAvgDuration','teacherAvgTurns','teacherAvgWords','teacherClassSummary','teacherUsageSummary','researchTotalDuration','researchAvgTurns','researchAvgWords','researchClassSummary','researchUsageSummary','sumAvgDuration','sumTotalWords','r4TotalDuration','r4Themes'])", 'dashboard summary QA')
qa = replace_once(qa, "for (const marker of ['grade5','grade6','canonClass','classMatches','scopeClasses','fillResearchScopeSelect','topicText'])", "for (const marker of ['grade5','grade6','canonClass','classMatches','scopeClasses','fillResearchScopeSelect','topicText','UNASSIGNED_CLASS','rowClass','学級未設定'])", 'unassigned class QA')
qa_path.write_text(qa)

print('feedback/charts/layout patch applied')
