---
name: jev-windows
description: Operate the explicitly selected native Windows companion with GPT-controlled single-step execution, source-labelled context and Jev diagnostics. This is not official Computer Use or Open Computer Use; never switch to it implicitly.
---

# Native Windows companion · 1.2.0

Local source: `{{WINDOWS_DIR}}`. Read `{{WINDOWS_DIR}}/UPGRADE-1.2.md` and `{{WINDOWS_DIR}}/ACTIONS.md` before operating. If the user is already using official Computer Use, keep that backend instead. Do not install or launch this companion as a fallback.

## Observe, review, then separately execute

1. Read the host tool guidance and existing authorization. Call `windows_info`, then `windows_list`, and select a real decimal HWND. Never guess app/window/element IDs.
2. Call `windows_observe({hwnd})`. It does not focus the window. Inspect foreground, truncated, elements, snapshotId, sessionId, revision, observedAt and expiration. Root target is `window`.
3. GPT selects one complete action. Optional `windows_execute` without `dryRun:false` only preflights; it does not authorize or execute. For missing UIA targets, first inspect a real `windows_screenshot` of that snapshot.
4. Call `windows_review({snapshotId,goal,action,hostChecks,context})`. Four factual checks are required: userAuthorized, scopeChecked, targetChecked, dataMinimized. Sensitive actions additionally require existing action-specific authorization; do not set sensitiveActionAuthorized as a global switch.
5. Inspect the response and end this tool call. DENY stops the proposal; read reason/diagnostics, do not ask repeatedly until ALLOW. An ALLOW is not execution or proof of completion.
6. In another host tool call, use `windows_execute({snapshotId,action,reviewId,dryRun:false})` with the exact action. Native state is checked again. Each real attempt consumes the review and snapshot, including errors.
7. Re-observe to verify actual results. An error/timeout/cancellation may mean partial input occurred; do not replay blindly. `executed:true` is not task success. Two ineffective actions or a user stop/Escape requires stopping and replanning.

## Source-labelled context

Context is optional for old element-only inputs but REQUIRED for coordinate click_at/drag. It contains backend=`native-windows`, sessionId/windowId from the snapshot (windowId is hwnd), matching revision/observedAt, phase, expectedOutcome, facts, unknowns, and screenshot/visualTargets when visual evidence is used.

Each fact contains name/value/source/reference. Accessibility references must be actual element IDs. Host screenshot interpretation uses source=`host_screenshot` with reference=imageHash, never a fabricated UIA button. User requirements are separately labelled. Retain unknowns; desired values are not observed values.

Screenshot metadata must exactly match the latest windows_screenshot for this snapshot: imageHash, coordinateSpace and bounds from origin/width/height. Visual target boxes must lie inside those bounds. Coordinate starts and drag endpoints must intersect corresponding target boxes. Pass the same imageHash in action.arguments; targetId remains `window`. Coordinates are physical-screen-pixels, not resized preview pixels or CSS units. A hash binds content, not semantic truth or user permission. Screenshot bytes are never sent to Jev.

## Actions and restrictions

Use real current IDs with invoke/click/set_value/type_text/press_key/scroll/toggle/select. Full exact argument contracts are in ACTIONS.md. Prefer semantic actions where supported; no silent fallback to keys or coordinates. Text is literal, not key-macro syntax. Coordinate operations require the evidence above; animation may invalidate a pixel hash and must not be bypassed.

Non-focus input requires the foreground window. Focus is a separate reviewed action; if activation fails, stop instead of forcing it. Do not operate credentials via pixels or expose private data. Never combine prepare/review/execute in an autonomous loop or mix generic reviewer IDs with this server's reviewId.

Read structured diagnostics: invalid_model_response means missing/invalid .noul fields; approval_below_threshold, risk_at_or_above_threshold and review_thresholds_not_met are score-based decisions. Network/HTTP/timeout/expiry are separate. Do not lower thresholds or substitute missing scores.

Requires a native Windows interactive session, Node 22+ and Windows PowerShell 5.1. No UAC/UIPI bypass, lock-screen automation, automatic elevation or machine-wide policy edits. UIA output is bounded and may be incomplete. Host checks are declarations, not trusted authorization tokens. This is not an OS sandbox.

`windows_stop` terminates the worker and invalidates pending state, but cannot undo sent input. Restart the selected MCP/Pi session to resume. Use the app-specific Skill for Paint, Resolve or CapCut; the shared context guide lives at the repository's skill/jev-desktop-context/references/context.md.
