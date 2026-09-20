import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { WindowsSession, WindowsBridge, WINDOWS_TOOLS, checkAction } from './desktop.mjs';
import { windowsConfig } from './cli.mjs';
import { serve } from './mcp.mjs';
const NOW = Date.parse('2026-09-20T07:00:00Z');
const checks = { userAuthorized: true, scopeChecked: true, targetChecked: true, dataMinimized: true };
const action = () => ({ type: 'invoke', targetId: 'button', arguments: {} });
function fixture(options = {}) {
  let calls = [], seq = 0, cloud = 0;
  const bridge = { close() { calls.push({ method: 'close' }); }, async call(method, args) {
    calls.push({ method, args });
    if (method === 'observe') return { snapshotId: `s${++seq}`, hwnd: '42', app: 'Test', revision: 'v1', observedAt: new Date(NOW).toISOString(), expiresAt: new Date(NOW + 60000).toISOString(), truncated: false, elements: [{ id: 'window', role: 'window', label: 'Test', enabled: true }, { id: 'button', role: 'button', label: options.label ?? 'Increment', enabled: true }] };
    if (method === 'screenshot') return { data: 'AAAA', mimeType: 'image/png', imageHash: 'a'.repeat(64) };
    if (method === 'execute') { if (options.failExecute) throw new Error('backend_timeout'); return { executed: args.execute, dryRun: !args.execute, requiresObserve: args.execute }; }
    return { executed: false };
  } };
  const session = new WindowsSession({ bridge, now: options.now ?? (() => NOW), askImpl: options.askImpl ?? (async request => { cloud++; options.inspect?.(request); return { answers: { approve: { noul: options.approve ?? 0.99 }, risk: { noul: options.risk ?? 0.01 } } }; }) });
  return { session, calls, cloud: () => cloud };
}
const observe = f => f.session.call('windows_observe', { hwnd: '42' });
const review = (f, snapshotId, a = action(), hostChecks = checks) => f.session.call('windows_review', { snapshotId, goal: 'Increment local test counter', action: a, hostChecks });
const execute = (f, snapshotId, r, a = action()) => f.session.call('windows_execute', { snapshotId, action: a, dryRun: false, reviewId: r.reviewId });
test('Windows review is not execution; exact action executes only on separate call', async () => {
  const f = fixture(); const s = await observe(f); const r = await review(f, s.snapshotId);
  assert.equal(r.allowed, true); assert.equal(r.executed, false); assert.equal(f.calls.filter(c => c.method === 'execute').length, 0);
  assert.equal((await execute(f, s.snapshotId, r)).executed, true);
  await assert.rejects(execute(f, s.snapshotId, r), /Snapshot/);
});
test('default Windows dry-run performs preflight only and requires no cloud call', async () => {
  const f = fixture(); const s = await observe(f);
  const r = await f.session.call('windows_execute', { snapshotId: s.snapshotId, action: action() });
  assert.equal(r.executed, false); assert.equal(f.cloud(), 0);
  assert.equal(f.calls.at(-1).args.execute, false);
});
test('real execution without matching review never reaches backend', async () => {
  const f = fixture(); const s = await observe(f);
  assert.equal((await f.session.call('windows_execute', { snapshotId: s.snapshotId, action: action(), dryRun: false })).allowed, false);
  assert.equal(f.calls.filter(c => c.method === 'execute').length, 0);
});
test('Windows approval is bound to complete action and consumed on mismatch', async () => {
  const f = fixture(); const s = await observe(f); const r = await review(f, s.snapshotId);
  assert.equal((await execute(f, s.snapshotId, r, { type: 'click', targetId: 'button', arguments: {} })).allowed, false);
  assert.equal((await execute(f, s.snapshotId, r)).allowed, false);
});
test('Windows denies incomplete checks before sending UI data to API', async () => {
  for (const field of Object.keys(checks)) {
    const f = fixture(); const s = await observe(f);
    assert.equal((await review(f, s.snapshotId, action(), { ...checks, [field]: false })).allowed, false);
    assert.equal(f.cloud(), 0);
  }
});
test('Windows sensitive action requires action-specific authorization', async () => {
  const f = fixture({ label: 'Send message' }); const s = await observe(f);
  assert.equal((await review(f, s.snapshotId)).allowed, false); assert.equal(f.cloud(), 0);
});
test('denied and uncertain Windows reviews are not retried on the same snapshot', async () => {
  for (const options of [{ approve: 0.89 }, { risk: 0.2 }, { approve: ' ' }]) {
    const f = fixture(options); const s = await observe(f);
    assert.equal((await review(f, s.snapshotId)).allowed, false); assert.equal((await review(f, s.snapshotId)).allowed, false); assert.equal(f.cloud(), 1);
  }
});
test('screenshots are not sent in Jev requests', async () => {
  const f = fixture({ inspect: request => { assert.deepEqual(Object.keys(request.questions), ['approve', 'risk']); assert.ok(!JSON.stringify(request.state).includes('AAAA')); } });
  const s = await observe(f); await f.session.call('windows_screenshot', { snapshotId: s.snapshotId }); await review(f, s.snapshotId);
});
test('Windows changed/expired snapshots do not execute', async () => {
  let now = NOW; const f = fixture({ now: () => now }); const s = await observe(f); const r = await review(f, s.snapshotId);
  now += 60001; await assert.rejects(execute(f, s.snapshotId, r), /expired/);
});
test('native execution failure reports unknown outcome and consumes snapshot', async () => {
  const f = fixture({ failExecute: true }); const s = await observe(f); const r = await review(f, s.snapshotId);
  assert.equal((await execute(f, s.snapshotId, r)).executed, 'unknown'); await assert.rejects(execute(f, s.snapshotId, r));
});
test('Windows stop invalidates session and closes backend', async () => {
  const f = fixture(); await observe(f); const r = await f.session.call('windows_stop', {}); assert.equal(r.stopped, true);
  await assert.rejects(f.session.call('windows_list', {})); assert.equal(f.calls.at(-1).method, 'close');
});
test('non-Windows environments fail clearly rather than simulate native success', async () => {
  const bridge = new WindowsBridge({ platform: 'linux' }); await assert.rejects(bridge.call('info'), /native Windows/);
});
test('Windows action schema rejects extra fields, arbitrary key scripts and unsafe coordinates', () => {
  const invalid = [
    { type: 'invoke', targetId: 'button', arguments: { command: 'calc.exe' } },
    { type: 'press_key', targetId: 'button', arguments: { key: '{ENTER} arbitrary macro' } },
    { type: 'click_at', targetId: 'button', arguments: { x: 1, y: 1, imageHash: 'a'.repeat(64) } },
    { type: 'drag', targetId: 'window', arguments: { x: 1, y: Infinity, toX: 1, toY: 1, imageHash: 'a'.repeat(64) } },
    { type: 'type_text', targetId: 'button', arguments: { text: 'x'.repeat(2001) } },
  ];
  for (const a of invalid) assert.throws(() => checkAction(a));
  checkAction({ type: 'type_text', targetId: 'button', arguments: { text: '繁體中文 {literal}' } });
});
test('Windows configuration uses separate local server and correct host formats', () => {
  const c = JSON.parse(windowsConfig('opencode')); assert.equal(c.mcp['jev-windows'].type, 'local');
  assert.ok(windowsConfig('codex').includes('[mcp_servers.jev-windows]'));
  assert.equal(JSON.parse(windowsConfig('agy')).mcpServers['jev-windows'].args.at(-1), 'mcp');
  assert.equal(JSON.parse(windowsConfig('pi')).extensions.length, 1);
});
test('Windows MCP tools distinguish executor and reviewer annotations, image has native image content', { timeout: 5000 }, async t => {
  const input = new PassThrough(), output = new PassThrough(); let buffer = '', id = 0; const waiting = new Map();
  const f = fixture(); t.after(serve({ input, output, session: f.session }));
  output.setEncoding('utf8'); output.on('data', c => { buffer += c; while (buffer.includes('\n')) { const p = buffer.indexOf('\n'); const r = JSON.parse(buffer.slice(0,p)); buffer = buffer.slice(p+1); waiting.get(r.id)?.(r); } });
  const rpc = (method, params = {}) => new Promise(resolve => { const n = ++id; waiting.set(n,resolve); input.write(JSON.stringify({jsonrpc:'2.0',id:n,method,params})+'\n'); });
  await rpc('initialize',{ protocolVersion:'2025-06-18' }); input.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  const list = await rpc('tools/list'); assert.equal(list.result.tools.length, WINDOWS_TOOLS.length);
  assert.equal(list.result.tools.find(t => t.name === 'windows_execute').annotations.readOnlyHint, false);
  assert.equal(list.result.tools.find(t => t.name === 'windows_review').annotations.readOnlyHint, true);
  const s = await rpc('tools/call',{name:'windows_observe',arguments:{hwnd:'42'}});
  const image = await rpc('tools/call',{name:'windows_screenshot',arguments:{snapshotId:s.result.structuredContent.snapshotId}});
  assert.equal(image.result.content[1].type,'image'); assert.equal(image.result.structuredContent.data,undefined);
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installWindows } from './install.mjs';
test('Windows installer provides Pi loader and backs up existing skill without editing MCP config', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(),'jev-windows-install-'));
  try {
    const result=installWindows('pi',{home}); assert.ok(fs.existsSync(result.extension)); assert.equal(result.mcpSettingsChanged,false);
    assert.ok(!fs.readFileSync(path.join(result.skill,'SKILL.md'),'utf8').includes('{{WINDOWS_DIR}}'));
    assert.throws(()=>installWindows('pi',{home}),/Already/);
    const next=installWindows('pi',{home,force:true}); assert.equal(next.backups.length,2);
    assert.throws(()=>installWindows('__proto__',{home}),/Agent/);
  } finally {fs.rmSync(home,{recursive:true,force:true});}
});
