import type { RequestHandler } from 'express';

type Row = Record<string, any>;

function normalizedChildWordCount(row: Row | undefined): number | null {
  if (!row || String(row.data_quality_flag || '') === 'missing_core') return null;
  const raw = row.child_total_words;
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.trunc(value);
}

export function enhanceRecentSessionWordCounts(body: any, exportSessions: Row[]): any {
  if (!body || body.success === false || !Array.isArray(body.recentSessions)) return body;
  if (!Array.isArray(exportSessions)) return body;

  const wordCounts = new Map<string, number | null>();
  for (const row of exportSessions) {
    const sessionId = String(row?.session_id || '');
    if (!sessionId) continue;
    wordCounts.set(sessionId, normalizedChildWordCount(row));
  }

  return {
    ...body,
    recentSessions: body.recentSessions.map((row: Row) => {
      const sessionId = String(row?.session_id || '');
      return {
        ...row,
        child_total_words: wordCounts.has(sessionId) ? wordCounts.get(sessionId) : null,
      };
    }),
  };
}

const RECENT_SESSION_WORD_COUNT_SCRIPT = `<script id="recentSessionWordCountRuntime">
(function(){
  var currentRows=[],wordCounts=new Map();
  function validWordCount(value){var n=Number(value);return value!==null&&value!==undefined&&value!==''&&Number.isFinite(n)&&n>=0?Math.trunc(n):null}
  function wordText(value){var n=validWordCount(value);return n===null?'—':String(n)+'語'}
  function setHeader(){var table=document.querySelector('.recent-card table.recent');if(!table)return;var th=table.querySelector('thead th:last-child');if(th&&th.textContent!=='発話語数')th.textContent='発話語数'}
  function captureRows(d){currentRows=Array.isArray(d&&d.recentSessions)?d.recentSessions:[];wordCounts=new Map();currentRows.forEach(function(row){var id=String(row&&row.session_id||'');if(id)wordCounts.set(id,validWordCount(row.child_total_words))})}
  function rewriteRecentWordCells(){
    setHeader();
    var body=document.getElementById('recentRows');if(!body)return;
    Array.prototype.forEach.call(body.querySelectorAll('tr'),function(row,index){
      if(!row.cells||row.cells.length<6)return;
      var sessionId=String(row.getAttribute('data-rsh-session')||'');
      var value=sessionId&&wordCounts.has(sessionId)?wordCounts.get(sessionId):(currentRows[index]?validWordCount(currentRows[index].child_total_words):null);
      var text=wordText(value),cell=row.cells[5];
      if(cell.textContent!==text)cell.textContent=text;
      if(cell.getAttribute('data-recent-word-count')!=='1')cell.setAttribute('data-recent-word-count','1');
    });
  }
  var previous=window.renderDashboard;
  if(typeof previous==='function'&&!previous.__recentSessionWordCountWrapped){
    var wrapped=function(d,q){captureRows(d);var result=previous(d,q);rewriteRecentWordCells();setTimeout(rewriteRecentWordCells,0);return result};
    wrapped.__recentSessionWordCountWrapped=true;
    window.renderDashboard=wrapped;
  }
  setHeader();
  var body=document.getElementById('recentRows');
  if(body&&typeof MutationObserver==='function'){
    new MutationObserver(function(){rewriteRecentWordCells()}).observe(body,{childList:true,subtree:true});
  }
  rewriteRecentWordCells();
})();
</script>`;

export function injectRecentSessionWordCountManagementHtml(html: string): string {
  if (!html || html.includes('recentSessionWordCountRuntime')) return html;
  return html.includes('</body>')
    ? html.replace('</body>', RECENT_SESSION_WORD_COUNT_SCRIPT + '</body>')
    : html + RECENT_SESSION_WORD_COUNT_SCRIPT;
}

export function withResearchRecentSessionWordCount(path: string, handler: RequestHandler): RequestHandler {
  if (path === '/management') {
    return (req, res, next) => {
      const originalSend = res.send.bind(res);
      (res as any).send = (body: any) => originalSend(
        typeof body === 'string' ? injectRecentSessionWordCountManagementHtml(body) : body,
      );
      return handler(req, res, next);
    };
  }

  if (path === '/api/management/research.dashboard') {
    return (req, res, next) => {
      const originalJson = res.json.bind(res);
      (res as any).json = (body: any) => {
        const sessions = Array.isArray(res.locals.researchDashboardExportSessions)
          ? res.locals.researchDashboardExportSessions as Row[]
          : [];
        return originalJson(enhanceRecentSessionWordCounts(body, sessions));
      };
      return handler(req, res, next);
    };
  }

  return handler;
}
