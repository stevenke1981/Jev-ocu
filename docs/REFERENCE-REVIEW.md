# Reference review and implementation scope

Reference date: 2026-09-20. Sources read through the connected GitHub integration; reference repositories remain unchanged.

| Source | Pinned commit | Adopted here | Not copied / not claimed |
|---|---|---|---|
| iFurySt/open-codex-computer-use | 547b4ffb8ed731a8f16486e6d8a3b215484267d3 | explicit backend identity, fresh indexed-state workflow, semantic-first targeting, bounded text/tree budgets, clear platform/permission limits | no Swift/Go native runtime vendoring; no private SkyLight/background injection, automatic OCU install or implicit fallback |
| stevenke1981/Jev-cu | a85aa64d8c2d897a95c098fb79a2bfa55c839b11 (v0.6.0) | known official sky list/get-state contract, original indices and Chinese labels, optional target/action/done/risk advice, host-separated decision/execution | no replacement of the user's working Jev-cu; no claim that API shape checks prove official provenance; no automatic full-task loop |
| Jev-ocu baseline | beb912150eee7c43af3066a958cd51ad614b92c3 (v0.4.0) | preserve reviewer MCP/CLI/Pi and optional Windows native companion | no lowering of approve/risk thresholds or removal of original confirmations |

## Concrete fixes

The previous Windows review merged missing scores, low approve and high risk into model_denied_or_uncertain. src/diagnostics.mjs now distinguishes these, retains safely parsed scores and reports safe request metadata. Raw response text, headers and secrets are not exposed in diagnostics. HTTP/network/timeout/cancel and expiry are not reclassified as a model policy decision.

src/evidence.mjs provides a shared, schema-validated context object. Generic reviews bind it along with the exact action and observation. Native reviews additionally compare screenshot metadata from the actual local screenshot tool. Host annotations are always labelled host_screenshot; no new native UIA elements are manufactured.

src/adapters/official-sky.mjs only reads state. src/adapters/indexed-observation.mjs imports explicit indexed tree text and reports omissions; it is not an OCU subprocess/MCP proxy. The user must already have an authorized OCU connection for OCU data. Both adapters return data to the host, not an executable action. The original native.cs remains unchanged in this release.

src/app-skills.mjs installs a four-skill bundle transactionally with backups outside discovery, without touching credentials or host configuration. The older generic installer also moves its update backups outside skill discovery. The actual app procedures are new workflow guidance, not automation scripts that modify project files behind the GUI.

## Source links

- https://github.com/iFurySt/open-codex-computer-use/tree/547b4ffb8ed731a8f16486e6d8a3b215484267d3/skills/open-computer-use
- https://github.com/stevenke1981/Jev-cu/blob/a85aa64d8c2d897a95c098fb79a2bfa55c839b11/scripts/windows-driver.mjs
- https://github.com/stevenke1981/Jev-cu/blob/a85aa64d8c2d897a95c098fb79a2bfa55c839b11/skill/jev-use/references/runtime.md
- https://openrouter.ai/openapi.json — Decisions request/response contract
- https://learn.chatgpt.com/docs/computer-use — official tool setup; actual runtime documentation takes precedence
- https://www.microsoft.com/en-us/windows/paint
- https://www.blackmagicdesign.com/products/davinciresolve/edit
- https://www.blackmagicdesign.com/products/davinciresolve/training
- https://www.capcut.com/resource/how-to-add-keyframes-in-capcut
- https://www.capcut.com/help/how-to-import-subtitles

OCU is MIT-licensed. This release refers to its documented design rather than redistributing its source code. Jev-cu and this repository declare ISC; existing attribution is retained in NOTICE.md. Screenshots/private user state from neither reference are included.
