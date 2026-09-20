import { fromIndexedTree } from './indexed-observation.mjs';
/** Read-only integration following Jev-cu a85aa64's known Windows sky contract.
 * The host supplies its real, authorized runtime. No import/installation/fallback or action calls.
 */
export async function observeOfficialWindows(sky, { appName, windowId, sessionId, goal = '', preserveIds = [], signal } = {}) {
  if (sky?.target !== 'windows' || typeof sky.list_apps !== 'function' || typeof sky.get_window_state !== 'function') throw new Error('Official Windows sky runtime unavailable; no fallback');
  if (typeof sessionId !== 'string' || !sessionId) throw new Error('Explicit host sessionId required');
  signal?.throwIfAborted();
  const apps = await sky.list_apps();
  signal?.throwIfAborted();
  if (!Array.isArray(apps)) throw new Error('Unsupported official app-list format');
  const matches = apps.filter(a => a.id === appName || a.displayName === appName);
  if (matches.length !== 1) throw new Error('Select one exact app from list_apps');
  const windows = (matches[0].windows ?? []).filter(w => windowId === undefined || w.id === windowId);
  if (windows.length !== 1 || !Number.isInteger(windows[0].id) || windows[0].app !== matches[0].id) throw new Error('Select one exact official window');
  const window = windows[0];
  const state = await sky.get_window_state({ window, include_screenshot: false, include_text: true });
  signal?.throwIfAborted();
  if (state?.window?.id !== window.id || state?.window?.app !== window.app) throw new Error('Window identity changed');
  const result = fromIndexedTree({ tree: state.accessibility?.tree, source: 'uia', backend: 'official-sky', app: appName, sessionId,
    windowId: String(window.id), observedAt: new Date().toISOString(), goal, preserveIds });
  return { ...result, window: state.window, focusedElement: state.accessibility?.focused_element ?? null, executed: false };
}
