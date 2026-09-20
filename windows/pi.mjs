import { WindowsSession, WINDOWS_TOOLS } from './desktop.mjs';
import { piSchema } from '../src/pi.mjs';
export default function registerWindows(pi, Type, options = {}) {
  let session = new WindowsSession(options);
  for (const tool of WINDOWS_TOOLS) pi.registerTool({
    name: tool.name, label: tool.name, description: tool.description, parameters: piSchema(tool.inputSchema, Type),
    async execute(_id, args, signal) {
      const result = await session.call(tool.name, args, { signal });
      const { data, ...metadata } = result;
      return { content: data && result.mimeType === 'image/png' ? [{ type: 'text', text: JSON.stringify(metadata) }, { type: 'image', data, mimeType: 'image/png' }] : [{ type: 'text', text: JSON.stringify(result) }], details: data ? metadata : result };
    },
  });
  pi.on('session_start', async () => { session.close(); session = new WindowsSession(options); });
  pi.on('session_shutdown', async () => session.close());
}
