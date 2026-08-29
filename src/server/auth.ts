import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export type ManagementRole = 'teacher' | 'researcher';

interface ManagementAccount {
  username: string;
  role: ManagementRole;
  salt: string;
  passwordHash: string;
}

interface SessionPayload {
  username: string;
  role: ManagementRole;
  exp: number;
}

function getAccounts(): ManagementAccount[] {
  const raw = process.env.MANAGEMENT_ACCOUNTS_JSON || '';
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ManagementAccount =>
      item && typeof item.username === 'string' &&
      (item.role === 'teacher' || item.role === 'researcher') &&
      typeof item.salt === 'string' && typeof item.passwordHash === 'string'
    );
  } catch {
    return [];
  }
}

function getSessionSecret(): string {
  return process.env.MANAGEMENT_SESSION_SECRET || '';
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, 'hex');
    const right = Buffer.from(b, 'hex');
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function sign(payload: SessionPayload): string {
  const secret = getSessionSecret();
  if (!secret) throw new Error('MANAGEMENT_AUTH_NOT_CONFIGURED');
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verify(token: string): SessionPayload | null {
  const secret = getSessionSecret();
  if (!secret || !token.includes('.')) return null;
  const [encoded, signature] = token.split('.', 2);
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload?.username || !payload?.role || !payload?.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function readCookie(req: Request, name: string): string {
  const header = req.headers.cookie || '';
  for (const pair of header.split(';')) {
    const [key, ...rest] = pair.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}

function researcherRouteAllowed(req: Request): boolean {
  const path = req.path || '';
  if (path === '/api/management/me') return true;
  if (path === '/api/management/research.csv') return true;
  if (path === '/api/management/research.bundle.zip') return true;
  return false;
}

export function managementAuthConfigured(): boolean {
  return getAccounts().length > 0 && Boolean(getSessionSecret());
}

export function authenticateManagement(username: string, password: string): { token: string; role: ManagementRole } | null {
  if (!managementAuthConfigured()) return null;
  const account = getAccounts().find((item) => item.username.toLowerCase() === username.trim().toLowerCase());
  if (!account) return null;
  const candidate = hashPassword(password, account.salt);
  if (!safeEqualHex(candidate, account.passwordHash)) return null;
  return {
    role: account.role,
    token: sign({ username: account.username, role: account.role, exp: Date.now() + 8 * 60 * 60 * 1000 }),
  };
}

export function setManagementCookie(res: Response, token: string): void {
  res.setHeader('Set-Cookie', `mgmt_session=${encodeURIComponent(token)}; Max-Age=28800; Path=/; HttpOnly; Secure; SameSite=Strict`);
}

export function clearManagementCookie(res: Response): void {
  res.setHeader('Set-Cookie', 'mgmt_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict');
}

export interface AuthenticatedRequest extends Request {
  managementUser?: SessionPayload;
}

export function requireManagementRole(roles: ManagementRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!managementAuthConfigured()) return res.status(503).json({ success: false, error: 'MANAGEMENT_AUTH_NOT_CONFIGURED' });
    const payload = verify(readCookie(req, 'mgmt_session'));
    if (!payload || !roles.includes(payload.role)) return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    if (payload.role === 'researcher' && !researcherRouteAllowed(req)) {
      return res.status(403).json({ success: false, error: 'RESEARCHER_ANONYMIZED_DATA_ONLY' });
    }
    req.managementUser = payload;
    next();
  };
}

export function createPasswordRecord(password: string): { salt: string; passwordHash: string } {
  const salt = crypto.randomBytes(24).toString('hex');
  return { salt, passwordHash: hashPassword(password, salt) };
}
