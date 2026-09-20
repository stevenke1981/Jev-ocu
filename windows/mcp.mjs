/** Minimal STDIO MCP: newline-delimited JSON-RPC; stdout is protocol only. */
import { WindowsSession, WINDOWS_TOOLS as TOOLS, WINDOWS_VERSION as VERSION } from './desktop.mjs';
const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
export function serve({ input = process.stdin, output = process.stdout, session = new WindowsSession() } = {}) {
  let buffer = '', state = 'new', closed = false;
  const pending = new Map();
  const send = message => { if (!closed) output.write(JSON.stringify(message) + '\n'); };
  const error = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });
  const result = (id, value) => send({ jsonrpc: '2.0', id, result: value });
  const close = () => {
    if (closed) return;
    closed = true;
    for (const controller of pending.values()) controller.abort();
    pending.clear(); session.close();
    input.off('data', onData); input.off('end', close); input.off('error', close);
    output.off('error', close);
  };
  async function handle(message) {
    const validId = id => typeof id === 'string' || (typeof id === 'number' && Number.isFinite(id));
    if (!message || Array.isArray(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string' || (Object.hasOwn(message, 'id') && !validId(message.id))) {
      error(null, -32600, 'Invalid Request'); return;
    }
    const { id, method, params } = message;
    if (id === undefined) {
      if (method === 'notifications/initialized' && state === 'initializing') state = 'ready';
      if (method === 'notifications/cancelled') pending.get(params?.requestId)?.abort();
      return;
    }
    if (pending.has(id)) { error(id, -32600, 'Duplicate active request ID'); return; }
    if (method === 'ping') { result(id, {}); return; }
    if (method === 'initialize') {
      if (state !== 'new') { error(id, -32600, 'Already initialized'); return; }
      if (typeof params?.protocolVersion !== 'string') { error(id, -32602, 'Missing protocolVersion'); return; }
      state = 'initializing';
      result(id, { protocolVersion: VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : '2025-06-18', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'jev-windows', version: VERSION }, instructions: 'Windows computer use: list/observe, review exact action with Jev, then explicitly execute. Never automatically act on ALLOW. Real execution needs a matching one-use reviewId and dryRun=false. Default dryRun does not act. Read screenshots locally, never send them to Jev.' });
      return;
    }
    if (state !== 'ready') { error(id, -32002, 'Complete initialization first'); return; }
    if (method === 'tools/list') {
      result(id, { tools: TOOLS.map(t => ({ ...t, annotations: { readOnlyHint: !['windows_execute', 'windows_stop'].includes(t.name), destructiveHint: t.name === 'windows_execute', idempotentHint: t.name === 'windows_info', openWorldHint: ['windows_review', 'windows_execute'].includes(t.name) } })) });
      return;
    }
    if (method !== 'tools/call') { error(id, -32601, 'Method not found'); return; }
    if (!TOOLS.some(t => t.name === params?.name)) { error(id, -32602, 'Unknown tool'); return; }
    if (pending.size >= 8) { error(id, -32000, 'Too many active requests'); return; }
    const controller = new AbortController();
    pending.set(id, controller);
    try {
      const data = await session.call(params.name, params.arguments ?? {}, { signal: controller.signal });
      const { data: imageData, ...metadata } = data;
      const content = imageData && data.mimeType === 'image/png'
        ? [{ type: 'text', text: JSON.stringify(metadata) }, { type: 'image', data: imageData, mimeType: 'image/png' }]
        : [{ type: 'text', text: JSON.stringify(data) }];
      result(id, { content, structuredContent: imageData ? metadata : data, isError: Boolean(data.error) });
    } catch (err) {
      result(id, { content: [{ type: 'text', text: err.message }], isError: true });
    } finally { pending.delete(id); }
  }
  function onData(chunk) {
    buffer += chunk;
    if (Buffer.byteLength(buffer) > 262_144) { error(null, -32600, 'STDIO input exceeds 256 KiB'); close(); input.destroy(); return; }
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim(); buffer = buffer.slice(newline + 1);
      if (!line) continue;
      let message;
      try { message = JSON.parse(line); } catch { error(null, -32700, 'Parse error'); continue; }
      void handle(message).catch(() => error(message?.id ?? null, -32603, 'Internal error'));
    }
  }
  input.setEncoding('utf8');
  input.on('data', onData); input.on('end', close); input.on('error', close); output.on('error', close);
  return close;
}
