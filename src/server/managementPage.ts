export function managementPageHtml(): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI留学生 管理・研究コンソール</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;background:#f8fafc;color:#0f172a}.wrap{max-width:1050px;margin:0 auto;padding:24px}.card{background:#fff;border:1px solid #cbd5e1;border-radius:14px;padding:18px;margin-bottom:16px}h1{font-size:22px}h2{font-size:17px}input,button{font:inherit;padding:9px 11px;border-radius:8px;border:1px solid #94a3b8}button{cursor:pointer;background:#1d4ed8;color:#fff;border-color:#1d4ed8;font-weight:700}button.secondary{background:#fff;color:#334155}.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.muted{color:#64748b;font-size:13px}.error{color:#b91c1c;font-weight:700}.ok{color:#047857;font-weight:700}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border-bottom:1px solid #e2e8f0;padding:7px;text-align:left}code{font-size:12px}</style></head><body><div class="wrap"><h1>AI留学生 管理・研究コンソール</h1><p class="muted">児童用アプリとは分離された管理URLです。教師・研究者アカウントでログインしてください。</p><div id="login" class="card"><h2>ログイン</h2><div class="row"><input id="u" autocomplete="username" placeholder="管理者ID"><input id="p" type="password" autocomplete="current-password" placeholder="パスワード"><button id="loginBtn">ログイン</button></div><p id="msg" class="muted"></p></div><div id="panel" style="display:none"><div class="card"><div class="row"><strong id="who"></strong><button id="logoutBtn" class="secondary">ログアウト</button><button id="refreshBtn">最新データを更新</button><button id="csvBtn">匿名化CSV</button></div></div><div class="card"><h2>保存セッション</h2><div style="overflow:auto"><table><thead><tr><th>研究ID</th><th>終了</th><th>回数</th><th>AI</th><th>話題</th><th>実時間</th><th>ターン</th><th>語数</th></tr></thead><tbody id="rows"></tbody></table></div></div></div></div><script>
function requiredElement(id){const el=document.getElementById(id);if(!el)throw new Error('MANAGEMENT_UI_MISSING_ELEMENT:'+id);return el}
const loginCard=requiredElement('login');
const panelEl=requiredElement('panel');
const usernameInput=requiredElement('u');
const passwordInput=requiredElement('p');
const messageEl=requiredElement('msg');
const whoEl=requiredElement('who');
const csvButton=requiredElement('csvBtn');
const rowsEl=requiredElement('rows');
const loginButton=requiredElement('loginBtn');
const logoutButton=requiredElement('logoutBtn');
const refreshButton=requiredElement('refreshBtn');
async function api(path,opt={}){const r=await fetch(path,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(opt.headers||{})},...opt});const ct=r.headers.get('content-type')||'';if(!r.ok){let e='HTTP '+r.status;try{if(ct.includes('json'))e=(await r.json()).error||e}catch{}throw new Error(e)}return ct.includes('json')?r.json():r.text()}
async function handleLogin(){try{await api('/api/management/login',{method:'POST',body:JSON.stringify({username:usernameInput.value,password:passwordInput.value})});messageEl.className='muted';messageEl.textContent='';await status()}catch(e){messageEl.className='error';messageEl.textContent='ログインできません: '+e.message}}
async function status(){try{const d=await api('/api/management/me');loginCard.style.display='none';panelEl.style.display='block';whoEl.textContent=d.user.username+' ('+d.user.role+')';csvButton.style.display=d.user.role==='researcher'?'inline-block':'none';await loadSessions()}catch{loginCard.style.display='block';panelEl.style.display='none'}}
async function logout(){await api('/api/management/logout',{method:'POST',body:'{}'});location.reload()}
async function loadSessions(){try{const d=await api('/api/management/sessions');rowsEl.innerHTML=d.sessions.map(s=>'<tr><td>'+esc(s.researchId||'')+'</td><td>'+esc(s.endedAt||'')+'</td><td>'+esc(s.lifetimeSessionNumber||'')+'</td><td>'+esc(s.aiStudentId||'')+'</td><td>'+esc(s.topic||'')+'</td><td>'+esc(s.actualDurationSeconds||0)+'秒</td><td>'+esc(s.totalTurns||0)+'</td><td>'+esc(s.totalChildWords||0)+'</td></tr>').join('')}catch(e){rowsEl.innerHTML='<tr><td colspan="8" class="error">'+esc(e.message)+'</td></tr>'}}
async function downloadCsv(){const r=await fetch('/api/management/research.csv',{credentials:'same-origin'});if(!r.ok){alert('CSVを取得できません');return}const b=await r.blob();const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='research-export.csv';a.click();URL.revokeObjectURL(a.href)}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
loginButton.addEventListener('click',handleLogin);
logoutButton.addEventListener('click',logout);
refreshButton.addEventListener('click',loadSessions);
csvButton.addEventListener('click',downloadCsv);
status();
</script></body></html>`;
}
