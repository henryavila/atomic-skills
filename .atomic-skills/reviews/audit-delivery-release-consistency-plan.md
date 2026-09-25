# audit-delivery — release-consistency (plan-level)

**Mode:** audit  
**Depth:** light (product + residual parent greps)  
**Axes:** product, residual  
**At:** 2026-09-25T00:11:59Z  
**HEAD:** 312bd691288343aec51a4b9e237e43504387ad5d  
**Intent source:** `.atomic-skills/projects/atomic-skills/release-consistency/plan.md` + design principles P1–P7 + phase BIs

## Intent Package

### Decisions
| ID | Decision | Why |
|----|----------|-----|
| D1 / P1 | PR-only on default via origin/HEAD; refuse push; PR path | Agents stop shortcutting main |
| D2 / P2 | Deterministic chooser (no invent bump) | Semver honesty |
| D3 / P3 | npm happy path = stage publish + human 2FA | No direct publish |
| D4 / P4 | Dual-mode GH-only vs stage-or-refuse | Correct behavior without npm Action |
| D5 / P5 | Templates opt-in with check+diff+consent | Installer never writes consumer .github |
| D6 / P6 | Executable enforcement (tests/CI) | Prose alone insufficient |
| D7 / P7 | Dogfood AS publish.yml after fixture | Process change only after proof |

### Problems
| ID | Problem | Fix shape |
|----|---------|-----------|
| P1 | Ask-before-push on main left the shortcut alive | Refuse + PR |
| P2 | No release skill / invent bump | Chooser + skill Iron Law |
| P3 | AS publish.yml direct npm publish | Migrate to stage |

### Acceptance / doneWhen
| ID | Criterion | Evidence |
|----|-----------|----------|
| A1 | G-F0-1 | tests/save-and-push-pr-only + release-assets-contract |
| A2 | G-F1-1/G-F1-2 | semver/release-cli + catalog release + release-adopt |
| A3 | G-F2-1/G-F2-2 | release-fixture + stage publish.yml + catalog-product-boundary |

### Vocabulary
| OLD | NEW | Scope |
|-----|-----|-------|
| ask push directly to main | refuse + branch + gh pr create | skill/docs/catalog |
| invent semver bump | chooser classifyBump | scripts/release + skill |
| npm publish happy path | npm stage publish + stage approve | Action + KB |
| fixture release-consumer (greenfield) | release-hygiene-consumer | tests/fixtures |

### Surfaces (≥3)
| Surface | Path | Role |
|---------|------|------|
| Skill | skills/core/save-and-push.md, skills/core/release.md | Agent gates |
| Assets | skills/shared/release-assets/* | Shared contract + templates + adopt |
| Scripts | scripts/release/* | Chooser |
| Catalog/docs | meta/catalog.yaml, docs/skills/*, docs/kb/release-npm-stage.md, README | Teaching |
| CI | .github/workflows/publish.yml | Dogfood stage |
| Tests | tests/*release*, tests/catalog-product-boundary, fixtures | Enforcement |

### Non-goals
- Auto-merge; Bypass 2FA; installer scaffolding consumer workflows; claiming AS owns git workflow

### Key SSOT
- plan.md principles P1–P7; design.md D1–D9; release-assets; scripts/release; publish.yml

## Matrix A — Decisions
| ID | Status | Evidence (file:line / path) |
|----|--------|------------------------------|
| D1 | RESOLVED | skills/core/save-and-push.md HARD-GATE; tests/save-and-push-pr-only.test.js |
| D2 | RESOLVED | scripts/release/semver-bump.js; tests/semver-bump.test.js feature-forbids-patch |
| D3 | RESOLVED | .github/workflows/publish.yml stage publish; templates/publish-stage.yml; docs/kb/release-npm-stage.md |
| D4 | RESOLVED | skills/core/release.md dual-mode; tests/release-fixture refuse ship without Action |
| D5 | RESOLVED | skills/shared/release-assets/adopt.md; tests/release-adopt.test.js |
| D6 | RESOLVED | 39/39 related unit tests pass this run; validate-skills 0 |
| D7 | RESOLVED | publish.yml migrated after fixture tests exist |

## Matrix B — Problems
| ID | Status | Evidence |
|----|--------|----------|
| P1 | RESOLVED | ask-push language absent in skill/docs/catalog |
| P2 | RESOLVED | skills/core/release.md + catalog entry |
| P3 | RESOLVED | no `^\s+- run: npm publish` happy path in AS publish.yml |

## Matrix C — Must-not
| ID | Status | Evidence |
|----|--------|----------|
| M1 blackbox fixture untouched | RESOLVED | tests/fixtures/release-consumer/ still present; hygiene uses release-hygiene-consumer |
| M2 what_is_not keeps not-git-workflow | RESOLVED | meta/catalog.yaml + agent-gate clarification line |
| M3 no Bypass 2FA | RESOLVED | stage approve docs; OIDC stage path |

## Residual hunt
OLD_TERMS × surfaces:
- "Ask the user: push directly" / "push directly to main or create branch + PR?" → skill/docs/catalog: **absent**
- bare `npm publish` as AS Action happy path → publish.yml: **absent** (stage publish present)
- invent bump in release skill → Iron Law forbids; chooser tests gate feat→patch
Invalid residual: none. Residual leg: **valid**.

## Findings ledger
CRITICAL: 0  
HIGH: 0  
MEDIUM: 0  
LOW: 0  

## Live verification (this audit)
`node --test` over save-and-push-pr-only, release-assets-contract, semver-bump, release-cli, release-adopt, release-fixture, catalog-product-boundary → **39 pass / 0 fail**.  
`npm run validate-skills` → 17 skills valid.

## Verdict
**CLOSED** — load-bearing D1–D7 and P1–P3 RESOLVED; residual valid; zero CRITICAL/HIGH.

## Accept Register
(none required)

## Self-review
- G1: paths cited above; suite output captured this run  
- G2: no soft "looks shipped" as verdict basis  
- G6: RESOLVED rows carry evidence paths  

## Note on plan-end
This plan-level audit-delivery is **not** a substitute for automate plan-end `review-code --mode=external-both` + `intentVsDelivered` + `userValidatedAt`. It does satisfy an adversarial intent-vs-delivered audit for operator confidence before that gate.
