import type { RequestHandler } from 'express';

function injectQuestionnaireDescriptiveDashboard(html: string): string {
  if (!html.includes('id="questionnaireSection"') || html.includes('id="questionnaireDescriptiveBlock"')) return html;

  const style = `<style>
#questionnaireDescriptiveBlock{margin-top:16px;padding-top:4px}.qd-heading{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-bottom:8px}.qd-heading h3{margin:0 0 4px;font-size:17px}.qd-note{font-size:11px;line-height:1.55;color:#526581;margin:3px 0}.qd-status{font-size:11px;font-weight:800;color:#174aa8;margin:6px 0}.qd-table-wrap{overflow-x:auto;border:1px solid #dce5f1;border-radius:10px}.qd-table{width:100%;min-width:1380px;border-collapse:collapse;font-size:12px}.qd-table th,.qd-table td{border-right:1px solid #dce5f1;border-bottom:1px solid #dce5f1;padding:7px 6px;text-align:center;white-space:nowrap}.qd-table th{background:#f3f7fc;color:#173461;font-weight:900}.qd-table thead tr:first-child th{background:#eaf2ff}.qd-table th:last-child,.qd-table td:last-child{border-right:0}.qd-table tbody tr:last-child td{border-bottom:0}.qd-table td:first-child{font-weight:900;text-align:left;background:#fbfdff}.qd-chart-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}.qd-chart-card{border:1px solid #dce5f1;border-radius:10px;padding:10px;background:#fff;min-width:0}.qd-chart-card h4{margin:0 0 6px;font-size:14px}.qd-chart{overflow-x:auto;min-height:286px}.qd-chart svg{width:100%;min-width:650px;height:276px;display:block}.qd-paired-head{margin-top:18px;padding:11px 12px;background:#f8fbff;border:1px solid #dce7f5;border-radius:10px}.qd-paired-head h3{margin:0 0 3px;font-size:17px}.qd-paired-head p{margin:0;font-size:11px;line-height:1.5;color:#526581}@media(max-width:900px){.qd-chart-grid{grid-template-columns:1fr}}
</style>`;

  const block = `<div id="questionnaireDescriptiveBlock"><div class="qd-heading"><div><h3>学級別 記述統計（各時点の有効回答者）</h3><p class="qd-note"><b>欠席者がいる場合も、その時点で回答済みの児童だけで N・平均値（M）・標準偏差（SD）を表示します。</b> 後日回答が追加されると、Google Forms自動同期後に最新値へ更新されます。</p><p class="qd-note">同一 research_id × 調査時点に複数回答がある場合は重複として記述統計から除外します。N=1 は平均値のみ表示し SD は「—」、N=0 は M(SD) を「—」とします。</p></div></div><p id="qdStatus" class="qd-status">学級別記述統計を読み込み中…</p><div class="qd-table-wrap"><table class="qd-table"><thead><tr><th rowspan="2">対象</th><th rowspan="2">Pre N</th><th rowspan="2">Post N</th><th colspan="2">主体的に学習に取り組む態度</th><th colspan="2">粘り強さ</th><th colspan="2">学習の自己調整</th><th colspan="2">L2 WTC</th></tr><tr><th>Pre M(SD)</th><th>Post M(SD)</th><th>Pre M(SD)</th><th>Post M(SD)</th><th>Pre M(SD)</th><th>Post M(SD)</th><th>Pre M(SD)</th><th>Post M(SD)</th></tr></thead><tbody id="qdTableBody"></tbody></table></div><div class="qd-chart-grid"><div class="qd-chart-card"><h4>主体的に学習に取り組む態度</h4><div id="qdChartTotal" class="qd-chart"></div></div><div class="qd-chart-card"><h4>粘り強さ</h4><div id="qdChartPersistence" class="qd-chart"></div></div><div class="qd-chart-card"><h4>学習の自己調整</h4><div id="qdChartSelfRegulation" class="qd-chart"></div></div><div class="qd-chart-card"><h4>L2 WTC</h4><div id="qdChartL2wtc" class="qd-chart"></div></div></div></div><div class="qd-paired-head"><h3>事前・事後対応分析（Pre/Post 両方がある同一児童のみ）</h3><p>以下の表の Pre M(SD)［paired］・Post M(SD)［paired］、ΔM、対応のある t 検定、Wilcoxon、効果量は、同一 research_id で事前・事後の両方に有効回答がある児童だけを対象に算出します。</p></div>`;

  const script = `<script>
(function(){
  function qd$(id){return document.getElementById(id)}
  function esc(value){return String(value===null||value===undefined?'':value).replace(/[&<>\"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]})}
  function fmt(value,digits){return value===null||value===undefined||!isFinite(Number(value))?'—':Number(value).toFixed(digits===undefined?2:digits)}
  function ms(metric){if(!metric||metric.mean===null||metric.mean===undefined)return '—';return fmt(metric.mean,2)+' ('+(metric.sd===null||metric.sd===undefined?'—':fmt(metric.sd,2))+')'}
  function normalizeAutoStatus(){
    var el=qd$('qAutoSyncStatus');if(!el)return;
    var current=String(el.textContent||'');
    var next=current
      .replace('M・SDは事前・事後の両方に有効回答があるpaired児童について算出します。','記述統計は各時点の有効回答者で算出し、対応分析のみ paired 児童を使用します。')
      .replace('M・SDはpaired児童で算出。','記述統計は各時点の有効回答者で算出。対応分析のみ paired 児童を使用。');
    if(next!==current)el.textContent=next;
  }
  function watchAutoStatus(){
    normalizeAutoStatus();var el=qd$('qAutoSyncStatus');
    if(el&&window.MutationObserver)new MutationObserver(normalizeAutoStatus).observe(el,{childList:true,characterData:true,subtree:true});
  }
  function renderTable(rows){
    var tbody=qd$('qdTableBody');if(!tbody)return;
    tbody.innerHTML=rows.map(function(row){return '<tr><td>'+esc(row.groupLabel)+'</td><td>'+row.pre.n+'</td><td>'+row.post.n+'</td><td>'+ms(row.pre.total)+'</td><td>'+ms(row.post.total)+'</td><td>'+ms(row.pre.persistence)+'</td><td>'+ms(row.post.persistence)+'</td><td>'+ms(row.pre.self_regulation)+'</td><td>'+ms(row.post.self_regulation)+'</td><td>'+ms(row.pre.l2wtc)+'</td><td>'+ms(row.post.l2wtc)+'</td></tr>'}).join('');
  }
  function renderChart(targetId,rows,key){
    var target=qd$(targetId);if(!target)return;
    var width=760,height=276,left=42,right=12,top=20,bottom=220,plotW=width-left-right,plotH=bottom-top;
    function y(value){return top+(6-Number(value))/5*plotH}
    var groupW=plotW/Math.max(1,rows.length),barW=Math.min(17,groupW*.23);
    var svg='<svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="質問紙記述統計グラフ">';
    for(var tick=1;tick<=6;tick+=1){var ty=y(tick);svg+='<line x1="'+left+'" x2="'+(width-right)+'" y1="'+ty+'" y2="'+ty+'" stroke="#e5edf7" stroke-width="1"/><text x="'+(left-8)+'" y="'+(ty+4)+'" text-anchor="end" font-size="11" fill="#64748b">'+tick+'</text>'}
    svg+='<line x1="'+left+'" x2="'+left+'" y1="'+top+'" y2="'+bottom+'" stroke="#9fb1c9"/><line x1="'+left+'" x2="'+(width-right)+'" y1="'+bottom+'" y2="'+bottom+'" stroke="#9fb1c9"/>';
    rows.forEach(function(row,index){
      var cx=left+groupW*(index+.5),pre=row.pre[key],post=row.post[key];
      function bar(metric,x,fill){
        if(!metric||metric.mean===null||metric.mean===undefined)return '';
        var py=y(metric.mean),h=Math.max(1,bottom-py),out='<rect x="'+(x-barW/2)+'" y="'+py+'" width="'+barW+'" height="'+h+'" rx="2" fill="'+fill+'"/>';
        if(metric.sd!==null&&metric.sd!==undefined&&isFinite(Number(metric.sd))){var hi=Math.min(6,Number(metric.mean)+Number(metric.sd)),lo=Math.max(1,Number(metric.mean)-Number(metric.sd)),yHi=y(hi),yLo=y(lo);out+='<line x1="'+x+'" x2="'+x+'" y1="'+yHi+'" y2="'+yLo+'" stroke="#526581"/><line x1="'+(x-4)+'" x2="'+(x+4)+'" y1="'+yHi+'" y2="'+yHi+'" stroke="#526581"/><line x1="'+(x-4)+'" x2="'+(x+4)+'" y1="'+yLo+'" y2="'+yLo+'" stroke="#526581"/>'}
        return out;
      }
      svg+=bar(pre,cx-barW*.62,'#8db9ff')+bar(post,cx+barW*.62,'#1767ed');
      svg+='<text x="'+cx+'" y="'+(bottom+18)+'" text-anchor="middle" font-size="11" font-weight="700" fill="#425878">'+esc(row.groupLabel)+'</text>';
    });
    svg+='<rect x="'+(width-174)+'" y="4" width="10" height="10" rx="1" fill="#8db9ff"/><text x="'+(width-158)+'" y="13" font-size="11" fill="#526581">Pre</text><rect x="'+(width-116)+'" y="4" width="10" height="10" rx="1" fill="#1767ed"/><text x="'+(width-100)+'" y="13" font-size="11" fill="#526581">Post</text><text x="'+(left+plotW/2)+'" y="'+(height-6)+'" text-anchor="middle" font-size="10" fill="#64748b">6件法平均値／エラーバー = ±1SD（SD算出可能時）</text></svg>';
    target.innerHTML=svg;
  }
  function render(data){
    var rows=Array.isArray(data.rows)?data.rows:[];renderTable(rows);
    renderChart('qdChartTotal',rows,'total');renderChart('qdChartPersistence',rows,'persistence');renderChart('qdChartSelfRegulation',rows,'self_regulation');renderChart('qdChartL2wtc',rows,'l2wtc');
    var status=qd$('qdStatus');if(status)status.textContent='各時点の有効回答者に基づく最新の記述統計です。';
  }
  async function load(){
    try{var res=await fetch('/api/management/questionnaire/descriptive',{method:'POST',credentials:'same-origin'});if(res.status===401||res.status===403)return;var data=await res.json();if(!res.ok||!data.success)throw new Error(data.error||'LOAD_FAILED');render(data)}catch(error){var status=qd$('qdStatus');if(status)status.textContent='学級別記述統計を読み込めません: '+String(error&&error.message||error)}
  }
  var tries=0;(function waitPanel(){tries+=1;var panel=qd$('panel');if(panel&&panel.style.display!=='none'){watchAutoStatus();load();return}if(tries<600)setTimeout(waitPanel,500)})();
})();
</script>`;

  let out = html
    .replace('統計は同一research_idの事前・事後ペアだけで計算します。', '記述統計は各調査時点の有効回答者で算出し、対応分析は同一research_idの事前・事後ペアだけで計算します。')
    .replace('M・SDは事前・事後の両方に有効回答があるpaired児童について算出します。', '記述統計は各時点の有効回答者で算出し、対応分析のみ paired 児童を使用します。');
  if (out.includes('</style>')) out = out.replace('</style>', `</style>${style}`);
  if (out.includes('<div id="qTables"></div>')) out = out.replace('<div id="qTables"></div>', `${block}<div id="qTables"></div>`);
  if (out.includes('</body>')) out = out.replace('</body>', `${script}</body>`);
  return out;
}

export function withQuestionnaireDescriptiveDashboardRuntime(path: string, handler: RequestHandler): RequestHandler {
  if (path !== '/management') return handler;
  return (req, res, next) => {
    const originalSend = res.send.bind(res);
    (res as any).send = (body: any) => originalSend(typeof body === 'string' ? injectQuestionnaireDescriptiveDashboard(body) : body);
    return handler(req, res, next);
  };
}
