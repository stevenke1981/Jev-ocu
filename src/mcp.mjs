/** Minimal STDIO MCP: newline-delimited JSON-RPC; stdout is protocol only. */
import { ReviewSession, TOOLS, VERSION } from './reviewer.mjs';
const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
export function serve({ input = process.stdin, output = process.stdout, session = new ReviewSession() } = {}) {
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
      result(id, { protocolVersion: VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : '2025-06-18', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'jev-ocu', version: VERSION }, instructions: 'Reviewer only. Never executes. Prepare, review, revalidate; then use your own authorized tools and verify the result.' });
      return;
    }
    if (state !== 'ready') { error(id, -32002, 'Complete initialization first'); return; }
    if (method === 'tools/list') {
      result(id, { tools: TOOLS.map(t => ({ ...t, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: t.name === 'jev_info', openWorldHint: t.name === 'jev_review_action' } })) });
      return;
    }
    if (method !== 'tools/call') { error(id, -32601, 'Method not found'); return; }
    if (!TOOLS.some(t => t.name === params?.name)) { error(id, -32602, 'Unknown tool'); return; }
    if (pending.size >= 8) { error(id, -32000, 'Too many active requests'); return; }
    const controller = new AbortController();
    pending.set(id, controller);
    try {
      const data = await session.call(params.name, params.arguments ?? {}, { signal: controller.signal });
      result(id, { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data, isError: false });
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
