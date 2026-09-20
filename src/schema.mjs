const str = (maxLength = 200, minLength = 1) => ({ type: 'string', minLength, maxLength });
const obj = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
export const observationSchema = obj({
  source: { type: 'string', enum: ['uia', 'ax', 'dom', 'text'] },
  app: str(), revision: str(), observedAt: str(40), text: str(4000, 0),
  elements: { type: 'array', maxItems: 60, items: obj({ id: str(120), role: str(80), label: str(200, 0), enabled: { type: 'boolean' } }, ['id', 'role', 'label']) },
});
export const actionSchema = obj({
  type: { type: 'string', enum: ['click', 'set_value', 'type_text', 'press_key', 'scroll', 'drag', 'navigate', 'wait'] },
  tool: str(160), targetId: str(120),
  arguments: { type: 'object', additionalProperties: true },
});
export const proposalSchema = obj({ goal: str(1000), observation: observationSchema, action: actionSchema });
export const checksSchema = obj({
  userAuthorized: { type: 'boolean' }, scopeChecked: { type: 'boolean' },
  targetChecked: { type: 'boolean' }, dataMinimized: { type: 'boolean' },
  sensitiveActionAuthorized: { type: 'boolean' },
}, ['userAuthorized', 'scopeChecked', 'targetChecked', 'dataMinimized']);
export const TOOLS = [
  { name: 'jev_info', description: 'Local configuration and capabilities. Does not call the model or operate a computer.', inputSchema: obj({}) },
  { name: 'jev_prepare_review', description: 'Bind a host-proposed exact action to a text UI observation. Returns four host checks; does not call Jev or execute.', inputSchema: obj({ proposal: proposalSchema }) },
  { name: 'jev_review_action', description: 'Review a prepared action using OpenRouter Jev. Returns ALLOW or DENY, never executes. May incur API cost.', inputSchema: obj({ preparedId: str(), hostChecks: checksSchema }) },
  { name: 'jev_validate_review', description: 'One-use local check of an ALLOW against a fresh observation and the exact action. Host still executes and verifies with its own tools.', inputSchema: obj({ preparedId: str(), observation: observationSchema, action: actionSchema }) },
];

export function validate(schema, value, path = 'input') {
  const bad = () => { throw new Error(`Invalid ${path}`); };
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) bad();
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) bad();
    for (const [key, val] of Object.entries(value)) {
      if (Object.hasOwn(schema.properties ?? {}, key)) validate(schema.properties[key], val, `${path}.${key}`);
      else if (schema.additionalProperties === false) bad();
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value) || value.length > schema.maxItems) bad();
    value.forEach((v, i) => validate(schema.items, v, `${path}[${i}]`));
  } else if (schema.type === 'string') {
    if (typeof value !== 'string' || value.length < (schema.minLength ?? 0) || value.length > (schema.maxLength ?? Infinity)) bad();
    if (schema.enum && !schema.enum.includes(value)) bad();
  } else if (schema.type === 'boolean' && typeof value !== 'boolean') bad();
}
