import type { RequestHandler } from 'express';

function injectReflectionChartPolish(html: string): string {
  if (!html.includes('id="chartReflection"') || html.includes('researchReflectionChartPolish')) return html;
  const script = `<script id="researchReflectionChartPolish">
(function(){
  function patchResearchLineMarkers(chartId){
    var svg=document.querySelector('#'+chartId+' svg');
    if(!svg)return;
    var order={'#2774ee':0,'#20a567':1,'#f59e0b':2};
    // Never displace individual data-point markers away from line vertices.
    Array.prototype.forEach.call(svg.querySelectorAll('g'),function(g){
      var shape=g.querySelector('circle,rect,polygon');
      if(!shape||!shape.getBBox)return;
      var stroke=String(shape.getAttribute('stroke')||'').toLowerCase();
      if(order[stroke]===undefined)return;
      var box=shape.getBBox();
      var cx=box.x+box.width/2,cy=box.y+box.height/2;
      if(cy<48)return;
      g.setAttribute('transform','translate(0 0)');
      shape.setAttribute('stroke-width','1.8');
      if(shape.tagName.toLowerCase()==='circle'){
        shape.setAttribute('r','3.2');
      }else if(shape.tagName.toLowerCase()==='rect'){
        shape.setAttribute('x',String(cx-3.2));shape.setAttribute('y',String(cy-3.2));
        shape.setAttribute('width','6.4');shape.setAttribute('height','6.4');shape.setAttribute('rx','0.8');
      }else{
        shape.setAttribute('points',cx+','+(cy-4)+' '+(cx+4)+','+cy+' '+cx+','+(cy+4)+' '+(cx-4)+','+cy);
      }
    });
    Array.prototype.forEach.call(svg.querySelectorAll('polyline'),function(line){
      var stroke=String(line.getAttribute('stroke')||'').toLowerCase();
      if(order[stroke]!==undefined)line.setAttribute('stroke-width','1.6');
    });

  }

  var queued=false;
  function schedule(){
    if(queued)return;queued=true;
    var run=function(){queued=false;patchResearchLineMarkers('chartReflection');patchResearchLineMarkers('chartWords')};
    if(window.requestAnimationFrame)window.requestAnimationFrame(run);else setTimeout(run,0);
  }
  function watch(){
    var charts=['chartReflection','chartWords'].map(function(id){return document.getElementById(id)}).filter(Boolean);
    if(!charts.length)return;
    schedule();
    if(window.MutationObserver)charts.forEach(function(chart){new MutationObserver(schedule).observe(chart,{childList:true,subtree:true})});
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
