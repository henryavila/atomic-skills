# audit-delivery — release-consistency F0

**Mode:** audit
**Depth:** light
**Axes:** product, residual
**At:** 2026-09-24T23:05:32Z
**HEAD:** e51992971ee935a1db83c7050954c34a08a84621
**Intent source:** plan.md F0 businessIntent + design principles P1

## Intent Package
- Decisions: D1 PR-only default (refuse push); D2 origin/HEAD default-branch; shared conventional-commits assets
- Acceptance/doneWhen: contract tests green; no push-directly ask; G-F0-1
- Vocabulary: OLD ask-before-push-on-main → NEW refuse + PR path; vocabulary migration-shaped for save-and-push only
- Surfaces: skills/core/save-and-push.md; skills/shared/release-assets/*; meta/catalog.yaml; docs/skills/save-and-push.md; tests/*
- Non-goals: release skill, chooser, templates, publish.yml migrate, what_is_not reframe

## Matrix A — Decisions
| ID | Decision | Status | Evidence |
|----|----------|--------|----------|
| D1 | PR-only refuse push on default | RESOLVED | skills/core/save-and-push.md HARD-GATE; tests/save-and-push-pr-only.test.js |
| D2 | Default via origin/HEAD + main\|master | RESOLVED | skills/shared/release-assets/default-branch.md; skill references asset |
| D3 | Conventional-commits shared asset | RESOLVED | skills/shared/release-assets/conventional-commits.md; release-assets-contract.test.js |
| D4 | Catalog/docs pitches match PR-only | RESOLVED | meta/catalog.yaml; docs/skills/save-and-push.md via generate-skill-docs |

## Matrix B — Problems
| ID | Problem | Status | Evidence |
|----|---------|--------|----------|
| P1 | Agents push directly to main/master after ask | RESOLVED | ask language removed; refuse gate; tests assert absence |

## Matrix C — Must-not (oos)
| ID | Must-not | Status | Evidence |
|----|----------|--------|----------|
| M1 | No release skill in F0 | RESOLVED | skills/core/release.md absent |
| M2 | No chooser scripts | RESOLVED | scripts/release absent |
| M3 | No publish.yml migrate | RESOLVED | .github/workflows/publish.yml still npm publish |
| M4 | No what_is_not reframe | RESOLVED | meta/catalog.yaml product.what_is_not unchanged |

## Residual hunt
OLD_TERMS: "Ask the user: push directly", "push directly to main or create branch + PR?"
Surfaces grepped: skill body, catalog, generated docs — **absent** (pass).
Teaching surfaces updated (catalog/docs). No storage/alias residual of ask-path found.

## Findings ledger
CRITICAL: 0
HIGH: 0
MEDIUM: 0
LOW: 0

## Verdict
**CLOSED** — load-bearing D1–D4 and P1 RESOLVED; residual valid; zero CRITICAL/HIGH.

## Accept Register
(none required)

## Self-review
- G1: cites file paths above
- G2: no soft pass language in verdict
- G6: RESOLVED rows carry evidence paths
