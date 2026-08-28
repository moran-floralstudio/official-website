import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../functions/api/booking.js', import.meta.url), 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const { onRequestPost } = await import(moduleUrl);

function tomorrow() {
  const date = new Date(Date.now() + 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function body(overrides = {}) {
  return {
    serviceType: '客製花禮訂製', date: tomorrow(), location: '台北市', budget: 'NT$ 3,000 - 15,000',
    name: '測試者', phone: '0912-345-678', lineId: '', remarks: '測試', website: '', startedAt: Date.now() - 2000,
    ...overrides
  };
}

function request(payload) {
  return new Request('https://example.com/api/booking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

test('rejects requests when the server secret is missing', async () => {
  const response = await onRequestPost({ request: request(body()), env: {} });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'BOOKING_SERVICE_NOT_CONFIGURED');
});

test('rejects invalid phone values before calling upstream', async () => {
  const response = await onRequestPost({ request: request(body({ phone: 'abc' })), env: { BOOKING_WEBHOOK_URL: 'https://example.com/hook' } });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'INVALID_PHONE');
});

test('returns success only after an upstream 2xx response', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (_url, init) => {
    assert.match(String(init.body), /postData=/);
    return new Response('ok', { status: 200 });
  };
  const response = await onRequestPost({ request: request(body()), env: { BOOKING_WEBHOOK_URL: 'https://example.com/hook' } });
  const result = await response.json();
  assert.equal(response.status, 201);
  assert.equal(result.ok, true);
  assert.match(result.refCode, /^MR-\d{8}-[A-F0-9]{6}$/);
});

test('preserves upstream status context without exposing personal data', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response('denied', { status: 403 });
  const response = await onRequestPost({ request: request(body()), env: { BOOKING_WEBHOOK_URL: 'https://example.com/hook' } });
  const result = await response.json();
  assert.equal(response.status, 502);
  assert.equal(result.code, 'UPSTREAM_REJECTED');
  assert.equal(result.upstreamStatus, 403);
  assert.equal(JSON.stringify(result).includes('0912'), false);
});
