from pathlib import Path

page = Path('src/server/managementPage.ts')
s = page.read_text()

anchor = "  const every=Math.max(1,Math.ceil(rows.length/8));rows.forEach(function(r,i){if(i%every===0||i===rows.length-1)out+='<text x=\\\"'+x(i)+'\\\" y=\\\"'+(h-10)+'\\\" text-anchor=\\\"middle\\\" class=\\\"svg-label\\\">'+esc(String(r.date||'').slice(5))+'</text>'});\n  keys.forEach(function(k,ki){"
replacement = "  const every=Math.max(1,Math.ceil(rows.length/8));rows.forEach(function(r,i){if(i%every===0||i===rows.length-1)out+='<text x=\\\"'+x(i)+'\\\" y=\\\"'+(h-10)+'\\\" text-anchor=\\\"middle\\\" class=\\\"svg-label\\\">'+esc(String(r.date||'').slice(5))+'</text>'});\n  const coincidenceRanks=keys.map(function(k,ki){let rank=0;for(let oi=ki+1;oi<keys.length;oi++){const other=keys[oi];let compared=false;const same=rows.every(function(r){const a=valid(r[k.key]),b=valid(r[other.key]);if(a!==b)return false;if(a&&b){compared=true;return Math.abs(Number(r[k.key])-Number(r[other.key]))<1e-9}return true});if(same&&compared)rank++}return rank});\n  keys.forEach(function(k,ki){"
if anchor not in s:
    raise SystemExit('coincidence insertion anchor not found')
s = s.replace(anchor, replacement, 1)

old_series = "    const color=['#2774ee','#20a567','#f59e0b'][ki%3],dash=['','8 6','2 6'][ki%3],dashAttr=dash?' stroke-dasharray=\\\"'+dash+'\\\"':'';let segment=[],segments=[];"
new_series = "    const color=['#2774ee','#20a567','#f59e0b'][ki%3],dash=['','8 6','2 6'][ki%3],dashAttr=dash?' stroke-dasharray=\\\"'+dash+'\\\"':'',coincidenceRank=coincidenceRanks[ki]||0,lineWidth=3+coincidenceRank*4,pointRadius=5+coincidenceRank*2;let segment=[],segments=[];"
if old_series not in s:
    raise SystemExit('series anchor not found')
s = s.replace(old_series, new_series, 1)

old_poly = "    segments.forEach(function(points){if(points.length>1)out+='<polyline points=\\\"'+points.join(' ')+'\\\" fill=\\\"none\\\" stroke=\\\"'+color+'\\\" stroke-width=\\\"3\\\" stroke-linecap=\\\"round\\\"'+dashAttr+'/>'});"
new_poly = "    segments.forEach(function(points){if(points.length>1)out+='<polyline points=\\\"'+points.join(' ')+'\\\" fill=\\\"none\\\" stroke=\\\"'+color+'\\\" stroke-width=\\\"'+lineWidth+'\\\" stroke-linecap=\\\"round\\\"'+dashAttr+'/>'});"
if old_poly not in s:
    raise SystemExit('polyline anchor not found')
s = s.replace(old_poly, new_poly, 1)

old_circle = "      out+='<circle cx=\\\"'+cx+'\\\" cy=\\\"'+cy+'\\\" r=\\\"5\\\" fill=\\\"#fff\\\" stroke=\\\"'+color+'\\\" stroke-width=\\\"3\\\"/><rect"
new_circle = "      out+='<circle cx=\\\"'+cx+'\\\" cy=\\\"'+cy+'\\\" r=\\\"'+pointRadius+'\\\" fill=\\\"#fff\\\" stroke=\\\"'+color+'\\\" stroke-width=\\\"3\\\"/><rect"
if old_circle not in s:
    raise SystemExit('circle anchor not found')
s = s.replace(old_circle, new_circle, 1)

page.write_text(s)

qa = Path('scripts/qa-dashboard-data-sync.ts')
q = qa.read_text()
marker = "assert.ok(styledSvg.includes('fill=\\\"#fff\\\" stroke=\\\"#2774ee\\\"'),'data points must be white-filled with a colored outline');"
if marker not in q:
    raise SystemExit('QA styled chart marker not found')
extra = marker + "\nconst coincidentSvg=context.lineSvg([{date:'2026-08-28',a:3,b:3},{date:'2026-08-29',a:3.7,b:3.7},{date:'2026-08-30',a:4.5,b:4.5}],[{key:'a',label:'伝える'},{key:'b',label:'分かる'}]);\nassert.ok(coincidentSvg.includes('stroke=\\\"#2774ee\\\" stroke-width=\\\"7\\\"'),'fully coincident first series must render wider so it remains visible beneath the later series');\nassert.ok(coincidentSvg.includes('stroke=\\\"#20a567\\\" stroke-width=\\\"3\\\"'),'top coincident series must retain the normal line width');\nassert.ok(coincidentSvg.includes('r=\\\"7\\\" fill=\\\"#fff\\\" stroke=\\\"#2774ee\\\"'),'coincident first-series markers must remain visible as an outer ring');"
q = q.replace(marker, extra, 1)
qa.write_text(q)
