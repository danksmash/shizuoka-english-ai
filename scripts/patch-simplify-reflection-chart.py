from pathlib import Path
import re

page = Path('src/server/managementPage.ts')
s = page.read_text()

start = s.index('  const coincidenceRanks=keys.map(function(k,ki){')
end = s.index('  keys.forEach(function(k,ki){', start)
replacement = '''  const coincidenceOffsets=keys.map(function(k,ki){
    const matching=[];keys.forEach(function(other,oi){let compared=false;const same=rows.every(function(r){const a=valid(r[k.key]),b=valid(r[other.key]);if(a!==b)return false;if(a&&b){compared=true;return Math.abs(Number(r[k.key])-Number(r[other.key]))<1e-9}return true});if(same&&compared)matching.push(oi)});
    const pos=matching.indexOf(ki);return matching.length>1&&pos>=0?(pos-(matching.length-1)/2)*4:0
  });
'''
s = s[:start] + replacement + s[end:]

old = "    const color=['#2774ee','#20a567','#f59e0b'][ki%3],dash=['','8 6','2 6'][ki%3],dashAttr=dash?' stroke-dasharray=\\\"'+dash+'\\\"':'',coincidenceRank=coincidenceRanks[ki]||0,lineWidth=3+coincidenceRank*4,pointRadius=5+coincidenceRank*2;let segment=[],segments=[];"
new = "    const color=['#2774ee','#20a567','#f59e0b'][ki%3],visualOffset=coincidenceOffsets[ki]||0;let segment=[],segments=[];"
if old not in s: raise SystemExit('series declaration not found')
s = s.replace(old,new,1)

old = "    rows.forEach(function(r,i){if(valid(r[k.key]))segment.push(x(i)+','+y(Number(r[k.key])));else if(segment.length){segments.push(segment);segment=[]}});if(segment.length)segments.push(segment);"
new = "    rows.forEach(function(r,i){if(valid(r[k.key]))segment.push(x(i)+','+(y(Number(r[k.key]))+visualOffset));else if(segment.length){segments.push(segment);segment=[]}});if(segment.length)segments.push(segment);"
if old not in s: raise SystemExit('segment builder not found')
s = s.replace(old,new,1)

old = "    segments.forEach(function(points){if(points.length>1)out+='<polyline points=\\\"'+points.join(' ')+'\\\" fill=\\\"none\\\" stroke=\\\"'+color+'\\\" stroke-width=\\\"'+lineWidth+'\\\" stroke-linecap=\\\"round\\\"'+dashAttr+'/>'});"
new = "    segments.forEach(function(points){if(points.length>1)out+='<polyline points=\\\"'+points.join(' ')+'\\\" fill=\\\"none\\\" stroke=\\\"'+color+'\\\" stroke-width=\\\"3\\\" stroke-linecap=\\\"round\\\"/>'});"
if old not in s: raise SystemExit('polyline renderer not found')
s = s.replace(old,new,1)

old = "      const cx=x(i),cy=y(Number(r[k.key]));let lx=cx,ly=Math.max(22,Math.min(h-bottom-6,cy+(keys.length===1?-16:0)));"
new = "      const cx=x(i),cy=y(Number(r[k.key]))+visualOffset;let lx=cx,ly=Math.max(22,Math.min(h-bottom-6,cy+(keys.length===1?-16:0)));"
if old not in s: raise SystemExit('point coordinate not found')
s = s.replace(old,new,1)

old = "      const valueText=formatChartValue(r[k.key]),boxW=Math.max(34,18+String(valueText).length*9),boxX=lx-boxW/2,boxY=ly-18;\n      out+='<circle cx=\\\"'+cx+'\\\" cy=\\\"'+cy+'\\\" r=\\\"'+pointRadius+'\\\" fill=\\\"#fff\\\" stroke=\\\"'+color+'\\\" stroke-width=\\\"3\\\"/><rect x=\\\"'+boxX+'\\\" y=\\\"'+boxY+'\\\" width=\\\"'+boxW+'\\\" height=\\\"24\\\" rx=\\\"6\\\" fill=\\\"#fff\\\" stroke=\\\"'+color+'\\\" stroke-width=\\\"1\\\"/><text x=\\\"'+lx+'\\\" y=\\\"'+ly+'\\\" text-anchor=\\\"middle\\\" class=\\\"svg-value\\\" style=\\\"fill:'+color+'\\\">'+esc(valueText)+'</text>'"
new = "      const valueText=formatChartValue(r[k.key]);\n      out+='<circle cx=\\\"'+cx+'\\\" cy=\\\"'+cy+'\\\" r=\\\"5\\\" fill=\\\"#fff\\\" stroke=\\\"'+color+'\\\" stroke-width=\\\"3\\\"/><text x=\\\"'+lx+'\\\" y=\\\"'+ly+'\\\" text-anchor=\\\"middle\\\" class=\\\"svg-value\\\" style=\\\"fill:#111827\\\">'+esc(valueText)+'</text>'"
if old not in s: raise SystemExit('value label renderer not found')
s = s.replace(old,new,1)

old = "    const legendX=left+ki*130;out+='<line x1=\\\"'+legendX+'\\\" y1=\\\"14\\\" x2=\\\"'+(legendX+24)+'\\\" y2=\\\"14\\\" stroke=\\\"'+color+'\\\" stroke-width=\\\"3\\\" stroke-linecap=\\\"round\\\"'+dashAttr+'/><circle cx=\\\"'+(legendX+12)+'\\\" cy=\\\"14\\\" r=\\\"4\\\" fill=\\\"#fff\\\" stroke=\\\"'+color+'\\\" stroke-width=\\\"2\\\"/><text x=\\\"'+(legendX+30)+'\\\" y=\\\"19\\\" class=\\\"svg-label\\\" style=\\\"fill:'+color+'\\\">'+esc(k.label)+'</text>'"
new = "    const legendX=left+ki*130;out+='<line x1=\\\"'+legendX+'\\\" y1=\\\"14\\\" x2=\\\"'+(legendX+24)+'\\\" y2=\\\"14\\\" stroke=\\\"'+color+'\\\" stroke-width=\\\"3\\\" stroke-linecap=\\\"round\\\"/><circle cx=\\\"'+(legendX+12)+'\\\" cy=\\\"14\\\" r=\\\"4\\\" fill=\\\"#fff\\\" stroke=\\\"'+color+'\\\" stroke-width=\\\"2\\\"/><text x=\\\"'+(legendX+30)+'\\\" y=\\\"19\\\" class=\\\"svg-label\\\" style=\\\"fill:#10224a\\\">'+esc(k.label)+'</text>'"
if old not in s: raise SystemExit('legend renderer not found')
s = s.replace(old,new,1)
page.write_text(s)

qa = Path('scripts/qa-dashboard-data-sync.ts')
q = qa.read_text()
old_block = """assert.ok(styledSvg.includes('stroke-dasharray=\\\"8 6\\\"'),'second reflection series must use a dashed line');
assert.ok(styledSvg.includes('stroke-dasharray=\\\"2 6\\\"'),'third reflection series must use a dotted line');
assert.ok(styledSvg.includes('<rect '),'value labels must have a white background box');
assert.ok(styledSvg.includes('fill=\\\"#fff\\\" stroke=\\\"#2774ee\\\"'),'data points must be white-filled with a colored outline');
const coincidentSvg=context.lineSvg([{date:'2026-08-28',a:3,b:3},{date:'2026-08-29',a:3.7,b:3.7},{date:'2026-08-30',a:4.5,b:4.5}],[{key:'a',label:'伝える'},{key:'b',label:'分かる'}]);
assert.ok(coincidentSvg.includes('stroke=\\\"#2774ee\\\" stroke-width=\\\"7\\\"'),'fully coincident first series must render wider so it remains visible beneath the later series');
assert.ok(coincidentSvg.includes('stroke=\\\"#20a567\\\" stroke-width=\\\"3\\\"'),'top coincident series must retain the normal line width');
assert.ok(coincidentSvg.includes('r=\\\"7\\\" fill=\\\"#fff\\\" stroke=\\\"#2774ee\\\"'),'coincident first-series markers must remain visible as an outer ring');"""
new_block = """assert.equal(styledSvg.includes('stroke-dasharray='),false,'reflection series should use simple solid colored lines');
assert.equal(styledSvg.includes('<rect '),false,'value labels must not have background boxes');
assert.ok(styledSvg.includes('style=\\\"fill:#111827\\\"'),'value labels must use black text');
for(const color of ['#2774ee','#20a567','#f59e0b'])assert.ok(styledSvg.includes('stroke=\\\"'+color+'\\\"'),'each reflection series must keep its own line color');
assert.ok(styledSvg.includes('fill=\\\"#fff\\\" stroke=\\\"#2774ee\\\"'),'data points must remain white-filled with a colored outline');
const coincidentSvg=context.lineSvg([{date:'2026-08-28',a:3,b:3},{date:'2026-08-29',a:3.7,b:3.7},{date:'2026-08-30',a:4.5,b:4.5}],[{key:'a',label:'伝える'},{key:'b',label:'分かる'}]);
const bluePoints=(coincidentSvg.match(/<polyline points=\\\"([^\\\"]+)\\\"[^>]*stroke=\\\"#2774ee\\\"/)||[])[1];
const greenPoints=(coincidentSvg.match(/<polyline points=\\\"([^\\\"]+)\\\"[^>]*stroke=\\\"#20a567\\\"/)||[])[1];
assert.ok(bluePoints&&greenPoints&&bluePoints!==greenPoints,'fully coincident series must receive a small visual offset so both lines remain visible');
assert.ok(coincidentSvg.includes('style=\\\"fill:#111827\\\"'),'coincident value labels must remain black');"""
if old_block not in q: raise SystemExit('QA chart style block not found')
q = q.replace(old_block,new_block,1)
qa.write_text(q)
