from pathlib import Path

p = Path('src/server/managementPage.ts')
s = p.read_text()

replacements = [
    ('.charts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:12px}',
     '.charts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:14px}'),
    ('.chart-card{min-height:330px}', '.chart-card{min-height:390px}'),
    ('.chart-card h3,.section-title{font-size:16px;margin:0 0 10px}', '.chart-card h3,.section-title{font-size:18px;margin:0 0 12px}'),
    ('.chart{height:280px;overflow:hidden}', '.chart{height:330px;overflow-x:auto;overflow-y:hidden}'),
    ('.svg-label{font-size:12px;fill:#526581}.svg-value{font-size:12px;fill:#173461;font-weight:800}',
     '.svg-label{font-size:15px;fill:#425878;font-weight:700}.svg-value{font-size:15px;fill:#173461;font-weight:900}.chart svg{min-width:460px}.bar-chart-html{height:100%;display:flex;flex-direction:column;justify-content:center;gap:10px;padding:10px 2px}.bar-row-html{display:grid;grid-template-columns:minmax(135px,40%) minmax(90px,1fr) auto;align-items:center;gap:10px;min-height:30px}.bar-label-html{font-size:16px;font-weight:750;line-height:1.25;color:#425878;overflow-wrap:anywhere}.bar-track-html{height:20px;background:#edf3ff;border-radius:999px;overflow:hidden}.bar-fill-html{height:100%;min-width:2px;background:#4d8df7;border-radius:999px}.bar-value-html{font-size:16px;font-weight:900;color:#173461;min-width:28px;text-align:left}'),
    ('@media(max-width:760px){.top{align-items:flex-start;flex-direction:column}',
     '@media(max-width:760px){.bar-row-html{grid-template-columns:minmax(112px,42%) minmax(72px,1fr) auto;gap:8px}.bar-label-html,.bar-value-html{font-size:15px}.top{align-items:flex-start;flex-direction:column}'),
]
for old, new in replacements:
    if new in s:
        continue
    if old not in s:
        raise SystemExit(f'patch target not found: {old[:70]}')
    s = s.replace(old, new, 1)

if 'function barSvg(items,valueKey,maxItems){\n  const rows=' not in s:
    start = s.index('function barSvg(items,valueKey,maxItems)')
    end = s.index('\nfunction lineSvg', start)
    new_bar = '''function barSvg(items,valueKey,maxItems){
  const rows=(items||[]).slice(0,maxItems||12);
  if(!rows.length)return '<div class="muted" style="padding:90px 8px;text-align:center">データなし</div>';
  const max=Math.max(1,...rows.map(function(r){return Number(r[valueKey]||r.value||0)}));
  return '<div class="bar-chart-html">'+rows.map(function(r){const value=Number(r[valueKey]||r.value||0),percent=Math.max(1,Math.round(100*value/max));return '<div class="bar-row-html"><div class="bar-label-html">'+esc(r.label||r.date||'')+'</div><div class="bar-track-html"><div class="bar-fill-html" style="width:'+percent+'%"></div></div><div class="bar-value-html">'+esc(formatChartValue(value))+'</div></div>'}).join('')+'</div>'
}'''
    s = s[:start] + new_bar + s[end:]
p.write_text(s)

q = Path('scripts/qa-dashboard-data-sync.ts')
t = q.read_text()
old = "for(const id of ['chartDaily','chartPersona','chartWords','chartReflection'])assert.ok(element(id).innerHTML.includes('<svg'),id+' must render an inline SVG graph');"
new = "for(const id of ['chartDaily','chartPersona'])assert.ok(element(id).innerHTML.includes('bar-chart-html'),id+' must render readable HTML bar labels');for(const id of ['chartWords','chartReflection'])assert.ok(element(id).innerHTML.includes('<svg'),id+' must render an inline SVG graph');"
if new not in t:
    if old not in t: raise SystemExit('chart QA target not found')
    t = t.replace(old, new, 1)
old = "assert.ok(pageSource.includes('flex-wrap:wrap'),'research header/actions must wrap instead of overflowing');assert.ok(pageSource.includes('.svg-label{font-size:12px'),'graph labels must be readable');"
new = "assert.ok(pageSource.includes('flex-wrap:wrap'),'research header/actions must wrap instead of overflowing');assert.ok(pageSource.includes('.charts{display:grid;grid-template-columns:repeat(2'),'desktop charts must use two readable columns');assert.ok(pageSource.includes('.svg-label{font-size:15px'),'line graph labels must be readable');assert.ok(pageSource.includes('.bar-label-html{font-size:16px'),'bar graph labels must remain readable HTML text');assert.ok(pageSource.includes('.chart svg{min-width:460px'),'line charts must not shrink labels below their readable base size');"
if new not in t:
    if old not in t: raise SystemExit('readability QA target not found')
    t = t.replace(old, new, 1)
q.write_text(t)
