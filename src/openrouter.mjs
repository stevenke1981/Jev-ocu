import { safeId } from './diagnostics.mjs';
/** Provider migration based on Jev-cu a8e9098. No desktop execution code. */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

export const DEFAULT_ENDPOINT = 'https://openrouter.ai/api/alpha/decisions';
export const DEFAULT_MODEL = 'typesafe/jev-1.13';
export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const PRICE_PER_INPUT_TOKEN_USD = 0.042 / 1e6;

export function loadApiKey({ env = process.env, envFile = env.JEV_ENV_FILE || `${ROOT}.env.local` } = {}) {
  const direct = String(env.OPENROUTER_API_KEY ?? '').trim();
  if (direct) return direct;
  let text = '';
  try { text = fs.readFileSync(envFile, 'utf8'); }
  catch (err) { if (err.code !== 'ENOENT') throw new Error('Cannot read OpenRouter key file'); }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?OPENROUTER_API_KEY\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const v = m[1];
    const key = (/^(["']).*\1$/.test(v) ? v.slice(1, -1) : v.replace(/\s+#.*$/, '')).trim();
    if (key) return key;
  }
  throw new Error('Missing OPENROUTER_API_KEY; set the environment or project .env.local');
}

export function number(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function estimateCostUsd(usage = {}) {
  const cost = number(usage?.cost);
  if (cost !== null && cost >= 0) return cost;
  const tokens = number(usage?.input_tokens ?? usage?.inputTokens);
  return tokens !== null && tokens >= 0 ? tokens * PRICE_PER_INPUT_TOKEN_USD : null;
}

export function summarizeUsage(usage = {}) {
  return {
    input_tokens: number(usage?.input_tokens ?? usage?.inputTokens),
    output_tokens: number(usage?.output_tokens ?? usage?.outputTokens),
    costUsd: estimateCostUsd(usage),
    costSource: number(usage?.cost) !== null && number(usage?.cost) >= 0 ? 'reported' : 'estimate_or_unknown',
  };
}

export async function ask({ state, questions, apiKey, signal, fetchImpl = fetch, timeoutMs = 20_000, maxRetries = 2, retryDelayMs = 250 }) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) throw new Error('Invalid timeoutMs');
  if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 3) throw new Error('Invalid maxRetries');
  let key;
  try { key = String(apiKey ?? loadApiKey()).trim(); if (!key) throw new Error(); }
  catch { const err = new Error('Missing OPENROUTER_API_KEY'); err.code = 'missing_credentials'; throw err; }
  const body = JSON.stringify({ model: DEFAULT_MODEL, state, questions });
  if (Buffer.byteLength(body) > 65_536) throw new Error('Decisions request exceeds 64 KiB');
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(new Error('OpenRouter request timed out')), timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal;
  const started = Date.now();
  let requestId = null, status = null;
  try {
    for (let attempt = 0; ; attempt++) {
      combined.throwIfAborted();
      const res = await fetchImpl(DEFAULT_ENDPOINT, {
        method: 'POST', redirect: 'error', signal: combined,
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body,
      });
      status = res.status;
      requestId = safeId(res.headers?.get?.('x-request-id')) ?? safeId(res.headers?.get?.('request-id'));
      let payload = null;
      try { payload = await res.json(); }
      catch { combined.throwIfAborted(); }
      combined.throwIfAborted();
      requestId = safeId(payload?.id) ?? requestId;
      if (res.ok && payload?.answers && typeof payload.answers === 'object' && !Array.isArray(payload.answers)) {
        return { answers: payload.answers, usage: summarizeUsage(payload.usage), model: safeId(payload.model) ?? DEFAULT_MODEL, requestId, httpStatus: status, latencyMs: Date.now() - started };
      }
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        await delay(retryDelayMs * (attempt + 1), undefined, { signal: combined });
        continue;
      }
      // Do not reflect provider error text: it can echo keys or private observations.
      const err = new Error(res.ok ? 'Invalid OpenRouter Decisions response' : `OpenRouter HTTP ${res.status}`);
      err.status = res.status; err.requestId = requestId; err.model = DEFAULT_MODEL;
      err.code = res.ok ? 'invalid_model_response' : 'provider_http_error';
      throw err;
    }
  } catch (err) {
    if (combined.aborted) {
      const aborted = new Error(signal?.aborted ? 'Review cancelled' : 'OpenRouter request timed out');
      Object.assign(aborted, { code: signal?.aborted ? 'provider_cancelled' : 'provider_timeout', requestId, status, model: DEFAULT_MODEL }); throw aborted;
    }
    if (err.status !== undefined) throw err;
    const failed = new Error('OpenRouter request failed; check connectivity and configuration');
    Object.assign(failed, { code: 'provider_network_error', requestId, status, model: DEFAULT_MODEL }); throw failed;
  } finally { clearTimeout(timer); }
}
