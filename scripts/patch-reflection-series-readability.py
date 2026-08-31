from pathlib import Path

page = Path('src/server/managementPage.ts')
s = page.read_text()

series_start = s.find("keys.forEach(function(k,ki){const color=")
if series_start < 0:
    raise SystemExit('series start not found')
series_end_marker = ";let segment=[],segments=[];"
series_end = s.find(series_end_marker, series_start)
if series_end < 0:
    raise SystemExit('series end not found')
series_end += len(series_end_marker)
s = s[:series_start] + "keys.forEach(function(k,ki){const color=['#2774ee','#20a567','#f59e0b'][ki%3],dash=['','8 6','2 6'][ki%3],dashAttr=dash?' stroke-dasharray=\\\"'+dash+'\\\"':'';let segment=[],segments=[];" + s[series_end:]

segments_start = s.find("segments.forEach(function(points){", series_start)
rows_start = s.find("rows.forEach(function(r,i){if(valid(r[k.key])){", segments_start)
if segments_start < 0 or rows_start < 0:
    raise SystemExit('polyline block not found')
segments_code = "segments.forEach(function(points){if(points.length>1)out+='<polyline points=\\\"'+points.join(' ')+'\\\" fill=\\\"none\\\" stroke=\\\"'+color+'\\\" stroke-width=\\\"3\\\" stroke-linecap=\\\"round\\\"'+dashAttr+'/>'});"
s = s[:segments_start] + segments_code + s[rows_start:]

point_loop = s.find("rows.forEach(function(r,i){if(valid(r[k.key])){", segments_start)
point_out_start = s.find("out+='<circle", point_loop)
point_out_end = s.find("</text>'", point_out_start)
if point_out_start < 0 or point_out_end < 0:
    raise SystemExit('point output not found')
point_out_end += len("</text>'")
point_code = "const valueText=formatChartValue(r[k.key]),boxW=Math.max(34,18+String(valueText).length*9),boxX=lx-boxW/2,boxY=ly-18;out+='<circle cx=\\\"'+cx+'\\\" cy=\\\"'+cy+'\\\" r=\\\"5\\\" fill=\\\"#fff\\\" stroke=\\\"'+color+'\\\" stroke-width=\\\"3\\\"/><rect x=\\\"'+boxX+'\\\" y=\\\"'+boxY+'\\\" width=\\\"'+boxW+'\\\" height=\\\"24\\\" rx=\\\"6\\\" fill=\\\"#fff\\\" stroke=\\\"'+color+'\\\" stroke-width=\\\"1\\\"/><text x=\\\"'+lx+'\\\" y=\\\"'+ly+'\\\" text-anchor=\\\"middle\\\" class=\\\"svg-value\\\" style=\\\"fill:'+color+'\\\">'+esc(valueText)+'</text>'"
s = s[:point_out_start] + point_code + s[point_out_end:]

legend_start = s.find("out+='<text x=\\\"'+(left+ki*125)", point_out_start)
legend_end = s.find("</text>'", legend_start)
if legend_start < 0 or legend_end < 0:
    raise SystemExit('legend block not found')
legend_end += len("</text>'")
legend_code = "const legendX=left+ki*130;out+='<line x1=\\\"'+legendX+'\\\" y1=\\\"14\\\" x2=\\\"'+(legendX+24)+'\\\" y2=\\\"14\\\" stroke=\\\"'+color+'\\\" stroke-width=\\\"3\\\" stroke-linecap=\\\"round\\\"'+dashAttr+'/><circle cx=\\\"'+(legendX+12)+'\\\" cy=\\\"14\\\" r=\\\"4\\\" fill=\\\"#fff\\\" stroke=\\\"'+color+'\\\" stroke-width=\\\"2\\\"/><text x=\\\"'+(legendX+30)+'\\\" y=\\\"19\\\" class=\\\"svg-label\\\" style=\\\"fill:'+color+'\\\">'+esc(k.label)+'</text>'"
s = s[:legend_start] + legend_code + s[legend_end:]
page.write_text(s)

qa = Path('scripts/qa-dashboard-data-sync.ts')
q = qa.read_text()
marker = "assert.ok(Math.min(...ys.map((y:number,i:number)=>Math.min(...ys.filter((_:number,j:number)=>j!==i).map((z:number)=>Math.abs(y-z)))))>=22,'overlapping reflection values must be separated vertically');"
idx = q.find(marker)
if idx < 0:
    raise SystemExit('QA collision marker not found')
insert_at = idx + len(marker)
extra = "\nconst styledSvg=context.lineSvg([{date:'2026-08-30',a:4.5,b:4.5,c:3.5}],[{key:'a',label:'伝える'},{key:'b',label:'分かる'},{key:'c',label:'気づき'}]);\nassert.ok(styledSvg.includes('stroke-dasharray=\\\"8 6\\\"'),'second reflection series must use a dashed line');\nassert.ok(styledSvg.includes('stroke-dasharray=\\\"2 6\\\"'),'third reflection series must use a dotted line');\nassert.ok(styledSvg.includes('<rect '),'value labels must have a white background box');\nassert.ok(styledSvg.includes('fill=\\\"#fff\\\" stroke=\\\"#2774ee\\\"'),'data points must be white-filled with a colored outline');"
q = q[:insert_at] + extra + q[insert_at:]
qa.write_text(q)
