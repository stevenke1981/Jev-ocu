import test from 'node:test';
import assert from 'node:assert/strict';
import { ReviewSession, digest, observationHash, LIMITS } from '../src/reviewer.mjs';
const NOW = Date.parse('2026-09-20T05:00:00Z');
export const proposal = () => ({ goal: 'Go to previous month', observation: { source: 'uia', app: 'Calendar', revision: '1', observedAt: new Date(NOW).toISOString(), text: 'September 2026', elements: [{ id: 'prev', role: 'button', label: 'Previous month' }] }, action: { type: 'click', tool: 'desktop_click', targetId: 'prev', arguments: { element_id: 'prev' } } });
export const checks = { userAuthorized: true, scopeChecked: true, targetChecked: true, dataMinimized: true };
const ok = async () => ({ answers: { approve: { noul: 0.99 }, risk: { noul: 0.01 } } });
const make = (options = {}) => new ReviewSession({ now: () => NOW, askImpl: ok, ...options });
const prep = (s, p = proposal()) => s.call('jev_prepare_review', { proposal: p });
const review = (s, id, hostChecks = checks) => s.call('jev_review_action', { preparedId: id, hostChecks });
const validate = (s, id, p = proposal()) => s.call('jev_validate_review', { preparedId: id, observation: p.observation, action: p.action });

test('one-use review pipeline never executes', async () => {
  const s = make(); const p = await prep(s);
  assert.equal(p.requiredHostChecks.length, 4);
  assert.equal((await review(s, p.preparedId)).verdict, 'ALLOW');
  const v = await validate(s, p.preparedId); assert.equal(v.allowed, true); assert.equal(v.executed, false);
  assert.equal((await validate(s, p.preparedId)).allowed, false);
  s.close();
});
test('review sends only approve/risk questions and the exact proposed action', async () => {
  let called = 0;
  const s = make({ askImpl: async ({ state, questions }) => {
    called++; assert.deepEqual(state.proposal.action, proposal().action);
    assert.deepEqual(Object.keys(questions), ['approve', 'risk']); return ok();
  } });
  const p = await prep(s); await review(s, p.preparedId); assert.equal(called, 1);
});
test('each missing host check blocks before the API', async () => {
  for (const key of Object.keys(checks)) {
    const s = make({ askImpl: async () => { assert.fail('must not call provider'); } });
    const p = await prep(s); assert.equal((await review(s, p.preparedId, { ...checks, [key]: false })).reason, 'host_checks_incomplete');
  }
});
test('unknown, disabled and duplicate targets are rejected', async () => {
  for (const mutate of [p => p.action.targetId = 'other', p => p.observation.elements[0].enabled = false, p => p.observation.elements.push({ ...p.observation.elements[0] })]) {
    const p = proposal(); mutate(p); await assert.rejects(prep(make(), p));
  }
});
test('stale, future and timezone-free observations are rejected', async () => {
  for (const time of ['2020-01-01T00:00:00Z', '2027-01-01T00:00:00Z', '2026-09-20T05:00:00']) {
    const p = proposal(); p.observation.observedAt = time; await assert.rejects(prep(make(), p));
  }
});
test('probabilities must be present, finite and within range', async () => {
  for (const value of [null, undefined, '', ' ', true, -1, 1.1, NaN, Infinity]) {
    const s = make({ askImpl: async () => ({ answers: { approve: { noul: value }, risk: { noul: 0 } } }) });
    const p = await prep(s); assert.equal((await review(s, p.preparedId)).allowed, false);
  }
});
test('uncertain approval and high risk both deny', async () => {
  for (const [approve, risk] of [[0.89, 0.01], [0.99, 0.2], [0.01, 0.99]]) {
    const s = make({ askImpl: async () => ({ answers: { approve: { noul: approve }, risk: { noul: risk } } }) });
    const p = await prep(s); assert.equal((await review(s, p.preparedId)).allowed, false);
  }
});
test('sensitive action needs action-specific host authorization', async () => {
  const p = proposal(); p.observation.elements[0].label = 'Send';
  const s = make(); const a = await prep(s, p);
  assert.equal((await review(s, a.preparedId)).reason, 'sensitive_action_needs_explicit_authorization');
  const b = await prep(s, p); assert.equal((await review(s, b.preparedId, { ...checks, sensitiveActionAuthorized: true })).allowed, true);
});
test('review rejects provider failures without reflecting secrets', async () => {
  const s = make({ askImpl: async () => { throw new Error('secret-provider-data'); } });
  const p = await prep(s); const r = await review(s, p.preparedId);
  assert.equal(r.reason, 'provider_error'); assert.ok(!JSON.stringify(r).includes('secret-provider-data'));
});
test('binding rejects changed state, app, target, tool or arguments', async () => {
  for (const mutate of [p => p.observation.text += ' changed', p => p.observation.app = 'Other', p => p.action.targetId = 'other', p => p.action.tool = 'other_tool', p => p.action.arguments.element_id = 'other']) {
    const s = make(); const a = await prep(s); await review(s, a.preparedId);
    const p = proposal(); mutate(p); assert.equal((await validate(s, a.preparedId, p)).allowed, false);
  }
});
test('freshly observed unchanged state permits a new timestamp', async () => {
  const s = make(); const a = await prep(s); await review(s, a.preparedId);
  const p = proposal(); p.observation.observedAt = new Date(NOW + 500).toISOString();
  assert.equal((await validate(s, a.preparedId, p)).allowed, true);
});
test('in-flight expiration and post-review expiration deny', async () => {
  let now = NOW;
  const s = make({ now: () => now }); const p = await prep(s); await review(s, p.preparedId);
  now += LIMITS.ttlMs + 1; assert.equal((await validate(s, p.preparedId)).allowed, false);
  now = NOW;
  const s2 = make({ now: () => now, askImpl: async () => { now += LIMITS.ttlMs + 1; return ok(); } });
  const p2 = await prep(s2); assert.equal((await review(s2, p2.preparedId)).reason, 'review_expired');
});
test('cancel and disconnect invalidate reviews', async () => {
  const s = make(); const p = await prep(s); const c = new AbortController(); c.abort();
  assert.equal((await s.call('jev_review_action', { preparedId: p.preparedId, hostChecks: checks }, { signal: c.signal })).reason, 'cancelled');
  s.close(); await assert.rejects(s.call('jev_info', {}), /closed/);
});
test('concurrent duplicate review calls result in a single provider call', async () => {
  let calls = 0, finish;
  const s = make({ askImpl: () => { calls++; return new Promise(r => { finish = r; }); } });
  const p = await prep(s); const first = review(s, p.preparedId);
  assert.equal((await review(s, p.preparedId)).allowed, false);
  finish(await ok()); assert.equal((await first).allowed, true); assert.equal(calls, 1);
});
test('private fields, image data and oversized payloads are rejected', async () => {
  for (const mutate of [p => p.action.arguments.password = 'secret', p => p.observation.text = 'data:image/png;base64,ABC', p => p.action.arguments.text = 'x'.repeat(5000), p => p.observation.elements = Array(61).fill(p.observation.elements[0])]) {
    const p = proposal(); mutate(p); await assert.rejects(prep(make(), p));
  }
});
test('pending memory is bounded and expired entries are swept', async () => {
  let now = NOW; const s = make({ now: () => now });
  for (let i = 0; i < LIMITS.maxPending; i++) await prep(s);
  await assert.rejects(prep(s), /Too many/); now += LIMITS.ttlMs + 1;
  const p = proposal(); p.observation.observedAt = new Date(now).toISOString(); await prep(s, p);
});
test('invalid schema including inherited-key injection is rejected', async () => {
  const p = proposal(); p.extra = 'not allowed'; await assert.rejects(prep(make(), p));
  const s = make(); await assert.rejects(s.call('jev_info', JSON.parse('{"__proto__":{}}')));
  await assert.rejects(s.call('jev_execute', {}));
});
test('hash canonicalization is stable but changes with relevant values', () => {
  assert.equal(digest({ a: 1, b: 2 }), digest({ b: 2, a: 1 }));
  assert.notEqual(digest({ a: 1 }), digest({ a: 2 }));
  assert.throws(() => digest({ a: Infinity }));
  const p = proposal(); assert.equal(observationHash(p.observation).length, 64);
});
