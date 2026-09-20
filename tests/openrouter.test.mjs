import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ask, loadApiKey, estimateCostUsd, DEFAULT_ENDPOINT, DEFAULT_MODEL } from '../src/openrouter.mjs';
const request = (options = {}) => ask({ state: { x: 1 }, questions: { approve: { type: 'noul', instructions: 'Approve?' } }, apiKey: 'test-only-not-a-secret', ...options });
const response = () => new Response(JSON.stringify({ answers: { approve: { noul: 0.99 } }, usage: { input_tokens: 100, cost: 0.001 } }));
test('fixed OpenRouter route, Bearer auth and Decisions wire format', async () => {
  const r = await request({ fetchImpl: async (url, options) => {
    assert.equal(url, DEFAULT_ENDPOINT); assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer test-only-not-a-secret');
    const body = JSON.parse(options.body); assert.equal(body.model, DEFAULT_MODEL); assert.ok(body.state); assert.ok(body.questions); assert.equal(body.messages, undefined);
    return response();
  } });
  assert.equal(r.usage.costUsd, 0.001); assert.equal(r.usage.costSource, 'reported');
});
test('key priority, BOM/CRLF, comments and quoted file values', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jev-key-')); const envFile = path.join(dir, '.env.local');
  try {
    fs.writeFileSync(envFile, '\uFEFF# Example\r\nOPENROUTER_API_KEY="file-key"\r\n');
    assert.equal(loadApiKey({ env: { OPENROUTER_API_KEY: ' env-key ' }, envFile }), 'env-key');
    assert.equal(loadApiKey({ env: {}, envFile }), 'file-key');
    fs.writeFileSync(envFile, 'OPENROUTER_API_KEY=file-key # comment'); assert.equal(loadApiKey({ env: {}, envFile }), 'file-key');
    fs.writeFileSync(envFile, 'TYPESAFE_API_KEY=old-key'); assert.throws(() => loadApiKey({ env: { TYPESAFE_API_KEY: 'old' }, envFile }), /Missing/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('empty key never sends a request', async () => {
  await assert.rejects(request({ apiKey: ' ', fetchImpl: () => assert.fail('network') }), /Missing/);
});
test('cost accepts reported zero and labels absent data as unknown', () => {
  assert.equal(estimateCostUsd({ cost: 0, input_tokens: 100 }), 0);
  assert.equal(estimateCostUsd({ input_tokens: 1_000_000 }), 0.042);
  assert.equal(estimateCostUsd({ cost: ' ', input_tokens: 1_000_000 }), 0.042);
  assert.equal(estimateCostUsd({}), null);
});
test('429/5xx bounded retry stays on same provider', async () => {
  for (const status of [429, 503]) {
    let calls = 0;
    await request({ maxRetries: 1, retryDelayMs: 1, fetchImpl: async url => { assert.equal(url, DEFAULT_ENDPOINT); calls++; return calls === 1 ? new Response('{}', { status }) : response(); } });
    assert.equal(calls, 2);
  }
});
test('4xx do not retry or disclose upstream response text', async () => {
  for (const status of [400, 401, 402, 403, 404]) {
    let calls = 0;
    await assert.rejects(request({ fetchImpl: async () => { calls++; return new Response('{"error":{"message":"PRIVATE-DATA"}}', { status }); } }), err => err.status === status && !err.message.includes('PRIVATE-DATA'));
    assert.equal(calls, 1);
  }
});
test('malformed success replies fail closed', async () => {
  for (const body of ['not json', '{}', '{"answers":[]}', '{"answers":"ALLOW"}']) await assert.rejects(request({ fetchImpl: async () => new Response(body) }));
});
test('timeouts include response reading and respect external cancellation', async () => {
  await assert.rejects(request({ timeoutMs: 10, fetchImpl: async (_url, { signal }) => ({ ok: true, json: () => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })) }) }), /timed out/);
  const c = new AbortController(); c.abort(); await assert.rejects(request({ signal: c.signal }), /cancelled/);
});
