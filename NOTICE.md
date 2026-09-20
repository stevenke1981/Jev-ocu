# Provenance

Jev-ocu is a separate agent-neutral refactor derived from the OpenRouter provider integration in stevenke1981/Jev-cu v0.2.0, commit a8e9098474111e15b0143efd31350ae85fc9491d. The upstream package declares ISC. The upstream repository remains unchanged.

Upstream: https://github.com/stevenke1981/Jev-cu
New project: https://github.com/stevenke1981/Jev-ocu

The reviewer-only protocol, STDIO server, Pi adapter, CLI, installer, docs and tests are new work. The previous Codex-specific execution loop and its selection benchmarks are not represented as part of this implementation. Original upstream initial commit credits itsgxxxxx (GitHub Sac-Y); retain attribution when redistributing upstream-derived portions.

## v0.5.0 design references

Read-only references: iFurySt/open-codex-computer-use commit 547b4ffb8ed731a8f16486e6d8a3b215484267d3 (MIT) and stevenke1981/Jev-cu commit a85aa64d8c2d897a95c098fb79a2bfa55c839b11 (ISC). New indexed-observation/evidence tooling is inspired by the documented workflows; OCU native runtime code is not redistributed. The official-sky read helper follows the known Jev-cu contract, not a guarantee of public API stability. See docs/REFERENCE-REVIEW.md.
