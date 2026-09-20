import { WindowsSession, WINDOWS_TOOLS } from './desktop.mjs';
// TypeBox is supplied by the Pi host. This module has no Pi package dependency.
function schema(s, Type) {
  if (s.type === 'object') return Type.Object(Object.fromEntries(Object.entries(s.properties ?? {}).map(([k, v]) => [k, (s.required ?? []).includes(k) ? schema(v, Type) : Type.Optional(schema(v, Type))])), { additionalProperties: s.additionalProperties ?? false });
  if (s.type === 'boolean') return Type.Boolean();
  const { type, ...options } = s; return Type.String(options);
}
export default function registerWindows(pi, Type, options = {}) {
  let session = new WindowsSession(options);
  for (const tool of WINDOWS_TOOLS) pi.registerTool({
    name: tool.name, label: tool.name, description: tool.description, parameters: schema(tool.inputSchema, Type),
    async execute(_id, args, signal) {
      const result = await session.call(tool.name, args, { signal });
      const { data, ...metadata } = result;
      return { content: data && result.mimeType === 'image/png' ? [{ type: 'text', text: JSON.stringify(metadata) }, { type: 'image', data, mimeType: 'image/png' }] : [{ type: 'text', text: JSON.stringify(result) }], details: data ? metadata : result };
    },
  });
  pi.on('session_start', async () => { session.close(); session = new WindowsSession(options); });
  pi.on('session_shutdown', async () => session.close());
}
