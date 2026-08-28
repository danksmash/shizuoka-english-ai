import { ChatMessage, FeedbackData, StudentProfile } from '../types';
import { getAIStudentById } from '../data/curriculum';
import { getJapaneseTranslationForMessage } from './translation';
import { maskTextForExternalUse } from './privacy';

// User- and AI-generated text is escaped before insertion into exported HTML.
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeDisplayText(value: unknown): string {
  return escapeHtml(maskTextForExternalUse(String(value ?? '')));
}

export function downloadDialogueLogHTML(
  profile: StudentProfile,
  messages: ChatMessage[],
  feedback: FeedbackData | null,
  totalTurns: number,
  totalWords: number,
  durationSeconds: number
) {
  const aiStudent = feedback?.aiStudent || getAIStudentById(profile.selectedAiStudentId);
  const dateStr = new Date().toLocaleString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  const timeFormatted = `${minutes}分${seconds < 10 ? '0' : ''}${seconds}秒`;

  const transcriptRows = messages.map((msg) => {
    const isAI = msg.sender === 'ai';
    const speakerName = isAI
      ? `${aiStudent.flag} ${aiStudent.name} (${aiStudent.countryJapanese}留学生)`
      : `🧒 ${safeDisplayText(profile.name || 'じどう')} (5年生)`;
    const bubbleBg = isAI ? '#f0fdf4' : '#eff6ff';
    const borderCol = isAI ? '#86efac' : '#93c5fd';
    const badge = isAI
      ? '<span style="background:#16a34a;color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:bold;">AI 留学生</span>'
      : '<span style="background:#2563eb;color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:bold;">5年生</span>';
    const translation = msg.japaneseText || getJapaneseTranslationForMessage(
      msg, profile.selectedAiStudentId, profile.selectedTopic
    );
    return `<div style="margin-bottom:16px;display:flex;flex-direction:column;">
      <div style="font-size:13px;font-weight:bold;margin-bottom:4px;color:#374151;">${escapeHtml(speakerName)} ${badge}</div>
      <div style="background:${bubbleBg};border:1px solid ${borderCol};border-radius:12px;padding:12px 16px;">
        <div style="font-size:16px;font-weight:600;color:#111827;line-height:1.5;">${safeDisplayText(msg.englishText)}</div>
        ${translation ? `<div style="font-size:13px;color:#4b5563;margin-top:6px;border-top:1px dashed ${borderCol};padding-top:6px;font-weight:500;">🇯🇵 訳: ${safeDisplayText(translation)}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  const goodPointsHTML = feedback?.goodPoints?.map((point, idx) => `
    <li style="margin-bottom:8px;line-height:1.6;">
      <strong style="color:#059669;">🌟 良かったところ ${idx + 1}:</strong> ${safeDisplayText(point)}
    </li>`).join('') || '<li>対話を最後まで頑張って続けられました！</li>';

  const adviceHTML = feedback?.improvementAdvice ? `
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;margin-top:8px;">
      <div style="font-weight:bold;color:#b45309;font-size:15px;margin-bottom:4px;">💡 ${safeDisplayText(feedback.improvementAdvice.title)}</div>
      <div style="font-size:14px;color:#4b5563;line-height:1.5;">${safeDisplayText(feedback.improvementAdvice.detail)}</div>
      ${feedback.improvementAdvice.examplePhrase ? `<div style="margin-top:8px;font-size:13px;background:#fff;padding:6px 10px;border-radius:6px;border:1px solid #fcd34d;"><strong>おすすめフレーズ:</strong> <code style="color:#d97706;font-size:14px;">${safeDisplayText(feedback.improvementAdvice.examplePhrase)}</code></div>` : ''}
    </div>` : '';

  const safeProfileName = safeDisplayText(profile.name || '5年生');
  const safeAiStudentName = escapeHtml(aiStudent.name);
  const safeAiCountryJapanese = escapeHtml(aiStudent.countryJapanese);
  const safeSelectedDuration = escapeHtml(profile.selectedDurationMinutes);
  const safeFeedbackOverall = feedback?.overallComment ? safeDisplayText(feedback.overallComment) : '';

  const htmlContent = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;">
<title>静岡大学 留学生英語交流 事前練習レポート - ${safeProfileName}</title>
<style>
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-print{display:none}}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;background:#f9fafb;color:#1f2937;margin:0;padding:24px}
.card{max-width:800px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 4px 6px -1px rgba(0,0,0,.1);border:1px solid #e5e7eb}
.header-banner{background:linear-gradient(135deg,#1e40af 0%,#047857 100%);color:#fff;padding:20px;border-radius:12px;margin-bottom:24px;text-align:center}
.stats-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px}.stat-box{background:#f3f4f6;border-radius:10px;padding:16px;text-align:center}.stat-number{font-size:26px;font-weight:bold;color:#1e40af}.stat-label{font-size:13px;color:#4b5563;margin-top:4px}.section-title{font-size:18px;font-weight:bold;color:#111827;border-bottom:2px solid #e5e7eb;padding-bottom:8px;margin-top:24px;margin-bottom:16px;display:flex;align-items:center;gap:8px}
</style></head><body><div class="card">
<div class="no-print" style="text-align:right;margin-bottom:16px;"><button onclick="window.print()" style="background:#2563eb;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-weight:bold;cursor:pointer;">🖨️ 印刷する / PDF保存</button></div>
<div class="header-banner"><div style="font-size:14px;opacity:.9;">小学校5年生 英語対話練習ポートフォリオ</div><h1 style="margin:6px 0;font-size:24px;">静岡大学 留学生交流会 事前対話レポート</h1><div style="font-size:14px;opacity:.9;">${escapeHtml(aiStudent.flag)} ${safeAiStudentName} (${safeAiCountryJapanese}) AI留学生との1対1対話</div></div>
<div style="display:flex;justify-content:space-between;font-size:14px;color:#4b5563;margin-bottom:20px;border-bottom:1px solid #e5e7eb;padding-bottom:12px;"><div><strong>お名前:</strong> ${safeProfileName} さん (小学5年生)</div><div><strong>実施日時:</strong> ${escapeHtml(dateStr)}</div></div>
<div class="stats-grid"><div class="stat-box"><div class="stat-number">${escapeHtml(totalTurns)} <span style="font-size:16px;">往復</span></div><div class="stat-label">対話ターン数 (1往復=1ターン)</div></div><div class="stat-box"><div class="stat-number">${escapeHtml(totalWords)} <span style="font-size:16px;">単語</span></div><div class="stat-label">児童の発話総語数</div></div><div class="stat-box"><div class="stat-number">${escapeHtml(timeFormatted)}</div><div class="stat-label">対話時間 (設定: ${safeSelectedDuration}分)</div></div></div>
<div class="section-title">✨ AI・指導アドバイス (ふりかえり)</div><div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:18px;margin-bottom:20px;"><div style="font-weight:bold;color:#166534;font-size:16px;margin-bottom:10px;">👍 良かったところ（3点）</div><ul style="margin:0;padding-left:20px;color:#1f2937;">${goodPointsHTML}</ul><div style="font-weight:bold;color:#92400e;font-size:16px;margin-top:16px;margin-bottom:6px;">💡 次回へのステップアップ（改善ポイント）</div>${adviceHTML}
${safeFeedbackOverall ? `<div style="margin-top:16px;padding:10px 14px;background:#fff;border-radius:8px;border:1px solid #86efac;font-size:14px;color:#15803d;line-height:1.6;"><strong>先生・${safeAiStudentName}からのメッセージ:</strong> ${safeFeedbackOverall}</div>` : ''}</div>
<div class="section-title">💬 対話ログ (Transcript)</div><div>${transcriptRows}</div>
<div style="margin-top:32px;padding-top:16px;border-top:1px dashed #d1d5db;font-size:12px;color:#9ca3af;text-align:center;">静岡大学 グローバル交流推進プログラム × 小学校外国語教育 (光村図書準拠)</div>
</div></body></html>`;

  try {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (profile.name || 'student').replace(/[/\\?%*:|"<>]/g, '_');
    a.href = url;
    a.download = `english-dialogue-${safeName}-${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to export dialogue log:', error);
    alert('レポートの保存に失敗しました。もう一度お試しください。');
  }
}
