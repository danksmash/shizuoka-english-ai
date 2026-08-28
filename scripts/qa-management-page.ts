import vm from 'node:vm';
import { managementPageHtml } from '../src/server/managementPage';

const html = managementPageHtml();
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) throw new Error('Management page script not found');
if (/onclick=/.test(html)) throw new Error('Inline onclick handlers are not allowed');
if (/\blogin\.style\b/.test(scriptMatch[1])) throw new Error('Regression: login function/element name collision');

class FakeElement {
  value = '';
  textContent = '';
  innerHTML = '';
  className = '';
  style: Record<string, string> = {};
  listeners = new Map<string, (...args: any[]) => any>();
  addEventListener(type: string, listener: (...args: any[]) => any) { this.listeners.set(type, listener); }
}

const ids = ['login','panel','u','p','msg','who','csvBtn','rows','loginBtn','logoutBtn','refreshBtn'];
const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement()])) as Record<string, FakeElement>;
elements.u.value = 'qa-user';
elements.p.value = 'qa-password';
const displayOf = (id: string): string => String(elements[id]?.style.display ?? '');

let meCalls = 0;
const jsonResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => 'application/json' },
  json: async () => body,
  text: async () => JSON.stringify(body),
});

const fetch = async (path: string) => {
  if (path === '/api/management/login') return jsonResponse(200, { success: true, role: 'researcher' });
  if (path === '/api/management/me') {
    meCalls += 1;
    return meCalls === 1
      ? jsonResponse(401, { error: 'NOT_AUTHENTICATED' })
      : jsonResponse(200, { success: true, user: { username: 'qa-user', role: 'researcher' } });
  }
  if (path === '/api/management/sessions') return jsonResponse(200, { success: true, sessions: [] });
  throw new Error(`Unexpected fetch: ${path}`);
};

const context = vm.createContext({
  document: {
    getElementById: (id: string) => elements[id] ?? null,
    createElement: () => new FakeElement(),
  },
  fetch,
  URL: { createObjectURL: () => 'blob:qa', revokeObjectURL: () => undefined },
  location: { reload: () => undefined },
  alert: () => undefined,
  console,
  setTimeout,
  clearTimeout,
});

vm.runInContext(scriptMatch[1], context, { filename: 'management-page-inline.js' });
await new Promise((resolve) => setTimeout(resolve, 0));

if (displayOf('login') !== 'block') throw new Error('Logged-out view did not show login card');
if (displayOf('panel') !== 'none') throw new Error('Logged-out view did not hide panel');
const click = elements.loginBtn.listeners.get('click');
if (!click) throw new Error('Login button listener was not registered');
await click();
await new Promise((resolve) => setTimeout(resolve, 0));
if (displayOf('login') !== 'none') throw new Error('Successful login did not hide login card');
if (displayOf('panel') !== 'block') throw new Error('Successful login did not show panel');
if (elements.who.textContent !== 'qa-user (researcher)') throw new Error('Logged-in identity was not rendered');

console.log('Management page DOM/login regression QA: PASS');
