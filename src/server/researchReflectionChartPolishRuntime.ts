import type { RequestHandler } from 'express';

function injectReflectionChartPolish(html: string): string {
  if (!html.includes('id="chartReflection"') || html.includes('researchReflectionChartPolish')) return html;
  const script = `<script id="researchReflectionChartPolish">
(function(){
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
      for(var i=0;i<group.length;i+=1){for(var j=i+1;j<group.length;j+=1){if(Math.abs(group[i].cy-group[j].cy)<10)crowded=true}}
      if(!crowded)return;
      group.sort(function(a,b){return a.order-b.order});
      var offsets=group.length>=3?[-5,0,5]:[-3.5,3.5];
      group.forEach(function(item,index){item.g.setAttribute('transform','translate('+(offsets[index]||0)+' 0)')});
    });
  }

  var queued=false;
  function schedule(){
    if(queued)return;queued=true;
    var run=function(){queued=false;patchReflectionMarkers()};
    if(window.requestAnimationFrame)window.requestAnimationFrame(run);else setTimeout(run,0);
  }
  function watch(){
    var chart=document.getElementById('chartReflection');if(!chart)return;
    schedule();
    if(window.MutationObserver)new MutationObserver(schedule).observe(chart,{childList:true,subtree:true});
  }
  setTimeout(watch,700);
})();
</script>`;
  return html.replace('</body>', `${script}</body>`);
}

export function withResearchReflectionChartPolish(path: string, handler: RequestHandler): RequestHandler {
  if (path !== '/management') return handler;
  return (req, res, next) => {
    const originalSend = res.send.bind(res);
    (res as any).send = (body: any) => originalSend(typeof body === 'string' ? injectReflectionChartPolish(body) : body);
    return handler(req, res, next);
  };
}
