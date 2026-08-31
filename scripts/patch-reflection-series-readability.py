from pathlib import Path

page = Path('src/server/managementPage.ts')
s = page.read_text()
start = s.find('function lineSvg(items,keys){')
end = s.find('function renderDashboard', start)
if start < 0 or end < 0:
    raise SystemExit('lineSvg function boundaries not found')
new_func = r'''function lineSvg(items,keys){
  const rows=items||[],w=460,h=240,left=44,top=40,right=18,bottom=36,plotW=w-left-right,plotH=h-top-bottom;
  const valid=function(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))};const vals=[];rows.forEach(function(r){keys.forEach(function(k){if(valid(r[k.key]))vals.push(Number(r[k.key]))})});
  if(!rows.length||!vals.length)return '<div class=\"muted\" style=\"padding:100px 8px;text-align:center\">データなし</div>';let max=Math.max(...vals),min=Math.min(...vals);if(max===min){max+=1;min=Math.max(0,min-1)}else{const pad=(max-min)*.12;max+=pad;min=Math.max(0,min-pad)}
  const x=function(i){return left+(rows.length<=1?plotW/2:i*plotW/(rows.length-1))},y=function(v){return top+plotH-(Number(v)-min)*plotH/(max-min||1)};const labelYs=rows.map(function(){return []});let out='<svg viewBox=\"0 0 '+w+' '+h+'\" width=\"100%\" height=\"100%\" role=\"img\"><line x1=\"'+left+'\" y1=\"'+(top+plotH)+'\" x2=\"'+(left+plotW)+'\" y2=\"'+(top+plotH)+'\" stroke=\"#cbd8ea\"/>';
  const every=Math.max(1,Math.ceil(rows.length/8));rows.forEach(function(r,i){if(i%every===0||i===rows.length-1)out+='<text x=\"'+x(i)+'\" y=\"'+(h-10)+'\" text-anchor=\"middle\" class=\"svg-label\">'+esc(String(r.date||'').slice(5))+'</text>'});
  keys.forEach(function(k,ki){
    const color=['#2774ee','#20a567','#f59e0b'][ki%3],dash=['','8 6','2 6'][ki%3],dashAttr=dash?' stroke-dasharray=\"'+dash+'\"':'';let segment=[],segments=[];
    rows.forEach(function(r,i){if(valid(r[k.key]))segment.push(x(i)+','+y(Number(r[k.key])));else if(segment.length){segments.push(segment);segment=[]}});if(segment.length)segments.push(segment);
    segments.forEach(function(points){if(points.length>1)out+='<polyline points=\"'+points.join(' ')+'\" fill=\"none\" stroke=\"'+color+'\" stroke-width=\"3\" stroke-linecap=\"round\"'+dashAttr+'/>'});
    rows.forEach(function(r,i){if(valid(r[k.key])){
      const cx=x(i),cy=y(Number(r[k.key]));let lx=cx,ly=Math.max(22,Math.min(h-bottom-6,cy+(keys.length===1?-16:0)));
      if(keys.length>1){const used=labelYs[i],offsets=[-30,30,58,-58,84,-84];for(let oi=0;oi<offsets.length;oi++){const candidate=Math.max(22,Math.min(h-bottom-6,cy+offsets[(oi+ki)%offsets.length]));if(!used.some(function(prev){return Math.abs(prev-candidate)<24})){ly=candidate;break}}used.push(ly);lx=cx+([-10,0,10][ki]||0)}
      const valueText=formatChartValue(r[k.key]),boxW=Math.max(34,18+String(valueText).length*9),boxX=lx-boxW/2,boxY=ly-18;
      out+='<circle cx=\"'+cx+'\" cy=\"'+cy+'\" r=\"5\" fill=\"#fff\" stroke=\"'+color+'\" stroke-width=\"3\"/><rect x=\"'+boxX+'\" y=\"'+boxY+'\" width=\"'+boxW+'\" height=\"24\" rx=\"6\" fill=\"#fff\" stroke=\"'+color+'\" stroke-width=\"1\"/><text x=\"'+lx+'\" y=\"'+ly+'\" text-anchor=\"middle\" class=\"svg-value\" style=\"fill:'+color+'\">'+esc(valueText)+'</text>'
    }});
    const legendX=left+ki*130;out+='<line x1=\"'+legendX+'\" y1=\"14\" x2=\"'+(legendX+24)+'\" y2=\"14\" stroke=\"'+color+'\" stroke-width=\"3\" stroke-linecap=\"round\"'+dashAttr+'/><circle cx=\"'+(legendX+12)+'\" cy=\"14\" r=\"4\" fill=\"#fff\" stroke=\"'+color+'\" stroke-width=\"2\"/><text x=\"'+(legendX+30)+'\" y=\"19\" class=\"svg-label\" style=\"fill:'+color+'\">'+esc(k.label)+'</text>'
  });return out+'</svg>'
}
'''
s = s[:start] + new_func + s[end:]
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
