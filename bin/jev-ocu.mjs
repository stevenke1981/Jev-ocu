#!/usr/bin/env node
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { ReviewSession, info, TOOLS, VERSION } from '../src/reviewer.mjs';
import { serve } from '../src/mcp.mjs';
import { config, install } from '../src/setup.mjs';
const print = data => console.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
async function readInput(file) {
  if (file && file !== '-') {
    if ((await fs.stat(file)).size > 32_768) throw new Error('Input exceeds 32 KiB');
    return JSON.parse(await fs.readFile(file, 'utf8'));
  }
  let text = '';
  for await (const chunk of process.stdin) { text += chunk; if (Buffer.byteLength(text) > 32_768) throw new Error('Input exceeds 32 KiB'); }
  return JSON.parse(text);
}
export async function main(args = process.argv.slice(2)) {
  const [command = 'help', arg, ...rest] = args;
  if (command === 'mcp') {
    const close = serve();
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { close(); process.exit(0); });
    return;
  }
  if (command === 'doctor') { print(info()); return; }
  if (command === 'schema') { print(TOOLS); return; }
  if (command === 'config') { print(config(arg)); return; }
  if (command === 'install') {
    if (!arg) throw new Error('Specify pi, agy, agy-cli, opencode, codex, claude or generic');
    const w = rest.indexOf('--workspace');
    if (w >= 0 && (!rest[w + 1] || rest[w + 1].startsWith('--'))) throw new Error('--workspace requires a path');
    print(install(arg, { force: rest.includes('--force'), legacy: rest.includes('--legacy'), workspace: w >= 0 ? rest[w + 1] : undefined })); return;
  }
  if (command === 'review' || command === 'demo') {
    const mock = command === 'demo';
    const payload = mock ? { proposal: JSON.parse(await fs.readFile(new URL('../examples/proposal.json', import.meta.url), 'utf8')), hostChecks: { userAuthorized: true, scopeChecked: true, targetChecked: true, dataMinimized: true } } : await readInput(arg);
    if (mock) payload.proposal.observation.observedAt = new Date().toISOString();
    const session = new ReviewSession(mock ? { askImpl: async () => ({ answers: { approve: { noul: 0.99 }, risk: { noul: 0.01 } }, model: 'MOCK-NO-API', usage: { costUsd: 0 } }) } : {});
    const cancel = new AbortController();
    const abort = () => cancel.abort();
    process.once('SIGINT', abort); process.once('SIGTERM', abort);
    try {
      const prepared = await session.call('jev_prepare_review', { proposal: payload.proposal });
      const review = await session.call('jev_review_action', { preparedId: prepared.preparedId, hostChecks: payload.hostChecks }, { signal: cancel.signal });
      if (mock) {
        const validation = await session.call('jev_validate_review', { preparedId: prepared.preparedId, observation: payload.proposal.observation, action: payload.proposal.action });
        print({ mock: true, apiCalled: false, desktopOperated: false, prepared, review, validation });
      } else {
        print({ ...review, mode: 'stateless-cli', note: 'Session closes now. This JSON is advisory, not a reusable approval token. Host must freshly re-observe, compare actionHash/observationHash and expiry, execute with its own authorization, then verify.' });
      }
      process.exitCode = review.allowed ? 0 : 2;
    } finally { session.close(); process.off('SIGINT', abort); process.off('SIGTERM', abort); }
    return;
  }
  if (!['help', '--help', '-h'].includes(command)) throw new Error('Unknown command; use --help');
  print(`Jev-ocu v${VERSION} — generic reviewer; Windows companion: node windows/cli.mjs --help\n\nnode bin/jev-ocu.mjs doctor|schema|demo|mcp\nnode bin/jev-ocu.mjs config <pi|agy|agy-cli|opencode|codex|claude|generic>\nnode bin/jev-ocu.mjs install <agent> [--workspace PATH] [--force] [--legacy]\nnode bin/jev-ocu.mjs review <request.json|->\n\nreview input: { proposal: ..., hostChecks: ... }. Exit: 0 ALLOW, 2 DENY, 1 input/runtime error.\nOnly review calls the paid API. demo is entirely mocked. Install never overwrites MCP settings.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(err => { console.error(err.message); process.exitCode = 1; });
