# Jev-ocu v0.5.0 project contract

For this user's desktop workflow GPT is the main planner, executor and verifier. Jev is an evidence-aware decision helper. Existing cross-agent interfaces remain compatible; do not launch a different agent to operate the desktop.

Read skill/jev-desktop-context/SKILL.md and the chosen app skill before desktop work. Read the actual tool documentation and authorization requirements of the currently selected backend. Never impersonate the official Computer Use runtime with OCU or native Windows. Never silently switch backends on failure. Do not install or start third-party OCU without explicit user selection.

Optional jev_assess_candidates is target/action/done/risk advice only, not a reusable approval. The host then proposes exact arguments. Review -> host inspection -> fresh-state validation -> separate host execution -> observation/verification. Never automatically execute when the model responds ALLOW. Native Windows uses its own windows_review/windows_execute pair; do not double-review or mix IDs across sessions.

Source-labelled context must distinguish real accessibility IDs, host screenshot interpretation and user requirements. Do not invent IDs or paint screenshot annotations into a fake UIA tree. Keep actual units, selection/focus, phase, unknowns and expected outcome. Screenshot hashes bind bytes, not semantic correctness or user authorization. Do not send credentials, raw screenshots or unrelated private UI text to Jev.

Do not lower policy thresholds to get approval. Missing or malformed scores are diagnostic failures, not permission. Expiry, interleaving, cancellation and user Escape invalidate the current plan. Two actions without progress require re-observation and replanning, not repeated identical attempts.

This task modifies Jev-ocu only. Treat iFurySt/open-codex-computer-use and stevenke1981/Jev-cu as read-only references. No write-back, automatic upstream syncing or third-party code vendoring is authorized by a reference alone. Record provenance and keep license notices.

Report local mocks, Windows isolated native smoke, paid model tests, host integration tests and actual app task completion separately. Tool-dispatched is not task-complete; verify actual saved/exported artifacts. Never claim an unperformed real desktop run.
