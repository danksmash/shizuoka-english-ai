import type { RequestHandler } from 'express';

function injectResearchDashboardChartLayout(html: string): string {
  if (!html.includes('class="charts"') || html.includes('researchDashboardChartLayout')) return html;

  const style = `<style id="researchDashboardChartLayoutStyle">
.charts.research-balanced-chart-layout{align-items:start}.research-chart-column{min-width:0;display:flex;flex-direction:column;gap:14px;align-self:start}.research-chart-column>.chart-card{min-height:0;height:auto;align-self:stretch}.research-balanced-chart-layout #chartDaily:has(.daily-class-stack-chart){height:auto;min-height:0;overflow:visible}.research-balanced-chart-layout #chartDaily:has(.daily-class-stack-chart) .daily-class-stack-chart{height:auto}.research-balanced-chart-layout #chartDaily:has(.daily-class-stack-chart) .daily-class-stack-rows{flex:0 0 auto;overflow-y:visible;scrollbar-gutter:auto}@media(max-width:760px){.charts.research-balanced-chart-layout{grid-template-columns:1fr}.research-chart-column{gap:14px}}
</style>`;

  const script = `<script id="researchDashboardChartLayout">
(function(){
  function chartCard(id){
    var node=document.getElementById(id);
    return node&&node.closest?node.closest('.chart-card'):null;
  }
  function balanceResearchCharts(){
    var charts=document.querySelector('.charts');
    if(!charts||charts.getAttribute('data-research-balanced')==='1')return;
    var daily=chartCard('chartDaily');
    var persona=chartCard('chartPersona');
    var words=chartCard('chartWords');
    var reflection=chartCard('chartReflection');
    if(!daily||!persona||!words||!reflection)return;

    var left=document.createElement('div');
    var right=document.createElement('div');
    left.className='research-chart-column research-chart-column-left';
    right.className='research-chart-column research-chart-column-right';
    charts.appendChild(left);
    charts.appendChild(right);
    left.appendChild(daily);
    left.appendChild(words);
    right.appendChild(persona);
    right.appendChild(reflection);
    charts.classList.add('research-balanced-chart-layout');
    charts.setAttribute('data-research-balanced','1');
  }
  balanceResearchCharts();
})();
</script>`;

  return html.replace('</head>', `${style}</head>`).replace('</body>', `${script}</body>`);
}

export function withResearchDashboardChartLayout(path: string, handler: RequestHandler): RequestHandler {
  if (path !== '/management') return handler;
  return (req, res, next) => {
    const originalSend = res.send.bind(res);
    (res as any).send = (body: any) => originalSend(
      typeof body === 'string' ? injectResearchDashboardChartLayout(body) : body,
    );
    return handler(req, res, next);
  };
}
