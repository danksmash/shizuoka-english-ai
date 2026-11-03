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

function injectPersonaChoiceLink(html: string) {
  const anchor = '<a href="/questionnaire-analysis.html"><button id="questionnaireBtn" class="secondary">質問紙分析</button></a>';
  const addition = '<a href="/persona-choice-analysis.html"><button id="personaChoiceReasonsBtn" class="secondary">追加質問紙（Persona選択理由）</button></a>';
  let result = html.includes(anchor) && !html.includes('/persona-choice-analysis.html')
    ? html.replace(anchor, anchor + addition)
    : html;
  // The formal bundle now contains an additional separate questionnaire CSV.
  result = result.replace('7 CSVを一括ZIP', '8 CSVを一括ZIP');
  result = result.replace('7 CSV一括ZIP', '8 CSV一括ZIP');
  result = result.replace(
    'student_questionnaires.csv の個別表示・DLは「質問紙分析」ページへ移しましたが、8 CSV一括ZIPには引き続き含まれます。',
    '質問紙2種の分析表示は各専用ページで行い、個別CSVは下のカードまたは専用ページからダウンロードできます。8 CSV一括ZIPにも両方を含みます。',
  );
  result = result.replace(
    'codebook.csv は7 CSVの全列の定義・型・値域・分析用途を収録します。',
    'student_questionnaires.csv と persona_choice_reason_responses.csv は research_id で既存データと結合できます。codebook.csv は8 CSVの全列の定義・型・値域・分析用途を収録します。',
  );
  const exportListAnchor = "const exportFiles=[...(d.exportFiles||[]),";
  const questionnaireCards = [
    "{dataset:'student_questionnaires',fileName:'student_questionnaires.csv',contains:'Pre・Mid・Postの15項目6件法質問紙と尺度得点',analysisUse:'3時点記述統計・児童単位の縦断分析・LMM用long形式',rowCount:'質問紙分析ページで確認'},",
    "{dataset:'persona_choice_reason_responses',fileName:'persona_choice_reason_responses.csv',contains:'初めの頃／最後の方のPersona選択理由・自由記述',analysisUse:'理由の継続・増加・減少と実際のPersona選択行動の照合',rowCount:'追加質問紙ページで確認'},",
  ].join('');
  if (result.includes(exportListAnchor) && !result.includes("fileName:'persona_choice_reason_responses.csv'")) {
    result = result.replace(exportListAnchor, exportListAnchor + questionnaireCards);
  }
  return result;
}

export function withResearchRq1DashboardLink(path: string, handler: RequestHandler): RequestHandler {
  if (path !== '/management') return handler;
  return (req, res, next) => {
    const originalSend = res.send.bind(res);
    (res as any).send = (body: any) => originalSend(typeof body === 'string' ? injectPersonaChoiceLink(injectRq1Link(body)) : body);
    return handler(req, res, next);
  };
}
