import crypto from 'node:crypto';
import type { Request, RequestHandler, Response } from 'express';

type JsonResult = { statusCode: number; body: unknown };
type PendingResult = { promise: Promise<JsonResult>; resolve: (result: JsonResult) => void };

const COMPLETED_TTL_MS = 2 * 60_000;
const PENDING_TIMEOUT_MS = 70_000;
const MAX_COMPLETED_ENTRIES = 1_000;

const pending = new Map<string, PendingResult>();
const completed = new Map<string, { result: JsonResult; expiresAt: number }>();

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

function requestKey(route: string, req: Request): string {
  const supplied = req.get('X-Idempotency-Key')?.trim() || '';
  const body = JSON.stringify(stableValue(req.body || {}));
  const material = /^[A-Za-z0-9._:-]{16,160}$/.test(supplied)
    ? `id:${supplied}|body:${body}`
    : `body:${body}`;
  return crypto.createHash('sha256').update(`${route}|${material}`).digest('hex');
}

function pruneCompleted(now = Date.now()) {
  for (const [key, entry] of completed) {
    if (entry.expiresAt <= now) completed.delete(key);
  }
  while (completed.size > MAX_COMPLETED_ENTRIES) {
    const oldest = completed.keys().next().value as string | undefined;
    if (!oldest) break;
    completed.delete(oldest);
  }
}

/**
 * Coalesces identical paid JSON requests inside a Cloud Run instance and
 * replays a recent successful response. Only hashes and short-lived response
 * objects are retained; child identifiers and request bodies are not stored.
 */
export function dedupePaidJsonRoute(route: string): RequestHandler {
  return async (req, res, next) => {
    pruneCompleted();
    const key = requestKey(route, req);
    const cached = completed.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      res.setHeader('X-Idempotency-Cache', 'HIT');
      return res.status(cached.result.statusCode).json(cached.result.body);
    }

    const inFlight = pending.get(key);
    if (inFlight) {
      const result = await inFlight.promise;
      res.setHeader('X-Idempotency-Cache', 'COALESCED');
      return res.status(result.statusCode).json(result.body);
    }

    let resolvePending!: (result: JsonResult) => void;
    const promise = new Promise<JsonResult>((resolve) => { resolvePending = resolve; });
    pending.set(key, { promise, resolve: resolvePending });
    res.setHeader('X-Idempotency-Cache', 'MISS');

    const timeout = setTimeout(() => {
      const active = pending.get(key);
      if (!active) return;
      pending.delete(key);
      active.resolve({ statusCode: 503, body: { success: false, error: 'REQUEST_DEDUPLICATION_TIMEOUT' } });
    }, PENDING_TIMEOUT_MS);

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      clearTimeout(timeout);
      const result = { statusCode: res.statusCode, body };
      const active = pending.get(key);
      if (active) {
        pending.delete(key);
        active.resolve(result);
      }
      if (res.statusCode >= 200 && res.statusCode < 300) {
        completed.set(key, { result, expiresAt: Date.now() + COMPLETED_TTL_MS });
        pruneCompleted();
      }
      return originalJson(body);
    }) as Response['json'];

    res.once('close', () => {
      if (res.writableEnded) return;
      // The paid provider request may still finish and call res.json. Keep the
      // in-flight entry until then so a browser retry can join it safely.
    });
    next();
  };
}

