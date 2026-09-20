import { createHash } from 'node:crypto';
const roles = ['radio button', 'text field', 'search field', 'menu item', 'combo box', 'standard window', 'button', 'checkbox', 'text', 'window', 'tab', 'slider', 'pane', '按鈕', '按钮', '核取方塊', '複選框', '文字欄位', '編輯', '编辑', '文字', '文本', '視窗', '窗口', '索引標籤'];
const aliases = { '按鈕':'button', '按钮':'button', '核取方塊':'checkbox', '複選框':'checkbox', '文字欄位':'text field', '編輯':'text field', '编辑':'text field', '文字':'text', '文本':'text', '視窗':'window', '窗口':'window', '索引標籤':'tab' };
/** Parse ONLY explicit indexed tree lines, never document_text or image captions. */
export function fromIndexedTree({ tree, app, source = 'text', backend, sessionId, windowId, observedAt, goal = '', preserveIds = [], maxElements = 40 }) {
  if (typeof tree !== 'string' || !tree.trim() || Buffer.byteLength(tree) > 262144) throw new Error('A real bounded indexed accessibility tree is required');
  if (!['official-sky', 'open-computer-use', 'host'].includes(backend)) throw new Error('Explicit backend required; no automatic fallback');
  for (const field of [app, sessionId, windowId]) if (typeof field !== 'string' || !field || field.length > 200) throw new Error('Explicit app/session/window identity required');
  if (!['uia', 'ax', 'dom', 'text'].includes(source)) throw new Error('Invalid observation source');
  if (typeof observedAt !== 'string' || !Number.isFinite(Date.parse(observedAt)) || !/T.*(?:Z|[+-]\d\d:\d\d)$/.test(observedAt)) throw new Error('Actual observation timestamp with timezone is required');
  if (!Number.isInteger(maxElements) || maxElements < 2 || maxElements > 60) throw new Error('maxElements must be 2–60');
  if (!Array.isArray(preserveIds) || !preserveIds.every(i => typeof i === 'string') || preserveIds.length > maxElements) throw new Error('Invalid preserveIds');
  const elements = [], seen = new Set();
  for (const line of tree.split('\n')) {
    const match = /^\s*(?:\[(\d+)\]|(\d+))\s+(.+)$/.exec(line);
    if (!match) continue;
    const id = match[1] ?? match[2]; // Keep the original text index, including zero.
    if (seen.has(id)) throw new Error('Duplicate source indices; get a fresh full state rather than concatenate snapshots');
    seen.add(id);
    const raw = match[3].trim();
    const role = roles.find(r => raw === r || raw.startsWith(r + ' ') || raw.startsWith(r + ':')) ?? 'unknown';
    const label = raw.slice(role === 'unknown' ? 0 : role.length).trim().slice(0, 200);
    elements.push({ id, role: aliases[role] ?? role, label, enabled: !/(?:\bdisabled\b|停用|已停用|不可用|已禁用)/i.test(raw) });
  }
  if (!elements.length) throw new Error('No source indices found; GPT must inspect the actual screenshot, not invent UIA nodes');
  for (const id of preserveIds) if (!seen.has(id)) throw new Error('Required target ID is absent from source tree');
  const terms = String(goal).toLowerCase().match(/[a-z0-9]{2,}|[\u3400-\u9fff]{1,8}/g) ?? [];
  const ranked = elements.map((e, n) => ({ e, n, score: (preserveIds.includes(e.id) ? 10000 : 0) + (/button|field|checkbox|menu|tab|slider/.test(e.role) ? 4 : 0) + (e.enabled ? 0 : -10) + terms.reduce((v, t) => v + (e.label.toLowerCase().includes(t) ? 8 : 0), 0) }));
  ranked.sort((a,b) => b.score - a.score || a.n - b.n);
  const selected = ranked.slice(0, maxElements).sort((a,b) => a.n - b.n).map(x => x.e);
  const revision = createHash('sha256').update(JSON.stringify([backend, sessionId, windowId, tree])).digest('hex');
  return {
    observation: { source, app, revision, observedAt, text: selected.filter(e => e.role === 'text' || e.role === 'window').map(e => e.label).join('\n').slice(0,4000), elements: selected },
    binding: { backend, sessionId, windowId, revision, observedAt },
    report: { sourceElements: elements.length, selectedElements: selected.length, omittedElements: elements.length - selected.length, truncated: elements.length > selected.length, indexPolicy: 'original_indices_preserved', fullTreeSentToJev: false },
  };
}
