#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WindowsSession, WINDOWS_TOOLS } from './desktop.mjs';
import { serve } from './mcp.mjs';
const DIR = path.dirname(fileURLToPath(import.meta.url));
export function windowsConfig(agent, { node = process.execPath, entry = path.join(DIR, 'cli.mjs') } = {}) {
  const server = { command: node, args: [entry, 'mcp'] };
  if (agent === 'opencode') return JSON.stringify({ mcp: { 'jev-windows': { type: 'local', command: [node, entry, 'mcp'], enabled: true, timeout: 45000 } } }, null, 2);
  if (agent === 'codex') return `[mcp_servers.jev-windows]\ncommand = ${JSON.stringify(node)}\nargs = ${JSON.stringify(server.args)}\nstartup_timeout_sec = 15\ntool_timeout_sec = 45\n`;
  if (['agy', 'agy-cli', 'antigravity', 'generic', 'claude'].includes(agent)) return JSON.stringify({ mcpServers: { 'jev-windows': server } }, null, 2);
  if (agent === 'pi') return JSON.stringify({ extensions: [path.join(DIR, 'pi-extension.ts')] }, null, 2);
  throw new Error('Agent must be codex, pi, agy, agy-cli, opencode, claude or generic');
}
export async function main(args = process.argv.slice(2)) {
  const [command = 'help', arg] = args;
  if (command === 'config') { console.log(windowsConfig(arg)); return; }
  if (command === 'schema') { console.log(JSON.stringify(WINDOWS_TOOLS, null, 2)); return; }
  if (command === 'mcp') {
    const close = serve();
    for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => { close(); process.exit(0); });
    return;
  }
  if (['doctor', 'list', 'observe'].includes(command)) {
    const session = new WindowsSession();
    try {
      const result = await session.call({ doctor: 'windows_info', list: 'windows_list', observe: 'windows_observe' }[command], command === 'observe' ? { hwnd: arg } : {});
      console.log(JSON.stringify({ ...result, note: 'Read-only CLI diagnostic. This process closes now; use MCP or Pi for a persistent review/execute session.' }, null, 2));
    } finally { session.close(); }
    return;
  }
  if (!['help', '--help', '-h'].includes(command)) throw new Error('Unknown command');
  console.log('Windows Computer Use 1.0.0\n\nnode windows/cli.mjs doctor|list|observe <hwnd>|schema\nnode windows/cli.mjs mcp\nnode windows/cli.mjs config <codex|pi|agy|agy-cli|opencode|generic>\n\nRequires native Windows 10/11, Node 22+, Windows PowerShell 5.1.\nMCP/Pi: observe -> review -> explicit execute -> observe to verify.\nDefault dry-run does not write. No autonomous loop, global execution policy change, or elevation.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(err => { console.error(err.message); process.exitCode = 1; });
