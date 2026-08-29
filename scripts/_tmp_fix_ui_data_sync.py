from pathlib import Path
import re


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing replacement marker in {path}: {old[:120]}')
    text = text.replace(old, new, 1)
    p.write_text(text)


def regex_once(path: str, pattern: str, replacement: str):
    p = Path(path)
    text = p.read_text()
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'regex replacement count {count} in {path}: {pattern[:120]}')
    p.write_text(updated)

# 1) Dialogue sidebar: never shrink and clip the speech-rate slider.
replace_once(
    'src/components/AIStudentCard.tsx',
    'className="bg-white rounded-3xl p-3.5 sm:p-4 border border-slate-200 shadow-sm flex flex-col items-center text-center relative overflow-hidden"',
    'className="bg-white rounded-3xl p-3.5 sm:p-4 border border-slate-200 shadow-sm flex shrink-0 flex-col items-center text-center relative overflow-hidden"',
)
replace_once(
    'src/App.tsx',
    'className="bg-slate-800 p-5 rounded-3xl text-white shadow-sm"',
    'className="shrink-0 bg-slate-800 p-5 rounded-3xl text-white shadow-sm"',
)

# 2) Feedback: remove the redundant Key Expressions block while preserving the two grounded learning-expression panels.
replace_once(
    'src/components/FeedbackScreen.tsx',
    'import { Award, BarChart3, BookOpen, CheckCircle2, MessageSquare, RotateCcw, Sparkles, TrendingUp, Volume2 } from \'lucide-react\';',
    'import { Award, BarChart3, BookOpen, CheckCircle2, RotateCcw, Sparkles, TrendingUp, Volume2 } from \'lucide-react\';',
)
regex_once(
    'src/components/FeedbackScreen.tsx',
    r"\n  const uniqueKeyPhrases = \(feedback\?\.keyPhrases \|\| \[\]\)\.filter\(\(phrase, index, all\) => \{.*?\n  \}\);\n",
    '\n',
)
regex_once(
    'src/components/FeedbackScreen.tsx',
    r"\n\s*\{uniqueKeyPhrases\.length > 0 && <section className=.*?</section>\}\n",
    '\n',
)

# 3) Research export: old sessions saved before event logging must not become interrupted solely because session_finish did not exist yet.
replace_once(
    'src/server/researchExport.ts',
    """    const hasReflection = Boolean(session.reflection && typeof session.reflection === 'object');
    const hasSessionFinish = systemEvents.some((event: any) => event?.type === 'session_finish');
    const dataQuality = !sessionId || !session.researchId || history.length === 0 || childMessages.length === 0
      ? 'missing_core'
      : !hasSessionFinish ? 'interrupted'
      : !hasReflection ? 'missing_reflection' : 'complete';
    const sessionStatus = hasSessionFinish ? (hasReflection ? 'complete' : 'dialogue_complete') : 'in_progress_or_interrupted';
""",
    """    const hasReflection = Boolean(session.reflection && typeof session.reflection === 'object');
    const hasSessionFinish = systemEvents.some((event: any) => event?.type === 'session_finish');
    const schemaVersion = Number(session.schemaVersion || 0);
    const legacyCompletionEvidence = Boolean(session.endedAt) && hasReflection && (systemEvents.length === 0 || schemaVersion < 3);
    const dialogueCompleted = hasSessionFinish || legacyCompletionEvidence;
    const dataQuality = !sessionId || !session.researchId || history.length === 0 || childMessages.length === 0
      ? 'missing_core'
      : !dialogueCompleted ? 'interrupted'
      : !hasReflection ? 'missing_reflection' : 'complete';
    const sessionStatus = dialogueCompleted ? (hasReflection ? 'complete' : 'dialogue_complete') : 'in_progress_or_interrupted';
""",
)
replace_once(
    'src/server/researchExport.ts',
    '      session_completed: hasSessionFinish ? 1 : 0,',
    '      session_completed: dialogueCompleted ? 1 : 0,',
)

# 4) Management dashboard: daily aggregation, timezone-safe weekly boundaries, filter/series synchronization, metric-linked statistics, export descriptions.
p = Path('src/server/managementPage.ts')
text = p.read_text()

text = text.replace(
    '.checklist label{display:block;margin:8px 0;font-size:12px;font-weight:700}',
    '.checklist label{display:block;margin:8px 0;font-size:12px;font-weight:700}.dataset-list{display:grid;gap:10px;margin:12px 0}.dataset-card{border:1px solid #cbd9ee;border-radius:12px;background:#f9fbff;padding:12px}.dataset-card h3{margin:0 0 5px;font-size:13px}.dataset-card p{margin:3px 0;color:#526581;font-size:11px;line-height:1.5}.dataset-card .dataset-meta{color:#174aa8;font-weight:800}.dataset-card button{width:100%;margin-top:8px}',
    1,
)
text = text.replace(
    '<div class="toggle" style="margin-top:7px"><button id="teacherWeekly" class="active">週別</button><button id="teacherMonthly">月別</button></div>',
    '<div class="toggle" style="margin-top:7px"><button id="teacherDaily" class="active">日別</button><button id="teacherWeekly">週別</button><button id="teacherMonthly">月別</button></div>',
    1,
)
text = text.replace(
    '<div><label>集計単位</label><div class="toggle"><button id="researchWeekly">週別</button><button id="researchMonthly" class="active">月別</button></div></div>',
    '<div><label>集計単位</label><div class="toggle"><button id="researchDaily" class="active">日別</button><button id="researchWeekly">週別</button><button id="researchMonthly">月別</button></div></div>',
    1,
)
text = text.replace('<span>中央値・発話語数</span><b id="researchMedianWords">0</b>', '<span id="researchMedianLabel">中央値・発話語数</span><b id="researchMedianWords">0</b>', 1)
text = text.replace('<span>SD・発話語数</span><b id="researchSdWords">0</b>', '<span id="researchSdLabel">SD・発話語数</span><b id="researchSdWords">0</b>', 1)

old_export = '''<div class="checklist"><label><input type="checkbox" checked disabled style="width:auto"> sessions.csv：セッション・学校内外推定・発話指標・振り返り</label><label><input type="checkbox" checked disabled style="width:auto"> turns.csv：PIIマスキング済み匿名化発話・turn単位指標</label><label><input type="checkbox" checked disabled style="width:auto"> expressions.csv：5・6年教科書語彙・表現の実出現</label><label><input type="checkbox" checked disabled style="width:auto"> system_events.csv：支援機能の操作イベント</label></div><p class="note">学習者用コード・氏名・学校名は出力しません。turns.csvの発話本文は保存時にPIIマスキング済みの匿名化本文です。研究者画面上には本文を表示しません。</p><button id="csvBtn" class="primary full">sessions.csv を作成</button><button id="turnsCsvBtn" class="secondary full">turns.csv を作成</button><button id="expressionsCsvBtn" class="secondary full">expressions.csv を作成</button><button id="eventsCsvBtn" class="secondary full">system_events.csv を作成</button><button id="bundleCsvBtn" class="primary full">4CSV＋manifestを一括ZIP出力</button>'''
new_export = '''<div class="dataset-list">
<div class="dataset-card"><h3>sessions.csv ― セッション単位の主要分析データ</h3><p><b>1行＝1回の対話。</b> research_id、class_id、開始・終了日時、授業内外推定、通算回数、テーマ、対話時間、発話語数・ターン・異なり語数、質問/repair、教科書語彙、振り返り、欠測状態を収録します。</p><p class="dataset-meta">向いている分析：縦断変化、学校内外比較、利用回数と発話量・振り返りの関連</p><button id="csvBtn" class="primary">sessions.csv だけを作成</button></div>
<div class="dataset-card"><h3>turns.csv ― 匿名化した発話単位データ</h3><p><b>1行＝1発話。</b> session_id、turn順、話者、ローカル時刻、PIIマスキング済み英語・日本語訳、語数、質問タイプ、質問返し、repair、because表現を収録します。</p><p class="dataset-meta">向いている分析：interaction coding、発話内容の再コーディング、コミュニケーション行動分析</p><button id="turnsCsvBtn" class="secondary">turns.csv だけを作成</button></div>
<div class="dataset-card"><h3>expressions.csv ― 5・6年教科書語彙・表現データ</h3><p><b>1行＝1つの実出現表現。</b> session_id、turn順、話者、語彙・表現、意味、カテゴリ、学年、Unit、固定教科書辞書との対応を収録します。</p><p class="dataset-meta">向いている分析：教科書語彙の使用、AI inputと児童output、語彙・表現の縦断変化</p><button id="expressionsCsvBtn" class="secondary">expressions.csv だけを作成</button></div>
<div class="dataset-card"><h3>system_events.csv ― 学習支援機能・操作ログ</h3><p><b>1行＝1操作イベント。</b> session_id、時刻、マイク、文字入力、お助け、聞き直し、Vocabulary、発話速度変更、AI応答時間、通信失敗などを収録します。</p><p class="dataset-meta">向いている分析：JSET向け学習プロセス、支援機能利用、学校内外での利用行動</p><button id="eventsCsvBtn" class="secondary">system_events.csv だけを作成</button></div>
</div><p class="note">学習者用コード・氏名・学校名は出力しません。turns.csvの発話本文は研究用PIIマスキング済みです。4種類を同じ時点・同じ条件で結合分析するときは下の一括ZIPを使ってください。</p><button id="bundleCsvBtn" class="primary full">4CSV＋manifestを同一スナップショットで一括ZIP出力</button>'''
if old_export not in text:
    raise SystemExit('R6 export block marker not found')
text = text.replace(old_export, new_export, 1)

text = text.replace("var teacherAgg='week';var researchAgg='month';", "var teacherAgg='day';var researchAgg='day';", 1)
text = text.replace(
    "function periodKey(d,mode){if(!d)return'';if(mode==='month')return d.slice(0,7);var dt=new Date(d+'T00:00:00');var day=(dt.getDay()+6)%7;dt.setDate(dt.getDate()-day);return dt.toISOString().slice(0,10)}",
    "function periodKey(d,mode){if(!d)return'';if(mode==='day')return d;if(mode==='month')return d.slice(0,7);var dt=new Date(d+'T00:00:00Z');var day=(dt.getUTCDay()+6)%7;dt.setUTCDate(dt.getUTCDate()-day);return dt.toISOString().slice(0,10)}\nfunction aggLabel(mode){return mode==='day'?'日別':mode==='week'?'週別':'月別'}\nfunction axisLabel(k){if(!k)return'';if(k.length===7)return k.replace('-', '/');return k.slice(5).replace('-', '/')}\nfunction metricLabel(metric){return metric==='turns'?'ターン数':metric==='duration'?'対話時間（分）':metric==='reflection'?'振り返り平均':metric==='sessions'?'セッション回数':'発話語数'}\nfunction metricUnit(metric){return metric==='turns'?'回':metric==='duration'?'分':metric==='reflection'?'点':metric==='sessions'?'件':'語'}\nfunction metricDisplay(value,metric){var v=n(value);return (metric==='reflection'?v.toFixed(2):v.toFixed(1))+metricUnit(metric)}",
    1,
)
text = text.replace(
    "function aggregate(rows,classes,metric,mode,research){return classes.map(function(c){var m={};rows.filter(function(r){return rowClass(r)===c}).forEach(function(r){var k=periodKey(dateOf(r),mode);if(!k)return;(m[k]||(m[k]=[])).push(metricValue(r,metric,research))});return{name:c,points:Object.keys(m).sort().map(function(k){return{k:k,v:metric==='sessions'?m[k].length:avg(m[k])}})}})}",
    "function aggregate(rows,classes,metric,mode,research){return classes.map(function(c){var m={};rows.filter(function(r){return c==='すべて'||rowClass(r)===c}).forEach(function(r){var k=periodKey(dateOf(r),mode);if(!k)return;(m[k]||(m[k]=[])).push(metricValue(r,metric,research))});return{name:c,points:Object.keys(m).sort().map(function(k){return{k:k,v:metric==='sessions'?m[k].length:avg(m[k])}})}})}",
    1,
)
text = text.replace("esc(k.slice(5))", "esc(axisLabel(k))", 1)
text = text.replace(
    "function topicText(v){var map={intro:'じこしょうかい＆あいさつ',favorites:'すきなもの・すきなこと',culture:'静岡のじまん＆世界の文化',abilities:'できること・得意なこと',free:'じゆうトーク・おしゃべり'};return map[String(v||'')]||String(v||'—')}",
    "function topicText(v){var map={intro:'じこしょうかい＆あいさつ',favorites:'すきなもの・すきなこと',shizuoka_culture:'静岡のじまん＆世界の文化',culture:'静岡のじまん＆世界の文化',talents:'できること・得意なこと',abilities:'できること・得意なこと',free:'じゆうトーク・おしゃべり'};return map[String(v||'')]||String(v||'—')}",
    1,
)
text = text.replace(
    "function stageSummaryHtml(rows){var groups={'1回目':[],'2〜3回目':[],'4〜6回目':[],'7回目以上':[]};rows.forEach(function(r){var k=n(r.lifetime_session_number);var g=k<=1?'1回目':k<=3?'2〜3回目':k<=6?'4〜6回目':'7回目以上';groups[g].push(r)});return Object.keys(groups).map(function(g){var rs=groups[g];return '<div class=\"summary-row\"><span><b>'+g+'</b><br><span class=\"muted\">n='+rs.length+'</span></span><b>'+median(rs.map(function(r){return r.total_child_words})).toFixed(1)+'語</b></div>'}).join('')}",
    "function stageSummaryHtml(rows,metric){var groups={'1回目':[],'2〜3回目':[],'4〜6回目':[],'7回目以上':[]};rows.forEach(function(r){var k=n(r.lifetime_session_number);var g=k<=1?'1回目':k<=3?'2〜3回目':k<=6?'4〜6回目':'7回目以上';groups[g].push(r)});return Object.keys(groups).map(function(g){var rs=groups[g],value=metric==='sessions'?rs.length+'件':metricDisplay(median(rs.map(function(r){return metricValue(r,metric,true)})),metric);return '<div class=\"summary-row\"><span><b>'+g+'</b><br><span class=\"muted\">n='+rs.length+'</span></span><b>'+value+'</b></div>'}).join('')}",
    1,
)

old_research_update = re.search(r"function updateResearchDashboard\(\)\{.*?\}\nfunction researchGroups", text, re.S)
if not old_research_update:
    raise SystemExit('updateResearchDashboard not found')
new_research_update = """function updateResearchDashboard(){var s=$('researchStart').value,e=$('researchEnd').value,scope=$('researchDashboardClass').value,rows=researchFiltered(s,e,scope),ids=new Set(rows.map(function(r){return r.research_id}).filter(Boolean)),missing=rows.filter(researchMissingRow),complete=rows.length-missing.length,metric=$('researchMetric').value,metricValues=researchMetricValues(rows,metric),lab=metricLabel(metric);setText('researchStudents',ids.size);setText('researchSessions',rows.length);setText('researchCompleteCases',complete);setText('researchMissingRate',(rows.length?Math.round(missing.length/rows.length*100):0)+'%');setText('researchMedianLabel','中央値・'+lab);setText('researchSdLabel','SD・'+lab);setText('researchMedianWords',metricDisplay(median(metricValues),metric));setText('researchSdWords',metricDisplay(stdDev(metricValues),metric));setText('researchAvgTurns',avg(rows.map(function(r){return r.total_turns})).toFixed(1));setText('researchAvgDuration',secText(avg(rows.map(function(r){return r.actual_duration_seconds}))));var ds=rows.map(dateOf).filter(Boolean).sort(),classes=scope==='all'?(rows.length?['すべて']:[]):scopeClasses(scope,rows);setText('researchPeriod',ds.length?ds[0]+'〜'+ds[ds.length-1]:'—');setText('researchChartTitle','匿名化データ：'+lab+'の推移');setText('researchConditionSummary','収集期間: '+(ds.length?ds[0]+'〜'+ds[ds.length-1]:'—')+' ／ 対象: '+(scope==='all'?'すべて':scope==='grade5'?'5年':scope==='grade6'?'6年':scope)+' ／ '+aggLabel(researchAgg)+' ／ '+lab);$('researchLegend').innerHTML=classes.map(function(x,i){return '<span style=\"color:'+palette[i%palette.length]+'\">'+esc(x)+'</span>'}).join('');drawChart('researchChart',aggregate(rows,classes,metric,researchAgg,true));$('researchDescriptiveStats').innerHTML=researchStatsHtml(rows,metric);$('researchStageSummary').innerHTML=stageSummaryHtml(rows,metric);$('researchUsageSummary').innerHTML=usageSummaryHtml(rows)}
function researchGroups"""
text = text[:old_research_update.start()] + new_research_update + text[old_research_update.end():]

text = text.replace(
    "setText('teacherConditionSummary','学級: '+(c==='all'?'すべて':c)+' ／ 期間: '+(s||'—')+'〜'+(e||'—')+' ／ '+(teacherAgg==='week'?'週別':'月別')+' ／ '+label)",
    "setText('teacherConditionSummary','学級: '+(c==='all'?'すべて':c)+' ／ 期間: '+(s||'—')+'〜'+(e||'—')+' ／ '+aggLabel(teacherAgg)+' ／ '+label)",
    1,
)
text = text.replace(
    "var d=new Date(b.max+'T00:00:00');d.setMonth(d.getMonth()-(mode==='1m'?1:3));$('summaryStart').value=d.toISOString().slice(0,10)",
    "var d=new Date(b.max+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()-(mode==='1m'?1:3));$('summaryStart').value=d.toISOString().slice(0,10)",
    1,
)
text = text.replace(
    "function rowStatus(r,dups){var missing=researchMissingRow(r),review=n(r.total_turns)===0||n(r.total_child_words)===0;if(dups[r.session_id]>1)return['重複','同一session_id'];if(missing)return['欠損','必須指標欠損'];if(review)return['要確認','ターン数または発話語数が0'];return['正常','—']}",
    "function rowStatus(r,dups){var missing=researchMissingRow(r),review=n(r.total_turns)===0||n(r.total_child_words)===0;if(dups[r.session_id]>1)return['重複','同一session_id'];if(missing){var flag=String(r.data_quality_flag||'');return['欠損',flag==='missing_reflection'?'振り返り未回答':flag==='interrupted'?'対話途中で終了':'必須指標欠損']}if(review)return['要確認','ターン数または発話語数が0'];return['正常','—']}",
    1,
)

old_teacher_events = "$('teacherWeekly').addEventListener('click',function(){teacherAgg='week';this.classList.add('active');$('teacherMonthly').classList.remove('active');updateTeacherDashboard()});$('teacherMonthly').addEventListener('click',function(){teacherAgg='month';this.classList.add('active');$('teacherWeekly').classList.remove('active');updateTeacherDashboard()});"
new_teacher_events = "$('teacherDaily').addEventListener('click',function(){teacherAgg='day';this.classList.add('active');$('teacherWeekly').classList.remove('active');$('teacherMonthly').classList.remove('active');updateTeacherDashboard()});$('teacherWeekly').addEventListener('click',function(){teacherAgg='week';this.classList.add('active');$('teacherDaily').classList.remove('active');$('teacherMonthly').classList.remove('active');updateTeacherDashboard()});$('teacherMonthly').addEventListener('click',function(){teacherAgg='month';this.classList.add('active');$('teacherDaily').classList.remove('active');$('teacherWeekly').classList.remove('active');updateTeacherDashboard()});"
if old_teacher_events not in text:
    raise SystemExit('teacher aggregate events marker not found')
text = text.replace(old_teacher_events, new_teacher_events, 1)
old_research_events = "$('researchWeekly').addEventListener('click',function(){researchAgg='week';this.classList.add('active');$('researchMonthly').classList.remove('active');updateResearchDashboard()});$('researchMonthly').addEventListener('click',function(){researchAgg='month';this.classList.add('active');$('researchWeekly').classList.remove('active');updateResearchDashboard()});"
new_research_events = "$('researchDaily').addEventListener('click',function(){researchAgg='day';this.classList.add('active');$('researchWeekly').classList.remove('active');$('researchMonthly').classList.remove('active');updateResearchDashboard()});$('researchWeekly').addEventListener('click',function(){researchAgg='week';this.classList.add('active');$('researchDaily').classList.remove('active');$('researchMonthly').classList.remove('active');updateResearchDashboard()});$('researchMonthly').addEventListener('click',function(){researchAgg='month';this.classList.add('active');$('researchDaily').classList.remove('active');$('researchWeekly').classList.remove('active');updateResearchDashboard()});"
if old_research_events not in text:
    raise SystemExit('research aggregate events marker not found')
text = text.replace(old_research_events, new_research_events, 1)

p.write_text(text)

# 5) Management contract QA updates.
p = Path('scripts/qa-management-page.ts')
text = p.read_text()
text = text.replace("'teacherWeekly','teacherMonthly'", "'teacherDaily','teacherWeekly','teacherMonthly'")
text = text.replace("'researchWeekly','researchMonthly'", "'researchDaily','researchWeekly','researchMonthly'")
text = text.replace("'researchMedianWords','researchSdWords'", "'researchMedianWords','researchSdWords','researchMedianLabel','researchSdLabel'")
text = text.replace(
    "for (const marker of ['からのメッセージ','よくできたところ (Good Points)','自分が使ったことば','AI留学生から出会ったことば','根拠となる実際の発話','次へのステップアップ (Next Step Advice)','重要キーフレーズ (Key Expressions)','対話の文字起こしと日本語訳','日本語訳','もう一度練習する'])",
    "for (const marker of ['からのメッセージ','よくできたところ (Good Points)','自分が使ったことば','AI留学生から出会ったことば','根拠となる実際の発話','次へのステップアップ (Next Step Advice)','対話の文字起こしと日本語訳','日本語訳','もう一度練習する'])",
)
insert = """
assert.ok(!feedbackSource.includes('重要キーフレーズ (Key Expressions)'), 'Redundant Key Expressions panel must be removed');
assert.ok(html.includes('sessions.csv ― セッション単位の主要分析データ'), 'R6 must explain sessions.csv');
assert.ok(html.includes('turns.csv ― 匿名化した発話単位データ'), 'R6 must explain turns.csv');
assert.ok(html.includes('expressions.csv ― 5・6年教科書語彙・表現データ'), 'R6 must explain expressions.csv');
assert.ok(html.includes('system_events.csv ― 学習支援機能・操作ログ'), 'R6 must explain system_events.csv');
assert.ok(html.includes("var teacherAgg='day';var researchAgg='day';"), 'Teacher/research charts must default to daily aggregation');
assert.ok(html.includes("mode==='day'"), 'Daily aggregation logic missing');
assert.ok(html.includes("T00:00:00Z") && html.includes('getUTCDay') && html.includes('setUTCDate'), 'Weekly boundaries must be timezone-safe');
assert.ok(html.includes("scope==='all'?(rows.length?['すべて']:[])"), 'Research all-scope chart must use an all-data series rather than unassigned class');
assert.ok(html.includes('stageSummaryHtml(rows,metric)'), 'Longitudinal stage summary must follow selected metric');
assert.ok(html.includes("shizuoka_culture:'静岡のじまん＆世界の文化'"), 'Current culture topic ID must map correctly');
assert.ok(html.includes("talents:'できること・得意なこと'"), 'Current talents topic ID must map correctly');
const aiCardSource = await readFile('src/components/AIStudentCard.tsx', 'utf8');
assert.ok(aiCardSource.includes('flex shrink-0 flex-col'), 'Dialogue AI card must not shrink and clip the speech-rate slider');
assert.ok(aiCardSource.includes('type=\"range\"') && aiCardSource.includes('AIが話す速さ'), 'Speech-rate slider must remain visible and functional');
"""
marker = "assert.ok(!feedbackSource.includes('window.print()'));"
if marker not in text:
    raise SystemExit('QA feedback insertion marker not found')
text = text.replace(marker, marker + insert, 1)
p.write_text(text)

# 6) Research QA: legacy completion compatibility.
p = Path('scripts/qa-research-integrated.ts')
text = p.read_text()
legacy_test = """
const legacyComplete = buildResearchDataSets([{...clustered[0], schemaVersion:2, sessionId:'legacy_complete', reflection:{conveyedIdeas:3,understoodPartner:4,noticedLanguageCulture:3}, systemEvents:[]}]).sessions[0];
assert.equal(legacyComplete.data_quality_flag,'complete','pre-event legacy session with reflection must remain a complete case');
assert.equal(legacyComplete.session_status,'complete','legacy completed session status must be inferred');
assert.equal(legacyComplete.session_completed,1,'legacy completed session must not be reclassified as interrupted');
"""
marker = "const weekendRow = data.sessions.find((row) => row.session_id === 'session_weekend')!;"
if marker not in text:
    raise SystemExit('research QA insertion marker not found')
text = text.replace(marker, legacy_test + '\n' + marker, 1)
p.write_text(text)

# 7) Add runtime QA for actual inline management filter/graph logic.
Path('scripts/qa-dashboard-data-sync.ts').write_text(r'''import assert from 'node:assert/strict';
import vm from 'node:vm';
import { managementPageHtml } from '../src/server/managementPage';

const html = managementPageHtml();
const match = html.match(/<script>([\s\S]*?)<\/script>/);
if (!match) throw new Error('management script missing');

const elements = new Map<string, any>();
function element(id: string) {
  if (!elements.has(id)) {
    const classes = new Set<string>();
    elements.set(id, {
      id, value: '', checked: false, innerHTML: '', textContent: '', style: {}, options: [], dataset: {},
      classList: { add: (...xs: string[]) => xs.forEach((x) => classes.add(x)), remove: (...xs: string[]) => xs.forEach((x) => classes.delete(x)), contains: (x: string) => classes.has(x) },
      addEventListener: () => {}, appendChild: () => {}, remove: () => {}, click: () => {},
    });
  }
  return elements.get(id);
}
const documentStub = {
  getElementById: (id: string) => element(id),
  querySelectorAll: () => [] as any[],
  createElement: (tag: string) => element('created-' + tag + '-' + Math.random()),
  body: { appendChild: () => {} },
};
const context: any = {
  console, document: documentStub, window: {}, location: { reload: () => {} }, alert: () => {},
  fetch: async () => ({ ok: false, json: async () => ({}) }),
  URL, URLSearchParams, Blob, Set, Map, Math, Number, String, Array, Object, Date,
  setTimeout: () => 0, clearTimeout: () => {},
};
vm.createContext(context);
vm.runInContext(match[1], context, { filename: 'management-data-sync.js' });

assert.equal(context.periodKey('2026-08-28', 'day'), '2026-08-28');
assert.equal(context.periodKey('2026-08-28', 'week'), '2026-08-24', 'Friday in JST week must start Monday without UTC day shift');
assert.equal(context.periodKey('2026-08-29', 'month'), '2026-08');

context.researchData = [
  { research_id:'R-A', class_id:'', session_id:'s1', local_date:'2026-08-28', total_turns:'2', total_child_words:'10', actual_duration_seconds:'60', lifetime_session_number:'1', data_quality_flag:'complete', reflection_conveyed_ideas:'3', reflection_understood_partner:'4', reflection_noticed_language_culture:'3', topic:'shizuoka_culture' },
  { research_id:'R-A', class_id:'', session_id:'s2', local_date:'2026-08-29', total_turns:'4', total_child_words:'30', actual_duration_seconds:'120', lifetime_session_number:'2', data_quality_flag:'complete', reflection_conveyed_ideas:'4', reflection_understood_partner:'4', reflection_noticed_language_culture:'5', topic:'talents' },
  { research_id:'R-B', class_id:'5-1', session_id:'s3', local_date:'2026-08-29', total_turns:'6', total_child_words:'50', actual_duration_seconds:'180', lifetime_session_number:'1', data_quality_flag:'complete', reflection_conveyed_ideas:'5', reflection_understood_partner:'5', reflection_noticed_language_culture:'5', topic:'favorites' },
];
element('researchStart').value = '2026-08-28';
element('researchEnd').value = '2026-08-29';
element('researchDashboardClass').value = 'all';
element('researchMetric').value = 'words';
context.researchAgg = 'day';
context.updateResearchDashboard();
assert.equal(element('researchSessions').textContent, 3);
assert.ok(element('researchLegend').innerHTML.includes('すべて'));
assert.ok(!element('researchLegend').innerHTML.includes('学級未設定'), 'all scope must not be mislabeled as unassigned class');
assert.ok(element('researchChart').innerHTML.includes('08/28') && element('researchChart').innerHTML.includes('08/29'), 'daily chart must show each selected date');
assert.ok(element('researchConditionSummary').textContent.includes('日別'));
assert.ok(element('researchUsageSummary').innerHTML.includes('静岡のじまん＆世界の文化'));
assert.ok(element('researchUsageSummary').innerHTML.includes('できること・得意なこと'));
assert.ok(element('researchMedianLabel').textContent.includes('発話語数'));
assert.ok(element('researchStageSummary').innerHTML.includes('語'));

// Changing analysis metric must update both descriptive/stat cards and lifetime-stage summary.
element('researchMetric').value = 'turns';
context.updateResearchDashboard();
assert.ok(element('researchMedianLabel').textContent.includes('ターン数'));
assert.ok(element('researchStageSummary').innerHTML.includes('回'));
assert.ok(!element('researchStageSummary').innerHTML.includes('語</b>'), 'stage summary must not remain hard-wired to word count');

// Date and class dropdowns must filter every dependent R2 summary consistently.
element('researchDashboardClass').value = '5-1';
context.updateResearchDashboard();
assert.equal(element('researchSessions').textContent, 1);
assert.ok(element('researchConditionSummary').textContent.includes('対象: 5-1'));
element('researchDashboardClass').value = 'all';
element('researchStart').value = '2026-08-29';
context.updateResearchDashboard();
assert.equal(element('researchSessions').textContent, 2);
assert.ok(!element('researchChart').innerHTML.includes('08/28'));

console.log('Dashboard data/filter synchronization QA: PASS');
''')

# 8) Wire the new QA into the full suite.
p = Path('package.json')
text = p.read_text()
text = text.replace('"qa:research": "tsx scripts/qa-research-integrated.ts"', '"qa:research": "tsx scripts/qa-research-integrated.ts",\n    "qa:dashboard": "tsx scripts/qa-dashboard-data-sync.ts"')
text = text.replace('npm run qa:responsive-vocab && npm run qa:research && npm run lint', 'npm run qa:responsive-vocab && npm run qa:research && npm run qa:dashboard && npm run lint')
p.write_text(text)

print('UI/data synchronization patch applied')
