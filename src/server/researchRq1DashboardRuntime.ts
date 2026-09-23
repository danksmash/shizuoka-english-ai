import type { RequestHandler } from 'express';

function injectRq1Link(html: string) {
  if (!html.includes('/research-rq2.html') || html.includes('/research-rq1.html')) return html;
  const anchor = '<a href="/research-rq2.html"><button id="rq2Btn" class="secondary">RQ2コード分析</button></a>';
  const insert = '<a href="/research-rq1.html"><button id="rq1Btn" class="secondary">RQ1選択分析</button></a>' + anchor;
  let out = html.includes(anchor) ? html.replace(anchor, insert) : html;
  const oldOverview = 'RQ2のコードブック開発・一致度確認と、RQ3の全縦断類型分布分析は専用ページで実施し、Dashboard初期表示では重いコードデータを読み込みません。';
  const newOverview = 'RQ1の対応国表固定・選択率・移行率・継続率用CSV、RQ2のコードブック開発・一致度確認、RQ3の全縦断類型分布分析は専用ページで実施し、Dashboard初期表示では重い分析データを読み込みません。';
  if (out.includes(oldOverview)) out = out.replace(oldOverview, newOverview);
  return out;
}

export function withResearchRq1DashboardLink(path: string, handler: RequestHandler): RequestHandler {
  if (path !== '/management') return handler;
  return (req, res, next) => {
    const originalSend = res.send.bind(res);
    (res as any).send = (body: any) => originalSend(typeof body === 'string' ? injectRq1Link(body) : body);
    return handler(req, res, next);
  };
}
