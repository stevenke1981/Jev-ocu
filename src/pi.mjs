import { ReviewSession, TOOLS } from './reviewer.mjs';

/** Convert the shared JSON Schema into the TypeBox supplied by the Pi host. */
export function piSchema(schema, Type) {
  if (schema.type === 'object') {
    const properties = {};
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      const t = piSchema(child, Type);
      properties[key] = schema.required?.includes(key) ? t : Type.Optional(t);
    }
    return Type.Object(properties, { additionalProperties: schema.additionalProperties ?? false });
  }
  if (schema.type === 'array') return Type.Array(piSchema(schema.items, Type), { maxItems: schema.maxItems });
  if (schema.type === 'boolean') return Type.Boolean();
  const { type, ...options } = schema;
  return Type.String(options); // plain string enum, not a Union of Literals
}

export default function registerPi(pi, Type, options = {}) {
  let session = new ReviewSession(options);
  for (const tool of TOOLS) {
    pi.registerTool({
      name: tool.name, label: tool.name, description: tool.description,
      parameters: piSchema(tool.inputSchema, Type),
      async execute(_id, args, signal) {
        const data = await session.call(tool.name, args, { signal });
        return { content: [{ type: 'text', text: JSON.stringify(data) }], details: data };
      },
    });
  }
  // Switching sessions invalidates approvals; never restore them from model history.
  pi.on('session_start', async () => { session.close(); session = new ReviewSession(options); });
  pi.on('session_shutdown', async () => session.close());
}
