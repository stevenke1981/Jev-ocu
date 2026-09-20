# Windows companion 1.2.0 in Jev-ocu v0.5.0

The native C# driver remains unchanged. The Node review layer now uses shared diagnostics and context; it still never executes as a side effect of review. No new permissions, automatic elevation or backend switching.

## Migration

`windows_info` reports version 1.2.0, diagnosticSchemaVersion=1, structuredContext=true and the current sessionId. `windows_observe` also returns sessionId.

Element actions can still be reviewed with the old input fields. Coordinate `click_at` / `drag` now require `context` with screenshot metadata and visualTargets. Acquire a new windows_observe + windows_screenshot; use the original snapshotId, sessionId, hwnd, revision and observedAt. Build context.backend='native-windows', windowId=hwnd, plus phase, expectedOutcome, facts and unknowns. Map screenshot origin/width/height into bounds and retain imageHash/coordinateSpace. Each host_screenshot fact references that imageHash, and each target box lies inside the screenshot bounds. Coordinates must intersect the relevant visual target boxes.

These are host interpretations, not native control IDs. The action still targets window for coordinate operations. No image bytes go to the model. Unknown/missing evidence is not a reason to make up a button. Exact same action plus returned reviewId is required by windows_execute; native pixel and UIA checks remain in place.

## New reasons

- invalid_model_response: missing/invalid answers.approve.noul or answers.risk.noul.
- approval_below_threshold / risk_at_or_above_threshold / review_thresholds_not_met: parsed scores fail the unchanged thresholds.
- visual_evidence_required / invalid_evidence_binding: no valid current screenshot/context, before model call.
- missing_credentials / provider_network_error / provider_http_error / provider_timeout / cancelled / review_expired: not an intentional model policy rejection.

A request ID is null if unavailable; never fabricated. Diagnostics omit provider error body and private observations. Old clients must not treat a newly differentiated reason as ALLOW; allowed/verdict remain the authoritative review result.

Read the shared context documentation in skill/jev-desktop-context/references/context.md. Do not apply the old unmerged v1.1.0 fix archive on top of this release: its evidence field differs from the new shared context schema. Update from repository and restart the selected MCP/Pi session.

For official Codex Computer Use, use generic reviewer plus your existing official tool, not this optional native server. Merely installing an app Skill does not replace a working backend.
