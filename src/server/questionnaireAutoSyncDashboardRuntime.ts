import type { RequestHandler } from 'express';

function injectAutoSyncDashboard(html: string): string {
  if (!html.includes('id="questionnaireSection"')) return html;
  let out = html;
  const statusAnchor = '<p id="qStatus" class="q-status"></p>';
  const autoStatus = `${statusAnchor}<p id="qAutoSyncStatus" class="q-note">自動同期：30秒ごとに新しい回答を確認します。</p>`;
  if (out.includes(statusAnchor) && !out.includes('id="qAutoSyncStatus"')) {
    out = out.replace(statusAnchor, autoStatus);
  }

  const script = `<script>
(function(){
  var lastRevision=null,initialized=false,busy=false;
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
      if(status){status.textContent=data.lastIngestedAt?'自動同期：最終取込 '+new Date(data.lastIngestedAt).toLocaleString('ja-JP')+'（30秒ごとに確認）':'自動同期：まだ取込回答はありません（30秒ごとに確認）'}
      if(initialized&&revision!==lastRevision&&revision!=='|'){
        if(status)status.textContent='自動同期：新しい回答を検知しました。統計表を更新します…';
        setTimeout(function(){location.reload()},600);
        return;
      }
      lastRevision=revision;initialized=true;
    }catch(_error){}finally{busy=false}
  }
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
