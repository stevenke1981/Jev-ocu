import { ask, DEFAULT_MODEL } from '../src/openrouter.mjs';
export const MODEL = DEFAULT_MODEL;
export function askWindows(options) { return ask({ ...options, timeoutMs: 20000, maxRetries: 1 }); }
