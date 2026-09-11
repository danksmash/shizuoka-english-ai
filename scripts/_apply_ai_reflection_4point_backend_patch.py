from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one occurrence, found {count}: {old[:120]!r}')
    write(path, text.replace(old, new, 1))


def regex_once(path: str, pattern: str, replacement: str, flags: int = 0) -> None:
    text = read(path)
    new_text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f'{path}: regex expected one occurrence, found {count}: {pattern[:120]!r}')
    write(path, new_text)


# 1) Server-side reflection compatibility: old cached UI remains legacy-135;
#    new UI can opt in to 4point-v1 without losing the reflection during rollout.
replace_once(
    'src/dataContract.ts',
    "export interface ReflectionAnswers {\n  conveyedIdeas: 1 | 3 | 5;\n  understoodPartner: 1 | 3 | 5;\n  noticedLanguageCulture: 1 | 3 | 5;\n}",
    "export type ReflectionScaleVersion = 'legacy-135' | '4point-v1';\nexport type ReflectionRating = 1 | 2 | 3 | 4 | 5;\n\nexport interface ReflectionAnswers {\n  scaleVersion?: ReflectionScaleVersion;\n  conveyedIdeas: ReflectionRating;\n  understoodPartner: ReflectionRating;\n  noticedLanguageCulture: ReflectionRating;\n}"
)

replace_once(
    'src/dataContract.ts',
    "export function parseReflectionAnswers(value: unknown): ReflectionAnswers | undefined {\n  if (!value || typeof value !== 'object') return undefined;\n  const source = value as Record<string, unknown>;\n  const rating = (key: string): 1 | 3 | 5 | null => {\n    const number = Number(source[key]);\n    return number === 1 || number === 3 || number === 5 ? number : null;\n  };\n  const conveyedIdeas = rating('conveyedIdeas');\n  const understoodPartner = rating('understoodPartner');\n  const noticedLanguageCulture = rating('noticedLanguageCulture');\n  if (conveyedIdeas === null || understoodPartner === null || noticedLanguageCulture === null) return undefined;\n  return { conveyedIdeas, understoodPartner, noticedLanguageCulture };\n}",
    "export function parseReflectionAnswers(value: unknown): ReflectionAnswers | undefined {\n  if (!value || typeof value !== 'object') return undefined;\n  const source = value as Record<string, unknown>;\n  const scaleVersion: ReflectionScaleVersion = source.scaleVersion === '4point-v1' ? '4point-v1' : 'legacy-135';\n  const allowed = scaleVersion === '4point-v1' ? new Set([1, 2, 3, 4]) : new Set([1, 3, 5]);\n  const rating = (key: string): ReflectionRating | null => {\n    const number = Number(source[key]);\n    return allowed.has(number) ? number as ReflectionRating : null;\n  };\n  const conveyedIdeas = rating('conveyedIdeas');\n  const understoodPartner = rating('understoodPartner');\n  const noticedLanguageCulture = rating('noticedLanguageCulture');\n  if (conveyedIdeas === null || understoodPartner === null || noticedLanguageCulture === null) return undefined;\n  return { scaleVersion, conveyedIdeas, understoodPartner, noticedLanguageCulture };\n}"
)

# 2) Formal research export: preserve scale provenance and bump the formal schema.
replace_once('src/server/researchDashboard.ts', "export const RESEARCH_EXPORT_SCHEMA_VERSION = 'research-2026-v3';", "export const RESEARCH_EXPORT_SCHEMA_VERSION = 'research-2026-v4';")
replace_once(
    'src/server/researchDashboard.ts',
    "    'reflection_conveyed_ideas','reflection_understood_partner','reflection_noticed_language_culture',",
    "    'reflection_scale_version','reflection_understood_partner','reflection_conveyed_ideas','reflection_noticed_language_culture',"
)
replace_once(
    'src/server/researchDashboard.ts',
    "  reflection_conveyed_ideas:'自分の考えを伝える振り返り（1/3/5）',\n  reflection_understood_partner:'相手の話を聞いて分かる振り返り（1/3/5）',\n  reflection_noticed_language_culture:'新しい言葉や文化に気づいた振り返り（1/3/5）',",
    "  reflection_scale_version:'AI対話直後の3項目自己評価で使用した尺度版',\n  reflection_understood_partner:'相手の話を聞いて分かる振り返り',\n  reflection_conveyed_ideas:'自分の考えを伝える振り返り',\n  reflection_noticed_language_culture:'新しい言葉や文化に気づいた振り返り',"
)
replace_once(
    'src/server/researchDashboard.ts',
    "  reflection_conveyed_ideas:'1 | 3 | 5',\n  reflection_understood_partner:'1 | 3 | 5',\n  reflection_noticed_language_culture:'1 | 3 | 5',",
    "  reflection_scale_version:'legacy-135 | 4point-v1 | blank',\n  reflection_understood_partner:'legacy-135: 1 | 3 | 5 / 4point-v1: 1 | 2 | 3 | 4',\n  reflection_conveyed_ideas:'legacy-135: 1 | 3 | 5 / 4point-v1: 1 | 2 | 3 | 4',\n  reflection_noticed_language_culture:'legacy-135: 1 | 3 | 5 / 4point-v1: 1 | 2 | 3 | 4',"
)
replace_once(
    'src/server/researchDashboard.ts',
    "      reflection_conveyed_ideas: session.reflection?.conveyedIdeas ?? '', reflection_understood_partner: session.reflection?.understoodPartner ?? '',\n      reflection_noticed_language_culture: session.reflection?.noticedLanguageCulture ?? '',",
    "      reflection_scale_version: session.reflection?.scaleVersion || (session.reflection ? 'legacy-135' : ''),\n      reflection_understood_partner: session.reflection?.understoodPartner ?? '', reflection_conveyed_ideas: session.reflection?.conveyedIdeas ?? '',\n      reflection_noticed_language_culture: session.reflection?.noticedLanguageCulture ?? '',"
)
replace_once(
    'src/server/researchDashboard.ts',
    "    [row.reflection_conveyed_ideas,row.reflection_understood_partner,row.reflection_noticed_language_culture].forEach((value, index) => {\n      const rating = Number(value);\n      if ([1,3,5].includes(rating)) bucket.reflections[index].push(rating);\n    });",
    "    if (String(row.reflection_scale_version || '') === '4point-v1') {\n      [row.reflection_understood_partner,row.reflection_conveyed_ideas,row.reflection_noticed_language_culture].forEach((value, index) => {\n        const rating = Number(value);\n        if ([1,2,3,4].includes(rating)) bucket.reflections[index].push(rating);\n      });\n    }"
)
replace_once(
    'src/server/researchDashboard.ts',
    "      reflection_conveyed:value.reflections[0].length ? round(average(value.reflections[0]),2) : null,\n      reflection_understood:value.reflections[1].length ? round(average(value.reflections[1]),2) : null,\n      reflection_culture:value.reflections[2].length ? round(average(value.reflections[2]),2) : null,",
    "      reflection_understood:value.reflections[0].length ? round(average(value.reflections[0]),2) : null,\n      reflection_understood_n:value.reflections[0].length,\n      reflection_conveyed:value.reflections[1].length ? round(average(value.reflections[1]),2) : null,\n      reflection_conveyed_n:value.reflections[1].length,\n      reflection_culture:value.reflections[2].length ? round(average(value.reflections[2]),2) : null,\n      reflection_culture_n:value.reflections[2].length,"
)

# Also expose the scale version through the older anonymized helper for consistency.
replace_once(
    'src/server/persistence.ts',
    "    unique_vocabulary_count: session.uniqueVocabularyCount || 0,\n    reflection_conveyed_ideas: session.reflection?.conveyedIdeas ?? '',\n    reflection_understood_partner: session.reflection?.understoodPartner ?? '',",
    "    unique_vocabulary_count: session.uniqueVocabularyCount || 0,\n    reflection_scale_version: session.reflection?.scaleVersion || (session.reflection ? 'legacy-135' : ''),\n    reflection_understood_partner: session.reflection?.understoodPartner ?? '',\n    reflection_conveyed_ideas: session.reflection?.conveyedIdeas ?? '',"
)

# 3) Research dashboard: chart is AI-dialogue reflection, 3 series in one graph, fixed 1–4 axis.
replace_once(
    'src/server/managementPage.ts',
    '授業振り返りグラフは lesson_reflections.csv の4件法2項目を授業日単位で集計します。',
    'AI対話ふりかえりグラフは、対話終了直後の3項目4件法（聞いて分かる／考えを伝える／言葉・文化に気づく）だけを日別または週別に集計します。授業末Reflectionは lesson_reflections.csv として別に保持します。'
)
replace_once(
    'src/server/managementPage.ts',
    '<div class="card chart-card"><h3 id="chartReflectionTitle">授業振り返り平均（4件法）</h3><div id="chartReflection" class="chart"></div></div>',
    '<div class="card chart-card"><h3 id="chartReflectionTitle">AI対話ふりかえり平均（4件法）</h3><div id="chartReflection" class="chart"></div></div>'
)
replace_once(
    'src/server/managementPage.ts',
    '.svg-label{font-size:15px;fill:#425878;font-weight:700}.svg-value{font-size:15px;fill:#173461;font-weight:900}',
    '.svg-label{font-size:15px;fill:#425878;font-weight:700}.svg-value{font-size:15px;fill:#173461;font-weight:900}.reflection-axis-label{font-size:18px;fill:#10224a;font-weight:900}.reflection-legend-label{font-size:13px;fill:#10224a;font-weight:800}'
)

ai_chart_function = r'''function aiReflectionLineSvg(items){const rows=items||[],w=460,h=250,left=64,top=48,right=18,bottom=52,plotW=w-left-right,plotH=h-top-bottom;const valid=function(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))};const series=[{key:'reflection_understood',n:'reflection_understood_n',label:'相手の話を聞いて分かる',color:'#2774ee',shape:'circle'},{key:'reflection_conveyed',n:'reflection_conveyed_n',label:'自分の考えを伝える',color:'#20a567',shape:'square'},{key:'reflection_culture',n:'reflection_culture_n',label:'新しい言葉や文化に気づいた',color:'#f59e0b',shape:'diamond'}];const has=rows.some(function(r){return series.some(function(s){return valid(r[s.key])})});let out='<svg viewBox=\"0 0 '+w+' '+h+'\" width=\"100%\" height=\"100%\" role=\"img\" aria-label=\"AI対話ふりかえり平均 4件法\">';if(!rows.length||!has)return out+'<text x=\"230\" y=\"125\" text-anchor=\"middle\" class=\"svg-label\">データなし</text></svg>';const x=function(i){return left+(rows.length<=1?plotW/2:i*plotW/(rows.length-1))},y=function(v){return top+plotH-(Number(v)-1)*plotH/3};const offsets=function(r){const result=[0,0,0],groups=new Map();series.forEach(function(s,si){if(!valid(r[s.key]))return;const key=Number(r[s.key]).toFixed(6),group=groups.get(key)||[];group.push(si);groups.set(key,group)});groups.forEach(function(group){if(group.length===2){result[group[0]]=-3;result[group[1]]=3}else if(group.length>=3){result[group[0]]=-4;result[group[1]]=0;result[group[2]]=4}});return result};const marker=function(shape,cx,cy,color,title){const t=title?'<title>'+esc(title)+'</title>':'';if(shape==='square')return '<g>'+t+'<rect x=\"'+(cx-5)+'\" y=\"'+(cy-5)+'\" width=\"10\" height=\"10\" rx=\"1\" fill=\"#fff\" stroke=\"'+color+'\" stroke-width=\"3\"/></g>';if(shape==='diamond')return '<g>'+t+'<polygon points=\"'+cx+','+(cy-6)+' '+(cx+6)+','+cy+' '+cx+','+(cy+6)+' '+(cx-6)+','+cy+'\" fill=\"#fff\" stroke=\"'+color+'\" stroke-width=\"3\"/></g>';return '<g>'+t+'<circle cx=\"'+cx+'\" cy=\"'+cy+'\" r=\"5\" fill=\"#fff\" stroke=\"'+color+'\" stroke-width=\"3\"/></g>'};[1,2,3,4].forEach(function(tick){const yy=y(tick);out+='<line x1=\"'+left+'\" y1=\"'+yy+'\" x2=\"'+(left+plotW)+'\" y2=\"'+yy+'\" stroke=\"#dfe7f2\" stroke-width=\"1\"/><text x=\"'+(left-20)+'\" y=\"'+(yy+6)+'\" text-anchor=\"middle\" class=\"reflection-axis-label\">'+tick+'</text>'});const every=Math.max(1,Math.ceil(rows.length/8));rows.forEach(function(r,i){if(i%every===0||i===rows.length-1)out+='<text x=\"'+x(i)+'\" y=\"'+(h-25)+'\" text-anchor=\"middle\" class=\"svg-label\">'+esc(String(r.date||'').slice(5))+'</text>'});series.forEach(function(item,si){let segment=[],segments=[];rows.forEach(function(r,i){if(valid(r[item.key])){const visualOffset=offsets(r)[si];segment.push(x(i)+','+(y(Number(r[item.key]))+visualOffset))}else if(segment.length){segments.push(segment);segment=[]}});if(segment.length)segments.push(segment);segments.forEach(function(points){if(points.length>1)out+='<polyline points=\"'+points.join(' ')+'\" fill=\"none\" stroke=\"'+item.color+'\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>'});rows.forEach(function(r,i){if(!valid(r[item.key]))return;const visualOffset=offsets(r)[si],value=formatChartValue(r[item.key]),count=Number(r[item.n]||0),title=String(r.date||'')+' '+item.label+': 平均 '+value+' (n='+count+')';out+=marker(item.shape,x(i),y(Number(r[item.key]))+visualOffset,item.color,title)});const legendX=left+si*132;out+='<line x1=\"'+legendX+'\" y1=\"17\" x2=\"'+(legendX+22)+'\" y2=\"17\" stroke=\"'+item.color+'\" stroke-width=\"3\" stroke-linecap=\"round\"/>'+marker(item.shape,legendX+11,17,item.color,'')+'<text x=\"'+(legendX+28)+'\" y=\"22\" class=\"reflection-legend-label\">'+esc(item.label)+'</text>'});out+='<text x=\"'+left+'\" y=\"'+(h-4)+'\" class=\"svg-label\" style=\"font-size:11px;fill:#64748b\">1 = 次はがんばる　/　4 = よくできた</text>';return out+'</svg>'}
'''
text = read('src/server/managementPage.ts')
needle = 'function formatSeconds(seconds){'
if text.count(needle) != 1:
    raise RuntimeError('managementPage.ts: formatSeconds insertion point not unique')
write('src/server/managementPage.ts', text.replace(needle, ai_chart_function + needle, 1))

replace_once(
    'src/server/managementPage.ts',
    "$('chartReflectionTitle').textContent=aggregation==='weekly'?'授業振り返り平均（週別・4件法）':'授業振り返り平均（4件法）';",
    "$('chartReflectionTitle').textContent=aggregation==='weekly'?'AI対話ふりかえり平均（週別・4件法）':'AI対話ふりかえり平均（4件法）';"
)
replace_once(
    'src/server/managementPage.ts',
    "const reflectionSeries=buildLessonReflectionSeries(d.lessonReflectionRows||[],aggregation);$('chartReflection').innerHTML=ratingLineSvg(reflectionSeries);",
    "$('chartReflection').innerHTML=aiReflectionLineSvg((d.charts||{}).daily||[]);"
)
regex_once(
    'src/server/managementPage.ts',
    r"async function loadDashboard\(\)\{[^\n]*\}\nfunction scheduleDashboardReload",
    "async function loadDashboard(){const seq=++dashboardRequestSeq,params=filterParams(),query=params.toString();setExportAvailability(false);try{$('dashboardStatus').className='status';$('dashboardStatus').textContent='データを集計しています…';const d=await json(queryUrlFromParams('/api/management/research.dashboard',params));if(seq!==dashboardRequestSeq)return;renderDashboard(d,query);$('dashboardStatus').textContent='選択条件を反映した匿名化データを表示しています'}catch(e){if(seq!==dashboardRequestSeq)return;$('dashboardStatus').textContent='読み込み失敗: '+e.message;$('dashboardStatus').className='status error'}finally{if(seq===dashboardRequestSeq)setExportAvailability(true)}}\nfunction scheduleDashboardReload"
)

# 4) QA: validation supports legacy cached UI and new 4-point submissions.
replace_once(
    'scripts/qa-data-contract.ts',
    "reflection:{conveyedIdeas:3,understoodPartner:3,noticedLanguageCulture:3}",
    "reflection:{scaleVersion:'4point-v1',conveyedIdeas:3,understoodPartner:4,noticedLanguageCulture:2}"
)
replace_once(
    'scripts/qa-data-contract.ts',
    "for(const reflection of [{conveyedIdeas:2,understoodPartner:3,noticedLanguageCulture:3},{conveyedIdeas:5,understoodPartner:4,noticedLanguageCulture:1}]){const r=validateSessionSaveInput({sessionId:'session_12345678',learningCode:'A7M4',aiStudentId:'emma_usa',topic:'favorites',targetDurationMinutes:1,startedAt:1000,endedAt:2000,history,reflection});assert.equal(r.ok,true);if(r.ok)assert.equal(r.value.reflection,undefined);}",
    "const newReflection=validateSessionSaveInput({sessionId:'session_new_reflection',learningCode:'A7M4',aiStudentId:'emma_usa',topic:'favorites',targetDurationMinutes:1,startedAt:1000,endedAt:2000,history,reflection:{scaleVersion:'4point-v1',conveyedIdeas:4,understoodPartner:3,noticedLanguageCulture:2}});assert.equal(newReflection.ok,true);if(newReflection.ok){assert.equal(newReflection.value.reflection?.scaleVersion,'4point-v1');assert.equal(newReflection.value.reflection?.conveyedIdeas,4);}\nconst legacyReflection=validateSessionSaveInput({sessionId:'session_legacy_reflection',learningCode:'A7M4',aiStudentId:'emma_usa',topic:'favorites',targetDurationMinutes:1,startedAt:1000,endedAt:2000,history,reflection:{conveyedIdeas:5,understoodPartner:3,noticedLanguageCulture:1}});assert.equal(legacyReflection.ok,true);if(legacyReflection.ok)assert.equal(legacyReflection.value.reflection?.scaleVersion,'legacy-135');\nfor(const reflection of [{scaleVersion:'4point-v1',conveyedIdeas:5,understoodPartner:4,noticedLanguageCulture:1},{conveyedIdeas:2,understoodPartner:3,noticedLanguageCulture:3}]){const r=validateSessionSaveInput({sessionId:'session_bad_reflection',learningCode:'A7M4',aiStudentId:'emma_usa',topic:'favorites',targetDurationMinutes:1,startedAt:1000,endedAt:2000,history,reflection});assert.equal(r.ok,true);if(r.ok)assert.equal(r.value.reflection,undefined);}" 
)

# Formal export QA sample now represents the Study 1 four-point scale.
replace_once(
    'scripts/qa-research-export-complete.ts',
    "reflection:{conveyedIdeas:5,understoodPartner:3,noticedLanguageCulture:5}",
    "reflection:{scaleVersion:'4point-v1',conveyedIdeas:4,understoodPartner:3,noticedLanguageCulture:4}"
)
replace_once(
    'scripts/qa-research-export-complete.ts',
    "for(const required of ['assigned_partner_id','assigned_partner_country','assignment_announced_at','same_class_starts_5min'",
    "for(const required of ['assigned_partner_id','assigned_partner_country','assignment_announced_at','reflection_scale_version','same_class_starts_5min'"
)
replace_once(
    'scripts/qa-research-integrated.ts',
    "reflection:{conveyedIdeas:3,understoodPartner:3,noticedLanguageCulture:3}",
    "reflection:{scaleVersion:'4point-v1',conveyedIdeas:3,understoodPartner:3,noticedLanguageCulture:3}"
)

# Dashboard sync QA now checks one three-series AI-reflection graph and visible 1–4 scale.
replace_once(
    'scripts/qa-dashboard-data-sync.ts',
    "{date:'2026-09-01',sessions:45,mean_child_words:12.5,mean_child_words_per_minute:17.2,reflection_conveyed:3.1,reflection_understood:3.2,reflection_culture:3.0},\n      {date:'2026-09-02',sessions:52,mean_child_words:14.2,mean_child_words_per_minute:19.1,reflection_conveyed:3.4,reflection_understood:3.5,reflection_culture:3.3},",
    "{date:'2026-09-01',sessions:45,mean_child_words:12.5,mean_child_words_per_minute:17.2,reflection_understood:3.2,reflection_understood_n:45,reflection_conveyed:3.2,reflection_conveyed_n:45,reflection_culture:3.2,reflection_culture_n:44},\n      {date:'2026-09-02',sessions:52,mean_child_words:14.2,mean_child_words_per_minute:19.1,reflection_understood:3.5,reflection_understood_n:52,reflection_conveyed:3.4,reflection_conveyed_n:51,reflection_culture:3.3,reflection_culture_n:50},"
)
replace_once(
    'scripts/qa-dashboard-data-sync.ts',
    "assert.equal(element('chartReflectionTitle').textContent,'授業振り返り平均（4件法）');\nassert.ok(element('chartReflection').innerHTML.includes('めあて'));\nassert.ok(element('chartReflection').innerHTML.includes('聞く・伝える'));\nassert.ok(element('chartReflection').innerHTML.includes('1 = できなかった'));\nassert.equal(element('chartReflection').innerHTML.includes('#f59e0b'),false,'obsolete third reflection series must not render');\nassert.equal(element('chartReflection').innerHTML.includes('class=\"svg-value\"'),false,'reflection chart must not print a value label at every point');",
    "assert.equal(element('chartReflectionTitle').textContent,'AI対話ふりかえり平均（4件法）');\nassert.ok(element('chartReflection').innerHTML.includes('相手の話を聞いて分かる'));\nassert.ok(element('chartReflection').innerHTML.includes('自分の考えを伝える'));\nassert.ok(element('chartReflection').innerHTML.includes('新しい言葉や文化に気づいた'));\nassert.ok(element('chartReflection').innerHTML.includes('1 = 次はがんばる'));\nassert.ok(element('chartReflection').innerHTML.includes('class=\"reflection-axis-label\">1</text>') && element('chartReflection').innerHTML.includes('class=\"reflection-axis-label\">4</text>'));\nassert.ok(element('chartReflection').innerHTML.includes('#2774ee') && element('chartReflection').innerHTML.includes('#20a567') && element('chartReflection').innerHTML.includes('#f59e0b'));\nassert.ok(element('chartReflection').innerHTML.includes('<circle') && element('chartReflection').innerHTML.includes('<rect') && element('chartReflection').innerHTML.includes('<polygon'));\nassert.equal(element('chartReflection').innerHTML.includes('class=\"svg-value\"'),false,'reflection chart must not print a value label at every point');"
)
replace_once(
    'scripts/qa-dashboard-data-sync.ts',
    "assert.ok(pageSource.includes('lesson_reflections.csv の4件法2項目'));\nassert.ok(pageSource.includes('授業振り返り平均（4件法）'));",
    "assert.ok(pageSource.includes('AI対話ふりかえりグラフは'));\nassert.ok(pageSource.includes('lesson_reflections.csv として別に保持'));\nassert.ok(pageSource.includes('AI対話ふりかえり平均（4件法）'));\nassert.ok(pageSource.includes('.reflection-axis-label{font-size:18px'));"
)

# Add a focused assertion that formal export retains scale provenance.
text = read('scripts/qa-research-export-complete.ts')
needle = "assert.equal(beforeRow.tts_provider_deviation,0);"
if text.count(needle) != 1:
    raise RuntimeError('qa-research-export-complete.ts: assertion insertion point not unique')
write('scripts/qa-research-export-complete.ts', text.replace(needle, needle + "assert.equal(beforeRow.reflection_scale_version,'4point-v1');", 1))

# Final static sanity checks before CI.
checks = {
    'src/dataContract.ts': ["4point-v1", "legacy-135", "new Set([1, 2, 3, 4])"],
    'src/server/researchDashboard.ts': ["research-2026-v4", "reflection_scale_version", "[1,2,3,4].includes(rating)"],
    'src/server/managementPage.ts': ["AI対話ふりかえり平均（4件法）", "reflection-axis-label", "function aiReflectionLineSvg", "shape:'diamond'"],
}
for path, snippets in checks.items():
    content = read(path)
    for snippet in snippets:
        if snippet not in content:
            raise RuntimeError(f'{path}: missing expected snippet {snippet!r}')

print('AI reflection 4-point backend/dashboard patch applied successfully')
