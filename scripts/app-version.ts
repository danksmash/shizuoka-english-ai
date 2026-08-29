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
  const value = (type: 'year' | 'month' | 'day') => parts.find((part) => part.type === type)?.value || '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function isVersionedCommit(subject: string, parentShas: string[] = []): boolean {
  const text = subject.trim();
  if (!text) return false;
  // A merge combines an already-counted feature/fix commit into main. Never count it again,
  // even when the repository is configured to use the PR title (e.g. "fix: ...") as merge subject.
  if (parentShas.length > 1) return false;
  if (/^Merge\b/i.test(text)) return false;
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
      ['log', '--reverse', '--format=%cs%x1f%P%x1f%s', `${BASE_COMMIT}..HEAD`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [date, parentsText = '', ...subjectParts] = line.split('\x1f');
        const parentShas = parentsText.trim().split(/\s+/).filter(Boolean);
        return { date, parentShas, subject: subjectParts.join('\x1f') };
      })
      .filter((entry) => isVersionedCommit(entry.subject, entry.parentShas))
      .map(({ date, subject }) => ({ date, subject }));
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

export function injectManagementVersionIntoBundle(bundle: string, metadata: AppVersionMetadata): string {
  if (bundle.includes('id="versionInfoBtn"')) return bundle;

  const footerText = `AI留学生えいご対話 Version ${metadata.version}　Build ${metadata.build}`;
  const footerHtml = `<p class="version-footer" id="managementVersionFooter">${escapeHtml(footerText)}</p>`;
  const historyRows = metadata.history.map((entry) => `<tr><td><b>${escapeHtml(entry.version)}</b></td><td>${escapeHtml(entry.build)}</td><td class="version-change">${escapeHtml(entry.changes)}</td></tr>`).join('');
  const versionScreen = `\n<section id="versionInfo" class="screen"><div class="screen-title"><span class="step">V</span>バージョン情報</div><p class="screen-subtitle">アプリのVersion、Build日、主な更新内容を確認できます。</p><div class="card section"><div class="version-current"><b>AI留学生えいご対話</b><span>Version ${escapeHtml(metadata.version)}</span><span>Build ${escapeHtml(metadata.build)}</span></div><h2 style="margin-top:18px">更新履歴</h2><div class="table-wrap"><table class="version-table"><thead><tr><th>Version</th><th>Build</th><th>主な変更内容</th></tr></thead><tbody>${historyRows}</tbody></table></div><button id="versionBackBtn" class="secondary back">← メイン画面にもどる</button></div></section>\n`;

  const pageButtons: Array<[string, string]> = [
    ['teacherDashboardBtn', '授業・学級状況'],
    ['studentListBtn', '児童別学習状況'],
    ['codeBtn', '学習者ID管理'],
    ['researchDashboardBtn', '研究データ概要'],
    ['researchListBtn', '匿名化ケース一覧'],
    ['researchQualityBtn', 'Export・データ品質'],
  ];
  pageButtons.forEach(([id, label]) => {
    const from = `<button id="${id}" class="secondary">${label}</button>`;
    const to = `<button id="${id}" class="secondary nav-page">${label}</button>`;
    if (!bundle.includes(from)) throw new Error(`VERSION_NAV_BUTTON_NOT_FOUND:${id}`);
    bundle = bundle.replace(from, to);
  });

  const navStart = '<div class="nav"><span id="who" class="who"></span>';
  if (!bundle.includes(navStart)) throw new Error('VERSION_NAV_START_NOT_FOUND');
  bundle = bundle.replace(
    navStart,
    '<div class="nav-shell"><div class="nav-meta"><span id="who" class="who"></span><span id="lastUpdated" class="muted nav-updated"></span></div><div class="nav-line"><div class="nav-pages" role="navigation" aria-label="管理画面メニュー">',
  );

  const navAnchor = '<button id="researchQualityBtn" class="secondary nav-page">Export・データ品質</button>';
  if (!bundle.includes(navAnchor)) throw new Error('VERSION_NAV_ANCHOR_NOT_FOUND');
  bundle = bundle.replace(navAnchor, `${navAnchor}<button id="versionInfoBtn" class="secondary nav-page">バージョン情報</button>`);

  const utilityAnchor = '<span id="lastUpdated" class="muted"></span><button id="refreshBtn" class="secondary">↻ 最新データを再読込</button>';
  if (!bundle.includes(utilityAnchor)) throw new Error('VERSION_UTILITY_ANCHOR_NOT_FOUND');
  bundle = bundle.replace(
    utilityAnchor,
    '</div><div class="nav-actions"><button id="refreshBtn" class="secondary nav-action refresh-action">↻ 最新データを再読込</button>',
  );

  const logoutAnchor = '<button id="logoutBtn" class="secondary">ログアウト</button></div></header>';
  if (!bundle.includes(logoutAnchor)) throw new Error('VERSION_LOGOUT_ANCHOR_NOT_FOUND');
  bundle = bundle.replace(
    logoutAnchor,
    '<button id="logoutBtn" class="secondary nav-action logout-action">ログアウト</button></div></div></div></header>',
  );

  const loginAnchor = '<p id="msg" class="muted"></p></div></div>';
  if (!bundle.includes(loginAnchor)) throw new Error('VERSION_LOGIN_ANCHOR_NOT_FOUND');
  bundle = bundle.replace(loginAnchor, `<p id="msg" class="muted"></p></div>${footerHtml}</div>`);

  const modalAnchor = '<div id="reissueModal" class="modal">';
  if (!bundle.includes(modalAnchor)) throw new Error('VERSION_MODAL_ANCHOR_NOT_FOUND');
  bundle = bundle.replace(modalAnchor, `${versionScreen}${modalAnchor}`);

  const styleAnchor = '</style></head>';
  if (!bundle.includes(styleAnchor)) throw new Error('VERSION_STYLE_ANCHOR_NOT_FOUND');
  const styles = '.login-wrap{display:flex;flex-direction:column;justify-content:center;align-items:center;gap:12px}.version-footer{margin:0;text-align:center;color:#94a3b8;font-size:10px;font-weight:500;letter-spacing:.01em}.management-header{display:grid;grid-template-columns:max-content minmax(0,1fr);align-items:start;gap:20px}.nav-shell{min-width:0;display:grid;gap:7px}.nav-meta{display:flex;justify-content:flex-end;align-items:center;gap:12px;min-height:22px}.nav-line{display:flex;justify-content:flex-end;align-items:center;gap:10px;flex-wrap:wrap}.nav-pages,.nav-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.nav-pages{justify-content:flex-end}.nav-actions{margin-left:auto}.nav-page,.nav-action{min-height:42px;white-space:nowrap}.nav-page{padding:9px 14px}.nav-page.active{background:#1260ef;color:#fff;border-color:#1260ef;box-shadow:0 3px 10px rgba(18,96,239,.18)}.nav-updated{white-space:nowrap;font-size:11px}.who{display:inline-block;border-radius:999px;background:#edf3ff;color:#234b94;padding:4px 9px}.refresh-action{background:#eef4ff;border-color:#8fb0e5}.logout-action{color:#526581;border-color:#c7d4e7}.version-current{display:flex;flex-wrap:wrap;align-items:center;gap:10px 18px;padding:12px 14px;border:1px solid #dbe5f2;border-radius:12px;background:#f8fbff}.version-current b{font-size:15px}.version-current span{color:#526581;font-size:12px;font-weight:800}.version-table td{vertical-align:top}.version-change{white-space:normal;min-width:320px;line-height:1.6}@media(max-width:1250px){.management-header{grid-template-columns:1fr}.nav-meta,.nav-line{justify-content:flex-start}.nav-pages{justify-content:flex-start}.nav-actions{margin-left:0}}@media(max-width:650px){.nav-pages,.nav-actions{width:100%}.nav-page,.nav-action{flex:1 1 auto}.nav-meta{justify-content:flex-start;flex-wrap:wrap}}';
  bundle = bundle.replace(styleAnchor, `${styles}${styleAnchor}`);

  const showAnchor = "function show(id){document.querySelectorAll('.screen').forEach(function(e){e.classList.remove('active')});var el=$(id);if(el)el.classList.add('active')}";
  if (!bundle.includes(showAnchor)) throw new Error('VERSION_SHOW_ANCHOR_NOT_FOUND');
  const showReplacement = "function show(id){document.querySelectorAll('.screen').forEach(function(e){e.classList.remove('active')});var el=$(id);if(el)el.classList.add('active');document.querySelectorAll('.nav-page').forEach(function(e){e.classList.remove('active')});var navMap={teacherDashboard:'teacherDashboardBtn',studentList:'studentListBtn',codeManagement:'codeBtn',researchDashboard:'researchDashboardBtn',researchList:'researchListBtn',researchQuality:'researchQualityBtn',versionInfo:'versionInfoBtn'},navId=navMap[id],nav=navId?$(navId):null;if(nav)nav.classList.add('active')}";
  bundle = bundle.replace(showAnchor, showReplacement);

  const listenerAnchor = "$('researchDashboardBtn').addEventListener('click',function(){show('researchDashboard');updateResearchDashboard()});";
  if (!bundle.includes(listenerAnchor)) throw new Error('VERSION_LISTENER_ANCHOR_NOT_FOUND');
  const listeners = "$('versionInfoBtn').addEventListener('click',function(){show('versionInfo')});$('versionBackBtn').addEventListener('click',function(){show(role==='teacher'?'teacherDashboard':'researchDashboard');if(role==='teacher')updateTeacherDashboard();else updateResearchDashboard()});";
  bundle = bundle.replace(listenerAnchor, `${listeners}${listenerAnchor}`);

  return bundle;
}
