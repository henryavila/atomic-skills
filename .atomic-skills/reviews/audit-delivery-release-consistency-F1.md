# audit-delivery — release-consistency F1
**Depth:** light | **Axes:** product, residual | **At:** 2026-09-24T23:28:44Z | **HEAD:** b3d3cb5ec24fee4fa715bef9a6a567cfc2574ec3

## Intent Package
D1 chooser deterministic; D2 release skill Iron Law no invent bump; D3 templates stage/GH-only; D4 adopt check+diff+consent; D5 dual-mode.
Acceptance: G-F1-1 G-F1-2. Vocabulary: invent-bump → chooser. Surfaces: scripts/release, skills/core/release.md, catalog, templates, adopt, tests. Non-goals: publish.yml migrate, what_is_not, fixture F2.

## Matrix
| ID | Status | Evidence |
|----|--------|----------|
| D1 | RESOLVED | scripts/release/semver-bump.js + tests/semver-bump.test.js |
| D2 | RESOLVED | skills/core/release.md + catalog release + validate-skills |
| D3 | RESOLVED | templates/publish-stage.yml stage publish; publish-gh-only.yml |
| D4 | RESOLVED | adopt.md + tests/release-adopt.test.js |
| D5 | RESOLVED | release.md dual-mode docs |
| M1 no publish.yml migrate | RESOLVED | .github/workflows/publish.yml still npm publish |

## Residual
OLD invent-bump / bare npm publish as skill happy path — absent in release skill and stage template (rg stage publish present; bare publish not happy path in template).

## Verdict
**CLOSED** — zero CRITICAL/HIGH; residual valid.
