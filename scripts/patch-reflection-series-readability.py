from pathlib import Path

page = Path('src/server/managementPage.ts')
s = page.read_text()

old_series = "keys.forEach(function(k,ki){const color=['#2774ee','#20a567','#f59e0b'][ki%3];let segment=[],segments=[];"
new_series = "keys.forEach(function(k,ki){const color=['#2774ee','#20a567','#f59e0b'][ki%3],dash=['','8 6','2 6'][ki%3],dashAttr=dash?' stroke-dasharray=\\\"'+dash+'\\\"':'';let segment=[],segments=[];"
if old_series not in s:
    raise SystemExit('series anchor not found')
s = s.replace(old_series, new_series, 1)

old_poly = "if(points.length>1)out+='<polyline points=\\\"'+points.join(' ')+'\\\" fill=\\\"none\\\" stroke=\\\"'+color+'\\\" stroke-width=\\\"3\\\"/>'"
new_poly = "if(points.length>1)out+='<polyline points=\\\"'+points.join(' ')+'\\\" fill=\\\"none\\\" stroke=\\\"'+color+'\\\" stroke-width=\\\"3\\\" stroke-linecap=\\\"round\\\"'+dashAttr+'/>'"
if old_poly not in s:
    raise SystemExit('polyline anchor not found')
s = s.replace(old_poly, new_poly, 1)

old_point = "out+='<circle cx=\\\"'+cx+'\\\" cy=\\\"'+cy+'\\\" r=\\\"4\\\" fill=\\\"'+color+'\\\"/><text x=\\\"'+lx+'\\\" y=\\\"'+ly+'\\\" text-anchor=\\\"middle\\\" class=\\\"svg-value\\\" style=\\\"fill:'+color+'\\\">'+esc(formatChartValue(r[k.key]))+'</text>'"
new_point = "const valueText=formatChartValue(r[k.key]),boxW=Math.max(34,18+String(valueText).length*9),boxX=lx-boxW/2,boxY=ly-18;out+='<circle cx=\\\"'+cx+'\\\" cy=\\\"'+cy+'\\\" r=\\\"5\\\" fill=\\\"#fff\\\" stroke=\\\"'+color+'\\\" stroke-width=\\\"3\\\"/><rect x=\\\"'+boxX+'\\\" y=\\\"'+boxY+'\\\" width=\\\"'+boxW+'\\\" height=\\\"24\\\" rx=\\\"6\\\" fill=\\\"#fff\\\" stroke=\\\"'+color+'\\\" stroke-width=\\\"1\\\"/><text x=\\\"'+lx+'\\\" y=\\\"'+ly+'\\\" text-anchor=\\\"middle\\\" class=\\\"svg-value\\\" style=\\\"fill:'+color+'\\\">'+esc(valueText)+'</text>'"
if old_point not in s:
    raise SystemExit('point/label anchor not found')
s = s.replace(old_point, new_point, 1)

old_legend = "out+='<text x=\\\"'+(left+ki*125)+'\\\" y=\\\"16\\\" class=\\\"svg-label\\\" style=\\\"fill:'+color+'\\\">'+esc(k.label)+'</text>'"
new_legend = "const legendX=left+ki*130;out+='<line x1=\\\"'+legendX+'\\\" y1=\\\"14\\\" x2=\\\"'+(legendX+24)+'\\\" y2=\\\"14\\\" stroke=\\\"'+color+'\\\" stroke-width=\\\"3\\\" stroke-linecap=\\\"round\\\"'+dashAttr+'/><circle cx=\\\"'+(legendX+12)+'\\\" cy=\\\"14\\\" r=\\\"4\\\" fill=\\\"#fff\\\" stroke=\\\"'+color+'\\\" stroke-width=\\\"2\\\"/><text x=\\\"'+(legendX+30)+'\\\" y=\\\"19\\\" class=\\\"svg-label\\\" style=\\\"fill:'+color+'\\\">'+esc(k.label)+'</text>'"
if old_legend not in s:
    raise SystemExit('legend anchor not found')
s = s.replace(old_legend, new_legend, 1)

page.write_text(s)

qa = Path('scripts/qa-dashboard-data-sync.ts')
q = qa.read_text()
anchor = "assert.ok(Math.min(...ys.map((y:number,i:number)=>Math.min(...ys.filter((_:number,j:number)=>j!==i).map((z:number)=>Math.abs(y-z)))))>=22,'overlapping reflection values must be separated vertically');\n"
addition = anchor + "const styledSvg=context.lineSvg([{date:'2026-08-30',a:4.5,b:4.5,c:3.5}],[{key:'a',label:'伝える'},{key:'b',label:'分かる'},{key:'c',label:'気づき'}]);\nassert.ok(styledSvg.includes('stroke-dasharray=\\\"8 6\\\"'),'second reflection series must use a dashed line');\nassert.ok(styledSvg.includes('stroke-dasharray=\\\"2 6\\\"'),'third reflection series must use a dotted line');\nassert.ok(styledSvg.includes('<rect '),'value labels must have a white background box');\nassert.ok(styledSvg.includes('fill=\\\"#fff\\\" stroke=\\\"#2774ee\\\"'),'data points must be white-filled with a colored outline');\n"
if anchor not in q:
    raise SystemExit('QA collision anchor not found')
q = q.replace(anchor, addition, 1)
qa.write_text(q)
