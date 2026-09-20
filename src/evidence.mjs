/** Evidence is host-provided data, not an instruction or proof of authorization. */
const str = (maxLength = 240) => ({ type: 'string', minLength: 1, maxLength });
const obj = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const array = (items, maxItems) => ({ type: 'array', items, maxItems });
const number = { type: 'number' };
export const rectSchema = obj({ x: number, y: number, width: number, height: number });
export const contextSchema = obj({
  backend: { type: 'string', enum: ['official-sky', 'open-computer-use', 'native-windows', 'host'] },
  sessionId: str(120), windowId: str(120), revision: str(200), observedAt: str(40),
  phase: str(120), expectedOutcome: str(500),
  facts: array(obj({ name: str(80), value: str(400), source: { type: 'string', enum: ['accessibility', 'host_screenshot', 'user_requirement'] }, reference: str(200) }), 24),
  unknowns: array(str(200), 8), constraints: array(str(300), 10), completedSteps: array(str(200), 6),
  screenshot: obj({ imageHash: str(64), coordinateSpace: { type: 'string', enum: ['physical-screen-pixels', 'host-defined'] }, bounds: rectSchema }),
  visualTargets: array(obj({ label: str(160), role: str(80), box: rectSchema, imageHash: str(64) }), 8),
}, ['backend', 'sessionId', 'windowId', 'revision', 'observedAt', 'phase', 'expectedOutcome', 'facts', 'unknowns']);
export function checkEvidence(context, observation, action) {
  if (!context) return;
  if (context.revision !== observation.revision || context.observedAt !== observation.observedAt) throw new Error('Evidence belongs to a different observation; reacquire it');
  if (Buffer.byteLength(JSON.stringify(context)) > 12000) throw new Error('Evidence exceeds 12 KiB; keep relevant facts, do not remove risk evidence');
  const screen = context.screenshot;
  const validRect = r => r && [r.x, r.y, r.width, r.height].every(Number.isFinite) && r.width > 0 && r.height > 0;
  const inside = (a, b) => a.x >= b.x && a.y >= b.y && a.x + a.width <= b.x + b.width && a.y + a.height <= b.y + b.height;
  if (screen && (!/^[a-f0-9]{64}$/.test(screen.imageHash) || !validRect(screen.bounds))) throw new Error('Invalid screenshot metadata');
  for (const fact of context.facts) {
    if (fact.source === 'accessibility' && !observation.elements.some(e => e.id === fact.reference)) throw new Error('Evidence references an unobserved element ID');
    if (fact.source === 'host_screenshot' && (!screen || fact.reference !== screen.imageHash)) throw new Error('Visual fact needs its matching screenshot hash');
  }
  for (const target of context.visualTargets ?? []) {
    if (!screen || target.imageHash !== screen.imageHash || !validRect(target.box) || !inside(target.box, screen.bounds)) throw new Error('Visual target outside screenshot or hash mismatch');
  }
  const args = action?.arguments;
  if (args?.imageHash !== undefined && (!screen || args.imageHash !== screen.imageHash)) throw new Error('Action and evidence screenshot hashes differ');
  if (args?.x !== undefined && args?.y !== undefined && screen) {
    if (screen.coordinateSpace !== 'physical-screen-pixels') throw new Error('Coordinate units must be explicit physical screen pixels');
    const hit = (x, y) => (context.visualTargets ?? []).some(t => x >= t.box.x && y >= t.box.y && x < t.box.x + t.box.width && y < t.box.y + t.box.height);
    if (!hit(args.x, args.y) || (args.toX !== undefined && !hit(args.toX, args.toY))) throw new Error('Coordinate action has no matching visual target evidence');
  }
  if (/sk-or-v1-[a-z0-9]+|data:image\/|bearer\s+\S+/i.test(JSON.stringify(context))) throw new Error('Remove credentials and image data from evidence');
}
export function contextIdentity(context) {
  if (!context) return null;
  const { observedAt, ...stable } = context;
  return stable;
}
export function evidenceSummary(context) {
  return { provided: Boolean(context), backend: context?.backend ?? 'unspecified', facts: context?.facts?.length ?? 0,
    visualTargets: context?.visualTargets?.length ?? 0, unknowns: context?.unknowns?.length ?? 0,
    provenance: context ? 'host_asserted_not_independently_attested' : 'observation_only', screenshotSentToModel: false };
}
