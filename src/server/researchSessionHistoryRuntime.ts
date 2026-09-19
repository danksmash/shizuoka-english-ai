import express, { type RequestHandler } from 'express';
import { AI_STUDENTS_MASTER_LIST } from '../data/curriculum';
import { requireManagementRole } from './auth';
import {
  getResearchSessionByIdForManagement,
  getResearchSessionsByResearchIdForManagement,
  getSessionsForManagementByLocalDateRange,
} from './persistence';
import { researchDataScopeForRow } from './researchDashboard';
import { filterSessionsForStudyPhase, normalizeStudyPhaseFilter } from './researchPhaseRuntime';
import { getAllStudySchedules } from './studySchedulePersistence';

type Row = Record<string, any>;

export interface ResearchSessionHistorySummary {
  session_id: string;
  research_id: string;
  started_at: string;
  ended_at: string;
  local_date: string;
  persona_id: string;
  persona_name: string;
  topic: string;
  topic_label: string;
  target_duration_minutes: number;
  actual_duration_seconds: number;
  total_turns: number;
  total_child_words: number;
  data_quality_flag: string;
  lifetime_session_number: number;
}

const TOPIC_LABELS: Record<string, string> = {
  intro: '自己紹介・あいさつ',
  favorites: '好きなもの・すきなこと',
  shizuoka_culture: '静岡のじまん＆世界の文化',
  talents: 'できること・得意なこと',
  daily_routine: 'ふだんの生活・一日のようす',
  free: '自由トーク・おしゃべり',
};

function safeText(value: unknown, maxLength = 800): string {
  return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

function safeId(value: unknown, maxLength = 120): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z0-9._:-]+$/.test(text) ? text.slice(0, maxLength) : '';
}

function safeResearchId(value: unknown): string {
  const text = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return /^R[-A-Z0-9_]{1,39}$/.test(text) ? text : '';
}

function localDateForSession(session: Row): string {
  const stored = safeText(session.localDate, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(stored)) return stored;
  const raw = session.startedAt || session.endedAt;
  const date = raw ? new Date(raw) : null;
  return date && Number.isFinite(date.getTime())
    ? date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
    : '';
}

function qualityForSession(session: Row): string {
  const history = Array.isArray(session.history) ? session.history : [];
  const child = history.filter((message: any) =>
    message && message.sender === 'child' && typeof message.englishText === 'string' && message.englishText.trim());
  const events = Array.isArray(session.systemEvents) ? session.systemEvents : [];
  const hasReflection = Boolean(session.reflection && typeof session.reflection === 'object');
  const hasFinish = events.some((event: any) => event && event.type === 'session_finish');
  const schemaVersion = Number(session.schemaVersion || 0);
  const dialogueCompleted = hasFinish
    || (Boolean(session.endedAt) && hasReflection)
    || (Boolean(session.endedAt) && schemaVersion < 3 && child.length > 0);
  if (!session.sessionId || !session.researchId || history.length === 0 || child.length === 0) return 'missing_core';
  if (!dialogueCompleted) return 'interrupted';
  if (!hasReflection) return 'missing_reflection';
  return 'complete';
}

function personaName(personaId: string): string {
  return AI_STUDENTS_MASTER_LIST.find((item) => item.id === personaId)?.name || personaId;
}

export function buildResearchSessionHistorySummary(session: Row): ResearchSessionHistorySummary {
  const personaId = safeText(session.personaId || session.aiStudentId, 80);
  const topic = safeText(session.topic, 80);
  return {
    session_id: safeText(session.sessionId, 120),
    research_id: safeText(session.researchId, 80),
    started_at: safeText(session.startedAt, 80),
    ended_at: safeText(session.endedAt, 80),
    local_date: localDateForSession(session),
    persona_id: personaId,
    persona_name: personaName(personaId),
    topic,
    topic_label: TOPIC_LABELS[topic] || topic,
    target_duration_minutes: Math.max(0, Number(session.targetDurationMinutes || 0)),
    actual_duration_seconds: Math.max(0, Number(session.actualDurationSeconds || 0)),
    total_turns: Math.max(0, Number(session.totalTurns || 0)),
    total_child_words: Math.max(0, Number(session.totalChildWords || 0)),
    data_quality_flag: qualityForSession(session),
    lifetime_session_number: Math.max(0, Number(session.lifetimeSessionNumber || 0)),
  };
}

function numericTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function buildResearchSessionHistoryDetail(session: Row) {
  const summary = buildResearchSessionHistorySummary(session);
  const history = Array.isArray(session.history) ? session.history : [];
  const transcript = history
    .filter((message: any) => message && typeof message === 'object')
    .slice(0, 300)
    .map((message: any) => ({
      utterance_id: safeText(message.id, 120),
      sender: safeText(message.sender, 20),
      english_text: safeText(message.englishText),
      japanese_text: safeText(message.japaneseText),
      timestamp: numericTimestamp(message.timestamp),
    }));
  const reflection = session.reflection && typeof session.reflection === 'object'
    ? {
      scale_version: safeText(session.reflection.scaleVersion, 80),
      conveyed_ideas: Number.isFinite(Number(session.reflection.conveyedIdeas)) ? Number(session.reflection.conveyedIdeas) : null,
      understood_partner: Number.isFinite(Number(session.reflection.understoodPartner)) ? Number(session.reflection.understoodPartner) : null,
      noticed_language_culture: Number.isFinite(Number(session.reflection.noticedLanguageCulture)) ? Number(session.reflection.noticedLanguageCulture) : null,
    }
    : null;
  const systemEvents = (Array.isArray(session.systemEvents) ? session.systemEvents : [])
    .filter((event: any) => event && typeof event === 'object')
    .slice(0, 200)
    .map((event: any) => ({
      type: safeText(event.type, 80),
      value: safeText(event.value, 180),
      timestamp: numericTimestamp(event.timestamp),
    }));
  return { ...summary, transcript, reflection, system_events: systemEvents };
}

function textFilter(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function classMatches(session: Row, requested: string): boolean {
  if (!requested || requested === 'all') return true;
  const stored = String(session.classId || '');
  return ['1', '2', '3'].includes(requested) ? stored.endsWith('-' + requested) : stored === requested;
}

function gradeMatches(session: Row, requested: string): boolean {
  if (!requested || requested === 'all') return true;
  const stored = String(session.gradeLevel || (String(session.classId || '').startsWith('5-') ? '5' : String(session.classId || '').startsWith('6-') ? '6' : ''));
  return stored === requested;
}

function rawSessionMatchesFilters(session: Row, filters: Record<string, unknown>): boolean {
  const localDate = localDateForSession(session);
  const start = textFilter(filters.start);
  const end = textFilter(filters.end);
  const dataScope = textFilter(filters.dataScope);
  const grade = textFilter(filters.grade);
  const classId = textFilter(filters.classId);
  const personaId = textFilter(filters.personaId);
  const labelCondition = textFilter(filters.labelCondition);
  const topic = textFilter(filters.topic);
  const completeOnly = String(filters.completeOnly || '') === '1';
  const scope = researchDataScopeForRow({ class_id: session.classId || '', local_date: localDate });
  return (!start || localDate >= start)
    && (!end || localDate <= end)
    && (!dataScope || dataScope === 'all' || scope === dataScope)
    && gradeMatches(session, grade)
    && classMatches(session, classId)
    && (!personaId || personaId === 'all' || String(session.personaId || session.aiStudentId || '') === personaId)
    && (!labelCondition || labelCondition === 'all' || String(session.personaLabelCondition || 'shown') === labelCondition)
    && (!topic || topic === 'all' || String(session.topic || '') === topic)
    && (!completeOnly || qualityForSession(session) === 'complete');
}

const INDEX_CACHE_MS = 15_000;
const indexCache = new Map<string, { expiresAt: number; rows: ResearchSessionHistorySummary[] }>();

function cacheKey(filters: Record<string, unknown>): string {
  const keys = ['start','end','dataScope','grade','classId','personaId','labelCondition','studyPhase','topic','completeOnly'];
  return keys.map((key) => key + '=' + textFilter(filters[key])).join('&');
}

async function sessionIndexRows(filters: Record<string, unknown>): Promise<ResearchSessionHistorySummary[]> {
  const key = cacheKey(filters);
  const cached = indexCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.rows;
  const phase = normalizeStudyPhaseFilter(filters.studyPhase);
  const [source, schedules] = await Promise.all([
    getSessionsForManagementByLocalDateRange(filters.start, filters.end),
    phase ? getAllStudySchedules() : Promise.resolve([]),
  ]);
  const phaseRows = filterSessionsForStudyPhase(source, schedules, phase);
  const rows = phaseRows
    .filter((session) => rawSessionMatchesFilters(session, filters))
    .map(buildResearchSessionHistorySummary)
    .sort((a, b) => b.started_at.localeCompare(a.started_at) || b.session_id.localeCompare(a.session_id));
  indexCache.set(key, { rows, expiresAt: Date.now() + INDEX_CACHE_MS });
  return rows;
}

const router = express.Router();

router.post('/research.session-history', requireManagementRole(['researcher']), async (req, res) => {
  const researchId = safeResearchId(req.body?.researchId);
  if (!researchId) return res.status(400).json({ success: false, error: 'INVALID_RESEARCH_ID' });
  try {
    const rows = (await getResearchSessionsByResearchIdForManagement(researchId))
      .map(buildResearchSessionHistorySummary)
      .sort((a, b) => b.started_at.localeCompare(a.started_at) || b.session_id.localeCompare(a.session_id));
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, researchId, count: rows.length, sessions: rows });
  } catch (error: any) {
    console.error('Research participant session history failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'RESEARCH_SESSION_HISTORY_UNAVAILABLE' });
  }
});

router.post('/research.session-detail', requireManagementRole(['researcher']), async (req, res) => {
  const researchId = safeResearchId(req.body?.researchId);
  const sessionId = safeId(req.body?.sessionId);
  if (!researchId || !sessionId) return res.status(400).json({ success: false, error: 'INVALID_SESSION_LOOKUP' });
  try {
    const session = await getResearchSessionByIdForManagement(sessionId);
    if (!session || String(session.researchId || '').toUpperCase() !== researchId) {
      return res.status(404).json({ success: false, error: 'RESEARCH_SESSION_NOT_FOUND' });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, session: buildResearchSessionHistoryDetail(session) });
  } catch (error: any) {
    console.error('Research session detail failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'RESEARCH_SESSION_DETAIL_UNAVAILABLE' });
  }
});

router.post('/research.sessions', requireManagementRole(['researcher']), async (req, res) => {
  const filters = req.body?.filters && typeof req.body.filters === 'object' ? req.body.filters as Record<string, unknown> : {};
  const q = textFilter(req.body?.q).toUpperCase().slice(0, 120);
  const offset = Math.max(0, Math.trunc(Number(req.body?.offset || 0)));
  const limit = Math.max(1, Math.min(50, Math.trunc(Number(req.body?.limit || 50)) || 50));
  try {
    const baseRows = await sessionIndexRows(filters);
    const searched = q
      ? baseRows.filter((row) => row.research_id.toUpperCase().includes(q) || row.session_id.toUpperCase().includes(q))
      : baseRows;
    const rows = searched.slice(offset, offset + limit);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      total: searched.length,
      offset,
      limit,
      nextOffset: offset + rows.length < searched.length ? offset + rows.length : null,
      rows,
    });
  } catch (error: any) {
    console.error('Research session index failed', { message: error?.message });
    return res.status(503).json({ success: false, error: 'RESEARCH_SESSION_INDEX_UNAVAILABLE' });
  }
});

export function createResearchSessionHistoryRouter() {
  return router;
}

const HISTORY_STYLE = `<style id="researchSessionHistoryStyle">
.recent-card .rsh-toolbar{display:flex;gap:7px;align-items:center;margin:-2px 0 9px}.recent-card .rsh-toolbar input{min-width:0;flex:1;padding:8px 9px;font-size:12px}.recent-card .rsh-toolbar button{white-space:nowrap;padding:8px 10px;font-size:11px}.recent-card .rsh-count{font-size:10px;color:#64748b;margin:0 0 6px}.recent-card .table-wrap{max-height:430px;overflow:auto}.analysis-session-layout .recent-card .table-wrap{flex:1 1 auto;max-height:none;min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-gutter:stable}.recent-card .recent thead th{position:sticky;top:0;z-index:2;background:#f3f7fc}.recent-card .recent tbody tr[data-rsh-research]{cursor:pointer}.recent-card .recent tbody tr[data-rsh-research]:hover,.recent-card .recent tbody tr[data-rsh-research]:focus{background:#eef5ff;outline:none}
.rsh-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.38);z-index:1200;display:none}.rsh-backdrop.open{display:block}.rsh-panel{position:fixed;top:0;right:0;height:100vh;width:min(760px,96vw);background:#f8fbff;z-index:1201;box-shadow:-14px 0 36px rgba(15,23,42,.18);transform:translateX(102%);transition:transform .18s ease;display:flex;flex-direction:column}.rsh-panel.open{transform:translateX(0)}.rsh-panel-head{padding:14px 16px;border-bottom:1px solid #d8e4f1;background:#fff;display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.rsh-panel-head h2{font-size:18px;margin:0 0 3px}.rsh-panel-body{padding:12px 14px 22px;overflow:auto}.rsh-history-list{display:grid;gap:6px;margin:8px 0 13px}.rsh-history-button{width:100%;text-align:left;border:1px solid #d6e2f0;background:#fff;color:#173461;padding:9px 10px;border-radius:10px}.rsh-history-button.active{border-color:#1767ed;background:#eef5ff}.rsh-history-main{display:flex;justify-content:space-between;gap:8px;font-size:12px;font-weight:900}.rsh-history-sub{font-size:10px;color:#64748b;margin-top:3px}.rsh-detail{background:#fff;border:1px solid #d8e4f1;border-radius:12px;padding:12px}.rsh-detail-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px 10px;font-size:10px;color:#526581;margin-bottom:10px}.rsh-detail-meta b{display:block;color:#173461}.rsh-utterance{display:grid;grid-template-columns:48px 44px minmax(0,1fr);gap:6px;padding:7px 0;border-bottom:1px solid #edf2f8;font-size:11px;line-height:1.45}.rsh-utterance:last-child{border-bottom:0}.rsh-speaker{font-weight:900}.rsh-child{color:#1767ed}.rsh-ai{color:#138547}.rsh-ja{display:block;color:#8191a7;font-size:10px;margin-top:2px}.rsh-reflection,.rsh-events{margin-top:10px;padding-top:8px;border-top:1px solid #e9eff6;font-size:10px;color:#526581}.rsh-events summary{cursor:pointer;font-weight:850}.rsh-event{display:grid;grid-template-columns:60px 140px 1fr;gap:5px;padding:3px 0}
.rsh-modal-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.48);z-index:1300;display:none;place-items:center;padding:18px}.rsh-modal-backdrop.open{display:grid}.rsh-modal{width:min(1220px,96vw);max-height:88vh;background:#fff;border-radius:16px;box-shadow:0 24px 70px rgba(15,23,42,.28);display:flex;flex-direction:column;overflow:hidden}.rsh-modal-head{padding:13px 15px;border-bottom:1px solid #d8e4f1;display:flex;gap:10px;justify-content:space-between;align-items:center}.rsh-modal-head h2{margin:0;font-size:18px}.rsh-modal-tools{padding:10px 14px;display:flex;gap:8px;align-items:center;border-bottom:1px solid #edf2f8}.rsh-modal-tools input{flex:1}.rsh-modal-table{overflow:auto;max-height:62vh}.rsh-modal-table table{width:100%;border-collapse:collapse;font-size:11px}.rsh-modal-table th,.rsh-modal-table td{padding:7px 8px;border-bottom:1px solid #edf2f8;text-align:left}.rsh-modal-table th{position:sticky;top:0;background:#f3f7fc;z-index:1}.rsh-modal-table tr[data-rsh-research]{cursor:pointer}.rsh-modal-table tr[data-rsh-research]:hover{background:#eef5ff}.rsh-modal-foot{padding:10px 14px;border-top:1px solid #edf2f8;display:flex;gap:10px;justify-content:space-between;align-items:center}
@media(max-width:1240px){.analysis-session-layout .recent-card .table-wrap{min-height:380px;max-height:560px}}@media(max-width:760px){.analysis-session-layout .recent-card .table-wrap{min-height:320px;max-height:500px}.rsh-panel{width:100vw}.rsh-detail-meta{grid-template-columns:1fr}.rsh-utterance{grid-template-columns:42px 40px minmax(0,1fr)}.rsh-modal-backdrop{padding:0}.rsh-modal{width:100vw;max-height:100vh;height:100vh;border-radius:0}.rsh-modal-tools{flex-direction:column;align-items:stretch}}
</style>`;

const HISTORY_SCRIPT = `<script id="researchSessionHistoryScript">
(function(){
  var recentRows=[],historyCache=new Map(),detailCache=new Map(),allRows=[],allTotal=0,allNext=null,allSearchTimer=0;
  function h$(id){return document.getElementById(id)}
  var heightObserver=null,heightSyncFrame=0;
  function syncRecentCardHeight(){
    if(heightSyncFrame)cancelAnimationFrame(heightSyncFrame);
    heightSyncFrame=requestAnimationFrame(function(){
      heightSyncFrame=0;
      var left=document.querySelector('.analysis-session-layout .analysis-column');
      var card=document.querySelector('.analysis-session-layout .recent-card');
      if(!left||!card)return;
      if(window.matchMedia('(max-width:1240px)').matches){card.style.height='';return}
      var height=Math.round(left.getBoundingClientRect().height);
      if(height>0)card.style.height=height+'px';
    });
  }
  function watchWorkspaceHeight(){
    var left=document.querySelector('.analysis-session-layout .analysis-column');
    if(!left)return;
    if(heightObserver)heightObserver.disconnect();
    if(typeof ResizeObserver==='function'){
      heightObserver=new ResizeObserver(function(){syncRecentCardHeight()});
      heightObserver.observe(left);
    }
    window.addEventListener('resize',syncRecentCardHeight,{passive:true});
    syncRecentCardHeight();
  }
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'})[c]})}
  function fmt(v){if(!v)return '-';var d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'})}
  function clock(v){var n=Number(v||0);if(!n)return '';var d=new Date(n);return Number.isNaN(d.getTime())?'':d.toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',second:'2-digit'})}
  function duration(v){var s=Math.max(0,Math.round(Number(v)||0));return Math.floor(s/60)+'分'+String(s%60).padStart(2,'0')+'秒'}
  async function api(path,body){var r=await fetch('/api/management/'+path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});var d=await r.json().catch(function(){return{}});if(!r.ok){if(r.status===401)throw new Error('ログインの有効期限が切れました。画面を再読み込みして再ログインしてください。');throw new Error(d.error||('HTTP '+r.status))}return d}
  function ensureUi(){
    var card=document.querySelector('.recent-card');if(card&&!h$('rshRecentSearch')){var wrap=card.querySelector('.table-wrap');var bar=document.createElement('div');bar.className='rsh-toolbar';bar.innerHTML='<input id="rshRecentSearch" type="search" placeholder="research_id / session_id を入力"><button id="rshOpenSearchBtn" class="secondary" type="button">履歴を開く</button><button id="rshAllBtn" class="secondary" type="button">全セッション一覧</button>';card.insertBefore(bar,wrap);var count=document.createElement('div');count.id='rshRecentCount';count.className='rsh-count';count.textContent='最新50件まで表示';card.insertBefore(count,wrap);var hint=document.createElement('div');hint.id='rshRecentSearchStatus';hint.className='rsh-count';hint.textContent='入力中は表示中50件を絞り込みます。Enter または「履歴を開く」でIDの履歴を開きます。';card.insertBefore(hint,wrap);h$('rshRecentSearch').addEventListener('input',renderRecent);h$('rshRecentSearch').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();openRecentSearch()}});h$('rshOpenSearchBtn').addEventListener('click',openRecentSearch);h$('rshAllBtn').addEventListener('click',openAll)}
    if(!h$('rshPanel'))document.body.insertAdjacentHTML('beforeend','<div id="rshBackdrop" class="rsh-backdrop"></div><aside id="rshPanel" class="rsh-panel" aria-label="research_id別対話履歴"><div class="rsh-panel-head"><div><h2 id="rshPanelTitle">対話履歴</h2><div id="rshPanelSub" class="muted"></div></div><button id="rshPanelClose" class="secondary" type="button">閉じる</button></div><div class="rsh-panel-body"><div id="rshPanelStatus" class="status"></div><div id="rshHistoryList" class="rsh-history-list"></div><div id="rshSessionDetail" class="rsh-detail">セッションを選択してください。</div></div></aside>');
    if(!h$('rshAllModal'))document.body.insertAdjacentHTML('beforeend','<div id="rshAllModal" class="rsh-modal-backdrop"><div class="rsh-modal"><div class="rsh-modal-head"><h2>全セッション一覧</h2><button id="rshAllClose" class="secondary" type="button">閉じる</button></div><div class="rsh-modal-tools"><input id="rshAllSearch" type="search" placeholder="research_id / session_id を検索"><span id="rshAllStatus" class="muted"></span></div><div class="rsh-modal-table"><table><thead><tr><th>日時</th><th>research_id</th><th>session_id</th><th>Persona</th><th>テーマ</th><th>品質</th></tr></thead><tbody id="rshAllRows"></tbody></table></div><div class="rsh-modal-foot"><span id="rshAllCount" class="muted"></span><button id="rshLoadMore" class="secondary" type="button">さらに50件</button></div></div></div>');
    h$('rshPanelClose').onclick=closePanel;h$('rshBackdrop').onclick=closePanel;h$('rshAllClose').onclick=closeAll;h$('rshLoadMore').onclick=function(){loadAll(true)};h$('rshAllSearch').addEventListener('input',function(){if(allSearchTimer)clearTimeout(allSearchTimer);allSearchTimer=setTimeout(function(){loadAll(false)},280)});
    syncRecentCardHeight();
  }
  function renderRecent(){
    ensureUi();var q=String(h$('rshRecentSearch')&&h$('rshRecentSearch').value||'').trim().toUpperCase();var rows=q?recentRows.filter(function(r){return String(r.research_id||'').toUpperCase().includes(q)||String(r.session_id||'').toUpperCase().includes(q)}):recentRows;var body=h$('recentRows');if(!body)return;body.innerHTML=rows.map(function(r){return '<tr tabindex="0" data-rsh-research="'+esc(r.research_id)+'" data-rsh-session="'+esc(r.session_id)+'"><td>'+esc(r.local_started_at)+'</td><td>'+esc(r.research_id)+'</td><td>'+esc(r.persona_name||r.persona_id)+'</td><td>'+esc(r.topic)+'</td><td>'+esc(r.target_duration_minutes)+'分</td><td><span class="pill">'+esc(r.data_quality_flag)+'</span></td></tr>'}).join('')||'<tr><td colspan="6" class="muted">該当するセッションはありません。</td></tr>';if(h$('rshRecentCount'))h$('rshRecentCount').textContent='表示 '+rows.length+'件 / 最大 '+recentRows.length+'件（最大50件をこの枠内でスクロール）';bindRows(body);syncRecentCardHeight()}
  async function openRecentSearch(){ensureUi();var input=h$('rshRecentSearch');var q=String(input&&input.value||'').trim();var status=h$('rshRecentSearchStatus');if(!q){if(status)status.textContent='research_id または session_id を入力してください。';return}var upper=q.toUpperCase();var exact=recentRows.find(function(r){return String(r.research_id||'').toUpperCase()===upper||String(r.session_id||'').toUpperCase()===upper});if(exact){if(status)status.textContent='IDを開きます…';openHistory(exact.research_id,exact.session_id);return}if(/^R[-A-Z0-9_]{1,39}$/.test(upper)){if(status)status.textContent='全保存データから research_id の履歴を開きます…';openHistory(upper,'');return}if(status)status.textContent='session_id は表示中50件にないため「全セッション一覧」で検索してください。'}
  function bindRows(root){Array.prototype.forEach.call(root.querySelectorAll('tr[data-rsh-research]'),function(row){var open=function(){if(root.id==='rshAllRows')closeAll();openHistory(row.dataset.rshResearch||'',row.dataset.rshSession||'')};row.onclick=open;row.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}}})}
  function openPanel(){h$('rshBackdrop').classList.add('open');h$('rshPanel').classList.add('open')}
  function closePanel(){h$('rshBackdrop').classList.remove('open');h$('rshPanel').classList.remove('open')}
  async function openHistory(researchId,sessionId){ensureUi();openPanel();h$('rshPanelTitle').textContent='research_id '+researchId;h$('rshPanelSub').textContent='匿名化された同一児童のAI対話履歴';h$('rshPanelStatus').className='status';h$('rshPanelStatus').textContent='履歴を読み込んでいます…';h$('rshHistoryList').innerHTML='';h$('rshSessionDetail').innerHTML='セッション詳細を読み込んでいます…';try{var data=historyCache.get(researchId);if(!data){data=await api('research.session-history',{researchId:researchId});historyCache.set(researchId,data)}renderHistory(data,sessionId);h$('rshPanelStatus').textContent='保存されている対話 '+String(data.count||0)+'回';if(sessionId)loadDetail(researchId,sessionId)}catch(e){h$('rshPanelStatus').textContent='履歴を読み込めません: '+e.message;h$('rshPanelStatus').className='status error';h$('rshSessionDetail').innerHTML=''}}
  function renderHistory(data,selected){var list=Array.isArray(data.sessions)?data.sessions:[];var root=h$('rshHistoryList');root.innerHTML=list.map(function(r){var active=r.session_id===selected?' active':'';return '<button type="button" class="rsh-history-button'+active+'" data-session="'+esc(r.session_id)+'"><div class="rsh-history-main"><span>第'+esc(r.lifetime_session_number||'?')+'回　'+esc(fmt(r.started_at))+'</span><span>'+esc(r.persona_name||r.persona_id)+'</span></div><div class="rsh-history-sub">'+esc(r.topic_label||r.topic)+'　'+esc(duration(r.actual_duration_seconds))+'　'+esc(r.total_child_words)+'語　'+esc(r.data_quality_flag)+'</div></button>'}).join('')||'<div class="muted">保存された対話はありません。</div>';Array.prototype.forEach.call(root.querySelectorAll('button[data-session]'),function(btn){btn.onclick=function(){Array.prototype.forEach.call(root.querySelectorAll('.rsh-history-button'),function(x){x.classList.remove('active')});btn.classList.add('active');loadDetail(data.researchId,btn.dataset.session||'')}})}
  async function loadDetail(researchId,sessionId){var root=h$('rshSessionDetail');root.innerHTML='セッション詳細を読み込んでいます…';try{var data=detailCache.get(sessionId);if(!data){data=await api('research.session-detail',{researchId:researchId,sessionId:sessionId});detailCache.set(sessionId,data)}renderDetail(data.session)}catch(e){root.innerHTML='<div class="error">セッション詳細を読み込めません: '+esc(e.message)+'</div>'}}
  function renderDetail(s){if(!s){h$('rshSessionDetail').innerHTML='データなし';return}var transcript=(s.transcript||[]).map(function(r){var child=String(r.sender||'')==='child';return '<div class="rsh-utterance"><span>'+esc(clock(r.timestamp))+'</span><span class="rsh-speaker '+(child?'rsh-child':'rsh-ai')+'">'+(child?'児童':'AI')+'</span><span>'+esc(r.english_text)+(r.japanese_text?'<span class="rsh-ja">'+esc(r.japanese_text)+'</span>':'')+'</span></div>'}).join('')||'<div class="muted">発話ログなし</div>';var reflection=s.reflection?'<div class="rsh-reflection"><b>振り返り</b>　伝える '+esc(s.reflection.conveyed_ideas)+' / 聞いて分かる '+esc(s.reflection.understood_partner)+' / 言葉・文化 '+esc(s.reflection.noticed_language_culture)+'</div>':'<div class="rsh-reflection">振り返りなし</div>';var events=(s.system_events||[]).map(function(e){return '<div class="rsh-event"><span>'+esc(clock(e.timestamp))+'</span><b>'+esc(e.type)+'</b><span>'+esc(e.value)+'</span></div>'}).join('');h$('rshSessionDetail').innerHTML='<div class="rsh-detail-meta"><span>session_id<b>'+esc(s.session_id)+'</b></span><span>日時<b>'+esc(fmt(s.started_at))+'</b></span><span>Persona<b>'+esc(s.persona_name||s.persona_id)+'</b></span><span>テーマ<b>'+esc(s.topic_label||s.topic)+'</b></span><span>対話時間<b>'+esc(duration(s.actual_duration_seconds))+'</b></span><span>児童発話語数<b>'+esc(s.total_child_words)+'語</b></span><span>ターン<b>'+esc(s.total_turns)+'</b></span><span>品質<b>'+esc(s.data_quality_flag)+'</b></span></div><div><b style="font-size:11px;color:#174aa8">対話ログ</b>'+transcript+'</div>'+reflection+(events?'<details class="rsh-events"><summary>systemEvents '+String((s.system_events||[]).length)+'件</summary>'+events+'</details>':'')}
  function currentFilters(){try{var p=(typeof appliedFilterQuery==='string'&&appliedFilterQuery)?new URLSearchParams(appliedFilterQuery):(typeof filterParams==='function'?filterParams():new URLSearchParams());return Object.fromEntries(p.entries())}catch(_e){return{}}}
  function openAll(){ensureUi();allRows=[];allNext=null;h$('rshAllSearch').value='';h$('rshAllModal').classList.add('open');loadAll(false)}
  function closeAll(){h$('rshAllModal').classList.remove('open')}
  async function loadAll(append){if(!append){allRows=[];allNext=null}h$('rshAllStatus').className='muted';h$('rshAllStatus').textContent='一覧を読み込んでいます…';try{var data=await api('research.sessions',{filters:currentFilters(),q:h$('rshAllSearch').value||'',offset:append&&allNext!=null?allNext:0,limit:50});allTotal=Number(data.total||0);allNext=data.nextOffset==null?null:Number(data.nextOffset);allRows=append?allRows.concat(data.rows||[]):(data.rows||[]);renderAll();h$('rshAllStatus').textContent='選択中のDashboard条件を反映'}catch(e){h$('rshAllStatus').textContent='一覧を読み込めません: '+e.message;h$('rshAllStatus').className='muted error'}}
  function renderAll(){var root=h$('rshAllRows');root.innerHTML=allRows.map(function(r){return '<tr tabindex="0" data-rsh-research="'+esc(r.research_id)+'" data-rsh-session="'+esc(r.session_id)+'"><td>'+esc(fmt(r.started_at))+'</td><td>'+esc(r.research_id)+'</td><td title="'+esc(r.session_id)+'">…'+esc(String(r.session_id||'').slice(-10))+'</td><td>'+esc(r.persona_name||r.persona_id)+'</td><td>'+esc(r.topic_label||r.topic)+'</td><td>'+esc(r.data_quality_flag)+'</td></tr>'}).join('')||'<tr><td colspan="6" class="muted">該当するセッションはありません。</td></tr>';bindRows(root);h$('rshAllCount').textContent='表示 '+allRows.length+' / '+allTotal+'件';h$('rshLoadMore').style.display=allNext==null?'none':''}
  function hookRender(){var original=window.renderDashboard;if(typeof original!=='function')return false;if(original.__researchSessionHistoryWrapped)return true;var wrapped=function(d,q){var result=original(d,q);recentRows=Array.isArray(d&&d.recentSessions)?d.recentSessions:[];renderRecent();return result};wrapped.__researchSessionHistoryWrapped=true;window.renderDashboard=wrapped;return true}
  ensureUi();watchWorkspaceHeight();if(!hookRender()){var tries=0,timer=setInterval(function(){tries+=1;if(hookRender()||tries>40)clearInterval(timer)},100)}
  document.addEventListener('keydown',function(e){if(e.key==='Escape'){closePanel();closeAll()}})
})();
</script>`;

export function injectResearchSessionHistoryManagementHtml(html: string): string {
  if (!html || html.includes('researchSessionHistoryScript')) return html;
  const withStyle = html.includes('</head>') ? html.replace('</head>', HISTORY_STYLE + '</head>') : HISTORY_STYLE + html;
  return withStyle.includes('</body>') ? withStyle.replace('</body>', HISTORY_SCRIPT + '</body>') : withStyle + HISTORY_SCRIPT;
}

export function withResearchSessionHistoryManagementPage(path: string, handler: RequestHandler): RequestHandler {
  if (path !== '/management') return handler;
  return (req, res, next) => {
    const originalSend = res.send.bind(res);
    (res as any).send = (body: any) => originalSend(typeof body === 'string' ? injectResearchSessionHistoryManagementHtml(body) : body);
    return handler(req, res, next);
  };
}
