/** Pure diagnostics. Never normalize malformed values to approval. */
export const REVIEW_THRESHOLDS = Object.freeze({ approveMin: 0.9, riskMaxExclusive: 0.2 });
export function safeId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_./:-]{1,160}$/.test(value) && !/sk-|bearer|secret/i.test(value) ? value : null;
}
function score(answer, path) {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer) || !Object.hasOwn(answer, 'noul')) return { value: null, issue: { path, code: 'missing_field' } };
  const raw = answer.noul;
  if (typeof raw !== 'number' && (typeof raw !== 'string' || !/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(raw))) return { value: null, issue: { path, code: 'invalid_type_or_numeric_format' } };
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) return { value: null, issue: { path, code: 'out_of_range' } };
  return { value, issue: null };
}
export function responseMetadata(response = {}) {
  return { model: safeId(response.model), requestId: safeId(response.requestId),
    httpStatus: Number.isInteger(response.httpStatus) ? response.httpStatus : null,
    latencyMs: Number.isFinite(response.latencyMs) && response.latencyMs >= 0 ? response.latencyMs : null };
}
export function diagnoseReview(response = {}) {
  const approve = score(response.answers?.approve, 'answers.approve.noul');
  const risk = score(response.answers?.risk, 'answers.risk.noul');
  const issues = [approve.issue, risk.issue].filter(Boolean);
  const failedChecks = [];
  if (approve.value !== null && approve.value < REVIEW_THRESHOLDS.approveMin) failedChecks.push('approval_below_threshold');
  if (risk.value !== null && risk.value >= REVIEW_THRESHOLDS.riskMaxExclusive) failedChecks.push('risk_at_or_above_threshold');
  const reason = issues.length ? 'invalid_model_response' : failedChecks.length === 2 ? 'review_thresholds_not_met' : failedChecks[0] ?? 'review_passed';
  return { allowed: reason === 'review_passed', reason, diagnostics: {
    schemaVersion: 1, ...responseMetadata(response), probabilities: { approve: approve.value, risk: risk.value },
    thresholds: REVIEW_THRESHOLDS, issues, failedChecks,
  } };
}
export function diagnoseError(err, { cancelled = false } = {}) {
  const known = new Set(['missing_credentials', 'provider_timeout', 'provider_cancelled', 'provider_network_error', 'invalid_model_response', 'provider_http_error']);
  const reason = cancelled ? 'cancelled' : known.has(err?.code) ? err.code : 'provider_error';
  return { reason, diagnostics: { schemaVersion: 1, requestId: safeId(err?.requestId), model: safeId(err?.model),
    httpStatus: Number.isInteger(err?.status) ? err.status : null, probabilities: { approve: null, risk: null }, thresholds: REVIEW_THRESHOLDS } };
}
