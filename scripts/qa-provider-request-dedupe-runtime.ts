import assert from 'node:assert/strict';
import { dedupePaidJsonRoute } from '../src/server/providerRequestDedupe';

type MockResponse = {
  statusCode: number;
  writableEnded: boolean;
  headers: Record<string, string>;
  setHeader(name: string, value: string): void;
  status(code: number): MockResponse;
  json(body: unknown): MockResponse;
  once(): MockResponse;
};

function response(done: (value: { status: number; body: unknown; headers: Record<string, string> }) => void): MockResponse {
  return {
    statusCode: 200,
    writableEnded: false,
    headers: {},
    setHeader(name, value) { this.headers[name] = String(value); },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.writableEnded = true; done({ status: this.statusCode, body, headers: this.headers }); return this; },
    once() { return this; },
  };
}

const middleware = dedupePaidJsonRoute('runtime-test') as any;
const request = {
  body: { message: 'Hello', history: [] },
  get(name: string) { return name === 'X-Idempotency-Key' ? 'runtime-test-request-0001' : undefined; },
};

let providerCalls = 0;
function invoke() {
  return new Promise<{ status: number; body: unknown; headers: Record<string, string> }>((resolve, reject) => {
    const res = response(resolve);
    Promise.resolve(middleware(request, res, () => {
      providerCalls += 1;
      setTimeout(() => res.status(200).json({ success: true, value: 'same-response' }), 20);
    })).catch(reject);
  });
}

const [first, second] = await Promise.all([invoke(), invoke()]);
assert.equal(providerCalls, 1, 'simultaneous identical requests must invoke the provider once');
assert.deepEqual(first.body, second.body, 'coalesced request must receive the original response');
assert.equal(second.headers['X-Idempotency-Cache'], 'COALESCED');

const replay = await invoke();
assert.equal(providerCalls, 1, 'recent completed request must not invoke the provider again');
assert.deepEqual(replay.body, first.body);
assert.equal(replay.headers['X-Idempotency-Cache'], 'HIT');

console.log('Provider request runtime deduplication QA: PASS');
