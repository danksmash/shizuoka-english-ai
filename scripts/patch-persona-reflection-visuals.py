from pathlib import Path

page = Path('src/server/managementPage.ts')
s = page.read_text()
old_css = '.chart{height:330px;overflow-x:auto;overflow-y:hidden}.lower{'
new_css = '.chart{height:330px;overflow-x:auto;overflow-y:hidden}#chartPersona{height:390px;overflow-y:visible}.lower{'
if old_css not in s:
    raise SystemExit('chart CSS anchor not found')
s = s.replace(old_css, new_css, 1)
old = "const x=function(i){return left+(rows.length<=1?plotW/2:i*plotW/(rows.length-1))},y=function(v){return top+plotH-(Number(v)-min)*plotH/(max-min||1)};let out='<svg viewBox=\"0 0 '+w+' '+h+'\" width=\"100%\" height=\"100%\" role=\"img\"><line x1=\"'+left+'\" y1=\"'+(top+plotH)+'\" x2=\"'+(left+plotW)+'\" y2=\"'+(top+plotH)+'\" stroke=\"#cbd8ea\"/>';"
new = "const x=function(i){return left+(rows.length<=1?plotW/2:i*plotW/(rows.length-1))},y=function(v){return top+plotH-(Number(v)-min)*plotH/(max-min||1)};const labelYs=rows.map(function(){return []});let out='<svg viewBox=\"0 0 '+w+' '+h+'\" width=\"100%\" height=\"100%\" role=\"img\"><line x1=\"'+left+'\" y1=\"'+(top+plotH)+'\" x2=\"'+(left+plotW)+'\" y2=\"'+(top+plotH)+'\" stroke=\"#cbd8ea\"/>';"
if old not in s:
    raise SystemExit('lineSvg header anchor not found')
s = s.replace(old, new, 1)
old_point = "const cx=x(i),cy=y(Number(r[k.key])),offset=keys.length===1?-10:(ki===0?-12:ki===1?6:20),ly=Math.max(18,Math.min(h-bottom-2,cy+offset));out+='<circle cx=\"'+cx+'\" cy=\"'+cy+'\" r=\"4\" fill=\"'+color+'\"/><text x=\"'+cx+'\" y=\"'+ly+'\" text-anchor=\"middle\" class=\"svg-value\" style=\"fill:'+color+'\">'+esc(formatChartValue(r[k.key]))+'</text>'"
new_point = "const cx=x(i),cy=y(Number(r[k.key]));let lx=cx,ly=Math.max(20,Math.min(h-bottom-4,cy+(keys.length===1?-12:0)));if(keys.length>1){const used=labelYs[i],offsets=[-28,0,28,-46,46,-64,64];for(let oi=0;oi<offsets.length;oi++){const candidate=Math.max(20,Math.min(h-bottom-4,cy+offsets[(oi+ki)%offsets.length]));if(!used.some(function(prev){return Math.abs(prev-candidate)<22})){ly=candidate;break}}used.push(ly);lx=cx+([-10,0,10][ki]||0)};out+='<circle cx=\"'+cx+'\" cy=\"'+cy+'\" r=\"4\" fill=\"'+color+'\"/><text x=\"'+lx+'\" y=\"'+ly+'\" text-anchor=\"middle\" class=\"svg-value\" style=\"fill:'+color+'\">'+esc(formatChartValue(r[k.key]))+'</text>'"
if old_point not in s:
    raise SystemExit('lineSvg point anchor not found')
s = s.replace(old_point, new_point, 1)
page.write_text(s)

qa = Path('scripts/qa-dashboard-data-sync.ts')
q = qa.read_text()
anchor = "assert.equal(pageSource.includes('博士'),false,'researcher UI must not display 博士');\n"
addition = "assert.equal(pageSource.includes('博士'),false,'researcher UI must not display 博士');\nassert.ok(pageSource.includes('#chartPersona{height:390px;overflow-y:visible}'),'persona chart must reserve enough vertical space for all 9 rows');\nassert.ok(pageSource.includes('const labelYs=rows.map(function(){return []})'),'line graph must track per-date label positions');\nconst ninePersonas=Array.from({length:9},(_,i)=>({label:'Persona '+(i+1),value:9-i}));\nconst ninePersonaHtml=context.barSvg(ninePersonas,'value',9);\nassert.equal((ninePersonaHtml.match(/bar-row-html/g)||[]).length,9,'persona chart must render all nine rows');\nconst collisionSvg=context.lineSvg([{date:'2026-08-30',a:4.5,b:4.5,c:4.5}],[{key:'a',label:'A'},{key:'b',label:'B'},{key:'c',label:'C'}]);\nconst ys=Array.from(collisionSvg.matchAll(/<text x=\"[^\"]+\" y=\"([^\"]+)\" text-anchor=\"middle\" class=\"svg-value\"/g)).map((m:any)=>Number(m[1]));\nassert.equal(ys.length,3,'reflection collision test must render three value labels');\nassert.ok(Math.min(...ys.map((y:number,i:number)=>Math.min(...ys.filter((_:number,j:number)=>j!==i).map((z:number)=>Math.abs(y-z)))))>=22,'overlapping reflection values must be separated vertically');\n"
if anchor not in q:
    raise SystemExit('QA anchor not found')
q = q.replace(anchor, addition, 1)
qa.write_text(q)
