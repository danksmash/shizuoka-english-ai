import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const dedupe = fs.readFileSync('src/server/providerRequestDedupe.ts', 'utf8');
const persistence = fs.readFileSync('src/server/persistence.ts', 'utf8');

for (const marker of [
  "res.setHeader('X-TTS-Cache', azure.cache)",
  "dedupePaidJsonRoute('chat')",
  "dedupePaidJsonRoute('feedback')",
  "route: 'anthropic-feedback'",
  "app.get('/api/management/cost.audit'",
  "'Content-Type, X-Idempotency-Key'",
]) {
  if (!server.includes(marker)) throw new Error(`Cost-control server marker missing: ${marker}`);
}

if (server.includes("res.setHeader('X-TTS-Cache', 'MISS')")) {
  throw new Error('Azure cache telemetry must not be hard-coded to MISS');
}

for (const marker of [
  "'X-Idempotency-Key':requestId",
  'chatRequestInFlightRef.current',
  "recordResearchEvent('ai_cache_read_tokens'",
  "recordResearchEvent('ai_cache_creation_tokens'",
]) {
  if (!app.includes(marker)) throw new Error(`Cost-control client marker missing: ${marker}`);
}

for (const marker of [
  'COMPLETED_TTL_MS = 2 * 60_000',
  'MAX_COMPLETED_ENTRIES = 1_000',
  "res.setHeader('X-Idempotency-Cache', 'COALESCED')",
  "crypto.createHash('sha256')",
]) {
  if (!dedupe.includes(marker)) throw new Error(`Request deduplication marker missing: ${marker}`);
}

if (!persistence.includes('getCostAuditSessionsForManagementByLocalDateRange')) {
  throw new Error('Projected management cost-audit reader missing');
}

console.log('Paid-request deduplication + feedback usage + Azure cache telemetry QA: PASS');
