import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { serve } from '../src/mcp.mjs';
import { ReviewSession } from '../src/reviewer.mjs';
import registerPi from '../src/pi.mjs';
import { config, install } from '../src/setup.mjs';
const cli = fileURLToPath(new URL('../bin/jev-ocu.mjs', import.meta.url));
function client(input, output) {
  let id = 0, buffer = ''; const waiting = new Map();
  output.setEncoding('utf8'); output.on('data', chunk => {
    buffer += chunk;
    while (buffer.includes('\n')) {
      const i = buffer.indexOf('\n'); const r = JSON.parse(buffer.slice(0, i)); buffer = buffer.slice(i + 1);
      waiting.get(r.id)?.(r); waiting.delete(r.id);
    }
  });
  const send = data => input.write(JSON.stringify(data) + '\n');
  const rpc = (method, params = {}) => new Promise(resolve => { const n = ++id; waiting.set(n, resolve); send({ jsonrpc: '2.0', id: n, method, params }); });
  const init = async () => { const r = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } }); send({ jsonrpc: '2.0', method: 'notifications/initialized' }); return r; };
  return { rpc, send, init };
}
test('real CLI subprocess does MCP initialize/list/info over stdio', { timeout: 5000 }, async t => {
  const child = spawn(process.execPath, [cli, 'mcp'], { stdio: ['pipe', 'pipe', 'pipe'] }); t.after(() => child.kill());
  const c = client(child.stdin, child.stdout);
  assert.equal((await c.init()).result.serverInfo.name, 'jev-ocu');
  const listed = await c.rpc('tools/list'); assert.equal(listed.result.tools.length, 5);
  const result = await c.rpc('tools/call', { name: 'jev_info', arguments: {} });
  assert.equal(result.result.structuredContent.executed, false);
  child.stdin.end();
});
test('MCP initialization guard and unknown methods/tools', { timeout: 5000 }, async t => {
  const i = new PassThrough(), o = new PassThrough(); t.after(serve({ input: i, output: o })); const c = client(i, o);
  assert.equal((await c.rpc('tools/list')).error.code, -32002); await c.init();
  assert.equal((await c.rpc('not-supported')).error.code, -32601);
  assert.equal((await c.rpc('tools/call', { name: 'execute' })).error.code, -32602);
  assert.equal((await c.rpc('tools/call', { name: 'jev_info', arguments: { unexpected: true } })).result.isError, true);
});
test('MCP cancellation reaches in-flight model requests', { timeout: 5000 }, async t => {
  const i = new PassThrough(), o = new PassThrough(); let started;
  const pending = new Promise(r => { started = r; });
  const session = new ReviewSession({ askImpl: async ({ signal }) => { started(); return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('cancel')), { once: true })); } });
  t.after(serve({ input: i, output: o, session })); const c = client(i, o); await c.init();
  const p = JSON.parse(fs.readFileSync(new URL('../examples/proposal.json', import.meta.url))); p.observation.observedAt = new Date().toISOString();
  const prep = await c.rpc('tools/call', { name: 'jev_prepare_review', arguments: { proposal: p } });
  const r = c.rpc('tools/call', { name: 'jev_review_action', arguments: { preparedId: prep.result.structuredContent.preparedId, hostChecks: { userAuthorized: true, scopeChecked: true, targetChecked: true, dataMinimized: true } } });
  await pending; c.send({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 3 } });
  assert.equal((await r).result.structuredContent.reason, 'cancelled');
});
test('CLI demo is offline, doctor redacts keys, malformed input fails', () => {
  const run = (args, options = {}) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 5000, ...options });
  const demo = run(['demo']); assert.equal(demo.status, 0); const data = JSON.parse(demo.stdout);
  assert.equal(data.apiCalled, false); assert.equal(data.validation.allowed, true); assert.equal(data.desktopOperated, false);
  const doctor = run(['doctor'], { env: { ...process.env, OPENROUTER_API_KEY: 'DO-NOT-DISCLOSE' } });
  assert.equal(JSON.parse(doctor.stdout).keyConfigured, true); assert.ok(!doctor.stdout.includes('DO-NOT-DISCLOSE'));
  assert.equal(run(['review', '-'], { input: '{}' }).status, 1);
});
test('host configs contain absolute paths, no keys, and correct envelopes', () => {
  const opts = { root: path.resolve('Agent Folder With Spaces'), node: process.execPath };
  assert.equal(JSON.parse(config('opencode', opts)).mcp['jev-ocu'].type, 'local');
  assert.equal(JSON.parse(config('agy', opts)).mcpServers['jev-ocu'].args.at(-1), 'mcp');
  assert.equal(JSON.parse(config('pi', opts)).extensions.length, 1);
  assert.ok(config('codex', opts).includes('[mcp_servers.jev-ocu]'));
  assert.throws(() => config('wrong'));
});
test('installer refuses overwrite, backs up on force, leaves MCP config untouched', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'jev-home-'));
  try {
    const r = install('pi', { home }); assert.ok(fs.existsSync(r.extension)); assert.equal(r.configChanged, false);
    assert.ok(!fs.readFileSync(path.join(r.skill, 'SKILL.md'), 'utf8').includes('{{REPO_DIR}}'));
    assert.throws(() => install('pi', { home }), /Already exists/);
    const update = install('pi', { home, force: true }); assert.equal(update.backups.length, 2);
    const workspace = path.join(home, 'project'); const a = install('agy', { home, workspace });
    assert.equal(a.skill, path.join(workspace, '.agents/skills/jev-ocu'));
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
test('Pi adapter registers all shared tools and handles lifecycle with mock host', async () => {
  const tools = [], events = {};
  const Type = { Object: (properties, options) => ({ type: 'object', properties, ...options }), Array: (items, options) => ({ type: 'array', items, ...options }), Number: () => ({ type: 'number' }), Boolean: () => ({ type: 'boolean' }), String: options => ({ type: 'string', ...options }), Optional: value => ({ ...value, optional: true }) };
  registerPi({ registerTool: t => tools.push(t), on: (name, fn) => events[name] = fn }, Type);
  assert.equal(tools.length, 5); assert.equal((await tools.find(t => t.name === 'jev_info').execute('t', {})).details.executed, false);
  await events.session_start(); await events.session_shutdown(); await assert.rejects(tools.find(t => t.name === 'jev_info').execute('t', {}), /closed/);
});
test('AGY CLI and IDE skill locations are distinct', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'jev-agy-'));
  try {
    const ide = install('agy', { home }); const cli = install('agy-cli', { home });
    assert.ok(ide.skill.includes(path.join('.gemini', 'config', 'skills')));
    assert.ok(cli.skill.includes(path.join('.gemini', 'antigravity-cli', 'skills')));
    assert.deepEqual(JSON.parse(config('agy-cli')), JSON.parse(config('agy')));
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
