import type { RequestHandler } from 'express';

export function removeQuestionnaireManualImportUi(html: string): string {
  return html
    .replace(/<label>調査時点<select id="qWave">[\s\S]*?<\/select><\/label>/, '')
    .replace(/<label>Google Forms回答CSV<input id="qCsvFile"[^>]*><\/label>/, '')
    .replace(/<button id="qImportBtn"[^>]*>回答CSVを取り込む<\/button>/, '')
    .replace(
      "q$('qImportBtn').addEventListener('click',importCsv);",
      "if(q$('qImportBtn'))q$('qImportBtn').addEventListener('click',importCsv);",
    );
}

function injectAutoSyncDashboard(html: string): string {
  if (!html.includes('id="questionnaireSection"')) return html;
  let out = removeQuestionnaireManualImportUi(html)
    .replace('Pre M(SD)</th>', 'Pre M(SD)［paired］</th>')
    .replace('Post M(SD)</th>', 'Post M(SD)［paired］</th>');
  const statusAnchor = '<p id="qStatus" class="q-status"></p>';
  const autoStatus = `${statusAnchor}<p id="qAutoSyncStatus" class="q-note">Google Forms自動同期：事前／事後はForm IDから自動判定し、30秒ごとに新しい回答を確認します。M・SDは事前・事後の両方に有効回答があるpaired児童について算出します。</p>`;
  if (out.includes(statusAnchor) && !out.includes('id="qAutoSyncStatus"')) {
    out = out.replace(statusAnchor, autoStatus);
  }

  const script = `<script>
(function(){
  var lastRevision=null,initialized=false,busy=false;

  function patchReflectionMarkers(){
    var svg=document.querySelector('#chartReflection svg');
    if(!svg)return;
    var order={'#2774ee':0,'#20a567':1,'#f59e0b':2};
    var markers=[];
    Array.prototype.forEach.call(svg.querySelectorAll('g'),function(g){
      var shape=g.querySelector('circle,rect,polygon');
      if(!shape||!shape.getBBox)return;
      var stroke=String(shape.getAttribute('stroke')||'').toLowerCase();
      if(order[stroke]===undefined)return;
      var box=shape.getBBox();
      var cx=box.x+box.width/2,cy=box.y+box.height/2;
      if(cy<55)return;
      g.setAttribute('transform','translate(0 0)');
      shape.setAttribute('stroke-width','2');
      if(shape.tagName.toLowerCase()==='circle'){
        shape.setAttribute('r','3.4');
      }else if(shape.tagName.toLowerCase()==='rect'){
        shape.setAttribute('x',String(cx-3.5));shape.setAttribute('y',String(cy-3.5));
        shape.setAttribute('width','7');shape.setAttribute('height','7');shape.setAttribute('rx','1');
      }else{
        shape.setAttribute('points',cx+','+(cy-4.3)+' '+(cx+4.3)+','+cy+' '+cx+','+(cy+4.3)+' '+(cx-4.3)+','+cy);
      }
      markers.push({g:g,cx:cx,cy:cy,order:order[stroke]});
    });
    Array.prototype.forEach.call(svg.querySelectorAll('polyline'),function(line){
      var stroke=String(line.getAttribute('stroke')||'').toLowerCase();
      if(order[stroke]!==undefined)line.setAttribute('stroke-width','2.25');
    });
    var groups={};
    markers.forEach(function(item){var key=String(Math.round(item.cx));(groups[key]||(groups[key]=[])).push(item)});
    Object.keys(groups).forEach(function(key){
      var group=groups[key];if(group.length<2)return;
      var crowded=false;
      for(var i=0;i<group.length;i+=1){for(var j=i+1;j<group.length;j+=1){if(Math.abs(group[i].cy-group[j].cy)<10){crowded=true}}}
      if(!crowded)return;
      group.sort(function(a,b){return a.order-b.order});
      var offsets=group.length>=3?[-5,0,5]:[-3.5,3.5];
      group.forEach(function(item,index){item.g.setAttribute('transform','translate('+(offsets[index]||0)+' 0)')});
    });
  }

  var patchQueued=false;
  function scheduleReflectionPatch(){
    if(patchQueued)return;patchQueued=true;
    var run=function(){patchQueued=false;patchReflectionMarkers()};
    if(window.requestAnimationFrame)window.requestAnimationFrame(run);else setTimeout(run,0);
  }
  function watchReflectionChart(){
    var chart=document.getElementById('chartReflection');if(!chart)return;
    scheduleReflectionPatch();
    if(window.MutationObserver)new MutationObserver(scheduleReflectionPatch).observe(chart,{childList:true,subtree:true});
  }

  async function pollQuestionnaireRevision(){
    if(busy)return;
    var section=document.getElementById('questionnaireSection');
    if(!section||section.style.display==='none')return;
    busy=true;
    try{
      var res=await fetch('/api/management/questionnaire/revision',{method:'POST',credentials:'same-origin'});
      if(res.status===401||res.status===403)return;
      var data=await res.json();
      if(!res.ok||!data.success)return;
      var revision=String(data.lastIngestedAt||'')+'|'+String(data.lastResponseId||'');
      var status=document.getElementById('qAutoSyncStatus');
      if(status){status.textContent=data.lastIngestedAt?'Google Forms自動同期：最終取込 '+new Date(data.lastIngestedAt).toLocaleString('ja-JP')+'（30秒ごとに確認／事前・事後は自動判定）。M・SDはpaired児童で算出。':'Google Forms自動同期：まだ取込回答はありません（30秒ごとに確認／事前・事後は自動判定）。M・SDはpaired児童で算出。'}
      if(initialized&&revision!==lastRevision&&revision!=='|'){
        if(status)status.textContent='Google Forms自動同期：新しい回答を検知しました。統計表を更新します…';
        setTimeout(function(){location.reload()},600);
        return;
      }
      lastRevision=revision;initialized=true;
    }catch(_error){}finally{busy=false}
  }
  setTimeout(watchReflectionChart,700);
  setTimeout(pollQuestionnaireRevision,3000);
  setInterval(pollQuestionnaireRevision,30000);
})();
</script>`;
  if (!out.includes('pollQuestionnaireRevision') && out.includes('</body>')) {
    out = out.replace('</body>', `${script}</body>`);
  }
  return out;
}

export function withQuestionnaireAutoSyncDashboardRuntime(path: string, handler: RequestHandler): RequestHandler {
  if (path !== '/management') return handler;
  return (req, res, next) => {
    const originalSend = res.send.bind(res);
    (res as any).send = (body: any) => originalSend(typeof body === 'string' ? injectAutoSyncDashboard(body) : body);
    return handler(req, res, next);
  };
}
