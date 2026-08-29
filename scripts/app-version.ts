import { execFileSync } from 'node:child_process';

export interface VersionHistoryEntry {
  version: string;
  build: string;
  changes: string;
}

export interface AppVersionMetadata {
  version: string;
  build: string;
  history: VersionHistoryEntry[];
}

const BASE_COMMIT = '93084a447229a4c69eebda1bfa711e579c658654';
const FIRST_DYNAMIC_PATCH = 3;

const SEEDED_HISTORY: VersionHistoryEntry[] = [
  {
    version: '1.0.2',
    build: '2026-08-29',
    changes: '対話後の学習表現を、会話全体と学習目標に基づいて選ぶ処理へ改善',
  },
  {
    version: '1.0.1',
    build: '2026-08-29',
    changes: '児童メイン画面の左右カラムの高さと表示バランスを調整',
  },
  {
    version: '1.0.0',
    build: '2026-08-29',
    changes: '児童メイン画面のAI留学生カードを狭い画面でも読みやすく調整',
  },
];

function buildDateInJapan(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function isVersionedCommit(subject: string): boolean {
  const text = subject.trim();
  if (!text) return false;
  if (/^Merge pull request\b/i.test(text)) return false;
  if (/^(chore|ci|docs|test|build)\s*:/i.test(text)) return false;
  if (/^(tmp|temporary|noop)\b/i.test(text)) return false;
  return true;
}

function cleanChangeDescription(subject: string): string {
  return subject
    .trim()
    .replace(/^(feat|fix|refactor|perf|style)\s*:\s*/i, '')
    .replace(/^update\s+/i, '')
    .trim() || 'アプリを更新';
}

function readVersionedCommits(): Array<{ date: string; subject: string }> {
  try {
    const output = execFileSync(
      'git',
      ['log', '--reverse', '--format=%cs%x1f%s', `${BASE_COMMIT}..HEAD`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [date, ...subjectParts] = line.split('\x1f');
        return { date, subject: subjectParts.join('\x1f') };
      })
      .filter((entry) => isVersionedCommit(entry.subject));
  } catch {
    return [];
  }
}

export function getAppVersionMetadata(now = new Date()): AppVersionMetadata {
  const build = buildDateInJapan(now);
  const commits = readVersionedCommits();
  const dynamicHistory = commits.map((commit, index) => ({
    version: `1.0.${FIRST_DYNAMIC_PATCH + index}`,
    build: commit.date || build,
    changes: cleanChangeDescription(commit.subject),
  }));

  if (dynamicHistory.length === 0) {
    dynamicHistory.push({
      version: `1.0.${FIRST_DYNAMIC_PATCH}`,
      build,
      changes: 'バージョン情報・Build情報・更新履歴の自動表示を追加',
    });
  } else {
    dynamicHistory[dynamicHistory.length - 1] = {
      ...dynamicHistory[dynamicHistory.length - 1],
      build,
    };
  }

  const current = dynamicHistory[dynamicHistory.length - 1];
  return {
    version: current.version,
    build,
    history: [...dynamicHistory].reverse().concat(SEEDED_HISTORY),
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] || char));
}

export function injectLearnerVersionIntoIndex(indexHtml: string, metadata: AppVersionMetadata): string {
  if (indexHtml.includes('id="app-version-runtime"')) return indexHtml;
  const payload = JSON.stringify({ version: metadata.version, build: metadata.build }).replace(/</g, '\\u003c');
  const runtime = `<script id="app-version-runtime">(()=>{const info=${payload};const apply=()=>{document.querySelectorAll('.setup-footer').forEach((footer)=>{let span=footer.querySelector('[data-app-version]');if(!span){span=document.createElement('span');span.setAttribute('data-app-version','true');span.style.marginLeft='.9em';span.style.font='inherit';span.style.fontWeight='500';span.style.color='inherit';span.style.opacity='.78';footer.appendChild(span)}span.textContent='AI留学生えいご対話　Version '+info.version+'　Build '+info.build})};apply();new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true})})();</script>`;
  if (!indexHtml.includes('</body>')) throw new Error('VERSION_INDEX_BODY_ANCHOR_NOT_FOUND');
  return indexHtml.replace('</body>', `${runtime}</body>`);
}

function insertBeforeSectionEnd(source: string, sectionId: string, html: string): string {
  const start = source.indexOf(`<section id="${sectionId}"`);
  if (start < 0) throw new Error(`VERSION_SECTION_NOT_FOUND:${sectionId}`);
  const end = source.indexOf('</section>', start);
  if (end < 0) throw new Error(`VERSION_SECTION_END_NOT_FOUND:${sectionId}`);
  return `${source.slice(0, end)}${html}${source.slice(end)}`;
}

export function injectManagementVersionIntoBundle(bundle: string, metadata: AppVersionMetadata): string {
  if (bundle.includes('id="versionInfoBtn"')) return bundle;

  const footerText = `AI留学生えいご対話 Version ${metadata.version}　Build ${metadata.build}`;
  const footerHtml = `<p class="version-footer">${escapeHtml(footerText)}</p>`;
  const historyRows = metadata.history.map((entry) => `<tr><td><b>${escapeHtml(entry.version)}</b></td><td>${escapeHtml(entry.build)}</td><td class="version-change">${escapeHtml(entry.changes)}</td></tr>`).join('');
  const versionScreen = `\n<section id="versionInfo" class="screen"><div class="screen-title"><span class="step">V</span>バージョン情報</div><p class="screen-subtitle">アプリのVersion、Build日、主な更新内容を確認できます。</p><div class="card section"><div class="version-current"><b>AI留学生えいご対話</b><span>Version ${escapeHtml(metadata.version)}</span><span>Build ${escapeHtml(metadata.build)}</span></div><h2 style="margin-top:18px">更新履歴</h2><div class="table-wrap"><table class="version-table"><thead><tr><th>Version</th><th>Build</th><th>主な変更内容</th></tr></thead><tbody>${historyRows}</tbody></table></div><button id="versionBackBtn" class="secondary back">← メイン画面にもどる</button></div></section>\n`;

  const navAnchor = '<button id="researchQualityBtn" class="secondary">Export・データ品質</button>';
  if (!bundle.includes(navAnchor)) throw new Error('VERSION_NAV_ANCHOR_NOT_FOUND');
  bundle = bundle.replace(navAnchor, `${navAnchor}<button id="versionInfoBtn" class="secondary">バージョン情報</button>`);

  bundle = insertBeforeSectionEnd(bundle, 'teacherDashboard', footerHtml);
  bundle = insertBeforeSectionEnd(bundle, 'researchDashboard', footerHtml);

  const modalAnchor = '<div id="reissueModal" class="modal">';
  if (!bundle.includes(modalAnchor)) throw new Error('VERSION_MODAL_ANCHOR_NOT_FOUND');
  bundle = bundle.replace(modalAnchor, `${versionScreen}${modalAnchor}`);

  const styleAnchor = '</style></head>';
  if (!bundle.includes(styleAnchor)) throw new Error('VERSION_STYLE_ANCHOR_NOT_FOUND');
  const styles = '.version-footer{margin:14px 0 0;text-align:center;color:#94a3b8;font-size:10px;font-weight:500;letter-spacing:.01em}.version-current{display:flex;flex-wrap:wrap;align-items:center;gap:10px 18px;padding:12px 14px;border:1px solid #dbe5f2;border-radius:12px;background:#f8fbff}.version-current b{font-size:15px}.version-current span{color:#526581;font-size:12px;font-weight:800}.version-table td{vertical-align:top}.version-change{white-space:normal;min-width:320px;line-height:1.6}';
  bundle = bundle.replace(styleAnchor, `${styles}${styleAnchor}`);

  const listenerAnchor = "$('researchDashboardBtn').addEventListener('click',function(){show('researchDashboard');updateResearchDashboard()});";
  if (!bundle.includes(listenerAnchor)) throw new Error('VERSION_LISTENER_ANCHOR_NOT_FOUND');
  const listeners = "$('versionInfoBtn').addEventListener('click',function(){show('versionInfo')});$('versionBackBtn').addEventListener('click',function(){show(role==='teacher'?'teacherDashboard':'researchDashboard');if(role==='teacher')updateTeacherDashboard();else updateResearchDashboard()});";
  bundle = bundle.replace(listenerAnchor, `${listeners}${listenerAnchor}`);

  return bundle;
}
