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

function latestEndedAt(rows: Row[]): string {
  return rows
    .map((row) => String(row?.local_ended_at || '').trim())
    .filter(Boolean)
    .sort()
    .at(-1) || '';
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

  const metrics = body.metrics && typeof body.metrics === 'object'
    ? {
        ...body.metrics,
        ...(exportSessions.length ? { latestAt: latestEndedAt(exportSessions) } : {}),
      }
    : body.metrics;

  return {
    ...body,
    metrics,
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
  function setHeaders(){var table=document.querySelector('.recent-card table.recent');if(!table)return;var ths=table.querySelectorAll('thead th');if(ths[0]&&ths[0].textContent!=='開始日時')ths[0].textContent='開始日時';var last=ths[ths.length-1];if(last&&last.textContent!=='発話語数')last.textContent='発話語数'}
  function captureRows(d){currentRows=Array.isArray(d&&d.recentSessions)?d.recentSessions:[];wordCounts=new Map();currentRows.forEach(function(row){var id=String(row&&row.session_id||'');if(id)wordCounts.set(id,validWordCount(row.child_total_words))})}
  function rewriteRecentWordCells(){
    setHeaders();
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
  setHeaders();
  var body=document.getElementById('recentRows');
  if(body&&typeof MutationObserver==='function'){
    new MutationObserver(function(){rewriteRecentWordCells()}).observe(body,{childList:true,subtree:true});
  }
  rewriteRecentWordCells();
})();
</script>`;

function normalizeSessionTimeLabels(html: string): string {
  return html
    .replace(/>最終セッション日時</g, '>最終セッション終了日時<')
    .replace(/<th>日時<\/th>/g, '<th>開始日時</th>');
}

export function injectRecentSessionWordCountManagementHtml(html: string): string {
  if (!html) return html;
  const normalized = normalizeSessionTimeLabels(html);
  if (normalized.includes('recentSessionWordCountRuntime')) return normalized;
  return normalized.includes('</body>')
    ? normalized.replace('</body>', RECENT_SESSION_WORD_COUNT_SCRIPT + '</body>')
    : normalized + RECENT_SESSION_WORD_COUNT_SCRIPT;
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
